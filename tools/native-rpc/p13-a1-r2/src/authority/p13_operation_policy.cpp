#include "authority/p13_operation_policy.h"

#include <array>

namespace p13::harness {
namespace {

constexpr PrincipalClass kWeb = PrincipalClass::WebService;
constexpr PrincipalClass kWorker = PrincipalClass::WorkerService;
constexpr PrincipalClass kSupervisor = PrincipalClass::AuthoritySupervisor;
constexpr PrincipalClass kStaging = PrincipalClass::StagingWriterHelper;
constexpr PrincipalClass kPublisher = PrincipalClass::PublisherHelper;
constexpr PrincipalClass kSealer = PrincipalClass::SealerHelper;
constexpr PrincipalClass kCleanup = PrincipalClass::CleanupHelper;
constexpr PrincipalClass kHelpers =
    kStaging | kPublisher | kSealer | kCleanup;
constexpr PrincipalClass kAllControl = kWeb | kWorker | kHelpers;
constexpr AuthorityType kLaunchAuthorities =
    AuthorityType::LaunchStaging | AuthorityType::LaunchPublisher |
    AuthorityType::LaunchSealer | AuthorityType::LaunchCleanup;

constexpr std::array<OperationPolicy, 13> kAuthorityPolicies = {{
    {P13_AUTH_SESSION_REGISTER, P13_LAUNCH_SESSION_REGISTER,
     L"SESSION_REGISTER", true, kAllControl, AuthorityType::AuthorityControl,
     false, BindingMode::NoGrant, false, P13_ACTION_NONE,
     PolicyEffect::SessionState, Status::OperationNotAllowed},
    {P13_AUTH_SESSION_HEARTBEAT, P13_LAUNCH_SESSION_REGISTER,
     L"SESSION_HEARTBEAT", true, kAllControl, AuthorityType::AuthorityControl,
     true, BindingMode::NoGrant, false, P13_ACTION_NONE,
     PolicyEffect::SessionState, Status::SessionRequired},
    {P13_AUTH_SESSION_CLOSE, P13_LAUNCH_SESSION_REGISTER,
     L"SESSION_CLOSE", true, kAllControl, AuthorityType::AuthorityControl,
     true, BindingMode::NoGrant, false, P13_ACTION_NONE,
     PolicyEffect::Revoke, Status::SessionRequired},
    {P13_AUTH_OPERATION_REQUEST_GRANT, P13_LAUNCH_SESSION_REGISTER,
     L"OPERATION_REQUEST_GRANT", true, kWeb | kWorker,
     AuthorityType::AuthorityControl, true, BindingMode::NoGrant, true,
     P13_ACTION_NONE, PolicyEffect::GrantState, Status::OperationNotAllowed},
    {P13_AUTH_OPERATION_STATUS_READ, P13_LAUNCH_SESSION_REGISTER,
     L"OPERATION_STATUS_READ", true, kWeb | kWorker,
     AuthorityType::AuthorityControl, true, BindingMode::OperationOwner, false,
     P13_ACTION_NONE, PolicyEffect::ReadOnly, Status::OperationNotAllowed},
    {P13_AUTH_OPERATION_CANCEL_BEFORE_GRANT, P13_LAUNCH_SESSION_REGISTER,
     L"OPERATION_CANCEL_BEFORE_GRANT", true, kWeb | kWorker,
     AuthorityType::AuthorityControl, true, BindingMode::OperationOwner, true,
     P13_ACTION_NONE, PolicyEffect::GrantState, Status::OperationNotAllowed},
    {P13_AUTH_HELPER_REGISTER, P13_LAUNCH_SESSION_REGISTER,
     L"HELPER_REGISTER", true, kHelpers, AuthorityType::AuthorityControl, true,
     BindingMode::LaunchTicket, true, P13_ACTION_NONE,
     PolicyEffect::HelperBinding, Status::TicketRequired},
    {P13_AUTH_HELPER_HEARTBEAT, P13_LAUNCH_SESSION_REGISTER,
     L"HELPER_HEARTBEAT", true, kHelpers, AuthorityType::AuthorityControl, true,
     BindingMode::MatchGrant, true, P13_ACTION_NONE, PolicyEffect::SessionState,
     Status::GrantRequired},
    {P13_AUTH_HELPER_EFFECT_COMMITTED, P13_LAUNCH_SESSION_REGISTER,
     L"HELPER_EFFECT_COMMITTED", true, kHelpers,
     AuthorityType::AuthorityControl, true, BindingMode::MatchGrant, true,
     P13_ACTION_NONE, PolicyEffect::HelperEffect, Status::GrantRequired},
    {P13_AUTH_HELPER_EXIT_NOTICE, P13_LAUNCH_SESSION_REGISTER,
     L"HELPER_EXIT_NOTICE", true, kHelpers, AuthorityType::AuthorityControl,
     true, BindingMode::MatchGrant, true, P13_ACTION_NONE, PolicyEffect::Revoke,
     Status::GrantRequired},
    {P13_AUTH_GRANT_STATUS_READ, P13_LAUNCH_SESSION_REGISTER,
     L"GRANT_STATUS_READ", true, kHelpers, AuthorityType::AuthorityControl,
     true, BindingMode::MatchGrant, true, P13_ACTION_NONE,
     PolicyEffect::ReadOnly, Status::GrantRequired},
    {P13_AUTH_AUTHORITY_EPOCH_READ, P13_LAUNCH_SESSION_REGISTER,
     L"AUTHORITY_EPOCH_READ", true, kAllControl,
     AuthorityType::AuthorityControl, false, BindingMode::NoGrant, false,
     P13_ACTION_NONE, PolicyEffect::ReadOnly, Status::OperationNotAllowed},
    {P13_AUTH_PROCESS_STATE_READ, P13_LAUNCH_SESSION_REGISTER,
     L"PROCESS_STATE_READ", true, kHelpers, AuthorityType::AuthorityControl,
     true, BindingMode::MatchGrant, true, P13_ACTION_NONE,
     PolicyEffect::ReadOnly, Status::GrantRequired},
}};

constexpr std::array<OperationPolicy, 6> kLaunchPolicies = {{
    {P13_AUTH_SESSION_REGISTER, P13_LAUNCH_SESSION_REGISTER,
     L"LAUNCH_SESSION_REGISTER", false, kSupervisor, kLaunchAuthorities, false,
     BindingMode::LaunchTicket, true,
     P13_ACTION_NONE, PolicyEffect::LaunchState, Status::TicketRequired},
    {P13_AUTH_SESSION_REGISTER, P13_LAUNCH_PREPARE,
     L"LAUNCH_PREPARE", false, kSupervisor, kLaunchAuthorities, true,
     BindingMode::LaunchTicket, true, P13_ACTION_NONE,
     PolicyEffect::LaunchState, Status::TicketRequired},
    {P13_AUTH_SESSION_REGISTER, P13_LAUNCH_COMMIT,
     L"LAUNCH_COMMIT", false, kSupervisor, kLaunchAuthorities, true,
     BindingMode::LaunchTicket, true, P13_ACTION_NONE,
     PolicyEffect::LaunchState, Status::InvalidTransition},
    {P13_AUTH_SESSION_REGISTER, P13_LAUNCH_ABORT,
     L"LAUNCH_ABORT", false, kSupervisor, kLaunchAuthorities, true,
     BindingMode::LaunchTicket, true, P13_ACTION_NONE,
     PolicyEffect::LaunchState, Status::InvalidTransition},
    {P13_AUTH_SESSION_REGISTER, P13_LAUNCH_STATUS_READ,
     L"LAUNCH_STATUS_READ", false, kSupervisor, kLaunchAuthorities,
     true, BindingMode::NoGrant, false, P13_ACTION_NONE,
     PolicyEffect::ReadOnly, Status::SessionRequired},
    {P13_AUTH_SESSION_REGISTER, P13_LAUNCH_SESSION_CLOSE,
     L"LAUNCH_SESSION_CLOSE", false, kSupervisor, kLaunchAuthorities,
     true, BindingMode::NoGrant, false, P13_ACTION_NONE, PolicyEffect::Revoke,
     Status::InvalidTransition},
}};

}  // namespace

std::span<const OperationPolicy> AuthorityPolicies() noexcept {
    return kAuthorityPolicies;
}

std::span<const OperationPolicy> LaunchPolicies() noexcept {
    return kLaunchPolicies;
}

const OperationPolicy *FindAuthorityPolicy(
    P13AuthorityOperation operation) noexcept {
    for (const auto &policy : kAuthorityPolicies) {
        if (policy.authorityOperation == operation) {
            return &policy;
        }
    }
    return nullptr;
}

const OperationPolicy *FindLaunchPolicy(P13LaunchOperation operation) noexcept {
    for (const auto &policy : kLaunchPolicies) {
        if (policy.launchOperation == operation) {
            return &policy;
        }
    }
    return nullptr;
}

AuthorizedCallToken::AuthorizedCallToken(
    const OperationPolicy &policy,
    std::shared_ptr<const CallerIdentityRecord> identity,
    SessionRecord session,
    GUID requestId,
    GUID operationId,
    std::uint64_t generation,
    std::optional<GrantRecord> grant,
    GUID nonce)
    : policy_(&policy),
      identity_(std::move(identity)),
      session_(std::move(session)),
      requestId_(requestId),
      operationId_(operationId),
      generation_(generation),
      hasGrant_(grant.has_value()),
      authorizationNonce_(nonce) {
    if (grant.has_value()) {
        grant_ = *grant;
    }
}

}  // namespace p13::harness

