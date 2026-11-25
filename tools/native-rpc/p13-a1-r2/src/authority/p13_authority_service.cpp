#include "authority/p13_authority_service.h"

#include <algorithm>

namespace p13::harness {
namespace {

GUID NewGuid() {
    GUID value{};
    if (UuidCreate(&value) != RPC_S_OK) {
        value = {};
    }
    return value;
}

bool IsHelper(PrincipalClass principal) {
    return principal == PrincipalClass::StagingWriterHelper ||
           principal == PrincipalClass::PublisherHelper ||
           principal == PrincipalClass::SealerHelper ||
           principal == PrincipalClass::CleanupHelper;
}

CallerExpectation ExpectationFor(const AuthorityDescriptor &descriptor) {
    CallerExpectation expectation;
    expectation.principalClass = descriptor.principalClass;
    expectation.authorityType =
        IsHelper(descriptor.principalClass)
            ? descriptor.controlAuthorityType
            : descriptor.controlAuthorityType;
    expectation.expectedPrincipalSid = descriptor.expectedPrincipalSid;
    expectation.expectedNormalGroupSid = descriptor.normalGroupSid;
    expectation.expectedRestrictingSid = descriptor.restrictingSid;
    expectation.requiredIntegrityRid = descriptor.requiredIntegrityRid;
    expectation.allowedWindowsSessionIds = descriptor.allowedWindowsSessionIds;
    expectation.requireRestrictedToken = IsHelper(descriptor.principalClass);
    return expectation;
}

CallerExpectation SupervisorExpectation() {
    const AuthorityDescriptor &descriptor = SupervisorDescriptor();
    CallerExpectation expectation;
    expectation.principalClass = descriptor.principalClass;
    expectation.authorityType = descriptor.controlAuthorityType;
    expectation.expectedPrincipalSid = descriptor.expectedPrincipalSid;
    expectation.expectedNormalGroupSid = descriptor.normalGroupSid;
    expectation.requiredIntegrityRid = descriptor.requiredIntegrityRid;
    expectation.allowedWindowsSessionIds = descriptor.allowedWindowsSessionIds;
    return expectation;
}

bool ZeroArray(const byte *data, std::size_t size) {
    if (data == nullptr) {
        return true;
    }
    return std::all_of(data, data + size,
                       [](unsigned char value) { return value == 0; });
}

Status RequestDigest(const void *data,
                     std::size_t length,
                     std::array<unsigned char, 32> *digest,
                     std::wstring *diagnostic) {
    const auto outcome = Sha256Bytes(
        static_cast<const unsigned char *>(data), length);
    if (outcome.status != Status::Ok) {
        if (diagnostic != nullptr) {
            *diagnostic = outcome.diagnostic;
        }
        return outcome.status;
    }
    *digest = outcome.digest;
    return Status::Ok;
}

std::array<unsigned char, 32> ClaimedDigest(const byte *data) {
    std::array<unsigned char, 32> result{};
    std::copy_n(data, result.size(), result.begin());
    return result;
}

Status ValidateDigest(const byte *claimed,
                      const std::vector<unsigned char> &canonical,
                      std::wstring *diagnostic) {
    const auto outcome = Sha256Bytes(canonical.data(), canonical.size());
    if (outcome.status != Status::Ok) {
        if (diagnostic != nullptr) {
            *diagnostic = outcome.diagnostic;
        }
        return outcome.status;
    }
    const auto claimedBytes = ClaimedDigest(claimed);
    if (claimedBytes != outcome.digest) {
        if (diagnostic != nullptr) {
            *diagnostic = L"request digest mismatch";
        }
        return Status::InvalidCall;
    }
    return Status::Ok;
}

bool PolicyAllows(const OperationPolicy &policy,
                  const AuthorityDescriptor &descriptor,
                  bool launchManager) {
    if (!HasPrincipal(policy.allowedPrincipals, descriptor.principalClass)) {
        return false;
    }
    if (launchManager) {
        return HasAuthorityType(policy.allowedAuthorityType,
                                descriptor.launchAuthorityType);
    }
    return descriptor.controlAuthorityType == AuthorityType::AuthorityControl;
}

bool GrantMatchesRequest(const GrantRecord &grant,
                         const P13AuthorityEnvelope &request,
                         const SessionRecord &session,
                         const AuthorityDescriptor &descriptor,
                         std::chrono::system_clock::time_point now) {
    return !IsZeroGuid(request.grantId) &&
           EqualGuid(grant.grantId, request.grantId) &&
           EqualGuid(grant.operationId, request.operationId) &&
           EqualGuid(grant.audienceAuthorityId, request.authorityId) &&
           EqualGuid(grant.sessionId, session.sessionId) &&
           grant.audiencePrincipal == descriptor.principalClass &&
           grant.helperType == descriptor.helperType &&
           grant.generation == static_cast<std::uint64_t>(request.generation) &&
           grant.action == request.action &&
           grant.expiresAt > now && grant.state != GrantState::Consumed &&
           grant.state != GrantState::Revoked &&
           grant.state != GrantState::Expired &&
           grant.state != GrantState::Unknown;
}

Status ValidateTicketForAuthority(
    HarnessState &state,
    const P13AuthorityEnvelope &request,
    const AuthorityDescriptor &descriptor,
    LaunchTicketRecord *ticketOut) {
    if (IsZeroGuid(request.launchTicketId)) {
        return Status::TicketRequired;
    }
    const auto ticket = state.tickets.Find(request.launchTicketId);
    if (!ticket) {
        return Status::TicketRejected;
    }
    if (ticket->consumed || ticket->revoked ||
        ticket->expiresAt <= NowUtc() ||
        !EqualGuid(ticket->authorityId, request.authorityId) ||
        ticket->helperPrincipal != descriptor.principalClass ||
        ticket->helperType != descriptor.helperType ||
        _wcsicmp(ticket->launchTicketPermission.c_str(),
                  descriptor.launchTicketPermission) != 0 ||
        ticket->generation != static_cast<std::uint64_t>(request.generation) ||
        !EqualGuid(ticket->operationId, request.operationId) ||
        !EqualGuid(ticket->grantId, request.grantId) ||
        !EqualGuid(ticket->launchSessionId, request.launchSessionId)) {
        return ticket->consumed ? Status::TicketConsumed
                                : Status::TicketRejected;
    }
    if (ticketOut != nullptr) {
        *ticketOut = *ticket;
    }
    return Status::Ok;
}

Status ValidateGrantForAuthority(
    HarnessState &state,
    const P13AuthorityEnvelope &request,
    const AuthorityDescriptor &descriptor,
    const SessionRecord &session,
    GrantRecord *grantOut) {
    if (IsZeroGuid(request.grantId)) {
        return Status::GrantRequired;
    }
    const auto grant = state.grants.Find(request.grantId);
    if (!grant) {
        return Status::GrantRejected;
    }
    if (!GrantMatchesRequest(*grant, request, session, descriptor, NowUtc())) {
        return Status::GrantRejected;
    }
    GrantRecord checked;
    const Status status = state.grants.Match(
        *grant, session, static_cast<std::uint64_t>(request.generation),
        request.action, NowUtc(), &checked);
    if (status != Status::Ok) {
        return status;
    }
    if (grantOut != nullptr) {
        *grantOut = checked;
    }
    return Status::Ok;
}

Status ValidateLaunchTicket(
    HarnessState &state,
    const P13LaunchEnvelope &request,
    const AuthorityDescriptor &descriptor,
    LaunchTicketRecord *ticketOut) {
    (void)descriptor;
    if (IsZeroGuid(request.launchTicketId)) {
        return Status::TicketRequired;
    }
    const auto ticket = state.tickets.Find(request.launchTicketId);
    if (!ticket || ticket->consumed || ticket->revoked ||
        ticket->expiresAt <= NowUtc() ||
        !EqualGuid(ticket->authorityId, request.launchAuthorityId) ||
        !EqualGuid(ticket->operationId, request.operationId) ||
        !EqualGuid(ticket->grantId, request.grantId) ||
        ticket->generation != static_cast<std::uint64_t>(request.generation) ||
        ticket->releaseDigest != ClaimedDigest(request.expectedReleaseDigest)) {
        return ticket->consumed ? Status::TicketConsumed
                                : Status::TicketRejected;
    }
    if (ticketOut != nullptr) {
        *ticketOut = *ticket;
    }
    return Status::Ok;
}

}  // namespace

HarnessState &GlobalHarnessState() {
    static HarnessState state;
    return state;
}

Status ValidateAuthorityRequest(const P13AuthorityEnvelope &request,
                                std::wstring *diagnostic) {
    if (request.protocolVersion != P13_PROTOCOL_VERSION_2 ||
        request.payloadLength > P13_MAX_PAYLOAD_BYTES ||
        (request.payloadLength != 0 && request.payload == nullptr) ||
        IsZeroGuid(request.requestId) || IsZeroGuid(request.authorityId) ||
        FindAuthorityPolicy(request.operation) == nullptr) {
        if (diagnostic != nullptr) {
            *diagnostic = L"authority envelope/operation is invalid";
        }
        return Status::InvalidCall;
    }
    return ValidateDigest(request.requestDigest,
                          CanonicalAuthorityRequest(request), diagnostic);
}

Status ValidateLaunchRequest(const P13LaunchEnvelope &request,
                             std::wstring *diagnostic) {
    if (request.protocolVersion != P13_PROTOCOL_VERSION_2 ||
        request.payloadLength > P13_MAX_PAYLOAD_BYTES ||
        (request.payloadLength != 0 && request.payload == nullptr) ||
        IsZeroGuid(request.requestId) ||
        IsZeroGuid(request.launchAuthorityId) ||
        FindLaunchPolicy(request.operation) == nullptr) {
        if (diagnostic != nullptr) {
            *diagnostic = L"launch envelope/operation is invalid";
        }
        return Status::InvalidCall;
    }
    return ValidateDigest(request.requestDigest,
                          CanonicalLaunchRequest(request), diagnostic);
}

Status AuthorizationEngine::AuthorizeAuthority(
    handle_t binding,
    const P13AuthorityEnvelope &request,
    const AuthorityDescriptor &descriptor,
    IIdentityProvider &identityProvider,
    HarnessState &state,
    std::optional<AuthorizedCallToken> *token,
    std::wstring *diagnostic) {
    if (token == nullptr) {
        return Status::InternalError;
    }
    const Status validation = ValidateAuthorityRequest(request, diagnostic);
    if (validation != Status::Ok) {
        return validation;
    }
    const OperationPolicy *policy = FindAuthorityPolicy(request.operation);
    if (policy == nullptr || !PolicyAllows(*policy, descriptor, false)) {
        return Status::OperationNotAllowed;
    }
    if (IsHelper(descriptor.principalClass) &&
        (descriptor.credentialReference == nullptr ||
         descriptor.credentialReference[0] == L'\0')) {
        return Status::AuthorityMismatch;
    }
    if (!EqualGuid(request.authorityId, descriptor.authorityId) ||
        static_cast<std::uint64_t>(request.authorityEpoch) != state.epoch) {
        return Status::AuthorityMismatch;
    }
    CallerIdentityRecord identity;
    const CallerExpectation expectation = ExpectationFor(descriptor);
    const Status identityStatus =
        identityProvider.Inspect(binding, expectation, &identity, diagnostic);
    if (identityStatus != Status::Ok) {
        return identityStatus;
    }
    auto identityPtr = std::make_shared<CallerIdentityRecord>(identity);

    SessionRecord session;
    if (policy->sessionRequired) {
        const auto accepted = state.sessions.AcceptRequest(
            request.sessionId, request.authorityId,
            static_cast<std::uint64_t>(request.authorityEpoch),
            static_cast<std::uint64_t>(request.clientSequence),
            request.requestId, ClaimedDigest(request.requestDigest), identity,
            NowUtc());
        if (accepted.status != Status::Ok) {
            return accepted.status;
        }
        session = accepted.session;
    } else {
        session.sessionId = request.sessionId;
        session.authorityId = descriptor.authorityId;
        session.principalClass = descriptor.principalClass;
        session.identity = identity;
        session.epoch = static_cast<std::uint64_t>(request.authorityEpoch);
    }

    if (policy->generationRequired &&
        static_cast<std::uint64_t>(request.generation) == 0) {
        return Status::InvalidCall;
    }
    if (policy->bindingMode == BindingMode::OperationOwner) {
        const Status owned =
            state.operations.RequireOwner(request.operationId, session);
        if (owned != Status::Ok) {
            return owned;
        }
    }
    std::optional<GrantRecord> grant;
    if (policy->bindingMode == BindingMode::MatchGrant ||
        policy->bindingMode == BindingMode::LaunchTicket) {
        GrantRecord matched;
        const Status grantStatus =
            ValidateGrantForAuthority(state, request, descriptor, session,
                                      &matched);
        if (grantStatus != Status::Ok) {
            return grantStatus;
        }
        grant = matched;
    }
    if (policy->bindingMode == BindingMode::LaunchTicket) {
        LaunchTicketRecord ticket;
        const Status ticketStatus =
            ValidateTicketForAuthority(state, request, descriptor, &ticket);
        if (ticketStatus != Status::Ok) {
            return ticketStatus;
        }
    }
    *token = AuthorizedCallToken(
        *policy, identityPtr, session, request.requestId, request.operationId,
        static_cast<std::uint64_t>(request.generation), grant, NewGuid());
    return Status::Ok;
}

Status AuthorizationEngine::AuthorizeLaunch(
    handle_t binding,
    const P13LaunchEnvelope &request,
    const AuthorityDescriptor &descriptor,
    IIdentityProvider &identityProvider,
    HarnessState &state,
    std::optional<AuthorizedCallToken> *token,
    std::wstring *diagnostic) {
    if (token == nullptr) {
        return Status::InternalError;
    }
    const Status validation = ValidateLaunchRequest(request, diagnostic);
    if (validation != Status::Ok) {
        return validation;
    }
    const OperationPolicy *policy = FindLaunchPolicy(request.operation);
    if (policy == nullptr || !PolicyAllows(*policy, descriptor, true) ||
        !EqualGuid(request.launchAuthorityId, descriptor.authorityId) ||
        static_cast<std::uint64_t>(request.authorityEpoch) != state.epoch) {
        return Status::OperationNotAllowed;
    }
    if (descriptor.launchTicketPermission == nullptr ||
        descriptor.launchTicketPermission[0] == L'\0') {
        return Status::TicketRejected;
    }
    CallerIdentityRecord identity;
    const Status identityStatus = identityProvider.Inspect(
        binding, SupervisorExpectation(), &identity, diagnostic);
    if (identityStatus != Status::Ok) {
        return identityStatus;
    }
    SessionRecord launchSession;
    launchSession.sessionId = request.launchSessionId;
    launchSession.authorityId = descriptor.authorityId;
    launchSession.authorityType = descriptor.launchAuthorityType;
    launchSession.principalClass = PrincipalClass::AuthoritySupervisor;
    launchSession.identity = identity;
    launchSession.epoch = static_cast<std::uint64_t>(request.authorityEpoch);
    if (request.operation != P13_LAUNCH_SESSION_REGISTER) {
        const auto record = state.launches.Find(request.launchSessionId);
        if (!record) {
            return Status::SessionNotFound;
        }
        if (record->authorityId != descriptor.authorityId) {
            return Status::AuthorityMismatch;
        }
        if (!EqualGuid(record->launchTicketId, request.launchTicketId) ||
            !EqualGuid(record->operationId, request.operationId) ||
            !EqualGuid(record->grantId, request.grantId) ||
            record->generation != static_cast<std::uint64_t>(request.generation) ||
            record->releaseDigest != ClaimedDigest(request.expectedReleaseDigest) ||
            record->epoch != static_cast<std::uint64_t>(request.authorityEpoch)) {
            return Status::Conflict;
        }
        launchSession.sessionId = record->launchSessionId;
    }
    if (policy->bindingMode == BindingMode::LaunchTicket) {
        LaunchTicketRecord ticket;
        const Status ticketStatus =
            ValidateLaunchTicket(state, request, descriptor, &ticket);
        if (ticketStatus != Status::Ok) {
            return ticketStatus;
        }
    }
    *token = AuthorizedCallToken(
        *policy, std::make_shared<CallerIdentityRecord>(identity), launchSession,
        request.requestId, request.operationId,
        static_cast<std::uint64_t>(request.generation), std::nullopt, NewGuid());
    return Status::Ok;
}

Status DispatchAuthority(const AuthorizedCallToken &authorized,
                         const P13AuthorityEnvelope &request,
                         P13Response *response) {
    HarnessState &state = GlobalHarnessState();
    if (authorized.policy().authorityOperation != request.operation ||
        !EqualGuid(authorized.requestId(), request.requestId)) {
        SetResponse(response, Status::InvalidCall,
                    L"authorized token does not match request");
        return Status::InvalidCall;
    }
    if (request.operation == P13_AUTH_SESSION_REGISTER) {
        const AuthorityDescriptor *descriptor = DescriptorForId(request.authorityId);
        if (descriptor == nullptr) {
            SetResponse(response, Status::AuthorityMismatch,
                        L"authority descriptor missing");
            return Status::AuthorityMismatch;
        }
        const auto registered = state.sessions.Register(
            *descriptor, authorized.identity(), state.epoch,
            NowUtc() + std::chrono::minutes(15));
        SetResponse(response, registered.status, registered.diagnostic,
                    registered.session.sessionId, {}, state.epoch);
        if (registered.status == Status::Ok) {
        state.effects.Record({request.requestId, request.operationId,
                                  registered.session.sessionId,
                                  static_cast<std::uint32_t>(request.operation),
                                  true, L"session registered"});
        }
        return registered.status;
    }
    if (request.operation == P13_AUTH_AUTHORITY_EPOCH_READ) {
        SetResponse(response, Status::Ok, L"authority epoch", {},
                    {}, state.epoch);
        return Status::Ok;
    }
    const SessionRecord session = authorized.session();
    if (request.operation == P13_AUTH_SESSION_HEARTBEAT) {
        SetResponse(response, Status::Ok, L"session heartbeat", session.sessionId,
                    {}, state.epoch);
        return Status::Ok;
    }
    if (request.operation == P13_AUTH_SESSION_CLOSE) {
        if (session.principalClass == PrincipalClass::WebService ||
            session.principalClass == PrincipalClass::WorkerService) {
            const Status status = state.sessions.CloseWebWorkerSession(
                session.sessionId);
            SetResponse(response, status, L"web/worker session closed",
                        session.sessionId, {}, state.epoch);
            return status;
        }
        const Status revoke = state.sessions.RequestRevoke(session.sessionId);
        SetResponse(response,
                    revoke == Status::Ok ? Status::EvidenceUnknown : revoke,
                    L"helper revoke requires Job/process/evidence proof",
                    session.sessionId, {}, state.epoch);
        return revoke == Status::Ok ? Status::EvidenceUnknown : revoke;
    }
    if (request.operation == P13_AUTH_OPERATION_REQUEST_GRANT) {
        const AuthorityDescriptor *descriptor = DescriptorForId(request.authorityId);
        if (descriptor == nullptr) {
            SetResponse(response, Status::AuthorityMismatch,
                        L"authority descriptor missing");
            return Status::AuthorityMismatch;
        }
        OperationRecord operation;
        operation.operationId = request.operationId;
        operation.ownerSessionId = session.sessionId;
        operation.authorityId = request.authorityId;
        operation.ownerPrincipal = session.principalClass;
        operation.generation = static_cast<std::uint64_t>(request.generation);
        operation.state = "CREATED";
        const Status opStatus = state.operations.Create(operation);
        if (opStatus != Status::Ok && opStatus != Status::Replay) {
            SetResponse(response, opStatus, L"operation creation failed");
            return opStatus;
        }
        GrantRecord grant;
        grant.grantId = NewGuid();
        grant.operationId = request.operationId;
        grant.audienceAuthorityId = request.authorityId;
        grant.sessionId = session.sessionId;
        grant.audiencePrincipal = session.principalClass;
        grant.helperType = descriptor->helperType;
        grant.action = request.action;
        grant.generation = static_cast<std::uint64_t>(request.generation);
        grant.expiresAt = NowUtc() + std::chrono::minutes(5);
        const auto requestHash = Sha256Bytes(
            reinterpret_cast<const unsigned char *>(&request.requestId),
            sizeof(request.requestId));
        if (requestHash.status != Status::Ok) {
            SetResponse(response, requestHash.status,
                        L"request hash failed");
            return requestHash.status;
        }
        grant.requestIdHash = requestHash.digest;
        const Status grantStatus = state.grants.Issue(grant);
        if (grantStatus == Status::Ok) {
            const Status operationStatus =
                state.operations.MarkGrantIssued(request.operationId, session);
            if (operationStatus != Status::Ok) {
                state.grants.Revoke(grant.grantId);
                SetResponse(response, operationStatus,
                            L"operation state update failed");
                return operationStatus;
            }
        }
        SetResponse(response, grantStatus,
                    grantStatus == Status::Ok ? L"test Grant issued"
                                               : L"Grant issue rejected",
                    session.sessionId, grant.grantId, state.epoch);
        if (grantStatus == Status::Ok) {
            state.effects.Record({request.requestId, request.operationId,
                                  session.sessionId,
                                  static_cast<std::uint32_t>(request.operation), true,
                                  L"grant issued"});
        }
        return grantStatus;
    }
    if (request.operation == P13_AUTH_OPERATION_STATUS_READ) {
        const auto operation = state.operations.Find(request.operationId);
        if (!operation) {
            SetResponse(response, Status::SessionNotFound,
                        L"operation not found");
            return Status::SessionNotFound;
        }
        SetResponse(response, Status::Ok, L"operation status", session.sessionId,
                    {}, state.epoch);
        return Status::Ok;
    }
    if (request.operation == P13_AUTH_OPERATION_CANCEL_BEFORE_GRANT) {
        const Status status =
            state.operations.CancelBeforeGrant(request.operationId, session);
        SetResponse(response, status, L"operation cancel result",
                    session.sessionId, {}, state.epoch);
        return status;
    }
    if (request.operation == P13_AUTH_HELPER_REGISTER) {
        const auto ticket = state.tickets.Find(request.launchTicketId);
        if (!ticket) {
            SetResponse(response, Status::TicketRejected, L"launch ticket missing");
            return Status::TicketRejected;
        }
        const auto ticketDigest = ticket->releaseDigest;
        LaunchTicketRecord consumed;
        const Status bindStatus = state.tickets.Consume(
            request.launchTicketId, request.authorityId,
            session.principalClass,
            DescriptorForId(request.authorityId)->helperType,
            static_cast<std::uint64_t>(request.generation),
            ticketDigest, NowUtc(), &consumed);
        if (bindStatus != Status::Ok) {
            SetResponse(response, bindStatus, L"launch ticket rejected");
            return bindStatus;
        }
        const Status reserve = state.grants.Reserve(request.grantId, session);
        const Status sessionBind =
            state.sessions.BindLaunchSession(session.sessionId,
                                             request.launchSessionId);
        const Status status =
            reserve == Status::Ok && sessionBind == Status::Ok
                ? Status::Ok
                : Status::GrantRejected;
        SetResponse(response, status, L"helper registration result",
                    session.sessionId, {}, state.epoch);
        return status;
    }
    if (request.operation == P13_AUTH_HELPER_HEARTBEAT) {
        SetResponse(response, Status::Ok, L"helper heartbeat",
                    session.sessionId, {}, state.epoch);
        return Status::Ok;
    }
    if (request.operation == P13_AUTH_HELPER_EFFECT_COMMITTED) {
        const Status status = state.grants.MarkEffect(request.grantId);
        SetResponse(response, status,
                    status == Status::Ok
                        ? L"helper effect signal recorded"
                        : L"helper effect rejected",
                    session.sessionId, request.operationId, state.epoch);
        return status;
    }
    if (request.operation == P13_AUTH_HELPER_EXIT_NOTICE) {
        state.grants.Revoke(request.grantId);
        state.sessions.RequestRevoke(session.sessionId);
        SetResponse(response, Status::EvidenceUnknown,
                    L"helper exit notice requires process/Job/evidence proof",
                    session.sessionId, {}, state.epoch);
        return Status::EvidenceUnknown;
    }
    if (request.operation == P13_AUTH_GRANT_STATUS_READ) {
        const auto grant = state.grants.Find(request.grantId);
        if (!grant) {
            SetResponse(response, Status::GrantRejected, L"Grant not found");
            return Status::GrantRejected;
        }
        SetResponse(response, Status::Ok, L"Grant status", session.sessionId,
                    grant->grantId, state.epoch);
        return Status::Ok;
    }
    if (request.operation == P13_AUTH_PROCESS_STATE_READ) {
        const HANDLE process = authorized.identity().processHandle->get();
        if (process == nullptr || WaitForSingleObject(process, 0) != WAIT_TIMEOUT) {
            SetResponse(response, Status::SessionNotFound,
                        L"caller process is not active");
            return Status::SessionNotFound;
        }
        SetResponse(response, Status::Ok, L"caller process active",
                    session.sessionId, {}, state.epoch);
        return Status::Ok;
    }
    SetResponse(response, Status::OperationNotAllowed,
                L"operation is not implemented");
    return Status::OperationNotAllowed;
}

Status DispatchLaunch(const AuthorizedCallToken &authorized,
                      const P13LaunchEnvelope &request,
                      P13Response *response) {
    HarnessState &state = GlobalHarnessState();
    if (authorized.policy().launchOperation != request.operation ||
        !EqualGuid(authorized.requestId(), request.requestId)) {
        SetResponse(response, Status::InvalidCall,
                    L"authorized launch token does not match request");
        return Status::InvalidCall;
    }
    if (request.operation == P13_LAUNCH_SESSION_REGISTER) {
        const auto ticket = state.tickets.Find(request.launchTicketId);
        if (!ticket || ticket->consumed || ticket->revoked ||
            ticket->expiresAt <= NowUtc() ||
            !EqualGuid(ticket->authorityId, request.launchAuthorityId) ||
            !EqualGuid(ticket->operationId, request.operationId) ||
            !EqualGuid(ticket->grantId, request.grantId) ||
            ticket->generation != static_cast<std::uint64_t>(request.generation) ||
            ticket->releaseDigest != ClaimedDigest(request.expectedReleaseDigest) ||
            ticket->helperPrincipal !=
                DescriptorForId(request.launchAuthorityId)->principalClass) {
            SetResponse(response, Status::TicketRejected,
                        L"launch ticket rejected");
            return Status::TicketRejected;
        }
        LaunchRecord record;
        record.launchSessionId = request.launchSessionId;
        record.launchTicketId = request.launchTicketId;
        record.operationId = request.operationId;
        record.grantId = request.grantId;
        record.authorityId = request.launchAuthorityId;
        record.helperPrincipal =
            DescriptorForId(request.launchAuthorityId)->principalClass;
        record.generation = static_cast<std::uint64_t>(request.generation);
        record.releaseDigest = ClaimedDigest(request.expectedReleaseDigest);
        record.epoch = static_cast<std::uint64_t>(request.authorityEpoch);
        const Status status = state.launches.RegisterSession(record);
        SetResponse(response, status, L"launch session registered",
                    request.launchSessionId, {}, state.epoch);
        return status;
    }
    if (request.operation == P13_LAUNCH_PREPARE) {
        LaunchTicketRecord ticket;
        const Status ticketStatus = state.tickets.Consume(
            request.launchTicketId, request.launchAuthorityId,
            DescriptorForId(request.launchAuthorityId)->principalClass,
            DescriptorForId(request.launchAuthorityId)->helperType,
            static_cast<std::uint64_t>(request.generation),
            ClaimedDigest(request.expectedReleaseDigest), NowUtc(), &ticket);
        if (ticketStatus != Status::Ok) {
            SetResponse(response, ticketStatus, L"launch ticket rejected");
            return ticketStatus;
        }
        Status status = state.launches.Transition(
            request.launchSessionId, LaunchState::New,
            LaunchState::TicketAccepted);
        if (status == Status::Ok) {
            status = state.launches.Transition(
                request.launchSessionId, LaunchState::TicketAccepted,
                LaunchState::PreparedSuspended);
        }
        SetResponse(response, status, L"launch prepared", request.launchSessionId,
                    {}, state.epoch);
        return status;
    }
    if (request.operation == P13_LAUNCH_COMMIT) {
        const auto record = state.launches.Find(request.launchSessionId);
        const Status status =
            record && record->launchState == LaunchState::HandlesTransferred
                ? state.launches.Transition(
                      request.launchSessionId, LaunchState::HandlesTransferred,
                      LaunchState::Committed)
                : Status::InvalidTransition;
        SetResponse(response, status, L"launch committed",
                    request.launchSessionId, {}, state.epoch);
        return status;
    }
    if (request.operation == P13_LAUNCH_ABORT) {
        const auto record = state.launches.Find(request.launchSessionId);
        if (!record) {
            SetResponse(response, Status::SessionNotFound, L"launch not found");
            return Status::SessionNotFound;
        }
        Status status = Status::InvalidTransition;
        switch (record->launchState) {
            case LaunchState::New:
                status = state.launches.Transition(
                    request.launchSessionId, LaunchState::New,
                    LaunchState::Aborted);
                break;
            case LaunchState::TicketAccepted:
                status = state.launches.Transition(
                    request.launchSessionId, LaunchState::TicketAccepted,
                    LaunchState::Aborted);
                break;
            case LaunchState::PreparedSuspended:
                status = state.launches.Transition(
                    request.launchSessionId, LaunchState::PreparedSuspended,
                    LaunchState::Aborted);
                break;
            default:
                status = Status::InvalidTransition;
                break;
        }
        SetResponse(response, status, L"launch abort", request.launchSessionId,
                    {}, state.epoch);
        return status;
    }
    if (request.operation == P13_LAUNCH_STATUS_READ) {
        const auto record = state.launches.Find(request.launchSessionId);
        if (!record) {
            SetResponse(response, Status::SessionNotFound, L"launch not found");
            return Status::SessionNotFound;
        }
        SetResponse(response, Status::Ok, L"launch status",
                    request.launchSessionId, {}, state.epoch);
        return Status::Ok;
    }
    if (request.operation == P13_LAUNCH_SESSION_CLOSE) {
        const Status status = state.launches.Close(request.launchSessionId);
        SetResponse(response, status,
                    status == Status::Ok ? L"launch closed"
                                         : L"launch close requires proof",
                    request.launchSessionId, {}, state.epoch);
        return status;
    }
    SetResponse(response, Status::OperationNotAllowed,
                L"launch operation not implemented");
    return Status::OperationNotAllowed;
}

}  // namespace p13::harness

