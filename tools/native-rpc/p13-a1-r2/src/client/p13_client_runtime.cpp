#include "client/p13_client_runtime.h"

#include <cstddef>

namespace p13::harness {
namespace {

GUID NewRequestId() {
    GUID value{};
    if (UuidCreate(&value) != RPC_S_OK) {
        value = {};
    }
    return value;
}

void SetDigest(P13AuthorityEnvelope *request) {
    const auto canonical = CanonicalAuthorityRequest(*request);
    const auto outcome = Sha256Bytes(canonical.data(), canonical.size());
    if (outcome.status != Status::Ok) {
        request->protocolVersion = 0;
        return;
    }
    std::copy(outcome.digest.begin(), outcome.digest.end(),
              request->requestDigest);
}

void SetDigest(P13LaunchEnvelope *request) {
    const auto canonical = CanonicalLaunchRequest(*request);
    const auto outcome = Sha256Bytes(canonical.data(), canonical.size());
    if (outcome.status != Status::Ok) {
        request->protocolVersion = 0;
        return;
    }
    std::copy(outcome.digest.begin(), outcome.digest.end(),
              request->requestDigest);
}

}  // namespace

P13AuthorityEnvelope BuildAuthorityEnvelope(
    P13AuthorityOperation operation,
    const GUID &authorityId,
    const GUID &sessionId,
    const GUID &operationId,
    const GUID &grantId,
    const GUID &launchSessionId,
    const GUID &launchTicketId,
    std::uint64_t epoch,
    std::uint64_t generation,
    std::uint64_t sequence) {
    P13AuthorityEnvelope request{};
    request.protocolVersion = P13_PROTOCOL_VERSION_2;
    request.operation = operation;
    request.requestId = NewRequestId();
    request.authorityId = authorityId;
    request.sessionId = sessionId;
    request.operationId = operationId;
    request.grantId = grantId;
    request.launchSessionId = launchSessionId;
    request.launchTicketId = launchTicketId;
    request.authorityEpoch = epoch;
    request.generation = generation;
    request.clientSequence = sequence;
    request.action = P13_ACTION_NONE;
    SetDigest(&request);
    return request;
}

P13LaunchEnvelope BuildLaunchEnvelope(
    P13LaunchOperation operation,
    const GUID &launchAuthorityId,
    const GUID &launchSessionId,
    const GUID &launchTicketId,
    const GUID &operationId,
    std::uint64_t epoch,
    std::uint64_t generation,
    std::uint64_t sequence,
    const std::array<unsigned char, 32> &releaseDigest) {
    P13LaunchEnvelope request{};
    request.protocolVersion = P13_PROTOCOL_VERSION_2;
    request.operation = operation;
    request.requestId = NewRequestId();
    request.launchAuthorityId = launchAuthorityId;
    request.launchSessionId = launchSessionId;
    request.launchTicketId = launchTicketId;
    request.operationId = operationId;
    request.authorityEpoch = epoch;
    request.generation = generation;
    request.clientSequence = sequence;
    request.action = P13_ACTION_NONE;
    std::copy(releaseDigest.begin(), releaseDigest.end(),
              request.expectedReleaseDigest);
    SetDigest(&request);
    return request;
}

int RunNativeClientProbe(const ClientRuntimeConfiguration &configuration) {
    RPC_WSTR stringBinding = nullptr;
    RPC_BINDING_HANDLE binding = nullptr;
    std::wstring protocolSequence = L"ncalrpc";
    std::wstring endpoint = configuration.endpoint;
    if (RpcStringBindingComposeW(
            nullptr, reinterpret_cast<RPC_WSTR>(protocolSequence.data()),
            nullptr, reinterpret_cast<RPC_WSTR>(endpoint.data()), nullptr,
            &stringBinding) != RPC_S_OK) {
        return 2;
    }
    const RPC_STATUS bindingStatus =
        RpcBindingFromStringBindingW(stringBinding, &binding);
    RpcStringFreeW(&stringBinding);
    if (bindingStatus != RPC_S_OK) {
        return 3;
    }

    std::wstring principal = configuration.expectedServerPrincipal;
    const RPC_STATUS authStatus = RpcBindingSetAuthInfoExW(
        binding,
        configuration.expectedServerPrincipal.empty()
            ? nullptr
            : reinterpret_cast<RPC_WSTR>(principal.data()),
        RPC_C_AUTHN_LEVEL_PKT_PRIVACY, RPC_C_AUTHN_WINNT, nullptr, 0, nullptr);
    if (authStatus != RPC_S_OK) {
        RpcBindingFree(&binding);
        return 4;
    }

    P13AuthorityEnvelope request = BuildAuthorityEnvelope(
        P13_AUTH_AUTHORITY_EPOCH_READ, kStagingAuthorityId, {}, {}, {}, {},
        {}, 1, 0, 1);
    P13Response response{};
    const RPC_STATUS callStatus = P13Invoke(binding, &request, &response);
    RpcBindingFree(&binding);
    return callStatus == RPC_S_OK && response.status == 0 ? 0 : 5;
}

}  // namespace p13::harness

