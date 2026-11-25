"""Generate the complete R3 DDL from frozen R2 DDL and the R3 overlay."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

from guard import require_guarded_context


EXPECTED_R2_MANIFEST = (
    "45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def remove_once(text: str, old: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, "", 1)


def main() -> int:
    r3_root = Path(__file__).resolve().parents[1]
    guard = require_guarded_context(r3_root)
    repo = r3_root.parents[2]
    r2 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"
    r2_manifest = r2 / "SHA256SUMS_R3_C8_CORRECTIONS_R2.txt"
    r2_ddl = r2 / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql"
    overlay = r3_root / "DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R3.sql"
    output = r3_root / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql"
    if sha256(r2_manifest) != EXPECTED_R2_MANIFEST:
        raise SystemExit("R2 manifest hash mismatch")
    text = r2_ddl.read_text(encoding="utf-8")

    text = replace_once(
        text,
        "  PRIMARY KEY (bootstrap_id,bootstrap_generation),\n"
        "  FOREIGN KEY (root_role_name,root_operator_kind,root_principal_id)",
        "  PRIMARY KEY (bootstrap_id,bootstrap_generation),\n"
        "  UNIQUE (bootstrap_id,bootstrap_generation,root_principal_id),\n"
        "  UNIQUE (\n"
        "    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name\n"
        "  ),\n"
        "  FOREIGN KEY (root_role_name,root_operator_kind,root_principal_id)",
        "bootstrap generation historical keys",
    )
    text = replace_once(
        text,
        "  FOREIGN KEY (bootstrap_id,bootstrap_generation,root_principal_id)\n"
        "    REFERENCES app.bootstrap_lifecycle_r2(\n"
        "      bootstrap_id,bootstrap_generation,root_principal_id\n"
        "    ),",
        "  FOREIGN KEY (bootstrap_id,bootstrap_generation,root_principal_id)\n"
        "    REFERENCES app.bootstrap_generation_r2(\n"
        "      bootstrap_id,bootstrap_generation,root_principal_id\n"
        "    ),",
        "approval immutable generation FK",
    )
    text = remove_once(
        text,
        "ALTER TABLE app.bootstrap_root_session_r2\n"
        "  ADD CONSTRAINT bootstrap_root_session_generation_fk_r2\n"
        "    FOREIGN KEY (\n"
        "      bootstrap_id,bootstrap_generation,root_session_id,root_principal_id,\n"
        "      root_role_name\n"
        "    ) REFERENCES app.bootstrap_lifecycle_r2(\n"
        "      bootstrap_id,bootstrap_generation,root_session_id,root_principal_id,\n"
        "      root_role_name\n"
        "    ) DEFERRABLE INITIALLY DEFERRED;\n\n",
        "invalid root session FK",
    )
    text = replace_once(
        text,
        "  FOREIGN KEY (source_revision_id,source_evidence_object_id,source_content_digest)\n"
        "    REFERENCES app.catalog_source_revision(\n"
        "      id,evidence_object_id,raw_content_digest\n"
        "    ),",
        "  FOREIGN KEY (source_revision_id)\n"
        "    REFERENCES app.catalog_source_revision(id),",
        "catalog source exact PK FK",
    )
    text = replace_once(
        text,
        "  ADD CONSTRAINT catalog_event_source_target_binding_fk_r2\n"
        "    FOREIGN KEY (\n"
        "      source_target_binding_id,source_target_binding_digest,\n"
        "      source_revision_id,target_kind,product_id,product_revision_id,\n"
        "      product_revision_digest,specification_revision_id,\n"
        "      specification_revision_digest,price_revision_id,price_fact_digest,\n"
        "      project_id\n"
        "    ) REFERENCES app.catalog_source_target_binding_r2(\n"
        "      id,binding_digest,source_revision_id,target_kind,product_id,\n"
        "      product_revision_id,product_revision_digest,\n"
        "      specification_revision_id,specification_revision_digest,\n"
        "      price_revision_id,price_fact_digest,project_id\n"
        "    ) DEFERRABLE INITIALLY DEFERRED,",
        "  ADD CONSTRAINT catalog_event_source_target_binding_fk_r2\n"
        "    FOREIGN KEY (source_target_binding_id)\n"
        "    REFERENCES app.catalog_source_target_binding_r2(id)\n"
        "    DEFERRABLE INITIALLY DEFERRED,",
        "catalog event binding PK FK",
    )
    text = replace_once(
        text,
        "ALTER TABLE app.selection_professional_review_result\n"
        "  ADD COLUMN professional_review_event_digest text,",
        "ALTER TABLE app.selection_professional_review_result\n"
        "  ADD COLUMN candidate_id text,\n"
        "  ADD COLUMN professional_review_event_digest text,",
        "selection professional candidate column",
    )
    text = replace_once(
        text,
        "ALTER TABLE app.sales_snapshot_professional_review_r3\n"
        "  ADD COLUMN professional_review_event_digest text,",
        "ALTER TABLE app.sales_snapshot_professional_review_r3\n"
        "  ADD COLUMN candidate_id text,\n"
        "  ADD COLUMN professional_review_event_digest text,",
        "snapshot professional candidate column",
    )
    text = replace_once(
        text,
        "PERFORM app_private.assert_protected_owner_closure_r2(p_role_name)",
        "PERFORM app_private.assert_protected_owner_closure_r3(p_role_name)",
        "owner closure R3 call",
    )

    overlay_text = overlay.read_text(encoding="utf-8")
    complete = (
        "-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R3\n"
        "-- Complete PostgreSQL 18 design DDL draft.\n"
        "-- Frozen and transformed R3-C8 Corrections R2 DDL plus R3 overlay.\n"
        "-- DESIGN ONLY. Do not execute.\n\n"
        "-- ===== BEGIN TRANSFORMED FROZEN R3-C8 CORRECTIONS R2 DDL =====\n"
        + text
        + "\n-- ===== END TRANSFORMED FROZEN R3-C8 CORRECTIONS R2 DDL =====\n\n"
        + "-- ===== BEGIN R3-C8 CORRECTIONS R3 OVERLAY =====\n"
        + overlay_text
        + "\n-- ===== END R3-C8 CORRECTIONS R3 OVERLAY =====\n"
    )
    tmp = output.with_suffix(".tmp")
    tmp.write_text(complete, encoding="utf-8", newline="\n")
    os.replace(tmp, output)
    print(f"guard={guard['verified']}")
    print(f"r2_manifest_sha256={sha256(r2_manifest)}")
    print(f"r2_ddl_sha256={sha256(r2_ddl)}")
    print(f"overlay_sha256={sha256(overlay)}")
    print(f"output={output}")
    print(f"bytes={output.stat().st_size}")
    print(f"lines={len(complete.splitlines())}")
    print(f"sha256={sha256(output)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
