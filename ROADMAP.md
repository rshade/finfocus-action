# Roadmap: finfocus-action

## ✅ Phase 1: Foundation (Completed)
- GitHub Action scaffolding with TypeScript.
- Cross-platform binary installation logic.
- PR commenting engine with sticky comments.
- Basic cost guardrails (threshold enforcement).
- Pulumi Analyzer integration mode.

## 🚀 Phase 2: Enhanced Analysis
- **Diffing Baseline**: Support comparing against a specific baseline file instead of just the "preview" state.
- **Multiple Currencies**: Enhanced support for non-USD currencies and exchange rate conversion.
- **Detailed Resource Breakdown**: Include a breakdown of the most expensive resource changes in the PR comment.

## 🛠 Phase 3: Developer Experience
- **Action UI**: Leverage GitHub Actions Job Summaries for more rich visualization.
- **Custom Templates**: Allow users to provide their own Handlebars/Liquid templates for PR comments.
- **Caching**: Enhanced caching of plugins and binaries to further reduce execution time.

## 🛡 Phase 4: Enterprise Features
- **Project-level Budgets**: Integration with external budget APIs (e.g., AWS Budgets).
- **Compliance Reports**: Exporting cost data to compliance/audit formats (PDF/CSV).
