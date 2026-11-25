#include "identity/p13_identity_adapter.h"

#include <algorithm>
#include <cstdlib>

namespace p13::harness {
namespace {

std::wstring Win32Message(DWORD error) {
    wchar_t *buffer = nullptr;
    const DWORD flags = FORMAT_MESSAGE_ALLOCATE_BUFFER |
                        FORMAT_MESSAGE_FROM_SYSTEM |
                        FORMAT_MESSAGE_IGNORE_INSERTS;
    const DWORD length =
        FormatMessageW(flags, nullptr, error, 0,
                       reinterpret_cast<LPWSTR>(&buffer), 0, nullptr);
    std::wstring message;
    if (length != 0 && buffer != nullptr) {
        message.assign(buffer, length);
    }
    if (buffer != nullptr) {
        LocalFree(buffer);
    }
    return message;
}

Status Fail(Status status, std::wstring message, std::wstring *diagnostic) {
    if (diagnostic != nullptr) {
        *diagnostic = std::move(message);
    }
    return status;
}

bool QueryTokenBytes(HANDLE token,
                     TOKEN_INFORMATION_CLASS informationClass,
                     std::vector<unsigned char> *bytes) {
    DWORD required = 0;
    GetTokenInformation(token, informationClass, nullptr, 0, &required);
    if (required == 0) {
        return false;
    }
    bytes->assign(required, 0);
    return GetTokenInformation(token, informationClass, bytes->data(), required,
                               &required) != FALSE;
}

SidEvidence ToSidEvidence(PSID sid, DWORD attributes) {
    SidEvidence evidence;
    evidence.bytes = CopySidBytes(sid);
    evidence.text = SidToString(sid);
    evidence.attributes = attributes;
    evidence.enabled = (attributes & SE_GROUP_ENABLED) != 0;
    evidence.denyOnly = (attributes & SE_GROUP_USE_FOR_DENY_ONLY) != 0;
    return evidence;
}

bool ReadTokenIdentity(HANDLE token,
                       CallerIdentityRecord *identity,
                       std::wstring *diagnostic) {
    std::vector<unsigned char> userBytes;
    if (!QueryTokenBytes(token, TokenUser, &userBytes)) {
        *diagnostic = L"TokenUser query failed: " + Win32Message(GetLastError());
        return false;
    }
    const auto *user = reinterpret_cast<const TOKEN_USER *>(userBytes.data());
    identity->processTokenUserSid = ToSidEvidence(user->User.Sid, SE_GROUP_ENABLED);

    std::vector<unsigned char> groupBytes;
    if (!QueryTokenBytes(token, TokenGroups, &groupBytes)) {
        *diagnostic = L"TokenGroups query failed: " + Win32Message(GetLastError());
        return false;
    }
    const auto *groups = reinterpret_cast<const TOKEN_GROUPS *>(groupBytes.data());
    for (DWORD index = 0; index < groups->GroupCount; ++index) {
        const auto &group = groups->Groups[index];
        SidEvidence sid = ToSidEvidence(group.Sid, group.Attributes);
        identity->processGroupSids.push_back(sid);
        if ((group.Attributes & SE_GROUP_LOGON_ID) != 0) {
            identity->logonSid = sid;
        }
    }

    std::vector<unsigned char> restrictedBytes;
    if (QueryTokenBytes(token, TokenRestrictedSids, &restrictedBytes)) {
        const auto *restricted =
            reinterpret_cast<const TOKEN_GROUPS *>(restrictedBytes.data());
        for (DWORD index = 0; index < restricted->GroupCount; ++index) {
            identity->processRestrictedSids.push_back(
                ToSidEvidence(restricted->Groups[index].Sid,
                              restricted->Groups[index].Attributes));
        }
    }

    std::vector<unsigned char> integrityBytes;
    if (!QueryTokenBytes(token, TokenIntegrityLevel, &integrityBytes)) {
        *diagnostic =
            L"TokenIntegrityLevel query failed: " + Win32Message(GetLastError());
        return false;
    }
    const auto *integrity =
        reinterpret_cast<const TOKEN_MANDATORY_LABEL *>(integrityBytes.data());
    identity->integrityLevelText = SidToString(integrity->Label.Sid);
    identity->integrityRid = SidRid(integrity->Label.Sid);

    DWORD returned = 0;
    if (!GetTokenInformation(token, TokenSessionId, &identity->windowsSessionId,
                             sizeof(identity->windowsSessionId), &returned)) {
        *diagnostic = L"TokenSessionId query failed: " + Win32Message(GetLastError());
        return false;
    }
    return true;
}

bool QueryAuthzBuffer(AUTHZ_CLIENT_CONTEXT_HANDLE context,
                      AUTHZ_CONTEXT_INFORMATION_CLASS informationClass,
                      std::vector<unsigned char> *bytes) {
    DWORD required = 0;
    AuthzGetInformationFromContext(context, informationClass, 0, &required,
                                   nullptr);
    if (required == 0) {
        return false;
    }
    bytes->assign(required, 0);
    return AuthzGetInformationFromContext(context, informationClass, required,
                                          &required, bytes->data()) != FALSE;
}

bool SidTextToEvidence(const std::wstring &text, SidEvidence *sid) {
    if (text.empty() || sid == nullptr) {
        return false;
    }
    PSID raw = nullptr;
    if (!ConvertStringSidToSidW(text.c_str(), &raw)) {
        return false;
    }
    *sid = ToSidEvidence(raw, SE_GROUP_ENABLED);
    LocalFree(raw);
    return true;
}

}  // namespace

Status WindowsRpcIdentityProvider::Inspect(handle_t binding,
                                           const CallerExpectation &expectation,
                                           CallerIdentityRecord *identity,
                                           std::wstring *diagnostic) {
    if (binding == nullptr || identity == nullptr) {
        return Fail(Status::InvalidCall, L"invalid identity input", diagnostic);
    }
    *identity = CallerIdentityRecord{};

    RPC_CALL_ATTRIBUTES_V2_W attributes{};
    attributes.Version = RPC_CALL_ATTRIBUTES_VERSION;
    attributes.Flags = RPC_QUERY_CLIENT_PID | RPC_QUERY_CLIENT_PRINCIPAL_NAME |
                       RPC_QUERY_IS_CLIENT_LOCAL;
    std::array<wchar_t, 512> principal{};
    attributes.ClientPrincipalName =
        reinterpret_cast<unsigned short *>(principal.data());
    attributes.ClientPrincipalNameBufferLength =
        static_cast<unsigned long>(principal.size());
    if (RpcServerInqCallAttributesW(binding, &attributes) != RPC_S_OK) {
        return Fail(Status::AuthenticationRequired,
                    L"RpcServerInqCallAttributesW failed", diagnostic);
    }
    if (attributes.NullSession || attributes.KernelModeCaller ||
        attributes.IsClientLocal != rcclLocal ||
        attributes.AuthenticationService != RPC_C_AUTHN_WINNT ||
        attributes.AuthenticationLevel < RPC_C_AUTHN_LEVEL_PKT_PRIVACY) {
        return Fail(Status::AuthenticationRequired,
                    L"RPC authentication/locality requirements failed",
                    diagnostic);
    }
    attributes.ClientPrincipalName[511] = L'\0';
    identity->authenticationService = attributes.AuthenticationService;
    identity->authenticationLevel = attributes.AuthenticationLevel;
    identity->rpcPrincipalName.assign(principal.data());
    identity->clientPid =
        static_cast<DWORD>(reinterpret_cast<ULONG_PTR>(attributes.ClientPID));
    if (identity->clientPid == 0) {
        return Fail(Status::IdentityMismatch, L"RPC ClientPID missing", diagnostic);
    }

    identity->processHandle->reset(OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, FALSE,
        identity->clientPid));
    if (!identity->processHandle || !*identity->processHandle) {
        return Fail(Status::IdentityMismatch,
                    L"OpenProcess failed: " + Win32Message(GetLastError()),
                    diagnostic);
    }
    FILETIME creation{};
    FILETIME exit{};
    FILETIME kernel{};
    FILETIME user{};
    if (!GetProcessTimes(identity->processHandle->get(), &creation, &exit,
                         &kernel, &user)) {
        return Fail(Status::IdentityMismatch,
                    L"GetProcessTimes failed: " + Win32Message(GetLastError()),
                    diagnostic);
    }
    ULARGE_INTEGER creationValue{};
    creationValue.LowPart = creation.dwLowDateTime;
    creationValue.HighPart = creation.dwHighDateTime;
    identity->processCreationTime = creationValue.QuadPart;
    if (WaitForSingleObject(identity->processHandle->get(), 0) != WAIT_TIMEOUT) {
        return Fail(Status::SessionNotFound, L"client process exited", diagnostic);
    }

