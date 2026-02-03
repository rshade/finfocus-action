# Tasks: Guardrails Exit Code Refactor

**Input**: Design documents from `/specs/001-guardrails-exit-codes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Unit tests are included as this is a refactor with existing test coverage that needs
to be extended.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `__tests__/` at repository root
- TypeScript ES module project compiled by ncc to `dist/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new types and utility functions needed by all user stories

- [X] T001 [P] Add BudgetExitCode enum to src/types.ts
- [X] T002 [P] Add BudgetThresholdResult interface to src/types.ts
- [X] T003 Add getFinfocusVersion() helper to src/install.ts
- [X] T004 Add supportsExitCodes() helper to src/install.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core version detection infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Export getFinfocusVersion and supportsExitCodes from src/install.ts
- [X] T006 Add unit tests for getFinfocusVersion() in __tests__/unit/install.test.ts
- [X] T007 Add unit tests for supportsExitCodes() in __tests__/unit/install.test.ts

**Checkpoint**: Version detection ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Exit Code Threshold Check (Priority: P1) 🎯 MVP

**Goal**: CI pipeline fails with correct exit code interpretation when finfocus v0.2.5+ returns
non-zero exit codes for budget threshold breaches.

**Independent Test**: Run action with mocked finfocus returning exit codes 0-3 and verify correct
pass/fail behavior and messages.

### Tests for User Story 1

- [X] T008 [P] [US1] Add test for exit code 0 (pass) in __tests__/unit/guardrails.test.ts
- [X] T009 [P] [US1] Add test for exit code 1 (warning) in __tests__/unit/guardrails.test.ts
- [X] T010 [P] [US1] Add test for exit code 2 (critical) in __tests__/unit/guardrails.test.ts
- [X] T011 [P] [US1] Add test for exit code 3 (exceeded) in __tests__/unit/guardrails.test.ts
- [X] T012 [P] [US1] Add test for unexpected exit code (4+) in __tests__/unit/guardrails.test.ts
- [X] T013 [P] [US1] Add test for command execution failure (timeout/crash) in __tests__/unit/guardrails.test.ts

### Implementation for User Story 1

- [X] T014 [US1] Add checkBudgetThresholdWithExitCodes() function in src/guardrails.ts
- [X] T015 [US1] Implement exit code to BudgetThresholdResult mapping in src/guardrails.ts
- [X] T016 [US1] Add debug logging for exit codes in src/guardrails.ts

**Checkpoint**: Exit code checking works for finfocus v0.2.5+ - MVP complete

---

## Phase 4: User Story 2 - Backward Compatibility (Priority: P2)

**Goal**: Users with finfocus < v0.2.5 continue to have working threshold checks via JSON parsing
fallback.

**Independent Test**: Mock old finfocus version, verify JSON parsing fallback is used.

### Tests for User Story 2

- [X] T017 [P] [US2] Add test for version < 0.2.5 fallback in __tests__/unit/guardrails.test.ts
- [X] T018 [P] [US2] Add test for version detection failure fallback in __tests__/unit/guardrails.test.ts
- [X] T019 [P] [US2] Add test for version >= 0.2.5 uses exit codes in __tests__/unit/guardrails.test.ts
- [X] T020 [P] [US2] Add regression test verifying fail-on-cost-increase behavior unchanged in __tests__/unit/guardrails.test.ts

### Implementation for User Story 2

- [X] T021 [US2] Add checkBudgetThreshold() orchestrator function in src/guardrails.ts
- [X] T022 [US2] Implement version detection and routing logic in src/guardrails.ts
- [X] T023 [US2] Implement checkBudgetThresholdWithJson() fallback in src/guardrails.ts
- [X] T024 [US2] Add warning log when falling back to JSON parsing in src/guardrails.ts

**Checkpoint**: Both old and new finfocus versions work correctly

---

## Phase 5: User Story 3 - Clear Error Messages (Priority: P3)

**Goal**: Developers reviewing failed CI runs quickly understand the severity of budget breach.

**Independent Test**: Trigger each exit code and verify error messages are distinct and actionable.

### Tests for User Story 3

- [X] T025 [P] [US3] Add test for warning message content in __tests__/unit/guardrails.test.ts
- [X] T026 [P] [US3] Add test for critical message content in __tests__/unit/guardrails.test.ts
- [X] T027 [P] [US3] Add test for exceeded message content in __tests__/unit/guardrails.test.ts

### Implementation for User Story 3

- [X] T028 [US3] Define error message constants in src/guardrails.ts
- [X] T029 [US3] Update main.ts to use checkBudgetThreshold() in guardrails section
- [X] T030 [US3] Ensure error messages include exit code in debug mode in src/main.ts

**Checkpoint**: All user stories complete - error messages are clear and actionable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [X] T031 [P] Update README.md with exit code behavior documentation
- [X] T032 [P] Add inline JSDoc comments to new functions in src/guardrails.ts
- [X] T033 [P] Doc generation by technical writer for exit code feature (Constitution V)
- [X] T034 [P] Documentation review loop to verify accuracy and completeness (Constitution V)
- [X] T035 Run npm run build and verify dist/ is updated
- [X] T036 Run npm run lint and fix any issues
- [X] T037 Run npm test and verify all tests pass
- [X] T038 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 completion (orchestrator wraps US1 implementation)
- **User Story 3 (P3)**: Can start after US1 (messages are part of exit code handling)

### Within Each User Story

- Tests SHOULD be written and FAIL before implementation
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (different interfaces in same file)
- T008-T013 (US1 tests) can all run in parallel
- T017-T020 (US2 tests) can all run in parallel
- T025-T027 (US3 tests) can all run in parallel
- T031-T034 can run in parallel (different files/activities)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together:
Task: "Add test for exit code 0 (pass) in __tests__/unit/guardrails.test.ts"
Task: "Add test for exit code 1 (warning) in __tests__/unit/guardrails.test.ts"
Task: "Add test for exit code 2 (critical) in __tests__/unit/guardrails.test.ts"
Task: "Add test for exit code 3 (exceeded) in __tests__/unit/guardrails.test.ts"
Task: "Add test for unexpected exit code (4+) in __tests__/unit/guardrails.test.ts"
Task: "Add test for command execution failure (timeout/crash) in __tests__/unit/guardrails.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types and helpers)
2. Complete Phase 2: Foundational (version detection)
3. Complete Phase 3: User Story 1 (exit code checking)
4. **STOP and VALIDATE**: Test exit code handling independently
5. Deploy/demo if ready - action works with finfocus v0.2.5+

### Incremental Delivery

1. Complete Setup + Foundational → Types and version detection ready
2. Add User Story 1 → Test independently → Action works with new finfocus
3. Add User Story 2 → Test independently → Action works with ALL finfocus versions
4. Add User Story 3 → Test independently → Error messages are polished
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files or independent test cases
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing checkThreshold() and checkCarbonThreshold() functions remain unchanged
