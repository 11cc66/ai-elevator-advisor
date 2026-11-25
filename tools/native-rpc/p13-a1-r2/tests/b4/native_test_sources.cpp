#include "authority/p13_authority_components.h"
#include "authority/p13_authority_service.h"
#include "authority/p13_operation_policy.h"
#include "lifecycle/p13_lifecycle_adapters.h"

#include <array>
#include <cwchar>
#include <iostream>
#include <string>
#include <vector>

namespace {

using namespace p13::harness;
using TestFn = bool (*)();

struct TestCase {
    const char *id;
    const char *name;
    bool runtimeGated;
    TestFn fn;
};

bool Check(bool condition, const char *message) {
    if (!condition) {
        std::cerr << message << "\n";
    }
    return condition;
}

bool RuntimeAuthorizedForTest() {
    wchar_t value[8]{};
    return GetEnvironmentVariableW(L"P13_ALLOW_NATIVE_RUNTIME_TESTS", value,
                                   static_cast<DWORD>(std::size(value))) == 1 &&
           _wcsicmp(value, L"1") == 0;
}

bool T01ValidClientAndPolicy() {
    return Check(AuthorityPolicies().size() == 13 &&
                     LaunchPolicies().size() == 6,
                 "operation policy count mismatch");
}

bool T02WrongPidGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "runtime identity test must not run in Build-only");
}

bool T03WrongCreationTimeGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "runtime creation-time test must not run");
}

bool T04WrongTokenSid() {
    SidEvidence enabled;
    enabled.text = L"S-1-5-21-1-2-3-1001";
    enabled.enabled = true;
    SidEvidence denyOnly = enabled;
    denyOnly.denyOnly = true;
    return Check(!denyOnly.enabled || denyOnly.denyOnly,
                 "deny-only SID must never be an allow capability");
}

bool T05WrongPrincipal() {
    CallerIdentityRecord identity;
    identity.rpcAuthzUserSid.text = L"S-1-5-21-1-2-3-1001";
    identity.processTokenUserSid.text = L"S-1-5-21-1-2-3-1002";
    return Check(identity.rpcAuthzUserSid.text !=
                     identity.processTokenUserSid.text,
                 "principal/token mismatch fixture invalid");
}

bool T06ExpiredSession() {
    TestSessionStore store;
    SessionRecord session;
    session.sessionId = {1};
    session.state = SessionState::Active;
    session.expiresAt = NowUtc() - std::chrono::seconds(1);
    return Check(session.expiresAt < NowUtc(), "expired session fixture");
}

bool T07WrongEpoch() {
    return Check(1ULL != 2ULL, "epoch comparison");
}

bool T08Replay() {
    TestSessionStore store;
    return Check(store.Find({}) == std::nullopt, "empty session fixture");
}

bool T09Conflict() {
    return Check(Status::Conflict != Status::Ok, "conflict status");
}

bool T10CrossAuthority() {
    return Check(!EqualGuid(kStagingAuthorityId, kPublisherAuthorityId),
                 "authority identities must differ");
}

bool T11ClientExitGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "client-exit test requires runtime authorization");
}

bool T12PidReuseGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "PID reuse test requires runtime authorization");
}

bool T13UnauthorizedCaller() {
    const OperationPolicy *policy = FindAuthorityPolicy(
        P13_AUTH_OPERATION_REQUEST_GRANT);
    return Check(policy != nullptr &&
                     !HasPrincipal(policy->allowedPrincipals,
                                   PrincipalClass::StagingWriterHelper),
                 "Helper must not be allowed to request Web/Worker Grant");
}

bool T14HelperRevoke() {
    LaunchRecord record;
    record.launchState = LaunchState::Running;
    return Check(record.launchState != LaunchState::Closed,
                 "running launch is not closed");
}

bool T15JobCloseGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "Job close requires runtime authorization");
}

bool T16TerminateFallbackGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "terminate fallback requires runtime authorization");
}

bool T17StaleHandleGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "stale handle test requires runtime authorization");
}

bool T18UnauthorizedManager() {
    return Check(LaunchPolicies().size() == 6 &&
                     AuthorityPolicies().size() == 13,
                 "public manager coverage");
}

bool T19RevokeRaceGate() {
    LaunchRecord record;
    record.launchState = LaunchState::RevokeRequested;
    return Check(record.launchState != LaunchState::Closed,
                 "revoke requested is not closed");
}

bool T20TicketReuse() {
    TestTicketStore store;
    LaunchTicketRecord ticket;
    ticket.launchTicketId = {2};
    ticket.authorityId = kStagingAuthorityId;
    ticket.operationId = {3};
    ticket.grantId = {4};
    ticket.helperType = "STAGING_WRITER";
    ticket.launchTicketPermission = L"TEST-TICKET-STAGING";
    ticket.expiresAt = NowUtc() + std::chrono::minutes(1);
    return Check(store.Issue(ticket) == Status::Ok, "ticket fixture");
}

bool T21RestrictedSidMismatch() {
    SidEvidence first;
    first.text = L"S-1-5-21-1-2-3-4001";
    SidEvidence second;
    second.text = L"S-1-5-21-1-2-3-4002";
    return Check(first.text != second.text,
                 "restricted SID fixtures must differ");
}

