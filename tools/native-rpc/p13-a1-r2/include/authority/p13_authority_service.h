#pragma once

#include "authority/p13_authority_components.h"
#include "identity/p13_identity_adapter.h"
#include "launch/p13_launch_components.h"

namespace p13::harness {

struct HarnessState {
    std::uint64_t epoch{1};
    TestSessionStore sessions;
    TestGrantStore grants;
    TestOperationStore operations;
    TestTicketStore tickets;
    TestLaunchStore launches;
    TestEffectSink effects;
    TestSecurityEventSink securityEvents;
};

HarnessState &GlobalHarnessState();

class AuthorizationEngine {
public:
    static Status AuthorizeAuthority(handle_t binding,
                                     const P13AuthorityEnvelope &request,
                                     const AuthorityDescriptor &descriptor,
                                     IIdentityProvider &identityProvider,
                                     HarnessState &state,
                                     std::optional<AuthorizedCallToken> *token,
                                     std::wstring *diagnostic);
    static Status AuthorizeLaunch(handle_t binding,
                                  const P13LaunchEnvelope &request,
                                  const AuthorityDescriptor &descriptor,
                                  IIdentityProvider &identityProvider,
                                  HarnessState &state,
                                  std::optional<AuthorizedCallToken> *token,
                                  std::wstring *diagnostic);
};

Status ValidateAuthorityRequest(const P13AuthorityEnvelope &request,
                                std::wstring *diagnostic);
Status ValidateLaunchRequest(const P13LaunchEnvelope &request,
                             std::wstring *diagnostic);

Status DispatchAuthority(const AuthorizedCallToken &authorized,
                         const P13AuthorityEnvelope &request,
                         P13Response *response);
Status DispatchLaunch(const AuthorizedCallToken &authorized,
                      const P13LaunchEnvelope &request,
                      P13Response *response);

}  // namespace p13::harness

