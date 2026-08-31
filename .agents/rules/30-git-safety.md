---
name: git-safety
description: Protect user changes and repository history.
alwaysApply: true
---

# Git Safety

Before substantial changes inspect:

git status
git branch --show-current
git log -5 --oneline

Never:

- reset
- force checkout
- discard user changes
- overwrite unrelated work
- delete unknown files

Treat existing uncommitted changes as user-owned.

Do not modify unrelated files.

Keep commits and changes logically scoped.

Before large changes, understand the current repository state.
## Error Handling & Autonomous Error Fixing

- Agents must try to fix bugs or dependency issues independently up to 3 times by analyzing the workspace state before requesting human intervention.
- Isolate the error message (stack trace) and use it as context to trace root causes through imports.
- Do NOT crash the process or give up immediately when a command fails.
