# Analyzer Plugin Setup Notes

**Created**: 2025-01-10
**Updated**: 2025-01-11 (Session 2 - Fix Applied)
**Purpose**: Track the correct setup process for the PulumiCost Analyzer plugin

## Session 2 Summary (2025-01-11)

### Problem Identified

Workflow run 20879348290 showed:

- Plugin installed correctly to `~/.pulumi/plugins/analyzer-pulumicost-v0.1.3/`
- `Pulumi.yaml` was updated with `analyzers: [pulumicost]`
- `pulumi preview` ran but **NO cost diagnostics appeared**

### Root Cause

The code was adding the **wrong YAML syntax**:

```yaml
# WRONG - relies on auto-discovery which doesn't work for local plugins
analyzers:
  - pulumicost
```

### Fix Applied

Changed `src/analyze.ts` to use `plugins.analyzers` with explicit path:

```yaml
# CORRECT - explicit path for CI/local plugins
plugins:
  analyzers:
    - name: pulumicost
      path: /home/runner/.pulumi/plugins/analyzer-pulumicost-v0.1.3
```

### Code Changes Made

**File: `src/analyze.ts` (lines 181-249)**

The `setupAnalyzerMode()` function now:

1. Creates `plugins.analyzers` section if it doesn't exist
2. Adds analyzer config with `name` and `path` fields
3. Uses the actual `pluginDir` variable for the path
4. Handles existing `plugins` section gracefully

```typescript
const analyzerConfig = {
  name: 'pulumicost',
  path: pluginDir,  // e.g., /home/runner/.pulumi/plugins/analyzer-pulumicost-v0.1.3
};

if (!plugins) {
  doc.set('plugins', { analyzers: [analyzerConfig] });
} else if (!pluginsJS.analyzers) {
  doc.setIn(['plugins', 'analyzers'], [analyzerConfig]);
} else {
  // Check if pulumicost already configured, add if not
}
```

### Build Status

- `npm run lint` - PASSED
- `npm run build` - PASSED
- Changes on `main` branch, needs merge to `v1`

---

## Background: Why `analyzers:` vs `plugins.analyzers:`

### `analyzers:` (Top-level)

```yaml
analyzers:
  - pulumicost
```

- Relies on Pulumi's plugin auto-discovery
- Expects analyzer to be installed via `pulumi plugin install analyzer pulumicost`
- Searches in `~/.pulumi/plugins/` with specific naming conventions
- **Does NOT work** for locally-installed custom analyzers in CI

### `plugins.analyzers:` (Explicit Path)

```yaml
plugins:
  analyzers:
    - name: pulumicost
      path: /absolute/path/to/plugin/directory
```

- Designed for development and CI environments
- Bypasses auto-discovery, uses explicit path
- Path points to **directory** containing `pulumi-analyzer-<name>` binary
- **Required** for finfocus-action since we install the plugin ourselves

---

## Session 1 Summary (2025-01-10)

### Initial Issues Fixed

1. **Policy Pack vs Analyzer confusion** - Original code was treating analyzer
   as a policy pack
2. **Input mapping** - `action.yml` needed underscores for env var mapping
   (`INPUT_ANALYZER_MODE` not `INPUT_ANALYZER-MODE`)

### Binary Naming

The `pulumicost` binary auto-detects when invoked as an analyzer:

```go
// cmd/pulumicost/main.go
if strings.Contains(exeName, "pulumi-analyzer-pulumicost") {
    return cli.RunAnalyzerServe(dummyCmd)
}
```

Binary must be named `pulumi-analyzer-pulumicost` (not `pulumi-analyzer-cost`).

---

## Debugging Tips

### Check Plugin Installation

```bash
ls -la ~/.pulumi/plugins/analyzer-pulumicost-*/
```

### Check Pulumi.yaml Content

The action logs the full `Pulumi.yaml` after modification. Look for:

```yaml
plugins:
  analyzers:
    - name: pulumicost
      path: /home/runner/.pulumi/plugins/analyzer-pulumicost-v0.1.3
```

### Enable Pulumi Debug Output

```bash
pulumi preview --debug --logtostderr -v=9
```

### Check Analyzer Logs

The action creates a wrapper script that logs to `/tmp/pulumicost-analyzer.log`:

```bash
cat /tmp/pulumicost-analyzer.log
```

---

## References

- pulumicost-core research: `specs/012-analyzer-e2e-tests/research.md`
- Pulumi Project File docs: https://www.pulumi.com/docs/iac/concepts/projects/project-file/
