# Tasks: Sustainability Metrics (GreenOps)

**Input**: Design documents from `/specs/001-sustainability-metrics/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as OPTIONAL tasks where appropriate for unit logic verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Verify `pulumicost` binary in environment supports sustainability (manual verification or check docs)
- [x] T002 Update `action.yml` with new inputs (`include-sustainability`, `utilization-rate`, `sustainability-equivalents`, `fail-on-carbon-increase`) and outputs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Update `src/types.ts` with `SustainabilityMetrics`, `SustainabilityReport`, and `EquivalencyMetrics` interfaces
- [x] T004 Update `src/types.ts` `ActionConfiguration` interface to include new inputs
- [x] T005 Update `src/types.ts` `PulumicostResource` interface to include `sustainability` field

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Infrastructure Carbon Impact (Priority: P1) 🎯 MVP

**Goal**: Extract and display carbon footprint data in PR comments

**Independent Test**: Run action with `include-sustainability: true` and verify "Sustainability Impact" section appears in PR comment.

### Tests for User Story 1 (OPTIONAL) ⚠️

- [x] T006 [P] [US1] Create unit test for sustainability data parsing in `__tests__/unit/analyze.test.ts`
- [x] T007 [P] [US1] Create unit test for basic sustainability formatting in `__tests__/unit/formatter.test.ts`

### Implementation for User Story 1

- [x] T008 [P] [US1] Update `src/main.ts` to parse `include-sustainability` input and pass to config
- [x] T009 [US1] Update `src/analyze.ts` `runAnalysis` to request sustainability data (ensure `pulumicost` cmd args are correct if needed, or just parse output)
- [x] T010 [US1] Implement helper to extract/sum sustainability metrics in `src/analyze.ts` (or `src/utils.ts`)
- [x] T011 [US1] Implement `formatSustainabilitySection` in `src/formatter.ts` to generate the markdown table (including "Resources by Carbon Impact" table per FR-007)
- [x] T012 [US1] Update `src/comment.ts` to append the sustainability section to the PR comment if enabled
- [x] T012a [P] [US1] Verify action execution time does not increase by >2s (SC-004) via manual run or benchmark test

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Configure Sustainability Assumptions (Priority: P2)

**Goal**: Allow users to adjust utilization rates for more accurate estimates

**Independent Test**: Verify `pulumicost` command receives `--utilization` flag when configured.

### Tests for User Story 2 (OPTIONAL) ⚠️

- [x] T013 [P] [US2] Add test case for utilization flag passing in `__tests__/unit/analyze.test.ts`

### Implementation for User Story 2

- [x] T014 [P] [US2] Update `src/main.ts` to parse `utilization-rate` input
- [x] T015 [US2] Update `src/analyze.ts` to pass `--utilization` flag to `pulumicost` CLI command based on config

**Checkpoint**: User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - View Environmental Equivalents (Priority: P3)

**Goal**: Display relatable metrics (trees, miles) in a collapsible section

**Independent Test**: Verify collapsible "Environmental Equivalents" section appears in PR comment.

### Tests for User Story 3 (OPTIONAL) ⚠️

- [x] T016 [P] [US3] Create unit test for equivalency formulas in `__tests__/unit/formatter.test.ts`

### Implementation for User Story 3

- [x] T017 [P] [US3] Update `src/main.ts` to parse `sustainability-equivalents` input
- [x] T018 [US3] Implement equivalency calculation logic (Trees, Miles, Electricity) in `src/formatter.ts` (or `src/sustainability.ts`)
- [x] T019 [US3] Update `src/formatter.ts` `formatSustainabilitySection` to include the collapsible equivalents section

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Requirement FR-009 - Fail on Carbon Increase

**Goal**: Fail the build if carbon footprint increases beyond a threshold

**Independent Test**: Configure `fail-on-carbon-increase` and verify action fails on violation.

### Tests for FR-009 (OPTIONAL) ⚠️

- [x] T020 [P] [FR-009] Create unit test for carbon threshold logic in `__tests__/unit/guardrails.test.ts`

### Implementation for FR-009

- [x] T021 [P] [FR-009] Update `src/main.ts` to parse `fail-on-carbon-increase` input
- [x] T022 [FR-009] Implement `checkCarbonThreshold` function in `src/guardrails.ts`
- [x] T023 [FR-009] Integrate threshold check into `src/main.ts` workflow logic

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements, documentation, and compliance

- [x] T024 [P] Documentation updates in `README.md` (inputs, examples)
- [x] T025 [P] Doc generation by technical writer (Constitution Principle V)
- [x] T026 [P] Documentation review loop (Constitution Principle V)
- [x] T027 Code cleanup and refactoring (e.g., ensure no "TODOs" left)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all stories
- **User Story 1 (P1)**: Depends on Foundational
- **User Story 2 (P2)**: Depends on Foundational
- **User Story 3 (P3)**: Depends on Foundational
- **FR-009**: Depends on Foundational (and practically US1 for data extraction)

### Parallel Opportunities

- T006, T007, T008, T010, T011 can run in parallel after Foundational
- T013, T014, T015 can run in parallel with US1 tasks
- T016, T017, T018 can run in parallel with US1/US2 tasks

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 & 2
2. Implement US1 (Parsing & Display)
3. Validate basic reporting works

### Incremental Delivery

1. Add US2 (Utilization) -> Deploy
2. Add US3 (Equivalents) -> Deploy
3. Add FR-009 (Thresholds) -> Deploy
