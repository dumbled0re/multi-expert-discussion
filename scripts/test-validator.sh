#!/usr/bin/env bash
# Regression test for scripts/validate-discussion.mjs
# Asserts that the v2 broken fixture still fails validation.
set -u

FIXTURE_DIR="test-fixtures/v2-broken-output"

if [ ! -d "$FIXTURE_DIR" ]; then
  echo "✗ Fixture missing: $FIXTURE_DIR"
  exit 2
fi

# Capture output and exit code separately
output=$(node scripts/validate-discussion.mjs "$FIXTURE_DIR" 2>&1)
exit_code=$?

if [ "$exit_code" -eq 0 ]; then
  echo "✗ FAIL: validator exited 0 on broken fixture (regression)"
  echo "$output" | head -20
  exit 1
fi

# Count errors (heuristic — v2 broken output should have many)
err_count=$(echo "$output" | grep -c "^\[ERROR\]" || true)
if [ "$err_count" -lt 10 ]; then
  echo "✗ FAIL: expected ≥10 errors on broken fixture, got $err_count"
  echo "$output" | head -20
  exit 1
fi

echo "✓ PASS: validator caught $err_count errors on v2-broken-output (expected)"
exit 0
