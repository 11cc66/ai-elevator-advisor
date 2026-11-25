import json
import sys
from pathlib import Path


def field(tag, name, kind, value):
    return {"tag": tag, "name": name, "type": kind, "value": value}


def req_field(row_id, field_key, value, unit, fv_id, assertion_id):
    return {
        "recordType": 1,
        "rowId": row_id,
        "stableKeyTuple": [
            ["requirementVersionId", "ASCII_ID", "reqver-1"],
            ["fieldKey", "ASCII_KEY", field_key],
        ],
        "fields": [
            field(1, "fieldKey", "TEXT", field_key),
            field(2, "valueType", "ENUM", "INTEGER"),
            field(3, "value", "INTEGER", value),
            field(4, "unit", "TEXT", unit),
            field(5, "fieldStatus", "ENUM", "CONFIRMED"),
            field(6, "sourceFieldValueId", "CANONICAL_ID", fv_id),
            field(7, "sourceKind", "ENUM", "USER_ASSERTION"),
            field(8, "sourceEntityType", "ENUM", "REQUIREMENT_FIELD_ASSERTION"),
            field(9, "sourceEntityId", "CANONICAL_ID", assertion_id),
            field(10, "sourceAuxId", "NULL", None),
            {
                "tag": 11,
                "name": "sourceKey",
                "type": "BYTES",
                "derive": "SOURCE_KEY_R3",
                "sourceComponents": [
                    ["sourceKind", "ASCII", "USER_ASSERTION"],
                    ["sourceEntityType", "ASCII", "REQUIREMENT_FIELD_ASSERTION"],
                    ["sourceEntityId", "ASCII", assertion_id],
                    ["sourceAuxId", "UTF8_NULLABLE", None],
                ],
            },
        ],
    }


def candidate(row_id, cid, product_id, product_rev, spec_rev, price_rev, commercial):
    return {
        "recordType": 2,
        "rowId": row_id,
        "stableKeyTuple": [["candidateId", "ASCII_ID", cid]],
        "fields": [
            field(1, "selectionResultItemId", "CANONICAL_ID", f"result-{cid}"),
            field(2, "candidateId", "CANONICAL_ID", cid),
            field(3, "productId", "CANONICAL_ID", product_id),
            field(4, "productRevisionId", "CANONICAL_ID", product_rev),
            field(5, "productRevisionDigest", "TEXT", "D" * 64),
            field(6, "specificationRevisionId", "CANONICAL_ID", spec_rev),
            field(7, "specificationRevisionDigest", "TEXT", "E" * 64),
            field(8, "priceRevisionId", "CANONICAL_ID", price_rev),
            field(9, "ruleSetRevisionId", "CANONICAL_ID", "ruleset-1"),
            field(10, "technicalStatus", "ENUM", "TECHNICALLY_ELIGIBLE"),
            field(11, "commercialStatus", "ENUM", commercial),
            field(12, "trustStatus", "ENUM", "TRUSTED"),
            field(13, "professionalReviewStatus", "ENUM", "APPROVED"),
            field(14, "overallStatus", "ENUM",
                  "OPERATIONAL" if commercial == "PRICE_VALID" else "REQUIRES_QUOTE"),
        ],
    }


def parameter(row_id, key, typ, value, unit, parameter_revision):
    return {
        "recordType": 3,
        "rowId": row_id,
        "stableKeyTuple": [
            ["candidateId", "ASCII_ID", "candidate-1"],
            ["parameterKey", "ASCII_KEY", key],
        ],
        "fields": [
            field(1, "candidateId", "CANONICAL_ID", "candidate-1"),
            field(2, "catalogParameterRevisionId", "CANONICAL_ID", parameter_revision),
            field(3, "parameterKey", "TEXT", key),
            field(4, "valueType", "ENUM", typ),
            field(5, "value", typ, value),
            field(6, "unit", "TEXT", unit),
            field(7, "sourceRevisionId", "CANONICAL_ID", "source-rev-1"),
        ],
    }


