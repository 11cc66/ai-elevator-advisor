#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <windows.h>
#include <rpc.h>
#include <rpcasync.h>
#include <authz.h>
#include <sddl.h>
#include <aclapi.h>
#include <bcrypt.h>

#include <array>
#include <chrono>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "p13_authority.h"

namespace p13::harness {

inline constexpr wchar_t kAuthorityEndpoint[] = L"p13-authority-v1";
inline constexpr wchar_t kLaunchStagingEndpoint[] = L"p13-launch-staging-v1";
inline constexpr wchar_t kLaunchPublisherEndpoint[] = L"p13-launch-publisher-v1";
inline constexpr wchar_t kLaunchSealerEndpoint[] = L"p13-launch-sealer-v1";
inline constexpr wchar_t kLaunchCleanupEndpoint[] = L"p13-launch-cleanup-v1";

inline constexpr GUID kAuthorityInterfaceUuid =
    {0x4f8ed476, 0xec87, 0x4257, {0xa9, 0xda, 0x58, 0x9e, 0x31, 0xfa, 0x4b, 0xc8}};
inline constexpr GUID kLaunchInterfaceUuid =
    {0xb2d9e41c, 0x34d5, 0x4046, {0x96, 0xb6, 0x9e, 0x14, 0xaa, 0x9d, 0x53, 0x3e}};

inline constexpr GUID kStagingAuthorityId =
    {0x17b2af95, 0x7e25, 0x42f3, {0x92, 0xa4, 0x5c, 0x40, 0x52, 0x27, 0xd1, 0x01}};
inline constexpr GUID kPublisherAuthorityId =
    {0xcb1f9310, 0xe86b, 0x4fbd, {0xa5, 0x4c, 0x83, 0x62, 0x1d, 0x54, 0xd3, 0xa8}};
inline constexpr GUID kSealerAuthorityId =
    {0x68182d2b, 0xcd41, 0x44f2, {0x8f, 0x6a, 0xce, 0x22, 0x4f, 0xe3, 0x0c, 0x63}};
inline constexpr GUID kCleanupAuthorityId =
    {0xa71bd21a, 0x4c0e, 0x4fe6, {0x97, 0x6d, 0x64, 0x67, 0xac, 0x31, 0x2f, 0xf2}};
inline constexpr GUID kTestWebAuthorityId =
    {0x522b7cc4, 0x8b5c, 0x4b0e, {0xb1, 0x4e, 0x8f, 0x84, 0x09, 0x4b, 0x07, 0xa1}};
inline constexpr GUID kTestWorkerAuthorityId =
    {0xf04b56d1, 0x11b8, 0x4867, {0x87, 0x10, 0xc1, 0x33, 0x2e, 0x0a, 0x8f, 0x75}};

inline constexpr std::uint32_t kMaxConcurrentRpcCalls = 32;
inline constexpr std::uint32_t kRequestDigestBytes = 32;
inline constexpr std::uint32_t kReleaseDigestBytes = 32;

enum class Status : std::uint32_t {
    Ok = 0,
    InvalidCall = 10,
    AuthenticationRequired = 20,
    IdentityMismatch = 21,
    PrincipalMismatch = 22,
    SessionRequired = 30,
    SessionNotFound = 31,
    SessionClosed = 32,
    SessionRevoked = 33,
    SessionExpired = 34,
    SequenceStale = 35,
    EpochMismatch = 40,
    AuthorityMismatch = 41,
    OperationNotAllowed = 50,
    GrantRequired = 60,
    GrantRejected = 61,
    GrantExpired = 62,
    GrantConsumed = 63,
    TicketRequired = 70,
    TicketRejected = 71,
    TicketExpired = 72,
    TicketConsumed = 73,
    Replay = 80,
    Conflict = 81,
    InvalidTransition = 82,
    EvidenceUnknown = 90,
    EvidenceMismatch = 91,
    CryptoFailed = 100,
    InternalError = 110,
    NotImplemented = 111,
};

enum class PrincipalClass : std::uint32_t {
    None = 0,
    WebService = 1,
    WorkerService = 2,
    AuthoritySupervisor = 4,
    StagingWriterHelper = 8,
    PublisherHelper = 16,
    SealerHelper = 32,
    CleanupHelper = 64,
};

inline constexpr PrincipalClass operator|(PrincipalClass left,
                                          PrincipalClass right) {
    return static_cast<PrincipalClass>(
        static_cast<std::uint32_t>(left) |
        static_cast<std::uint32_t>(right));
}

inline PrincipalClass &operator|=(PrincipalClass &left, PrincipalClass right) {
    left = left | right;
    return left;
}

bool HasPrincipal(PrincipalClass set, PrincipalClass value) noexcept;

enum class AuthorityType : std::uint32_t {
    AuthorityControl = 1,
    LaunchStaging = 2,
    LaunchPublisher = 4,
    LaunchSealer = 8,
    LaunchCleanup = 16,
};

inline constexpr AuthorityType operator|(AuthorityType left,
                                         AuthorityType right) {
    return static_cast<AuthorityType>(
        static_cast<std::uint32_t>(left) |
        static_cast<std::uint32_t>(right));
}

inline AuthorityType &operator|=(AuthorityType &left, AuthorityType right) {
    left = left | right;
    return left;
}

bool HasAuthorityType(AuthorityType set, AuthorityType value) noexcept;

enum class BindingMode : std::uint32_t {
    NoGrant = 0,
    OperationOwner,
    LaunchTicket,
    MatchGrant,
};

enum class SessionState : std::uint32_t {
    Opening,
    Active,
    RevokeRequested,
    RpcClosed,
    ProcessSignaled,
    Reconciling,
    Reconciled,
    Expired,
    Closed,
    Denied,
    Unknown,
    Quarantined,
};

enum class LaunchState : std::uint32_t {
    New,
    TicketAccepted,
    PreparedSuspended,
    HandlesTransferred,
    Committed,
    Running,
    RevokeRequested,
    JobCloseRequested,
    ProcessSignaled,
    HandlesClosed,
    EvidenceReconciling,
    Closed,
    Aborted,
    Unknown,
    Quarantined,
};

enum class ProcessState : std::uint32_t {
    NotStarted,
    SuspendedInJob,
    HandleTransferred,
    Running,
    Terminating,
    Signaled,
    Exited,
    Unknown,
};

enum class JobState : std::uint32_t {
    Absent,
    Created,
    Preassigned,
    LaunchAuthorityOwned,
    SupervisorOwned,
    CloseRequested,
    Closed,
    Unknown,
};

enum class GrantState : std::uint32_t {
    Issued,
    Reserved,
    EffectReported,
    Consumed,
    Revoked,
    Expired,
    Unknown,
};

enum class EvidenceState : std::uint32_t {
    Missing,
    HelperReported,
    SupervisorVerified,
    Matched,
    Mismatch,
    Unknown,
};

struct UniqueHandle {
    HANDLE value{nullptr};

