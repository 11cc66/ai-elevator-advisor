"""Independent static audit of R3-C8 Corrections R2."""

from __future__ import annotations

import hashlib
import json
import ast
import re
import struct
import unicodedata
from pathlib import Path

from review_guard import require_guard


EXPECTED_MANIFEST = "45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8"
EXPECTED_KEY_HASHES = {
    "P1_PRODUCT_REMEDIATION_DESIGN_R3_C8_CORRECTIONS_R2.md":
        "82D1E0977AF8F9BDE7EF09F28B3B856E9850A1D87EA27EEDBE62E441258CCB2B",
    "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql":
        "BC626FA93A13D9D2096B3213554AA1C6FFF256D9B66929AC0018BD7D62597E1D",
    "DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R2.sql":
        "A2A8E061F54041431C379E41A9CF7B8232EE7F70F52BF3E7BEEEAA447614FA9C",
    "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R2.json":
        "1DB91C894349FACFE134A1D4237E58048D6A3337F8C0CBED3F96AE61AAADC8F0",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def line_number(text: str, needle: str) -> int:
    pos = text.find(needle)
    return 0 if pos < 0 else text.count("\n", 0, pos) + 1


def matching_paren(text: str, open_pos: int) -> int:
    depth = 0
    quoted = False
    dollar = False
    i = open_pos
    while i < len(text):
        if text.startswith("$$", i):
            dollar = not dollar
            i += 2
            continue
        if not dollar:
            if text[i] == "'" and (i == 0 or text[i - 1] != "\\"):
                quoted = not quoted
            elif not quoted:
                if text[i] == "(":
                    depth += 1
                elif text[i] == ")":
                    depth -= 1
                    if depth == 0:
                        return i
        i += 1
    raise ValueError("unbalanced parentheses")


def split_columns(value: str) -> tuple[str, ...]:
    return tuple(
        compact(item)
        for item in value.split(",")
        if item.strip()
    )


def parse_tables_and_keys(sql: str):
    tables: dict[str, set[str]] = {}
    keys: dict[str, set[tuple[str, ...]]] = {}
    fks: list[dict[str, object]] = []
    blocks: list[tuple[str, str, str, int]] = []
    for match in re.finditer(
        r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*\(",
        sql,
        re.I,
    ):
        table = match.group(1).lower()
        open_pos = sql.find("(", match.start())
        close_pos = matching_paren(sql, open_pos)
        body = sql[open_pos + 1:close_pos]
        line = sql.count("\n", 0, match.start()) + 1
        blocks.append(("create", table, body, line))
        tables.setdefault(table, set())
        keys.setdefault(table, set())
        for column_match in re.finditer(
            r"^\s*([a-z_][a-z0-9_]*)\s+[a-z]",
            body,
            re.I | re.M,
        ):
            column = column_match.group(1).lower()
            if column not in {
                "constraint", "primary", "foreign", "unique", "check", "exclude"
            }:
                tables[table].add(column)
        for key_match in re.finditer(
            r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",
            body,
            re.I | re.S,
        ):
            keys[table].add(split_columns(key_match.group(1)))
        for inline in re.finditer(
            r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",
            body,
            re.I | re.M,
        ):
            keys[table].add((inline.group(1).lower(),))
    for match in re.finditer(
        r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s+([\s\S]*?);",
        sql,
        re.I,
    ):
        table = match.group(1).lower()
        body = match.group(2)
        line = sql.count("\n", 0, match.start()) + 1
        blocks.append(("alter", table, body, line))
        tables.setdefault(table, set())
        keys.setdefault(table, set())
        for column in re.finditer(
            r"ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)",
            body,
            re.I,
        ):
            tables[table].add(column.group(1).lower())
        for key_match in re.finditer(
            r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",
            body,
            re.I | re.S,
        ):
            keys[table].add(split_columns(key_match.group(1)))
    for index_match in re.finditer(
        r"CREATE\s+UNIQUE\s+INDEX\s+[a-z_][a-z0-9_]*\s+"
        r"ON\s+(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
        sql,
        re.I | re.S,
    ):
        table = index_match.group(1).lower()
        keys.setdefault(table, set()).add(split_columns(index_match.group(2)))
    for kind, table, body, line in blocks:
        for fk_match in re.finditer(
            r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
            r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
            body,
            re.I | re.S,
        ):
            fks.append({
                "source_table": table,
                "source_columns": split_columns(fk_match.group(1)),
                "target_table": fk_match.group(2).lower(),
                "target_columns": split_columns(fk_match.group(3)),
                "definition_kind": kind,
                "line": line + body.count("\n", 0, fk_match.start()),
            })
    return tables, keys, fks


def function_signature(name: str, args: str) -> str:
    types = []
    for item in args.split(","):
        item = compact(item)
        if not item:
            continue
        pieces = item.split()
        types.append(" ".join(pieces[1:]) if len(pieces) > 1 else pieces[0])
    return f"{name.lower()}({', '.join(types)})"


def parse_functions(sql: str):
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+LANGUAGE\b",
        re.I | re.S,
    )
    functions: dict[str, dict[str, object]] = {}
    matches = list(pattern.finditer(sql))
    for index, match in enumerate(matches):
        boundary = (
            matches[index + 1].start()
            if index + 1 < len(matches)
            else len(sql)
        )
        segment = sql[match.start():boundary]
        key = function_signature(match.group("name"), match.group("args"))
        functions[key] = {
            "signature": key,
            "name": match.group("name").lower(),
            "returns": compact(match.group("returns")),
            "security_definer": "security definer" in compact(segment),
            "search_path": (
                re.search(r"SET\s+search_path\s*=\s*([^\n]+)", segment, re.I)
                .group(1)
                .strip()
                if re.search(r"SET\s+search_path\s*=\s*([^\n]+)", segment, re.I)
                else None
            ),
            "start_line": sql.count("\n", 0, match.start()) + 1,
            "body": segment,
        }
    for owner in re.finditer(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        sql,
        re.I | re.S,
    ):
        key = function_signature(owner.group(1), owner.group(2))
        if key in functions:
            functions[key]["owner"] = owner.group(3).lower()
    return functions


def parse_triggers(sql: str):
    triggers = []
    pattern = re.compile(
        r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+(?P<name>[a-z_][a-z0-9_]*)"
        r"[\s\S]*?\bON\s+(?P<table>app\.[a-z_][a-z0-9_]*)"
        r"[\s\S]*?EXECUTE\s+FUNCTION\s+"
        r"(?P<function>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(\s*\)",
        re.I,
    )
    for match in pattern.finditer(sql):
        triggers.append({
            "name": match.group("name").lower(),
            "table": match.group("table").lower(),
            "function": match.group("function").lower(),
            "line": sql.count("\n", 0, match.start()) + 1,
        })
    return triggers


def find_function(functions: dict[str, dict[str, object]], name: str):
    return next(
        (item for item in functions.values() if item["name"] == name),
        {},
    )


def c6_snapshot_result(fixture_path: Path, hex_path: Path) -> dict[str, object]:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))

    def u16(value: int) -> bytes:
        return struct.pack(">H", value)

    def u32(value: int) -> bytes:
        return struct.pack(">I", value)

    def u64(value: int) -> bytes:
        return struct.pack(">Q", value)

    def i64(value: object) -> bytes:
        return struct.pack(">q", int(value))

    def ascii_bytes(value: object, empty: bool = False) -> bytes:
        if not isinstance(value, str) or (not value and not empty):
            raise ValueError("ASCII value")
        payload = value.encode("ascii")
        if len(payload) > 64 or any(byte < 0x20 or byte > 0x7E for byte in payload):
            raise ValueError("ASCII domain")
        return payload

    def source_key(parts: list[list[object]]) -> bytes:
        out = bytearray(b"SRC3" + u16(3) + u16(4))
        for index, (_, kind, value) in enumerate(parts, 1):
            if value is None:
                tag, presence, payload = 0, 0, b""
            elif kind == "ASCII":
                tag, presence, payload = 1, 1, ascii_bytes(value)
            else:
                payload = unicodedata.normalize("NFC", str(value)).encode("utf-8")
                tag, presence = 2, 1
            out += u16(index) + bytes((tag, presence)) + u32(len(payload)) + payload
        out += u16(0xFFFF)
        if len(out) > 362:
            raise ValueError("SourceKey limit")
        return bytes(out)

    def stable(record_type: int, values: list[list[object]]) -> bytes:
        out = bytearray(b"SKR2" + u16(2) + u16(3) + u16(record_type) + u16(len(values)))
        for index, (_, kind, value) in enumerate(values, 1):
            if kind == "ASCII_ID":
                tag, payload = 1, ascii_bytes(value, True)
            elif kind == "ASCII_KEY":
                tag, payload = 2, ascii_bytes(value, True)
            elif kind == "INT64":
                tag, payload = 3, i64(value)
            else:
                raise ValueError("stable field")
            out += u16(index) + bytes((tag, 1)) + u32(len(payload)) + payload
        out += u16(0xFFFF)
        if len(out) > 158:
            raise ValueError("stable key limit")
        return bytes(out)

    def scalar(field: dict[str, object]) -> bytes:
        kind = field["type"]
        value = field.get("value")
        if kind == "NULL":
            tag, presence, payload = 0, 0, b""
        elif kind == "BOOLEAN":
            tag, presence, payload = 1, 1, bytes((1 if value else 0,))
        elif kind == "INTEGER":
            tag, presence, payload = 2, 1, i64(value)
        elif kind == "DECIMAL":
            tag, presence, payload = 3, 1, str(value).encode("ascii")
        elif kind == "TEXT":
            tag, presence, payload = 4, 1, str(value).encode("utf-8")
        elif kind == "ENUM":
            tag, presence, payload = 5, 1, ascii_bytes(value)
        elif kind == "CANONICAL_ID":
            tag, presence, payload = 6, 1, ascii_bytes(value)
        elif kind == "TIMESTAMP":
            tag, presence, payload = 7, 1, i64(value)
        elif kind == "BYTES":
            tag, presence, payload = 8, 1, source_key(field["sourceComponents"])
        else:
            raise ValueError("scalar type")
        return u16(int(field["tag"])) + bytes((tag, presence)) + u32(len(payload)) + payload

    encoded = []
    for record in fixture["records"]:
        record_type = int(record["recordType"])
        key = stable(record_type, record["stableKeyTuple"])
        row_id = ascii_bytes(record["rowId"])
        fields = sorted(record["fields"], key=lambda item: int(item["tag"]))
        body = b"".join(scalar(item) for item in fields)
        inner = (
            u16(record_type) + u16(len(row_id)) + row_id
            + u16(len(key)) + key + u16(len(fields)) + body
        )
        encoded.append((record_type, key, row_id, u32(len(inner) + 4) + inner))
    encoded.sort(key=lambda item: (item[0], item[1], item[2]))
    body = b"".join(item[3] for item in encoded)
    basis = (
        b"R3BASIS\0" + u16(6) + u16(1) + u32(28)
        + u32(len(encoded)) + u64(len(body)) + body
    )
    documented = next(
        line.strip()
        for line in hex_path.read_text(encoding="utf-8").splitlines()
        if len(line.strip()) > 100 and re.fullmatch(r"[0-9A-F]+", line.strip())
    )
    digest = hashlib.sha256(basis).hexdigest().upper()
    return {
        "records": len(encoded),
        "types": [item[0] for item in encoded],
        "bytes": len(basis),
        "sha256": digest,
        "hex_match": basis.hex().upper() == documented,
        "source_key_max_bytes": 362,
        "basis_max_bytes": 512,
        "sk_r2_registry_code": 3,
        "pass": (
            len(encoded) == 15
            and len(basis) == 4036
            and digest == "7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB"
            and basis.hex().upper() == documented
        ),
    }


