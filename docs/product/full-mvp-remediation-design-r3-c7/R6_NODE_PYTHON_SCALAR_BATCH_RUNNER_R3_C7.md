# R6 Node/Python Scalar Batch Runner R3-C7

Artifact: `R6_NODE_PYTHON_SCALAR_BATCH_RUNNER_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Files

```text
scalar_vectors_r3_c7.json
tools/r6_encoder_r3_c7.js
tools/r6_encoder_r3_c7.py
tools/run_scalar_node.js
tools/run_scalar_python.py
tools/run_scalar_parity_check.js
```

## 2. Runner Contract

Each per-language runner emits:

```text
id
inputSummary
expected
observed
reason
outputBytes
partialBasisProduced
result
```

The parity checker compares:

- vector inventory coverage;
- expected category;
- observed category;
- standardized reason code;
- output byte count;
- partial-Basis flag;
- per-case result.

Input summaries are diagnostic and may use language-native Boolean spelling;
they are not semantic parity fields.

## 3. Actual Entry

The batch runner calls the exported scalar function from the same encoder used
for complete Basis construction. `SOURCE_AUX` cases call the exported auxiliary
validator from that encoder.

It does not construct a second scalar rule table.

## 4. Result

```text
Node total: 23
Python total: 23
Missing vectors: 0
Extra vectors: 0
Reason mismatches: 0
Accept/Reject mismatches: 0
PASS
```

## 5. Reuse

Future R3-C7 review can rerun the commands unchanged. Adding a vector means
editing the JSON inventory, not either runner.
