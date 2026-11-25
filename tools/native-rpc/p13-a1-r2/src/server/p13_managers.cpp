#include "authority/p13_authority_service.h"

#include <atomic>
#include <exception>

namespace p13::harness {
namespace {

std::atomic<const AuthorityDescriptor *> g_launchDescriptor{nullptr};
WindowsRpcIdentityProvider g_identityProvider;

}  // namespace

void SetLaunchInterfaceDescriptor(const AuthorityDescriptor *descriptor) {
    g_launchDescriptor.store(descriptor, std::memory_order_release);
}

}  // namespace p13::harness

extern "C" error_status_t P13Invoke(handle_t IDL_handle,
                                    const P13AuthorityEnvelope *request,
                                    P13Response *response) {
    using namespace p13::harness;
    if (request == nullptr || response == nullptr) {
        SetResponse(response, Status::InvalidCall, L"null RPC parameter");
        return RPC_X_NULL_REF_POINTER;
    }
    try {
        const AuthorityDescriptor *descriptor =
            DescriptorForId(request->authorityId);
        if (descriptor == nullptr) {
            SetResponse(response, Status::AuthorityMismatch,
                        L"unregistered authority ID");
            return RPC_S_OK;
        }
        std::optional<AuthorizedCallToken> token;
        std::wstring diagnostic;
        const Status authStatus = AuthorizationEngine::AuthorizeAuthority(
            IDL_handle, *request, *descriptor, g_identityProvider,
            GlobalHarnessState(), &token, &diagnostic);
        if (authStatus != Status::Ok || !token.has_value()) {
            GlobalHarnessState().securityEvents.Record(
                {request->requestId,
                 static_cast<std::uint32_t>(request->operation), authStatus,
                 diagnostic});
            SetResponse(response, authStatus, diagnostic);
            return RPC_S_OK;
        }
        const Status dispatchStatus =
            DispatchAuthority(*token, *request, response);
        if (dispatchStatus != Status::Ok && response->status == 0) {
            SetResponse(response, dispatchStatus,
                        L"authority dispatch failed");
        }
        return RPC_S_OK;
    } catch (const std::exception &error) {
        SetResponse(response, Status::InternalError, L"authority internal error");
        (void)error;
        return RPC_S_OK;
    } catch (...) {
        SetResponse(response, Status::InternalError,
                    L"authority unknown internal error");
        return RPC_S_OK;
    }
}

extern "C" error_status_t P13LaunchInvoke(handle_t IDL_handle,
                                         const P13LaunchEnvelope *request,
                                         P13Response *response) {
    using namespace p13::harness;
    if (request == nullptr || response == nullptr) {
        SetResponse(response, Status::InvalidCall, L"null RPC parameter");
        return RPC_X_NULL_REF_POINTER;
    }
    try {
        const AuthorityDescriptor *descriptor =
            g_launchDescriptor.load(std::memory_order_acquire);
        if (descriptor == nullptr) {
            SetResponse(response, Status::AuthorityMismatch,
                        L"launch descriptor not configured");
            return RPC_S_OK;
        }
        std::optional<AuthorizedCallToken> token;
        std::wstring diagnostic;
        const Status authStatus = AuthorizationEngine::AuthorizeLaunch(
            IDL_handle, *request, *descriptor, g_identityProvider,
            GlobalHarnessState(), &token, &diagnostic);
        if (authStatus != Status::Ok || !token.has_value()) {
            GlobalHarnessState().securityEvents.Record(
                {request->requestId,
                 static_cast<std::uint32_t>(request->operation), authStatus,
                 diagnostic});
            SetResponse(response, authStatus, diagnostic);
            return RPC_S_OK;
        }
        const Status dispatchStatus =
            DispatchLaunch(*token, *request, response);
        if (dispatchStatus != Status::Ok && response->status == 0) {
            SetResponse(response, dispatchStatus, L"launch dispatch failed");
        }
        return RPC_S_OK;
    } catch (...) {
        SetResponse(response, Status::InternalError, L"launch internal error");
        return RPC_S_OK;
    }
}

