import hashlib
import sys
from pathlib import Path


def main():
    root = Path(sys.argv[1]).resolve()
    manifest = root / "SHA256SUMS_R3_C6.txt"
    records = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        if path == manifest:
            continue
        data = path.read_bytes()
        lines = data.decode("utf-8").splitlines()
        relative = path.relative_to(root.parent.parent.parent).as_posix()
        records.append(
            f"{hashlib.sha256(data).hexdigest().upper()}  "
            f"{len(data)}  {len(lines)}  {relative}"
        )
    manifest.write_text("\n".join(records) + "\n", encoding="utf-8", newline="\n")
    print(f"MANIFEST_RECORDS={len(records)}")


if __name__ == "__main__":
    main()
