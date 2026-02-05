# Feature Specification: Fix Release-Please Changelog Duplication and Dist Build Timing

**Feature Branch**: `001-fix-release-dist`
**Created**: 2026-02-04
**Status**: Draft
**Input**: GitHub Issue #58 - fix(ci): release-please changelog duplication and dist build timing

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintainer Creates Release with Accurate Changelog (Priority: P1)

As a maintainer of finfocus-action, I want release changelogs to accurately reflect only the commits since the previous release, so that users can understand what changed in each version without seeing duplicate entries.

**Why this priority**: Accurate changelogs are the primary deliverable of a release and directly impact user trust. Duplicate entries cause confusion about actual changes and undermine the release process integrity.

**Independent Test**: Can be fully tested by creating a release PR after the fix and verifying the changelog contains only new commits since the last release tag. Delivers accurate release documentation.

**Acceptance Scenarios**:

1. **Given** commits A, B, C were released in v1.1.0, **When** commits D, E are added and a new release v1.2.0 is created, **Then** the v1.2.0 changelog contains only D and E
2. **Given** a release tag exists pointing to a commit in main's history, **When** release-please calculates the next changelog, **Then** it correctly identifies the tag commit and includes only subsequent commits
3. **Given** the previous release was created with the new workflow, **When** the next release is prepared, **Then** release-please can properly walk the git history from the previous tag

---

### User Story 2 - Release Tags Point to Main Branch History (Priority: P1)

As a maintainer, I want release tags to point to commits that exist in the main branch's history, so that git tooling and release-please can properly track release lineage.

**Why this priority**: This is the root cause of the changelog duplication. Tags pointing to orphaned commits break git history traversal for all downstream tooling.

**Independent Test**: Can be fully tested by verifying `git merge-base --is-ancestor <tag> main` returns success after a release is created. Delivers consistent git history.

**Acceptance Scenarios**:

1. **Given** a new release is created, **When** checking the release tag, **Then** the tag points to a commit that is an ancestor of main's HEAD
2. **Given** release tag finfocus-action-v1.2.0 exists, **When** running `git log main --ancestry-path ^finfocus-action-v1.2.0`, **Then** the command succeeds without errors about divergent history
3. **Given** the dist/ directory needs to be included in the release, **When** the release workflow completes, **Then** the dist/ contents are part of a commit in main's history, not a detached commit

---

### User Story 3 - Release PR Includes Built dist/ Directory (Priority: P2)

As a maintainer, I want the release PR to include the built dist/ directory before merging, so that the release workflow does not require post-merge modifications.

**Why this priority**: This is the mechanism to achieve P1 goals. Including dist/ in the PR eliminates the need for post-release tag manipulation.

**Independent Test**: Can be fully tested by observing that the release PR contains dist/ changes before merge. Delivers complete release artifacts in a single merge.

**Acceptance Scenarios**:

1. **Given** release-please creates a release PR, **When** the update-dist job runs, **Then** the dist/ directory is built and committed to the PR branch
2. **Given** source files have changed since the last release, **When** npm run build executes, **Then** the resulting dist/ changes are committed to the release PR
3. **Given** no source files have changed (dist/ is already current), **When** npm run build executes, **Then** no empty commit is created

---

### User Story 4 - Floating Version Tags Continue Working (Priority: P2)

As a consumer of finfocus-action, I want to reference the action using floating tags like `v1` or `v1.2`, so that I automatically receive compatible updates.

**Why this priority**: This is a standard GitHub Action versioning pattern that users depend on. Breaking this would require all users to update their workflows.

**Independent Test**: Can be fully tested by using `rshade/finfocus-action@v1` in a workflow and verifying it resolves to the latest v1.x.x release. Delivers backward-compatible versioning.

**Acceptance Scenarios**:

1. **Given** release v1.2.0 is created, **When** the workflow completes, **Then** tag `v1` points to the same commit as v1.2.0
2. **Given** release v1.2.0 is created, **When** the workflow completes, **Then** tag `v1.2` points to the same commit as v1.2.0
3. **Given** a user references `finfocus-action@v1` in their workflow, **When** the workflow runs, **Then** it uses the latest v1.x.x release

---

### Edge Cases

- What happens when the release PR is updated with new commits before merge? The update-dist job should rebuild dist/ for each PR update.
- How does system handle a release where dist/ has no changes? No empty commit should be created; the build step should be idempotent.
- What happens if npm run build fails? The update-dist job should fail, preventing the release PR from being merged with stale dist/.
- How does the workflow handle the first release after migration? Existing orphaned tags remain unchanged; only new releases follow the corrected workflow.
- What if someone manually merges the release PR before update-dist completes? The dist/ directory would be stale; documentation should warn against this.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Workflow MUST build dist/ directory and commit it to the release PR branch before merge
- **FR-002**: Workflow MUST use a PAT (Personal Access Token) with workflow permissions to trigger PR updates
- **FR-003**: Workflow MUST NOT create commits on detached or orphaned branches
- **FR-004**: Workflow MUST NOT force-push release tags after the release is created
- **FR-005**: Workflow MUST update floating version tags (v1, v1.x) after the release PR is merged
- **FR-006**: Workflow MUST skip empty commits when dist/ has no changes
- **FR-007**: Release tags MUST point to commits that exist in the main branch's history
- **FR-008**: Workflow MUST use the release-please PR branch (release-please--branches--main) for dist/ updates
- **FR-009**: Workflow MUST run update-dist job only when a release PR exists (not on release creation)

### Key Entities

- **Release PR**: The pull request created by release-please to propose version bumps and changelog updates
- **Release Tag**: Git tag in format `finfocus-action-vX.Y.Z` pointing to the release commit
- **Floating Tags**: Git tags `vX` and `vX.Y` that track the latest release in their version range
- **dist/ Directory**: Compiled action output that must be included in releases but is git-ignored during development

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Release changelogs contain exactly the commits since the previous release, with zero duplicate entries
- **SC-002**: All release tags pass `git merge-base --is-ancestor <tag> main` verification
- **SC-003**: Release PRs include dist/ directory changes before merge, eliminating post-merge tag manipulation
- **SC-004**: Existing consumers using `@v1` or `@v1.x` references experience zero disruption to their workflows
- **SC-005**: The `gh api repos/rshade/finfocus-action/compare/<tag>...main` command returns `behind_by: 0` for new releases

## Clarifications

### Session 2026-02-04

- Q: Should the workflow include a one-time remediation step to fix historical orphaned tags, or should they remain as historical artifacts? → A: Historical tags remain unchanged (fix only applies to future releases)

## Assumptions

- Historical release tags (created before this fix) will NOT be remediated; they remain as orphaned commits and this is acceptable for backward compatibility
- A PAT with `workflow` and `contents: write` permissions is available as `RELEASE_PLEASE_TOKEN` secret
- The release-please action outputs `pr` and `pr_branch` when a release PR exists
- The project uses npm/Node.js and has a working `npm run build` command
- The current tag naming convention (`finfocus-action-vX.Y.Z`) will be maintained
- Release-please v4 is used and its behavior is consistent with documented outputs
