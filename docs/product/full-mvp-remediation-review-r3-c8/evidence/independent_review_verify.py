"""Independent R3-C8 design review checks.

This script does not import or execute any R3-C8 tool. It uses only Python's
standard library and treats every SQL check as static text analysis, not as
PostgreSQL grammar, compilation, Catalog, trigger, ACL, or runtime evidence.
"""

from __future__ import annotations

import hashlib
import json
import re
import struct
import sys
import unicodedata
from pathlib import Path


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def line_count(path: Path) -> int:
    return len(path.read_text(encoding="utf-8").splitlines())


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def u16(value: int) -> bytes:
    return struct.pack(">H", value)


def u32(value: int) -> bytes:
    return struct.pack(">I", value)


def u64(value: int) -> bytes:
    return struct.pack(">Q", value)


def i64(value: object) -> bytes:
    if isinstance(value, bool):
        raise ValueError("INTEGER_TYPE")
    return struct.pack(">q", int(value))


def ascii_bytes(value: object, empty: bool = False) -> bytes:
    if not isinstance(value, str) or (not value and not empty):
        raise ValueError("ASCII_TYPE")
    payload = value.encode("ascii")
    if len(payload) > 64 or any(byte < 0x20 or byte > 0x7E for byte in payload):
        raise ValueError("ASCII_DOMAIN")
    return payload


def source_aux(value: object) -> bytes:
    if not isinstance(value, str):
        raise ValueError("SOURCE_UTF8_INVALID")
    normalized = unicodedata.normalize("NFC", value)
    if not normalized:
        raise ValueError("SOURCE_AUX_EMPTY")
    if any(ord(char) < 0x20 or 0x7F <= ord(char) <= 0x9F for char in normalized):
        raise ValueError("SOURCE_AUX_CONTROL")
    payload = normalized.encode("utf-8")
    if len(payload) > 128:
        raise ValueError("SOURCE_AUX_LENGTH")
    return payload


def source_key(components: list[list[object]]) -> bytes:
    if len(components) != 4:
        raise ValueError("SOURCE_COMPONENT_COUNT")
    result = bytearray(b"SRC3" + u16(3) + u16(4))
    for index, component in enumerate(components, 1):
        if len(component) != 3:
            raise ValueError("SOURCE_COMPONENT_SHAPE")
        _, kind, value = component
        if value is None:
            if kind != "UTF8_NULLABLE":
                raise ValueError("SOURCE_NULL_DOMAIN")
            tag, presence, payload = 0, 0, b""
        elif kind == "ASCII":
            tag, presence, payload = 1, 1, ascii_bytes(value)
        elif kind == "UTF8_NULLABLE":
            tag, presence, payload = 2, 1, source_aux(value)
        else:
            raise ValueError("SOURCE_COMPONENT_TYPE")
        result += u16(index) + bytes((tag, presence)) + u32(len(payload)) + payload
    result += u16(0xFFFF)
    if len(result) > 362:
        raise ValueError("SOURCE_KEY_LENGTH")
    return bytes(result)


def stable_key(record_type: int, values: list[list[object]]) -> bytes:
    definitions = {
        0: [["snapshotId", "ASCII_ID"]],
        1: [["requirementVersionId", "ASCII_ID"], ["fieldKey", "ASCII_KEY"]],
        2: [["candidateId", "ASCII_ID"]],
        3: [["candidateId", "ASCII_ID"], ["parameterKey", "ASCII_KEY"]],
        4: [["candidateId", "ASCII_ID"], ["priceRevisionId", "ASCII_ID"]],
        5: [["sourceRevisionId", "ASCII_ID"]],
        6: [["catalogReviewId", "ASCII_ID"]],
        7: [["professionalReviewId", "ASCII_ID"], ["eventSequence", "INT64"]],
        8: [["candidateId", "ASCII_ID"], ["warningSequence", "INT64"]],
        9: [["candidateId", "ASCII_ID"], ["fieldKey", "ASCII_KEY"]],
    }
    expected = definitions[record_type]
    if len(values) != len(expected):
        raise ValueError("STABLE_TUPLE_ARITY")
    result = bytearray(b"SKR2" + u16(2) + u16(3) + u16(record_type) + u16(len(values)))
    for index, (item, definition) in enumerate(zip(values, expected), 1):
        if len(item) != 3 or list(item[:2]) != definition:
            raise ValueError("STABLE_TUPLE_DEFINITION")
        _, kind, value = item
        if kind == "ASCII_ID":
            tag, payload = 1, ascii_bytes(value, True)
        elif kind == "ASCII_KEY":
            tag, payload = 2, ascii_bytes(value, True)
        elif kind == "INT64":
            tag, payload = 3, i64(value)
        else:
            raise ValueError("STABLE_TUPLE_TYPE")
        result += u16(index) + bytes((tag, 1)) + u32(len(payload)) + payload
    result += u16(0xFFFF)
    if len(result) > 158:
        raise ValueError("STABLE_KEY_LENGTH")
    return bytes(result)


