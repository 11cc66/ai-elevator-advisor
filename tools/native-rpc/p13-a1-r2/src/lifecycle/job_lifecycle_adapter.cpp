#include "lifecycle/p13_lifecycle_adapters.h"

#include <algorithm>
#include <vector>

namespace p13::harness {
namespace {

std::wstring Win32Message(DWORD error) {
    wchar_t *buffer = nullptr;
    const DWORD flags = FORMAT_MESSAGE_ALLOCATE_BUFFER |
                        FORMAT_MESSAGE_FROM_SYSTEM |
                        FORMAT_MESSAGE_IGNORE_INSERTS;
    const DWORD length =
        FormatMessageW(flags, nullptr, error, 0,
                       reinterpret_cast<LPWSTR>(&buffer), 0, nullptr);
    std::wstring message;
    if (length != 0 && buffer != nullptr) {
        message.assign(buffer, length);
    }
    if (buffer != nullptr) {
        LocalFree(buffer);
    }
    return message;
}

bool ReadCreationTime(HANDLE process, std::uint64_t *value) {
    FILETIME creation{};
    FILETIME exit{};
    FILETIME kernel{};
    FILETIME user{};
    if (!GetProcessTimes(process, &creation, &exit, &kernel, &user)) {
        return false;
    }
    ULARGE_INTEGER combined{};
    combined.LowPart = creation.dwLowDateTime;
    combined.HighPart = creation.dwHighDateTime;
    *value = combined.QuadPart;
    return true;
}

void CloseTargetHandle(HANDLE targetProcess, HANDLE targetHandle) {
    if (targetProcess == nullptr || targetHandle == nullptr) {
        return;
    }
    HANDLE local = nullptr;
    DuplicateHandle(targetProcess, targetHandle, GetCurrentProcess(), &local,
                    0, FALSE, DUPLICATE_CLOSE_SOURCE);
    if (local != nullptr) {
        CloseHandle(local);
    }
}

}  // namespace

Status CreateRestrictedHelperToken(HANDLE baseToken,
                                   const std::wstring &restrictingSid,
                                   UniqueHandle *restrictedToken,
                                   std::wstring *diagnostic) {
    if (baseToken == nullptr || restrictedToken == nullptr ||
        restrictingSid.empty()) {
        return Status::InvalidCall;
    }
    PSID sid = nullptr;
    if (!ConvertStringSidToSidW(restrictingSid.c_str(), &sid)) {
        if (diagnostic != nullptr) {
            *diagnostic = L"restricting SID is invalid";
        }
        return Status::InvalidCall;
    }
    HANDLE restricted = nullptr;
    SID_AND_ATTRIBUTES restrictedSid{};
    restrictedSid.Sid = sid;
    restrictedSid.Attributes = 0;
    const BOOL created = CreateRestrictedToken(
        baseToken, DISABLE_MAX_PRIVILEGE, 0, nullptr, 0, nullptr, 1,
        &restrictedSid, &restricted);
    LocalFree(sid);
    if (!created || restricted == nullptr) {
        if (diagnostic != nullptr) {
            *diagnostic = L"CreateRestrictedToken failed: " +
                          Win32Message(GetLastError());
        }
        return Status::IdentityMismatch;
    }
    restrictedToken->reset(restricted);
    if (diagnostic != nullptr) {
        *diagnostic = L"restricted Helper primary token created";
    }
    return Status::Ok;
}

LaunchResult CreateAndAssociateSuspendedHelper(const SuspendedProcessPlan &plan) {
    LaunchResult result;
    UniqueHandle restrictedToken;
    std::wstring diagnostic;
    const Status tokenStatus = CreateRestrictedHelperToken(
        plan.baseHelperToken, plan.restrictingSid, &restrictedToken, &diagnostic);
    if (tokenStatus != Status::Ok) {
        result.status = tokenStatus;
        result.diagnostic = diagnostic;
        return result;
    }
    if (plan.applicationPath.empty() || plan.commandLine.empty() ||
        plan.workingDirectory.empty()) {
        result.status = Status::InvalidCall;
        result.diagnostic = L"incomplete fixed Helper launch plan";
        return result;
    }

    UniqueHandle job(CreateJobObjectW(nullptr, nullptr));
    if (!job) {
        result.diagnostic =
            L"CreateJobObjectW failed: " + Win32Message(GetLastError());
        return result;
    }
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags =
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE |
        JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
    limits.BasicLimitInformation.ActiveProcessLimit = 1;
    if (!SetInformationJobObject(job.get(), JobObjectExtendedLimitInformation,
                                 &limits, sizeof(limits))) {
        result.diagnostic =
            L"SetInformationJobObject failed: " + Win32Message(GetLastError());
        return result;
    }

    SIZE_T attributeBytes = 0;
    InitializeProcThreadAttributeList(nullptr, 1, 0, &attributeBytes);
    std::vector<unsigned char> attributeStorage(attributeBytes);
    auto *attributes = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(
        attributeStorage.data());
    if (!InitializeProcThreadAttributeList(attributes, 1, 0, &attributeBytes)) {
        result.diagnostic =
            L"InitializeProcThreadAttributeList failed: " +
            Win32Message(GetLastError());
        return result;
    }
    HANDLE jobList[1] = {job.get()};
    if (!UpdateProcThreadAttribute(attributes, 0,
                                   PROC_THREAD_ATTRIBUTE_JOB_LIST, jobList,
                                   sizeof(jobList), nullptr, nullptr)) {
        DeleteProcThreadAttributeList(attributes);
        result.diagnostic =
            L"UpdateProcThreadAttribute(JOB_LIST) failed: " +
            Win32Message(GetLastError());
        return result;
    }

    STARTUPINFOEXW startup{};
    startup.StartupInfo.cb = sizeof(startup);
    startup.lpAttributeList = attributes;
    PROCESS_INFORMATION process{};
    std::vector<wchar_t> commandLine(plan.commandLine.begin(),
                                     plan.commandLine.end());
    commandLine.push_back(L'\0');
    std::vector<wchar_t> environment(plan.environmentBlock.begin(),
                                     plan.environmentBlock.end());
    if (!environment.empty() && environment.back() != L'\0') {
        environment.push_back(L'\0');
    }
    const DWORD flags = CREATE_SUSPENDED | EXTENDED_STARTUPINFO_PRESENT |
                        CREATE_UNICODE_ENVIRONMENT;
    const BOOL created = CreateProcessAsUserW(
        restrictedToken.get(), plan.applicationPath.c_str(), commandLine.data(),
        nullptr, nullptr, FALSE, flags,
        environment.empty() ? nullptr : environment.data(),
        plan.workingDirectory.c_str(), &startup.StartupInfo, &process);
    DeleteProcThreadAttributeList(attributes);
    if (!created) {
        result.diagnostic =
            L"CreateProcessAsUserW failed: " + Win32Message(GetLastError());
        return result;
    }
    UniqueHandle processHandle(process.hProcess);
    UniqueHandle threadHandle(process.hThread);
    BOOL inJob = FALSE;
    if (!IsProcessInJob(processHandle.get(), job.get(), &inJob) || !inJob) {
        TerminateProcess(processHandle.get(), ERROR_ASSERTION_FAILURE);
        WaitForSingleObject(processHandle.get(), 5000);
        result.diagnostic = L"Helper was not associated with the anonymous Job";
        return result;
    }
    std::uint64_t creationTime = 0;
    if (!ReadCreationTime(processHandle.get(), &creationTime)) {
        TerminateProcess(processHandle.get(), ERROR_ASSERTION_FAILURE);
        WaitForSingleObject(processHandle.get(), 5000);
        result.diagnostic =
            L"GetProcessTimes failed: " + Win32Message(GetLastError());
        return result;
    }
    result.status = Status::Ok;
    result.handles.job = std::move(job);
    result.handles.process = std::move(processHandle);
    result.handles.thread = std::move(threadHandle);
    result.handles.processId = process.dwProcessId;
    result.handles.creationTime = creationTime;
    result.diagnostic =
        L"restricted Helper created suspended and associated with Job";
    return result;
}

Status TransferHandlesToSupervisor(HANDLE supervisorProcess,
                                   LaunchHandles *source,
                                   TransferredHandles *target,
                                   std::wstring *diagnostic) {
    if (supervisorProcess == nullptr || source == nullptr || target == nullptr) {
        return Status::InvalidCall;
    }
    target->job = nullptr;
    target->process = nullptr;
    target->thread = nullptr;
    if (!DuplicateHandle(GetCurrentProcess(), source->job.get(),
                         supervisorProcess, &target->job,
                         JOB_OBJECT_QUERY | JOB_OBJECT_TERMINATE |
                             JOB_OBJECT_SET_ATTRIBUTES,
                         FALSE, 0) ||
        !DuplicateHandle(GetCurrentProcess(), source->process.get(),
                         supervisorProcess, &target->process,
                         PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE |
                             PROCESS_TERMINATE,
                         FALSE, 0) ||
        !DuplicateHandle(GetCurrentProcess(), source->thread.get(),
                         supervisorProcess, &target->thread,
                         THREAD_SUSPEND_RESUME | THREAD_QUERY_INFORMATION,
                         FALSE, 0)) {
        CloseTargetHandle(supervisorProcess, target->job);
        CloseTargetHandle(supervisorProcess, target->process);
        CloseTargetHandle(supervisorProcess, target->thread);
        target->job = target->process = target->thread = nullptr;
        if (diagnostic != nullptr) {
            *diagnostic = L"cross-process DuplicateHandle failed: " +
                          Win32Message(GetLastError());
        }
        return Status::EvidenceUnknown;
    }
    if (diagnostic != nullptr) {
        *diagnostic = L"Job/Process/Thread handles transferred";
    }
    return Status::Ok;
}

Status ResumeSuspendedHelper(HANDLE thread, std::wstring *diagnostic) {
    if (thread == nullptr || ResumeThread(thread) == static_cast<DWORD>(-1)) {
        if (diagnostic != nullptr) {
            *diagnostic = L"ResumeThread failed: " + Win32Message(GetLastError());
        }
        return Status::EvidenceUnknown;
    }
    return Status::Ok;
}

Status ConfirmJobMembership(HANDLE job, HANDLE process) {
    if (job == nullptr || process == nullptr) {
        return Status::InvalidCall;
    }
    BOOL inJob = FALSE;
    return IsProcessInJob(process, job, &inJob) && inJob
               ? Status::Ok
               : Status::IdentityMismatch;
}

Status RevokeAndWait(HANDLE job,
                     HANDLE process,
                     DWORD timeoutMs,
                     std::wstring *diagnostic) {
    if (process == nullptr) {
        return Status::InvalidCall;
    }
    if (job != nullptr && !CloseHandle(job)) {
        if (diagnostic != nullptr) {
            *diagnostic = L"Job handle close failed";
        }
        return Status::EvidenceUnknown;
    }
    DWORD wait = WaitForSingleObject(process, timeoutMs);
    if (wait == WAIT_OBJECT_0) {
        return Status::Ok;
    }
    if (wait != WAIT_TIMEOUT || !TerminateProcess(process, ERROR_PROCESS_ABORTED)) {
        if (diagnostic != nullptr) {
            *diagnostic = L"process termination could not be proven";
        }
        return Status::EvidenceUnknown;
    }
    wait = WaitForSingleObject(process, timeoutMs);
    if (wait != WAIT_OBJECT_0) {
        if (diagnostic != nullptr) {
            *diagnostic = L"process signaled wait timed out";
        }
        return Status::EvidenceUnknown;
    }
    return Status::Ok;
}

Status WindowsProcessControl::CloseJob(HANDLE *job) {
    if (job == nullptr || *job == nullptr) {
        return Status::Ok;
    }
    if (!CloseHandle(*job)) {
        return Status::EvidenceUnknown;
    }
    *job = nullptr;
    return Status::Ok;
}

Status WindowsProcessControl::WaitProcess(HANDLE process, DWORD timeoutMs) {
    if (process == nullptr) {
        return Status::InvalidCall;
    }
    const DWORD result = WaitForSingleObject(process, timeoutMs);
    return result == WAIT_OBJECT_0 ? Status::Ok
                                   : (result == WAIT_TIMEOUT
                                          ? Status::EvidenceUnknown
                                          : Status::EvidenceUnknown);
}

Status WindowsProcessControl::TerminateProcessSafe(HANDLE process) {
    if (process == nullptr || !TerminateProcess(process, ERROR_PROCESS_ABORTED)) {
        return Status::EvidenceUnknown;
    }
    return Status::Ok;
}

Status RunRevokeOrchestrator(HANDLE *job,
                             HANDLE process,
                             IProcessControl &control,
                             LaunchRecord *launch,
                             std::wstring *diagnostic) {
    if (job == nullptr || process == nullptr || launch == nullptr) {
        return Status::InvalidCall;
    }
    if (control.CloseJob(job) != Status::Ok) {
        launch->launchState = LaunchState::Unknown;
        return Status::EvidenceUnknown;
    }
    if (control.WaitProcess(process, 5000) != Status::Ok &&
        (control.TerminateProcessSafe(process) != Status::Ok ||
         control.WaitProcess(process, 5000) != Status::Ok)) {
        launch->launchState = LaunchState::Quarantined;
        if (diagnostic != nullptr) {
            *diagnostic = L"revoke termination proof failed";
        }
        return Status::EvidenceUnknown;
    }
    launch->processSignaled = true;
    launch->handlesClosed = true;
    launch->launchState = LaunchState::EvidenceReconciling;
    return Status::Ok;
}

}  // namespace p13::harness

