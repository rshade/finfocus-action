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

# Run dist/index.js with the release named by FINFOCUS_BIN.
run_action() {
  local tmp="$1"
  local version node_bin
  if [ ! -f "$ROOT/dist/index.js" ]; then
    fail "action: dist/index.js is missing. Commit the ncc build."
    return
  fi
  if ! node_bin=$(command -v node); then
    fail "action: node is required to run dist/index.js"
    return
  fi
  version=$("$BIN" --version | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
  if [ -z "$version" ]; then
    fail "action: could not parse a version from $BIN --version"
    return
  fi

  local home="$tmp/action-home"
  local tool_cache="$tmp/tool-cache"
  local runner_temp="$tmp/runner-temp"
  mkdir -p "$home" "$tool_cache" "$runner_temp"
  : >"$tmp/github-output"
  : >"$tmp/github-path"
  : >"$tmp/github-state"

  # Do not set FINFOCUS_HOME. finfocus v0.4.0 plugin install writes plugins
  # under $HOME/.finfocus and ignores FINFOCUS_HOME, so a separate home would
  # price the plan at $0.
  if ! (
    cd "$ROOT" || exit 1
    env -u PULUMI_HOME -u FINFOCUS_HOME \
      HOME="$home" \
      RUNNER_TOOL_CACHE="$tool_cache" \
      RUNNER_TEMP="$runner_temp" \
      GITHUB_OUTPUT="$tmp/github-output" \
      GITHUB_PATH="$tmp/github-path" \
      GITHUB_STATE="$tmp/github-state" \
      FINFOCUS_COMMENT_PATH="$tmp/comment.md" \
      GITHUB_TOKEN="${GITHUB_TOKEN:-}" \
      INPUT_PULUMI_PLAN_JSON="$PLAN" \
      INPUT_FINFOCUS_VERSION="$version" \
      INPUT_INSTALL_PLUGINS="aws-public" \
      INPUT_POST_COMMENT="false" \
      INPUT_GITHUB_TOKEN="" \
      INPUT_INCLUDE_RECOMMENDATIONS="true" \
      INPUT_INCLUDE_SUSTAINABILITY="true" \
      INPUT_INCLUDE_ACTUAL_COSTS="false" \
      INPUT_BUDGET_AMOUNT="100" \
      INPUT_BUDGET_CURRENCY="USD" \
      INPUT_GENERATE_ARTIFACT="true" \
      INPUT_ARTIFACT_NAME="cost-report" \
      "$node_bin" "$ROOT/dist/index.js"
  ); then
    fail "action: dist/index.js failed for finfocus $version"
    return
  fi

  local cost currency carbon
  cost=$(output_value "$tmp/github-output" total-monthly-cost)
  currency=$(output_value "$tmp/github-output" currency)
  carbon=$(output_value "$tmp/github-output" total-carbon-footprint)
  if awk -v c="$cost" 'BEGIN { exit !(c+0 > 0) }' && [ -n "$currency" ]; then
    pass "action: total-monthly-cost=$cost $currency"
  else
    fail "action: expected a non-zero total-monthly-cost, got cost='$cost' currency='$currency'"
  fi
  if awk -v c="$carbon" 'BEGIN { exit !(c+0 > 0) }'; then
    pass "action: total-carbon-footprint=$carbon kg"
  else
    fail "action: total-carbon-footprint is not a positive number: '$carbon'"
  fi
  if [ -s "$tmp/comment.md" ] \
    && grep -q 'finfocus-action-comment' "$tmp/comment.md" \
    && grep -q 'Monthly Cost' "$tmp/comment.md"; then
    pass "action: wrote a PR comment body with a monthly cost"
  else
    fail "action: comment body missing marker or monthly cost"
  fi
  local report_json
  report_json=$(output_value "$tmp/github-output" report-json-path)
  if [ -n "$report_json" ] && jq -e '.summary.totalMonthly > 0' "$report_json" >/dev/null; then
    pass "action: wrote report JSON at $report_json"
  else
    fail "action: report JSON missing or empty: '$report_json'"
  fi
  if grep -q 'Budget Status' "$tmp/comment.md" && grep -q '100.00' "$tmp/comment.md"; then
    pass "action: budget section is populated from budget-amount"
  else
    fail "action: budget section missing from the comment"
  fi
  if grep -R -n -E "budget status --|finfocus budget" "$ROOT/src" --include='*.ts' >/dev/null; then
    fail "action: src still invokes finfocus budget status"
  else
    pass "action: src does not call finfocus budget status"
  fi
}

# Read one GITHUB_OUTPUT value. @actions/core writes name=value, or
# name<<DELIM / value / DELIM when the toolkit uses a delimiter.
output_value() {
  local file="$1" name="$2"
  awk -v name="$name" '
    index($0, name "=") == 1 {
      print substr($0, length(name) + 2)
      exit
    }
    index($0, name "<<") == 1 {
      delim = substr($0, length(name) + 3)
      while ((getline line) > 0) {
        if (line == delim) exit
        print line
      }
      exit
    }
  ' "$file"
}

# run_cmd <outfile> <errfile> <cmd...> — captures exit code in EXIT
run_cmd() {
  local out="$1" err="$2"
  shift 2
  "$@" >"$out" 2>"$err"
  EXIT=$?
}

# assert_keys <label> <json-file> <jq-path> <fixture-file>
# Every key in the fixture at <jq-path> must still be present. Extra keys are
# additive finfocus changes: they are reported as a NOTE and do not fail.
assert_keys() {
  local label="$1" file="$2" path="$3" fixture="$4"
  local got exp missing extra
  if ! got=$(jq -Sc "$path | keys" "$file" 2>/dev/null); then
    fail "$label: output is not JSON with keys at '$path'"
    return
  fi
  exp=$(jq -Sc "$path | keys" "$fixture")
  missing=$(jq -nc --argjson g "$got" --argjson e "$exp" '$e - $g')
  extra=$(jq -nc --argjson g "$got" --argjson e "$exp" '$g - $e')
  if [ "$missing" != "[]" ]; then
    fail "$label: keys at '$path' missing $missing (got $got, fixture $exp)"
    return
  fi
  pass "$label: fixture keys at '$path' all present ($exp)"
  if [ "$extra" != "[]" ]; then
    echo "NOTE: $label: new keys at '$path': $extra (additive; consider updating the fixture)"
  fi
}

main() {
  check_prereqs
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  cd "$tmp" || exit 1

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

  # 8. budget breach after plugin install has created config.hujson.
  # finfocus migrates config.yaml only when config.hujson does not exist yet.
  # A yaml budget written afterwards is ignored, so --exit-on-threshold never
  # fires. ConfigManager must merge cost.budgets.global into the hujson file
  # and leave installed_plugins in place.
  local home="$tmp/finfocus-home"
  mkdir -p "$home"
  if [ -d "$HOME/.finfocus/plugins" ]; then
    cp -r "$HOME/.finfocus/plugins" "$home/plugins"
  fi
  cat > "$home/config.hujson" <<'EOF'
{
  // plugin install records this before the action writes the budget
  "installed_plugins": [
    {"name": "aws-public", "version": "v0.2.0", "url": "https://example.com/aws-public"},
  ],
}
EOF
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
  if [ "$EXIT" -eq 0 ]; then
    pass "budget yaml ignored once config.hujson exists (exit 0)"
  else
    fail "budget yaml was honored beside config.hujson: exit=$EXIT (want 0)"
  fi

  if [ ! -x "$ROOT/node_modules/.bin/tsx" ]; then
    fail "budget write: $ROOT/node_modules/.bin/tsx is missing. Run npm ci before scripts/contract.sh"
  elif ! (
    cd "$ROOT" || exit 1
    env -u PULUMI_HOME FINFOCUS_HOME="$home" \
      BUDGET_AMOUNT=5 \
      BUDGET_CURRENCY=USD \
      BUDGET_PERIOD=monthly \
      BUDGET_ALERTS='[{"threshold":80,"type":"actual"},{"threshold":100,"type":"forecasted"}]' \
      "$ROOT/node_modules/.bin/tsx" "$ROOT/scripts/write-budget-config.ts"
  ); then
    fail "budget write: ConfigManager.writeConfig failed"
  elif jq -e '
    .installed_plugins[0].name == "aws-public"
    and .cost.budgets.global.amount == 5
    and .cost.budgets.global.currency == "USD"
    and .cost.budgets.global.period == "monthly"
  ' "$home/config.hujson" >/dev/null; then
    pass "budget write: merged cost.budgets.global into config.hujson and kept installed_plugins"
  else
    fail "budget write: config.hujson missing budget or plugins: $(cat "$home/config.hujson")"
  fi

  run_cmd "$tmp/breach.txt" "$tmp/err" \
    env FINFOCUS_HOME="$home" "$BIN" cost projected --pulumi-json "$PLAN" \
    --exit-on-threshold --exit-code 10
  if [ "$EXIT" -eq 10 ] && grep -q 'BUDGET STATUS' "$tmp/breach.txt"; then
    pass "budget breach: exit 10 with BUDGET STATUS block after hujson merge"
  else
    fail "budget breach: exit=$EXIT (want 10) out=$(grep -c 'BUDGET STATUS' "$tmp/breach.txt") BUDGET STATUS block(s) err=$(tail -n1 "$tmp/err")"
  fi

  # v0.4.0 prints the budgets struct with fmt's default format, which does not
  # include the amount. A missing budget is the single token <nil>. Exit 10
  # above is what proves the amount was loaded.
  run_cmd "$tmp/get.txt" "$tmp/err" \
    env FINFOCUS_HOME="$home" "$BIN" config get cost.budgets
  local got
  got=$(tr -d '[:space:]' < "$tmp/get.txt")
  if [ "$EXIT" -eq 0 ] && [ -n "$got" ] && [ "$got" != "<nil>" ]; then
    pass "config get cost.budgets returns a budget (not <nil>)"
  else
    fail "config get cost.budgets: exit=$EXIT out=$(head -c 200 "$tmp/get.txt") err=$(tail -n1 "$tmp/err")"
  fi

  # 9. subcommand existence: every finfocus subcommand the action runs must
  # exist in the binary's help. Guards against dead calls like the removed
  # `finfocus budget status` (no such command in v0.4.0).
  local subcommands=(
    "cost projected"
    "cost recommendations"
    "cost recommendations dismiss"
    "cost recommendations snooze"
    "cost cluster"
    "cost actual"
    "cost estimate"
    "overview"
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

  # 11. terraform state input (AC-4.2): cost projected --terraform-state must
  # exit 0 with the same envelope shape. The tfstate below is test INPUT
  # (hand-written minimal v4 state, one t3.micro aws_instance), not captured
  # finfocus output.
  cat > "$tmp/min.tfstate" <<'EOF'
{
  "version": 4,
  "terraform_version": "1.5.0",
  "serial": 1,
  "lineage": "00000000-0000-0000-0000-000000000000",
  "outputs": {},
  "resources": [
    {
      "mode": "managed",
      "type": "aws_instance",
      "name": "web",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        {
          "schema_version": 0,
          "attributes": {
            "id": "i-0123456789abcdef0",
            "arn": "arn:aws:ec2:us-east-1:123456789012:instance/i-0123456789abcdef0",
            "instance_type": "t3.micro",
            "ami": "ami-04681a1dbd79675a5",
            "region": "us-east-1"
          }
        }
      ]
    }
  ],
  "check_results": null
}
EOF
  run_cmd "$tmp/tf.json" "$tmp/err" \
    "$BIN" cost projected --terraform-state "$tmp/min.tfstate" --output json
  if [ "$EXIT" -eq 0 ] && jq -e '
      (.finfocus | type == "object")
      and (.finfocus.summary.totalMonthly | type == "number")
      and (.finfocus.resources | type == "array")
    ' "$tmp/tf.json" >/dev/null; then
    pass "terraform-state: exit 0, finfocus envelope shape OK"
  else
    fail "terraform-state: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  fi

  # 12. issue #89 flags that exist on v0.4.0 and v0.4.3. --state-only is an
  # overview flag. cost projected must not grow that flag or the action would
  # pass it to the wrong command.
  run_cmd "$tmp/out" "$tmp/err" "$BIN" cost cluster --help
  if [ "$EXIT" -eq 0 ] && grep -q -- '--group-by' "$tmp/out" && grep -q -- '--selector' "$tmp/out"; then
    pass "cost cluster: --group-by and --selector are listed"
  else
    fail "cost cluster --help missing --group-by or --selector (exit=$EXIT)"
  fi

  run_cmd "$tmp/out" "$tmp/err" "$BIN" cost recommendations --help
  if [ "$EXIT" -eq 0 ] && grep -q -- '--no-scoring' "$tmp/out" && grep -q -- '--include-dismissed' "$tmp/out"; then
    pass "cost recommendations: --no-scoring and --include-dismissed are listed"
  else
    fail "cost recommendations --help missing scoring or dismissal flags (exit=$EXIT)"
  fi

  run_cmd "$tmp/out" "$tmp/err" "$BIN" overview --help
  if [ "$EXIT" -eq 0 ] && grep -q -- '--state-only' "$tmp/out" && grep -q -- '--pulumi-state' "$tmp/out"; then
    pass "overview: --state-only and --pulumi-state are listed"
  else
    fail "overview --help missing --state-only (exit=$EXIT)"
  fi

  run_cmd "$tmp/out" "$tmp/err" "$BIN" cost projected --help
  if [ "$EXIT" -eq 0 ] && ! grep -Eq '^[[:space:]]+--state-only' "$tmp/out"; then
    pass "cost projected: --state-only is not a projected flag"
  else
    fail "cost projected --help lists --state-only; the action must not pass it there"
  fi

  # 13. kubernetes and jev are registry names the action accepts.
  run_cmd "$tmp/plugins.json" "$tmp/err" "$BIN" plugin list --available --output json
  if [ "$EXIT" -eq 0 ] && jq -e '
      (map(.name) | index("kubernetes")) != null
      and (map(.name) | index("jev")) != null
    ' "$tmp/plugins.json" >/dev/null; then
    pass "plugin registry: kubernetes and jev are listed"
  else
    fail "plugin list --available missing kubernetes or jev (exit=$EXIT)"
  fi

  # 14. break check: an unknown flag must fail. A finfocus release that starts
  # accepting every flag, or a wrapper that ignores exit codes, fails this.
  run_cmd "$tmp/out" "$tmp/err" "$BIN" cost projected --not-a-real-flag
  if [ "$EXIT" -ne 0 ]; then
    pass "break check: cost projected --not-a-real-flag exits $EXIT"
  else
    fail "break check: unknown flag exited 0"
  fi

  # A missing plan is a finfocus validation_error (exit 2), never the
  # action-owned budget breach code 10.
  run_cmd "$tmp/bad-plan.json" "$tmp/err" \
    "$BIN" cost projected --pulumi-json "$tmp/does-not-exist.json" \
    --exit-on-threshold --exit-code 10 --output json
  if [ "$EXIT" -eq 2 ] && grep -q 'validation_error' "$tmp/err"; then
    pass "bad plan: exit 2 validation_error, not a budget breach"
  else
    fail "bad plan: exit=$EXIT (want 2 validation_error) err=$(head -c 240 "$tmp/err")"
  fi

  # 15. resource filter (issue #20): --filter is a cost projected flag.
  # type= matches a case-insensitive substring. The aws-simple plan has one EC2
  # instance, so type=ec2 keeps exactly that resource.
  run_cmd "$tmp/out" "$tmp/err" "$BIN" cost projected --help
  if [ "$EXIT" -eq 0 ] && grep -q -- '--filter' "$tmp/out"; then
    pass "cost projected: --filter is listed"
  else
    fail "cost projected --help missing --filter (exit=$EXIT)"
  fi

  run_cmd "$tmp/filtered.json" "$tmp/err" \
    "$BIN" cost projected --pulumi-json "$PLAN" --filter 'type=ec2' --output json
  if [ "$EXIT" -eq 0 ] && jq -e '
      (.finfocus.resources | length) == 1
      and (.finfocus.resources[0].resourceType | test("ec2"; "i"))
    ' "$tmp/filtered.json" >/dev/null; then
    pass "cost projected --filter type=ec2: one ec2 resource"
  else
    fail "cost projected --filter type=ec2: exit=$EXIT err=$(tail -n1 "$tmp/err")"
  fi

  # 16. Run the built action against this finfocus release. The action downloads
  # that release, installs aws-public, and writes the PR comment body to
  # FINFOCUS_COMMENT_PATH instead of calling GitHub.
  run_action "$tmp"

  echo
  if [ "$failures" -gt 0 ]; then
    echo "contract: $failures check(s) FAILED"
    exit 1
  fi
  echo "contract: all checks passed"
}

main "$@"
