#!/usr/bin/env bash
# AC-1.1: real-binary contract test for finfocus-action.
#
# Runs the finfocus commands the action runs against a real finfocus binary
# and asserts exit codes and JSON key shapes against the owner-owned fixtures
# in __tests__/fixtures/finfocus-v0.4.0/. Totals are never asserted.
#
# Usage:
#   FINFOCUS_BIN=/path/to/finfocus scripts/contract.sh
#
# Environment:
#   FINFOCUS_BIN           Path to the finfocus binary (default: finfocus from PATH)
#   CONTRACT_FIXTURE_DIR   Fixture directory to compare shapes against
#                          (default: __tests__/fixtures/finfocus-v0.4.0)

set -uo pipefail

BIN="${FINFOCUS_BIN:-finfocus}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_DIR="${CONTRACT_FIXTURE_DIR:-$ROOT/__tests__/fixtures/finfocus-v0.4.0}"
PLAN="$FIXTURE_DIR/aws-simple-plan.json"

failures=0
pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; failures=$((failures + 1)); }

check_prereqs() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "contract.sh: jq is required" >&2
    exit 2
  fi
  if [ ! -x "$BIN" ] && ! command -v "$BIN" >/dev/null 2>&1; then
    echo "contract.sh: finfocus binary not found: $BIN" >&2
    exit 2
  fi
  for f in aws-simple-plan.json cost-projected-aws-public.json plugin-list.txt; do
    if [ ! -f "$FIXTURE_DIR/$f" ]; then
      echo "contract.sh: missing fixture: $FIXTURE_DIR/$f" >&2
      exit 2
    fi
  done
}

# run_cmd <outfile> <errfile> <cmd...> — captures exit code in EXIT
run_cmd() {
  local out="$1" err="$2"
  shift 2
  "$@" >"$out" 2>"$err"
  EXIT=$?
}

# assert_keys <label> <json-file> <jq-path> <fixture-file>
# Compares the sorted key set at <jq-path> with the same path in the fixture.
assert_keys() {
  local label="$1" file="$2" path="$3" fixture="$4"
  local got exp
  if ! got=$(jq -Sc "$path | keys" "$file" 2>/dev/null); then
    fail "$label: output is not JSON with keys at '$path'"
    return
  fi
  exp=$(jq -Sc "$path | keys" "$fixture")
  if [ "$got" = "$exp" ]; then
    pass "$label: keys at '$path' match fixture ($got)"
  else
    fail "$label: keys at '$path' differ: got $got, fixture $exp"
  fi
}

main() {
  check_prereqs
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  echo "contract: binary=$BIN fixtures=$FIXTURE_DIR"

  # 1. --version
  run_cmd "$tmp/out" "$tmp/err" "$BIN" --version
  if [ "$EXIT" -eq 0 ] && grep -Eq 'v?[0-9]+\.[0-9]+\.[0-9]+' "$tmp/out"; then
    pass "--version: exit 0, version string: $(head -n1 "$tmp/out")"
  else
    fail "--version: exit=$EXIT out=$(head -n1 "$tmp/out")"
  fi

  # 2. plugin install aws-public (idempotent: an existing install is fine)
  run_cmd "$tmp/out" "$tmp/err" "$BIN" plugin install aws-public
  if [ "$EXIT" -eq 0 ]; then
    pass "plugin install aws-public: exit 0"
  elif grep -q 'already installed' "$tmp/err"; then
    pass "plugin install aws-public: already installed (exit=$EXIT accepted)"
  else
    fail "plugin install aws-public: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  fi

  # 3. plugin list — header columns must match the fixture header
  run_cmd "$tmp/out" "$tmp/err" "$BIN" plugin list
  local fixture_header live_header
  fixture_header=$(head -n1 "$FIXTURE_DIR/plugin-list.txt" | awk '{print $1, $2, $3}')
  live_header=$(head -n1 "$tmp/out" | awk '{print $1, $2, $3}')
  if [ "$EXIT" -eq 0 ] && [ "$live_header" = "$fixture_header" ]; then
    pass "plugin list: exit 0, header '$live_header'"
  else
    fail "plugin list: exit=$EXIT header='$live_header' fixture='$fixture_header'"
  fi
  if grep -q 'aws-public' "$tmp/out"; then
    pass "plugin list: aws-public present"
  else
    fail "plugin list: aws-public missing from output"
  fi

  # 4. cost projected --pulumi-json <plan> --output json
  run_cmd "$tmp/proj.json" "$tmp/err" \
    "$BIN" cost projected --pulumi-json "$PLAN" --output json
  if [ "$EXIT" -ne 0 ]; then
    fail "cost projected: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  else
    pass "cost projected: exit 0"
    assert_keys "cost projected" "$tmp/proj.json" "." \
      "$FIXTURE_DIR/cost-projected-aws-public.json"
    assert_keys "cost projected" "$tmp/proj.json" ".finfocus" \
      "$FIXTURE_DIR/cost-projected-aws-public.json"
    assert_keys "cost projected" "$tmp/proj.json" ".finfocus.summary" \
      "$FIXTURE_DIR/cost-projected-aws-public.json"
    if jq -e '.finfocus.summary.totalMonthly | type == "number"' "$tmp/proj.json" >/dev/null; then
      pass "cost projected: .finfocus.summary.totalMonthly is a number"
    else
      fail "cost projected: .finfocus.summary.totalMonthly is not a number"
    fi
  fi

  # 5. cost recommendations --pulumi-json <plan> --output json
  run_cmd "$tmp/rec.json" "$tmp/err" \
    "$BIN" cost recommendations --pulumi-json "$PLAN" --output json
  if [ "$EXIT" -ne 0 ]; then
    fail "cost recommendations: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  else
    if jq -e '
      (.summary | type == "object")
      and (.summary.total_count | type == "number")
      and (.summary.total_savings | type == "number")
      and (.summary.currency | type == "string")
      and (.summary.count_by_action_type | type == "object")
      and (.recommendations | type == "array")
    ' "$tmp/rec.json" >/dev/null; then
      pass "cost recommendations: exit 0, summary/recommendations shape OK"
    else
      fail "cost recommendations: unexpected JSON shape: $(head -c 200 "$tmp/rec.json")"
    fi
  fi

  # 6. cost actual --pulumi-json <plan> --from <d> --to <d> --output json
  run_cmd "$tmp/act.json" "$tmp/err" \
    "$BIN" cost actual --pulumi-json "$PLAN" --from 2026-09-26 --to 2026-10-03 --output json
  if [ "$EXIT" -ne 0 ]; then
    fail "cost actual: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  else
    if jq -e 'type == "array" and (all(.[]; has("resourceType") and has("monthly")))' \
      "$tmp/act.json" >/dev/null; then
      pass "cost actual: exit 0, JSON array of costed resources"
    else
      fail "cost actual: unexpected JSON shape: $(head -c 200 "$tmp/act.json")"
    fi
  fi

  echo
  if [ "$failures" -gt 0 ]; then
    echo "contract: $failures check(s) FAILED"
    exit 1
  fi
  echo "contract: all checks passed"
}

main "$@"
