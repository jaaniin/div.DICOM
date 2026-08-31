---
name: div-dicom-project
description: Core project principles and architectural constraints for div.DICOM.
alwaysApply: true
---

# div.DICOM — Core Project Rules

You are working on div.DICOM, an existing medical imaging application.

This is NOT a greenfield project.

Before modifying code:

1. Inspect the existing implementation.
2. Read relevant project documentation.
3. Understand the existing data flow.
4. Make the smallest coherent change.
5. Verify the result.

## Source of truth

Use this hierarchy:

1. Actual source code
2. Current tests and executable behavior
3. ARCHITECTURE.md
4. PROJECT.md
5. PLAN.md
6. DECISIONS.md
7. README.md

If documentation and source disagree, investigate the discrepancy.

Never silently invent behavior.

Use:

- UNKNOWN — when information is unavailable
- UNVERIFIED — when an assumption has not been tested

## Core priorities

Prioritize:

1. Correctness
2. DICOM/imaging correctness
3. Stability
4. Privacy
5. Maintainability
6. Performance
7. UX
8. New functionality

## Zero-footprint

Normal operation must remain local.

Do not introduce remote transmission of:

- DICOM files
- pixel data
- patient identifiers
- study metadata
- measurements
- reports

Any exception requires explicit architectural review.

## Project documentation

Keep these documents current:

- PROJECT.md — what the project is
- ARCHITECTURE.md — how it works
- PLAN.md — what should happen next
- DECISIONS.md — why important decisions were made
- AGENTS.md — how AI agents should work

README.md is primarily public/GitHub-facing documentation.

Do not use conversation history as the project's long-term memory.