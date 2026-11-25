#include "lifecycle/p13_lifecycle_adapters.h"

#include <algorithm>
#include <memory>

namespace p13::harness {
namespace {

struct LocalFreeDeleter {
    void operator()(void *value) const noexcept {
        if (value != nullptr) {
            LocalFree(value);
        }
    }
};

Status BuildExplicitAcl(const SealedPolicy &policy,
                        PSID owner,
                        PACL *acl,
                        std::wstring *diagnostic) {
    PSID guardian = nullptr;
    PSID supervisor = nullptr;
    PSID ownerRights = nullptr;
    if (!ConvertStringSidToSidW(policy.guardianSid.c_str(), &guardian) ||
        !ConvertStringSidToSidW(policy.supervisorSid.c_str(), &supervisor) ||
        !ConvertStringSidToSidW(L"S-1-3-4", &ownerRights)) {
        if (diagnostic != nullptr) {
            *diagnostic = L"SEALED ACL SID conversion failed";
        }
        if (guardian != nullptr) LocalFree(guardian);
        if (supervisor != nullptr) LocalFree(supervisor);
        if (ownerRights != nullptr) LocalFree(ownerRights);
        return Status::InvalidCall;
    }
    std::unique_ptr<void, LocalFreeDeleter> guardianGuard(guardian);
    std::unique_ptr<void, LocalFreeDeleter> supervisorGuard(supervisor);
    std::unique_ptr<void, LocalFreeDeleter> ownerRightsGuard(ownerRights);

    EXPLICIT_ACCESSW entries[3]{};
    entries[0].grfAccessPermissions =
        WRITE_DAC | WRITE_OWNER | FILE_WRITE_DATA | FILE_APPEND_DATA |
        FILE_WRITE_EA | FILE_WRITE_ATTRIBUTES | DELETE | FILE_ADD_FILE |
        FILE_ADD_SUBDIRECTORY | FILE_DELETE_CHILD;
    entries[0].grfAccessMode = DENY_ACCESS;
    entries[0].grfInheritance = NO_INHERITANCE;
    entries[0].Trustee.TrusteeForm = TRUSTEE_IS_SID;
    entries[0].Trustee.TrusteeType = TRUSTEE_IS_WELL_KNOWN_GROUP;
    entries[0].Trustee.ptstrName = static_cast<LPWSTR>(ownerRights);

    entries[1].grfAccessPermissions =
        FILE_GENERIC_READ | FILE_READ_ATTRIBUTES;
    entries[1].grfAccessMode = SET_ACCESS;
    entries[1].grfInheritance = NO_INHERITANCE;
    entries[1].Trustee.TrusteeForm = TRUSTEE_IS_SID;
    entries[1].Trustee.TrusteeType = TRUSTEE_IS_GROUP;
    entries[1].Trustee.ptstrName = static_cast<LPWSTR>(guardian);

    entries[2].grfAccessPermissions =
        FILE_GENERIC_READ | FILE_READ_ATTRIBUTES;
    entries[2].grfAccessMode = SET_ACCESS;
    entries[2].grfInheritance = NO_INHERITANCE;
    entries[2].Trustee.TrusteeForm = TRUSTEE_IS_SID;
    entries[2].Trustee.TrusteeType = TRUSTEE_IS_GROUP;
    entries[2].Trustee.ptstrName = static_cast<LPWSTR>(supervisor);

    const DWORD error = SetEntriesInAclW(3, entries, nullptr, acl);
    if (error != ERROR_SUCCESS) {
        if (diagnostic != nullptr) {
            *diagnostic = L"SetEntriesInAclW failed";
        }
        return Status::InvalidCall;
    }
    (void)owner;
    return Status::Ok;
}

bool SameObservation(const FileObservation &left, const FileObservation &right) {
    return left.volumeSerialNumber == right.volumeSerialNumber &&
           left.fileId == right.fileId && left.size == right.size &&
           left.sha256 == right.sha256 &&
           left.numberOfLinks == right.numberOfLinks &&
           left.deletePending == right.deletePending &&
           _wcsicmp(left.ownerSid.c_str(), right.ownerSid.c_str()) == 0 &&
           left.daclDigest == right.daclDigest &&
           left.protectedDacl == right.protectedDacl &&
           left.ownerRightsDenyVerified == right.ownerRightsDenyVerified;
}

}  // namespace

Status BuildProtectedCanonicalDescriptor(const SealedPolicy &policy,
                                         std::vector<unsigned char> *descriptorBytes,
                                         std::wstring *diagnostic) {
    if (descriptorBytes == nullptr || policy.canonicalOwnerSid.empty() ||
        policy.guardianSid.empty() || policy.supervisorSid.empty()) {
        return Status::InvalidCall;
    }
    PSID owner = nullptr;
    if (!ConvertStringSidToSidW(policy.canonicalOwnerSid.c_str(), &owner)) {
        return Status::InvalidCall;
    }
    std::unique_ptr<void, LocalFreeDeleter> ownerGuard(owner);
    PACL acl = nullptr;
    const Status aclStatus = BuildExplicitAcl(policy, owner, &acl, diagnostic);
    if (aclStatus != Status::Ok) {
        return aclStatus;
    }
    std::unique_ptr<void, LocalFreeDeleter> aclGuard(acl);

    SECURITY_DESCRIPTOR descriptor{};
    if (!InitializeSecurityDescriptor(&descriptor, SECURITY_DESCRIPTOR_REVISION) ||
        !SetSecurityDescriptorOwner(&descriptor, owner, FALSE) ||
        !SetSecurityDescriptorDacl(&descriptor, TRUE, acl, FALSE) ||
        !SetSecurityDescriptorControl(&descriptor, SE_DACL_PROTECTED,
                                      SE_DACL_PROTECTED)) {
        if (diagnostic != nullptr) {
            *diagnostic = L"protected Security Descriptor construction failed";
        }
        return Status::InvalidCall;
    }
    DWORD length = 0;
    MakeSelfRelativeSD(&descriptor, nullptr, &length);
    descriptorBytes->assign(length, 0);
    if (!MakeSelfRelativeSD(
            &descriptor,
            reinterpret_cast<PSECURITY_DESCRIPTOR>(descriptorBytes->data()),
            &length)) {
        descriptorBytes->clear();
        return Status::InvalidCall;
    }
    descriptorBytes->resize(length);
    return Status::Ok;
}

Status RunAccessCheckAdapter(HANDLE token,
                             const void *securityDescriptor,
                             DWORD desiredAccess,
                             DWORD *grantedAccess,
                             std::wstring *diagnostic) {
    if (token == nullptr || securityDescriptor == nullptr ||
        grantedAccess == nullptr) {
        return Status::InvalidCall;
    }
    PRIVILEGE_SET privileges{};
    DWORD privilegeLength = sizeof(privileges);
    DWORD granted = 0;
    BOOL accessStatus = FALSE;
    GENERIC_MAPPING mapping{
        FILE_GENERIC_READ,
        FILE_GENERIC_WRITE,
        FILE_GENERIC_EXECUTE,
        FILE_ALL_ACCESS,
    };
    if (!AccessCheck(const_cast<PSECURITY_DESCRIPTOR>(securityDescriptor),
                     token, desiredAccess, &mapping, &privileges,
                     &privilegeLength, &granted, &accessStatus)) {
        if (diagnostic != nullptr) {
            *diagnostic = L"AccessCheck failed";
        }
        return Status::EvidenceUnknown;
    }
    *grantedAccess = granted;
    return accessStatus ? Status::Ok : Status::IdentityMismatch;
}

Status EvaluateSealedEvidence(const EvidenceRecord &helperEffect,
                              const EvidenceRecord &supervisorVerification,
                              EvidenceState *state,
                              std::wstring *diagnostic) {
    if (state == nullptr) {
        return Status::InvalidCall;
    }
    *state = EvidenceState::Unknown;
    if (!EqualGuid(helperEffect.grantId, supervisorVerification.grantId) ||
        !EqualGuid(helperEffect.operationId, supervisorVerification.operationId) ||
        !EqualGuid(helperEffect.sessionId, supervisorVerification.sessionId) ||
        helperEffect.sourceType != "HELPER_EFFECT" ||
        supervisorVerification.sourceType != "SUPERVISOR_VERIFICATION") {
        if (diagnostic != nullptr) {
            *diagnostic = L"Evidence identity/audience mismatch";
        }
        return Status::EvidenceMismatch;
    }
    if (!helperEffect.publisherExited ||
        !helperEffect.publisherWriteHandlesClosed ||
        !helperEffect.sealerExited ||
        !helperEffect.supervisorReadOnlyVerified ||
        !helperEffect.observation.protectedDacl ||
        !helperEffect.observation.ownerRightsDenyVerified ||
        !SameObservation(helperEffect.observation,
                         supervisorVerification.observation) ||
        !supervisorVerification.supervisorReadOnlyVerified) {
        if (diagnostic != nullptr) {
            *diagnostic = L"Evidence proof is incomplete";
        }
        *state = EvidenceState::Mismatch;
        return Status::EvidenceMismatch;
    }
    *state = EvidenceState::Matched;
    return Status::Ok;
}

}  // namespace p13::harness

