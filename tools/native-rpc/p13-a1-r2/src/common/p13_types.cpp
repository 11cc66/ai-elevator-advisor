#include "common/p13_types.h"

#include <algorithm>
#include <cstdlib>
#include <cstring>
#include <cwchar>

extern "C" void *__RPC_USER MIDL_user_allocate(size_t size) {
    return std::malloc(size);
}

extern "C" void __RPC_USER MIDL_user_free(void *pointer) {
    std::free(pointer);
}

namespace p13::harness {
namespace {

template <typename T>
void AppendScalar(std::vector<unsigned char> *bytes, const T &value) {
    const auto *start = reinterpret_cast<const unsigned char *>(&value);
    bytes->insert(bytes->end(), start, start + sizeof(T));
}

void AppendBytes(std::vector<unsigned char> *bytes,
                 const unsigned char *data,
                 std::size_t length) {
    if (length != 0) {
        bytes->insert(bytes->end(), data, data + length);
    }
}

}  // namespace

bool HasPrincipal(PrincipalClass set, PrincipalClass value) noexcept {
    return (static_cast<std::uint32_t>(set) &
            static_cast<std::uint32_t>(value)) != 0;
}

bool HasAuthorityType(AuthorityType set, AuthorityType value) noexcept {
    return (static_cast<std::uint32_t>(set) &
            static_cast<std::uint32_t>(value)) != 0;
}

bool IsZeroGuid(const GUID &value) noexcept {
    return value.Data1 == 0 && value.Data2 == 0 && value.Data3 == 0 &&
           std::all_of(std::begin(value.Data4), std::end(value.Data4),
                       [](unsigned char byte) { return byte == 0; });
}

bool EqualGuid(const GUID &left, const GUID &right) noexcept {
    return IsEqualGUID(left, right) != FALSE;
}

std::wstring GuidToString(const GUID &value) {
    wchar_t buffer[40]{};
    swprintf_s(buffer, std::size(buffer),
               L"{%08lX-%04hX-%04hX-%02X%02X-%02X%02X%02X%02X%02X%02X}",
               value.Data1, value.Data2, value.Data3, value.Data4[0],
               value.Data4[1], value.Data4[2], value.Data4[3], value.Data4[4],
               value.Data4[5], value.Data4[6], value.Data4[7]);
    return buffer;
}

std::vector<unsigned char> CopySidBytes(const PSID sid) {
    if (sid == nullptr || !IsValidSid(sid)) {
        return {};
    }
    const DWORD length = GetLengthSid(sid);
    std::vector<unsigned char> bytes(length);
    if (!::CopySid(length, bytes.data(), sid)) {
        return {};
    }
    return bytes;
}

std::wstring SidToString(const PSID sid) {
    if (sid == nullptr) {
        return {};
    }
    LPWSTR raw = nullptr;
    if (!ConvertSidToStringSidW(sid, &raw)) {
        return {};
    }
    std::wstring result(raw);
    LocalFree(raw);
    return result;
}

bool EqualSidBytes(const std::vector<unsigned char> &left,
                   const std::vector<unsigned char> &right) {
    if (left.empty() || right.empty() || left.size() != right.size()) {
        return false;
    }
    return EqualSid(
               const_cast<PSID>(reinterpret_cast<const void *>(left.data())),
               const_cast<PSID>(reinterpret_cast<const void *>(right.data()))) !=
           FALSE;
}

bool SidSetContainsEnabled(const std::vector<SidEvidence> &sids,
                           const std::wstring &text) {
    if (text.empty()) {
        return false;
    }
    return std::any_of(sids.begin(), sids.end(), [&](const SidEvidence &sid) {
        return sid.enabled && !sid.denyOnly &&
               _wcsicmp(sid.text.c_str(), text.c_str()) == 0;
    });
}

bool SidSetContainsBinary(const std::vector<SidEvidence> &sids,
                          const SidEvidence &value) {
    return std::any_of(sids.begin(), sids.end(), [&](const SidEvidence &sid) {
        return sid.enabled && !sid.denyOnly &&
               EqualSidBytes(sid.bytes, value.bytes);
    });
}

DWORD SidRid(const PSID sid) {
    if (sid == nullptr || !IsValidSid(sid)) {
        return 0;
    }
    PUCHAR countPointer = GetSidSubAuthorityCount(sid);
    if (countPointer == nullptr || *countPointer == 0) {
        return 0;
    }
    const DWORD index = static_cast<DWORD>(*countPointer - 1);
    const PDWORD rid = GetSidSubAuthority(sid, index);
    return rid == nullptr ? 0 : *rid;
}

Sha256Outcome Sha256Bytes(const unsigned char *data, std::size_t length) {
    Sha256Outcome result;
    if (length != 0 && data == nullptr) {
        result.diagnostic = L"SHA-256 input pointer is null";
        return result;
    }
    if (length > ULONG_MAX) {
        result.diagnostic = L"SHA-256 input exceeds ULONG";
        return result;
    }

    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    DWORD objectLength = 0;
    DWORD resultLength = 0;

    auto closeAlgorithm = [&]() {
        if (algorithm != nullptr) {
            BCryptCloseAlgorithmProvider(algorithm, 0);
            algorithm = nullptr;
        }
    };
    auto destroyHash = [&]() {
        if (hash != nullptr) {
            BCryptDestroyHash(hash);
            hash = nullptr;
        }
    };

    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM,
                                    nullptr, 0) < 0) {
        result.diagnostic = L"BCryptOpenAlgorithmProvider failed";
        return result;
    }
    if (BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
                          reinterpret_cast<PUCHAR>(&objectLength),
                          sizeof(objectLength), &resultLength, 0) < 0) {
        closeAlgorithm();
        result.diagnostic = L"BCryptGetProperty failed";
        return result;
    }
    std::vector<unsigned char> object(objectLength);
    if (BCryptCreateHash(algorithm, &hash, object.data(), objectLength,
                         nullptr, 0, 0) < 0) {
        closeAlgorithm();
        result.diagnostic = L"BCryptCreateHash failed";
        return result;
    }
    if (length != 0 &&
        BCryptHashData(hash, const_cast<PUCHAR>(data),
                       static_cast<ULONG>(length), 0) < 0) {
        destroyHash();
        closeAlgorithm();
        result.diagnostic = L"BCryptHashData failed";
        return result;
    }
    if (BCryptFinishHash(hash, result.digest.data(),
                         static_cast<ULONG>(result.digest.size()), 0) < 0) {
        destroyHash();
        closeAlgorithm();
        result.digest.fill(0);
        result.diagnostic = L"BCryptFinishHash failed";
        return result;
    }
    destroyHash();
    closeAlgorithm();
    result.status = Status::Ok;
    return result;
}