def price(row_id, cid, price_rev, product_rev, amount):
    return {
        "recordType": 4,
        "rowId": row_id,
        "stableKeyTuple": [
            ["candidateId", "ASCII_ID", cid],
            ["priceRevisionId", "ASCII_ID", price_rev],
        ],
        "fields": [
            field(1, "candidateId", "CANONICAL_ID", cid),
            field(2, "priceRevisionId", "CANONICAL_ID", price_rev),
            field(3, "productRevisionId", "CANONICAL_ID", product_rev),
            field(4, "sourceRevisionId", "CANONICAL_ID", "source-rev-2"),
            field(5, "amountMinor", "INTEGER", amount),
            field(6, "currency", "ENUM", "CNY"),
            field(7, "priceBasis", "ENUM", "EQUIPMENT_ONLY"),
            field(8, "taxBasis", "ENUM", "INCLUDED"),
            field(9, "applicability", "ENUM", "REGION_DEMO"),
            field(10, "validFrom", "TIMESTAMP", 1761955200000),
            field(11, "validUntil", "TIMESTAMP", 1793491200000),
            field(12, "quotedAt", "TIMESTAMP", 1761955200000),
        ],
    }


records = [
    {
        "recordType": 0,
        "rowId": "header-1",
        "stableKeyTuple": [["snapshotId", "ASCII_ID", "snapshot-1"]],
        "fields": [
            field(1, "snapshotId", "CANONICAL_ID", "snapshot-1"),
            field(2, "caseId", "CANONICAL_ID", "case-1"),
            field(3, "projectId", "CANONICAL_ID", "project-1"),
            field(4, "conversationId", "CANONICAL_ID", "conversation-1"),
            field(5, "requirementId", "CANONICAL_ID", "requirement-1"),
            field(6, "requirementVersionId", "CANONICAL_ID", "reqver-1"),
            field(7, "installationScenario", "ENUM", "OLD_BUILDING_ADDITION"),
            field(8, "selectionRunId", "CANONICAL_ID", "run-1"),
            field(9, "ruleSetRevisionId", "CANONICAL_ID", "ruleset-1"),
            field(10, "ruleSetContentDigest", "TEXT", "F" * 64),
            field(11, "basisAsOf", "TIMESTAMP", 1763942400000),
            field(12, "registryRevision", "ENUM", "SNAPSHOT-R3"),
            field(13, "protocolRevision", "ENUM", "R3-BASIS-1-R6"),
            field(14, "stableKeyEncoding", "ENUM", "SK-R2"),
        ],
    },
    req_field("rf-1", "floorCount", 8, "floor", "fv-floor-1", "assertion-1"),
    req_field("rf-2", "budgetMax", 500000, "CNY", "fv-budget-1", "assertion-2"),
    candidate("cand-1", "candidate-1", "product-1", "product-rev-1",
              "spec-rev-1", "price-rev-1", "PRICE_VALID"),
    candidate("cand-2", "candidate-2", "product-2", "product-rev-2",
              "spec-rev-2", "price-rev-2", "PRICE_EXPIRED"),
    parameter("param-1", "capacityKg", "INTEGER", 1000, "kg", "catalog-param-rev-1"),
    parameter("param-2", "speedMps", "DECIMAL", "1.75", "m/s", "catalog-param-rev-2"),
    price("price-1", "candidate-1", "price-rev-1", "product-rev-1", 420000),
    price("price-2", "candidate-2", "price-rev-2", "product-rev-2", 580000),
    {
        "recordType": 5,
        "rowId": "src-1",
        "stableKeyTuple": [["sourceRevisionId", "ASCII_ID", "source-rev-1"]],
        "fields": [
            field(1, "sourceRevisionId", "CANONICAL_ID", "source-rev-1"),
            field(2, "evidenceObjectId", "CANONICAL_ID", "evidence-1"),
            field(3, "rawContentDigest", "TEXT", "A" * 64),
            field(4, "sourceKind", "ENUM", "PRODUCT_DOCUMENT"),
            field(5, "capturedAt", "TIMESTAMP", 1761955200000),
        ],
    },
    {
        "recordType": 5,
        "rowId": "src-2",
        "stableKeyTuple": [["sourceRevisionId", "ASCII_ID", "source-rev-2"]],
        "fields": [
            field(1, "sourceRevisionId", "CANONICAL_ID", "source-rev-2"),
            field(2, "evidenceObjectId", "CANONICAL_ID", "evidence-2"),
            field(3, "rawContentDigest", "TEXT", "B" * 64),
            field(4, "sourceKind", "ENUM", "PRICE_SHEET"),
            field(5, "capturedAt", "TIMESTAMP", 1761955200000),
        ],
    },
    {
        "recordType": 6,
        "rowId": "crev-1",
        "stableKeyTuple": [["catalogReviewId", "ASCII_ID", "creview-1"]],
        "fields": [
            field(1, "catalogReviewId", "CANONICAL_ID", "creview-1"),
            field(2, "targetRevisionId", "CANONICAL_ID", "spec-rev-1"),
            field(3, "sourceRevisionId", "CANONICAL_ID", "source-rev-1"),
            field(4, "policyRevisionId", "CANONICAL_ID", "catalog-policy-1"),
            field(5, "decision", "ENUM", "APPROVE"),
            field(6, "reviewedAt", "TIMESTAMP", 1763942400000),
        ],
    },
    {
        "recordType": 7,
        "rowId": "prev-1",
        "stableKeyTuple": [
            ["professionalReviewId", "ASCII_ID", "review-1"],
            ["eventSequence", "INT64", 1],
        ],
        "fields": [
            field(1, "professionalReviewEventId", "CANONICAL_ID", "event-1"),
            field(2, "professionalReviewId", "CANONICAL_ID", "review-1"),
            field(3, "eventSequence", "INTEGER", 1),
            field(4, "policyRevisionId", "CANONICAL_ID", "professional-policy-1"),
            field(5, "decision", "ENUM", "APPROVED"),
            field(6, "basisDigest", "TEXT", "C" * 64),
            field(7, "occurredAt", "TIMESTAMP", 1763942400000),
        ],
    },
    {
        "recordType": 8,
        "rowId": "warn-1",
        "stableKeyTuple": [
            ["candidateId", "ASCII_ID", "candidate-1"],
            ["warningSequence", "INT64", 1],
        ],
        "fields": [
            field(1, "candidateId", "CANONICAL_ID", "candidate-1"),
            field(2, "sourceWarningId", "CANONICAL_ID", "warning-1"),
            field(3, "warningSequence", "INTEGER", 1),
            field(4, "severity", "ENUM", "INFO"),
            field(5, "warningCode", "ENUM", "BUDGET_REFERENCE"),
            field(6, "warningText", "TEXT", "预算为参考值"),
        ],
    },
    {
        "recordType": 9,
        "rowId": "missing-1",
        "stableKeyTuple": [
            ["candidateId", "ASCII_ID", "candidate-1"],
            ["fieldKey", "ASCII_KEY", "pitDepthMm"],
        ],
        "fields": [
            field(1, "candidateId", "CANONICAL_ID", "candidate-1"),
            field(2, "fieldKey", "TEXT", "pitDepthMm"),
            field(3, "reasonCode", "ENUM", "INSUFFICIENT_DATA"),
            field(4, "impactScope", "ENUM", "INSTALLATION_FEASIBILITY"),
        ],
    },
]

