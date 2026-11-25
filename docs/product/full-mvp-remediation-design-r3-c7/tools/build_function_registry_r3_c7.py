"""Generate the machine-readable R3-C7 function signature registry from DDL."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def split_args(value: str) -> list[str]:
    if not value.strip():
        return []
    return [normalize(part) for part in value.split(",")]


def argument_types(args: list[str]) -> list[str]:
    result = []
    for argument in args:
        pieces = argument.split()
        result.append(" ".join(pieces[1:]) if len(pieces) > 1 else argument)
    return result


def signature(name: str, args: list[str]) -> str:
    return f"{name.lower()}({', '.join(argument_types(args))})"


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_function_registry_r3_c7.py <ddl.sql> <output.json>")
    ddl_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    sql = ddl_path.read_text(encoding="utf-8")

    create_pattern = re.compile(
        r"CREATE\s+FUNCTION\s+(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)"
        r"\s*\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+LANGUAGE\b",
        re.IGNORECASE | re.DOTALL,
    )
    entries: list[dict[str, object]] = []
    for match in create_pattern.finditer(sql):
        body_start = match.end()
        next_create = sql.find("\nCREATE ", body_start)
        body_end = len(sql) if next_create < 0 else next_create
        body = sql[body_start:body_end]
        name = match.group("name").lower()
        args = split_args(match.group("args"))
        search_path_match = re.search(
            r"SET\s+search_path\s*=\s*([^\n]+)",
            body,
            re.IGNORECASE,
        )
        entries.append({
            "signature": signature(name, args),
            "schema": name.split(".", 1)[0],
            "name": name.split(".", 1)[1],
            "argument_types": argument_types(args),
            "returns": normalize(match.group("returns")),
            "security": "DEFINER" if "SECURITY DEFINER" in body.upper() else "INVOKER",
            "search_path": normalize(search_path_match.group(1)) if search_path_match else None,
            "owner": None,
            "execute_roles": [],
            "public_execute": False,
        })

    by_signature = {entry["signature"]: entry for entry in entries}

    owner_pattern = re.compile(
        r"ALTER\s+FUNCTION\s+(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)"
        r"\s*\((?P<args>.*?)\)\s+OWNER\s+TO\s+(?P<owner>[a-z_][a-z0-9_]*)",
        re.IGNORECASE | re.DOTALL,
    )
    for match in owner_pattern.finditer(sql):
        key = signature(match.group("name"), split_args(match.group("args")))
        if key in by_signature:
            by_signature[key]["owner"] = match.group("owner").lower()

    grant_pattern = re.compile(
        r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)"
        r"\s*\((?P<args>.*?)\)\s+TO\s+(?P<roles>[^;]+);",
        re.IGNORECASE | re.DOTALL,
    )
    for match in grant_pattern.finditer(sql):
        key = signature(match.group("name"), split_args(match.group("args")))
        if key in by_signature:
            roles = [normalize(role) for role in match.group("roles").split(",")]
            by_signature[key]["execute_roles"] = roles

    output = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C7",
        "source": str(ddl_path).replace("\\", "/"),
        "scope": "STATIC DESIGN REGISTRY; NOT POSTGRESQL CATALOG INTROSPECTION",
        "functions": sorted(entries, key=lambda item: item["signature"]),
    }
    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "functions": len(entries),
        "missing_owner": sum(entry["owner"] is None for entry in entries),
        "output": str(output_path).replace("\\", "/"),
        "result": "PASS" if entries and all(entry["owner"] for entry in entries) else "FAIL",
    }, indent=2))
    return 0 if entries and all(entry["owner"] for entry in entries) else 1


if __name__ == "__main__":
    raise SystemExit(main())
