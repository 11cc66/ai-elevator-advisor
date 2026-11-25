"""Build a static final-state function registry for the R2 design DDL."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from guard import require_guarded_context


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def signature(name: str, args: str) -> str:
    types: list[str] = []
    for item in args.split(","):
        item = norm(item)
        if not item:
            continue
        pieces = item.split()
        types.append(" ".join(pieces[1:]) if len(pieces) > 1 else pieces[0])
    return f"{name.lower()}({', '.join(types)})"


def main() -> int:
    r2_root = Path(__file__).resolve().parents[1]
    require_guarded_context(r2_root)
    ddl_path = r2_root / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql"
    if not ddl_path.is_file():
        raise SystemExit(f"missing DDL: {ddl_path}")
    sql = ddl_path.read_text(encoding="utf-8")
    functions: dict[str, dict[str, object]] = {}
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+LANGUAGE\b",
        re.I | re.S,
    )
    for match in pattern.finditer(sql):
        key = signature(match.group("name"), match.group("args"))
        body_start = match.end()
        next_create = sql.find("\nCREATE ", body_start)
        boundary = len(sql) if next_create < 0 else next_create
        dollar_end = sql.find("$$;", body_start, boundary)
        if dollar_end >= 0 and dollar_end < boundary:
            body = sql[body_start:dollar_end + 3]
        else:
            semicolon_end = sql.find(";", body_start, boundary)
            body = sql[body_start:semicolon_end + 1 if semicolon_end >= 0 else boundary]
        functions[key] = {
            "signature": key,
            "name": match.group("name").lower(),
            "returns": norm(match.group("returns")),
            "owner": None,
            "security": "DEFINER" if "SECURITY DEFINER" in body.upper() else "INVOKER",
            "search_path": (
                norm(re.search(r"SET\s+search_path\s*=\s*([^\n]+)", body, re.I).group(1))
                if re.search(r"SET\s+search_path\s*=\s*([^\n]+)", body, re.I)
                else None
            ),
            "execute_roles": [],
            "calls": [],
        }
    relations = {
        item.group(1).lower()
        for item in re.finditer(
            r"CREATE\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW)\s+"
            r"(app(?:_private)?\.[a-z_][a-z0-9_]*)",
            sql,
            re.I,
        )
    }
    for key, item in list(functions.items()):
        name = str(item["name"])
        occurrences = list(re.finditer(
            rf"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+{re.escape(name)}\s*\(",
            sql,
            re.I,
        ))
        if not occurrences:
            continue
        start = occurrences[-1].end()
        next_create = sql.find("\nCREATE ", start)
        boundary = len(sql) if next_create < 0 else next_create
        dollar_end = sql.find("$$;", start, boundary)
        body = sql[start:dollar_end + 3 if dollar_end >= 0 else boundary]
        item["calls"] = sorted({
            match.group(1).lower()
            for match in re.finditer(
                r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(", body, re.I
            )
            if match.group(1).lower() not in relations
        })
    for match in re.finditer(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        sql,
        re.I | re.S,
    ):
        key = signature(match.group(1), match.group(2))
        if key in functions:
            functions[key]["owner"] = match.group(3).lower()
    for match in re.finditer(
        r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+TO\s+([^;]+);",
        sql,
        re.I | re.S,
    ):
        key = signature(match.group(1), match.group(2))
        if key in functions:
            roles = {
                norm(item)
                for item in match.group(3).split(",")
                if item.strip()
            }
            functions[key]["execute_roles"] = sorted(
                set(functions[key]["execute_roles"]) | roles
            )
    called = {call for item in functions.values() for call in item["calls"]}
    known = {item["name"] for item in functions.values()}
    unresolved = sorted(called - known)
    missing_owners = sorted(
        item["signature"] for item in functions.values() if not item["owner"]
    )
    output = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R2",
        "scope": "STATIC DESIGN REGISTRY; NOT POSTGRESQL CATALOG INTROSPECTION",
        "ddl_sha256": hashlib.sha256(ddl_path.read_bytes()).hexdigest().upper(),
        "function_count": len(functions),
        "missing_owners": missing_owners,
        "unresolved_call_targets": unresolved,
        "call_graph_status": "PASS" if not unresolved else "FAIL",
        "functions": sorted(functions.values(), key=lambda item: item["signature"]),
    }
    out = r2_root / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R2.json"
    out.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    result = "PASS" if not unresolved and not missing_owners else "FAIL"
    print(json.dumps({
        "functions": len(functions),
        "missing_owners": len(missing_owners),
        "unresolved_call_targets": unresolved,
        "result": result,
        "output": str(out),
    }, indent=2))
    return 0 if result == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
