"""Build the final corrections function registry without importing C8 tools."""

from __future__ import annotations

import json
import re
from pathlib import Path


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def signature(name: str, args: str) -> str:
    types = []
    for item in args.split(","):
        item = norm(item)
        if item:
            pieces = item.split()
            types.append(" ".join(pieces[1:]) if len(pieces) > 1 else pieces[0])
    return f"{name.lower()}({', '.join(types)})"


def main() -> int:
    corrections = Path(__file__).resolve().parents[1]
    ddl = corrections / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS.sql"
    if not ddl.is_file():
        raise SystemExit(f"missing DDL: {ddl}")
    sql = ddl.read_text(encoding="utf-8")
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+LANGUAGE\b",
        re.I | re.S,
    )
    relation_pattern = re.compile(
        r"CREATE\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW)\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)",
        re.I,
    )
    relations = {
        item.group(1).lower() for item in relation_pattern.finditer(sql)
    }
    functions = {}
    for match in pattern.finditer(sql):
        body_start = match.end()
        next_create = sql.find("\nCREATE ", body_start)
        next_boundary = len(sql) if next_create < 0 else next_create
        dollar_end = sql.find("$$;", body_start)
        if dollar_end >= 0 and dollar_end < next_boundary:
            body = sql[body_start:dollar_end + 3]
        else:
            semicolon_end = sql.find(";", body_start, next_boundary)
            body = sql[body_start:semicolon_end + 1 if semicolon_end >= 0 else next_boundary]
        key = signature(match.group("name"), match.group("args"))
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
            "calls": sorted({
                item.group(1).lower()
                for item in re.finditer(
                    r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(", body, re.I
                )
                if item.group(1).lower() not in relations
            }),
        }
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
            functions[key]["execute_roles"] = sorted(set(
                functions[key]["execute_roles"]
                + [norm(item) for item in match.group(3).split(",") if item.strip()]
            ))
    called = {call for item in functions.values() for call in item["calls"]}
    known = {item["name"] for item in functions.values()}
    unresolved = sorted(called - known)
    output = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS",
        "scope": "STATIC DESIGN REGISTRY; NOT POSTGRESQL CATALOG INTROSPECTION",
        "call_graph_status": "PASS" if not unresolved else "FAIL",
        "unresolved_call_targets": unresolved,
        "functions": sorted(functions.values(), key=lambda item: item["signature"]),
    }
    out = corrections / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS.json"
    out.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "functions": len(functions),
        "missing_owners": sum(item["owner"] is None for item in functions.values()),
        "unresolved_call_targets": unresolved,
        "output": str(out),
        "result": "PASS" if all(item["owner"] for item in functions.values()) and not unresolved else "FAIL",
    }, indent=2))
    return 0 if all(item["owner"] for item in functions.values()) and not unresolved else 1


if __name__ == "__main__":
    raise SystemExit(main())
