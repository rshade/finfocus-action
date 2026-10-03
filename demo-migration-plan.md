# Plan: Migrate finfocus-demo into finfocus-action

## Problem
The `finfocus-demo` repo is a small satellite (~480 lines, 1 contributor) whose sole purpose is demoing the `finfocus-action` GitHub Action. Maintaining it separately adds friction (version syncing, discoverability, two repos to manage). The demo workflows must remain **live and runnable** — this is the primary value.

## Approach
Move the demo's Pulumi project and workflows directly into `finfocus-action` as live CI workflows + example code. Create 4 workflows total covering both operational modes (standard + analyzer) × both action refs (`./` + `@v1`). Trigger on `examples/` changes + `workflow_dispatch`.

## Workflow Matrix

| Workflow File | Mode | Action Ref | Purpose |
|---|---|---|---|
| `demo-cost-estimate.yml` | Standard | `uses: ./` | Integration test — validates action from current branch |
| `demo-cost-estimate-release.yml` | Standard | `uses: rshade/finfocus-action@v1` | Demo — validates published release |
| `demo-analyzer-mode.yml` | Analyzer | `uses: ./` | Integration test — validates analyzer mode from current branch |
| `demo-analyzer-mode-release.yml` | Analyzer | `uses: rshade/finfocus-action@v1` | Demo — validates published analyzer mode |

## Workplan

### Pre-migration (manual steps)
- [ ] 1. Update AWS IAM trust policy: change `sub` condition from `repo:rshade/finfocus-demo:*` to `repo:rshade/finfocus-action:*`
- [ ] 2. Add `AWS_ROLE_ARN` secret to `finfocus-action` repo settings

### File migration
- [ ] 3. Create `examples/pulumi-aws-demo/` directory
- [ ] 4. Copy `Pulumi.yaml` to `examples/pulumi-aws-demo/Pulumi.yaml`
- [ ] 5. Copy `Pulumi.dev.yaml` to `examples/pulumi-aws-demo/Pulumi.dev.yaml`
- [ ] 6. Create `examples/pulumi-aws-demo/README.md` (adapted from demo README — setup instructions, usage, provenance note)
- [ ] 7. Create `examples/pulumi-aws-demo/TROUBLESHOOTING.md` (adapted from demo AGENTS.md)

### Workflow creation
- [ ] 8. Create `.github/workflows/demo-cost-estimate.yml` — standard mode, `uses: ./`, triggers on `examples/` changes + `workflow_dispatch`
- [ ] 9. Create `.github/workflows/demo-cost-estimate-release.yml` — standard mode, `uses: rshade/finfocus-action@v1`, same triggers
- [ ] 10. Create `.github/workflows/demo-analyzer-mode.yml` — analyzer mode, `uses: ./`, same triggers
- [ ] 11. Create `.github/workflows/demo-analyzer-mode-release.yml` — analyzer mode, `uses: @v1`, same triggers
- [ ] 12. All workflows must set `work-dir` / `working-directory` to `examples/pulumi-aws-demo` for Pulumi commands

### Configuration updates
- [ ] 13. Update `renovate.json` to ignore `examples/**` (prevent bot noise for Pulumi deps)
- [ ] 14. Update root `README.md` — add "Examples" section linking to `examples/pulumi-aws-demo/`

### Validation
- [ ] 15. Run `npm run lint` and `npm test` to ensure no regressions
- [ ] 16. Verify no Pulumi auto-detection issues from repo root

### Post-migration (manual steps)
- [ ] 17. Update `finfocus-demo` README to point to new location
- [ ] 18. Archive `finfocus-demo` repository on GitHub

## Key Design Decisions

1. **Workflows go in `.github/workflows/`** (not `examples/workflows/`) — they must actually execute in CI
2. **`uses: ./` workflows** need `npm run build` or pre-built `dist/` — since `dist/` is committed on main/release branches, this works. For PR branches, the `check-dist.yml` workflow already ensures dist is up to date.
3. **Pulumi.dev.yaml encryption salt** is not a secret — kept as-is with a README note telling users to regenerate their own stack config
4. **No git history preservation** — only 10 commits, not worth subtree complexity. Provenance note added to example README.
5. **Trigger strategy**: `paths: ['examples/**']` + `workflow_dispatch` — demo runs when examples change or on-demand, doesn't pollute every PR

## Notes

- The `uses: ./` workflows double as integration tests — if the action breaks, the demo PR will catch it
- The `uses: @v1` workflows verify the published release still works with the demo infra
- All 4 workflows share the same Pulumi setup steps (OIDC, Pulumi CLI, stack init) — consider using a reusable workflow or composite action if DRY becomes important later
- Debug env vars (`ACTIONS_STEP_DEBUG`, `ACTIONS_RUNNER_DEBUG`) should be removed from migrated workflows unless intentionally kept for demo purposes