def scalar(field: dict) -> tuple[int, int, bytes]:
    kind = field["type"]
    value = field.get("value")
    if kind == "NULL":
        return 0, 0, b""
    if kind == "BOOLEAN":
        if not isinstance(value, bool):
            raise ValueError("BOOLEAN_TYPE")
        return 1, 1, bytes((1 if value else 0,))
    if kind == "INTEGER":
        return 2, 1, i64(value)
    if kind == "DECIMAL":
        if not isinstance(value, str) or not re.fullmatch(
            r"-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?", value
        ):
            raise ValueError("DECIMAL_GRAMMAR")
        if re.fullmatch(r"-0(?:\.0+)?", value):
            raise ValueError("DECIMAL_NEGATIVE_ZERO")
        if "." in value and value.endswith("0"):
            raise ValueError("DECIMAL_NOT_CANONICAL")
        if len(value.lstrip("-").replace(".", "")) > 18:
            raise ValueError("DECIMAL_PRECISION")
        return 3, 1, value.encode("ascii")
    if kind == "TEXT":
        if not isinstance(value, str):
            raise ValueError("TEXT_TYPE")
        if value != unicodedata.normalize("NFC", value):
            raise ValueError("TEXT_NOT_NFC")
        if "\x00" in value:
            raise ValueError("TEXT_NUL")
        if len(value) > 4000:
            raise ValueError("TEXT_LENGTH")
        return 4, 1, value.encode("utf-8")
    if kind == "ENUM":
        return 5, 1, ascii_bytes(value)
    if kind == "CANONICAL_ID":
        return 6, 1, ascii_bytes(value)
    if kind == "TIMESTAMP":
        return 7, 1, i64(value)
    if kind == "SOURCE_AUX":
        return 4, 1, source_aux(value)
    if kind == "BYTES":
        if field.get("derive") == "SOURCE_KEY_R3":
            payload = source_key(field["sourceComponents"])
        elif isinstance(field.get("bytesHex"), str):
            payload = bytes.fromhex(field["bytesHex"])
        else:
            raise ValueError("BYTES_DERIVATION")
        if not payload:
            raise ValueError("BYTES_EMPTY")
        if len(payload) > 512:
            raise ValueError("BYTES_LENGTH")
        return 8, 1, payload
    raise ValueError("SCALAR_TYPE")


def encode_record(fixture: dict, record: dict) -> tuple[bytes, bytes]:
    record_type = int(record["recordType"])
    definition = fixture["recordTypeDefinitions"][str(record_type)]["tuple"]
    if [item[:2] for item in record["stableKeyTuple"]] != definition:
        raise ValueError("REGISTRY_TUPLE_MISMATCH")
    key = stable_key(record_type, record["stableKeyTuple"])
    row_id = ascii_bytes(record["rowId"])
    fields = sorted(record["fields"], key=lambda item: int(item["tag"]))
    encoded_fields = bytearray()
    previous_tag = 0
    for field in fields:
        tag = int(field["tag"])
        if tag <= previous_tag:
            raise ValueError("FIELD_ORDER")
        previous_tag = tag
        type_tag, presence, payload = scalar(field)
        encoded_fields += u16(tag) + bytes((type_tag, presence))
        encoded_fields += u32(len(payload)) + payload
    inner = (
        u16(record_type)
        + u16(len(row_id))
        + row_id
        + u16(len(key))
        + key
        + u16(len(fields))
        + bytes(encoded_fields)
    )
    encoded = u32(len(inner) + 4) + inner
    if len(encoded) > 16874:
        raise ValueError("RECORD_BYTES")
    return encoded, key


def build_c6(fixture: dict) -> dict:
    records = []
    for record in fixture["records"]:
        payload, key = encode_record(fixture, record)
        records.append(
            (int(record["recordType"]), key, record["rowId"].encode("ascii"), payload)
        )
    records.sort(key=lambda item: (item[0], item[1], item[2]))
    body = b"".join(item[3] for item in records)
    basis = (
        b"R3BASIS\0"
        + u16(6)
        + u16(1)
        + u32(28)
        + u32(len(records))
        + u64(len(body))
        + body
    )
    return {
        "records": len(records),
        "record_types": [item[0] for item in records],
        "bytes": len(basis),
        "sha256": hashlib.sha256(basis).hexdigest().upper(),
        "basis_hex": basis.hex().upper(),
    }


def r6_scalar_check(field: dict) -> tuple[str, str]:
    try:
        scalar(field)
        return "ACCEPT", "OK"
    except (KeyError, TypeError, ValueError, OverflowError, struct.error) as exc:
        return "REJECT", str(exc)


