# Genuine finfocus v0.4.1 output

Owner-owned ground truth. Read-only for agents. Nothing here was written by
hand, except the one documented edit to the plan below.

Captured 2026-10-03 from the released `finfocus-v0.4.1-linux-amd64` binary
(checksum verified against the release `checksums.txt`).

| File | Command | Plugin | Exit |
| --- | --- | --- | --- |
| `cost-projected-no-region.json` | `finfocus cost projected --pulumi-json aws-simple-plan.json --output json` (plan in `../finfocus-v0.4.0`) | aws-public v0.1.9 | 0 |
| `aws-simple-plan-with-region.json` | input: the v0.4.0 plan with `region: us-west-2` added to the S3 and RDS steps (one jq edit) | n/a | n/a |
| `cost-projected-with-region.json` | same command on `aws-simple-plan-with-region.json`, fresh cache | aws-public v0.1.10 | 0 |

`cost-projected-no-region.json` is the regionless case: the RDS and S3 steps
have no region, so both appear in `.finfocus.errors` and price at $0 (see
rshade/finfocus#1670). v0.4.1 added the `diff` and `errors` keys under
`.finfocus`.

`cost-projected-with-region.json` prices EC2 and RDS (RDS 15.44, total
23.032). S3 stays in `errors` at $0: it is usage-based, so the plan alone
cannot price it. Twelve fresh-cache runs on aws-public v0.1.10 all returned the
same RDS price; v0.1.9 flipped between 15.44 and 17.74 (fixed upstream in #397).