    UniqueHandle() = default;
    explicit UniqueHandle(HANDLE handle) noexcept : value(handle) {}
    UniqueHandle(const UniqueHandle &) = delete;
    UniqueHandle &operator=(const UniqueHandle &) = delete;
    UniqueHandle(UniqueHandle &&other) noexcept : value(other.release()) {}
    UniqueHandle &operator=(UniqueHandle &&other) noexcept {
        if (this != &other) {
            reset(other.release());
        }
        return *this;
    }
    ~UniqueHandle() { reset(); }

    HANDLE get() const noexcept { return value; }
    HANDLE release() noexcept {
        HANDLE current = value;
        value = nullptr;
        return current;
    }
    void reset(HANDLE handle = nullptr) noexcept {
        if (value != nullptr && value != INVALID_HANDLE_VALUE) {
            CloseHandle(value);
        }
        value = handle;
    }
    explicit operator bool() const noexcept {
        return value != nullptr && value != INVALID_HANDLE_VALUE;
    }
};

struct SidEvidence {
    std::vector<unsigned char> bytes;
    std::wstring text;
    DWORD attributes{0};
    bool enabled{false};
    bool denyOnly{false};
};

struct CallerIdentityRecord {
    unsigned long authenticationService{0};
    unsigned long authenticationLevel{0};
    std::wstring rpcPrincipalName;
    SidEvidence rpcAuthzUserSid;
    std::vector<SidEvidence> rpcAuthzGroupSids;
    std::vector<SidEvidence> rpcAuthzRestrictedSids;
    DWORD clientPid{0};
    std::uint64_t processCreationTime{0};
    std::shared_ptr<UniqueHandle> processHandle{std::make_shared<UniqueHandle>()};
    SidEvidence processTokenUserSid;
    std::vector<SidEvidence> processGroupSids;
    std::vector<SidEvidence> processRestrictedSids;
    std::optional<SidEvidence> logonSid;
    std::wstring integrityLevelText;
    DWORD integrityRid{0};
    DWORD windowsSessionId{0};
};

struct CallerExpectation {
    PrincipalClass principalClass{PrincipalClass::None};
    AuthorityType authorityType{AuthorityType::AuthorityControl};
    std::wstring expectedPrincipalSid;
    std::wstring expectedNormalGroupSid;
    std::wstring expectedRestrictingSid;
    DWORD requiredIntegrityRid{0};
    std::vector<DWORD> allowedWindowsSessionIds;
    bool requireRestrictedToken{false};
};

struct SessionRecord {
    GUID sessionId{};
    GUID authorityId{};
    GUID launchSessionId{};
    AuthorityType authorityType{AuthorityType::AuthorityControl};
    PrincipalClass principalClass{PrincipalClass::None};
    CallerIdentityRecord identity;
    std::uint64_t epoch{0};
    std::uint64_t lastAcceptedSequence{0};
    std::chrono::system_clock::time_point expiresAt{};
    SessionState state{SessionState::Opening};
    std::uint64_t revision{0};
};

struct OperationRecord {
    GUID operationId{};
    GUID ownerSessionId{};
    GUID authorityId{};
    PrincipalClass ownerPrincipal{PrincipalClass::None};
    std::uint64_t generation{0};
    std::string state;
    bool cancelBeforeGrantAllowed{true};
};

struct GrantRecord {
    GUID grantId{};
    GUID operationId{};
    GUID audienceAuthorityId{};
    GUID sessionId{};
    PrincipalClass audiencePrincipal{PrincipalClass::None};
    std::string helperType;
    P13Action action{P13_ACTION_NONE};
    std::uint64_t generation{0};
    std::array<unsigned char, 32> releaseDigest{};
    std::array<unsigned char, 32> requestIdHash{};
    std::wstring storageKey;
    std::chrono::system_clock::time_point expiresAt{};
    GrantState state{GrantState::Issued};
    bool effectReported{false};
};

struct LaunchTicketRecord {
    GUID launchTicketId{};
    GUID authorityId{};
    GUID operationId{};
    GUID grantId{};
    GUID launchSessionId{};
    PrincipalClass helperPrincipal{PrincipalClass::None};
    std::string helperType;
    std::wstring launchTicketPermission;
    std::array<unsigned char, 32> releaseDigest{};
    std::uint64_t generation{0};
    std::chrono::system_clock::time_point expiresAt{};
    bool consumed{false};
    bool revoked{false};
};

struct LaunchRecord {
    GUID launchSessionId{};
    GUID launchTicketId{};
    GUID operationId{};
    GUID grantId{};
    GUID authorityId{};
    std::uint64_t epoch{0};
    PrincipalClass helperPrincipal{PrincipalClass::None};
    std::uint64_t generation{0};
    std::array<unsigned char, 32> releaseDigest{};
    LaunchState launchState{LaunchState::New};
    ProcessState processState{ProcessState::NotStarted};
    JobState jobState{JobState::Absent};
    GrantState grantState{GrantState::Issued};
    EvidenceState evidenceState{EvidenceState::Missing};
    bool helperHoldsJobHandle{false};
    bool supervisorOwnsFinalHandles{false};
    bool processSignaled{false};
    bool handlesClosed{false};
    bool evidenceReconciled{false};
    std::uint64_t revision{0};
};

struct EffectRecord {
    GUID requestId{};
    GUID operationId{};
    GUID sessionId{};
    std::uint32_t operation{0};
    bool authorized{false};
    std::wstring evidenceDescription;
};

struct SecurityEventRecord {
    GUID requestId{};
    std::uint32_t operation{0};
    Status status{Status::InternalError};
    std::wstring diagnostic;
};

struct FileObservation {
    std::uint64_t volumeSerialNumber{0};
    std::array<unsigned char, 16> fileId{};
    std::uint64_t size{0};
    std::array<unsigned char, 32> sha256{};
    DWORD numberOfLinks{0};
    bool deletePending{false};
    std::wstring ownerSid;
    std::array<unsigned char, 32> daclDigest{};
    bool protectedDacl{false};
    bool ownerRightsDenyVerified{false};
};

struct EvidenceRecord {
    GUID evidenceId{};
    GUID grantId{};
    GUID operationId{};
    GUID sessionId{};
    PrincipalClass sourcePrincipal{PrincipalClass::None};
    std::string sourceType;
    FileObservation observation;
    bool publisherExited{false};
    bool publisherWriteHandlesClosed{false};
    bool sealerExited{false};
    bool supervisorReadOnlyVerified{false};
    std::chrono::system_clock::time_point observedAt{};
};

struct Sha256Outcome {
    Status status{Status::CryptoFailed};
    std::array<unsigned char, 32> digest{};
    std::wstring diagnostic;
};

bool IsZeroGuid(const GUID &value) noexcept;
bool EqualGuid(const GUID &left, const GUID &right) noexcept;
std::wstring GuidToString(const GUID &value);
std::vector<unsigned char> CopySidBytes(const PSID sid);
std::wstring SidToString(const PSID sid);
bool EqualSidBytes(const std::vector<unsigned char> &left,
                   const std::vector<unsigned char> &right);
bool SidSetContainsEnabled(const std::vector<SidEvidence> &sids,
                           const std::wstring &text);
bool SidSetContainsBinary(const std::vector<SidEvidence> &sids,
                          const SidEvidence &value);
DWORD SidRid(const PSID sid);
Sha256Outcome Sha256Bytes(const unsigned char *data, std::size_t length);
bool Sha256Equal(const Sha256Outcome &left, const Sha256Outcome &right);
std::wstring Sha256Hex(const std::array<unsigned char, 32> &digest);
std::chrono::system_clock::time_point NowUtc();
void SetResponse(P13Response *response, Status status, std::wstring_view message,
                 const GUID &sessionId = {}, const GUID &evidenceId = {},
                 std::uint64_t serverEpoch = 0);
std::vector<unsigned char> CanonicalAuthorityRequest(
    const P13AuthorityEnvelope &request);
std::vector<unsigned char> CanonicalLaunchRequest(
    const P13LaunchEnvelope &request);

}  // namespace p13::harness

