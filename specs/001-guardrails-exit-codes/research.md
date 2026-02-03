# Research: Guardrails Exit Code Refactor

**Feature**: 001-guardrails-exit-codes
**Date**: 2026-02-02

## Research Questions

### 1. How does finfocus v0.2.5+ return exit codes for budget thresholds?

**Decision**: finfocus returns exit codes 0-3 for budget threshold checks

**Rationale**: Per GitHub Issue #48 and finfocus/finfocus#496:

- Exit 0: All thresholds passed
- Exit 1: Warning threshold breached
- Exit 2: Critical threshold breached
- Exit 3: Budget exceeded

These exit codes are returned by the `finfocus budget check` command (or similar budget-related commands).

**Alternatives Considered**:

- Parsing JSON output (current approach) - More complex, slower
- Custom signaling via stdout - Non-standard, harder to integrate

### 2. How to detect finfocus version for backward compatibility?

**Decision**: Use `finfocus --version` output and semver comparison

**Rationale**: The existing `verifyInstallation()` method in `install.ts` already calls `finfocus --version`. We can:

1. Parse the version string from stdout
2. Compare using semver logic (>= 0.2.5)
3. Cache the result for the action lifetime

**Implementation Pattern**:

```typescript
async function getFinfocusVersion(): Promise<string> {
  const output = await exec.getExecOutput('finfocus', ['--version']);
  // Parse "finfocus v0.2.5" or "finfocus 0.2.5" format
  const match = output.stdout.match(/v?(\d+\.\d+\.\d+)/);
  return match ? match[1] : '0.0.0';
}

function supportsExitCodes(version: string): boolean {
  const [major, minor, patch] = version.split('.').map(Number);
  // v0.2.5 or higher
  return major > 0 || (major === 0 && (minor > 2 || (minor === 2 && patch >= 5)));
}
```

**Alternatives Considered**:

- Feature detection via flag (e.g., `--exit-codes`) - finfocus doesn't support this
- Always use exit codes and catch errors - Breaks backward compatibility

### 3. How should @actions/exec handle non-zero exit codes?

**Decision**: Use `ignoreReturnCode: true` option and check exitCode manually

**Rationale**: By default, `exec.exec()` throws on non-zero exit codes. For budget threshold checking, non-zero exit codes are expected outcomes (warning/critical/exceeded), not errors.

**Implementation Pattern**:

```typescript
const result = await exec.getExecOutput('finfocus', ['budget', 'check'], {
  ignoreReturnCode: true,
  silent: !debug,
});

switch (result.exitCode) {
  case 0: return { passed: true, severity: 'none' };
  case 1: return { passed: false, severity: 'warning' };
  case 2: return { passed: false, severity: 'critical' };
  case 3: return { passed: false, severity: 'exceeded' };
  default: throw new Error(`Unexpected exit code: ${result.exitCode}`);
}
```

**Alternatives Considered**:

- Try/catch around exec - Less explicit, harder to distinguish exit codes from actual errors
- Using child_process directly - Loses @actions/exec benefits (logging, path handling)

### 4. What is the exact finfocus command for budget threshold checking?

**Decision**: Investigate during implementation; likely `finfocus cost projected` with budget config

**Rationale**: The current action runs `finfocus cost projected` and then parses JSON output to check thresholds. The new approach would either:

1. Continue using `finfocus cost projected` if it returns budget exit codes, OR
2. Use a dedicated `finfocus budget check` command if one exists

**Implementation Note**: The action already writes budget config to `~/.finfocus/config.yaml`. The exit codes may be returned automatically when this config is present.

**Follow-up**: Verify during implementation which command returns the exit codes. The implementation should be flexible to adapt.

### 5. How to handle version detection failure?

**Decision**: Fall back to JSON parsing (current behavior)

**Rationale**: If version detection fails (network issue, parsing error), the safest approach is to assume an older version and use the existing JSON parsing fallback. This ensures:

- No regression for existing users
- Graceful degradation
- Predictable behavior

**Implementation Pattern**:

```typescript
let useExitCodes = false;
try {
  const version = await getFinfocusVersion();
  useExitCodes = supportsExitCodes(version);
} catch {
  core.warning('Could not detect finfocus version, falling back to JSON parsing');
  useExitCodes = false;
}
```

## Summary

| Topic | Decision |
|-------|----------|
| Exit code semantics | 0=pass, 1=warning, 2=critical, 3=exceeded |
| Version detection | Parse `finfocus --version`, compare >= 0.2.5 |
| Non-zero handling | Use `ignoreReturnCode: true` with manual switch |
| Fallback trigger | Version < 0.2.5 OR version detection failure |
| Budget command | TBD during implementation (likely `cost projected` with config) |
