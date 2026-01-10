# Analyzer Plugin Setup Notes

**Created**: 2025-01-10
**Updated**: 2025-01-10
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
~/.pulumi/plugins/analyzer-pulumicost-<version>/pulumi-analyzer-pulumicost
```

Example:
```
~/.pulumi/plugins/analyzer-pulumicost-v0.1.0/pulumi-analyzer-pulumicost
```

Then users configure their `Pulumi.yaml`:

```yaml
name: my-project
runtime: yaml

analyzers:
  - pulumicost
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
- **CRITICAL**: The binary MUST contain `pulumi-analyzer-pulumicost` in its name to trigger analyzer mode. `pulumi-analyzer-cost` will NOT work.

## Fix Implementation in finfocus-action

### 1. Analyzer Setup Logic (`src/analyze.ts`)

We implemented the `setupAnalyzerMode` function to:
1.  Fetch the `pulumicost` version.
2.  Create the directory `~/.pulumi/plugins/analyzer-pulumicost-<version>`.
3.  Copy the `pulumicost` binary to `pulumi-analyzer-pulumicost` in that directory.
4.  **Automatically update `Pulumi.yaml`** in the workspace to include `analyzers: [pulumicost]`.

### 2. Composite Action Input Fix (`action.yml` & `src/main.ts`)

**Issue**: Inputs like `analyzer-mode` were being ignored.
**Cause**: `action.yml` mapped inputs to env vars using hyphens (e.g., `INPUT_ANALYZER-MODE`), but `@actions/core` expects underscores (e.g., `INPUT_ANALYZER_MODE`). Composite actions running Node.js scripts must manually handle env var mapping.
**Fix**:
-   Updated `action.yml` to use underscores in `env` keys: `INPUT_ANALYZER_MODE: ${{ inputs.analyzer-mode }}`.
-   Updated `src/main.ts` to request inputs with underscores: `core.getInput('analyzer_mode')`.

## Troubleshooting & Debugging

If the analyzer still doesn't appear in `pulumi preview` output:

### 1. Verify `Pulumi.yaml` Update
The action logs the content of `Pulumi.yaml` after modification. Check the action logs to ensure `analyzers: [pulumicost]` is present.

### 2. Check Plugin Installation
Verify the binary exists and is executable:
```bash
ls -l ~/.pulumi/plugins/analyzer-pulumicost-*/pulumi-analyzer-pulumicost
```

### 3. Enable Zerolog Debugging
The `pulumicost` binary uses `zerolog`. To capture its internal logs during `pulumi preview`, we can redirect its output. Since Pulumi invokes the binary, standard redirection is tricky.

**Technique**: Replace the binary with a wrapper script.

Modify `setupAnalyzerMode` to write a wrapper script instead of copying the binary directly:

```bash
#!/bin/sh
# Wrapper to capture pulumicost logs
/path/to/real/pulumicost "$@" 2> /tmp/pulumicost.log
```

Or better, use `tee` if we want to try to pipe it back to stderr (though Pulumi might swallow it):

```bash
/path/to/real/pulumicost "$@" | tee -a /tmp/pulumicost.log
```

Then, in a subsequent workflow step, `cat /tmp/pulumicost.log`.

### 4. Pulumi Verbosity
Run `pulumi preview` with debug flags:
```bash
pulumi preview --debug --logtostderr -v=9
```
This might show if Pulumi is finding and loading the analyzer.

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