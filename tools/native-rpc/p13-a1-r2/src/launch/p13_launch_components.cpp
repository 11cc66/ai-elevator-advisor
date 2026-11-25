#include "launch/p13_launch_components.h"

#include <cwchar>

namespace p13::harness {
namespace {

bool AllowedLaunchTransition(LaunchState from, LaunchState to) {
    switch (from) {
        case LaunchState::New:
            return to == LaunchState::TicketAccepted ||
                   to == LaunchState::Aborted || to == LaunchState::Unknown;
        case LaunchState::TicketAccepted:
            return to == LaunchState::PreparedSuspended ||
                   to == LaunchState::Aborted || to == LaunchState::Unknown;
        case LaunchState::PreparedSuspended:
            return to == LaunchState::HandlesTransferred ||
                   to == LaunchState::Aborted || to == LaunchState::Unknown;
        case LaunchState::HandlesTransferred:
            return to == LaunchState::Committed || to == LaunchState::Unknown;
        case LaunchState::Committed:
            return to == LaunchState::Running ||
                   to == LaunchState::RevokeRequested ||
                   to == LaunchState::Unknown;
        case LaunchState::Running:
            return to == LaunchState::RevokeRequested ||
                   to == LaunchState::Unknown;
        case LaunchState::RevokeRequested:
            return to == LaunchState::JobCloseRequested ||
                   to == LaunchState::Unknown;
        case LaunchState::JobCloseRequested:
            return to == LaunchState::ProcessSignaled ||
                   to == LaunchState::Unknown || to == LaunchState::Quarantined;
        case LaunchState::ProcessSignaled:
            return to == LaunchState::HandlesClosed || to == LaunchState::Unknown;
        case LaunchState::HandlesClosed:
            return to == LaunchState::EvidenceReconciling ||
                   to == LaunchState::Unknown;
        case LaunchState::EvidenceReconciling:
            return to == LaunchState::Closed || to == LaunchState::Unknown ||
                   to == LaunchState::Quarantined;
        case LaunchState::Unknown:
            return to == LaunchState::EvidenceReconciling ||
                   to == LaunchState::Quarantined;
        case LaunchState::Closed:
        case LaunchState::Aborted:
        case LaunchState::Quarantined:
            return false;
    }
    return false;
}

}  // namespace

Status TestTicketStore::Issue(const LaunchTicketRecord &ticket) {
    if (IsZeroGuid(ticket.launchTicketId) ||
        IsZeroGuid(ticket.authorityId) ||
        IsZeroGuid(ticket.operationId) ||
        IsZeroGuid(ticket.grantId) || ticket.helperType.empty() ||
        ticket.expiresAt <= NowUtc()) {
        return Status::TicketRejected;
    }
    std::scoped_lock lock(mutex_);
    const auto key = GuidToString(ticket.launchTicketId);
    if (tickets_.contains(key)) {
        return Status::Conflict;
    }
    tickets_[key] = ticket;
    return Status::Ok;
}

std::optional<LaunchTicketRecord> TestTicketStore::Find(
    const GUID &ticketId) const {
    std::scoped_lock lock(mutex_);
    const auto found = tickets_.find(GuidToString(ticketId));
    return found == tickets_.end()
               ? std::nullopt
               : std::optional<LaunchTicketRecord>(found->second);
}

Status TestTicketStore::Consume(
    const GUID &ticketId,
    const GUID &authorityId,
    PrincipalClass helperPrincipal,
    std::string_view helperType,
    std::uint64_t generation,
    const std::array<unsigned char, 32> &releaseDigest,
    std::chrono::system_clock::time_point now,
    LaunchTicketRecord *ticketOut) {
    std::scoped_lock lock(mutex_);
    const auto found = tickets_.find(GuidToString(ticketId));
    if (found == tickets_.end()) {
        return Status::TicketRejected;
    }
    LaunchTicketRecord &ticket = found->second;
    if (ticket.revoked || ticket.consumed) {
        return ticket.consumed ? Status::TicketConsumed : Status::TicketRejected;
    }
    if (ticket.expiresAt <= now) {
        return Status::TicketExpired;
    }
    if (!EqualGuid(ticket.authorityId, authorityId) ||
        ticket.helperPrincipal != helperPrincipal ||
        ticket.helperType != helperType || ticket.generation != generation ||
        ticket.releaseDigest != releaseDigest) {
        return Status::TicketRejected;
    }
    ticket.consumed = true;
    if (ticketOut != nullptr) {
        *ticketOut = ticket;
    }
    return Status::Ok;
}

Status TestTicketStore::Revoke(const GUID &ticketId) {
    std::scoped_lock lock(mutex_);
    const auto found = tickets_.find(GuidToString(ticketId));
    if (found == tickets_.end()) {
        return Status::TicketRejected;
    }
    found->second.revoked = true;
    return Status::Ok;
}

Status TestLaunchStore::RegisterSession(const LaunchRecord &record) {
    if (IsZeroGuid(record.launchSessionId) ||
        IsZeroGuid(record.launchTicketId) ||
        IsZeroGuid(record.authorityId) ||
        IsZeroGuid(record.operationId) || IsZeroGuid(record.grantId)) {
        return Status::InvalidCall;
    }
    std::scoped_lock lock(mutex_);
    const auto key = GuidToString(record.launchSessionId);
    if (records_.contains(key)) {
        return Status::Conflict;
    }
    LaunchRecord created = record;
    created.launchState = LaunchState::New;
    created.revision = 1;
    records_[key] = created;
    return Status::Ok;
}

std::optional<LaunchRecord> TestLaunchStore::Find(
    const GUID &launchSessionId) const {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    return found == records_.end()
               ? std::nullopt
               : std::optional<LaunchRecord>(found->second);
}

Status TestLaunchStore::Transition(const GUID &launchSessionId,
                                   LaunchState expected,
                                   LaunchState target) {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    if (found == records_.end()) {
        return Status::SessionNotFound;
    }
    LaunchRecord &record = found->second;
    if (record.launchState != expected ||
        !AllowedLaunchTransition(expected, target)) {
        return Status::InvalidTransition;
    }
    record.launchState = target;
    ++record.revision;
    return Status::Ok;
}

Status TestLaunchStore::UpdateSubstate(
    const GUID &launchSessionId,
    std::optional<ProcessState> processState,
    std::optional<JobState> jobState,
    std::optional<GrantState> grantState,
    std::optional<EvidenceState> evidenceState) {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    if (found == records_.end()) {
        return Status::SessionNotFound;
    }
    LaunchRecord &record = found->second;
    if (record.launchState == LaunchState::Closed ||
        record.launchState == LaunchState::Quarantined) {
        return Status::InvalidTransition;
    }
    if (processState) {
        record.processState = *processState;
    }
    if (jobState) {
        record.jobState = *jobState;
    }
    if (grantState) {
        record.grantState = *grantState;
    }
    if (evidenceState) {
        record.evidenceState = *evidenceState;
    }
    ++record.revision;
    return Status::Ok;
}

Status TestLaunchStore::MarkProcessSignaled(const GUID &launchSessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    if (found == records_.end()) {
        return Status::SessionNotFound;
    }
    found->second.processState = ProcessState::Signaled;
    found->second.processSignaled = true;
    ++found->second.revision;
    return Status::Ok;
}

Status TestLaunchStore::MarkHandlesClosed(const GUID &launchSessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    if (found == records_.end() || !found->second.processSignaled) {
        return Status::InvalidTransition;
    }
    found->second.handlesClosed = true;
    found->second.supervisorOwnsFinalHandles = false;
    found->second.jobState = JobState::Closed;
    ++found->second.revision;
    return Status::Ok;
}

Status TestLaunchStore::MarkEvidenceReconciling(
    const GUID &launchSessionId,
    EvidenceState evidenceState) {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    if (found == records_.end() || !found->second.handlesClosed ||
        evidenceState != EvidenceState::Matched) {
        return Status::InvalidTransition;
    }
    found->second.evidenceState = evidenceState;
    found->second.evidenceReconciled = true;
    ++found->second.revision;
    return Status::Ok;
}

Status TestLaunchStore::Close(const GUID &launchSessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    if (found == records_.end()) {
        return Status::SessionNotFound;
    }
    LaunchRecord &record = found->second;
    if (record.launchState != LaunchState::EvidenceReconciling ||
        !record.processSignaled || !record.handlesClosed ||
        !record.evidenceReconciled ||
        record.evidenceState != EvidenceState::Matched) {
        record.launchState = LaunchState::Unknown;
        ++record.revision;
        return Status::EvidenceUnknown;
    }
    record.launchState = LaunchState::Closed;
    ++record.revision;
    return Status::Ok;
}

Status TestLaunchStore::Quarantine(const GUID &launchSessionId) {
    std::scoped_lock lock(mutex_);
    const auto found = records_.find(GuidToString(launchSessionId));
    if (found == records_.end()) {
        return Status::SessionNotFound;
    }
    LaunchRecord &record = found->second;
    if (record.launchState != LaunchState::Unknown &&
        record.launchState != LaunchState::JobCloseRequested &&
        record.launchState != LaunchState::EvidenceReconciling) {
        return Status::InvalidTransition;
    }
    record.launchState = LaunchState::Quarantined;
    ++record.revision;
    return Status::Ok;
}

}  // namespace p13::harness

