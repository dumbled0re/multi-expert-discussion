# Test fixtures

Regression test data for `scripts/validate-discussion.mjs`.

## `v2-broken-output/`

A copy of `claims.json` produced by the v2 (pre-rewrite) facilitator subagent that simulated experts inline. This file violates the v3 schema in many ways and **must fail validation** — that is the whole point of the fixture.

### Known violations (the validator should catch ALL of these)

- Top level: missing `topic_slug`, `constitution_version`, `rounds_run`
- Claim IDs: `C-AC-1` uppercase + missing leading zero (regex demands `^C-(tl|ac|...)-[0-9]{2}[a-z]?$`)
- `confidence`: decimal `0.8` instead of integer 0-100
- `impact`/`cost`: `"High"` / `"Low"` instead of `H|M|L` enum
- Missing per-claim required fields: `round_introduced`, `status`, `rationale`, `assumptions`, `evidence`, `falsifier`, `failure_mode`, `reversibility`, `blast_radius`, `horizon`
- `evidence_refs` (string array) instead of structured `evidence` (object array)
- No `questions` array, no `audit_findings` array

### Run the test

```bash
node scripts/validate-discussion.mjs test-fixtures/v2-broken-output
echo "exit=$?"  # MUST be 1 (validation failed)
```

If this exits 0, the v3 validator has regressed — restore strictness.

## How to update

If the v3 schema changes (e.g. a new required field), re-run the validator on `v2-broken-output` and confirm it still fails. The expected error count may grow — that's fine. The contract is: this fixture **never** passes.
