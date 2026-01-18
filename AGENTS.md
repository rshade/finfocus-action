# Agent Development Guide

This file guides AI agents working on the finfocus-action GitHub Action. This is a TypeScript-based project using ES modules and GitHub Actions toolkit.

## Build, Lint, and Test Commands

```bash
npm run build        # Build action into dist/
npm run lint         # Lint TypeScript files
npm run format       # Format with Prettier
npm test             # Run all tests
npm test -- __tests__/unit/analyze.test.ts  # Run single test
npm test -- --testNamePattern="pattern"     # Run matching tests
npm test -- --watch                         # Watch mode
npm test -- --coverage                      # With coverage
```

## Code Style Guidelines

### Imports & Modules

- Use ES module imports with `.js` extensions (NodeNext requirement)
- Namespace imports for external packages: `import * as core from '@actions/core'`
- Named imports for local modules: `import { Analyzer } from './analyze.js'`
- Group imports: external first, then local

### TypeScript Config

- Target: ES2022, Module: NodeNext, Strict: enabled
- Source files: `src/**/*.ts`, Test files: `__tests__/**/*.test.ts`

### Naming Conventions

- Classes: `PascalCase` (Analyzer, Commenter)
- Interfaces: `PascalCase` with `I` prefix (IAnalyzer, ICommenter)
- Functions/Variables: `camelCase` (runAnalysis, config)
- Files: kebab-case (analyze.ts, comment.ts)

### Formatting (Prettier)

- Semicolons: required, Trailing commas: all, Quotes: single
- Print width: 100, Tab width: 2, Indent: 2

### Type Definitions

- Use interfaces for contracts, export shared types from `src/types.ts`
- Avoid `any`, use precise types
- Explicit return types on exported functions

```typescript
export interface IAnalyzer {
  runAnalysis(planPath: string): Promise<FinfocusReport>;
}
```

### Error Handling

- Always use `try-catch` for async operations
- Check `error instanceof Error` before accessing properties
- Throw descriptive errors with context
- Use `core.setFailed()` for fatal errors in main flow

```typescript
try {
  const output = await exec.getExecOutput('command');
  if (output.exitCode !== 0) {
    throw new Error(`Failed: ${output.stderr}`);
  }
} catch (error) {
  if (error instanceof Error) core.setFailed(error.message);
}
```

### Testing

- Use Jest, mock deps with `jest.mock()`, group with `describe()`
- Use `beforeEach()` to reset mocks and create fresh instances
- Test both success and error paths

```typescript
describe('Analyzer', () => {
  let analyzer: Analyzer;
  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
  });
  it('should run analysis', async () => {
    /* test */
  });
});
```

### Class Structure

- Implement interfaces for service contracts
- Use private fields, prefer async/await
- Keep methods focused and single-purpose

### GitHub Actions Integration

- `@actions/core`: inputs, outputs, logging
- `@actions/github`: GitHub API
- `@actions/exec`: external commands
- `@actions/tool-cache`: downloading tools

### Logging

- `core.info()` for info, `core.warning()` for warnings
- `core.setFailed()` for fatal errors, `core.debug()` for debug

### File Organization

- `src/` - main code, `__tests__/unit/` - unit tests, `__tests__/integration/` - integration tests
- `dist/` - compiled output (generated)
- Keep components ~200 lines max

## Notes

- Run `npm run lint` and `npm test` before committing
- Maintain test coverage, avoid breaking interface changes

## Active Technologies
- Go (latest stable) + @actions/core, @actions/github, @actions/exec, finfocus CLI (001-cost-recommendations)
- N/A (no persistent storage required) (001-cost-recommendations)

## Recent Changes
- 001-cost-recommendations: Added Go (latest stable) + @actions/core, @actions/github, @actions/exec, finfocus CLI
