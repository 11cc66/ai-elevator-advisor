"""Process-identity guard for the independent R2 review tools."""

from __future__ import annotations

import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path


PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


def process_path(pid: int) -> str:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        raise RuntimeError(f"OpenProcess({pid}) failed")
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


def process_creation_100ns(pid: int) -> str:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        raise RuntimeError(f"OpenProcess({pid}) failed")
    try:
        creation = wintypes.FILETIME()
        exited = wintypes.FILETIME()
        kernel = wintypes.FILETIME()
        user = wintypes.FILETIME()
        if not kernel32.GetProcessTimes(
            handle,
            ctypes.byref(creation),
            ctypes.byref(exited),
            ctypes.byref(kernel),
            ctypes.byref(user),
        ):
            raise RuntimeError("GetProcessTimes failed")
        return str((creation.dwHighDateTime << 32) | creation.dwLowDateTime)
    finally:
        kernel32.CloseHandle(handle)


def require_guard() -> dict[str, object]:
    parent_pid = os.getppid()
    expected_pid = int(os.environ["AIEA_REVIEW_PWSH_PID"])
    expected_path = os.environ["AIEA_REVIEW_PWSH_PATH"]
    expected_creation = os.environ["AIEA_REVIEW_PWSH_CREATED_100NS"]
    expected_token = os.environ["AIEA_REVIEW_GUARD_TOKEN"]
    evidence_path = Path(os.environ["AIEA_REVIEW_GUARD_EVIDENCE"])
    if parent_pid != expected_pid:
        raise RuntimeError("Python parent PID mismatch")
    actual_path = process_path(parent_pid)
    if os.path.normcase(actual_path) != os.path.normcase(expected_path):
        raise RuntimeError("Python parent image mismatch")
    if process_creation_100ns(parent_pid) != expected_creation:
        raise RuntimeError("Python parent creation time mismatch")
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence.get("guard_token") != expected_token:
        raise RuntimeError("guard token mismatch")
    return {
        "python_parent_pid": parent_pid,
        "python_parent_path": actual_path,
        "python_parent_creation_100ns": expected_creation,
        "guard_token": expected_token,
    }

