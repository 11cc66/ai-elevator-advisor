#pragma once

#include "authority/p13_authority_components.h"

#include <string>

namespace p13::harness {

struct ServerRuntimeConfiguration {
    std::wstring endpoint;
    std::wstring interfaceSddl;
    bool registerAuthorityInterface{false};
    bool registerLaunchInterface{false};
    const AuthorityDescriptor *launchDescriptor{nullptr};
};

int RunNativeServer(const ServerRuntimeConfiguration &configuration);

}  // namespace p13::harness

