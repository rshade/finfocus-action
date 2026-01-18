# Feature Specification: Add sustainability/carbon footprint metrics (GreenOps)

**Feature Branch**: `001-sustainability-metrics`
**Created**: 2026-01-13
**Status**: Draft
**Input**: User description from issue #17

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Infrastructure Carbon Impact (Priority: P1)

As a developer or reviewer, I want to see the estimated carbon footprint of my infrastructure changes directly in the PR comment so that I can make environmentally conscious decisions during code review.

**Why this priority**: Core value proposition of the feature; without this, the feature serves no purpose.

**Independent Test**: Configure the action with `include-sustainability: true` and verify the PR comment contains the "Sustainability Impact" section with correct data from the mock `finfocus` output.

**Acceptance Scenarios**:

1. **Given** a PR with infrastructure changes and `include-sustainability: true`, **When** the action runs, **Then** the PR comment includes a "Sustainability Impact" section showing "Carbon Footprint" and "Carbon Change".
2. **Given** a PR with `include-sustainability: false` (default), **When** the action runs, **Then** the PR comment does NOT include sustainability metrics.
3. **Given** a PR where `finfocus` returns no sustainability data, **When** the action runs, **Then** the sustainability section is omitted or shows a "Data Unavailable" message, without crashing.

---

### User Story 2 - Configure Sustainability Assumptions (Priority: P2)

As a DevOps engineer, I want to configure the assumed resource utilization rate so that the carbon estimates align with our organization's real-world usage patterns.

**Why this priority**: Utilization heavily impacts carbon calculations; generic defaults (100%) are often inaccurate for many workloads.

**Independent Test**: Run the action with different `utilization-rate` inputs and verify the underlying `finfocus` command receives the correct flag.

**Acceptance Scenarios**:

1. **Given** `utilization-rate` is set to "0.8", **When** the action executes `finfocus`, **Then** the command includes `--utilization 0.8`.
2. **Given** `utilization-rate` is invalid (e.g., "high"), **When** the action runs, **Then** it should log a warning and revert to default (1.0) or fail gracefully.

---

### User Story 3 - View Environmental Equivalents (Priority: P3)

As a non-technical stakeholder, I want to see carbon impact translated into relatable metrics (e.g., "trees planted", "miles driven") so that I can intuitively understand the scale of the emissions.

**Why this priority**: enhances communication and "GreenOps" awareness but is not strictly required for technical reporting.

**Independent Test**: Enable `sustainability-equivalents` and verify the PR comment contains the collapsible "Environmental Equivalents" section with calculated values.

**Acceptance Scenarios**:

1. **Given** `sustainability-equivalents: true`, **When** the comment is generated, **Then** it includes a collapsible section listing Trees, Miles Driven, and Home Electricity equivalents calculated from the total footprint.
2. **Given** `sustainability-equivalents: false`, **When** the comment is generated, **Then** this section is omitted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept a new input `include-sustainability` (boolean, default: false) to toggle the feature.
- **FR-002**: The system MUST accept a new input `utilization-rate` (float/string, default: "1.0") to adjust carbon calculations.
- **FR-003**: The system MUST accept a new input `sustainability-equivalents` (boolean, default: true) to toggle relatable metrics.
- **FR-004**: The system MUST extract `sustainability` data (gCO2e, carbon_footprint) from the `finfocus` JSON output.
- **FR-005**: The system MUST display a "Sustainability Impact" table in the PR comment if enabled, showing Total Carbon Footprint, Change vs Base, and Carbon Intensity.
- **FR-006**: The system MUST calculate and display environmental equivalents (Trees, Miles, Electricity) based on EPA formulas if `sustainability-equivalents` is true.
- **FR-007**: The system MUST display a "Resources by Carbon Impact" table, sorting resources by their CO2e emissions (highest first).
- **FR-008**: The system MUST set action outputs `total-carbon-footprint` (value) and `carbon-intensity` (value).
- **FR-009**: The system MUST support a `fail-on-carbon-increase` input (e.g., "10%" or absolute value) that fails the action if the carbon footprint increase exceeds the specified threshold.

### Key Entities

- **SustainabilityReport**: Represents the parsed carbon data, containing total emissions, intensity, and per-resource breakdowns.
- **EquivalencyMetrics**: Derived data representing relatable impacts (trees, miles).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: PR comments generated with sustainability enabled match the `finfocus` CLI output values for CO2e within expected precision.
- **SC-002**: Users can successfully override the default utilization rate via action configuration.
- **SC-003**: Equivalency calculations match standard EPA formulas (as defined in spec) within ±1% precision.
- **SC-004**: Action execution time does not increase by more than 2 seconds when parsing sustainability data.

## Assumptions

- **A-001**: `finfocus` binary installed in the environment supports the `--utilization` flag and returns sustainability JSON structure (v0.1.3+).
- **A-002**: EPA formulas provided in the description are sufficient for the initial implementation.
- **A-003**: "Carbon Intensity" is defined as gCO2e per USD (from description).