def parse_tables(sql: str) -> tuple[dict[str, set[str]], dict[str, set[tuple[str, ...]]], dict[str, list[dict]]]:
    tables: dict[str, set[str]] = {}
    keys: dict[str, set[tuple[str, ...]]] = {}
    fks_by_table: dict[str, list[dict]] = {}
    for match in re.finditer(
        r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*\((.*?)\n\);",
        sql,
        re.I | re.S,
    ):
        table = match.group(1).lower()
        body = match.group(2)
        columns = set()
        for line in body.splitlines():
            column = re.match(r"\s*([a-z_][a-z0-9_]*)\s+", line, re.I)
            if column and column.group(1).lower() not in {
                "constraint", "primary", "foreign", "unique", "check", "exclude"
            }:
                columns.add(column.group(1).lower())
        table_keys = {
            tuple(item.strip().lower() for item in value.split(",") if item.strip())
            for value in re.findall(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)", body, re.I)
        }
        for column in re.findall(
            r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",
            body,
            re.I | re.M,
        ):
            table_keys.add((column.lower(),))
        tables[table] = columns
        keys[table] = table_keys
        fks_by_table[table] = [
            {
                "source": tuple(
                    item.strip().lower()
                    for item in fk.group(1).split(",")
                    if item.strip()
                ),
                "target_table": fk.group(2).lower(),
                "target": tuple(
                    item.strip().lower()
                    for item in fk.group(3).split(",")
                    if item.strip()
                ),
            }
            for fk in re.finditer(
                r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
                r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
                body,
                re.I | re.S,
            )
        ]
    for match in re.finditer(
        r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*(.*?);",
        sql,
        re.I | re.S,
    ):
        table = match.group(1).lower()
        body = match.group(2)
        tables.setdefault(table, set())
        keys.setdefault(table, set())
        fks_by_table.setdefault(table, [])
        for column in re.findall(r"ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)", body, re.I):
            tables[table].add(column.lower())
        keys[table] |= {
            tuple(item.strip().lower() for item in value.split(",") if item.strip())
            for value in re.findall(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)", body, re.I)
        }
        fks_by_table[table].extend(
            {
                "source": tuple(
                    item.strip().lower()
                    for item in fk.group(1).split(",")
                    if item.strip()
                ),
                "target_table": fk.group(2).lower(),
                "target": tuple(
                    item.strip().lower()
                    for item in fk.group(3).split(",")
                    if item.strip()
                ),
            }
            for fk in re.finditer(
                r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
                r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
                body,
                re.I | re.S,
            )
        )
    return tables, keys, fks_by_table


def function_bodies(sql: str) -> dict[str, str]:
    definitions: dict[str, str] = {}
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+RETURNS\b",
        re.I | re.S,
    )
    matches = list(pattern.finditer(sql))
    for index, match in enumerate(matches):
        start = match.end()
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(sql)
        dollar_end = sql.find("$$;", start)
        if dollar_end >= 0 and dollar_end < next_start:
            end = dollar_end + 3
        else:
            semicolon_end = sql.find(";", start, next_start)
            end = semicolon_end + 1 if semicolon_end >= 0 else next_start
        args = [
            " ".join(item.strip().split()[1:]).lower()
            if len(item.strip().split()) > 1
            else item.strip().lower()
            for item in match.group(2).split(",")
            if item.strip()
        ]
        signature = f"{match.group(1).lower()}({', '.join(args)})"
        definitions[signature] = sql[start:end]
    return definitions


def function_returns(sql: str) -> dict[str, str]:
    result = {}
    pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+RETURNS\s+(.*?)\s+LANGUAGE\b",
        re.I | re.S,
    )
    for match in pattern.finditer(sql):
        args = [
            " ".join(item.strip().split()[1:]).lower()
            if len(item.strip().split()) > 1
            else item.strip().lower()
            for item in match.group(2).split(",")
            if item.strip()
        ]
        signature = f"{match.group(1).lower()}({', '.join(args)})"
        result[signature] = normalize(match.group(3))
    return result


