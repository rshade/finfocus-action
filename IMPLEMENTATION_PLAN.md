# Implementation Plan: Analyzer Plugin Fix

**Created**: 2025-01-10
**Status**: In Progress

## Problem Statement

The analyzer plugin is being installed correctly to `~/.pulumi/plugins/analyzer-finfocus-<version>/pulumi-analyzer-finfocus`, but Pulumi is not finding/invoking it during `pulumi preview`.

## Root Cause (Updated v2)

Even after fixing the YAML structure, two issues remained:
1.  **Binary Naming**: `finfocus` only enters analyzer mode if its process name contains `pulumi-analyzer-finfocus`. By calling it `finfocus-real` in the wrapper, it was running as a CLI and exiting.
2.  **Path to Directory**: In `Pulumi.yaml`, `plugins.analyzers.path` **MUST point to the directory** containing the analyzer executable, NOT the executable itself.
3.  **Version Command**: `finfocus version` is not valid; `finfocus --version` is required.

## Evidence

From the workflow logs (run 20896000573):
1. `Error: unknown command "version" for "finfocus"` -> caused fallback to v0.1.0 path.
2. `error: parsing plugin options for 'finfocus': provider folder ... is not a directory` -> caused by pointing path to the binary.

## Fix Required

### File: `src/analyze.ts`

Change the `setupAnalyzerMode()` function to:

1.  Rename the internal binary to `pulumi-analyzer-finfocus-real`.
2.  Update `Pulumi.yaml` to point `path` to the **plugin directory**.
3.  Use `finfocus --version`.
4.  Remove any legacy top-level `analyzers` config.

### Implementation Steps

1. [x] Modify YAML update logic in `setupAnalyzerMode()` - DONE
2. [x] Use the `pluginDir` path in the YAML (reverted from binary path) - DONE
3. [x] Ensure binary name triggers analyzer mode - DONE
4. [x] Fix version command - DONE
5. [x] Rebuild the action (`npm run build`) - DONE
6. [ ] Merge changes to v1 branch and push
7. [ ] Re-run the workflow to verify

## Testing Checklist

- [ ] Pulumi.yaml shows `plugins.analyzers` section with path
- [ ] Path in YAML matches actual plugin directory
- [ ] `pulumi preview` output shows cost diagnostics
- [ ] Cost summary appears in PR comment

## References

- finfocus: `specs/012-analyzer-e2e-tests/research.md`
- Pulumi Project File: https://www.pulumi.com/docs/iac/concepts/projects/project-file/

