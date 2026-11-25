"""Fail-closed execution identity guard for the independent R4 review."""

from __future__ import annotations

import ctypes
import json
import os
import time
from ctypes import wintypes
from pathlib import Path


PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


def process_path(pid: int) -> str:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        raise RuntimeError(f"OpenProcess failed for {pid}")
    try:
        size = wintypes.DWORD(32768)
        buffer = ctypes.create_unicode_buffer(size.value)
        if not kernel32.QueryFullProcessImageNameW(
            handle, 0, buffer, ctypes.byref(size)
        ):
            raise RuntimeError("QueryFullProcessImageNameW failed")
        return buffer.value
    finally:
        kernel32.CloseHandle(handle)


def process_created(pid: int) -> str:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        raise RuntimeError(f"OpenProcess failed for {pid}")
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
            raise RuntimeError("GetProcessTimes failed")
        return str((creation.dwHighDateTime << 32) | creation.dwLowDateTime)
    finally:
        kernel32.CloseHandle(handle)


def require_guard(output_root: Path) -> dict[str, object]:
    if os.name != "nt":
        raise RuntimeError("Windows required")
    parent_pid = os.getppid()
    expected_pid = int(os.environ["AIEA_R4_REVIEW_PWSH_PID"])
    expected_path = os.environ["AIEA_R4_REVIEW_PWSH_PATH"]
    expected_created = os.environ["AIEA_R4_REVIEW_PWSH_CREATED"]
    token = os.environ["AIEA_R4_REVIEW_TOKEN"]
    evidence_path = Path(os.environ["AIEA_R4_REVIEW_EVIDENCE"])

    if parent_pid != expected_pid:
        raise RuntimeError("Python parent PID mismatch")
    if os.path.normcase(process_path(parent_pid)) != os.path.normcase(expected_path):
        raise RuntimeError("Python parent image mismatch")
    if process_created(parent_pid) != expected_created:
        raise RuntimeError("Python parent creation time mismatch")
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence.get("guard_token") != token:
        raise RuntimeError("guard token mismatch")
    if evidence.get("powershell_pid") != parent_pid:
        raise RuntimeError("guard evidence PID mismatch")
    if Path(evidence.get("powershell_path", "")).name.lower() != "pwsh.exe":
        raise RuntimeError("guard evidence executable mismatch")

    review_root = Path(__file__).resolve().parents[1]
    output_root.resolve().relative_to(review_root)
    return {
        "verified": True,
        "parent_pid": parent_pid,
        "parent_path": process_path(parent_pid),
        "parent_creation_100ns": expected_created,
        "output_root": str(output_root.resolve()),
        "checked_at_utc_ns": time.time_ns(),
    }
