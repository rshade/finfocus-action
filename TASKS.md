# finfocus-action tasks

Plan of record for run 1. Source issues: #86 (budget status), #87 (exit codes),
issue #88 (CI against a real release), #89 (new features, umbrella). Statuses:
`TODO`, `DONE`, `BLOCKED`, `BLOCKED-ON-INPUT`, `NOT-DELIVERED`, `SKIPPED`.
Ground truth: `__tests__/fixtures/finfocus-v0.4.0/` (real finfocus output,
owner-owned, read-only).

## Phase 1: tests against a real binary (issue #88)

### AC-1.1 Real-binary contract test

**Status:** DONE — verify: `FINFOCUS_BIN=/tmp/finfocus-v0.4.0/finfocus scripts/contract.sh`
exits 0 (11 checks pass) against finfocus v0.4.0. Break check: renamed
`totalMonthly` in a fixture copy; suite failed with exit 1 naming the changed key.

A script `scripts/contract.sh` (or a Jest suite gated on `FINFOCUS_BIN`) that
runs the commands the action runs against a real finfocus binary and compares
the shape of the result with the fixtures: `--version`, `cost projected
--pulumi-json <plan> --output json`, `cost recommendations`, `plugin list`,
`plugin install aws-public`. Asserts exit codes and JSON keys, not totals.
Verify: runs green against finfocus v0.4.0. Break check: change one expected
key in a fixture copy and watch the suite fail.

### AC-1.2 CI job

**Status:** DONE — verify: `actionlint .github/workflows/*.yml` exits 0; the
`contract` job in `.github/workflows/test.yml` (matrix `v0.4.0` + `latest`, PR
and daily schedule) installs finfocus from the GitHub release and runs AC-1.1.
Break check: `cost projected --definitely-not-a-flag` exits 1 with an
`internal_error` envelope, so a wrong call fails the job step. Both release
download paths (pinned and `latest`) were exercised locally; the job itself was
not run on GitHub (no push in this run).

Add a job to `.github/workflows/test.yml` (or a new workflow) that installs
finfocus from the GitHub release and runs AC-1.1 on a matrix of `v0.4.0` and
`latest`, on pull requests and on a daily schedule. Replace the dummy
integration job. Verify: `actionlint .github/workflows/*.yml` is clean and the
job runs on the branch. Break check: point the job at a nonexistent flag and
watch it fail. Action and tool names must be checked to exist.

## Phase 2: exit codes (issue #87)

### AC-2.1 Parse the error envelope

**Status:** DONE — verify: `npm test` passes and
`FINFOCUS_BIN=... scripts/contract.sh` exit 0. Non-zero exits with a finfocus
error envelope now throw with the envelope message (`validation_error` =
configuration error, `internal_error` = tool failure) in both
`guardrails.ts` and `analyze.ts`. Break check: exempted exit 2 from envelope
parsing (back to critical mapping); the AC-2.1 test failed as designed; reverted.

On a non-zero exit, parse the JSON on stderr (`error_code`, `message`) and fail
with that message. `validation_error` (exit 2) is a configuration error and
never a budget result; exit 1 with `internal_error` is a tool failure. Tests use
`exit2-validation-error.json` and `exit1-no-pulumi-project.json`. Verify: unit
tests plus the AC-1.1 suite. Break check: map exit 2 back to critical and see
the test fail.

### AC-2.2 Call shape and explicit threshold code

**Status:** DONE — verify: `npm test` passes and
`FINFOCUS_BIN=... scripts/contract.sh` exit 0 (contract check 7 encodes the
guardrail call shape). `guardrails.ts` now runs `cost projected --pulumi-json
<plan> --exit-on-threshold --exit-code 10` (10 is action-owned; v0.4.0 reserves
0/1/2 — confirmed in `cost projected --help` and live runs). Unknown codes fail
with stderr, not `Unexpected finfocus exit code`. Break check: dropped
`--pulumi-json` from the contract's guardrail call shape; suite failed with
exit 1 and the `internal_error` envelope; reverted.

`guardrails.ts` passes the plan with `--pulumi-json` and, for threshold checks,
`--exit-on-threshold --exit-code <N>` with an `N` the action owns (suggest 10,
confirm it does not collide with 0, 1, 2). Unknown codes report stderr and fail
with it instead of throwing `Unexpected finfocus exit code`. Verify: unit tests
and the contract suite. Break check: drop `--pulumi-json` and see the contract
test fail.

### AC-2.3 Threshold breach behaviour

