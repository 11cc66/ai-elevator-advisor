"""Fail-closed execution identity guard for R2 offline tools."""

from __future__ import annotations

import ctypes
import json
import os
import sys
import time
from ctypes import wintypes
from pathlib import Path


PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
EXPECTED_PS_VERSION = "7.6.9"


class GuardFailure(RuntimeError):
    pass


def _process_path(pid: int) -> str:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        raise GuardFailure(f"OpenProcess failed for pid {pid}")
    try:
        size = wintypes.DWORD(32768)
        buffer = ctypes.create_unicode_buffer(size.value)
        if not kernel32.QueryFullProcessImageNameW(
            handle, 0, buffer, ctypes.byref(size)
        ):
            raise GuardFailure(f"QueryFullProcessImageNameW failed for pid {pid}")
        return buffer.value
    finally:
        kernel32.CloseHandle(handle)


def _process_creation_utc(pid: int) -> int:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        raise GuardFailure(f"OpenProcess failed for pid {pid}")
    try:
        creation = wintypes.FILETIME()
        exit_time = wintypes.FILETIME()
        kernel = wintypes.FILETIME()
        user = wintypes.FILETIME()
        if not kernel32.GetProcessTimes(
            handle,
            ctypes.byref(creation),
            ctypes.byref(exit_time),
            ctypes.byref(kernel),
            ctypes.byref(user),
        ):
            raise GuardFailure(f"GetProcessTimes failed for pid {pid}")
        ticks = (creation.dwHighDateTime << 32) | creation.dwLowDateTime
        return ticks
    finally:
        kernel32.CloseHandle(handle)


def require_guarded_context(output_root: Path) -> dict[str, object]:
    if os.name != "nt":
        raise GuardFailure("Windows process identity required")
    parent_pid = os.getppid()
    expected_pid = int(os.environ.get("AIEA_R2_PWSH_PID", "0"))
    expected_created = os.environ.get("AIEA_R2_PWSH_CREATED_100NS", "")
    expected_path = os.environ.get("AIEA_R2_PWSH_PATH", "")
    token = os.environ.get("AIEA_R2_GUARD_TOKEN", "")
    evidence_file = Path(os.environ.get("AIEA_R2_GUARD_EVIDENCE", ""))
    if not expected_pid or expected_pid != parent_pid:
        raise GuardFailure("Python parent is not the verified PowerShell process")
    if not token or not evidence_file.is_file():
        raise GuardFailure("guard evidence token missing")
    try:
        evidence = json.loads(evidence_file.read_text(encoding="utf-8"))
    except Exception as exc:
        raise GuardFailure(f"guard evidence unreadable: {exc}") from exc
    if evidence.get("guard_token") != token:
        raise GuardFailure("guard evidence token mismatch")
    if evidence.get("powershell_pid") != expected_pid:
        raise GuardFailure("guard evidence PID mismatch")
    if Path(expected_path).name.lower() != "pwsh.exe":
        raise GuardFailure("expected process is not pwsh.exe")
    actual_parent_path = _process_path(parent_pid)
    if os.path.normcase(actual_parent_path) != os.path.normcase(expected_path):
        raise GuardFailure("actual Python parent image mismatch")
    actual_created = str(_process_creation_utc(parent_pid))
    if actual_created != expected_created:
        raise GuardFailure("actual Python parent creation time mismatch")
    if evidence.get("powershell_version") != EXPECTED_PS_VERSION:
        raise GuardFailure("PowerShell version mismatch")
    resolved_output = output_root.resolve()
    r2_root = Path(__file__).resolve().parents[1]
    try:
        resolved_output.relative_to(r2_root)
    except ValueError as exc:
        raise GuardFailure("output path escapes R2 directory") from exc
    return {
        "verified": True,
        "parent_pid": parent_pid,
        "parent_path": actual_parent_path,
        "parent_creation_100ns": actual_created,
        "output_root": str(resolved_output),
        "guard_evidence": str(evidence_file),
        "checked_at_utc_ns": time.time_ns(),
    }


def fail(message: str) -> int:
    print(json.dumps({"guard": "FAIL", "reason": message}, ensure_ascii=False))
    return 2


def main() -> int:
    r2_root = Path(__file__).resolve().parents[1]
    try:
        result = require_guarded_context(r2_root)
    except Exception as exc:
        return fail(str(exc))
    print(json.dumps({"guard": "PASS", **result}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
