# Snapshot Deferred Validation Contract R3-C6

Status:

```text
DDL DESIGN
NOT EXECUTED
```

## 1. Final-State Invariant

A `FINALIZED` Snapshot commits only when:

- exact selection provenance is present;
- all required candidates/parameters/prices/sources/reviews are represented;
- RuleSet ID and digest match the sealed SelectionRun;
- SourceKey is within 1..362 bytes and equals its structured derivation;
- Warning sequence matches the canonical `(code,text,sourceWarningId)` order;
- Price validity agrees with `basis_as_of`;
- the independent Basis verifier reproduces exact bytes/hash/count;
- no finalized row can be changed.

## 2. Immediate Guards

### Header

```sql
CREATE FUNCTION app_private.guard_snapshot_header_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'snapshot delete denied' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.state='FINALIZED' THEN
    RAISE EXCEPTION 'finalized snapshot immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.case_id,NEW.project_id,NEW.conversation_id,
        NEW.requirement_id,NEW.requirement_version_id,
        NEW.installation_scenario,NEW.selection_run_id,
        NEW.rule_set_revision_id,NEW.rule_set_content_digest,
        NEW.basis_as_of,NEW.version_number)
       IS DISTINCT FROM
       (OLD.id,OLD.case_id,OLD.project_id,OLD.conversation_id,
        OLD.requirement_id,OLD.requirement_version_id,
        OLD.installation_scenario,OLD.selection_run_id,
        OLD.rule_set_revision_id,OLD.rule_set_content_digest,
        OLD.basis_as_of,OLD.version_number) THEN
      RAISE EXCEPTION 'snapshot identity immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.state='DRAFT' AND NEW.state='FINALIZED' THEN
      IF NEW.finalized_at IS NULL THEN
        NEW.finalized_at := clock_timestamp();
      END IF;
      NEW.mutation_version := OLD.mutation_version + 1;
    ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
      RAISE EXCEPTION 'illegal snapshot state transition' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_snapshot_header_r3
BEFORE UPDATE OR DELETE ON app.sales_handoff_snapshot_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_header_r3();
```

### Child

One function is attached to every canonical child and metadata table:

```sql
CREATE FUNCTION app_private.guard_snapshot_child_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private AS $$
DECLARE
  v_snapshot_id text;
  v_state text;
BEGIN
  v_snapshot_id := COALESCE(to_jsonb(NEW)->>'snapshot_id',
                            to_jsonb(OLD)->>'snapshot_id');
  IF v_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'child snapshot id missing' USING ERRCODE='23514';
  END IF;
  SELECT state INTO v_state
    FROM app.sales_handoff_snapshot_r3
   WHERE id=v_snapshot_id
   FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'parent snapshot missing' USING ERRCODE='23503';
  END IF;
  IF v_state='FINALIZED' THEN
    RAISE EXCEPTION 'finalized snapshot child immutable' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
```

Attach `BEFORE INSERT OR UPDATE OR DELETE` to:

```text
snapshot_basis_metadata_r3
sales_snapshot_requirement_field_r3
sales_snapshot_candidate_r3
sales_snapshot_parameter_r3
sales_snapshot_price_r3
sales_snapshot_source_r3
sales_snapshot_catalog_review_r3
sales_snapshot_professional_review_r3
sales_snapshot_warning_r3
sales_snapshot_missing_field_r3
```

### TRUNCATE

```sql
CREATE FUNCTION app_private.deny_snapshot_truncate_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'snapshot truncate denied' USING ERRCODE='42501';
END $$;

CREATE TRIGGER deny_snapshot_truncate_r3
BEFORE TRUNCATE ON app.sales_handoff_snapshot_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
```

Repeat for every child, Basis metadata and validation table. Table ownership and
TRUNCATE grants provide a second boundary.

## 3. Deferred Constraint Trigger

```sql
CREATE FUNCTION app_private.dispatch_snapshot_validation_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private AS $$
DECLARE
  v_snapshot_id text;
BEGIN
  v_snapshot_id := COALESCE(to_jsonb(NEW)->>'snapshot_id',
                            to_jsonb(OLD)->>'snapshot_id');
  PERFORM app_private.validate_snapshot_r3(v_snapshot_id);
  RETURN COALESCE(NEW,OLD);
END $$;
```

For the Header, use `to_jsonb(NEW)->>'id'`/`OLD.id`.

Attach as:

```sql
CREATE CONSTRAINT TRIGGER validate_snapshot_r3
AFTER INSERT OR UPDATE OR DELETE ON app.<table>
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
```

## 4. Validator

The full proposed body is in
`SNAPSHOT_TRIGGER_AND_FUNCTION_DDL_PROPOSAL_R3_C6.md`.

Failure raises SQLSTATE `23514`; commit fails and all transaction changes are
rolled back.

## 5. Finalization CAS

`mutation_version` is a real column on the Snapshot envelope. The only legal
transition is:

```sql
UPDATE app.sales_handoff_snapshot_r3
SET state='FINALIZED',
    finalized_at=now(),
    mutation_version=mutation_version+1
WHERE id=p_snapshot_id
  AND state='DRAFT'
  AND mutation_version=p_expected_mutation_version
RETURNING mutation_version;
```

Zero rows means conflict.

## 6. Database Boundary

No SQL or trigger was executed. PostgreSQL semantics remain `NOT VERIFIED`
until an authorized isolated database test.

