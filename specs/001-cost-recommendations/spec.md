# Feature Specification: Cost Optimization Recommendations

**Feature Branch**: `001-cost-recommendations`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Add support for displaying cost optimization recommendations from `finfocus cost recommendations` in PR comments alongside the existing cost estimates."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Display Cost Recommendations in PR Comments (Priority: P1)

As a developer reviewing a pull request with infrastructure changes, I want to see cost optimization recommendations alongside the existing cost estimates so I can make informed decisions about resource configurations and identify potential savings.

**Why this priority**: This is the core functionality of the feature, delivering the primary value of helping developers optimize costs.

**Independent Test**: Can be tested independently by running the action on a PR with infrastructure changes and verifying that cost recommendations appear in the PR comment, providing clear value to developers even if other features aren't implemented yet.

**Acceptance Scenarios**:

1. **Given** a pull request contains infrastructure changes, **When** the GitHub Action runs with `include-recommendations: true`, **Then** cost optimization recommendations are displayed in the PR comment alongside cost estimates
2. **Given** there are no cost optimization recommendations available, **When** the action runs, **Then** the PR comment does not show a recommendations section
3. **Given** cost recommendations are available, **When** the action runs, **Then** each recommendation shows the resource ID, action type, description, and estimated monthly savings

---

### User Story 2 - Configure Recommendation Display (Priority: P2)

As a repository maintainer, I want to control whether cost optimization recommendations are displayed in PR comments so I can enable this feature when appropriate for my team's workflow.

**Why this priority**: Provides flexibility for adoption, allowing teams to opt-in to the feature.

**Independent Test**: Can be tested independently by setting the input parameter and verifying the behavior changes accordingly, ensuring the configuration mechanism works correctly.

**Acceptance Scenarios**:

1. **Given** `include-recommendations` is set to `false` (default), **When** the action runs, **Then** no cost recommendations are fetched or displayed
2. **Given** `include-recommendations` is set to `true`, **When** the action runs, **Then** cost recommendations are fetched and displayed if available

---

### Edge Cases

- What happens when the `finfocus cost recommendations` command fails or returns invalid JSON?
- How does the system handle recommendations with zero or negative savings?
- What occurs when there are a large number of recommendations (e.g., 50+) that might make the PR comment too long?
- How should the system behave when the Pulumi plan file is missing or invalid?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a new input parameter `include-recommendations` (boolean, default: false) to control whether recommendations are displayed
- **FR-002**: System MUST execute `finfocus cost recommendations --pulumi-json plan.json --output json` when `include-recommendations` is true
- **FR-003**: System MUST parse the recommendations JSON output and extract summary (total_count, total_savings, currency) and recommendations array
- **FR-004**: System MUST display recommendations in the PR comment with a clear section header and table format showing resource, recommendation, and monthly savings
- **FR-005**: System MUST include total potential savings prominently in the recommendations section
- **FR-006**: System MUST provide new outputs: `total-savings` (total potential monthly savings) and `recommendation-count` (number of recommendations found)
- **FR-007**: System MUST handle gracefully when no recommendations are available (no error, just omit the section)
- **FR-008**: System MUST validate that the recommendations command succeeds before attempting to parse output

### Key Entities _(include if feature involves data)_

- **Cost Recommendation**: Represents an individual optimization suggestion containing resource_id (string), action_type (enum like RIGHTSIZING, MIGRATE), description (string), estimated_savings (number), and currency (string)
- **Recommendations Summary**: Contains total_count (number), total_savings (number), and currency (string) for all recommendations

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: PR comments with recommendations display within 30 seconds of action completion
- **SC-002**: 100% of valid recommendations from `finfocus` are displayed accurately in PR comments
- **SC-003**: Users can identify potential monthly savings clearly from the PR comment format
- **SC-004**: No errors occur when `include-recommendations` is false (default behavior unchanged)
- **SC-005**: System handles recommendation parsing failures gracefully without breaking the PR comment
