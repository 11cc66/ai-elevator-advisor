#pragma once

#include "common/p13_types.h"

#include <string>
#include <vector>

namespace p13::harness {

struct SuspendedProcessPlan {
    HANDLE baseHelperToken{nullptr};
    std::wstring applicationPath;
    std::wstring commandLine;
    std::wstring workingDirectory;
    std::wstring environmentBlock;
    std::wstring restrictingSid;
};

struct LaunchHandles {
    UniqueHandle job;
    UniqueHandle process;
    UniqueHandle thread;
    DWORD processId{0};
    std::uint64_t creationTime{0};
};

struct TransferredHandles {
    HANDLE job{nullptr};
    HANDLE process{nullptr};
    HANDLE thread{nullptr};
};

struct LaunchResult {
    Status status{Status::InternalError};
    LaunchHandles handles;
    std::wstring diagnostic;
};

Status CreateRestrictedHelperToken(HANDLE baseToken,
                                   const std::wstring &restrictingSid,
                                   UniqueHandle *restrictedToken,
                                   std::wstring *diagnostic);
LaunchResult CreateAndAssociateSuspendedHelper(const SuspendedProcessPlan &plan);
Status TransferHandlesToSupervisor(HANDLE supervisorProcess,
                                  LaunchHandles *source,
                                  TransferredHandles *target,
                                  std::wstring *diagnostic);
Status ResumeSuspendedHelper(HANDLE thread, std::wstring *diagnostic);
Status ConfirmJobMembership(HANDLE job, HANDLE process);
Status RevokeAndWait(HANDLE job,
                     HANDLE process,
                     DWORD timeoutMs,
                     std::wstring *diagnostic);

class IProcessControl {
public:
    virtual ~IProcessControl() = default;
    virtual Status CloseJob(HANDLE *job) = 0;
    virtual Status WaitProcess(HANDLE process, DWORD timeoutMs) = 0;
    virtual Status TerminateProcessSafe(HANDLE process) = 0;
};

class WindowsProcessControl final : public IProcessControl {
public:
    Status CloseJob(HANDLE *job) override;
    Status WaitProcess(HANDLE process, DWORD timeoutMs) override;
    Status TerminateProcessSafe(HANDLE process) override;
};

Status RunRevokeOrchestrator(HANDLE *job,
                             HANDLE process,
                             IProcessControl &control,
                             LaunchRecord *launch,
                             std::wstring *diagnostic);

struct SealedPolicy {
    std::wstring canonicalOwnerSid;
    std::wstring guardianSid;
    std::wstring supervisorSid;
};

Status BuildProtectedCanonicalDescriptor(const SealedPolicy &policy,
                                         std::vector<unsigned char> *descriptorBytes,
                                         std::wstring *diagnostic);
Status RunAccessCheckAdapter(HANDLE token,
                             const void *securityDescriptor,
                             DWORD desiredAccess,
                             DWORD *grantedAccess,
                             std::wstring *diagnostic);
Status EvaluateSealedEvidence(const EvidenceRecord &helperEffect,
                              const EvidenceRecord &supervisorVerification,
                              EvidenceState *state,
                              std::wstring *diagnostic);

}  // namespace p13::harness

