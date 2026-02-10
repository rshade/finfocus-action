# Troubleshooting

## Key Principle: Never Suppress Errors

**NEVER use `|| true` to suppress errors in workflows.**
This example exists to test the finfocus-action, so errors
must be visible. If a step fails, let it fail.

## Common Failure Points

### 1. Pulumi Preview Fails

- Check AWS OIDC credentials are configured
- Verify `Pulumi.yaml` is valid
- Check that required Pulumi plugins are available

### 2. finfocus Installation Fails

- Check GitHub API rate limits
- Verify the release assets exist at `rshade/finfocus/releases`

### 3. Plugin Installation Fails

- Check plugin exists in finfocus's registry
- Verify plugin releases exist at the plugin's repo
- For `aws-public`, assets include region suffix

### 4. Cost Analysis Fails

- Ensure `plan.json` contains valid JSON (not error messages)
- Check that the plan file is not empty
- Verify the plugin was installed successfully

## Debugging Tips

The finfocus-action includes extensive logging. Look for:

- `=== Environment Diagnostics ===` - Shows runtime environment
- `=== Action Inputs (raw) ===` - Shows what inputs were received
- `=== Installer: ===` - Shows download/install progress
- `=== PluginManager: ===` - Shows plugin installation
- `=== Analyzer: ===` - Shows cost analysis execution

To get more details, enable GitHub Actions debug logging:

- Set repository secret `ACTIONS_STEP_DEBUG` to `true`

Check the plan.json content in logs - it should start with `{` and be valid JSON.

## Testing Locally

```bash
# Install finfocus (replace {version} with actual version)
FINFOCUS_URL="https://github.com/rshade/finfocus/releases/latest/download"
curl -sL "$FINFOCUS_URL/finfocus-v{version}-linux-amd64.tar.gz" \
  | tar xz

# Install plugin
./finfocus plugin install aws-public

# Generate Pulumi plan
pulumi preview --json > plan.json

# Run cost analysis
./finfocus cost projected --pulumi-json plan.json --output json
```
