# Tasks: Add Historical Cost Tracking

**Input**: Design documents from `/specs/001-add-actual-costs/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Unit and integration tests included per constitution testing standards requirement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `__tests__/` at repository root
- Paths shown below assume GitHub Action structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature initialization and basic structure updates

- [x] T001 Update action.yml with new inputs and outputs for actual costs
- [x] T002 Update src/types.ts with ActualCostReport and ActualCostItem interfaces

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure updates that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add actual costs configuration parsing in src/main.ts
- [x] T004 Implement runActualCosts method in src/analyze.ts with CLI command execution
- [x] T005 Add actual cost report handling in src/comment.ts
- [x] T006 Update PR comment formatting in src/formatter.ts for actual cost display

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Enable Actual Cost Display (Priority: P1) 🎯 MVP

**Goal**: Allow users to enable actual cost tracking and see cost data in PR comments alongside projected costs.

**Independent Test**: Configure action with include-actual-costs=true, run workflow, verify PR comment includes actual costs section when data available.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US1] Unit test for runActualCosts method in **tests**/unit/actual_costs.test.ts
- [x] T008 [P] [US1] Unit test for actual cost comment formatting in **tests**/unit/formatter.test.ts
- [x] T009 [P] [US1] Integration test for finfocus CLI command execution in **tests**/integration/actual_costs_integration.test.ts

### Implementation for User Story 1

- [x] T010 [US1] Add actual cost orchestration in src/main.ts (depends on T003-T006)
- [x] T011 [US1] Add actual cost period date range parsing in src/analyze.ts
- [x] T012 [US1] Add graceful error handling for unavailable actual cost data
- [x] T013 [US1] Update action output setting for actual-total-cost and actual-cost-period

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Configure Cost Period (Priority: P2)

**Goal**: Allow users to configure time periods for actual costs (7d, 30d, mtd, custom dates) with proper validation.

**Independent Test**: Set different period values and verify correct date ranges are used in CLI commands and displayed in PR comments.

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Unit test for date period parsing and validation in **tests**/unit/actual_costs.test.ts
- [x] T015 [P] [US2] Unit test for invalid period error handling
- [x] T016 [P] [US2] Integration test for error handling when actual costs unavailable in **tests**/integration/error_handling.test.ts

### Implementation for User Story 2

- [x] T017 [US2] Implement period format validation (7d, 30d, mtd, YYYY-MM-DD) in src/analyze.ts
- [x] T018 [US2] Add date range calculation logic for all supported periods
- [x] T019 [US2] Add error messages for invalid date formats and future dates
- [x] T020 [US2] Update CLI command construction to use calculated date ranges
- [x] T021 [US2] Implement actual-costs-group-by parameter handling in src/analyze.ts
- [x] T022 [US2] Add group-by validation and CLI argument construction

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - State-Based Cost Estimation (Priority: P3)

**Goal**: Support Pulumi state file input for actual cost estimation when billing data is unavailable.

**Independent Test**: Provide state file path and verify finfocus receives correct --pulumi-state parameter and uses state-based estimation.

### Tests for User Story 3 ⚠️

- [x] T023 [P] [US3] Unit test for state file parameter handling in **tests**/unit/actual_costs.test.ts
- [x] T024 [P] [US3] Unit test for plan vs state file priority logic

### Implementation for User Story 3

- [x] T025 [US3] Add state file validation and existence checking in src/analyze.ts
- [x] T026 [US3] Implement state vs plan file priority logic in CLI command construction
- [x] T027 [US3] Update input parsing to handle pulumi-state-json parameter
- [x] T028 [US3] Add state-based cost estimation documentation in comments

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T029 [P] Add comprehensive error handling documentation in comments
- [x] T030 Update README.md with actual costs usage examples and configuration
- [x] T031 Run lint and format checks on all modified files
- [x] T032 Execute full test suite to ensure no regressions
- [x] T033 Validate actual costs integration with existing cost analysis workflow
- [x] T034 [P] Integration test for actual costs workflow end-to-end in **tests**/integration/workflow_actual_costs.test.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Builds on US1/US2 but independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Core functionality before validation/enhancements
- Error handling before optimization
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for runActualCosts method in __tests__/unit/actual_costs.test.ts"
Task: "Unit test for actual cost comment formatting in __tests__/unit/formatter.test.ts"
Task: "Integration test for finfocus CLI command execution in __tests__/integration/actual_costs_integration.test.ts"

# Launch implementation tasks sequentially (dependencies):
Task: "Add actual cost orchestration in src/main.ts"
Task: "Add actual cost period date range parsing in src/analyze.ts"
Task: "Add graceful error handling for unavailable actual cost data"
Task: "Update action output setting for actual-total-cost and actual-cost-period"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (core functionality)
   - Developer B: User Story 2 (period configuration)
   - Developer C: User Story 3 (state-based estimation)
3. Stories complete and integrate independently
