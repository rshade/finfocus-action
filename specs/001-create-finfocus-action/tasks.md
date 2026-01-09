# Tasks: Create finfocus-action GitHub Action

**Input**: Design documents from `/specs/001-create-finfocus-action/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/services.ts

**Tests**: Comprehensive test coverage is MANDATORY per the project Constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize repository with `package.json` and TypeScript 5.x in root
- [X] T002 [P] Configure `tsconfig.json` and `jest.config.js` in root
- [X] T003 [P] Create project folder structure (`src/`, `__tests__/`, `dist/`)
- [X] T004 Define `action.yml` with inputs and outputs in root
- [X] T005 [P] Setup linting (ESLint) and formatting (Prettier) tools in root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Implement core interfaces from `data-model.md` in `src/types.ts`
- [X] T007 [P] Implement `IInstaller` for binary management in `src/install.ts`
- [X] T008 [P] Implement `IPluginManager` for plugin installation in `src/plugins.ts`
- [X] T009 Implement unit tests for `IInstaller` in `__tests__/unit/install.test.ts` (including OS/Arch detection mapping)
- [X] T010 Implement unit tests for `IPluginManager` in `__tests__/unit/plugins.test.ts`
- [X] T011 [P] Setup GitHub Actions integration test workflow in `.github/workflows/test.yml`

**Checkpoint**: Foundation ready - binary and plugin management are functional.

---

## Phase 3: User Story 1 - PR Cost Visibility (Priority: P1) 🎯 MVP

**Goal**: Post a sticky comment with cost estimates to the PR.

**Independent Test**: Run action on a PR with a plan JSON and verify the comment with the hidden HTML marker appears.

### Tests for User Story 1

- [X] T012 [P] [US1] Unit tests for cost analysis logic in `__tests__/unit/analyze.test.ts`
- [X] T013 [P] [US1] Unit tests for comment upsert logic in `__tests__/unit/comment.test.ts`

### Implementation for User Story 1

- [X] T014 [US1] Implement `IAnalyzer.runAnalysis` CLI wrapper in `src/analyze.ts`
- [X] T015 [US1] Implement `ICommenter.upsertComment` using `@actions/github` in `src/comment.ts`
- [X] T016 [US1] Implement Markdown table formatter in `src/formatter.ts`
- [X] T017 [US1] Create main entry point `src/main.ts` to coordinate US1 flow
- [X] T018 [US1] Update `__tests__/integration/workflow.test.ts` for PR comment scenario

**Checkpoint**: User Story 1 is fully functional - Action can post and update PR comments.

---

## Phase 4: User Story 2 - Cost Guardrails (Priority: P2)

**Goal**: Fail build if cost increase exceeds a threshold.

**Independent Test**: Run action with `fail-on-cost-increase` and verify build failure/success based on diff.

### Tests for User Story 2

- [X] T019 [P] [US2] Unit tests for threshold parsing and comparison in `__tests__/unit/guardrails.test.ts`

### Implementation for User Story 2

- [X] T020 [US2] Implement `fail-on-cost-increase` parsing logic in `src/guardrails.ts`
- [X] T021 [US2] Integrate guardrail check into `src/main.ts`
- [X] T022 [US2] Implement `behavior-on-error` logic in `src/main.ts`
- [X] T023 [US2] Update `__tests__/integration/workflow.test.ts` for failure scenarios

**Checkpoint**: User Story 2 is functional - Action enforces cost guardrails.

---

## Phase 5: User Story 3 - Analyzer Integration (Priority: P3)

**Goal**: Configure environment for Pulumi Analyzer mode.

**Independent Test**: Verify `PulumiPolicy.yaml` and `PULUMI_POLICY_PACK_PATH` are set correctly.

### Tests for User Story 3

- [X] T024 [P] [US3] Unit tests for analyzer configuration in `__tests__/unit/analyzer-mode.test.ts`

### Implementation for User Story 3

- [X] T025 [US3] Implement `IAnalyzer.setupAnalyzerMode` in `src/analyze.ts`
- [X] T026 [US3] Integrate analyzer mode selection into `src/main.ts`
- [X] T027 [US3] Update `__tests__/integration/workflow.test.ts` for analyzer mode

**Checkpoint**: All user stories are functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T028 [P] Update `README.md` with full documentation and usage examples
- [ ] T029 [P] Update `ROADMAP.md` based on current implementation
- [ ] T030 Setup `@vercel/ncc` to compile `src/main.ts` into `dist/index.js`
- [X] T031 Final validation of all success criteria in `spec.md`
- [X] T032 Run `quickstart.md` validation on a fresh repository

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Core initialization, can start immediately.
- **Foundational (Phase 2)**: Depends on T001-T005. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion.
- **User Story 2 (Phase 4)**: Depends on US1 (for diff data) and Foundation.
- **User Story 3 (Phase 5)**: Depends on Foundation. Can run in parallel with US1/US2.
- **Polish (Phase 6)**: Depends on all stories.

### User Story Dependencies

- **US1**: Primary dependency for reporting.
- **US2**: Depends on US1's analysis output.
- **US3**: Largely independent of US1/US2 logic, only shares binary setup.

### Parallel Opportunities

- T002, T003, T005 in Setup.
- T007, T008 in Foundation.
- Unit tests (T012, T013, T019, T024) across different files.
- US3 can be implemented in parallel with US1/US2 by different team members.

---

## Parallel Example: Setup & Foundation

```bash
# Setup tasks:
Task: "Configure tsconfig.json and jest.config.js in root"
Task: "Create project folder structure (src/, __tests__/, dist/)"
Task: "Setup linting (ESLint) and formatting (Prettier) tools in root"

# Foundation tasks:
Task: "Implement IInstaller for binary management in src/install.ts"
Task: "Implement IPluginManager for plugin installation in src/plugins.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Implement User Story 1 (Comment Visibility).
3. Validate with integration tests in `.github/workflows/test.yml`.
4. This delivers the core value: cost visibility in PRs.

### Incremental Delivery

1. Add Guardrails (US2) to provide automated blocking of high-cost changes.
2. Add Analyzer Mode (US3) for advanced users requiring deep policy integration.
3. Polish documentation for final release.
