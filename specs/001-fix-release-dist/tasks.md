# Tasks: Fix Release-Please Changelog Duplication and Dist Build Timing

**Input**: Design documents from `/specs/001-fix-release-dist/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: No automated tests requested. This is a CI/CD workflow change validated manually.

**Organization**: Tasks grouped by user story. US1/US2/US3 are tightly coupled (same mechanism) and grouped together. US4 is independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Preparation and PAT secret documentation

- [x] T001 Document RELEASE_PLEASE_TOKEN PAT requirement in a workflow comment at top of .github/workflows/release-please.yml noting required permissions: `contents: write` and `workflows` scopes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modify the release-please job to export all required outputs for downstream jobs

**WARNING**: No user story work can begin until this phase is complete

- [x] T002 Extend the `release-please` job outputs in .github/workflows/release-please.yml to add: `prs_created` (from `steps.release.outputs.prs_created`), `pr` (from `steps.release.outputs.pr`), and retain existing `release_created`, `tag_name`, `major`, `minor` outputs
- [x] T003 Change the `token` field in the release-please step from `${{ secrets.GITHUB_TOKEN }}` to `${{ secrets.RELEASE_PLEASE_TOKEN }}` in .github/workflows/release-please.yml to enable PAT-based authentication for PR branch pushes

**Checkpoint**: release-please job now outputs both PR and release state information

---

## Phase 3: US1/US2/US3 - Accurate Changelog, Tags in Main History, dist/ in PR (Priority: P1)

**Goal**: Eliminate orphaned release tags by building dist/ into the release PR branch before merge, ensuring release-please can walk history correctly and changelogs contain only new commits

**Independent Test**: After implementation, trigger a release PR and verify:

1. The update-dist job runs and commits dist/ to the PR branch
2. No post-merge tag force-pushing occurs
3. After merge, `git merge-base --is-ancestor <tag> main` succeeds

### Implementation for US1/US2/US3

- [x] T004 [US1/US2/US3] Remove the entire `build-and-tag` job (lines 28-64) from .github/workflows/release-please.yml. This eliminates: checkout of tag ref, dist build on detached HEAD, `git tag -f` force-push of release tag, and floating tag updates (floating tags will be handled separately in US4)
- [x] T005 [US3] Add new `update-dist` job in .github/workflows/release-please.yml with: `needs: release-please`, condition `if: ${{ needs.release-please.outputs.prs_created == 'true' && needs.release-please.outputs.release_created != 'true' }}`, and steps to: (a) parse PR branch name from `needs.release-please.outputs.pr` JSON using `fromJson()`, (b) checkout the PR branch with `ref` set to extracted `headBranchName`, (c) setup Node.js using `.nvmrc`, (d) run `npm ci`, (e) run `npm run build`, (f) configure git user as `github-actions[bot]`, (g) run `git add -f dist/`, (h) run `git diff --staged --quiet || git commit -m "chore: build dist for release"` to skip empty commits, (i) push to the PR branch using the PAT token
- [x] T006 [US3] Verify the `update-dist` job uses `token: ${{ secrets.RELEASE_PLEASE_TOKEN }}` in the checkout step's `with` block and that `git push` uses the default credential helper (which inherits the checkout token) in .github/workflows/release-please.yml

**Checkpoint**: Release PRs now include dist/ before merge. Tags created by release-please point to commits in main's history. Changelogs only include new commits.

---

## Phase 4: US4 - Floating Version Tags (Priority: P2)

**Goal**: Preserve floating tag behavior (v1, v1.2) for action consumers without creating orphaned commits

**Independent Test**: After a release is created, verify `v1` and `v1.2` tags point to the same commit as the full release tag

### Implementation for US4

- [x] T007 [US4] Add new `update-tags` job in .github/workflows/release-please.yml with: `needs: release-please`, condition `if: ${{ needs.release-please.outputs.release_created == 'true' }}`, and steps to: (a) checkout main at the release tag using `ref: ${{ needs.release-please.outputs.tag_name }}`, (b) force-update major tag: `git tag -f v${{ needs.release-please.outputs.major }}` and push, (c) force-update major.minor tag: `git tag -f v${{ needs.release-please.outputs.major }}.${{ needs.release-please.outputs.minor }}` and push. Note: do NOT re-tag the release tag itself (release-please already created it correctly)

**Checkpoint**: Floating tags v1, v1.x continue to work for action consumers

---

## Phase 5: Polish and Cross-Cutting Concerns

**Purpose**: Validation and documentation

- [x] T008 Validate complete workflow YAML syntax by running `npx yaml-lint .github/workflows/release-please.yml` or equivalent YAML validation
- [x] T009 Review the final .github/workflows/release-please.yml for: no remaining references to `build-and-tag`, no `git tag -f` on the release tag itself, correct job dependency chain (`update-dist` and `update-tags` both need `release-please`), and mutually exclusive trigger conditions between `update-dist` and `update-tags`
- [x] T010 [P] Add inline comments in .github/workflows/release-please.yml explaining: why PAT is required (workflow file push permissions), why `prs_created` is used instead of other conditions, and why `git diff --staged --quiet` guard exists (skip empty commits)
- [x] T011 [P] Run `npm run lint`, `npm test`, and `npm run build` locally to ensure no application regressions from the workflow change
- [x] T012 [P] Doc generation: add or update the "Release Workflow" section in README.md documenting the new release flow (release-please creates PR, update-dist builds dist/ into PR, merge triggers release, update-tags sets floating tags). Include a warning that release PRs must not be manually merged before the update-dist job completes (Constitution Principle V)
- [x] T013 Documentation review loop: verify that README.md release workflow section, inline workflow comments from T010, and quickstart.md all describe the same flow consistently and match the actual .github/workflows/release-please.yml implementation (Constitution Principle V)

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) - BLOCKS all user stories
- **US1/US2/US3 (Phase 3)**: Depends on Foundational (T002, T003) completion
- **US4 (Phase 4)**: Depends on Foundational (T002, T003) completion; can run in parallel with Phase 3
- **Polish (Phase 5)**: Depends on Phase 3 and Phase 4 completion

### User Story Dependencies

- **US1/US2/US3 (P1)**: Can start after Foundational (Phase 2). Tightly coupled; removing `build-and-tag` (T004) and adding `update-dist` (T005) are the same logical change
- **US4 (P2)**: Can start after Foundational (Phase 2). Independent of US1/US2/US3 but logically follows since the old `build-and-tag` job (which handled floating tags) is removed in T004

### Within Each Phase

- Phase 3: T004 before T005 (must remove old job before adding replacement); T006 after T005
- Phase 4: T007 is independent (can start as soon as Phase 2 is done)
- Phase 5: T008, T009, T010, T011, T012 can all run in parallel; T013 runs after T010 and T012

### Parallel Opportunities

- T010, T011, and T012 can run in parallel (different files/concerns)
- T013 must wait for T010 and T012 (reviews their output)
- Phase 3 and Phase 4 can theoretically run in parallel (different jobs in the same file, but since it's one file, sequential is safer)

---

## Parallel Example: Phase 5 (Polish)

```bash
# These can all run in parallel:
Task: "Validate YAML syntax of .github/workflows/release-please.yml"
Task: "Add inline comments in .github/workflows/release-please.yml"
Task: "Run npm lint, test, build locally"
Task: "Doc generation: update README.md release workflow section"

# Then run sequentially after T010 + T012 complete:
Task: "Documentation review loop: verify consistency across README, comments, quickstart"
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3)

1. Complete Phase 1: Document PAT requirement
2. Complete Phase 2: Extend outputs, switch to PAT
3. Complete Phase 3: Remove build-and-tag, add update-dist
4. **STOP and VALIDATE**: Push branch, observe next release PR includes dist/
5. Verify changelogs are accurate after merge

### Incremental Delivery

1. Phases 1-3: Core fix deployed (changelog duplication resolved)
2. Phase 4: Floating tags restored (consumers unaffected)
3. Phase 5: Documentation and validation complete

### Single Developer Strategy

Since all changes are in one file (`.github/workflows/release-please.yml`):

1. Work sequentially through phases
2. Commit after each phase checkpoint
3. Validate workflow syntax after each phase

---

## Notes

- Most tasks modify `.github/workflows/release-please.yml`; T012/T013 touch README.md
- No application source code changes required
- No automated tests possible for workflow YAML; validation is manual
- The PAT secret (`RELEASE_PLEASE_TOKEN`) must be configured in GitHub repo settings before the workflow runs
- Historical orphaned tags are NOT remediated (per clarification decision)
- Commit after each logical group of tasks
