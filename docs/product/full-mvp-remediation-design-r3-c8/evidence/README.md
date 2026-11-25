# R3-C8 Offline Evidence

Generated-only evidence for the R3-C8 design package. No evidence file is an
authorization to execute SQL, connect to PostgreSQL, build, or run Runtime.

The evidence distinguishes:

- independently reconstructed C6-SNAP-01 bytes;
- independent Node/Python scalar, SourceKey and resource-limit vectors;
- static SQL text checks for function signatures, owners, call targets, exact
  referenced keys for all parsed foreign keys, required digest FKs, table
  ownership, TRUNCATE guards, privilege closure and R6 source-text rules.

The SQL checks do not parse or execute PostgreSQL SQL. They do not establish
PostgreSQL compilation, Catalog state, trigger behavior, ACL behavior, or
concurrency correctness.