fixture = {
    "fixtureId": "C6-SNAP-01",
    "registryVersion": "SNAPSHOT-R3",
    "protocolVersion": "R3-BASIS-1-R6",
    "stableKeyEncodingVersion": "SK-R2",
    "recordTypeDefinitions": {
        "0": {"name": "HEADER", "tuple": [["snapshotId", "ASCII_ID"]]},
        "1": {"name": "REQUIREMENT_FIELD", "tuple": [
            ["requirementVersionId", "ASCII_ID"], ["fieldKey", "ASCII_KEY"]]},
        "2": {"name": "CANDIDATE", "tuple": [["candidateId", "ASCII_ID"]]},
        "3": {"name": "PARAMETER", "tuple": [
            ["candidateId", "ASCII_ID"], ["parameterKey", "ASCII_KEY"]]},
        "4": {"name": "PRICE", "tuple": [
            ["candidateId", "ASCII_ID"], ["priceRevisionId", "ASCII_ID"]]},
        "5": {"name": "SOURCE_REVISION", "tuple": [
            ["sourceRevisionId", "ASCII_ID"]]},
        "6": {"name": "CATALOG_REVIEW", "tuple": [
            ["catalogReviewId", "ASCII_ID"]]},
        "7": {"name": "PROFESSIONAL_REVIEW", "tuple": [
            ["professionalReviewId", "ASCII_ID"], ["eventSequence", "INT64"]]},
        "8": {"name": "WARNING", "tuple": [
            ["candidateId", "ASCII_ID"], ["warningSequence", "INT64"]]},
        "9": {"name": "MISSING_FIELD", "tuple": [
            ["candidateId", "ASCII_ID"], ["fieldKey", "ASCII_KEY"]]},
    },
    "records": records,
}

Path(sys.argv[1]).write_text(
    json.dumps(fixture, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
    newline="\n",
)
