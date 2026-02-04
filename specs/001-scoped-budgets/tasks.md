# Tasks: Scoped Budgets (Per-Provider, Per-Type, Per-Tag)

**Input**: Design documents from `/specs/001-scoped-budgets/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/finfocus-cli.md, quickstart.md

**Tests**: Included per Constitution Principle II (Testing Standards)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Source**: `src/` at repository root
- **Tests**: `__tests__/unit/` and `__tests__/integration/`
- **Action manifest**: `action.yml` at repository root

---

## Phase 1: Setup

**Purpose**: Action manifest updates and type definitions

- [X] T001 [P] Add `budget-scopes` input to action.yml with description and default empty string
- [X] T002 [P] Add `fail-on-budget-scope-breach` input to action.yml with default `false`
- [X] T003 [P] Add `budget-scopes-status` output to action.yml with description
- [X] T004 Add `BudgetScopeType` type union (`'provider' | 'type' | 'tag'`) in src/types.ts
- [X] T005 Add `BudgetScope` interface in src/types.ts per data-model.md
- [X] T006 Add `ScopedBudgetStatus` interface in src/types.ts per data-model.md
- [X] T007 Add `ScopedBudgetAlert` interface in src/types.ts per data-model.md
- [X] T008 Add `ScopedBudgetReport` interface in src/types.ts per data-model.md
- [X] T009 Add `ScopedBudgetFailure` interface in src/types.ts per data-model.md
- [X] T010 Add `FinfocusScopedBudgetResponse` and `FinfocusScopeEntry` interfaces in src/types.ts per data-model.md
- [X] T011 Extend `ActionConfiguration` interface with `budgetScopes: string` and `failOnBudgetScopeBreach: boolean` in src/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core parsing and config generation infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T012 Implement `parseBudgetScopes(input: string): BudgetScope[]` function in src/config.ts with validation per FR-001, FR-002, FR-007
- [X] T013 Implement scope format validation regex `^(provider|type|tag)/[a-zA-Z0-9_:-]+$` in src/config.ts
- [X] T014 Add soft limit warning (>20 scopes) in `parseBudgetScopes()` per SC-001 in src/config.ts
- [X] T015 Extend `generateYaml()` to include `budget.scopes` section when scopes configured in src/config.ts per FR-003
- [X] T016 Add version check function `requiresScopedBudgetVersion(scopes: BudgetScope[]): void` in src/install.ts per FR-011
- [X] T017 Parse `budget-scopes` and `fail-on-budget-scope-breach` inputs in src/main.ts and add to config object
- [X] T018 [P] Create unit test file __tests__/unit/scoped-budgets.test.ts with test setup and mocks
- [X] T019 Add unit tests for `parseBudgetScopes()` - valid provider, type, tag formats in __tests__/unit/scoped-budgets.test.ts
- [X] T020 Add unit tests for `parseBudgetScopes()` - invalid formats logged and skipped in __tests__/unit/scoped-budgets.test.ts
- [X] T021 Add unit tests for `parseBudgetScopes()` - empty input returns empty array in __tests__/unit/scoped-budgets.test.ts
- [X] T022 Add unit tests for `parseBudgetScopes()` - tag with colons (tag/env:prod) parsed correctly per SC-004 in __tests__/unit/scoped-budgets.test.ts
- [X] T023 Add unit tests for `generateYaml()` with scopes section in __tests__/unit/scoped-budgets.test.ts
- [X] T024 Add unit tests for soft limit warning at >20 scopes in __tests__/unit/scoped-budgets.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Define Provider-Specific Budgets (Priority: P1) MVP

**Goal**: Enable users to set separate budget limits for each cloud provider (AWS, GCP, Azure) and see them in PR comments

**Independent Test**: Configure `budget-scopes: "provider/aws: 500\nprovider/gcp: 300"` and verify PR comment shows Budget Status by Scope table with AWS and GCP entries

### Tests for User Story 1

- [X] T025 [P] [US1] Add unit test for `parseScopedBudgetResponse()` with provider scopes in __tests__/unit/scoped-budgets.test.ts
- [X] T026 [P] [US1] Add unit test for `formatScopedBudgetSection()` with provider scopes in __tests__/unit/scoped-budget-format.test.ts
- [X] T027 [P] [US1] Add unit test for status indicators (healthy/warning) based on percentUsed in __tests__/unit/scoped-budget-format.test.ts

### Implementation for User Story 1

- [X] T028 [US1] Implement `parseScopedBudgetResponse(stdout: string): ScopedBudgetReport` in src/analyze.ts handling wrapped/unwrapped JSON per contracts/finfocus-cli.md
- [X] T029 [US1] Implement `runScopedBudgetStatus(config: ActionConfiguration): Promise<ScopedBudgetReport | undefined>` in src/analyze.ts
- [X] T030 [P] [US1] Create __tests__/unit/scoped-budget-format.test.ts with test setup and mocks
- [X] T031 [US1] Implement `formatScopedBudgetSection(report: ScopedBudgetReport, currency: string): string` in src/formatter.ts per FR-004, FR-006
- [X] T032 [US1] Add status indicator helper `getScopeStatusIcon(status: BudgetHealthStatus): string` in src/formatter.ts returning visual indicators (green/yellow/red/stop)
- [X] T033 [US1] Integrate scoped budget section into PR comment in src/main.ts after existing budget health section
- [X] T034 [US1] Add `core.setOutput('budget-scopes-status', ...)` in src/main.ts per FR-005

**Checkpoint**: User Story 1 complete - provider budgets display in PR comments

---

## Phase 4: User Story 2 - Define Resource Type Budgets (Priority: P2)

**Goal**: Enable users to set budgets by resource type (compute, storage, networking) with breach enforcement

**Independent Test**: Configure `budget-scopes: "type/compute: 200\ntype/storage: 100"` with `fail-on-budget-scope-breach: true` and verify action fails when compute exceeds limit

### Tests for User Story 2

- [X] T035 [P] [US2] Add unit test for `checkScopedBudgetBreach()` - no breach returns pass in __tests__/unit/scoped-budget-guardrails.test.ts
- [X] T036 [P] [US2] Add unit test for `checkScopedBudgetBreach()` - breach detected fails action in __tests__/unit/scoped-budget-guardrails.test.ts
- [X] T037 [P] [US2] Add unit test for `checkScopedBudgetBreach()` - disabled returns pass in __tests__/unit/scoped-budget-guardrails.test.ts

### Implementation for User Story 2

- [X] T038 [P] [US2] Create __tests__/unit/scoped-budget-guardrails.test.ts with test setup and mocks
- [X] T039 [US2] Implement `checkScopedBudgetBreach(report: ScopedBudgetReport, failOnBreach: boolean): void` in src/guardrails.ts per FR-009
- [X] T040 [US2] Add breach check call in src/main.ts after scoped budget status retrieval
- [X] T041 [US2] Add unit test for type scopes in `parseBudgetScopes()` in __tests__/unit/scoped-budgets.test.ts
- [X] T042 [US2] Add unit test for `formatScopedBudgetSection()` with type scopes in __tests__/unit/scoped-budget-format.test.ts

**Checkpoint**: User Story 2 complete - type budgets with breach enforcement working

---

## Phase 5: User Story 3 - Define Tag-Based Budgets (Priority: P2)

**Goal**: Enable users to set budgets by cost allocation tags (env:prod, team:platform)

**Independent Test**: Configure `budget-scopes: "tag/env:prod: 1000\ntag/team:platform: 500"` and verify PR comment shows tag budgets with readable labels

### Tests for User Story 3

- [X] T043 [P] [US3] Add unit test for tag scope edge cases (multiple colons like `tag/k8s:app:nginx`, special chars) in __tests__/unit/scoped-budgets.test.ts
- [X] T044 [P] [US3] Add unit test for `formatScopedBudgetSection()` with tag scopes in __tests__/unit/scoped-budget-format.test.ts

### Implementation for User Story 3

- [X] T045 [US3] Verify tag parsing handles colons correctly (split on first colon after scope prefix) in src/config.ts
- [X] T046 [US3] Add display formatting for tag scopes in `formatScopedBudgetSection()` in src/formatter.ts
- [X] T047 [US3] Add integration test for tag-based budgets in __tests__/integration/scoped-budgets.test.ts

**Checkpoint**: User Story 3 complete - tag budgets with proper display formatting working

---

## Phase 6: User Story 4 - Combined Scope Budget Report (Priority: P3)

**Goal**: Display all budget scopes in a single consolidated table sorted by percentage used (highest first)

**Independent Test**: Configure multiple scope types (provider, type, tag) and verify single table displays all scopes sorted by percent used descending

### Tests for User Story 4

- [X] T048 [P] [US4] Add unit test for sorting scopes by percentUsed descending in __tests__/unit/scoped-budget-format.test.ts
- [X] T049 [P] [US4] Add unit test for combined table with all scope types in __tests__/unit/scoped-budget-format.test.ts

### Implementation for User Story 4

- [X] T050 [US4] Add sorting logic in `formatScopedBudgetSection()` - sort by percentUsed descending in src/formatter.ts
- [X] T051 [US4] Add integration test for combined scopes display in __tests__/integration/scoped-budgets.test.ts
- [X] T051a [US4] Add integration test for scoped budgets alongside global budget inputs (budget-amount, budget-currency, budget-period) per FR-010 in __tests__/integration/scoped-budgets.test.ts

**Checkpoint**: User Story 4 complete - consolidated table with all scope types sorted correctly

---

## Phase 7: Edge Cases & Error Handling

**Purpose**: Handle error cases per spec clarifications and FR-011, FR-012

- [X] T052 Add version check integration in src/main.ts - fail if scopes configured but CLI < v0.2.6 per FR-011
- [X] T053 Implement partial failure handling in `parseScopedBudgetResponse()` - extract errors array per FR-012 in src/analyze.ts
- [X] T054 Add `core.warning()` for failed scopes in src/main.ts per FR-012
- [X] T055 Add breach evaluation logic to exclude failed scopes per FR-009 in src/guardrails.ts
- [X] T056 Add unit test for version check failure in __tests__/unit/scoped-budgets.test.ts
- [X] T057 Add unit test for partial failure handling in __tests__/unit/scoped-budgets.test.ts
- [X] T058 Add unit test for breach evaluation with partial failures in __tests__/unit/scoped-budget-guardrails.test.ts
- [X] T059 Add unit test for "No resources found" display ($0.00 spent) in __tests__/unit/scoped-budget-format.test.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [X] T060 [P] Update README.md with Scoped Budgets section per Constitution Principle V
- [X] T061 [P] Add scoped budget examples to README.md matching quickstart.md patterns
- [X] T062 [P] Update action.yml descriptions with examples for budget-scopes input
- [X] T063 Run `npm run lint` and fix any linting errors
- [X] T064 Run `npm run build` and verify dist/ is updated
- [X] T065 Run `npm test` and verify all tests pass
- [ ] T066 Run quickstart.md validation - manually verify examples work
- [X] T067 [P] Doc generation by technical writer (Constitution Principle V)
- [ ] T068 [P] Documentation review loop (Constitution Principle V)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Provider budgets - can start after Foundational
  - US2 (P2): Type budgets with breach - depends on US1 formatter infrastructure
  - US3 (P2): Tag budgets - can start after Foundational (parallel with US2)
  - US4 (P3): Combined report - depends on all scope types being implemented
- **Edge Cases (Phase 7)**: Depends on core implementation (Phases 3-6)
- **Polish (Phase 8)**: Depends on all functionality being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only - establishes core display infrastructure
- **User Story 2 (P2)**: Uses formatter from US1, adds guardrails
- **User Story 3 (P2)**: Uses formatter from US1, focuses on tag parsing
- **User Story 4 (P3)**: Uses all scope types, adds sorting

### Within Each Phase

- Tests written FIRST, must FAIL before implementation
- Types before functions
- Parsing before formatting
- Core implementation before integration
- Unit tests before integration tests

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T003)
- Types definitions (T004-T011) can be done in parallel once dependencies are met
- All test file creations marked [P] can run in parallel (T018, T030, T038)
- US2 and US3 can be developed in parallel after US1 completes
- All Polish documentation tasks marked [P] can run in parallel

---

## Parallel Example: Setup Phase

```bash
# Launch all action.yml updates together:
Task: "Add budget-scopes input to action.yml"
Task: "Add fail-on-budget-scope-breach input to action.yml"
Task: "Add budget-scopes-status output to action.yml"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 tests together:
Task: "Add unit test for parseScopedBudgetResponse() with provider scopes"
Task: "Add unit test for formatScopedBudgetSection() with provider scopes"
Task: "Add unit test for status indicators based on percentUsed"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T011)
2. Complete Phase 2: Foundational (T012-T024)
3. Complete Phase 3: User Story 1 (T025-T034)
4. **STOP and VALIDATE**: Test provider budgets independently
5. Can deploy MVP with provider-only scopes

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add US1 (Provider budgets) -> Test -> Deploy (MVP!)
3. Add US2 (Type budgets + breach) -> Test -> Deploy
4. Add US3 (Tag budgets) -> Test -> Deploy
5. Add US4 (Combined sorting) -> Test -> Deploy
6. Edge cases + Polish -> Final release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + User Story 4
   - Developer B: User Story 2 + Edge Cases
   - Developer C: User Story 3 + Polish
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- finfocus CLI v0.2.6+ is required - version check is critical
