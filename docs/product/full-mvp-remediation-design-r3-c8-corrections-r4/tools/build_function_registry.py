"""Build the independent static R4 function and effective ACL registry."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from guard import require_guard


FUNCTION_RE = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
    r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
    r"\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+"
    r"LANGUAGE\s+(?P<language>[a-z_][a-z0-9_]*)",
    re.I | re.S,
)


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def signature(name: str, args: str) -> str:
    types: list[str] = []
    for arg in args.split(","):
        value = norm(arg)
        if not value:
            continue
        words = value.split()
        types.append(" ".join(words[1:]) if len(words) > 1 else words[0])
    return f"{name.lower()}({', '.join(types)})"


def final_functions(sql: str) -> dict[str, dict[str, object]]:
    result: dict[str, dict[str, object]] = {}
    matches = list(FUNCTION_RE.finditer(sql))
    for index, match in enumerate(matches):
        segment_end = (
            matches[index + 1].start() if index + 1 < len(matches) else len(sql)
        )
        segment = sql[match.start():segment_end]
        quoted = re.search(
            r"\bAS\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)(.*?)\1\s*;",
            segment,
            re.I | re.S,
        )
        returned = re.search(r"\bRETURN\s+(.*?);", segment, re.I | re.S)
        body = (
            quoted.group(2)
            if quoted
            else returned.group(1) if returned else ""
        )
        body_start = quoted.start() if quoted else returned.start() if returned else 0
        attrs = norm(segment[match.end():body_start])
        key = signature(match.group("name"), match.group("args"))
        search = re.search(r"set search_path\s*=\s*([^\n]+)", attrs, re.I)
        result[key] = {
            "signature": key,
            "name": match.group("name").lower(),
            "returns": norm(match.group("returns")),
            "owner": None,
            "security": "DEFINER" if "security definer" in attrs else "INVOKER",
            "search_path": norm(search.group(1)) if search else None,
            "execute_roles": [],
            "calls": [],
            "_body": body,
        }
    return result


def effective_grants(sql: str) -> dict[str, list[str]]:
    grants: dict[str, set[str]] = {}
    event_re = re.compile(
        r"\b(GRANT|REVOKE)\s+EXECUTE\s+ON\s+FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((?P<args>.*?)\)\s+(?:TO|FROM)\s+(?P<roles>[^;]+);",
        re.I | re.S,
    )
    for event in event_re.finditer(sql):
        key = signature(event.group("name"), event.group("args"))
        roles = {
            norm(role)
            for role in event.group("roles").split(",")
            if role.strip()
        }
        current = grants.setdefault(key, set())
        if event.group(1).upper() == "GRANT":
            current.update(role for role in roles if role != "public")
        else:
            current.difference_update(role for role in roles if role != "public")
    return {
        key: sorted(roles)
        for key, roles in sorted(grants.items())
        if roles
    }


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    require_guard(root)
    ddl_path = root / "DATABASE_COMPLETE_DDL_DESIGN_R4.sql"
    sql = ddl_path.read_text(encoding="utf-8")

    functions = final_functions(sql)
    for event in re.finditer(
        r"ALTER\s+FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        sql,
        re.I | re.S,
    ):
        key = signature(event.group(1), event.group(2))
        if key in functions:
            functions[key]["owner"] = event.group(3).lower()

    grants = effective_grants(sql)
    names = {str(item["name"]) for item in functions.values()}
    relations = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW)\s+"
            r"(app(?:_private)?\.[a-z_][a-z0-9_]*)",
            sql,
            re.I,
        )
    }
    for key, item in functions.items():
        body = str(item.pop("_body"))
        item["execute_roles"] = grants.get(key, [])
        item["calls"] = sorted(
            {
                match.group(1).lower()
                for match in re.finditer(
                    r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(",
                    body,
                    re.I,
                )
                if match.group(1).lower() not in relations
            }
        )

    unresolved = sorted(
        {
            call
            for item in functions.values()
            for call in item["calls"]
            if call not in names
        }
    )
    missing_owners = sorted(
        key for key, item in functions.items() if not item["owner"]
    )
    result = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R4",
        "scope": "STATIC FINAL-FUNCTION REGISTRY; NOT POSTGRESQL CATALOG",
        "ddl_sha256": hashlib.sha256(ddl_path.read_bytes()).hexdigest().upper(),
        "function_count": len(functions),
        "missing_owners": missing_owners,
        "unresolved_call_targets": unresolved,
        "effective_capability_grants": grants,
        "functions": sorted(functions.values(), key=lambda item: item["signature"]),
    }
    output = root / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R4.json"
    output.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    ok = not missing_owners and not unresolved
    print(json.dumps({
        "functions": len(functions),
        "missing_owners": len(missing_owners),
        "unresolved_call_targets": unresolved,
        "effective_grant_signatures": len(grants),
        "result": "PASS" if ok else "FAIL",
        "output": str(output),
    }, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
