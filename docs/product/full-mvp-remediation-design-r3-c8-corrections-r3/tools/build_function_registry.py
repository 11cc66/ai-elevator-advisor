"""Build the static final-function Registry for R3."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from guard import require_guarded_context


def n(v: str) -> str:
    return re.sub(r"\s+", " ", v.strip().lower())


def sig(name: str, args: str) -> str:
    types = []
    for arg in args.split(","):
        arg = n(arg)
        if not arg:
            continue
        p = arg.split()
        types.append(" ".join(p[1:]) if len(p) > 1 else p[0])
    return f"{name.lower()}({', '.join(types)})"


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    require_guarded_context(root)
    ddl = root / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql"
    sql = ddl.read_text(encoding="utf-8")
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+LANGUAGE\b",
        re.I | re.S,
    )
    functions = {}
    matches = list(pattern.finditer(sql))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(sql)
        segment = sql[m.start():end]
        key = sig(m.group("name"), m.group("args"))
        functions[key] = {
            "signature": key,
            "name": m.group("name").lower(),
            "returns": n(m.group("returns")),
            "owner": None,
            "security": "DEFINER" if "SECURITY DEFINER" in segment.upper() else "INVOKER",
            "search_path": (
                n(re.search(r"SET\s+search_path\s*=\s*([^\n]+)", segment, re.I).group(1))
                if re.search(r"SET\s+search_path\s*=\s*([^\n]+)", segment, re.I)
                else None
            ),
            "execute_roles": [],
            "calls": [],
        }
    relations = {
        m.group(1).lower()
        for m in re.finditer(
            r"CREATE\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW)\s+"
            r"(app(?:_private)?\.[a-z_][a-z0-9_]*)", sql, re.I
        )
    }
    for item in functions.values():
        occurrences = list(re.finditer(
            rf"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+{re.escape(item['name'])}\s*\(",
            sql, re.I
        ))
        start = occurrences[-1].end()
        next_create = sql.find("\nCREATE ", start)
        boundary = len(sql) if next_create < 0 else next_create
        segment = sql[start:boundary]
        item["calls"] = sorted({
            m.group(1).lower()
            for m in re.finditer(
                r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(", segment, re.I
            )
            if m.group(1).lower() not in relations
        })
    for m in re.finditer(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        sql, re.I | re.S
    ):
        key = sig(m.group(1), m.group(2))
        if key in functions:
            functions[key]["owner"] = m.group(3).lower()
    for m in re.finditer(
        r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+TO\s+([^;]+);",
        sql, re.I | re.S
    ):
        key = sig(m.group(1), m.group(2))
        if key in functions:
            functions[key]["execute_roles"] = sorted(
                set(functions[key]["execute_roles"])
                | {n(x) for x in m.group(3).split(",") if x.strip()}
            )
    names = {item["name"] for item in functions.values()}
    unresolved = sorted({c for item in functions.values() for c in item["calls"]} - names)
    missing_owners = sorted(k for k, v in functions.items() if not v["owner"])
    result = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R3",
        "scope": "STATIC REGISTRY; NOT POSTGRESQL CATALOG",
        "ddl_sha256": hashlib.sha256(ddl.read_bytes()).hexdigest().upper(),
        "function_count": len(functions),
        "missing_owners": missing_owners,
        "unresolved_call_targets": unresolved,
        "functions": sorted(functions.values(), key=lambda x: x["signature"]),
    }
    out = root / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R3.json"
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "functions": len(functions),
        "missing_owners": len(missing_owners),
        "unresolved_call_targets": unresolved,
        "result": "PASS" if not missing_owners and not unresolved else "FAIL",
        "output": str(out),
    }, indent=2))
    return 0 if not missing_owners and not unresolved else 1


if __name__ == "__main__":
    raise SystemExit(main())
