# Selection Source-Aux Pre-Seal Validation R3-C8 Corrections

`validate_selection_source_aux_r3` validates the complete selected source set
before Seal:

- every requirement source row has a consistent NULL/text auxiliary shape;
- non-NULL text is NFC, non-empty, control-free and at most 128 UTF-8 bytes;
- every SourceKey is at most 362 bytes;
- Source/Requirement source rows have consistent project/version/field facts;
- the run cannot be sealed with an invalid source-aux value.

`seal_selection_run` acquires the run row lock, validates the source set, then
performs result-count, digest, seal and request-ledger steps in the same
transaction. Snapshot validation remains a second independent check, not the
first place where a malformed source becomes visible.

The Selection source tables are protected by append-only/TRUNCATE guards after
the run is sealed. Concurrent inserts/updates/deletes cannot bypass the run lock
and source validation.
