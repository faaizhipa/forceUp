# Archive

This folder contains archived documentation files that are no longer actively maintained but preserved for historical reference.

## Why These Files Were Archived

These files were archived on **2025-11-28** as part of a documentation cleanup effort to:
1. Establish the `docs/` folder as the single source of truth
2. Remove duplicate/superseded documentation
3. Clean up implementation notes and planning documents that are no longer relevant

## Archived Files

### documentation/

| File | Original Purpose | Reason for Archive |
|------|------------------|-------------------|
| `ARCHITECTURE.md` | System architecture diagrams | Superseded by `docs/02-architecture-and-design.md` |
| `BANNER_DESIGN_ANALYSIS.md` | Banner feature analysis | Implementation complete |
| `CACHE_GLOBAL_STATE_INTEGRATION_PLAN.md` | Cache refactoring plan | Plan executed/obsolete |
| `CASEDETAILEXTRACTOR_DATAFLOW_ANALYSIS.md` | Data flow analysis | Merged into `docs/04-data-flow.md` |
| `CLEANUP_SUMMARY.md` | Code cleanup summary | Historical record |
| `CODEBASE_ANALYSIS.md` | Codebase analysis | Superseded by `docs/` documentation |
| `COMPLETE_FLOW_DOCUMENTATION.md` | Flow documentation | Merged into `docs/04-data-flow.md` |
| `comprehensive-codebase-documentation.plan.md` | Documentation plan | Plan executed |
| `CROSS_TAB_SYNC_IMPLEMENTATION.md` | Multi-tab sync plan | Implementation complete |
| `explanation.md` | Overview document | Superseded by `docs/explanation.md` |
| `FEATURE_IMPLEMENTATION_PLAN.md` | Feature planning | Historical record |
| `FETCH_INTERCEPTION_ANALYSIS.md` | Fetch interceptor analysis | Implementation complete |
| `HIGHLIGHTER_BANNER_REDESIGN.md` | UI redesign plan | Implementation complete |
| `IMPLEMENTATION_GUIDE.md` | Implementation guide | Merged into `docs/` |
| `IMPLEMENTATION_PLAN_TOOLS_REFACTOR.md` | Refactoring plan | Plan executed |
| `IMPLEMENTATION_PROGRESS.md` | Progress tracking | Historical record |
| `PLAN_REMOVE_BANNER_CHECKBOX_AND_TAB_NAV.md` | Feature removal plan | Plan executed |
| `PROMPT.md` | Refactoring strategy prompt | Historical record |

## Current Documentation Structure

Active documentation is now organized in:

### Root Level (Essential Reference)
- `PROJECT_RULES.md` - Project rules and agent guidelines
- `BEST_PRACTICES.md` - Coding patterns and anti-patterns
- `CHANGES.md` - Change tracking log
- `FEATURE_SUMMARY.md` - Quick feature reference
- `DEBUG_INSTRUCTIONS.md` - Debugging guide
- `FUNCTIONS.md` - Function catalog
- `SELECTORS.md` - DOM selector registry
- `DEPENDENCIES.md` - Module dependency graph

### docs/ Folder (Comprehensive Documentation)
- `explanation.md` - Documentation hub
- `01-project-overview.md` - Project overview
- `02-architecture-and-design.md` - Architecture details
- `03-core-modules.md` - Module reference
- `04-data-flow.md` - Data flow documentation
- `05-state-management.md` - State management patterns
- `06-bugs-and-gaps.md` - Known issues
- `07-development-log.md` - Development history

### .github/ Folder (AI/Developer Guidelines)
- `copilot-instructions.md` - AI agent guidelines
- `DEVELOPER_GUIDE.md` - Developer guide
- `DEVELOPER_GUIDE_COPILOT.md` - Copilot-specific guide
- `CASE_COMMENT_EXTRACTOR.md` - Module documentation
- `persistent-banner-messages/` - PersistentBanner module docs

### github-notes/

| File | Original Purpose | Reason for Archive |
|------|------------------|-------------------|
| `14 Nov 2025 Reference.md` | Session reference notes | Historical record |
| `FEATURE_REQUIREMENTS.md` | Feature specifications | Implementation complete |
| `HIGHLIGTHER_NOTES-PRD_SPEC.md` | Highlighter PRD spec | Implementation complete |
| `IMPLEMENTATION_PLAN.md` | Implementation planning | Plan executed |
| `PHASE1_AUDIT.md` | Phase 1 audit notes | Implementation complete |
| `PHASE1_COMPLETE.md` | Phase 1 completion notes | Implementation complete |
| `PHASE1_SUMMARY.md` | Phase 1 summary | Implementation complete |
| `PHASE2_COMPLETE.md` | Phase 2 completion notes | Implementation complete |
| `PHASE2_SUMMARY.md` | Phase 2 summary | Implementation complete |

## Restoring Archived Files

If you need to reference an archived file:
1. Navigate to `archive/documentation/`
2. Open the relevant file
3. Note: Content may be outdated

If content from an archived file needs to be incorporated into active documentation:
1. Add the content to the appropriate `docs/` file
2. Update cross-references
3. Do NOT restore the archived file to root level


