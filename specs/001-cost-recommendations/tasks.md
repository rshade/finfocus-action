# Tasks: Cost Optimization Recommendations

**Input**: Design documents from `/specs/001-cost-recommendations/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Comprehensive testing required per constitution - unit and integration tests included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `__tests__/` at repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize Go project with GitHub Actions dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Setup TypeScript interfaces for recommendations data
- [ ] T005 Configure finfocus CLI integration setup

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Display Cost Recommendations in PR Comments (Priority: P1) 🎯 MVP

**Goal**: Display cost optimization recommendations alongside existing cost estimates in PR comments

**Independent Test**: Run the GitHub Action with include-recommendations=true on a PR with infrastructure changes and verify that recommendations appear in the PR comment, providing actionable cost-saving insights

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US1] Unit test for recommendations parsing in **tests**/unit/analyze.test.ts
- [ ] T007 [P] [US1] Unit test for recommendations formatting in **tests**/unit/formatter.test.ts
- [ ] T008 [US1] Integration test for PR comment generation in **tests**/integration/

### Implementation for User Story 1

- [ ] T009 [P] [US1] Add RecommendationsReport interface in src/types.ts
- [ ] T010 [US1] Implement runRecommendations method in src/analyze.ts
- [ ] T011 [US1] Update main.ts to call recommendations when enabled
- [ ] T012 [US1] Update formatter.ts to add recommendations section to PR comment
- [ ] T013 [US1] Add total-savings and recommendation-count outputs

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Configure Recommendation Display (Priority: P2)

**Goal**: Provide configuration option to enable/disable cost optimization recommendations display

**Independent Test**: Set include-recommendations input to false and verify no recommendations are fetched/displayed, then set to true and verify they appear

### Tests for User Story 2 ⚠️

- [ ] T014 [P] [US2] Unit test for input validation in **tests**/unit/main.test.ts
- [ ] T015 [US2] Integration test for configuration behavior in **tests**/integration/

### Implementation for User Story 2

- [ ] T016 [US2] Add include-recommendations input parameter in main.ts
- [ ] T017 [US2] Implement conditional recommendations execution based on input

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T018 [P] Update README.md with new feature documentation
- [ ] T019 Code cleanup and ensure no TODOs or stubs
- [ ] T020 [P] Additional unit tests for edge cases in **tests**/unit/
- [ ] T021 Run quickstart.md validation
- [ ] T022 [P] Update package.json if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Interfaces before methods
- Core logic before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, user stories can start in parallel
- All tests for a user story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for recommendations parsing in __tests__/unit/analyze.test.ts"
Task: "Unit test for recommendations formatting in __tests__/unit/formatter.test.ts"
Task: "Integration test for PR comment generation in __tests__/integration/"
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
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