def verify_manifest(design_root: Path, manifest: Path):
    repo = design_root.parents[2]
    design_prefix = design_root.relative_to(repo).as_posix() + "/"
    rows = manifest.read_text(encoding="utf-8").splitlines()
    listed = []
    errors = []
    covered_bytes = 0
    covered_lines = 0
    for row in rows:
        match = re.fullmatch(r"([0-9A-F]{64}) (\d+) (\d+) (.+)", row)
        if not match:
            errors.append({"kind": "format", "row": row})
            continue
        recorded_path = match.group(4)
        if not recorded_path.startswith(design_prefix):
            errors.append({"kind": "path", "path": recorded_path})
            continue
        rel = recorded_path[len(design_prefix):]
        listed.append(rel)
        path = design_root / rel
        if not path.is_file():
            errors.append({"kind": "missing", "path": rel})
            continue
        payload = path.read_bytes()
        covered_bytes += len(payload)
        covered_lines += len(payload.decode("utf-8").splitlines())
        actual_hash = hashlib.sha256(payload).hexdigest().upper()
        if actual_hash != match.group(1):
            errors.append({"kind": "hash", "path": rel})
        if len(payload) != int(match.group(2)):
            errors.append({"kind": "bytes", "path": rel})
        if len(payload.decode("utf-8").splitlines()) != int(match.group(3)):
            errors.append({"kind": "lines", "path": rel})
    actual = sorted(
        path.relative_to(design_root).as_posix()
        for path in design_root.rglob("*")
        if path.is_file() and path != manifest
    )
    coverage = sorted(set(listed) ^ set(actual))
    return {
        "records": len(rows),
        "unique_paths": len(set(listed)),
        "actual_files_including_manifest": len(actual) + 1,
        "covered_bytes": covered_bytes,
        "covered_lines": covered_lines,
        "errors": errors,
        "coverage_differences": coverage,
    }


