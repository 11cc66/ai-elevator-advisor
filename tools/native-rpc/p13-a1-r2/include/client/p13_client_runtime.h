#pragma once

#include "common/p13_types.h"

#include <string>

namespace p13::harness {

struct ClientRuntimeConfiguration {
    std::wstring endpoint;
    std::wstring expectedServerPrincipal;
};

P13AuthorityEnvelope BuildAuthorityEnvelope(P13AuthorityOperation operation,
                                            const GUID &authorityId,
                                            const GUID &sessionId,
                                            const GUID &operationId,
                                            const GUID &grantId,
                                            const GUID &launchSessionId,
                                            const GUID &launchTicketId,
                                            std::uint64_t epoch,
                                            std::uint64_t generation,
                                            std::uint64_t sequence);

P13LaunchEnvelope BuildLaunchEnvelope(P13LaunchOperation operation,
                                      const GUID &launchAuthorityId,
                                      const GUID &launchSessionId,
                                      const GUID &launchTicketId,
                                      const GUID &operationId,
                                      std::uint64_t epoch,
                                      std::uint64_t generation,
                                      std::uint64_t sequence,
                                      const std::array<unsigned char, 32>
                                          &releaseDigest);

int RunNativeClientProbe(const ClientRuntimeConfiguration &configuration);

}  // namespace p13::harness