**Status:** DONE — REPRODUCED (owner's flat-schema configs could not work).
With the real v0.4.0 schema `cost.budgets.global` (both `config.yaml` and
`config.hujson`, alerts of `actual` and `forecasted`), `cost projected
--pulumi-json <plan> --exit-on-threshold --exit-code 10` exits **10** and the
table output prints a `BUDGET STATUS` block ($7.59 vs $5.00, 151.8%). The
flat `cost.budgets.amount` schema from core's budgets guide is silently
ignored (exit 0, no block). Exact working config is encoded as check 8 in
`scripts/contract.sh` (passes against the pinned binary). Register: fixture
request for an owner-captured breach fixture; core issue draft at
`.superpowers/issue-drafts/core-budget-flat-schema-ignored.md`.

The owner could not make `--exit-on-threshold` return non-zero for a projected
$7.59 against a $5 budget. Try to reproduce it with the pinned binary (config in
a temp `FINFOCUS_HOME`, both `config.yaml` and `config.hujson`, alerts of
`actual` and `forecasted`). If it reproduces, record the exact config and add a
fixture request to the register. If it does not, mark `BLOCKED-ON-INPUT` and
list the commands tried. Do not invent an exit code.

### AC-2.4 Supported versions

**Status:** DONE — verify: `npx markdownlint-cli2 README.md CLAUDE.md TASKS.md`
reports 0 issues. README gained a Compatibility section (tested: v0.4.0 pinned
and latest via the CI contract matrix); `action.yml` `finfocus-version` now
says `latest` follows breaking changes. Required a `.markdownlint-cli2.jsonc`
config and reflow of 28 pre-existing over-long lines (decision logged in the
report).

State the tested finfocus range in the README and `action.yml` input docs, and
make the `finfocus-version` description say that `latest` follows breaking
changes. Verify: `markdownlint README.md`.

## Phase 3: budget status (issue #86)

### AC-3.1 Decide the budget source

**Status:** BLOCKED-ON-INPUT — findings in `.superpowers/budget-source.md`
(with pasted command output). Budget data in v0.4.0 comes from `cost.budgets`
config (scoped schema `cost.budgets.global`, ...) and the `cost projected`
table output `BUDGET STATUS` block, plus the `--exit-on-threshold` exit code.
The JSON output has **no budget fields** (verified with and without budgets
configured; `.finfocus` keys are only `resources`, `summary`). Delivery per
task text: core issue draft `.superpowers/issue-drafts/core-budget-json.md`.

`finfocus budget status` does not exist (fixture
`budget-status-unknown-command.json`). Find out where budget data really comes
from in v0.4.0: read `cost projected --help`, run it with `cost.budgets` config
and table and JSON output, and read the `BUDGET STATUS` text. Write findings to
`.superpowers/budget-source.md` with command output. If the JSON has no budget
fields, the delivery is a core issue draft in `.superpowers/issue-drafts/`
(`core-budget-json.md`) and this task is `BLOCKED-ON-INPUT`.

### AC-3.2 Remove or replace the dead calls

**Status:** DONE (removed, not replaced — AC-3.1 is BLOCKED-ON-INPUT pending a
core JSON budget field). Deleted `runBudgetStatus`/`runScopedBudgetStatus` and
the budget-health + scoped-budget features (inputs `budget-alert-threshold`,
`fail-on-budget-health`, `show-budget-forecast`, `budget-scopes`,
`fail-on-budget-scope-breach`; outputs `budget-health-score`,
`budget-forecast`, `budget-runway-days`, `budget-status`,
`budget-scopes-status`; formatter/comment/guardrails pieces; 5 test files).
`config.ts` now writes the schema finfocus actually reads
(`cost.budgets.global`) instead of the ignored top-level `budget:` key.
Verify: `npm test` passes, `npm run lint` and markdownlint check pass, contract
suite 18 checks including the new check 9 (every subcommand the action runs
must exist in `finfocus --help`). Break check: added `budget status` to the
check-9 list; suite failed naming it (`unknown command "budget"`); reverted.
Kept: `calculateBudgetStatus` (local math) and the AC-2.x exit-code guardrail.

Remove the two `budget status` calls and the features that cannot work, or
replace them with the real source. Update `CLAUDE.md`, `README.md` and
`action.yml` for anything removed (inputs that now do nothing must be marked, not
left silent). Verify: the contract suite, with a check that no finfocus
subcommand the action runs is missing from `finfocus --help`. Break check:
reintroduce `budget status` and watch that check fail.

## Phase 4: new features (issue #89, only what can be verified)

### AC-4.1 `cost estimate`

**Status:** DONE — verify: `npm test` passes with runEstimate happy path against a verbatim
v0.4.0 capture, spec-validation warnings, and error-envelope throws; `npm run lint` and
markdownlint check pass; `FINFOCUS_BIN=/tmp/finfocus-v0.4.0/finfocus scripts/contract.sh` exit
0 (20 checks, incl. the new check 10 asserting the exact `cost estimate` call shape and report
keys, plus `cost estimate` in the check-9 subcommand list). Break check: changed check 10 to use
`--resourceType`; suite failed with exit 1 and the `internal_error` envelope
(`unknown flag: --resourceType`); reverted. New input `estimate-spec` exposes only the
single-resource mode; plan-based `--modify` is not exposed (v0.4.0 cannot match Pulumi URNs —
IDs contain colons the modify parser splits on).

Read `finfocus cost estimate --help` and the core docs, add an input and a PR
comment section, with the minimum finfocus version in the README. Verify with the
contract suite on a real binary. Break check: a wrong flag fails.

### AC-4.2 `--terraform-state` and `--state-only`

**Status:** DONE (partial by design) — `--terraform-state`: delivered. New
`terraform-state` input; `runAnalysis` runs `cost projected --terraform-state
<path> --output json` (mutually exclusive with `--pulumi-json`, warns when
both exist). Verified against the real binary: core's
`test/fixtures/terraform/aws-realistic/terraform.tfstate` → exit 0, $310.48;
the minimal hand-written tfstate embedded as INPUT in `scripts/contract.sh`
check 11 → exit 0, t3.micro = $7.592. Break check: `--tf-state` typo → exit 1
`unknown flag`, suite fails; reverted. `--state-only`: **NOT-DELIVERED** — not
listed by `finfocus cost projected --help` in v0.4.0 (it exists only on
`finfocus overview`; verified by grepping every command's help and core's
`internal/cli`).

Only add what `finfocus cost projected --help` lists. Verify against the real
binary. If a flag is not in the help output, record it as `NOT-DELIVERED`.

### AC-4.3 `cost cluster` and Jev scoring

**Status:** BLOCKED-ON-INPUT

Need a Kubernetes fixture or kind cluster and a Jev API key policy. Out of scope
for this run. Record in the register.

### AC-4.4 Display unpriced resources in PR comment

**Status:** DONE — verify: `npm test` passes; `npm run lint` and `npm run build` pass; `FINFOCUS_BIN=...
scripts/contract.sh` shows new keys `["diff","errors"]` at `.finfocus` (additive;
fixture auto-detected). New output `unpriced-resource-count` set in main.ts and
defined in action.yml. Break check: changed formatUnpricedResourcesSection to never
render; formatter test using fixture failed; restored exactly, test passed.

Extend `FinfocusReport` type with optional `errors` array and v0.4.1 `diff` format.
Add `formatUnpricedResourcesSection()` to render a collapsible table of unpriced
resources (type, resource ID short form, plugin, message) with note that they're
excluded from the total. Support both v0.4.0 (legacy `monthly_cost_change`) and
v0.4.1 diff formats with type guards in `extractMonthlyCostChange()` and
`extractPercentChange()`. Set action output `unpriced-resource-count` (number of
error entries, 0 if none). Unit tests: fixture with real v0.4.1 errors; empty
errors; null errors; undefined errors; truncation at 20 entries; singular/plural
labels; byte-identical output when no errors. README updated with output and
section description.

## Spec-gap log

- AC-2.3 premise: the breach did not reproduce for the owner because core's
  budgets guide documents a flat `cost.budgets.amount` schema that v0.4.0
  silently ignores; the working schema is `cost.budgets.global` (reproduced:
  exit 10). Core draft: `.superpowers/issue-drafts/core-budget-flat-schema-ignored.md`.
- Prompt section 7's `markdownlint-cli2 README.md CLAUDE.md TASKS.md` fails on
  the pristine tree (~120 pre-existing errors under default rules); resolved
  with `.markdownlint-cli2.jsonc` + reflow (decision 1 in the run report).
- AC-4.1: plan-based `cost estimate --modify` is unusable in v0.4.0 (modify
  parser splits on the first colon; plan resource IDs are URNs). Only the
  single-resource mode was exposed.
- AC-4.2: `--state-only` does not exist on any `cost` subcommand in v0.4.0
  (only on `finfocus overview`); recorded NOT-DELIVERED.
