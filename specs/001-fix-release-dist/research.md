# Research: Fix Release-Please Changelog Duplication

**Feature**: 001-fix-release-dist
**Date**: 2026-02-04

## Research Questions

### 1. How to detect when a release PR exists vs when a release is created?

**Decision**: Use `prs_created` output to detect PR existence, `release_created` for actual releases.

**Rationale**: The release-please-action@v4 provides distinct outputs:
- `prs_created: true` - Set when a release PR is created or updated (but not merged)
- `release_created: true` - Set only when a release is actually published (PR merged)
- `pr` - JSON object containing PR details including branch name

This allows us to:
1. Trigger dist/ build when `prs_created == 'true'` AND `release_created != 'true'`
2. Trigger floating tag updates only when `release_created == 'true'`

**Alternatives considered**:
- Using `releases_created` instead of `release_created`: Rejected because source code shows it's based on array length, less reliable
- Parsing PR event data: Rejected because release-please already provides clean outputs

### 2. How to get the release PR branch name for checkout?

**Decision**: Parse the `pr` output JSON to extract `headBranchName`.

**Rationale**: The `pr` output is a JSON object containing:
```json
{
  "headBranchName": "release-please--branches--main",
  "number": 123,
  "title": "chore(main): release 1.2.0",
  ...
}
```

The branch name follows the pattern `release-please--branches--{base-branch}`.

**Alternatives considered**:
- Hardcoding `release-please--branches--main`: Works but fragile if base branch changes
- Using GitHub API to find the PR: Unnecessary complexity since release-please provides the data

### 3. How to commit dist/ to the PR branch without creating orphaned commits?

**Decision**: Checkout the PR branch, build, commit, and push directly to that branch.

**Rationale**: By pushing to the PR branch (not the tag), the commit becomes part of the PR. When the PR merges, this commit lands in main's history. The release tag is then created by release-please pointing to a commit in main.

**Workflow sequence**:
1. `release-please` job runs, creates/updates PR, outputs `prs_created=true`
2. `update-dist` job triggers on `prs_created=true`
3. Checkout the PR branch (from `pr.headBranchName`)
4. Build dist/, commit changes
5. Push to PR branch
6. PR now includes dist/ changes
7. When PR merges → commit is in main → release-please creates tag on main

**Alternatives considered**:
- Using release-please extra-files: Only handles static files, not built artifacts
- Pre-commit hooks: GitHub Actions can't run hooks on release-please PRs easily
- Separate workflow on PR events: Would require complex filtering to only target release PRs

### 4. How to handle the floating tags (v1, v1.2) after the fix?

**Decision**: Keep the floating tag update job, but trigger it only on `release_created`.

**Rationale**: Floating tags must still be updated after each release. The current logic for updating them is correct. The only change is removing the tag force-push that creates orphaned commits.

**Key changes**:
- Remove: `git tag -f ${{ tag_name }}` (no longer needed, release-please creates the tag)
- Keep: `git tag -f v${{ major }}` and `git tag -f v${{ major }}.${{ minor }}`
- Change trigger: From `release_created` after building dist to just `release_created`

**Alternatives considered**:
- Removing floating tags entirely: Rejected, would break existing users
- Using GitHub releases API: Unnecessary, direct tag manipulation works

### 5. What permissions are needed for the PAT?

**Decision**: PAT needs `contents: write` and `workflows` scopes.

**Rationale**:
- `contents: write`: Required to push to the PR branch
- `workflows`: Required because pushing to a branch with workflow files requires this permission

The default `GITHUB_TOKEN` cannot push commits that contain workflow file changes to PR branches created by release-please. A PAT with elevated permissions is required.

**Implementation**: Use `secrets.RELEASE_PLEASE_TOKEN` (assumed to exist per spec assumptions).

**Alternatives considered**:
- Using `GITHUB_TOKEN` with elevated permissions: Not possible for workflow file pushes
- Creating a GitHub App: Overkill for this use case

## Summary of Workflow Changes

### Current Flow (Broken)

```
push to main → release-please creates PR → PR merges → release created with tag
            → build-and-tag checks out tag → commits dist → force-pushes tag (ORPHANED!)
```

### New Flow (Fixed)

```
push to main → release-please creates PR → update-dist builds & commits to PR branch
            → PR now includes dist → PR merges → release created with tag (IN MAIN!)
            → update-tags updates floating tags (v1, v1.2)
```

## Key Findings

1. **Root cause confirmed**: The `git tag -f` + `git push -f origin` sequence creates orphaned commits
2. **Solution validated**: Committing to PR branch before merge keeps all commits in main's history
3. **PAT required**: Cannot use `GITHUB_TOKEN` for pushing to release-please PR branches
4. **Output names confirmed**: Use `prs_created` for PR detection, `release_created` for release detection
5. **PR branch format**: `release-please--branches--{base}` (extract from `pr.headBranchName`)
