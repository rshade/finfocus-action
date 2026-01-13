# Research: Cost Optimization Recommendations

**Date**: 2026-01-12

## Research Tasks

### How to install and use pulumicost CLI in GitHub Actions

**Decision**: Use `npm install -g @pulumi/cost` or download binary from GitHub releases.

**Rationale**: Pulumicost is available as npm package or pre-built binaries. For GitHub Actions, downloading the binary ensures version consistency and avoids npm registry issues.

**Alternatives considered**: Using Docker image, but binary download is simpler and faster.

### Best practices for formatting large tables in GitHub PR comments

**Decision**: Use Markdown table format with truncation for very long descriptions.

**Rationale**: GitHub supports Markdown tables natively. For large outputs, limit to top 10 recommendations and add truncation note.

**Alternatives considered**: Collapsible sections, but tables are more readable for cost data.

### Handling command failures and timeouts

**Decision**: Use try-catch with timeout, log errors but don't fail the action unless critical.

**Rationale**: Recommendations are optional feature, so failures shouldn't block cost estimation. Timeout prevents hanging.

**Alternatives considered**: Always fail on errors, but that would break existing workflows.
