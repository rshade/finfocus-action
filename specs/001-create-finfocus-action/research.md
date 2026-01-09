# Research & Decisions: Create finfocus-action

**Feature Branch**: `001-create-finfocus-action`
**Date**: 2026-01-08

## Architecture & Technology Decisions

### 1. Implementation Language: TypeScript
- **Decision**: Use TypeScript (Node.js 20) for the action's logic.
- **Rationale**: GitHub Actions runners have native support for Node.js. This allows for faster execution (no container startup) and easier cross-platform support (Linux/Mac/Win) compared to compiling Go binaries for every OS or using Docker. It aligns with the extensive `@actions/*` toolkit ecosystem.
- **Alternatives Considered**: 
  - **Go**: Would require pre-compiling binaries for all target platforms and committing them or downloading them at runtime, adding complexity.
  - **Docker**: Slower startup time and fails the "Composite Action" NFR-001 requirement for minimizing overhead.

### 2. Action Type: Composite Action
- **Decision**: Implement as a Composite Action wrapping TypeScript compiled to a single JS file (via `ncc` or `esbuild`).
- **Rationale**: Meets NFR-001. Allows combining shell steps (if needed) with robust JS logic.
- **Alternatives Considered**: 
  - **Docker Container Action**: Rejected due to latency and OS compatibility issues (no macOS/Windows support).

### 3. Binary Management
- **Decision**: Use `@actions/tool-cache` to download and cache `pulumicost`.
- **Rationale**: Standard practice for setup-actions. caching speeds up subsequent runs on self-hosted runners.
- **Pattern**: Download from `https://github.com/rshade/finfocus-action/releases/download/v${version}/pulumicost-v${version}-${os}-${arch}.tar.gz`.

## Open Questions Resolved
- **Release Artifact Pattern**: Confirmed as `pulumicost-v{version}-{os}-{arch}.tar.gz` in spec clarifications.
- **Comment Identification**: Confirmed using `<!-- pulumicost-action-comment -->` hidden marker.
