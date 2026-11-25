#pragma once

#include "common/p13_types.h"

#include <span>

namespace p13::harness {

enum class PolicyEffect : std::uint32_t {
    SessionState,
    ReadOnly,
    GrantState,
    HelperBinding,
    HelperEffect,
    LaunchState,
    Revoke,
};

struct OperationPolicy {
    P13AuthorityOperation authorityOperation{P13_AUTH_SESSION_REGISTER};
    P13LaunchOperation launchOperation{P13_LAUNCH_SESSION_REGISTER};
    const wchar_t *canonicalName{};
    bool authorityManager{false};
    PrincipalClass allowedPrincipals{PrincipalClass::None};
    AuthorityType allowedAuthorityType{AuthorityType::AuthorityControl};
    bool sessionRequired{false};
    BindingMode bindingMode{BindingMode::NoGrant};
    bool generationRequired{false};
    P13Action requiredAction{P13_ACTION_NONE};
    PolicyEffect effect{PolicyEffect::ReadOnly};
    Status failureStatus{Status::OperationNotAllowed};
};

std::span<const OperationPolicy> AuthorityPolicies() noexcept;
std::span<const OperationPolicy> LaunchPolicies() noexcept;
const OperationPolicy *FindAuthorityPolicy(P13AuthorityOperation operation) noexcept;
const OperationPolicy *FindLaunchPolicy(P13LaunchOperation operation) noexcept;

class AuthorizedCallToken {
public:
    AuthorizedCallToken() = delete;
    AuthorizedCallToken(const AuthorizedCallToken &) = delete;
    AuthorizedCallToken &operator=(const AuthorizedCallToken &) = delete;
    AuthorizedCallToken(AuthorizedCallToken &&) noexcept = default;
    AuthorizedCallToken &operator=(AuthorizedCallToken &&) noexcept = default;

    const OperationPolicy &policy() const noexcept { return *policy_; }
    const CallerIdentityRecord &identity() const noexcept { return *identity_; }
    const SessionRecord &session() const noexcept { return session_; }
    const GrantRecord *grant() const noexcept {
        return hasGrant_ ? &grant_ : nullptr;
    }
    const GUID &requestId() const noexcept { return requestId_; }
    const GUID &operationId() const noexcept { return operationId_; }
    std::uint64_t generation() const noexcept { return generation_; }
    const GUID &authorizationNonce() const noexcept { return authorizationNonce_; }

private:
    friend class AuthorizationEngine;
    AuthorizedCallToken(const OperationPolicy &policy,
                        std::shared_ptr<const CallerIdentityRecord> identity,
                        SessionRecord session,
                        GUID requestId,
                        GUID operationId,
                        std::uint64_t generation,
                        std::optional<GrantRecord> grant,
                        GUID nonce);

    const OperationPolicy *policy_{nullptr};
    std::shared_ptr<const CallerIdentityRecord> identity_;
    SessionRecord session_{};
    GUID requestId_{};
    GUID operationId_{};
    std::uint64_t generation_{0};
    GrantRecord grant_{};
    bool hasGrant_{false};
    GUID authorizationNonce_{};
};

}  // namespace p13::harness

