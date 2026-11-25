# P1 Product Remediation Open Decisions R3-C7

Artifact: `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Existing Decisions

All 51 prior decisions remain present and open:

| Family | IDs | Count | State |
|---|---|---:|---|
| R2 | `OD-R2-01`..`OD-R2-20` | 20 | OPEN |
| R3 | `OD-R3-01`..`OD-R3-09` | 9 | OPEN |
| R3-C2 | `OD-R3-C2-01`..`OD-R3-C2-04` | 4 | OPEN |
| R3-C3 | `OD-R3-C3-01`..`OD-R3-C3-04` | 4 | OPEN |
| R3-C4 | `OD-R3-C4-01`..`OD-R3-C4-04` | 4 | OPEN |
| R3-C5 | `OD-R3-C5-01`..`OD-R3-C5-05` | 5 | OPEN |
| R3-C6 | `OD-R3-C6-01`..`OD-R3-C6-05` | 5 | OPEN |

No ID was renumbered, closed or deleted.

Exact preserved identifiers:

```text
OD-R2-01 OD-R2-02 OD-R2-03 OD-R2-04 OD-R2-05
OD-R2-06 OD-R2-07 OD-R2-08 OD-R2-09 OD-R2-10
OD-R2-11 OD-R2-12 OD-R2-13 OD-R2-14 OD-R2-15
OD-R2-16 OD-R2-17 OD-R2-18 OD-R2-19 OD-R2-20

OD-R3-01 OD-R3-02 OD-R3-03 OD-R3-04 OD-R3-05
OD-R3-06 OD-R3-07 OD-R3-08 OD-R3-09

OD-R3-C2-01 OD-R3-C2-02 OD-R3-C2-03 OD-R3-C2-04
OD-R3-C3-01 OD-R3-C3-02 OD-R3-C3-03 OD-R3-C3-04
OD-R3-C4-01 OD-R3-C4-02 OD-R3-C4-03 OD-R3-C4-04
OD-R3-C5-01 OD-R3-C5-02 OD-R3-C5-03 OD-R3-C5-04 OD-R3-C5-05
OD-R3-C6-01 OD-R3-C6-02 OD-R3-C6-03 OD-R3-C6-04 OD-R3-C6-05
```

## 2. New R3-C7 Decisions

| ID | Decision | Owner | Schema | Migration | Production |
|---|---|---|---|---|---|
| `OD-R3-C7-01` | Approve function ownership and deployment identities | database/security | BLOCKS | BLOCKS | BLOCKS |
| `OD-R3-C7-02` | Approve PostgreSQL-version JSON canonicalization and upgrade policy | product/database/security | BLOCKS | BLOCKS | BLOCKS |
| `OD-R3-C7-03` | Approve 16 MiB Basis/4096-record/65536-field budget | product/database | BLOCKS | BLOCKS | BLOCKS |
| `OD-R3-C7-04` | Approve lock timeout, deadlock retry and long-transaction limits | database/security/operations | BLOCKS | BLOCKS | BLOCKS |
| `OD-R3-C7-05` | Approve capability-to-view grants and break-glass audit access | security/technical authority | BLOCKS | BLOCKS | BLOCKS |
| `OD-R3-C7-06` | Approve evidence retention/export and audit archive ownership | security/legal/product | BLOCKS schema activation | BLOCKS | BLOCKS |

All six are `OPEN` and have no approval evidence.

## 3. Decision State

```text
Prior decisions present/open: 51 / 51
R3-C7 decisions present/open:  6 / 6
Total present/open:           57 / 57
Approvals added:               0
```

Design completeness does not close a decision. Formal owner approval is needed
after independent design review.

## 4. No Waivers

No Open Decision can waive:

- exact provenance FKs;
- sealed-run immutability;
- TrustedSession revocation ordering;
- Policy content/digest binding;
- effective-policy event proof;
- append-only/truncate controls;
- protected View scope;
- Node/Python/Database resource limits;
- runtime least privilege;
- P1-3 file lifecycle isolation.
