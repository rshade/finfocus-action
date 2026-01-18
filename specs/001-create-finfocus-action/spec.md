# Feature Specification: Create finfocus-action GitHub Action

**Feature Branch**: `001-create-finfocus-action`
**Created**: 2026-01-08
**Status**: Draft

## Executive Summary

`finfocus-action` is a dedicated GitHub Action for integrating `finfocus` into CI/CD workflows. It empowers developers to visualize, track, and enforce cloud cost estimates directly within their Pull Requests, preventing budget surprises before deployment. It supports both a standard PR commenting workflow and an advanced Pulumi Analyzer integration for deeper policy enforcement.

## User Scenarios & Testing

### User Story 1 - PR Cost Visibility (Priority: P1)

As a Developer, I want to see a cost estimate comment on my PR so I know how much my changes will cost before merging.

**Why this priority**: Core value proposition; provides immediate feedback loop for developers.

**Independent Test**: Can be tested by running the action on a PR with known infrastructure changes and verifying the comment appears.

**Acceptance Scenarios**:

1. **Given** a Pull Request with infrastructure changes and a valid `pulumi preview --json` output file, **When** the action runs successfully, **Then** a sticky comment is posted to the PR containing a Markdown table with the projected monthly cost and diff.
2. **Given** a PR where a cost comment already exists, **When** the action runs again (e.g., after a commit), **Then** the existing comment is updated rather than creating a new one.
3. **Given** a PR with no cost changes, **When** the action runs, **Then** the comment clearly indicates that there is no change in cost.

---

### User Story 2 - Cost Guardrails (Priority: P2)

As a Platform Engineer, I want to block PRs that increase monthly spend by more than a specific threshold so that I can prevent accidental budget spikes.

**Why this priority**: Critical for governance and cost control.

**Independent Test**: Configure the action with a low threshold and trigger a run with a high-cost change.

**Acceptance Scenarios**:

1. **Given** the `fail-on-cost-increase` input is set to a value (e.g., "50USD"), **When** the calculated cost difference exceeds this amount, **Then** the action fails the CI workflow step.
2. **Given** the `fail-on-cost-increase` input is set, **When** the cost difference is below the threshold, **Then** the action succeeds.
3. **Given** `behavior-on-error` is set to "warn", **When** a failure condition occurs, **Then** the action logs a warning but does not fail the pipeline.

---

### User Story 3 - Analyzer Integration (Priority: P3)

As a Security/Compliance Officer, I want to ensure `finfocus` runs as an official Pulumi Analyzer to enforce policy compliance deep within the engine.

**Why this priority**: Advanced use case for strict policy enforcement beyond simple cost sums.

**Independent Test**: Enable analyzer mode and run `pulumi preview` locally (or in CI) to verify it loads the policy pack.

**Acceptance Scenarios**:

1. **Given** `analyzer-mode` is set to "true", **When** the action completes, **Then** the environment is configured (files created, env vars set) such that a subsequent `pulumi preview` command automatically loads `finfocus` as a policy pack.

---

## Requirements

### Functional Requirements

- FR-001: System MUST download and install the `finfocus` binary to the runner's PATH, supporting a user-specified version (defaulting to latest). Release artifacts follow the naming convention `finfocus-v{version}-{os}-{arch}.tar.gz`.
- FR-002: System MUST support installing a list of specified plugins (e.g., `aws-plugin`) via the `finfocus` CLI.
- **FR-003**: System MUST execute cost analysis using the `finfocus` CLI against a provided Pulumi plan JSON file.
- FR-004: System MUST format the analysis results into a readable Markdown table and post/update a sticky comment on the GitHub Pull Request using the provided GitHub token, identifying existing comments via a hidden HTML marker (`<!-- finfocus-action-comment -->`).
- FR-005: System MUST parse the `fail-on-cost-increase` input and fail the execution if the projected cost increase exceeds the defined threshold. If the input is malformed, the system MUST log a warning and skip the guardrail check.
- FR-006: System MUST support an "Analyzer Mode" that prepares the runtime environment (creating `PulumiPolicy.yaml`, setting `PULUMI_POLICY_PACK_PATH`) for subsequent Pulumi steps.
- FR-007: System MUST provide GitHub Action outputs for `total-monthly-cost`, `cost-diff`, `currency`, and `report-json-path` for use in subsequent steps.
- FR-008: System MUST respect the `behavior-on-error` input to determine whether to fail, warn, or be silent on errors.

### Non-Functional Requirements

- **NFR-001**: The action MUST be implemented as a "Composite Action" to minimize runtime overhead and avoid Docker container build latency.
- **NFR-002**: The action MUST function correctly on standard GitHub Actions runners: Linux (Ubuntu), macOS, and Windows.
- **NFR-003**: Installation of the binary MUST handle architecture detection (x86_64 vs arm64) automatically.

### Key Entities

- **Action Configuration**: Inputs provided by the user defining how the action runs (paths, tokens, thresholds).
- **Cost Estimate**: The structured data representing the financial impact of the infrastructure changes.

## Clarifications

### Session 2026-01-08

- Q: How should the action identify its own comment to update? → A: Use a hidden HTML comment marker `<!-- finfocus-action-comment -->` embedded in the markdown body.
- Q: What is the exact naming convention for the `finfocus` release artifacts? → A: `finfocus-v{version}-{os}-{arch}.tar.gz`.
- Q: How should the system handle malformed `fail-on-cost-increase` inputs? → A: Log a warning and skip the guardrail check.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Action installs `finfocus` and runs successfully on Linux, macOS, and Windows runners in under 1 minute (excluding plugin download time).
- **SC-002**: 100% of successful runs on a PR result in a visible, correctly formatted comment (or update).
- **SC-003**: Pipelines consistently fail (blocking merge) when cost increase thresholds are exceeded.
- **SC-004**: Analyzer mode setup correctly triggers the policy pack during the `pulumi preview` phase in 100% of test cases.

## Assumptions

- User has a valid Pulumi project and is able to generate a JSON preview (`pulumi preview --json`).
- The `finfocus` binary and plugins are available via public GitHub Releases.
- The workflow has access to a valid `GITHUB_TOKEN` with permissions to comment on PRs.