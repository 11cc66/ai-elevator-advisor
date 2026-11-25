#include "authority/p13_authority_components.h"

#include <algorithm>
#include <array>
#include <cwchar>
#include <utility>

namespace p13::harness {
namespace {

GUID NewGuid() {
    GUID value{};
    if (UuidCreate(&value) != RPC_S_OK) {
        value = {};
    }
    return value;
}

bool SameSidSet(std::vector<SidEvidence> left,
                std::vector<SidEvidence> right) {
    auto key = [](const SidEvidence &sid) { return sid.text; };
    std::sort(left.begin(), left.end(),
              [&](const SidEvidence &a, const SidEvidence &b) {
                  return key(a) < key(b);
              });
    std::sort(right.begin(), right.end(),
              [&](const SidEvidence &a, const SidEvidence &b) {
                  return key(a) < key(b);
              });
    if (left.size() != right.size()) {
        return false;
    }
    for (std::size_t index = 0; index < left.size(); ++index) {
        if (!EqualSidBytes(left[index].bytes, right[index].bytes) ||
            left[index].attributes != right[index].attributes ||
            left[index].enabled != right[index].enabled ||
            left[index].denyOnly != right[index].denyOnly) {
            return false;
        }
    }
    return true;
}

bool SameIdentity(const CallerIdentityRecord &left,
                  const CallerIdentityRecord &right) {
    return left.clientPid == right.clientPid &&
           left.processCreationTime == right.processCreationTime &&
           _wcsicmp(left.rpcPrincipalName.c_str(),
                    right.rpcPrincipalName.c_str()) == 0 &&
           EqualSidBytes(left.rpcAuthzUserSid.bytes,
                         right.rpcAuthzUserSid.bytes) &&
           EqualSidBytes(left.processTokenUserSid.bytes,
                         right.processTokenUserSid.bytes) &&
           SameSidSet(left.processGroupSids, right.processGroupSids) &&
           SameSidSet(left.processRestrictedSids,
                      right.processRestrictedSids) &&
           left.integrityRid == right.integrityRid &&
           left.windowsSessionId == right.windowsSessionId;
}

bool IsAllowedSessionTransition(SessionState from, SessionState to) {
    switch (from) {
        case SessionState::Opening:
            return to == SessionState::Active || to == SessionState::Denied;
        case SessionState::Active:
            return to == SessionState::RevokeRequested ||
                   to == SessionState::Expired || to == SessionState::Unknown;
        case SessionState::RevokeRequested:
            return to == SessionState::RpcClosed || to == SessionState::Unknown;
        case SessionState::RpcClosed:
            return to == SessionState::ProcessSignaled ||
                   to == SessionState::Reconciled || to == SessionState::Unknown;
        case SessionState::ProcessSignaled:
            return to == SessionState::Reconciled || to == SessionState::Unknown;
        case SessionState::Expired:
            return to == SessionState::RevokeRequested || to == SessionState::Unknown;
        case SessionState::Reconciling:
            return to == SessionState::Reconciled || to == SessionState::Unknown;
        case SessionState::Reconciled:
            return to == SessionState::Closed;
        case SessionState::Unknown:
            return to == SessionState::Quarantined ||
                   to == SessionState::Reconciling;
        case SessionState::Closed:
        case SessionState::Denied:
        case SessionState::Quarantined:
            return false;
    }
    return false;
}

std::wstring OperationKey(const GUID &operationId, std::uint64_t generation) {
    return GuidToString(operationId) + L":" + std::to_wstring(generation);
}

}  // namespace

namespace {

constexpr wchar_t kWebSid[] = L"S-1-5-21-900000001-900000002-900000003-1001";
constexpr wchar_t kWorkerSid[] = L"S-1-5-21-900000001-900000002-900000003-1002";
constexpr wchar_t kSupervisorSid[] = L"S-1-5-21-900000001-900000002-900000003-5001";
constexpr wchar_t kSupervisorGroup[] =
    L"S-1-5-21-900000001-900000002-900000003-5101";
constexpr wchar_t kStagingUser[] =
    L"S-1-5-21-900000001-900000002-900000003-2001";
constexpr wchar_t kStagingGroup[] =
    L"S-1-5-21-900000001-900000002-900000003-3001";
constexpr wchar_t kStagingRestricted[] =
    L"S-1-5-21-900000001-900000002-900000003-4001";
constexpr wchar_t kPublisherUser[] =
    L"S-1-5-21-900000001-900000002-900000003-2002";
constexpr wchar_t kPublisherGroup[] =
    L"S-1-5-21-900000001-900000002-900000003-3002";
constexpr wchar_t kPublisherRestricted[] =
    L"S-1-5-21-900000001-900000002-900000003-4002";
constexpr wchar_t kSealerUser[] =
    L"S-1-5-21-900000001-900000002-900000003-2003";
constexpr wchar_t kSealerGroup[] =
    L"S-1-5-21-900000001-900000002-900000003-3003";
constexpr wchar_t kSealerRestricted[] =
    L"S-1-5-21-900000001-900000002-900000003-4003";
constexpr wchar_t kCleanupUser[] =
    L"S-1-5-21-900000001-900000002-900000003-2004";
constexpr wchar_t kCleanupGroup[] =
    L"S-1-5-21-900000001-900000002-900000003-3004";
constexpr wchar_t kCleanupRestricted[] =
    L"S-1-5-21-900000001-900000002-900000003-4004";

const std::array<AuthorityDescriptor, 6> kDescriptors = {{
    {kTestWebAuthorityId, PrincipalClass::WebService,
     AuthorityType::AuthorityControl, AuthorityType::LaunchStaging,
     kAuthorityEndpoint, nullptr, "", kWebSid, kWebSid, L"",
     L"TEST-CRED-WEB-NOT-REAL", L"", 8192, {0, 1, 2}},
    {kTestWorkerAuthorityId, PrincipalClass::WorkerService,
     AuthorityType::AuthorityControl, AuthorityType::LaunchStaging,
     kAuthorityEndpoint, nullptr, "", kWorkerSid, kWorkerSid, L"",
     L"TEST-CRED-WORKER-NOT-REAL", L"", 8192, {0, 1, 2}},
    {kStagingAuthorityId, PrincipalClass::StagingWriterHelper,
     AuthorityType::AuthorityControl, AuthorityType::LaunchStaging,
     kAuthorityEndpoint, kLaunchStagingEndpoint, "STAGING_WRITER",
     kStagingUser, kStagingGroup, kStagingRestricted,
     L"TEST-CRED-STAGING-NOT-REAL",
     L"TEST-TICKET-STAGING", 8192, {0, 1, 2}},
    {kPublisherAuthorityId, PrincipalClass::PublisherHelper,
     AuthorityType::AuthorityControl, AuthorityType::LaunchPublisher,
     kAuthorityEndpoint, kLaunchPublisherEndpoint, "PUBLISHER",
     kPublisherUser, kPublisherGroup, kPublisherRestricted,
     L"TEST-CRED-PUBLISHER-NOT-REAL",
     L"TEST-TICKET-PUBLISHER", 8192, {0, 1, 2}},
    {kSealerAuthorityId, PrincipalClass::SealerHelper,
     AuthorityType::AuthorityControl, AuthorityType::LaunchSealer,
     kAuthorityEndpoint, kLaunchSealerEndpoint, "SEALER", kSealerUser,
     kSealerGroup, kSealerRestricted, L"TEST-CRED-SEALER-NOT-REAL",
     L"TEST-TICKET-SEALER",
     8192, {0, 1, 2}},
    {kCleanupAuthorityId, PrincipalClass::CleanupHelper,
     AuthorityType::AuthorityControl, AuthorityType::LaunchCleanup,
     kAuthorityEndpoint, kLaunchCleanupEndpoint, "CLEANUP", kCleanupUser,
     kCleanupGroup, kCleanupRestricted, L"TEST-CRED-CLEANUP-NOT-REAL",
     L"TEST-TICKET-CLEANUP", 8192, {0, 1, 2}},
}};

const AuthorityDescriptor kSupervisorDescriptor = {
    {0x1b039aae, 0x7eb0, 0x4cfb,
     {0x9d, 0x9d, 0x9b, 0x1d, 0x6a, 0x82, 0x3f, 0x20}},
    PrincipalClass::AuthoritySupervisor,
    AuthorityType::AuthorityControl,
    AuthorityType::LaunchStaging | AuthorityType::LaunchPublisher |
        AuthorityType::LaunchSealer | AuthorityType::LaunchCleanup,
    kAuthorityEndpoint,
    nullptr,
    "",
    kSupervisorSid,
    kSupervisorGroup,
    L"",
    L"TEST-CRED-SUPERVISOR-NOT-REAL",
    L"",
    8192,
    {0, 1, 2},
};

}  // namespace

const AuthorityDescriptor *DescriptorForId(const GUID &authorityId) {
    for (const auto &descriptor : kDescriptors) {
        if (EqualGuid(descriptor.authorityId, authorityId)) {
            return &descriptor;
        }
    }
    return nullptr;
}

const AuthorityDescriptor *LaunchDescriptorForEndpoint(
    std::wstring_view endpoint) {
    for (const auto &descriptor : kDescriptors) {
        if (descriptor.canonicalLaunchEndpoint != nullptr &&
            endpoint == descriptor.canonicalLaunchEndpoint) {
            return &descriptor;
        }
    }
    return nullptr;
}

const AuthorityDescriptor &SupervisorDescriptor() {
    return kSupervisorDescriptor;
}

void TestEffectSink::Record(EffectRecord record) {
    std::scoped_lock lock(mutex_);
    records_.push_back(std::move(record));
}

std::vector<EffectRecord> TestEffectSink::Snapshot() const {
    std::scoped_lock lock(mutex_);
    return records_;
}

void TestEffectSink::Clear() {
    std::scoped_lock lock(mutex_);
    records_.clear();
}

void TestSecurityEventSink::Record(SecurityEventRecord record) {
    std::scoped_lock lock(mutex_);
    records_.push_back(std::move(record));
}

std::vector<SecurityEventRecord> TestSecurityEventSink::Snapshot() const {
    std::scoped_lock lock(mutex_);
    return records_;
}

void TestSecurityEventSink::Clear() {
    std::scoped_lock lock(mutex_);
    records_.clear();
}

TestSessionStore::RegisterResult TestSessionStore::Register(
    const AuthorityDescriptor &descriptor,
    CallerIdentityRecord identity,
    std::uint64_t epoch,
    std::chrono::system_clock::time_point expiresAt) {
    std::scoped_lock lock(mutex_);
    for (const auto &[key, existing] : sessions_) {
        (void)key;
        if (existing.authorityId == descriptor.authorityId &&
            SameIdentity(existing.identity, identity)) {
            return {Status::Conflict, existing,
                    L"caller already has a session"};
        }
    }
    SessionRecord session;
    session.sessionId = NewGuid();
    session.authorityId = descriptor.authorityId;
    session.authorityType = descriptor.controlAuthorityType;
    session.principalClass = descriptor.principalClass;
    session.identity = std::move(identity);
    session.epoch = epoch;
    session.expiresAt = expiresAt;
    session.state = SessionState::Active;
    session.revision = 1;
    if (IsZeroGuid(session.sessionId)) {
        return {Status::InternalError, {}, L"session GUID generation failed"};
    }
    sessions_.emplace(GuidToString(session.sessionId), session);
    return {Status::Ok, session, L"session registered"};
}

std::optional<SessionRecord> TestSessionStore::Find(
    const GUID &sessionId) const {
    std::scoped_lock lock(mutex_);
    const auto found = sessions_.find(GuidToString(sessionId));
    if (found == sessions_.end()) {
        return std::nullopt;
    }
    return found->second;
}

TestSessionStore::RequestResult TestSessionStore::AcceptRequest(
    const GUID &sessionId,
    const GUID &authorityId,
    std::uint64_t epoch,
    std::uint64_t clientSequence,
    const GUID &requestId,
    const std::array<unsigned char, 32> &digest,
    const CallerIdentityRecord &identity,
    std::chrono::system_clock::time_point now) {
    std::scoped_lock lock(mutex_);
    const auto found = sessions_.find(GuidToString(sessionId));
    if (found == sessions_.end()) {
        return {Status::SessionNotFound, {}, L"session not found"};
    }
    SessionRecord &session = found->second;
    if (session.state != SessionState::Active) {
        return {session.state == SessionState::Expired ? Status::SessionExpired
                                                      : Status::SessionClosed,
                session, L"session is not active"};
    }
    if (session.expiresAt <= now) {
        session.state = SessionState::Expired;
        ++session.revision;
        return {Status::SessionExpired, session, L"session expired"};
    }
    if (!EqualGuid(session.authorityId, authorityId)) {
        return {Status::AuthorityMismatch, session,
                L"session authority mismatch"};
    }
    if (session.epoch != epoch) {
        return {Status::EpochMismatch, session, L"session epoch mismatch"};
    }
    if (!SameIdentity(session.identity, identity)) {
        return {Status::IdentityMismatch, session,
                L"caller process identity differs from session"};
    }
    const auto key =
        std::make_pair(GuidToString(sessionId), GuidToString(requestId));
    if (const auto previous = journal_.find(key); previous != journal_.end()) {
        return {previous->second.digest == digest ? Status::Replay
                                                   : Status::Conflict,
                session,
                previous->second.digest == digest ? L"request replay"
                                                   : L"request conflict"};
    }
    if (clientSequence <= session.lastAcceptedSequence) {
        return {Status::SequenceStale, session, L"client sequence is stale"};
    }
    session.lastAcceptedSequence = clientSequence;
    ++session.revision;
    journal_.emplace(key, JournalEntry{digest});
    return {Status::Ok, session, L"request accepted"};
}

Status TestSessionStore::Transition(const GUID &sessionId,
                                    SessionState expected,
                                    SessionState target) {
    std::scoped_lock lock(mutex_);
    const auto found = sessions_.find(GuidToString(sessionId));
    if (found == sessions_.end()) {
        return Status::SessionNotFound;
    }
    SessionRecord &session = found->second;
    if (session.state != expected) {
        return Status::InvalidTransition;
    }
    if (!IsAllowedSessionTransition(expected, target)) {
        return Status::InvalidTransition;
    }
    session.state = target;
    ++session.revision;
    if (target == SessionState::Closed || target == SessionState::Quarantined) {
        session.identity.processHandle->reset();
    }
    return Status::Ok;
}

Status TestSessionStore::RequestRevoke(const GUID &sessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = sessions_.find(GuidToString(sessionId));
    if (found == sessions_.end()) {
        return Status::SessionNotFound;
    }
    SessionRecord &session = found->second;
    if (session.state == SessionState::RevokeRequested) {
        return Status::Ok;
    }
    if (session.state != SessionState::Active &&
        session.state != SessionState::Expired) {
        return Status::InvalidTransition;
    }
    session.state = SessionState::RevokeRequested;
    ++session.revision;
    return Status::Ok;
}

Status TestSessionStore::CloseWebWorkerSession(const GUID &sessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = sessions_.find(GuidToString(sessionId));
    if (found == sessions_.end()) {
        return Status::SessionNotFound;
    }
    SessionRecord &session = found->second;
    if (session.principalClass != PrincipalClass::WebService &&
        session.principalClass != PrincipalClass::WorkerService) {
        return Status::InvalidTransition;
    }
    if (session.state != SessionState::Active) {
        return Status::InvalidTransition;
    }
    session.state = SessionState::RpcClosed;
    ++session.revision;
    session.state = SessionState::Reconciled;
    ++session.revision;
    session.state = SessionState::Closed;
    ++session.revision;
    session.identity.processHandle->reset();
    return Status::Ok;
}

Status TestSessionStore::BindLaunchSession(
    const GUID &sessionId,
    const GUID &launchSessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = sessions_.find(GuidToString(sessionId));
    if (found == sessions_.end() || found->second.state != SessionState::Active ||
        !IsZeroGuid(found->second.launchSessionId)) {
        return Status::InvalidTransition;
    }
    found->second.launchSessionId = launchSessionId;
    ++found->second.revision;
    return Status::Ok;
}

Status TestSessionStore::Expire(const GUID &sessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = sessions_.find(GuidToString(sessionId));
    if (found == sessions_.end()) {
        return Status::SessionNotFound;
    }
    if (found->second.state != SessionState::Active) {
        return Status::InvalidTransition;
    }
    found->second.state = SessionState::Expired;
    ++found->second.revision;
    return Status::Ok;
}

Status TestGrantStore::Issue(const GrantRecord &grant) {
    if (IsZeroGuid(grant.grantId) || IsZeroGuid(grant.operationId) ||
        grant.expiresAt <= NowUtc()) {
        return Status::GrantRejected;
    }
    std::scoped_lock lock(mutex_);
    const std::wstring activeKey =
        OperationKey(grant.operationId, grant.generation);
    if (activeByOperation_.contains(activeKey)) {
        return Status::Conflict;
    }
    grants_[GuidToString(grant.grantId)] = grant;
    activeByOperation_[activeKey] = GuidToString(grant.grantId);
    return Status::Ok;
}

std::optional<GrantRecord> TestGrantStore::Find(const GUID &grantId) const {
    std::scoped_lock lock(mutex_);
    const auto found = grants_.find(GuidToString(grantId));
    return found == grants_.end() ? std::nullopt
                                  : std::optional<GrantRecord>(found->second);
}

Status TestGrantStore::Match(
    const GrantRecord &expected,
    const SessionRecord &session,
    std::uint64_t generation,
    P13Action action,
    std::chrono::system_clock::time_point now,
    GrantRecord *grantOut) const {
    std::scoped_lock lock(mutex_);
    const auto found = grants_.find(GuidToString(expected.grantId));
    if (found == grants_.end()) {
        return Status::GrantRejected;
    }
    const GrantRecord &grant = found->second;
    if (!EqualGuid(grant.operationId, expected.operationId) ||
        !EqualGuid(grant.audienceAuthorityId, expected.audienceAuthorityId) ||
        grant.audiencePrincipal != expected.audiencePrincipal ||
        !EqualGuid(grant.sessionId, session.sessionId) ||
        grant.helperType != expected.helperType || grant.action != action ||
        grant.generation != generation ||
        grant.releaseDigest != expected.releaseDigest ||
        grant.storageKey != expected.storageKey) {
        return Status::GrantRejected;
    }
    if (grant.expiresAt <= now) {
        return Status::GrantExpired;
    }
    if (grant.state == GrantState::Consumed) {
        return Status::GrantConsumed;
    }
    if (grant.state == GrantState::Revoked ||
        grant.state == GrantState::Expired ||
        grant.state == GrantState::Unknown) {
        return Status::GrantRejected;
    }
    if (grantOut != nullptr) {
        *grantOut = grant;
    }
    return Status::Ok;
}

Status TestGrantStore::Reserve(
    const GUID &grantId,
    const SessionRecord &session) {
    std::scoped_lock lock(mutex_);
    const auto found = grants_.find(GuidToString(grantId));
    if (found == grants_.end() || found->second.state != GrantState::Issued ||
        !EqualGuid(found->second.sessionId, session.sessionId)) {
        return Status::GrantRejected;
    }
    found->second.state = GrantState::Reserved;
    return Status::Ok;
}

Status TestGrantStore::MarkEffect(const GUID &grantId) {
    std::scoped_lock lock(mutex_);
    const auto found = grants_.find(GuidToString(grantId));
    if (found == grants_.end() || found->second.state != GrantState::Reserved ||
        found->second.effectReported) {
        return Status::Conflict;
    }
    found->second.state = GrantState::EffectReported;
    found->second.effectReported = true;
    return Status::Ok;
}

Status TestGrantStore::Consume(const GUID &grantId) {
    std::scoped_lock lock(mutex_);
    const auto found = grants_.find(GuidToString(grantId));
    if (found == grants_.end() ||
        (found->second.state != GrantState::Reserved &&
         found->second.state != GrantState::EffectReported)) {
        return Status::GrantRejected;
    }
    found->second.state = GrantState::Consumed;
    return Status::Ok;
}

Status TestGrantStore::Revoke(const GUID &grantId) {
    std::scoped_lock lock(mutex_);
    const auto found = grants_.find(GuidToString(grantId));
    if (found == grants_.end()) {
        return Status::GrantRejected;
    }
    if (found->second.state == GrantState::Consumed) {
        return Status::GrantConsumed;
    }
    found->second.state = GrantState::Revoked;
    return Status::Ok;
}

Status TestGrantStore::Expire(const GUID &grantId) {
    std::scoped_lock lock(mutex_);
    const auto found = grants_.find(GuidToString(grantId));
    if (found == grants_.end()) {
        return Status::GrantRejected;
    }
    if (found->second.state == GrantState::Consumed) {
        return Status::GrantConsumed;
    }
    found->second.state = GrantState::Expired;
    return Status::Ok;
}

Status TestOperationStore::Create(const OperationRecord &operation) {
    if (IsZeroGuid(operation.operationId) ||
        IsZeroGuid(operation.ownerSessionId)) {
        return Status::InvalidCall;
    }
    std::scoped_lock lock(mutex_);
    const auto found = operations_.find(GuidToString(operation.operationId));
    if (found != operations_.end()) {
        return found->second.ownerSessionId == operation.ownerSessionId
                   ? Status::Replay
                   : Status::Conflict;
    }
    operations_[GuidToString(operation.operationId)] = operation;
    return Status::Ok;
}

std::optional<OperationRecord> TestOperationStore::Find(
    const GUID &operationId) const {
    std::scoped_lock lock(mutex_);
    const auto found = operations_.find(GuidToString(operationId));
    return found == operations_.end()
               ? std::nullopt
               : std::optional<OperationRecord>(found->second);
}

Status TestOperationStore::RequireOwner(
    const GUID &operationId,
    const SessionRecord &session) const {
    std::scoped_lock lock(mutex_);
    const auto found = operations_.find(GuidToString(operationId));
    if (found == operations_.end()) {
        return Status::SessionNotFound;
    }
    if (found->second.ownerSessionId != session.sessionId ||
        found->second.ownerPrincipal != session.principalClass) {
        return Status::AuthorityMismatch;
    }
    return Status::Ok;
}

Status TestOperationStore::MarkGrantIssued(
    const GUID &operationId,
    const SessionRecord &session) {
    std::scoped_lock lock(mutex_);
    const auto found = operations_.find(GuidToString(operationId));
    if (found == operations_.end()) {
        return Status::SessionNotFound;
    }
    if (!EqualGuid(found->second.ownerSessionId, session.sessionId) ||
        found->second.ownerPrincipal != session.principalClass) {
        return Status::AuthorityMismatch;
    }
    if (found->second.state != "CREATED") {
        return Status::Conflict;
    }
    found->second.state = "GRANT_ISSUED";
    found->second.cancelBeforeGrantAllowed = false;
    return Status::Ok;
}

Status TestOperationStore::CancelBeforeGrant(
    const GUID &operationId,
    const SessionRecord &session) {
    std::scoped_lock lock(mutex_);
    const auto found = operations_.find(GuidToString(operationId));
    if (found == operations_.end()) {
        return Status::SessionNotFound;
    }
    if (found->second.ownerSessionId != session.sessionId ||
        found->second.ownerPrincipal != session.principalClass) {
        return Status::AuthorityMismatch;
    }
    if (!found->second.cancelBeforeGrantAllowed ||
        found->second.state != "CREATED") {
        return Status::Conflict;
    }
    found->second.state = "CANCELLED_BEFORE_GRANT";
    found->second.cancelBeforeGrantAllowed = false;
    return Status::Ok;
}

}  // namespace p13::harness