def main() -> int:
    script = Path(__file__).resolve()
    repo = script.parents[4]
    design = repo / "docs" / "product" / "full-mvp-remediation-design-r3-c8"
    c7 = repo / "docs" / "product" / "full-mvp-remediation-design-r3-c7"
    c6 = repo / "docs" / "product" / "full-mvp-remediation-design-r3-c6"
    output = script.parent / "INDEPENDENT_REVIEW_EVIDENCE_R3_C8.json"
    object_output = script.parent / "OBJECT_INVENTORY_R3_C8.json"

    manifest = design / "SHA256SUMS_R3_C8.txt"
    manifest_lines = manifest.read_text(encoding="utf-8").splitlines()
    records = []
    manifest_errors = []
    listed_paths = []
    for line in manifest_lines:
        match = re.fullmatch(r"([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)", line)
        if not match:
            manifest_errors.append({"type": "FORMAT", "line": line})
            continue
        expected_hash, expected_bytes, expected_lines, rel = match.groups()
        listed_paths.append(rel)
        path = repo / rel
        item = {
            "path": rel,
            "expected_sha256": expected_hash.upper(),
            "expected_bytes": int(expected_bytes),
            "expected_lines": int(expected_lines),
        }
        if not path.is_file():
            item["result"] = "MISSING"
            manifest_errors.append(item)
        else:
            item.update({
                "actual_sha256": sha256_file(path),
                "actual_bytes": path.stat().st_size,
                "actual_lines": line_count(path),
            })
            item["result"] = (
                "PASS"
                if item["actual_sha256"] == item["expected_sha256"]
                and item["actual_bytes"] == item["expected_bytes"]
                and item["actual_lines"] == item["expected_lines"]
                else "FAIL"
            )
            if item["result"] == "FAIL":
                manifest_errors.append(item)
        records.append(item)
    actual_paths = sorted(
        path.relative_to(repo).as_posix()
        for path in design.rglob("*")
        if path.is_file() and path != manifest
    )
    coverage_differences = sorted(set(actual_paths) ^ set(listed_paths))

    ddl_path = design / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql"
    overlay_path = design / "R3_C8_FINAL_STATE_OVERLAY.sql"
    ddl = ddl_path.read_text(encoding="utf-8")
    overlay = overlay_path.read_text(encoding="utf-8")
    base_ddl = (c7 / "DATABASE_COMPLETE_DDL_R3_C7.sql").read_text(encoding="utf-8")
    tables, table_keys, fks_by_table = parse_tables(ddl)
    all_fks = [
        {**fk, "source_table": table}
        for table, fks in fks_by_table.items()
        for fk in fks
    ]
    fk_findings = []
    for fk in all_fks:
        if len(fk["source"]) != len(fk["target"]):
            fk_findings.append({"type": "COLUMN_COUNT", **fk})
        if fk["target_table"] not in tables:
            fk_findings.append({"type": "TARGET_TABLE_MISSING", **fk})
        elif fk["target"] not in table_keys.get(fk["target_table"], set()):
            fk_findings.append({"type": "TARGET_KEY_MISSING", **fk})
        source_missing = set(fk["source"]) - tables.get(fk["source_table"], set())
        if source_missing:
            fk_findings.append({
                "type": "SOURCE_COLUMN_MISSING",
                "source_table": fk["source_table"],
                "missing": sorted(source_missing),
            })

    functions = function_bodies(ddl)
    registry = json.loads(
        (design / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8.json").read_text(
            encoding="utf-8"
        )
    )
    registry_by_signature = {
        item["signature"]: item for item in registry["functions"]
    }
    function_owner = {}
    for match in re.finditer(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        ddl,
        re.I | re.S,
    ):
        args = [
            " ".join(item.strip().split()[1:]).lower()
            if len(item.strip().split()) > 1
            else item.strip().lower()
            for item in match.group(2).split(",")
            if item.strip()
        ]
        function_owner[f"{match.group(1).lower()}({', '.join(args)})"] = match.group(3).lower()

    relation_names = set(tables)
    function_names = {
        signature.split("(", 1)[0] for signature in functions
    }
    call_targets = {}
    unresolved_calls = set()
    for signature, body in functions.items():
        calls = sorted({
            item.group(1).lower()
            for item in re.finditer(
                r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(", body, re.I
            )
            if item.group(1).lower() not in relation_names
        })
        call_targets[signature] = calls
        unresolved_calls |= set(calls) - function_names

    role_connect_match = re.search(
        r"GRANT\s+CONNECT\s+ON\s+DATABASE\s+[a-z_][a-z0-9_]*\s+TO\s+([^;]+);",
        ddl,
        re.I | re.S,
    )
    connect_roles = set()
    if role_connect_match:
        connect_roles = {
            normalize(item) for item in role_connect_match.group(1).split(",") if item.strip()
        }

    issue_sig = (
        "app.issue_authority_grant(text, text, text, text, text, text, text, timestamptz)"
    )
    issue_body = functions.get(issue_sig, "")
    authority_insert_sites = [
        signature for signature, body in functions.items()
        if re.search(r"INSERT\s+INTO\s+app\.authority_grant\b", body, re.I)
    ]
    bootstrap_function_names = [
        signature for signature in functions
        if re.search(r"bootstrap|initial[_ ]grant|root[_ ]grant", signature, re.I)
    ]
    bootstrap_function_bodies = [
        signature for signature, body in functions.items()
        if re.search(r"bootstrap|initial[_ ]grant|root[_ ]grant", body, re.I)
        and re.search(r"INSERT\s+INTO\s+app\.authority_grant\b", body, re.I)
    ]

    claim_sig = (
        "app_private.claim_command_request(text, text, text, text, text, text, text)"
    )
    claim_body = functions.get(claim_sig, "")
    session_role_sig = (
        "app_private.validate_session_role_r3(text, text, text)"
    )
    session_role_body = functions.get(session_role_sig, "")

    canonical_body = functions.get(
        "app_private.canonical_row_payload_r3(text, jsonb)", ""
    )
    price_payload_match = re.search(
        r"WHEN\s+'sales_snapshot_price_r3'\s+THEN\s+jsonb_build_object\((.*?)\n  \)\n",
        canonical_body,
        re.I | re.S,
    )
    price_payload_text = price_payload_match.group(1) if price_payload_match else ""
    price_expected_tokens = {
        "amount_minor": "amountMinor",
        "currency": "currency",
        "price_basis": "priceBasis",
        "tax_basis": "taxBasis",
        "applicability": "applicability",
        "valid_from": "validFrom",
        "valid_until": "validUntil",
        "quoted_at": "quotedAt",
    }
    price_missing_payload_fields = [
        source for source, json_name in price_expected_tokens.items()
        if json_name not in price_payload_text
    ]

    professional_sig = (
        "app.record_selection_professional_review_result(text, text, text, bigint, "
        "text, text, text, text, timestamptz, text, text)"
    )
    professional_body = functions.get(professional_sig, "")
    asymmetric_decision_check = (
        "IF ev.next_state<>'APPROVED' AND p_decision='APPROVED' THEN"
        in professional_body.replace("\n", " ")
    )

    trigger_rows = []
    for match in re.finditer(
        r"CREATE\s+(CONSTRAINT\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)\s+"
        r"(BEFORE|AFTER|INSTEAD\s+OF)\s+([^\n]+?)\s+ON\s+"
        r"(app\.[a-z_][a-z0-9_]*)",
        ddl,
        re.I | re.S,
    ):
        body_start = match.start()
        statement_end = ddl.find(";", match.end())
        statement = ddl[body_start:statement_end + 1]
        trigger_rows.append({
            "name": match.group(2).lower(),
            "timing": normalize(match.group(3)),
            "events": normalize(match.group(4)),
            "table": match.group(5).lower(),
            "constraint": bool(match.group(1)),
            "deferrable": "DEFERRABLE INITIALLY DEFERRED" in statement.upper(),
        })

    fixture = json.loads((c6 / "C6_SNAPSHOT_VECTOR_01.json").read_text(encoding="utf-8"))
    c6_result = build_c6(fixture)
    c6_result["expected_records"] = 15
    c6_result["expected_record_types"] = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9]
    c6_result["expected_bytes"] = 4036
    c6_result["expected_sha256"] = "7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB"
    c6_result["result"] = (
        "PASS"
        if c6_result["records"] == c6_result["expected_records"]
        and c6_result["record_types"] == c6_result["expected_record_types"]
        and c6_result["bytes"] == c6_result["expected_bytes"]
        and c6_result["sha256"] == c6_result["expected_sha256"]
        else "FAIL"
    )
    c6_result.pop("basis_hex")

    scalar_doc = json.loads((c7 / "scalar_vectors_r3_c7.json").read_text(encoding="utf-8"))
    scalar_results = []
    for vector in [*scalar_doc["vectors"], *scalar_doc.get("additionalVectors", [])]:
        field = dict(vector["field"])
        repeat = field.pop("repeat", None)
        if repeat:
            field["value"] = repeat["char"] * int(repeat["count"])
        byte_length = field.pop("bytesLength", None)
        if byte_length is not None:
            field["bytesHex"] = bytes((int(field.pop("bytesByte", 0)),)).hex() * int(byte_length)
        observed, reason = r6_scalar_check(field)
        scalar_results.append({
            "id": vector["id"],
            "expected": vector["expected"],
            "observed": observed,
            "reason": reason,
            "result": "PASS" if observed == vector["expected"] else "FAIL",
        })

    limit_doc = json.loads((c7 / "basis_limit_vectors_r3_c7.json").read_text(encoding="utf-8"))
    limit_results = []
    maximums = {
        "recordCount": 4096,
        "totalFields": 65536,
        "fieldsPerRecord": 32,
        "recordBytes": 16874,
        "fieldBytes": 520,
        "bodyBytes": 16777216,
        "basisBytes": 16777244,
    }
    for vector in limit_doc["vectors"]:
        observed = "ACCEPT"
        reason = "OK"
        for key, maximum in maximums.items():
            if vector["input"][key] > maximum:
                observed = "REJECT"
                reason = key
                break
        limit_results.append({
            "id": vector["id"],
            "expected": vector["expected"],
            "observed": observed,
            "reason": reason,
            "result": "PASS" if observed == vector["expected"] else "FAIL",
        })

    source_key_body = functions.get(
        "app.source_key_r3(text, text, text, boolean, text)", ""
    )
    stable_key_body = functions.get("app_private.stable_key_r3(smallint, jsonb)", "")
    field_allowed_body = functions.get(
        "app_private.r6_field_allowed(smallint, integer, text)", ""
    )
    record_body = functions.get(
        "app_private.r6_record(smallint, text, bytea, jsonb)", ""
    )
    expected_stable_arity = (
        "WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 2 "
        "WHEN 4 THEN 2 WHEN 5 THEN 1 WHEN 6 THEN 1 WHEN 7 THEN 2 "
        "WHEN 8 THEN 2 WHEN 9 THEN 2"
    )
    expected_record_fields = (
        "WHEN 0 THEN 14 WHEN 1 THEN 11 WHEN 2 THEN 14 WHEN 3 THEN 7 "
        "WHEN 4 THEN 12 WHEN 5 THEN 5 WHEN 6 THEN 6 WHEN 7 THEN 7 "
        "WHEN 8 THEN 6 WHEN 9 THEN 4"
    )
    sql_r6_checks = {
        "decimal_18_digit_limit": (
            "char_length(regexp_replace(v_field->>'value','[-.]','','g')) > 18"
            in ddl
        ),
        "decimal_negative_zero_rejected": "'^-0(\\.0+)?$'" in normalize(ddl),
        "decimal_scale_limit": "(\\.[0-9]{1,6})?" in ddl,
        "exact_header_type_dispatch": "NOT app_private.r6_field_allowed" in ddl,
        "header_record_types_0_through_9": {
            int(value)
            for value in re.findall(r"\bWHEN\s+([0-9]+)\s+THEN", field_allowed_body)
        } == set(range(10)),
        "stable_key_arity": normalize(expected_stable_arity) in normalize(stable_key_body),
        "record_field_inventory": normalize(expected_record_fields) in normalize(record_body),
        "source_key_nfc": "normalize(p_source_aux_text,NFC)" in source_key_body,
        "source_key_362_limit": "octet_length(v_result) > 362" in source_key_body,
        "stable_key_158_limit": "octet_length(v_result) > 158" in stable_key_body,
        "record_16874_limit": "octet_length(v_inner)+4>16874" in record_body,
        "basis_16777244_limit": "16777244" in ddl,
    }
    sql_r6_result = "PASS" if all(sql_r6_checks.values()) else "FAIL"

    critical_findings = []
    if price_missing_payload_fields:
        critical_findings.append({
            "type": "SNAPSHOT_PRICE_DIGEST_OMITS_CONTENT",
            "missing_fields": price_missing_payload_fields,
        })
    if bootstrap_function_names or bootstrap_function_bodies:
        pass
    else:
        critical_findings.append({
            "type": "AUTHORITY_GRANT_BOOTSTRAP_CIRCULAR",
            "authority_grant_insert_sites": authority_insert_sites,
            "requires_existing_grant": "lock_authority_grant" in issue_body,
        })
    if "elevator_session_bootstrap" not in connect_roles:
        critical_findings.append({
            "type": "SESSION_LOGIN_CONNECT_PATH_UNDEFINED",
            "connect_roles": sorted(connect_roles),
        })
    if "r.session_id<>p_session_id" not in claim_body.replace(" ", ""):
        critical_findings.append({
            "type": "REQUEST_LEDGER_SESSION_BINDING_MISSING",
            "function": claim_sig,
        })
    session_role_missing_checks = []
    for label, marker in {
        "rolcreatedb": "NOT r.rolcreatedb",
        "rolcreaterole": "NOT r.rolcreaterole",
        "rolinherit": "NOT r.rolinherit",
        "membership_inherit_option": "inherit_option",
        "membership_set_option": "set_option",
        "recursive_membership_closure": "WITH RECURSIVE",
    }.items():
        if marker.lower() not in session_role_body.lower():
            session_role_missing_checks.append(label)
    if session_role_missing_checks:
        critical_findings.append({
            "type": "SESSION_ROLE_VALIDATION_INCOMPLETE",
            "missing_checks": session_role_missing_checks,
            "function": session_role_sig,
        })
    if asymmetric_decision_check:
        critical_findings.append({
            "type": "PROFESSIONAL_REVIEW_DECISION_MISMATCH_ASYMMETRIC",
            "function": professional_sig,
        })

    truncate_tables = {
        match.group(1).lower()
        for match in re.finditer(
            r"BEFORE\s+TRUNCATE\s+ON\s+(app\.[a-z_][a-z0-9_]*)",
            ddl,
            re.I,
        )
    }
    if "app.professional_review" not in truncate_tables:
        critical_findings.append({
            "type": "PROFESSIONAL_REVIEW_TRUNCATE_GUARD_MISSING",
            "table": "app.professional_review",
        })

    overlay_function_returns = function_returns(overlay)
    base_function_returns = function_returns(base_ddl)
    return_type_conflicts = [
        {
            "signature": signature,
            "base": base_function_returns[signature],
            "overlay": return_type,
        }
        for signature, return_type in overlay_function_returns.items()
        if signature in base_function_returns
        and base_function_returns[signature] != return_type
    ]

    base_triggers = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)",
            base_ddl,
            re.I,
        )
    }
    overlay_triggers = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)",
            overlay,
            re.I,
        )
    }
    duplicate_triggers = sorted(base_triggers & overlay_triggers)

    base_create_tables = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)", base_ddl, re.I
        )
    }
    overlay_create_tables = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)", overlay, re.I
        )
    }
    duplicate_tables = sorted(base_create_tables & overlay_create_tables)

    base_roles = {
        match.group(1).lower()
        for match in re.finditer(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", base_ddl, re.I)
    }
    overlay_roles = {
        match.group(1).lower()
        for match in re.finditer(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", overlay, re.I)
    }
    duplicate_roles = sorted(base_roles & overlay_roles)

    open_decisions_path = design / "OPEN_DECISIONS_DISPOSITION_R3_C8.md"
    open_decisions_text = open_decisions_path.read_text(encoding="utf-8")
    open_ids = re.findall(r"^\|\s*`(OD-R[^`]+)`\s*\|", open_decisions_text, re.M)
    expected_open_ids = (
        [f"OD-R2-{index:02d}" for index in range(1, 21)]
        + [f"OD-R3-{index:02d}" for index in range(1, 10)]
        + [f"OD-R3-C2-{index:02d}" for index in range(1, 5)]
        + [f"OD-R3-C3-{index:02d}" for index in range(1, 5)]
        + [f"OD-R3-C4-{index:02d}" for index in range(1, 5)]
        + [f"OD-R3-C5-{index:02d}" for index in range(1, 6)]
        + [f"OD-R3-C6-{index:02d}" for index in range(1, 6)]
        + [f"OD-R3-C7-{index:02d}" for index in range(1, 7)]
    )
    open_id_differences = sorted(set(expected_open_ids) ^ set(open_ids))

    registry_signature_mismatch = sorted(set(functions) ^ set(registry_by_signature))
    registry_owner_mismatch = sorted(
        signature
        for signature in set(functions) & set(registry_by_signature)
        if function_owner.get(signature) != registry_by_signature[signature]["owner"]
    )
    unsafe_search_paths = sorted(
        signature
        for signature, item in registry_by_signature.items()
        if item["security"] == "DEFINER"
        and (
            not item.get("search_path")
            or not str(item["search_path"]).split(",")[0].strip().startswith("pg_catalog")
        )
    )
    public_execute = sorted(
        signature
        for signature, item in registry_by_signature.items()
        if item.get("public_execute")
    )

    prohibited_runtime_roles = {
        "elevator_identity_broker",
        "elevator_runtime_web",
        "elevator_runtime_worker",
        "elevator_professional_reviewer",
        "elevator_policy_author",
        "elevator_policy_reviewer",
        "elevator_security_admin",
        "elevator_readonly_auditor",
        "elevator_reporting_readonly",
        "elevator_session_bootstrap",
    }
    all_table_grant_violations = []
    for match in re.finditer(
        r"GRANT\s+([^;]+?)\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+app\s+TO\s+([^;]+);",
        ddl,
        re.I | re.S,
    ):
        granted_roles = {
            normalize(item) for item in match.group(2).split(",") if item.strip()
        }
        bad_roles = granted_roles & prohibited_runtime_roles
        if bad_roles:
            all_table_grant_violations.append(sorted(bad_roles))
    direct_table_grant_violations = []
    for match in re.finditer(
        r"GRANT\s+([^;]+?)\s+ON\s+([^;]+?)\s+TO\s+([^;]+);",
        ddl,
        re.I | re.S,
    ):
        privilege = normalize(match.group(1))
        if not re.search(r"\b(select|insert|update|delete|truncate|references|trigger)\b", privilege):
            continue
        objects = {
            normalize(item) for item in match.group(2).split(",") if item.strip()
        }
        table_objects = objects & set(tables)
        roles = {
            normalize(item) for item in match.group(3).split(",") if item.strip()
        }
        if table_objects and roles & prohibited_runtime_roles:
            direct_table_grant_violations.append({
                "objects": sorted(table_objects),
                "roles": sorted(roles & prohibited_runtime_roles),
            })

    source_chain_tables = {
        "app.selection_requirement_field": {
            "requirement_version_id", "source_value_id", "source_revision_id"
        },
        "app.selection_catalog_review_result": {
            "catalog_review_id", "target_revision_id", "source_revision_id"
        },
        "app.selection_professional_review_result": {
            "professional_review_event_id", "professional_review_id", "target_revision_id"
        },
    }
    source_chain_fk_coverage = {}
    for table, required_columns in source_chain_tables.items():
        fk_columns = {
            column
            for fk in fks_by_table.get(table, [])
            for column in fk["source"]
        }
        source_chain_fk_coverage[table] = {
            "required": sorted(required_columns),
            "covered_by_fk": sorted(fk_columns & required_columns),
            "uncovered": sorted(required_columns - fk_columns),
        }

    uncovered_source_fks = {
        table: details["uncovered"]
        for table, details in source_chain_fk_coverage.items()
        if details["uncovered"]
    }
    if uncovered_source_fks:
        critical_findings.append({
            "type": "SOURCE_CHAIN_FK_COVERAGE_INCOMPLETE",
            "tables": uncovered_source_fks,
        })

    output_data = {
        "review": "FULL-MVP-REMEDIATION-REVIEW-R3-C8",
        "scope": "INDEPENDENT STATIC DESIGN EVIDENCE; NO POSTGRESQL GRAMMAR/EXECUTION",
        "manifest": {
            "path": manifest.relative_to(repo).as_posix(),
            "sha256": sha256_file(manifest),
            "bytes": manifest.stat().st_size,
            "lines": len(manifest_lines),
            "records": len(records),
            "unique_paths": len(set(listed_paths)),
            "mismatches": len(manifest_errors),
            "coverage_differences": coverage_differences,
            "result": (
                "PASS"
                if sha256_file(manifest) == "672D6206D06E4282F7C8684A3811654EEDDA72E52C55B6EDF2C324B5C131E853"
                and len(records) == 22
                and len(set(listed_paths)) == 22
                and not manifest_errors
                and not coverage_differences
                else "FAIL"
            ),
        },
        "object_inventory": {
            "tables": len(tables),
            "views": len({
                match.group(1).lower()
                for match in re.finditer(
                    r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(app\.[a-z_][a-z0-9_]*)",
                    ddl,
                    re.I,
                )
            }),
            "view_definitions": len(re.findall(
                r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+app\.",
                ddl,
                re.I,
            )),
            "foreign_keys": len(all_fks),
            "functions_unique": len(functions),
            "function_owner_assignments": len(function_owner),
            "call_edges": sum(len(value) for value in call_targets.values()),
            "call_targets": len({
                target
                for values in call_targets.values()
                for target in values
            }),
            "unresolved_call_targets": sorted(unresolved_calls),
            "triggers": len(trigger_rows),
            "deferred_constraint_triggers": sum(
                1 for trigger in trigger_rows
                if trigger["constraint"] and trigger["deferrable"]
            ),
        },
        "overlay_compatibility": {
            "final_state_markers_present": (
                "-- ===== BEGIN R3-C8 FINAL-STATE CORRECTIONS =====" in ddl
                and "-- ===== END R3-C8 FINAL-STATE CORRECTIONS =====" in ddl
            ),
            "auto_owner_placeholder_resolved": "__R3_C8_AUTO_OWNERS__" not in ddl,
            "return_type_conflicts": return_type_conflicts,
            "duplicate_tables": duplicate_tables,
            "duplicate_roles": duplicate_roles,
            "duplicate_trigger_names": duplicate_triggers,
            "result": (
                "PASS"
                if "-- ===== BEGIN R3-C8 FINAL-STATE CORRECTIONS =====" in ddl
                and "-- ===== END R3-C8 FINAL-STATE CORRECTIONS =====" in ddl
                and "__R3_C8_AUTO_OWNERS__" not in ddl
                and not return_type_conflicts
                and not duplicate_tables
                and not duplicate_roles
                and not duplicate_triggers
                else "FAIL"
            ),
        },
        "registry_audit": {
            "registry_status": registry.get("call_graph_status"),
            "registry_functions": len(registry_by_signature),
            "ddl_functions": len(functions),
            "signature_differences": registry_signature_mismatch,
            "owner_mismatches": registry_owner_mismatch,
            "unsafe_security_definer_search_paths": unsafe_search_paths,
            "public_execute": public_execute,
            "unresolved_registry_calls": registry.get("unresolved_call_targets", []),
            "result": (
                "PASS"
                if not registry_signature_mismatch
                and not registry_owner_mismatch
                and not unsafe_search_paths
                and not public_execute
                and not registry.get("unresolved_call_targets")
                else "FAIL"
            ),
        },
        "fk_audit": {
            "findings": fk_findings,
            "source_chain_coverage": source_chain_fk_coverage,
        },
        "privilege_audit": {
            "connect_roles": sorted(connect_roles),
            "authority_grant_insert_sites": authority_insert_sites,
            "bootstrap_grant_functions": bootstrap_function_bodies,
            "issue_grant_requires_existing_grant": "lock_authority_grant" in issue_body,
            "runtime_all_table_grant_violations": all_table_grant_violations,
            "runtime_direct_table_grant_violations": direct_table_grant_violations,
            "public_execute": public_execute,
            "result": (
                "PASS"
                if not all_table_grant_violations
                and not direct_table_grant_violations
                and not public_execute
                else "FAIL"
            ),
        },
        "session_audit": {
            "claim_checks_session_id": "r.session_id<>p_session_id" in claim_body.replace(" ", ""),
            "claim_body_has_principal_check": "r.principal_id<>p_principal_id" in claim_body,
            "session_role_missing_checks": session_role_missing_checks,
        },
        "snapshot_audit": {
            "sales_snapshot_price_digest_missing_fields": price_missing_payload_fields,
            "professional_review_decision_check_asymmetric": asymmetric_decision_check,
        },
        "open_decisions": {
            "expected": len(expected_open_ids),
            "present": len(open_ids),
            "unique": len(set(open_ids)),
            "differences": open_id_differences,
            "approved_tokens": len(re.findall(r"\bAPPROVED\b", open_decisions_text)),
            "still_open": 57 if not open_id_differences else None,
            "result": (
                "PASS"
                if len(open_ids) == 57
                and len(set(open_ids)) == 57
                and not open_id_differences
                and not re.search(r"\bAPPROVED\b", open_decisions_text)
                else "FAIL"
            ),
        },
        "c6_snap_01": c6_result,
        "r6_scalar": {
            "total": len(scalar_results),
            "failed": sum(item["result"] == "FAIL" for item in scalar_results),
            "results": scalar_results,
        },
        "r6_resource_limits": {
            "total": len(limit_results),
            "failed": sum(item["result"] == "FAIL" for item in limit_results),
            "results": limit_results,
        },
        "sql_r6_static_alignment": {
            "checks": sql_r6_checks,
            "result": sql_r6_result,
            "scope": "STATIC SOURCE-TEXT CHECK ONLY; SQL NOT EXECUTED",
        },
        "critical_static_findings": critical_findings,
        "sql_grammar": "NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER USED",
        "postgresql_execution": "NOT EXECUTED — DATABASE NOT AUTHORIZED",
    }
    output.write_text(json.dumps(output_data, indent=2) + "\n", encoding="utf-8")
    view_names = sorted({
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(app\.[a-z_][a-z0-9_]*)",
            ddl,
            re.I,
        )
    })
    role_names = sorted({
        match.group(1).lower()
        for match in re.finditer(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", ddl, re.I)
    })
    object_data = {
        "review": "FULL-MVP-REMEDIATION-REVIEW-R3-C8",
        "scope": "STATIC OBJECT INVENTORY; NOT POSTGRESQL CATALOG",
        "tables": sorted(tables),
        "views": view_names,
        "roles": role_names,
        "functions": sorted(functions),
        "foreign_keys_by_table": {
            table: fks for table, fks in sorted(fks_by_table.items()) if fks
        },
        "triggers": sorted(trigger_rows, key=lambda item: item["name"]),
        "truncate_guarded_tables": sorted(truncate_tables),
    }
    object_output.write_text(json.dumps(object_data, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "manifest": output_data["manifest"]["result"],
        "c6": c6_result["result"],
        "r6_scalar_failed": output_data["r6_scalar"]["failed"],
        "r6_limits_failed": output_data["r6_resource_limits"]["failed"],
        "sql_r6_static_alignment": sql_r6_result,
        "tables": len(tables),
        "views": output_data["object_inventory"]["views"],
        "functions": len(functions),
        "foreign_keys": len(all_fks),
        "fk_findings": len(fk_findings),
        "triggers": len(trigger_rows),
        "deferred_constraint_triggers": output_data["object_inventory"]["deferred_constraint_triggers"],
        "critical_static_findings": critical_findings,
        "overlay_compatibility": output_data["overlay_compatibility"]["result"],
        "registry_audit": output_data["registry_audit"]["result"],
        "open_decisions": output_data["open_decisions"]["result"],
        "output": output.relative_to(repo).as_posix(),
        "object_inventory_output": object_output.relative_to(repo).as_posix(),
    }, indent=2))
    return 0 if (
        output_data["manifest"]["result"] == "PASS"
        and c6_result["result"] == "PASS"
        and output_data["r6_scalar"]["failed"] == 0
        and output_data["r6_resource_limits"]["failed"] == 0
        and not fk_findings
    ) else 1


if __name__ == "__main__":
    raise SystemExit(main())
