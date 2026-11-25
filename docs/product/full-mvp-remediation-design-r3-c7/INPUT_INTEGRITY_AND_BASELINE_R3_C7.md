# Input Integrity and Baseline R3-C7

Artifact: `INPUT_INTEGRITY_AND_BASELINE_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Shell

```text
PowerShell: 7.6.9
PSEdition: Core
FileVersion: 7.6.9.500
Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
PID observed: 34140
Parent PID: 27624
Parent: codex.exe
```

Commands used no error redirection.

## 2. R3-C6 Design

```text
Manifest:
docs/product/full-mvp-remediation-design-r3-c6/SHA256SUMS_R3_C6.txt

SHA-256:
905D062BC424BF8B76AFAA4D8D078474528FB609817E635604FD31CC77D0DBFC

Records: 48
Unique paths: 48
Mismatches: 0
Coverage differences: 0
```

## 3. R3-C6 Review

```text
Manifest:
docs/product/full-mvp-remediation-review-r3-c6/SHA256SUMS_R3_C6_REVIEW.txt

SHA-256:
CF8AD3D51551ED1F675744B829DA52A00EE39410478878F2D67BF15BAD436B41

Records: 16
Unique paths: 16
Mismatches: 0
Coverage differences: 0
```

## 4. Historical Manifests

| Manifest | SHA-256 | Records | Mismatches |
|---|---|---:|---:|
| R3-C5 design | `40B53E7C639F9D48AB83231593B85FBCD00314B8E979220E7F9BA4A2E0799424` | 25 | 0 |
| R3-C5 review | `275A53455A8AD5A03FAC6E52271A54421442A78912A35147CB6013B02E57D0CC` | 14 | 1 |
| R3-C4 design | `347EB6515BB910C4C1AE22319655BC078D7130CCBC832E2D55420827B9DD778B` | 16 | 0 |
| R3-C4 review | `BB96FF7A3A60B7C2AFFF0EC7DF89FC8D32DFE6C49D17ECD74B1F53EB5445FB6B` | 9 | 0 |

The sole mismatch remains the previously accepted C5 generated `.pyc`. It was
not modified by R3-C7. Current `.pyc` hash:

```text
C070038FBA750718C54DB2AE990F9940FAFD1E5965F1702E4A8877931EBB7E73
```

C5 source remains:

```text
92383447283C3C18C27AFDB402FB45CD3398679CD2E58DDAA920E12F4A45A19D
```

R3-C7 inherits only the accepted generated-cache exception. No new historical
drift was found.

## 5. C6 Basis Baseline

```text
Bytes: 4036
SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

The R3-C7 Node and Python encoders reproduce it exactly.

## 6. Python Cache Protection

Every Python executable invocation used:

```text
PYTHONDONTWRITEBYTECODE=1
python -B
```

No `__pycache__` was created under the C7 design/review tool directories in this
phase.
