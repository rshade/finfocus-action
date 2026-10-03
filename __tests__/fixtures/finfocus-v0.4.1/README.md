# Genuine finfocus v0.4.1 output

Owner-owned ground truth. Read-only for agents.

Captured 2026-10-03 from the released `finfocus-v0.4.1-linux-amd64` binary
(checksum verified against the release `checksums.txt`) with `aws-public`
v0.1.9 installed. Nothing here was written by hand.

| File | Command | Exit |
| --- | --- | --- |
| `cost-projected-no-region.json` | `finfocus cost projected --pulumi-json <aws-simple-plan.json from ../finfocus-v0.4.0> --output json` | 0 |

This is the regionless case: the RDS and S3 steps have no region, so both
appear in `.finfocus.errors` and price at $0 (see rshade/finfocus#1670).
v0.4.1 added the `diff` and `errors` keys under `.finfocus`.
