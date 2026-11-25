#pragma once

#include "authority/p13_operation_policy.h"

#include <map>
#include <mutex>
#include <unordered_map>

namespace p13::harness {

struct AuthorityDescriptor {
    GUID authorityId{};
    PrincipalClass principalClass{PrincipalClass::None};
    AuthorityType controlAuthorityType{AuthorityType::AuthorityControl};
    AuthorityType launchAuthorityType{AuthorityType::AuthorityControl};
    const wchar_t *canonicalControlEndpoint{};
    const wchar_t *canonicalLaunchEndpoint{};
    std::string helperType;
    const wchar_t *expectedPrincipalSid{};
    const wchar_t *normalGroupSid{};
    const wchar_t *restrictingSid{};
    const wchar_t *credentialReference{};
    const wchar_t *launchTicketPermission{};
    DWORD requiredIntegrityRid{0};
    std::vector<DWORD> allowedWindowsSessionIds;
};

const AuthorityDescriptor *DescriptorForId(const GUID &authorityId);
const AuthorityDescriptor *LaunchDescriptorForEndpoint(
    std::wstring_view endpoint);
const AuthorityDescriptor &SupervisorDescriptor();

class TestEffectSink {
public:
    void Record(EffectRecord record);
    std::vector<EffectRecord> Snapshot() const;
    void Clear();

private:
    mutable std::mutex mutex_;
    std::vector<EffectRecord> records_;
};

class TestSecurityEventSink {
public:
    void Record(SecurityEventRecord record);
    std::vector<SecurityEventRecord> Snapshot() const;
    void Clear();

private:
    mutable std::mutex mutex_;
    std::vector<SecurityEventRecord> records_;
};

class TestSessionStore {
public:
    struct RegisterResult {
        Status status{Status::InternalError};
        SessionRecord session;
        std::wstring diagnostic;
    };

    struct RequestResult {
        Status status{Status::InternalError};
        SessionRecord session;
        std::wstring diagnostic;
    };

    RegisterResult Register(const AuthorityDescriptor &descriptor,
                            CallerIdentityRecord identity,
                            std::uint64_t epoch,
                            std::chrono::system_clock::time_point expiresAt);
    std::optional<SessionRecord> Find(const GUID &sessionId) const;
    RequestResult AcceptRequest(const GUID &sessionId,
                                const GUID &authorityId,
                                std::uint64_t epoch,
                                std::uint64_t clientSequence,
                                const GUID &requestId,
                                const std::array<unsigned char, 32> &digest,
                                const CallerIdentityRecord &identity,
                                std::chrono::system_clock::time_point now);
    Status Transition(const GUID &sessionId,
                      SessionState expected,
                      SessionState target);
    Status RequestRevoke(const GUID &sessionId);
    Status CloseWebWorkerSession(const GUID &sessionId);
    Status BindLaunchSession(const GUID &sessionId,
                             const GUID &launchSessionId);
    Status Expire(const GUID &sessionId);

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::wstring, SessionRecord> sessions_;
    struct JournalEntry {
        std::array<unsigned char, 32> digest{};
    };
    std::map<std::pair<std::wstring, std::wstring>, JournalEntry> journal_;
};

class TestGrantStore {
public:
    Status Issue(const GrantRecord &grant);
    std::optional<GrantRecord> Find(const GUID &grantId) const;
    Status Match(const GrantRecord &expected,
                 const SessionRecord &session,
                 std::uint64_t generation,
                 P13Action action,
                 std::chrono::system_clock::time_point now,
                 GrantRecord *grantOut) const;
    Status Reserve(const GUID &grantId,
                   const SessionRecord &session);
    Status MarkEffect(const GUID &grantId);
    Status Consume(const GUID &grantId);
    Status Revoke(const GUID &grantId);
    Status Expire(const GUID &grantId);

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::wstring, GrantRecord> grants_;
    std::unordered_map<std::wstring, std::wstring> activeByOperation_;
};

class TestOperationStore {
public:
    Status Create(const OperationRecord &operation);
    std::optional<OperationRecord> Find(const GUID &operationId) const;
    Status RequireOwner(const GUID &operationId,
                        const SessionRecord &session) const;
    Status MarkGrantIssued(const GUID &operationId,
                           const SessionRecord &session);
    Status CancelBeforeGrant(const GUID &operationId,
                             const SessionRecord &session);

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::wstring, OperationRecord> operations_;
};

}  // namespace p13::harness

