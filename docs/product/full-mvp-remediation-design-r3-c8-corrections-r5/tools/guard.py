"""Fail-closed execution identity guard for R5 design tools."""

from __future__ import annotations

import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path


PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


def _kernel32() -> ctypes.WinDLL:
    if os.name != "nt":
        raise RuntimeError("Windows is required")
    return ctypes.WinDLL("kernel32", use_last_error=True)


def process_path(pid: int) -> str:
    kernel32 = _kernel32()
    handle = kernel32.OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION, False, pid
    )
    if not handle:
        raise RuntimeError("OpenProcess failed")
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
    kernel32 = _kernel32()
    handle = kernel32.OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION, False, pid
    )
    if not handle:
        raise RuntimeError("OpenProcess failed")
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
        return str(
            (creation.dwHighDateTime << 32) | creation.dwLowDateTime
        )
    finally:
        kernel32.CloseHandle(handle)


def require_guard(root: Path) -> dict[str, object]:
    if os.name != "nt":
        raise RuntimeError("Windows is required")

    parent_pid = os.getppid()
    expected_pid = int(os.environ["AIEA_R5_REVIEW_PWSH_PID"])
    expected_path = os.environ["AIEA_R5_REVIEW_PWSH_PATH"]
    expected_creation = os.environ["AIEA_R5_REVIEW_PWSH_CREATED"]
    token = os.environ["AIEA_R5_REVIEW_TOKEN"]
    evidence_path = Path(os.environ["AIEA_R5_REVIEW_EVIDENCE"])

    if parent_pid != expected_pid:
        raise RuntimeError("parent PID mismatch")
    actual_path = process_path(parent_pid)
    if os.path.normcase(actual_path) != os.path.normcase(expected_path):
        raise RuntimeError("parent image mismatch")
    if Path(actual_path).name.lower() != "pwsh.exe":
        raise RuntimeError("parent is not pwsh.exe")
    if process_creation_100ns(parent_pid) != expected_creation:
        raise RuntimeError("parent creation time mismatch")

    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence.get("guard_token") != token:
        raise RuntimeError("guard token mismatch")
    if evidence.get("powershell_pid") != parent_pid:
        raise RuntimeError("guard evidence PID mismatch")
    if os.path.normcase(str(evidence.get("powershell_path", ""))) != os.path.normcase(
        expected_path
    ):
        raise RuntimeError("guard evidence path mismatch")
    if str(evidence.get("powershell_creation_100ns", "")) != expected_creation:
        raise RuntimeError("guard evidence creation mismatch")

    resolved_root = root.resolve()
    resolved_root.relative_to(Path(__file__).resolve().parents[1])
    return {
        "verified": True,
        "parent_pid": parent_pid,
        "parent_path": actual_path,
        "parent_creation_100ns": expected_creation,
        "guard_token": token,
    }

