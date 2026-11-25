#pragma once

#include "common/p13_types.h"

namespace p13::harness {

class IIdentityProvider {
public:
    virtual ~IIdentityProvider() = default;
    virtual Status Inspect(handle_t binding,
                           const CallerExpectation &expectation,
                           CallerIdentityRecord *identity,
                           std::wstring *diagnostic) = 0;
};

class WindowsRpcIdentityProvider final : public IIdentityProvider {
public:
    Status Inspect(handle_t binding,
                   const CallerExpectation &expectation,
                   CallerIdentityRecord *identity,
                   std::wstring *diagnostic) override;
};

class ImpersonationGuard {
public:
    explicit ImpersonationGuard(handle_t binding);
    ~ImpersonationGuard();
    ImpersonationGuard(const ImpersonationGuard &) = delete;
    ImpersonationGuard &operator=(const ImpersonationGuard &) = delete;

    bool entered() const noexcept { return entered_; }
    Status Leave(std::wstring *diagnostic);
    bool finished() const noexcept { return finished_; }

private:
    bool entered_{false};
    bool finished_{false};
};

}  // namespace p13::harness

