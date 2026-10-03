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
# Resolve a relative/binary path to absolute: finfocus commands run from a
# scratch directory so the CLI cannot drop artifacts into the repository.
if [ "$BIN" != "finfocus" ] && [ -e "$BIN" ]; then
  BIN="$(cd "$(dirname "$BIN")" && pwd)/$(basename "$BIN")"
fi

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
  cd "$tmp"

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

  # 7. guardrail call shape (AC-2.2): the exact arguments guardrails.ts uses
  # for threshold checks. With no budget configured this must exit 0.
  run_cmd "$tmp/guard.json" "$tmp/err" \
    "$BIN" cost projected --pulumi-json "$PLAN" \
    --exit-on-threshold --exit-code 10 --output json
  if [ "$EXIT" -eq 0 ] && jq -e '.finfocus.summary.totalMonthly | type == "number"' \
    "$tmp/guard.json" >/dev/null; then
    pass "guardrail call shape: --pulumi-json --exit-on-threshold --exit-code 10 exits 0"
  else
    fail "guardrail call shape: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  fi

  # 8. budget breach exit path (AC-2.3): with cost.budgets.global below the
  # projected total, --exit-on-threshold --exit-code 10 must exit 10 and the
  # table output must show the BUDGET STATUS block. Uses an isolated
  # FINFOCUS_HOME with the installed plugins copied in.
  local home="$tmp/finfocus-home"
  mkdir -p "$home"
  if [ -d "$HOME/.finfocus/plugins" ]; then
    cp -r "$HOME/.finfocus/plugins" "$home/plugins"
  fi
  cat > "$home/config.yaml" <<'EOF'
cost:
  budgets:
    global:
      amount: 5.00
      currency: USD
      period: monthly
      alerts:
        - threshold: 80
          type: actual
        - threshold: 100
          type: forecasted
EOF
  run_cmd "$tmp/breach.txt" "$tmp/err" \
    env FINFOCUS_HOME="$home" "$BIN" cost projected --pulumi-json "$PLAN" \
    --exit-on-threshold --exit-code 10
  if [ "$EXIT" -eq 10 ] && grep -q 'BUDGET STATUS' "$tmp/breach.txt"; then
    pass "budget breach: exit 10 with BUDGET STATUS block (\$7.59 vs \$5.00 budget)"
  else
    fail "budget breach: exit=$EXIT (want 10) out=$(grep -c 'BUDGET STATUS' "$tmp/breach.txt") BUDGET STATUS block(s)"
  fi

  # 9. subcommand existence: every finfocus subcommand the action runs must
  # exist in the binary's help. Guards against dead calls like the removed
  # `finfocus budget status` (no such command in v0.4.0).
  local subcommands=(
    "cost projected"
    "cost recommendations"
    "cost actual"
    "cost estimate"
    "plugin install"
    "plugin list"
  )
  for sub in "${subcommands[@]}"; do
    # shellcheck disable=SC2086 # intentional word splitting of the subcommand
    run_cmd "$tmp/out" "$tmp/err" "$BIN" $sub --help
    if [ "$EXIT" -eq 0 ]; then
      pass "subcommand exists: $sub --help exits 0"
    else
      fail "subcommand missing: '$sub' --help exited $EXIT: $(tail -n1 "$tmp/err")"
    fi
  done

  # 10. cost estimate single-resource shape (AC-4.1): the exact arguments
  # analyze.ts runEstimate builds from the estimate-spec input. Only the
  # single-resource mode is exposed; plan-based --modify cannot match Pulumi
  # URNs in v0.4.0.
  run_cmd "$tmp/est.json" "$tmp/err" \
    "$BIN" cost estimate --provider aws \
    --resource-type aws:ec2/instance:Instance \
    --property instanceType=m5.large --region us-east-1 --output json
  if [ "$EXIT" -ne 0 ]; then
    fail "cost estimate: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  else
    if jq -e '
      (.resource | type == "object")
      and (.baseline | type == "object")
      and (.modified | type == "object")
      and (.totalChange | type == "number")
      and (.deltas | type == "array")
      and (.modified.monthly | type == "number")
    ' "$tmp/est.json" >/dev/null; then
      pass "cost estimate: exit 0, estimate report shape OK"
    else
      fail "cost estimate: unexpected JSON shape: $(head -c 200 "$tmp/est.json")"
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
