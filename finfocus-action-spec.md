# Product Specification: finfocus-action

## 1. Executive Summary
`finfocus-action` is a dedicated GitHub Action for integrating [pulumicost-core](https://github.com/rshade/finfocus-action) into CI/CD workflows. It empowers developers to visualize, track, and enforce cloud cost estimates directly within their Pull Requests, preventing budget surprises before deployment.

## 2. Goals & Objectives
-   **Visibility:** Provide immediate cost feedback on infrastructure changes (diffs).
-   **Guardrails:** Fail CI pipelines if cost thresholds or budgets are exceeded.
-   **Ease of Use:** "Drop-in" solution for existing Pulumi users with minimal configuration.
-   **Flexibility:** Support both simple "comment on PR" workflows and advanced "analyzer plugin" integration.

## 3. User Stories
1.  **As a Developer**, I want to see a cost estimate comment on my PR so I know how much my changes will cost.
2.  **As a Platform Engineer**, I want to block PRs that increase monthly spend by more than $500.
3.  **As a Security/Compliance Officer**, I want to ensure `pulumicost` runs as an official Pulumi Analyzer to enforce policy compliance deep within the engine.

## 4. Technical Architecture

### 4.1 Action Type
We will implement a **Composite Action** initially.
-   **Why?** It allows mixing shell steps (installing binary) with JavaScript steps (posting comments) easily without the overhead/latency of building a Docker container on every run, and works natively across Linux, macOS, and Windows runners if binary fetching is handled correctly.
-   **Future:** Can be migrated to a pure TypeScript/JavaScript action if logic becomes complex.

### 4.2 Inputs
| Input | Description | Required | Default |
| :--- | :--- | :---: | :---: |
| `pulumi-plan-json` | Path to the `pulumi preview --json` output file. | **Yes** (for PR mode) | `plan.json` |
| `github-token` | GitHub Token for posting comments. | No | `${{ github.token }}` |
| `pulumicost-version` | Version of `pulumicost` to install. | No | `latest` |
| `install-plugins` | array list of plugins to install (e.g., `- aws-plugin, kubecost`). | No | `""` |
| `behavior-on-error` | specific behavior when error occurs (fail, silent, warn). | No | `fail` |
| `post-comment` | Whether to post a comment to the PR. | No | `true` |
| `fail-on-cost-increase`| Threshold string (e.g., "100USD") to fail if diff exceeds. | No | `""` (disabled) |
| `analyzer-mode` | If `true`, sets up environment for `pulumi preview` to use as analyzer. | No | `false` |

### 4.3 Outputs
| Output | Description |
| :--- | :--- |
| `total-monthly-cost` | The absolute projected monthly cost. |
| `cost-diff` | The difference in cost compared to the base state (if available). |
| `currency` | The currency code (e.g., USD). |
| `report-json-path` | Path to the generated full JSON report. |

## 5. Modes of Operation

### Mode A: PR Commenter (Standard)
This is the primary workflow.
1.  **Setup:** Action installs `pulumicost` binary.
2.  **Plugins:** Installs requested plugins via `pulumicost plugin install`.
3.  **Analysis:** Action runs `pulumicost cost projected --pulumi-json <input> --output json`.
4.  **Diffing:** (Future) If a baseline file is provided, it calculates diff.
5.  **Reporting:** Formats a Markdown table and posts/updates a sticky comment on the PR.

### Mode B: Analyzer Integration (Advanced)
Integrates with Pulumi's [Analyzer policy system](https://www.pulumi.com/docs/concepts/config/analyzers/).
1.  **Setup:** Installs `pulumicost` binary.
2.  **Plugins:** Installs requested plugins via `pulumicost plugin install`.
3.  **Policy Pack Configuration:**
    -   Creates directory `~/.pulumicost/analyzer`.
    -   Writes `PulumiPolicy.yaml` with `runtime: pulumicost`.
    -   Copies and renames binary to `~/.pulumicost/analyzer/pulumi-analyzer-policy-pulumicost`.
4.  **Registration:** Exports `PULUMI_POLICY_PACK_PATH` to `~/.pulumicost/analyzer` so the subsequent `pulumi preview` step discovers it.
5.  **Execution:** The user runs `pulumi preview` *after* this step, and Pulumi calls `pulumicost` via gRPC.

## 6. Repository Structure
We will adhere to standard GitHub Action best practices.

```text
finfocus-action/
├── action.yml          # Definition
├── README.md           # Documentation
├── ROADMAP.md          # Project roadmap
├── LICENSE             # MIT
├── package.json        # Deps for scripts (if TS used)
├── src/                # TypeScript source for logic
│   ├── main.ts         # Entry point
│   ├── install.ts      # Binary downloader
│   ├── plugins.ts      # Plugin manager
│   ├── comment.ts      # GitHub API interactions
│   └── analyze.ts      # Pulumicost wrapper
├── dist/               # Compiled JS (ncc/webpack)
├── __tests__/          # Jest tests
└── .github/
    └── workflows/
        ├── test.yml    # Integration tests
        └── release.yml # Release automation
```

## 7. Development & Implementation Plan

### Phase 1: Foundation
1.  Initialize repo with TypeScript template.
2.  Generate a `ROADMAP.md` detailing the future phases and features.
3.  Implement `install.ts`: logic to detect OS/Arch, download `pulumicost` release from GitHub Releases, and add to `$PATH`.
    -   **Artifact Pattern:** `pulumicost-core-v{version}-{os}-{arch}.tar.gz` (e.g., `pulumicost-core-v1.0.0-linux-amd64.tar.gz`).
    -   **Binary Name:** `pulumicost` (inside the archive).
4.  Create `action.yml` defining inputs.

### Phase 2: Logic
1.  Implement `plugins.ts`: Parse `install-plugins` input and loop through `pulumicost plugin install <name>`.
2.  Implement wrapper to run `pulumicost cost projected` against the provided JSON file.
3.  Parse the JSON output.
4.  Implement `comment.ts`: Check for existing comment by signature, update if exists, create new if not. Format a clean Markdown table.

### Phase 3: Testing & Polish
1.  **Unit Tests:** Jest tests for parsers and logic.
2.  **Integration Tests:** A workflow in the repo that:
    -   Checks out code.
    -   Runs `pulumi preview --json` on a fixture.
    -   Runs the action.
    -   Verifies the output/comment (using a mock or dry-run).

## 8. Research & References
-   **Infracost Action:** Reference for PR comment formatting and behavior (e.g., "Show more" folds).
-   **Pulumi Actions:** Reference for how they handle binary setup.
-   **GitHub Toolkit:** Use `@actions/core`, `@actions/exec`, `@actions/github`.

## 9. Example Usage (Draft)

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Install dependencies
    run: npm ci

  - name: Pulumi Preview
    uses: pulumi/actions@v4
    with:
      command: preview
      stack-name: dev
    env:
      PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}

  # Note: You need to generate the JSON plan.
  # Often simpler to run CLI directly for JSON generation:
  - name: Generate Plan JSON
    run: pulumi preview --json > plan.json
    env:
      PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}

  - name: Run Pulumicost
    uses: rshade/finfocus-action@v1
    with:
      pulumi-plan-json: plan.json
      github-token: ${{ secrets.GITHUB_TOKEN }}
```