def main() -> int:
    guard = require_guard()
    review_root = Path(__file__).resolve().parents[1]
    repo = review_root.parents[2]
    r2 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"
    manifest = r2 / "SHA256SUMS_R3_C8_CORRECTIONS_R2.txt"
    ddl_path = r2 / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql"
    overlay_path = r2 / "DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R2.sql"
    registry_path = r2 / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R2.json"
    main_design = r2 / "P1_PRODUCT_REMEDIATION_DESIGN_R3_C8_CORRECTIONS_R2.md"
    sql = ddl_path.read_text(encoding="utf-8")
    overlay = overlay_path.read_text(encoding="utf-8")
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    manifest_result = verify_manifest(r2, manifest)
    key_hashes = {
        rel: sha256(r2 / rel)
        for rel in EXPECTED_KEY_HASHES
    }
    tables, keys, fks = parse_tables_and_keys(sql)
    functions = parse_functions(sql)
    triggers = parse_triggers(sql)
    c6 = c6_snapshot_result(
        repo / "docs/product/full-mvp-remediation-design-r3-c6/C6_SNAPSHOT_VECTOR_01.json",
        repo / "docs/product/full-mvp-remediation-design-r3-c6/C6_SNAPSHOT_VECTOR_01_HEX.md",
    )
    historical_manifests = {
        "c8_design": (
            repo / "docs/product/full-mvp-remediation-design-r3-c8/SHA256SUMS_R3_C8.txt",
            "672D6206D06E4282F7C8684A3811654EEDDA72E52C55B6EDF2C324B5C131E853",
        ),
        "c8_review": (
            repo / "docs/product/full-mvp-remediation-review-r3-c8/SHA256SUMS_R3_C8_REVIEW.txt",
            "2E895560FB3EDEEE938395E2626D0ECBE4939EA18D4A4A573FE159960E1BE611",
        ),
        "corrections_r1_design": (
            repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections/SHA256SUMS_R3_C8_CORRECTIONS.txt",
            "0ACBBB3A4CB5F0439302E7F7109F0ECFDCFDE50843D74941E232F830ECE552A2",
        ),
        "corrections_r1_review": (
            repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections/SHA256SUMS_R3_C8_CORRECTIONS_REVIEW.txt",
            "E71FA990581B70357F3D4103C1BF29E442665DD695459C524CC723D41DA63465",
        ),
        "c7_design": (
            repo / "docs/product/full-mvp-remediation-design-r3-c7/SHA256SUMS_R3_C7.txt",
            "160A2BB8F93F473063225A2DBE04C8F807E456E1B50C4DF0D82B861B84BF3094",
        ),
        "c7_review": (
            repo / "docs/product/full-mvp-remediation-review-r3-c7/SHA256SUMS_R3_C7_REVIEW.txt",
            "5254758B8B47AEBB8E591CBB380F371398EE59035D48D239D02331E09FFCC118",
        ),
    }
    historical_manifest_results = {
        name: {
            "actual": sha256(path),
            "expected": expected,
            "match": sha256(path) == expected,
        }
        for name, (path, expected) in historical_manifests.items()
    }
    function_names = {item["name"] for item in functions.values()}
    table_names = set(tables)
    fk_errors = []
    for fk in fks:
        if len(fk["source_columns"]) != len(fk["target_columns"]):
            fk_errors.append({**fk, "reason": "arity"})
        if fk["target_table"] not in table_names:
            fk_errors.append({**fk, "reason": "missing_target_table"})
        elif fk["target_columns"] not in keys.get(fk["target_table"], set()):
            fk_errors.append({**fk, "reason": "target_not_unique_or_missing"})
        if fk["source_table"] not in table_names:
            fk_errors.append({**fk, "reason": "missing_source_table"})
        else:
            missing_source = [
                column for column in fk["source_columns"]
                if column not in tables.get(fk["source_table"], set())
            ]
            if missing_source:
                fk_errors.append({
                    **fk,
                    "reason": "missing_source_columns",
                    "columns": missing_source,
                })
        if fk["target_table"] in table_names:
            missing_target = [
                column for column in fk["target_columns"]
                if column not in tables.get(fk["target_table"], set())
            ]
            if missing_target:
                fk_errors.append({
                    **fk,
                    "reason": "missing_target_columns",
                    "columns": missing_target,
                })
    trigger_errors = []
    function_start_lines: dict[str, int] = {}
    for function_match in re.finditer(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(",
        sql,
        re.I,
    ):
        function_name = function_match.group(1).lower()
        line = sql.count("\n", 0, function_match.start()) + 1
        function_start_lines[function_name] = min(
            line,
            function_start_lines.get(function_name, line),
        )
    for trigger in triggers:
        if trigger["table"] not in table_names:
            trigger_errors.append({**trigger, "reason": "missing_table"})
        if trigger["function"] not in function_names:
            trigger_errors.append({**trigger, "reason": "missing_function"})
        elif trigger["line"] < function_start_lines.get(trigger["function"], 0):
            trigger_errors.append({**trigger, "reason": "trigger_precedes_function"})
    registry_functions = {
        item["signature"]: item for item in registry.get("functions", [])
    }
    signature_missing = sorted(set(functions) - set(registry_functions))
    signature_extra = sorted(set(registry_functions) - set(functions))
    owner_mismatches = []
    return_mismatches = []
    security_mismatches = []
    for signature in sorted(set(functions) & set(registry_functions)):
        source = functions[signature]
        registered = registry_functions[signature]
        if source.get("owner") != registered.get("owner"):
            owner_mismatches.append({
                "signature": signature,
                "ddl": source.get("owner"),
                "registry": registered.get("owner"),
            })
        if source.get("returns") != registered.get("returns"):
            return_mismatches.append({
                "signature": signature,
                "ddl": source.get("returns"),
                "registry": registered.get("returns"),
            })
        source_security = "DEFINER" if source.get("security_definer") else "INVOKER"
        if source_security != registered.get("security"):
            security_mismatches.append({
                "signature": signature,
                "ddl": source_security,
                "registry": registered.get("security"),
            })

    overlay_start = sql.find("-- ===== BEGIN R3-C8 CORRECTIONS R2 OVERLAY =====")
    r2_function_names = {
        name
        for name, item in functions.items()
        if int(item["start_line"]) > sql.count("\n", 0, overlay_start) + 1
    }
    explicit_public_revoke_lines = [
        line
        for line in overlay.splitlines()
        if "REVOKE" in line.upper() and "PUBLIC" in line.upper()
    ]
    dangerous_new_functions = []
    for signature in sorted(r2_function_names):
        item = functions[signature]
        if str(item["name"]).startswith("app_private.a_"):
            continue
        body = compact(str(item["body"]))
        identity_check = any(
            token in body
            for token in (
                "session_user", "lock_current_session",
                "validate_session_role_r3", "pg_backend_pid"
            )
        )
        if item.get("security_definer") and not identity_check:
            dangerous_new_functions.append({
                "signature": signature,
                "line": item["start_line"],
                "risk": "SECURITY DEFINER with no internal caller identity check; "
                        "PUBLIC EXECUTE must be explicitly revoked",
            })

    principal_check_gaps = []
    full_root_complete = next(
        (
            item for item in functions.values()
            if item["name"] == "app.bootstrap_complete_root_r3"
            and "p_request_id" in str(item["body"])
        ),
        {},
    )
    full_root_body = compact(str(full_root_complete.get("body", "")))
    if (
        "app.trusted_principal" not in full_root_body
        or "state='active'" not in full_root_body
    ):
        principal_check_gaps.append(
            "bootstrap_complete_root_r3 does not verify the root Principal is ACTIVE"
        )

    bootstrap_lifecycle_mutability_errors = []
    approval_body = sql.split(
        "CREATE TABLE app.bootstrap_approval_r2", 1
    )[1].split(");", 1)[0]
    root_session_alter = sql[
        sql.find("ALTER TABLE app.bootstrap_root_session_r2"):
        sql.find("CREATE TABLE app.bootstrap_event_r2")
    ]
    execute_root_change_line = line_number(
        sql, "CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r2"
    )
    execute_root_change_segment = sql[
        sql.find("CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r2"):
    ]
    if "REFERENCES app.bootstrap_lifecycle_r2" in approval_body:
        bootstrap_lifecycle_mutability_errors.append({
            "object": "bootstrap_approval_r2",
            "line": line_number(sql, "FOREIGN KEY (bootstrap_id,bootstrap_generation,root_principal_id)"),
            "reason": "historical approval references mutable current lifecycle row",
        })
    if "REFERENCES app.bootstrap_lifecycle_r2" in root_session_alter:
        bootstrap_lifecycle_mutability_errors.append({
            "object": "bootstrap_root_session_r2",
            "line": line_number(sql, "bootstrap_root_session_generation_fk_r2"),
            "reason": "historical root session references mutable current lifecycle row",
        })

    recovery_idempotency = []
    approve_recovery = find_function(
        functions, "app.approve_command_result_recovery_r2"
    )
    execute_recovery = find_function(
        functions, "app.execute_command_result_recovery_r2"
    )
    for name, item in (
        ("approve_result_recovery", approve_recovery),
        ("execute_result_recovery", execute_recovery),
    ):
        body = compact(str(item.get("body", "")))
        state_pos = body.find("rr.state")
        claim_pos = body.find("claim_command_request")
        if state_pos >= 0 and (claim_pos < 0 or state_pos < claim_pos):
            recovery_idempotency.append({
                "function": name,
                "line": item.get("start_line"),
                "reason": "terminal state is checked before Request Ledger replay",
            })
    execute_root = find_function(
        functions, "app.bootstrap_execute_root_change_r2"
    )
    if execute_root:
        root_body = compact(str(execute_root.get("body", "")))
        if root_body.find("from app.bootstrap_lifecycle_r2") < root_body.find(
            "claim_bootstrap_request_r2"
        ):
            recovery_idempotency.append({
                "function": "bootstrap_execute_root_change_r2",
                "line": execute_root.get("start_line"),
                "reason": "old generation lookup occurs before Request Ledger replay",
            })

    result_recovery_table = sql.split(
        "CREATE TABLE app.command_result_recovery_r2", 1
    )[1].split(");", 1)[0]
    one_time_recovery_constraint = (
        "UNIQUE (operation,command_request_id)" in compact(result_recovery_table)
        or "UNIQUE INDEX" in result_recovery_table.upper()
        and "command_request_id" in result_recovery_table.lower()
        and "WHERE" in result_recovery_table.upper()
    )

    advisory_lock_used = "pg_advisory" in compact(overlay)
    owner_docs_claim_lock = "advisory lock" in (
        r2 / "OWNER_PRIVILEGE_CLOSURE_R3_C8_R2.md"
    ).read_text(encoding="utf-8").lower()

    binding_table = sql.split(
        "CREATE TABLE app.catalog_source_target_binding_r2", 1
    )[1].split(");", 1)[0]
    binding_actor_grant_fk = (
        "created_by_session_id,created_by_authority_grant_id" in compact(binding_table)
        and "authority_grant" in binding_table.lower()
    )

    begin_root = find_function(functions, "app.bootstrap_begin_root_change_r2")
    state_machine_retry_gap = (
        "root_issuance_pending" in compact(overlay)
        and "lc.state not in ('bootstrap_completed','root_rotated','locked')" in compact(overlay)
        and "root_issuance_pending" not in compact(str(begin_root.get("body", "")))
    )
    recovery_expiry_fields = [
        field for field in ("expires_at", "approval_expires_at")
        if field in sql.split("CREATE TABLE app.bootstrap_recovery_r2", 1)[1].split(");", 1)[0]
    ]

    self_validator = (r2 / "tools/validate_r2.py").read_text(encoding="utf-8")
    validator_tree = ast.parse(self_validator)
    self_mutation_count = None
    for node in ast.walk(validator_tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "mutations"
            for target in node.targets
        ):
            if isinstance(node.value, ast.Dict):
                self_mutation_count = len(node.value.keys)
            break
    r6_evidence = json.loads(
        (r2 / "evidence/OFFLINE_VECTOR_AND_CASE_EVIDENCE_R3_C8_CORRECTIONS_R2.json")
        .read_text(encoding="utf-8")
    )
    self_validator_limitations = {
        "mutation_count": self_mutation_count,
        "uses_text_markers": "compact(sql)" in self_validator,
        "has_sql_parser": any(token in self_validator.lower() for token in ("sqlparse", "pglast", "libpg_query")),
        "checks_public_explain": "public" in self_validator.lower() and "execute" in self_validator.lower(),
    }

    open_doc = (r2 / "OPEN_DECISIONS_DISPOSITION_R3_C8_CORRECTIONS_R2.md").read_text(encoding="utf-8")
    decision_ids = sorted(set(re.findall(r"`(OD-[^`]+)`", open_doc)))

    result = {
        "scope": "INDEPENDENT STATIC REVIEW; NO DATABASE OR RUNTIME",
        "guard": guard,
        "input_manifest": manifest_result,
        "manifest_hash": sha256(manifest),
        "manifest_hash_expected": EXPECTED_MANIFEST,
        "key_hashes": key_hashes,
        "key_hashes_expected": EXPECTED_KEY_HASHES,
        "key_hashes_match": key_hashes == EXPECTED_KEY_HASHES,
        "object_inventory": {
            "tables": len(tables),
            "foreign_keys": len(fks),
            "functions": len(functions),
            "triggers": len(triggers),
            "roles": len(set(re.findall(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", sql, re.I))),
        },
        "registry": {
            "declared_count": registry.get("function_count"),
            "parsed_count": len(functions),
            "missing_from_registry": signature_missing,
            "extra_in_registry": signature_extra,
            "owner_mismatches": owner_mismatches,
            "return_mismatches": return_mismatches,
            "security_mismatches": security_mismatches,
            "registry_claims_no_missing_owners": not registry.get("missing_owners"),
            "registry_claims_no_unresolved_calls": not registry.get("unresolved_call_targets"),
        },
        "fk_errors": fk_errors,
        "trigger_errors": trigger_errors,
        "r2_function_count": len(r2_function_names),
        "explicit_public_revoke_lines": explicit_public_revoke_lines,
        "dangerous_new_functions_without_identity_or_public_revoke": dangerous_new_functions,
        "bootstrap_lifecycle_mutability_errors": bootstrap_lifecycle_mutability_errors,
        "principal_activation_gaps": principal_check_gaps,
        "recovery_idempotency_errors": recovery_idempotency,
        "one_time_result_recovery_constraint": one_time_recovery_constraint,
        "owner_advisory_lock_present": advisory_lock_used,
        "owner_document_claims_advisory_lock": owner_docs_claim_lock,
        "catalog_binding_actor_grant_fk": binding_actor_grant_fk,
        "root_change_retry_state_gap": state_machine_retry_gap,
        "bootstrap_recovery_expiry_fields": recovery_expiry_fields,
        "self_validator_limitations": self_validator_limitations,
        "open_decision_ids": {
            "count": len(decision_ids),
            "unique": len(set(decision_ids)),
            "ids": decision_ids,
        },
        "historical_manifests": historical_manifest_results,
        "c6_snap_01": c6,
        "r6_vector_evidence": {
            "scalar": r6_evidence.get("r6_compatibility", {}).get("scalar_passed"),
            "scalar_total": r6_evidence.get("r6_compatibility", {}).get("scalar_total"),
            "resource": r6_evidence.get("r6_compatibility", {}).get("resource_passed"),
            "resource_total": r6_evidence.get("r6_compatibility", {}).get("resource_total"),
            "all_case_matrices_pass": r6_evidence.get("all_case_matrices_pass"),
        },
        "postgresql_grammar": "NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_compilation": "NOT VERIFIED — DATABASE NOT AUTHORIZED",
        "catalog_introspection": "NOT VERIFIED — DATABASE NOT AUTHORIZED",
        "runtime": "NOT EXECUTED",
    }
    out = review_root / "VALIDATION_EVIDENCE_R3_C8_CORRECTIONS_R2.json"
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "manifest_ok": not manifest_result["errors"] and not manifest_result["coverage_differences"],
        "key_hashes_match": result["key_hashes_match"],
        "object_inventory": result["object_inventory"],
        "fk_errors": len(fk_errors),
        "trigger_errors": len(trigger_errors),
        "registry_mismatches": {
            "missing": len(signature_missing),
            "extra": len(signature_extra),
            "owners": len(owner_mismatches),
            "returns": len(return_mismatches),
            "security": len(security_mismatches),
        },
        "dangerous_public_functions": len(dangerous_new_functions),
        "bootstrap_lifecycle_fk_risks": len(bootstrap_lifecycle_mutability_errors),
        "recovery_idempotency_errors": len(recovery_idempotency),
        "one_time_recovery_constraint": one_time_recovery_constraint,
        "owner_advisory_lock_present": advisory_lock_used,
        "catalog_binding_actor_grant_fk": binding_actor_grant_fk,
        "open_decisions": result["open_decision_ids"],
        "c6": c6,
        "output": str(out),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
