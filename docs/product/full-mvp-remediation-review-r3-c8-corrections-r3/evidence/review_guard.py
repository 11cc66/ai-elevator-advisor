"""Review execution identity guard."""

from __future__ import annotations

import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path


Q = 0x1000


def p(pid: int) -> str:
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    h = k.OpenProcess(Q, False, pid)
    if not h:
        raise RuntimeError("OpenProcess")
    try:
        n = wintypes.DWORD(32768)
        b = ctypes.create_unicode_buffer(n.value)
        if not k.QueryFullProcessImageNameW(h, 0, b, ctypes.byref(n)):
            raise RuntimeError("QueryFullProcessImageNameW")
        return b.value
    finally:
        k.CloseHandle(h)


def ct(pid: int) -> str:
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    h = k.OpenProcess(Q, False, pid)
    if not h:
        raise RuntimeError("OpenProcess")
    try:
        c, e, kt, u = (wintypes.FILETIME() for _ in range(4))
        if not k.GetProcessTimes(h, ctypes.byref(c), ctypes.byref(e),
                                 ctypes.byref(kt), ctypes.byref(u)):
            raise RuntimeError("GetProcessTimes")
        return str((c.dwHighDateTime << 32) | c.dwLowDateTime)
    finally:
        k.CloseHandle(h)


def require_guard(root: Path):
    pid = os.getppid()
    assert pid == int(os.environ["AIEA_R3R_PWSH_PID"])
    assert os.path.normcase(p(pid)) == os.path.normcase(os.environ["AIEA_R3R_PWSH_PATH"])
    assert ct(pid) == os.environ["AIEA_R3R_PWSH_CREATED"]
    ev = Path(os.environ["AIEA_R3R_EVIDENCE"])
    assert json.loads(ev.read_text(encoding="utf-8"))["guard_token"] == os.environ["AIEA_R3R_TOKEN"]
    root.resolve().relative_to(Path(__file__).resolve().parents[1])
    return {"verified": True, "parent_pid": pid, "parent_path": p(pid)}

