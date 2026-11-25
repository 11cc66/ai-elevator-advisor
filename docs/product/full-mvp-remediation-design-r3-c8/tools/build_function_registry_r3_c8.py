"""Build the R3-C8 final function signature registry after OR REPLACE resolution."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def split_args(value: str) -> list[str]:
    return [normalize(item) for item in value.split(",") if item.strip()]


def signature(name: str, args: str) -> str:
    types = []
    for item in split_args(args):
        pieces = item.split()
        types.append(" ".join(pieces[1:]) if len(pieces) > 1 else item)
    return f"{name.lower()}({', '.join(types)})"


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_function_registry_r3_c8.py <ddl.sql> <output.json>")
    ddl_path, output_path = map(Path, sys.argv[1:])
    sql = ddl_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)"
        r"\s*\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+LANGUAGE\b",
        re.IGNORECASE | re.DOTALL,
    )
    relation_pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|MATERIALIZED\s+VIEW)\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)",
        re.IGNORECASE,
    )
    relations = {
        item.group(1).lower() for item in relation_pattern.finditer(sql)
    }
    entries: dict[str, dict[str, object]] = {}
    for match in pattern.finditer(sql):
        args = split_args(match.group("args"))
        key = signature(match.group("name"), match.group("args"))
        body_start = match.end()
        next_create = sql.find("\nCREATE ", body_start)
        body_end = len(sql) if next_create < 0 else next_create
        body = sql[body_start:body_end]
        search_path = re.search(r"SET\s+search_path\s*=\s*([^\n]+)", body, re.IGNORECASE)
        calls = sorted({
            item.group(1).lower()
            for item in re.finditer(
                r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(",
                body,
                re.IGNORECASE,
            )
            if item.group(1).lower() not in relations
        })
        entries[key] = {
            "signature": key,
            "name": match.group("name").lower(),
            "argument_types": [
                " ".join(item.split()[1:]) if len(item.split()) > 1 else item
                for item in args
            ],
            "returns": normalize(match.group("returns")),
            "owner": None,
            "security": "DEFINER" if "SECURITY DEFINER" in body.upper() else "INVOKER",
            "search_path": normalize(search_path.group(1)) if search_path else None,
            "execute_roles": [],
            "public_execute": False,
            "calls": calls,
        }
    owner_pattern = re.compile(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        re.IGNORECASE | re.DOTALL,
    )
    for match in owner_pattern.finditer(sql):
        key = signature(match.group(1), match.group(2))
        if key in entries:
            entries[key]["owner"] = match.group(3).lower()
    grant_pattern = re.compile(
        r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+TO\s+([^;]+);",
        re.IGNORECASE | re.DOTALL,
    )
    for match in grant_pattern.finditer(sql):
        key = signature(match.group(1), match.group(2))
        if key in entries:
            entries[key]["execute_roles"] = [
                normalize(item) for item in match.group(3).split(",")
            ]
    known_names = {item["name"] for item in entries.values()}
    called_names = {
        called
        for item in entries.values()
        for called in item["calls"]
    }
    unresolved_calls = sorted(called_names - known_names)
    output = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8",
        "source": str(ddl_path).replace("\\", "/"),
        "scope": "STATIC DESIGN REGISTRY; NOT POSTGRESQL CATALOG INTROSPECTION",
        "call_graph_status": (
            "PASS" if not unresolved_calls
            else "FAIL_STATIC_UNRESOLVED_CALL_TARGETS"
        ),
        "unresolved_call_targets": unresolved_calls,
        "functions": sorted(entries.values(), key=lambda item: item["signature"]),
    }
    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    summary = {
        "functions": len(entries),
        "missing_owners": sum(item["owner"] is None for item in entries.values()),
        "call_targets": len(called_names),
        "unresolved_call_targets": unresolved_calls,
        "output": str(output_path).replace("\\", "/"),
        "result": (
            "PASS"
            if entries
            and all(item["owner"] for item in entries.values())
            and not unresolved_calls
            else "FAIL"
        ),
    }
    print(json.dumps(summary, indent=2))
    return 0 if summary["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
