"""Execution identity guard for R4 tools."""

from __future__ import annotations

import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path


Q=0x1000


def path(pid:int)->str:
    k=ctypes.WinDLL("kernel32",use_last_error=True);h=k.OpenProcess(Q,False,pid)
    if not h: raise RuntimeError("OpenProcess")
    try:
        n=wintypes.DWORD(32768);b=ctypes.create_unicode_buffer(n.value)
        if not k.QueryFullProcessImageNameW(h,0,b,ctypes.byref(n)):raise RuntimeError("image")
        return b.value
    finally:k.CloseHandle(h)


def created(pid:int)->str:
    k=ctypes.WinDLL("kernel32",use_last_error=True);h=k.OpenProcess(Q,False,pid)
    if not h: raise RuntimeError("OpenProcess")
    try:
        c,e,kt,u=(wintypes.FILETIME() for _ in range(4))
        if not k.GetProcessTimes(h,ctypes.byref(c),ctypes.byref(e),ctypes.byref(kt),ctypes.byref(u)):raise RuntimeError("times")
        return str((c.dwHighDateTime<<32)|c.dwLowDateTime)
    finally:k.CloseHandle(h)


def require_guard(root:Path):
    pid=os.getppid()
    if pid!=int(os.environ["AIEA_R4_PWSH_PID"]):raise RuntimeError("parent pid")
    if os.path.normcase(path(pid))!=os.path.normcase(os.environ["AIEA_R4_PWSH_PATH"]):raise RuntimeError("parent path")
    if created(pid)!=os.environ["AIEA_R4_PWSH_CREATED"]:raise RuntimeError("parent creation")
    ev=Path(os.environ["AIEA_R4_EVIDENCE"])
    if json.loads(ev.read_text(encoding="utf-8"))["token"]!=os.environ["AIEA_R4_TOKEN"]:raise RuntimeError("token")
    root.resolve().relative_to(Path(__file__).resolve().parents[1])
    return {"verified":True,"parent_pid":pid,"parent_path":path(pid)}


# R3 validation helpers imported in read-only mode use this historical name.
require_guarded_context = require_guard
