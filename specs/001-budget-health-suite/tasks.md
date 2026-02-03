# Tasks: Budget Health Suite Integration

**Input**: Design documents from `/specs/001-budget-health-suite/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per spec requirement (SC-006: 100% acceptance scenarios pass in automated tests)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure (Single project - GitHub Action):

- Source: `src/`
- Tests: `__tests__/unit/`, `__tests__/integration/`
- Config: `action.yml`, `package.json`
- Docs: `README.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and interface extensions needed by all user stories

- [x] T001 Add BudgetHealthStatus type to src/types.ts
- [x] T002 Add BudgetHealthReport interface extending BudgetStatus to src/types.ts
- [x] T003 Add FinfocusBudgetStatusResponse interface to src/types.ts
- [x] T004 Extend ActionConfiguration with budgetAlertThreshold, failOnBudgetHealth, showBudgetForecast in src/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core CLI integration and version detection that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Add runBudgetStatus() method skeleton to Analyzer class in src/analyze.ts
- [x] T006 Implement parseBudgetStatusResponse() helper in src/analyze.ts
- [x] T007 Implement calculateBudgetHealthFallback() for finfocus < 0.2.5 in src/analyze.ts
- [x] T008 Add computeHealthStatus() helper function to determine healthy/warning/critical/exceeded in src/analyze.ts
- [x] T009 [P] Add new inputs (budget-alert-threshold, fail-on-budget-health, show-budget-forecast) to action.yml
- [x] T010 [P] Add new outputs (budget-health-score, budget-forecast, budget-runway-days, budget-status) to action.yml
- [x] T011 [P] Add environment variable mappings for new inputs in action.yml runs section
- [x] T012 Parse new inputs in main.ts and add to config object

**Checkpoint**: Foundation ready - CLI integration available, user story implementation can begin

---

## Phase 3: User Story 1 - View Budget Health in PR Comments (Priority: P1)

**Goal**: Display comprehensive budget health metrics (score, forecast, runway) in PR comments

**Independent Test**: Run action with `budget-amount` configured and verify PR comment contains Budget Health section with health score, forecast, and runway days

### Tests for User Story 1

- [x] T013 [P] [US1] Create unit test file __tests__/unit/budget-health.test.ts
- [x] T014 [P] [US1] Add test: health score calculation returns 0-100 range in __tests__/unit/budget-health.test.ts
- [x] T015 [P] [US1] Add test: status classification at boundaries (49/50, 79/80) in __tests__/unit/budget-health.test.ts
- [x] T016 [P] [US1] Add test: exceeded status when spent > budget in __tests__/unit/budget-health.test.ts
- [x] T017 [P] [US1] Add test: fallback calculation for finfocus < 0.2.5 in __tests__/unit/budget-health.test.ts
- [x] T017a [P] [US1] Add test: invalid JSON response returns undefined and logs warning in __tests__/unit/budget-health.test.ts
- [x] T017b [P] [US1] Add test: zero/negative budget-amount skips budget health features in __tests__/unit/budget-health.test.ts
- [x] T018 [P] [US1] Add formatter test for Budget Health section rendering with visual indicators (FR-010) in __tests__/unit/formatter.test.ts

### Implementation for User Story 1

- [x] T019 [US1] Complete runBudgetStatus() implementation with CLI invocation in src/analyze.ts
- [x] T020 [US1] Add formatBudgetHealthSection() function to src/formatter.ts
- [x] T021 [US1] Add status icon mapping (healthy/warning/critical/exceeded) in src/formatter.ts
- [x] T022 [US1] Update formatCommentBody() to use formatBudgetHealthSection() when BudgetHealthReport available in src/formatter.ts
- [x] T023 [US1] Add budget health orchestration to main.ts (call runBudgetStatus, pass to commenter)
- [x] T024 [US1] Add debug logging for budget health analysis in main.ts

**Checkpoint**: User Story 1 complete - PR comments show full budget health metrics

---

## Phase 4: User Story 2 - Fail Builds on Poor Budget Health (Priority: P2)

**Goal**: Automatically fail CI builds when budget health score drops below configured threshold

**Independent Test**: Configure `fail-on-budget-health: 50`, run with health score of 45, verify action fails

### Tests for User Story 2

- [x] T025 [P] [US2] Add test: checkBudgetHealthThreshold returns passed=true when no threshold set in __tests__/unit/guardrails.test.ts
- [x] T026 [P] [US2] Add test: checkBudgetHealthThreshold returns passed=false when score below threshold in __tests__/unit/guardrails.test.ts
- [x] T027 [P] [US2] Add test: checkBudgetHealthThreshold returns passed=true when score meets threshold in __tests__/unit/guardrails.test.ts

### Implementation for User Story 2

- [x] T028 [US2] Add checkBudgetHealthThreshold() function to src/guardrails.ts
- [x] T029 [US2] Integrate health threshold check in main.ts after budget health analysis
- [x] T030 [US2] Add descriptive error message when health threshold breached in main.ts

**Checkpoint**: User Story 2 complete - action fails when health score below threshold

---

