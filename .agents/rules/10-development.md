---
name: development
description: Rules for safe implementation, testing, refactoring, and software development.
alwaysApply: true
---

# Development Rules

## Inspect before editing

Never edit a file merely because its name suggests it is relevant.

Read the implementation and its callers first.

Understand:

- inputs
- outputs
- state
- side effects
- dependencies
- lifecycle

## Small changes

Prefer:

change
→ test
→ verify
→ next change

over:

large rewrite
→ hope it works

Do not combine unrelated refactoring with feature development.

## Scope

Implement only the requested task.

Do not silently expand scope.

If implementation reveals a larger architectural problem:

1. document it
2. inform the Orchestrator
3. do not silently redesign the system

## Tests

Never claim that a test passed unless it was actually executed.

When appropriate, run:

- unit tests
- type checking
- lint
- build
- targeted manual verification

Record failures honestly.

## Performance

Do not optimize based on speculation.

Use:

Measure
→ identify bottleneck
→ change
→ measure again

Pay special attention to:

- React rendering
- DICOM parsing
- Cornerstone rendering
- worker communication
- large studies
- memory usage

## Dependencies

Before adding a dependency:

1. Check whether existing dependencies already provide the capability.
2. Consider bundle/runtime impact.
3. Consider maintenance.
4. Consider security.
5. Document important decisions.

## Refactoring

Do not rewrite architecture without explicit justification.

Preserve existing behavior unless the task explicitly changes it.
## Error Handling & Autonomous Error Fixing

- Agents must try to fix bugs or dependency issues independently up to 3 times by analyzing the workspace state before requesting human intervention.
- Isolate the error message (stack trace) and use it as context to trace root causes through imports.
- Do NOT crash the process or give up immediately when a command fails.

## Context Window Management & Hallucination Prevention

- To minimize hallucinations and resource consumption, read ONLY the files that are strictly necessary for the current task.
- In error situations, trace the root cause of the error strictly through file imports (e.g., following `import` statements), rather than randomly reading the entire project codebase.