bool Sha256Equal(const Sha256Outcome &left, const Sha256Outcome &right) {
    return left.status == Status::Ok && right.status == Status::Ok &&
           left.digest == right.digest;
}

std::wstring Sha256Hex(const std::array<unsigned char, 32> &digest) {
    static constexpr wchar_t kHex[] = L"0123456789ABCDEF";
    std::wstring result;
    result.reserve(digest.size() * 2);
    for (unsigned char byte : digest) {
        result.push_back(kHex[(byte >> 4) & 0x0F]);
        result.push_back(kHex[byte & 0x0F]);
    }
    return result;
}

std::chrono::system_clock::time_point NowUtc() {
    return std::chrono::system_clock::now();
}

void SetResponse(P13Response *response, Status status, std::wstring_view message,
                 const GUID &sessionId, const GUID &evidenceId,
                 std::uint64_t serverEpoch) {
    if (response == nullptr) {
        return;
    }
    std::memset(response, 0, sizeof(*response));
    response->protocolVersion = P13_PROTOCOL_VERSION_2;
    response->status = static_cast<unsigned long>(status);
    response->sessionId = sessionId;
    response->evidenceId = evidenceId;
    response->serverEpoch = static_cast<hyper>(serverEpoch);
    const std::size_t count =
        std::min<std::size_t>(message.size(), P13_MAX_MESSAGE_CHARS - 1);
    std::copy_n(message.data(), count, response->message);
    response->message[count] = L'\0';
    response->messageLength = static_cast<unsigned long>(count);
}

std::vector<unsigned char> CanonicalAuthorityRequest(
    const P13AuthorityEnvelope &request) {
    std::vector<unsigned char> bytes;
    bytes.reserve(256 + request.payloadLength);
    AppendScalar(&bytes, request.protocolVersion);
    AppendScalar(&bytes, request.operation);
    AppendScalar(&bytes, request.requestId);
    AppendScalar(&bytes, request.authorityId);
    AppendScalar(&bytes, request.sessionId);
    AppendScalar(&bytes, request.operationId);
    AppendScalar(&bytes, request.grantId);
    AppendScalar(&bytes, request.launchSessionId);
    AppendScalar(&bytes, request.launchTicketId);
    AppendScalar(&bytes, request.action);
    AppendScalar(&bytes, request.authorityEpoch);
    AppendScalar(&bytes, request.generation);
    AppendScalar(&bytes, request.clientSequence);
    AppendScalar(&bytes, request.payloadLength);
    if (request.payloadLength <= P13_MAX_PAYLOAD_BYTES) {
        AppendBytes(&bytes, request.payload, request.payloadLength);
    }
    return bytes;
}

std::vector<unsigned char> CanonicalLaunchRequest(
    const P13LaunchEnvelope &request) {
    std::vector<unsigned char> bytes;
    bytes.reserve(320 + request.payloadLength);
    AppendScalar(&bytes, request.protocolVersion);
    AppendScalar(&bytes, request.operation);
    AppendScalar(&bytes, request.requestId);
    AppendScalar(&bytes, request.launchAuthorityId);
    AppendScalar(&bytes, request.launchSessionId);
    AppendScalar(&bytes, request.launchTicketId);
    AppendScalar(&bytes, request.operationId);
    AppendScalar(&bytes, request.grantId);
    AppendScalar(&bytes, request.action);
    AppendScalar(&bytes, request.authorityEpoch);
    AppendScalar(&bytes, request.generation);
    AppendScalar(&bytes, request.clientSequence);
    AppendBytes(&bytes, request.expectedReleaseDigest,
                P13_MAX_RELEASE_DIGEST_BYTES);
    AppendScalar(&bytes, request.payloadLength);
    if (request.payloadLength <= P13_MAX_PAYLOAD_BYTES) {
        AppendBytes(&bytes, request.payload, request.payloadLength);
    }
    return bytes;
}

}  // namespace p13::harness

