#include "server/p13_server_runtime.h"

#include <memory>

namespace p13::harness {
void SetLaunchInterfaceDescriptor(const AuthorityDescriptor *descriptor);

namespace {

RPC_STATUS RPC_ENTRY CoarseInterfaceCallback(RPC_IF_HANDLE interfaceUuid,
                                             void *context) {
    (void)interfaceUuid;
    (void)context;
    RPC_CALL_ATTRIBUTES_V2_W attributes{};
    attributes.Version = RPC_CALL_ATTRIBUTES_VERSION;
    attributes.Flags =
        RPC_QUERY_CLIENT_PID | RPC_QUERY_IS_CLIENT_LOCAL;
    if (RpcServerInqCallAttributesW(nullptr, &attributes) != RPC_S_OK) {
        return RPC_S_ACCESS_DENIED;
    }
    if (attributes.NullSession || attributes.KernelModeCaller ||
        attributes.IsClientLocal != rcclLocal ||
        attributes.AuthenticationService != RPC_C_AUTHN_WINNT ||
        attributes.AuthenticationLevel < RPC_C_AUTHN_LEVEL_PKT_PRIVACY) {
        return RPC_S_ACCESS_DENIED;
    }
    return RPC_S_OK;
}

}  // namespace

int RunNativeServer(const ServerRuntimeConfiguration &configuration) {
    if (configuration.endpoint.empty() ||
        configuration.interfaceSddl.empty() ||
        (!configuration.registerAuthorityInterface &&
         !configuration.registerLaunchInterface)) {
        return 2;
    }

    PSECURITY_DESCRIPTOR interfaceDescriptor = nullptr;
    if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
            configuration.interfaceSddl.c_str(), SDDL_REVISION_1,
            &interfaceDescriptor, nullptr)) {
        return 3;
    }
    std::unique_ptr<void, decltype(&LocalFree)> guard(interfaceDescriptor,
                                                      &LocalFree);

    std::wstring protocolSequence = L"ncalrpc";
    std::wstring endpoint = configuration.endpoint;
    RPC_STATUS status = RpcServerUseProtseqEpW(
        reinterpret_cast<RPC_WSTR>(protocolSequence.data()),
        kMaxConcurrentRpcCalls,
        reinterpret_cast<RPC_WSTR>(endpoint.data()), interfaceDescriptor);
    if (status != RPC_S_OK) {
        return 4;
    }
    status = RpcServerRegisterAuthInfoW(nullptr, RPC_C_AUTHN_WINNT, nullptr,
                                        nullptr);
    if (status != RPC_S_OK) {
        return 5;
    }

    if (configuration.registerAuthorityInterface) {
        status = RpcServerRegisterIf3(
            P13Authority_v1_0_s_ifspec, nullptr, nullptr,
            RPC_IF_ALLOW_LOCAL_ONLY, kMaxConcurrentRpcCalls,
            P13_MAX_RPC_WIRE_BYTES, CoarseInterfaceCallback,
            interfaceDescriptor);
        if (status != RPC_S_OK) {
            return 6;
        }
    }
    if (configuration.registerLaunchInterface) {
        if (configuration.launchDescriptor == nullptr) {
            return 7;
        }
        SetLaunchInterfaceDescriptor(configuration.launchDescriptor);
        status = RpcServerRegisterIf3(
            P13Launch_v1_0_s_ifspec, nullptr, nullptr, RPC_IF_ALLOW_LOCAL_ONLY,
            kMaxConcurrentRpcCalls, P13_MAX_RPC_WIRE_BYTES,
            CoarseInterfaceCallback, interfaceDescriptor);
        if (status != RPC_S_OK) {
            return 8;
        }
    }

    status = RpcServerListen(1, kMaxConcurrentRpcCalls, FALSE);
    const int result = status == RPC_S_OK ? 0 : 9;
    RpcMgmtStopServerListening(nullptr);
    RpcMgmtWaitServerListen();
    if (configuration.registerAuthorityInterface) {
        RpcServerUnregisterIf(P13Authority_v1_0_s_ifspec, nullptr, FALSE);
    }
    if (configuration.registerLaunchInterface) {
        RpcServerUnregisterIf(P13Launch_v1_0_s_ifspec, nullptr, FALSE);
        SetLaunchInterfaceDescriptor(nullptr);
    }
    return result;
}

}  // namespace p13::harness

