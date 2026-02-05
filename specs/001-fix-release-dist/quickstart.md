# Quickstart: Release Workflow Fix

**Feature**: 001-fix-release-dist

## Overview

This fix restructures the release-please workflow to prevent changelog duplication by ensuring release tags point to commits in main's history.

## Prerequisites

1. **PAT Secret**: A Personal Access Token named `RELEASE_PLEASE_TOKEN` must be configured with:
   - `contents: write` permission
   - `workflows` permission (for pushing workflow file changes)

## Workflow Structure (After Fix)

```yaml
jobs:
  release-please:        # Creates/updates release PRs
    outputs:
      prs_created        # true when PR created/updated
      release_created    # true when release published
      pr                 # JSON with PR details (branch name, number)
      tag_name           # Release tag (e.g., finfocus-action-v1.2.0)
      major, minor       # Version components for floating tags

  update-dist:           # NEW: Builds dist/ into PR branch
    needs: release-please
    if: prs_created == 'true' && release_created != 'true'
    # Checkout PR branch, build, commit, push

  update-tags:           # Updates floating tags (v1, v1.2)
    needs: release-please
    if: release_created == 'true'
    # Only updates floating tags, no dist/ manipulation
```

## Release Flow

1. Developer pushes to `main`
2. `release-please` job creates/updates release PR
3. `update-dist` job detects PR, checks out PR branch, builds dist/, commits
4. Release PR now includes dist/ directory
5. Maintainer reviews and merges PR
6. `release-please` job creates release and tag (tag points to main)
7. `update-tags` job updates `v1` and `v1.2` floating tags

## Verification

After implementation, verify with:

```bash
# Check that release tag is in main's history
git merge-base --is-ancestor <tag> main && echo "PASS" || echo "FAIL"

# Check no divergent history
gh api repos/rshade/finfocus-action/compare/<tag>...main | jq '.behind_by'
# Should return: 0
```

## Rollback

If issues occur, revert `.github/workflows/release-please.yml` to previous version. Historical tags remain unaffected (they stay orphaned, which is acceptable).