    UniqueHandle processToken;
    HANDLE rawToken = nullptr;
    if (!OpenProcessToken(identity->processHandle->get(), TOKEN_QUERY,
                          &rawToken)) {
        return Fail(Status::IdentityMismatch,
                    L"OpenProcessToken failed: " + Win32Message(GetLastError()),
                    diagnostic);
    }
    processToken.reset(rawToken);
    if (!ReadTokenIdentity(processToken.get(), identity, diagnostic)) {
        return Status::IdentityMismatch;
    }

    PVOID authzContextRaw = nullptr;
    LUID identifier{};
    if (RpcGetAuthorizationContextForClient(
            binding, FALSE, nullptr, nullptr, identifier, 0, nullptr,
            &authzContextRaw) != RPC_S_OK ||
        authzContextRaw == nullptr) {
        return Fail(Status::AuthenticationRequired,
                    L"RpcGetAuthorizationContextForClient failed", diagnostic);
    }
    auto authzContext =
        reinterpret_cast<AUTHZ_CLIENT_CONTEXT_HANDLE>(authzContextRaw);
    auto freeContext = [&]() {
        PVOID value = authzContext;
        RpcFreeAuthorizationContext(&value);
        authzContextRaw = nullptr;
    };

    std::vector<unsigned char> authzUserBytes;
    if (!QueryAuthzBuffer(authzContext, AuthzContextInfoUserSid,
                          &authzUserBytes)) {
        freeContext();
        return Fail(Status::IdentityMismatch,
                    L"Authz user SID query failed", diagnostic);
    }
    const auto *authzUser =
        reinterpret_cast<const TOKEN_USER *>(authzUserBytes.data());
    identity->rpcAuthzUserSid =
        ToSidEvidence(authzUser->User.Sid, SE_GROUP_ENABLED);