## Phase 5: User Story 3 - Access Budget Metrics in Downstream Jobs (Priority: P2)

**Goal**: Expose budget health metrics as action outputs for downstream workflow consumption

**Independent Test**: Verify action sets all four outputs, downstream step can read budget-health-score value

### Tests for User Story 3

- [x] T031 [P] [US3] Add integration test: outputs populated when budget configured in __tests__/integration/budget-health.test.ts
- [x] T032 [P] [US3] Add integration test: outputs empty when budget not configured in __tests__/integration/budget-health.test.ts

### Implementation for User Story 3

- [x] T033 [US3] Add core.setOutput calls for budget-health-score in main.ts
- [x] T034 [US3] Add core.setOutput calls for budget-forecast in main.ts
- [x] T035 [US3] Add core.setOutput calls for budget-runway-days in main.ts
- [x] T036 [US3] Add core.setOutput calls for budget-status in main.ts
- [x] T037 [US3] Handle empty string outputs when budget not configured in main.ts

**Checkpoint**: User Story 3 complete - all outputs accessible to downstream jobs

---

## Phase 6: User Story 4 - Configure Budget Alert Thresholds (Priority: P3)

**Goal**: Allow customization of alert threshold percentage for organization-specific risk tolerance

**Independent Test**: Set `budget-alert-threshold: 70`, verify alert shows when usage exceeds 70%

### Tests for User Story 4

- [x] T038 [P] [US4] Add test: alert shown when percentUsed > alertThreshold in __tests__/unit/formatter.test.ts
- [x] T039 [P] [US4] Add test: no alert when percentUsed <= alertThreshold in __tests__/unit/formatter.test.ts

### Implementation for User Story 4

- [x] T040 [US4] Add alert threshold logic to formatBudgetHealthSection() in src/formatter.ts
- [x] T041 [US4] Display warning alert in TUI box when threshold exceeded in src/formatter.ts

**Checkpoint**: User Story 4 complete - customizable alert thresholds working

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [x] T042 [P] Update README.md with Budget Health section documenting new inputs/outputs
- [x] T043 [P] Add usage examples for budget health features to README.md
- [x] T044 [P] Doc generation by technical writer (Constitution Principle V)
- [x] T045 [P] Documentation review loop - verify Standard Config and Analyzer Mode sections updated (Constitution Principle V)
- [x] T046 Run npm run lint and fix any issues
- [x] T047 Run npm test and verify all tests pass
- [x] T048 Run npm run build and verify dist/index.js updated
- [x] T049 Run quickstart.md validation - manual verification of implementation steps
- [x] T050 Verify backward compatibility with finfocus < 0.2.5 (graceful degradation)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Can proceed first
  - US2 (P2): Can proceed after US1 or in parallel
  - US3 (P2): Can proceed after US1 or in parallel
  - US4 (P3): Can proceed after US1 or in parallel
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Required first - provides core budget health display
- **User Story 2 (P2)**: Independent - only needs foundational + types
- **User Story 3 (P2)**: Independent - only needs foundational + types
- **User Story 4 (P3)**: Independent - only needs foundational + formatter from US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/types before services
- Services before orchestration (main.ts)
- Formatter before main.ts integration

### Parallel Opportunities

**Phase 1 (Setup)**: T001-T004 are sequential (all modify src/types.ts)

**Phase 2 (Foundational)**: T009, T010, T011 can run in parallel (action.yml sections)

**Phase 3 (US1)**: T013-T018 tests can run in parallel (different test files/sections), including edge case tests T017a, T017b

**Phase 4 (US2)**: T025-T027 tests can run in parallel

**Phase 5 (US3)**: T031-T032 tests can run in parallel

**Phase 6 (US4)**: T038-T039 tests can run in parallel

**Phase 7 (Polish)**: T042-T045 can run in parallel (different files)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 tests together:
Task: "Create unit test file __tests__/unit/budget-health.test.ts"
Task: "Add test: health score calculation returns 0-100 range"
Task: "Add test: status classification at boundaries (49/50, 79/80)"
Task: "Add test: exceeded status when spent > budget"
Task: "Add test: fallback calculation for finfocus < 0.2.5"
Task: "Add test: invalid JSON response handling (edge case)"
Task: "Add test: zero/negative budget-amount handling (edge case)"
Task: "Add formatter test for Budget Health section with visual indicators"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T012)
3. Complete Phase 3: User Story 1 (T013-T024)
4. **STOP and VALIDATE**: Test budget health display in PR comments
5. Deploy/demo if ready - users can see budget health metrics

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP: budget health display)
3. Add User Story 2 → Test independently → Deploy (adds: fail on poor health)
4. Add User Story 3 → Test independently → Deploy (adds: action outputs)
5. Add User Story 4 → Test independently → Deploy (adds: custom alert thresholds)
6. Polish phase → Final release

### Parallel Team Strategy

With multiple developers after Foundational:

- Developer A: User Story 1 (core display)
- Developer B: User Story 2 (guardrails) + User Story 3 (outputs)
- Developer C: User Story 4 (thresholds) + Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Backward compatibility: finfocus < 0.2.5 must work with graceful degradation
