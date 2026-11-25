"""Build the R2 output manifest without self-inclusion."""

from __future__ import annotations

import hashlib
from pathlib import Path

from guard import require_guarded_context


def main() -> int:
    r2_root = Path(__file__).resolve().parents[1]
    require_guarded_context(r2_root)
    manifest = r2_root / "SHA256SUMS_R3_C8_CORRECTIONS_R2.txt"
    files = sorted(
        path
        for path in r2_root.rglob("*")
        if path.is_file() and path != manifest
    )
    lines = []
    for path in files:
        payload = path.read_bytes()
        relative = path.relative_to(r2_root.parents[2]).as_posix()
        lines.append(
            f"{hashlib.sha256(payload).hexdigest().upper()} "
            f"{len(payload)} {len(payload.decode('utf-8').splitlines())} {relative}"
        )
    tmp = manifest.with_suffix(".tmp")
    tmp.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    tmp.replace(manifest)
    print(f"records={len(lines)}")
    print(f"output={manifest}")
    print(f"bytes={manifest.stat().st_size}")
    print(f"lines={len(lines)}")
    print(f"sha256={hashlib.sha256(manifest.read_bytes()).hexdigest().upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
