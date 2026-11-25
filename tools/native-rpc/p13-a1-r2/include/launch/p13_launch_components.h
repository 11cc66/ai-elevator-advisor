#pragma once

#include "common/p13_types.h"

#include <mutex>
#include <optional>
#include <unordered_map>

namespace p13::harness {

class TestTicketStore {
public:
    Status Issue(const LaunchTicketRecord &ticket);
    std::optional<LaunchTicketRecord> Find(const GUID &ticketId) const;
    Status Consume(const GUID &ticketId,
                   const GUID &authorityId,
                   PrincipalClass helperPrincipal,
                   std::string_view helperType,
                   std::uint64_t generation,
                   const std::array<unsigned char, 32> &releaseDigest,
                   std::chrono::system_clock::time_point now,
                   LaunchTicketRecord *ticketOut);
    Status Revoke(const GUID &ticketId);

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::wstring, LaunchTicketRecord> tickets_;
};

class TestLaunchStore {
public:
    Status RegisterSession(const LaunchRecord &record);
    std::optional<LaunchRecord> Find(const GUID &launchSessionId) const;
    Status Transition(const GUID &launchSessionId,
                      LaunchState expected,
                      LaunchState target);
    Status UpdateSubstate(const GUID &launchSessionId,
                          std::optional<ProcessState> processState,
                          std::optional<JobState> jobState,
                          std::optional<GrantState> grantState,
                          std::optional<EvidenceState> evidenceState);
    Status MarkProcessSignaled(const GUID &launchSessionId);
    Status MarkHandlesClosed(const GUID &launchSessionId);
    Status MarkEvidenceReconciling(const GUID &launchSessionId,
                                   EvidenceState evidenceState);
    Status Close(const GUID &launchSessionId);
    Status Quarantine(const GUID &launchSessionId);

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::wstring, LaunchRecord> records_;
};

}  // namespace p13::harness

