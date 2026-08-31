
## Iterative Checkpoints & Error Recovery

- **Mandatory Checkpoints:** This workflow has built-in checkpoints. Execution must pass these checkpoints before proceeding.
- **Implementation Handover:** The implementation phase (`implement.md`) MUST ALWAYS conclude by triggering the `review.md` workflow. Do not skip the review phase.
- **Error Fallback:** If an error occurs during execution, DO NOT CRASH. Automatically revert to the previous stable state or previous step, analyze the failure, and try again (up to 3 times) before escalating.

## Test-Driven Self-Evaluation

- This implementation workflow is strictly tied to existing tests in the `tests/` directory (e.g., `dicomGeometry.test.ts`, `layoutHelpers.test.ts`, `syncScroll.test.ts`, `reportGenerator.test.ts`).
- You MUST ensure that relevant tests pass before marking your implementation task as complete.
