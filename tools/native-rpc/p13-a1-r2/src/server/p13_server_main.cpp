#include "server/p13_server_runtime.h"

#include <cwchar>
#include <iterator>

int wmain(int argc, wchar_t **argv) {
    if (argc < 2 || std::wcscmp(argv[1], L"--runtime-authorized") != 0) {
        std::fwprintf(stderr,
                      L"BUILD-ONLY: server execution requires a separate "
                      L"R4-A1-R4-B2 runtime authorization.\n");
        return 2;
    }

    p13::harness::ServerRuntimeConfiguration configuration;
    configuration.endpoint = p13::harness::kAuthorityEndpoint;
    configuration.registerAuthorityInterface = true;
    if (argc >= 3) {
        configuration.registerAuthorityInterface = false;
        configuration.registerLaunchInterface = true;
        if (std::wcscmp(argv[2], L"--launch-staging") == 0) {
            configuration.endpoint = p13::harness::kLaunchStagingEndpoint;
        } else if (std::wcscmp(argv[2], L"--launch-publisher") == 0) {
            configuration.endpoint = p13::harness::kLaunchPublisherEndpoint;
        } else if (std::wcscmp(argv[2], L"--launch-sealer") == 0) {
            configuration.endpoint = p13::harness::kLaunchSealerEndpoint;
        } else if (std::wcscmp(argv[2], L"--launch-cleanup") == 0) {
            configuration.endpoint = p13::harness::kLaunchCleanupEndpoint;
        } else {
            return 2;
        }
        configuration.launchDescriptor =
            p13::harness::LaunchDescriptorForEndpoint(configuration.endpoint);
        if (configuration.launchDescriptor == nullptr) {
            return 2;
        }
    }
    wchar_t sddl[2048]{};
    const DWORD length = GetEnvironmentVariableW(
        L"P13_TEST_INTERFACE_SDDL", sddl,
        static_cast<DWORD>(std::size(sddl)));
    if (length == 0 || length >= static_cast<DWORD>(std::size(sddl))) {
        std::fwprintf(stderr,
                      L"Missing or oversized P13_TEST_INTERFACE_SDDL; "
                      L"server remains fail-closed.\n");
        return 2;
    }
    configuration.interfaceSddl.assign(sddl, length);
    return p13::harness::RunNativeServer(configuration);
}

