"""Execution identity guard for R3 offline design tools."""

from __future__ import annotations

import ctypes
import json
import os
import time
from ctypes import wintypes
from pathlib import Path


PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


def _path(pid: int) -> str:
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    h = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h:
        raise RuntimeError("OpenProcess failed")
    try:
        size = wintypes.DWORD(32768)
        buf = ctypes.create_unicode_buffer(size.value)
        if not k32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)):
            raise RuntimeError("QueryFullProcessImageNameW failed")
        return buf.value
    finally:
        k32.CloseHandle(h)


def _created(pid: int) -> str:
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    h = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h:
        raise RuntimeError("OpenProcess failed")
    try:
        c, e, k, u = (wintypes.FILETIME() for _ in range(4))
        if not k32.GetProcessTimes(h, ctypes.byref(c), ctypes.byref(e),
                                   ctypes.byref(k), ctypes.byref(u)):
            raise RuntimeError("GetProcessTimes failed")
        return str((c.dwHighDateTime << 32) | c.dwLowDateTime)
    finally:
        k32.CloseHandle(h)


def require_guarded_context(output_root: Path) -> dict[str, object]:
    parent = os.getppid()
    expected_pid = int(os.environ["AIEA_R3_PWSH_PID"])
    expected_path = os.environ["AIEA_R3_PWSH_PATH"]
    expected_created = os.environ["AIEA_R3_PWSH_CREATED_100NS"]
    token = os.environ["AIEA_R3_GUARD_TOKEN"]
    evidence_path = Path(os.environ["AIEA_R3_GUARD_EVIDENCE"])
    if parent != expected_pid:
        raise RuntimeError("Python parent PID mismatch")
    if os.path.normcase(_path(parent)) != os.path.normcase(expected_path):
        raise RuntimeError("Python parent image mismatch")
    if _created(parent) != expected_created:
        raise RuntimeError("Python parent creation mismatch")
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence.get("guard_token") != token:
        raise RuntimeError("guard token mismatch")
    r3 = Path(__file__).resolve().parents[1]
    output_root.resolve().relative_to(r3)
    return {
        "verified": True,
        "parent_pid": parent,
        "parent_path": _path(parent),
        "parent_creation_100ns": expected_created,
        "output_root": str(output_root.resolve()),
        "checked_at_utc_ns": time.time_ns(),
    }
