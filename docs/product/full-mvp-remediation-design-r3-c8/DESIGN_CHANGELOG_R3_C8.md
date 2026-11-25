# Design Changelog R3-C8

## Added

- Session role registry and activation-token binding.
- Backend PID/start-time and session GUC binding.
- Session-bound AuthorityGrant and subject-scoped audit authority.
- Separate Grant recipient (`principal_id`) from audit subject
  (`subject_principal_id`), with explicit `GLOBAL` / `PROJECT` / `POLICY` /
  `PRINCIPAL` scope matching in both locking and View paths.
- Command Request Ledger for create/seal idempotency.
- Controlled creation functions for the complete selection workflow and
  ProfessionalReview initial event.
- Source-row digest columns, FKs and verification triggers for Snapshot
  provenance.
- Exact Snapshot Candidate result digest FK.
- Exact referenced UNIQUE constraints for product, specification and
  SelectionRun context FKs, including the full candidate/price/digest key.
- Complete selected-set `EXCEPT` completeness checks.
- State CHECK constraints and policy pointer composite relationships.
- Complete Selection/Policy TRUNCATE guards.
- Final R3-C8 function signature Registry and offline evidence hooks.
- Individual disposition rows for all 57 Open Decisions, with options,
  impact, proposed non-binding recommendations, and implementation blockers.

## Changed

- Runtime web/worker/auditor/reporting roles are capability roles, not shared
  database login identities.
- Session status View filters active bound caller sessions; audit View is
  subject-scoped.
- SQL SourceKey normalizes NFD to NFC, matching Node/Python.
- SQL Header/StableKey/Decimal validation now follows the registry.
- Policy create and selection seal now use request replay.
- SECURITY DEFINER owners receive necessary schema/table/function access.

## Preserved

- C6-SNAP-01 bytes and SHA-256.
- SourceKey 362 bytes.
- Basis BYTES 512 bytes.
- SK-R2 Registry code 3.
- All 57 prior Open Decisions.

No tracked source, Prisma, Migration, database, Git index, or HEAD state was
changed. Only authorized untracked files under the R3-C8 design directory were
added.
