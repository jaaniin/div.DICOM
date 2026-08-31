
## Iterative Checkpoints & Error Recovery

- **Mandatory Checkpoints:** This workflow has built-in checkpoints. Execution must pass these checkpoints before proceeding.
- **Implementation Handover:** The implementation phase (`implement.md`) MUST ALWAYS conclude by triggering the `review.md` workflow. Do not skip the review phase.
- **Error Fallback:** If an error occurs during execution, DO NOT CRASH. Automatically revert to the previous stable state or previous step, analyze the failure, and try again (up to 3 times) before escalating.
