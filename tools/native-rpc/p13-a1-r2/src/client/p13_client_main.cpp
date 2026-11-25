#include "client/p13_client_runtime.h"

#include <cwchar>

int wmain(int argc, wchar_t **argv) {
    if (argc != 2 || std::wcscmp(argv[1], L"--runtime-authorized") != 0) {
        std::fwprintf(stderr,
                      L"BUILD-ONLY: client execution requires a separate "
                      L"R4-A1-R4-B2 runtime authorization.\n");
        return 2;
    }
    p13::harness::ClientRuntimeConfiguration configuration;
    configuration.endpoint = p13::harness::kAuthorityEndpoint;
    return p13::harness::RunNativeClientProbe(configuration);
}

