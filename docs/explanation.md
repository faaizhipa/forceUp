# Salesforce Chrome Extension - Complete Documentation

**Last Updated:** January 23, 2025  
**Version:** 7.2  
**Purpose:** Comprehensive documentation for the Penang CoE Salesforce Extension

---

## 📚 Documentation Structure

This documentation is organized into focused sections for easy navigation:

### Core Documentation

1. **[Project Overview](./01-project-overview.md)**
   - What this extension does
   - Key features and capabilities
   - Target users and use cases
   - Technology stack

2. **[Architecture & Design](./02-architecture-and-design.md)**
   - System architecture diagrams
   - Module organization
   - Entry points and load order
   - Chrome Extension Manifest V3 considerations

3. **[Core Modules Reference](./03-core-modules.md)**
   - Module catalog with descriptions
   - Dependencies and relationships
   - Public APIs and usage examples
   - Module initialization patterns

4. **[Data Flow & Extraction](./04-data-flow.md)**
   - How data flows through the system
   - Case data extraction process
   - Cache management strategy
   - DOM query patterns for Salesforce Lightning

5. **[State Management](./05-state-management.md)**
   - Global state patterns
   - Chrome storage usage
   - Event-based communication
   - Cross-context synchronization

6. **[Bugs, Flaws & Gaps Analysis](./06-bugs-and-gaps.md)**
   - Known issues and limitations
   - Architectural gaps
   - Performance bottlenecks
   - Security considerations
   - Recommended improvements

7. **[Development & Debugging Log](./07-development-log.md)**
   - Iterative development tracking
   - Changes and attempts
   - Failures and root causes
   - Fixes and lessons learned

---

## 🚀 Quick Start

### For Developers Joining the Project

1. **Start with:** [Project Overview](./01-project-overview.md) to understand what the extension does
2. **Then read:** [Architecture & Design](./02-architecture-and-design.md) to understand how it's built
3. **Review:** [Core Modules Reference](./03-core-modules.md) to learn the codebase structure
4. **Check:** [PROJECT_RULES.md](../PROJECT_RULES.md) for coding standards and best practices

### For Debugging Issues

1. **Check:** [Bugs, Flaws & Gaps Analysis](./06-bugs-and-gaps.md) for known issues
2. **Review:** [Development & Debugging Log](./07-development-log.md) for similar past issues
3. **Consult:** [Data Flow & Extraction](./04-data-flow.md) if it's a data extraction issue
4. **Reference:** [BEST_PRACTICES.md](../BEST_PRACTICES.md) for troubleshooting patterns

### For Adding New Features

1. **Review:** [Architecture & Design](./02-architecture-and-design.md) to understand where your feature fits
2. **Check:** [State Management](./05-state-management.md) if your feature needs state
3. **Follow:** [PROJECT_RULES.md](../PROJECT_RULES.md) for implementation guidelines
4. **Update:** [Development Log](./07-development-log.md) with your changes

---

## 📖 Related Documentation

### Essential Reference (Root Level)

These files provide quick access to critical development information:

| Document | Purpose |
|----------|---------|
| **[PROJECT_RULES.md](../PROJECT_RULES.md)** | Comprehensive coding rules and agent guidelines |
| **[BEST_PRACTICES.md](../BEST_PRACTICES.md)** | Patterns, do's/don'ts, and lessons learned |
| **[CHANGES.md](../CHANGES.md)** | Change tracking and history |
| **[DEBUG_INSTRUCTIONS.md](../DEBUG_INSTRUCTIONS.md)** | Debugging guide and test scenarios |
| **[FEATURE_SUMMARY.md](../FEATURE_SUMMARY.md)** | Quick feature reference guide |
| **[FUNCTIONS.md](../FUNCTIONS.md)** | Complete function catalog |
| **[SELECTORS.md](../SELECTORS.md)** | DOM selector registry with stability ratings |
| **[DEPENDENCIES.md](../DEPENDENCIES.md)** | Module dependency graph |

### AI/Developer Guidelines

- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Comprehensive AI agent guidelines (primary reference)
- **[.github/DEVELOPER_GUIDE_COPILOT.md](../.github/DEVELOPER_GUIDE_COPILOT.md)** - Quick development guidelines

### Archived Documentation

Historical implementation notes and superseded documentation are preserved in `archive/documentation/`. See `archive/README.md` for details.

---

## 🎯 Document Purpose

Each documentation file serves a specific purpose:

| Document | Purpose | Target Audience |
|----------|---------|-----------------|
| **01-project-overview.md** | High-level understanding | New developers, stakeholders |
| **02-architecture-and-design.md** | System design and structure | Developers, architects |
| **03-core-modules.md** | Module-level details | Developers working on specific features |
| **04-data-flow.md** | Data extraction and processing | Developers debugging data issues |
| **05-state-management.md** | State patterns and storage | Developers working with shared state |
| **06-bugs-and-gaps.md** | Known issues and improvements | Developers, QA, project managers |
| **07-development-log.md** | Development history and lessons | All developers, for learning |

---

## 🔍 How to Use This Documentation

### Scenario: "I need to understand how case data is extracted"

1. Start with [Data Flow & Extraction](./04-data-flow.md) → "Case Data Extraction Flow" section
2. Reference [Core Modules](./03-core-modules.md) → "CaseDataExtractor" for implementation details
3. Check [FUNCTIONS.md](../FUNCTIONS.md) for specific function signatures

### Scenario: "I'm getting stale data issues"

1. Check [Bugs & Gaps](./06-bugs-and-gaps.md) → "Known Issues" → "Stale Data Problems"
2. Review [Development Log](./07-development-log.md) for past stale data fixes
3. Consult [PROJECT_RULES.md](../PROJECT_RULES.md) → "Stale Data Prevention Rules"

### Scenario: "I want to add a new feature"

1. Read [Architecture](./02-architecture-and-design.md) to understand system design
2. Check [State Management](./05-state-management.md) if your feature needs state
3. Follow [PROJECT_RULES.md](../PROJECT_RULES.md) for coding guidelines
4. Reference [Core Modules](./03-core-modules.md) for similar patterns

---

## 🛠️ Maintenance

### Updating Documentation

When making significant changes to the codebase:

1. **Update relevant section files** (01-07) with new information
2. **Add entry to [CHANGES.md](../CHANGES.md)** documenting the change
3. **Update [Development Log](./07-development-log.md)** with lessons learned
4. **Review and update [PROJECT_RULES.md](../PROJECT_RULES.md)** if new patterns emerge

### Documentation Review Schedule

- **After each major feature:** Update relevant sections
- **Monthly:** Review and update bugs/gaps analysis
- **Quarterly:** Comprehensive documentation review

---

## 💡 Tips for Effective Use

1. **Use the search function** - All docs are markdown, searchable in VS Code
2. **Follow cross-references** - Documents link to each other extensively
3. **Check dates** - Each document has a "Last Updated" timestamp
4. **Refer to examples** - Most sections include code examples
5. **Update as you go** - Keep documentation current with your changes

---

## 📞 Getting Help

If you can't find what you need:

1. Search across all documentation files for keywords
2. Check related documents linked from each section
3. Review [BEST_PRACTICES.md](../BEST_PRACTICES.md) for common patterns
4. Consult the team's knowledge base or senior developers

---

**Note:** This documentation is a living document. Please keep it updated as the codebase evolves.
