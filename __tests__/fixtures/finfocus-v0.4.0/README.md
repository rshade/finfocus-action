# Genuine finfocus v0.4.0 output

Owner-owned ground truth for the finfocus-action run. Read-only for the agent.

Captured 2026-10-03 from the released `finfocus-v0.4.0-linux-amd64` binary
(checksum verified against the release `checksums.txt`) with the `aws-public`
plugin v0.1.9 installed from the registry. Nothing here was written by hand.

| File | Command | Exit |
| --- | --- | --- |
| `aws-simple-plan.json` | input: core's `examples/plans/aws-simple-plan.json` | n/a |
| `cost-projected-aws-public.json` | `finfocus cost projected --pulumi-json aws-simple-plan.json --output json` | 0 |
| `exit2-validation-error.json` | same command with a plan path that does not exist (stderr) | 2 |
| `exit1-no-pulumi-project.json` | `finfocus cost projected <plan> --output json` run outside a Pulumi project, the call shape `guardrails.ts` uses (stderr) | 1 |
| `budget-status-unknown-command.json` | `finfocus budget status --output json` (stderr) | not captured, see the file's `error_code` |
| `plugin-list.txt` | `finfocus plugin list` | 0 |

Trace ids are per run and must not be asserted on.

Not captured: a budget-threshold breach. `--exit-on-threshold` returned 0 for a
projected $7.59 against a $5 budget in every config variant tried, so the
nonzero threshold exit is unverified. A test for it needs a fixture from the
owner.
