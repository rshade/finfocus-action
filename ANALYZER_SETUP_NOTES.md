# Analyzer Plugin Setup Notes

**Created**: 2025-01-10
**Updated**: 2025-01-11 (Session 2 - Fix Applied)
**Purpose**: Track the correct setup process for the FinFocus Analyzer plugin

## Session 2 Summary (2025-01-11)

### Problem Identified

Workflow run 20879348290 showed:

- Plugin installed correctly to `~/.pulumi/plugins/analyzer-finfocus-v0.1.3/`
- `Pulumi.yaml` was updated with `analyzers: [finfocus]`
- `pulumi preview` ran but **NO cost diagnostics appeared**

### Root Cause (Session 2 Update)

The code had two remaining issues even after fixing the YAML section:

1.  **Binary Naming**: The wrapper script called `finfocus-real`. The `finfocus` binary checks its own name (via `os.Args[0]`) to decide if it should run in analyzer (gRPC) mode. If it doesn't find `pulumi-analyzer-finfocus` in its name, it just runs as a normal CLI and exits immediately, causing Pulumi to fail to connect.
2.  **YAML Path**: The `plugins.analyzers[].path` in `Pulumi.yaml` was pointing to the plugin **directory** instead of the **executable**. While some plugins work with directory paths (if they have a `PulumiPlugin.yaml`), simple executable analyzers should point directly to the binary.

### Fix Applied (Session 3 - 2025-01-11)

1.  **Renamed Real Binary**: The real binary is now renamed to `pulumi-analyzer-finfocus-real`. This satisfies the `strings.Contains(exeName, "pulumi-analyzer-finfocus")` check in the Go source.
2.  **Updated Wrapper**: The wrapper script (at `pulumi-analyzer-finfocus`) now invokes `pulumi-analyzer-finfocus-real`.
3.  **Updated Pulumi.yaml Logic**:
    *   Points `path` to the **plugin directory**: `/.../analyzer-finfocus-vX.Y.Z`.
    *   Automatically **removes** any legacy top-level `analyzers: [finfocus]` entry to prevent configuration conflicts.
    *   Updates the `path` if `finfocus` is already present in `plugins.analyzers`.
4.  **Version Check Fix**: Changed `finfocus version` to `finfocus --version` in `analyze.ts`.

### Code Changes Made

**File: `src/analyze.ts`**

```typescript
const analyzerBinaryPath = path.join(pluginDir, 'pulumi-analyzer-finfocus');
const realBinaryPath = path.join(pluginDir, 'pulumi-analyzer-finfocus-real');

// ... copy to realBinaryPath ...
// ... wrapper at analyzerBinaryPath calls realBinaryPath ...

const analyzerConfig = {
  name: 'finfocus',
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
  - finfocus
```

- Relies on Pulumi's plugin auto-discovery
- Expects analyzer to be installed via `pulumi plugin install analyzer finfocus`
- Searches in `~/.pulumi/plugins/` with specific naming conventions
- **Does NOT work** for locally-installed custom analyzers in CI

### `plugins.analyzers:` (Explicit Path)

```yaml
plugins:
  analyzers:
    - name: finfocus
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

The `finfocus` binary auto-detects when invoked as an analyzer:

```go
// cmd/finfocus/main.go
if strings.Contains(exeName, "pulumi-analyzer-finfocus") {
    return cli.RunAnalyzerServe(dummyCmd)
}
```

Binary must be named `pulumi-analyzer-finfocus` (not `pulumi-analyzer-cost`).

---

## Debugging Tips

### Check Plugin Installation

```bash
ls -la ~/.pulumi/plugins/analyzer-finfocus-*/
```

### Check Pulumi.yaml Content

The action logs the full `Pulumi.yaml` after modification. Look for:

```yaml
plugins:
  analyzers:
    - name: finfocus
      path: /home/runner/.pulumi/plugins/analyzer-finfocus-v0.1.3
```

### Enable Pulumi Debug Output

```bash
pulumi preview --debug --logtostderr -v=9
```

### Check Analyzer Logs

The action creates a wrapper script that logs to `/tmp/finfocus-analyzer.log`:

```bash
cat /tmp/finfocus-analyzer.log
```

---

## References

- finfocus research: `specs/012-analyzer-e2e-tests/research.md`
- Pulumi Project File docs: https://www.pulumi.com/docs/iac/concepts/projects/project-file/
