# Analyzer Plugin Setup Notes

**Created**: 2025-01-10
**Purpose**: Track the correct setup process for the PulumiCost Analyzer plugin

## Issue Summary

The analyzer plugin installation in `finfocus-action` was incorrectly treating the analyzer as a **Policy Pack** instead of an **Analyzer Plugin**. These are different Pulumi concepts with different installation and configuration mechanisms.

## Root Cause Analysis

### Current (Wrong) Approach in `analyze.ts`

```typescript
// WRONG: Creates PulumiPolicy.yaml (policy pack format)
const policyYaml = `runtime: pulumicost
name: pulumicost
version: 0.1.0
`;

// WRONG: Uses policy pack directory
const analyzerDir = path.join(os.homedir(), '.pulumicost', 'analyzer');

// WRONG: Binary name includes "policy" prefix
const analyzerBinaryName = 'pulumi-analyzer-policy-pulumicost';

// WRONG: Sets policy pack environment variable
core.exportVariable('PULUMI_POLICY_PACK_PATH', analyzerDir);
```

### What This Causes

1. Pulumi doesn't find the analyzer because it's looking in the wrong location
2. The `PULUMI_POLICY_PACK_PATH` is for policy packs, not analyzers
3. The `PulumiPolicy.yaml` format is for policy packs, not analyzers

## Correct Approach

### Option 1: Install to Pulumi Plugin Directory (Recommended for Production)

The analyzer binary should be installed to the standard Pulumi plugin directory:

```
~/.pulumi/plugins/analyzer-cost-<version>/pulumi-analyzer-cost
```

Example:
```
~/.pulumi/plugins/analyzer-cost-v0.1.0/pulumi-analyzer-cost
```

Then users configure their `Pulumi.yaml`:

```yaml
name: my-project
runtime: yaml

analyzers:
  - cost
```

### Option 2: Use plugins.analyzers in Pulumi.yaml (For Development/CI)

For local development or CI where you want to use a binary at a specific path:

```yaml
name: my-project
runtime: yaml

plugins:
  analyzers:
    - name: pulumicost
      path: /path/to/binary/directory  # Directory containing pulumi-analyzer-pulumicost
      version: 0.0.0-dev
```

The `path` should point to a **directory** containing the binary named `pulumi-analyzer-pulumicost`.

## Smart Binary Behavior

The `pulumicost` binary is already "smart" (see `cmd/pulumicost/main.go`):

```go
exeName := filepath.Base(os.Args[0])
if strings.Contains(exeName, "pulumi-analyzer-policy-pulumicost") ||
    strings.Contains(exeName, "pulumi-analyzer-pulumicost") {
    // Automatically start gRPC server when invoked as analyzer
    return cli.RunAnalyzerServe(dummyCmd)
}
```

This means:
- When binary is named `pulumicost` → Normal CLI operation
- When binary is named `pulumi-analyzer-pulumicost` → Automatic gRPC server start

## Fix Required in finfocus-action

### Changes to `src/analyze.ts`

Replace the `setupAnalyzerMode()` function:

```typescript
async setupAnalyzerMode(): Promise<void> {
  // Get pulumicost version for plugin directory naming
  const versionOutput = await exec.getExecOutput('pulumicost', ['version'], { silent: true });
  const version = versionOutput.stdout.trim().match(/v?[\d.]+/)?.[0] || 'v0.1.0';

  // Install to Pulumi's plugin directory
  const pluginDir = path.join(os.homedir(), '.pulumi', 'plugins', `analyzer-cost-${version}`);

  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  const pulumicostBinary = await this.findBinary('pulumicost');
  const analyzerBinaryPath = path.join(pluginDir, 'pulumi-analyzer-cost');

  core.info(`Installing analyzer plugin to ${analyzerBinaryPath}`);
  fs.copyFileSync(pulumicostBinary, analyzerBinaryPath);
  fs.chmodSync(analyzerBinaryPath, 0o755);

  core.info(`Analyzer plugin installed. Add 'analyzers: [cost]' to your Pulumi.yaml to enable.`);
}
```

### User's Pulumi.yaml Changes

Users need to add the `analyzers` section to their project's `Pulumi.yaml`:

```yaml
name: my-infrastructure
runtime: yaml  # or nodejs, python, go, etc.

analyzers:
  - cost
```

## Alternative: CI-Specific Approach

For CI where you don't want to modify the user's `Pulumi.yaml`, you can:

1. Create a temporary project overlay
2. Use the `plugins.analyzers` configuration

```yaml
plugins:
  analyzers:
    - name: cost
      path: /path/to/plugin/directory
```

However, this requires more complex handling.

## Key Differences: Policy Packs vs Analyzers

| Aspect | Policy Packs | Analyzers |
|--------|-------------|-----------|
| Purpose | Enforce policies on resources | Analyze/inspect resources |
| Configuration | `--policy-pack` flag or `PULUMI_POLICY_PACK_PATH` | `analyzers:` in Pulumi.yaml |
| Directory | User-specified | `~/.pulumi/plugins/analyzer-<name>-<version>/` |
| Binary naming | Various | `pulumi-analyzer-<name>` |
| Registration | Explicit path | Auto-discovered from plugins dir |

## References

- **pulumicost-core quickstart**: `specs/009-analyzer-plugin/quickstart.md`
- **E2E test research**: `specs/012-analyzer-e2e-tests/research.md`
- **Smart binary implementation**: `cmd/pulumicost/main.go`
- **Pulumi Plugin Configuration**: https://www.pulumi.com/docs/iac/concepts/projects/project-file/

## Testing the Fix

After implementing the fix:

1. Run the action with `analyzer-mode: true`
2. Verify the plugin is installed:
   ```bash
   ls ~/.pulumi/plugins/ | grep analyzer-cost
   ```
3. Verify the binary works:
   ```bash
   ~/.pulumi/plugins/analyzer-cost-v*/pulumi-analyzer-cost
   # Should output a port number
   ```
4. Run `pulumi preview` with `analyzers: [cost]` in Pulumi.yaml
5. Cost diagnostics should appear in the output

## Workflow Configuration Example

```yaml
# .github/workflows/analyzer-mode.yml
- name: Setup FinFocus Analyzer Mode
  uses: rshade/finfocus-action@v1
  with:
    analyzer-mode: true
    install-plugins: aws-public

- name: Run Pulumi Preview with Cost Analysis
  run: pulumi preview
  env:
    PULUMI_CONFIG_PASSPHRASE: ""
```

The user's `Pulumi.yaml` must include:
```yaml
analyzers:
  - cost
```
