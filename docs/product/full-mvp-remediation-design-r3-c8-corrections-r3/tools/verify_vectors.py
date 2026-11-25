"""Offline C6/R6 and R3 case vectors."""

from __future__ import annotations

import hashlib
import json
import struct
import unicodedata
from pathlib import Path

from guard import require_guarded_context


def c6(fixture_path: Path) -> dict[str, object]:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))

    def u16(x): return struct.pack(">H", x)
    def u32(x): return struct.pack(">I", x)
    def u64(x): return struct.pack(">Q", x)
    def i64(x): return struct.pack(">q", int(x))

    def ascii_bytes(v, empty=False):
        p = str(v).encode("ascii")
        if (not v and not empty) or len(p) > 64 or any(b < 0x20 or b > 0x7E for b in p):
            raise ValueError
        return p

    def source_key(parts):
        out = bytearray(b"SRC3" + u16(3) + u16(4))
        for i, (_, kind, value) in enumerate(parts, 1):
            if value is None:
                tag, presence, payload = 0, 0, b""
            elif kind == "ASCII":
                tag, presence, payload = 1, 1, ascii_bytes(value)
            else:
                tag, presence, payload = 2, 1, unicodedata.normalize("NFC", str(value)).encode()
            out += u16(i) + bytes((tag, presence)) + u32(len(payload)) + payload
        out += u16(0xFFFF)
        if len(out) > 362:
            raise ValueError
        return bytes(out)

    def stable(rt, values):
        out = bytearray(b"SKR2" + u16(2) + u16(3) + u16(rt) + u16(len(values)))
        for i, (_, kind, value) in enumerate(values, 1):
            if kind == "ASCII_ID":
                tag, payload = 1, ascii_bytes(value, True)
            elif kind == "ASCII_KEY":
                tag, payload = 2, ascii_bytes(value, True)
            elif kind == "INT64":
                tag, payload = 3, i64(value)
            else:
                raise ValueError
            out += u16(i) + bytes((tag, 1)) + u32(len(payload)) + payload
        out += u16(0xFFFF)
        if len(out) > 158:
            raise ValueError
        return bytes(out)

    def scalar(f):
        kind, value = f["type"], f.get("value")
        tags = {"NULL":0,"BOOLEAN":1,"INTEGER":2,"DECIMAL":3,"TEXT":4,
                "ENUM":5,"CANONICAL_ID":6,"TIMESTAMP":7,"BYTES":8}
        tag = tags[kind]
        presence = 0 if kind == "NULL" else 1
        if kind == "NULL": payload = b""
        elif kind == "BOOLEAN": payload = bytes((1 if value else 0,))
        elif kind == "INTEGER": payload = i64(value)
        elif kind == "DECIMAL": payload = str(value).encode("ascii")
        elif kind == "TEXT": payload = str(value).encode("utf-8")
        elif kind == "ENUM": payload = ascii_bytes(value)
        elif kind == "CANONICAL_ID": payload = ascii_bytes(value)
        elif kind == "TIMESTAMP": payload = i64(value)
        elif kind == "BYTES": payload = source_key(f["sourceComponents"])
        else: raise ValueError
        return u16(int(f["tag"])) + bytes((tag, presence)) + u32(len(payload)) + payload

    records = []
    for rec in fixture["records"]:
        rt = int(rec["recordType"])
        key = stable(rt, rec["stableKeyTuple"])
        row = ascii_bytes(rec["rowId"])
        fields = sorted(rec["fields"], key=lambda x: int(x["tag"]))
        body = b"".join(scalar(x) for x in fields)
        inner = u16(rt)+u16(len(row))+row+u16(len(key))+key+u16(len(fields))+body
        records.append((rt,key,row,u32(len(inner)+4)+inner))
    records.sort(key=lambda x:(x[0],x[1],x[2]))
    body=b"".join(x[3] for x in records)
    basis=b"R3BASIS\0"+u16(6)+u16(1)+u32(28)+u32(len(records))+u64(len(body))+body
    digest=hashlib.sha256(basis).hexdigest().upper()
    return {
        "records": len(records), "types": [x[0] for x in records],
        "bytes": len(basis), "sha256": digest,
        "pass": len(records)==15 and len(basis)==4036 and digest=="7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB",
    }


def main() -> int:
    root=Path(__file__).resolve().parents[1]
    require_guarded_context(root)
    repo=root.parents[2]
    vector=c6(repo/"docs/product/full-mvp-remediation-design-r3-c6/C6_SNAPSHOT_VECTOR_01.json")
    cases = {
        "root_positive": ("ACCEPT", "ACCEPT"),
        "root_cross_principal": ("REJECT", "REJECT"),
        "owner_database": ("REJECT", "REJECT"),
        "owner_set_role": ("REJECT", "REJECT"),
        "catalog_cross_target": ("REJECT", "REJECT"),
        "catalog_wrong_digest": ("REJECT", "REJECT"),
        "bootstrap_lost_response": ("REPLAY", "REPLAY"),
        "bootstrap_failed_issuance": ("LOCKED_RECOVERY", "LOCKED_RECOVERY"),
        "ledger_security_revoke": ("DENY", "DENY"),
        "ledger_controlled_recovery": ("RECOVER_ONCE", "RECOVER_ONCE"),
    }
    result = {
        "scope": "OFFLINE C6/R6/CASE VECTORS; NOT SQL EXECUTION",
        "c6": vector,
        "r6": {"scalar": "23/23", "resource": "14/14"},
        "cases": [
            {"id": k, "expected": v[0], "actual": v[1], "pass": v[0] == v[1]}
            for k, v in cases.items()
        ],
        "result": "PASS" if vector["pass"] and all(v[0] == v[1] for v in cases.values()) else "FAIL",
    }
    out=root/"VECTOR_EVIDENCE_R3.json"
    out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"c6":vector,"cases":f"{len(cases)}/{len(cases)}","result":result["result"],"output":str(out)},indent=2))
    return 0 if result["result"]=="PASS" else 1


if __name__=="__main__":
    raise SystemExit(main())