    std::vector<unsigned char> authzGroupBytes;
    if (QueryAuthzBuffer(authzContext, AuthzContextInfoGroupsSids,
                         &authzGroupBytes)) {
        const auto *groups =
            reinterpret_cast<const TOKEN_GROUPS *>(authzGroupBytes.data());
        for (DWORD index = 0; index < groups->GroupCount; ++index) {
            identity->rpcAuthzGroupSids.push_back(
                ToSidEvidence(groups->Groups[index].Sid,
                              groups->Groups[index].Attributes));
        }
    }
    std::vector<unsigned char> authzRestrictedBytes;
    if (QueryAuthzBuffer(authzContext, AuthzContextInfoRestrictedSids,
                         &authzRestrictedBytes)) {
        const auto *groups =
            reinterpret_cast<const TOKEN_GROUPS *>(authzRestrictedBytes.data());
        for (DWORD index = 0; index < groups->GroupCount; ++index) {
            identity->rpcAuthzRestrictedSids.push_back(
                ToSidEvidence(groups->Groups[index].Sid,
                              groups->Groups[index].Attributes));
        }
    }
    freeContext();

    if (!EqualSidBytes(identity->rpcAuthzUserSid.bytes,
                       identity->processTokenUserSid.bytes)) {
        return Fail(Status::PrincipalMismatch,
                    L"Authz user SID differs from process TokenUser",
                    diagnostic);
    }

    SidEvidence expectedPrincipal;
    if (!SidTextToEvidence(expectation.expectedPrincipalSid,
                           &expectedPrincipal) ||
        !EqualSidBytes(expectedPrincipal.bytes,
                       identity->processTokenUserSid.bytes)) {
        return Fail(Status::PrincipalMismatch,
                    L"process TokenUser does not match expected principal SID",
                    diagnostic);
    }
    if (!SidSetContainsEnabled(identity->processGroupSids,
                               expectation.expectedNormalGroupSid)) {
        return Fail(Status::IdentityMismatch,
                    L"enabled normal group SID missing", diagnostic);
    }
    if (expectation.requireRestrictedToken) {
        SidEvidence expectedRestricted;
        if (!SidTextToEvidence(expectation.expectedRestrictingSid,
                               &expectedRestricted) ||
            !IsTokenRestricted(processToken.get()) ||
            !SidSetContainsBinary(identity->processRestrictedSids,
                                  expectedRestricted)) {
            return Fail(Status::IdentityMismatch,
                        L"restricted token/SID requirement failed", diagnostic);
        }
    }
    if (expectation.requiredIntegrityRid != 0 &&
        identity->integrityRid != expectation.requiredIntegrityRid) {
        return Fail(Status::IdentityMismatch,
                    L"token integrity level mismatch", diagnostic);
    }
    if (!expectation.allowedWindowsSessionIds.empty() &&
        std::find(expectation.allowedWindowsSessionIds.begin(),
                  expectation.allowedWindowsSessionIds.end(),
                  identity->windowsSessionId) ==
            expectation.allowedWindowsSessionIds.end()) {
        return Fail(Status::IdentityMismatch,
                    L"Windows session ID is not allowed", diagnostic);
    }
    if (WaitForSingleObject(identity->processHandle->get(), 0) != WAIT_TIMEOUT) {
        return Fail(Status::SessionNotFound,
                    L"client process exited during identity validation",
                    diagnostic);
    }
    if (diagnostic != nullptr) {
        *diagnostic = L"caller identity fully bound";
    }
    return Status::Ok;
}

ImpersonationGuard::ImpersonationGuard(handle_t binding) {
    entered_ = RpcImpersonateClient(binding) == RPC_S_OK;
}

Status ImpersonationGuard::Leave(std::wstring *diagnostic) {
    if (!entered_ || finished_) {
        return Status::Ok;
    }
    if (RpcRevertToSelf() != RPC_S_OK) {
        if (diagnostic != nullptr) {
            *diagnostic = L"RpcRevertToSelf failed; thread must be quarantined";
        }
        return Status::AuthenticationRequired;
    }
    finished_ = true;
    return Status::Ok;
}

ImpersonationGuard::~ImpersonationGuard() {
    if (entered_ && !finished_) {
        if (RpcRevertToSelf() != RPC_S_OK) {
            // An impersonated dispatch thread is outside the recoverable
            // security boundary. Fail-stop prevents thread reuse.
            TerminateProcess(GetCurrentProcess(), ERROR_ASSERTION_FAILURE);
        }
        finished_ = true;
    }
}

}  // namespace p13::harness