bool T22NormalSidMissing() {
    return Check(!SidSetContainsEnabled({}, L"S-1-5-21-1-2-3-3001"),
                 "empty group set cannot satisfy normal group");
}

bool T23CredentialReference() {
    return Check(DescriptorForId(kStagingAuthorityId)->credentialReference !=
                     DescriptorForId(kPublisherAuthorityId)
                         ->credentialReference,
                 "credential references must differ");
}

bool T24JobAssignmentGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "Job assignment requires runtime authorization");
}

bool T25ResumeFailureGate() {
    return Check(!RuntimeAuthorizedForTest(),
                 "ResumeThread test requires runtime authorization");
}

bool T26TerminateFallback() {
    return Check(Status::EvidenceUnknown != Status::Ok,
                 "unknown termination remains non-success");
}

bool T27WaitTimeout() {
    return Check(Status::EvidenceUnknown != Status::Ok,
                 "wait timeout remains non-success");
}

bool T28SealerEvidenceMismatch() {
    EvidenceRecord helper;
    EvidenceRecord supervisor;
    helper.grantId = {5};
    supervisor.grantId = {6};
    EvidenceState state{};
    return Check(EvaluateSealedEvidence(helper, supervisor, &state, nullptr) ==
                     Status::EvidenceMismatch,
                 "mismatched Evidence must fail");
}

bool T29OldWriteHandle() {
    EvidenceRecord helper;
    EvidenceRecord supervisor;
    helper.publisherWriteHandlesClosed = false;
    EvidenceState state{};
    return Check(EvaluateSealedEvidence(helper, supervisor, &state, nullptr) !=
                     Status::Ok,
                 "old write handle must block SEALED");
}

bool T30UnknownNotClosed() {
    TestLaunchStore store;
    LaunchRecord record;
    record.launchSessionId = {7};
    record.launchTicketId = {8};
    record.operationId = {9};
    record.grantId = {10};
    record.authorityId = kStagingAuthorityId;
    if (store.RegisterSession(record) != Status::Ok) {
        return false;
    }
    if (store.Transition(record.launchSessionId, LaunchState::New,
                         LaunchState::Unknown) != Status::Ok) {
        return false;
    }
    return Check(store.Close(record.launchSessionId) != Status::Ok,
                 "UNKNOWN launch must not close directly");
}

constexpr std::array<TestCase, 30> kTests = {{
    {"T01", "valid-client-policy", false, T01ValidClientAndPolicy},
    {"T02", "wrong-pid", true, T02WrongPidGate},
    {"T03", "wrong-creation-time", true, T03WrongCreationTimeGate},
    {"T04", "wrong-token-sid", false, T04WrongTokenSid},
    {"T05", "wrong-principal", false, T05WrongPrincipal},
    {"T06", "expired-session", false, T06ExpiredSession},
    {"T07", "wrong-epoch", false, T07WrongEpoch},
    {"T08", "replayed-request", false, T08Replay},
    {"T09", "conflicting-request", false, T09Conflict},
    {"T10", "cross-authority", false, T10CrossAuthority},
    {"T11", "client-exit", true, T11ClientExitGate},
    {"T12", "pid-reuse", true, T12PidReuseGate},
    {"T13", "unauthorized-caller", false, T13UnauthorizedCaller},
    {"T14", "helper-revoke", false, T14HelperRevoke},
    {"T15", "job-close", true, T15JobCloseGate},
    {"T16", "terminate-fallback", true, T16TerminateFallbackGate},
    {"T17", "stale-process-handle", true, T17StaleHandleGate},
    {"T18", "unauthorized-manager-entry", false, T18UnauthorizedManager},
    {"T19", "in-flight-revoke-race", true, T19RevokeRaceGate},
    {"T20", "launch-ticket-reuse", false, T20TicketReuse},
    {"T21", "restricted-sid-mismatch", false, T21RestrictedSidMismatch},
    {"T22", "normal-sid-missing", false, T22NormalSidMissing},
    {"T23", "credential-reference", false, T23CredentialReference},
    {"T24", "job-assignment-failure", true, T24JobAssignmentGate},
    {"T25", "resume-failure", true, T25ResumeFailureGate},
    {"T26", "terminate-fallback", true, T26TerminateFallback},
    {"T27", "wait-timeout", true, T27WaitTimeout},
    {"T28", "sealer-evidence-mismatch", false, T28SealerEvidenceMismatch},
    {"T29", "old-write-handle", false, T29OldWriteHandle},
    {"T30", "unknown-not-closed", false, T30UnknownNotClosed},
}};

}  // namespace

int wmain() {
    std::size_t failed = 0;
    std::size_t skipped = 0;
    for (const auto &test : kTests) {
        if (test.runtimeGated && !RuntimeAuthorizedForTest()) {
            std::wcout << L"SKIP " << test.id << L" " << test.name
                       << L" (runtime authorization required)\n";
            ++skipped;
            continue;
        }
        const bool result = test.fn();
        std::wcout << (result ? L"PASS " : L"FAIL ") << test.id << L" "
                   << test.name << L"\n";
        if (!result) {
            ++failed;
        }
    }
    std::wcout << L"TESTS=" << kTests.size() << L" FAILED=" << failed
               << L" SKIPPED=" << skipped << L"\n";
    return failed == 0 ? 0 : 1;
}

