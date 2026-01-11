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

### Root Cause (Session 2 Update)

The code had two remaining issues even after fixing the YAML section:

1.  **Binary Naming**: The wrapper script called `pulumicost-real`. The `pulumicost` binary checks its own name (via `os.Args[0]`) to decide if it should run in analyzer (gRPC) mode. If it doesn't find `pulumi-analyzer-pulumicost` in its name, it just runs as a normal CLI and exits immediately, causing Pulumi to fail to connect.
2.  **YAML Path**: The `plugins.analyzers[].path` in `Pulumi.yaml` was pointing to the plugin **directory** instead of the **executable**. While some plugins work with directory paths (if they have a `PulumiPlugin.yaml`), simple executable analyzers should point directly to the binary.

### Fix Applied (Session 3 - 2025-01-11)

1.  **Renamed Real Binary**: The real binary is now renamed to `pulumi-analyzer-pulumicost-real`. This satisfies the `strings.Contains(exeName, "pulumi-analyzer-pulumicost")` check in the Go source.
2.  **Updated Wrapper**: The wrapper script (at `pulumi-analyzer-pulumicost`) now invokes `pulumi-analyzer-pulumicost-real`.
3.  **Updated Pulumi.yaml Logic**:
    *   Points `path` to the **plugin directory**: `/.../analyzer-pulumicost-vX.Y.Z`.
    *   Automatically **removes** any legacy top-level `analyzers: [pulumicost]` entry to prevent configuration conflicts.
    *   Updates the `path` if `pulumicost` is already present in `plugins.analyzers`.
4.  **Version Check Fix**: Changed `pulumicost version` to `pulumicost --version` in `analyze.ts`.

### Code Changes Made

**File: `src/analyze.ts`**

```typescript
const analyzerBinaryPath = path.join(pluginDir, 'pulumi-analyzer-pulumicost');
const realBinaryPath = path.join(pluginDir, 'pulumi-analyzer-pulumicost-real');

// ... copy to realBinaryPath ...
// ... wrapper at analyzerBinaryPath calls realBinaryPath ...

const analyzerConfig = {
  name: 'pulumicost',
  path: pluginDir, // Pointing to DIRECTORY, not binary
};
```

### Build Status

- `npm run lint` - PASSED
- `npm run build` - PASSED

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
