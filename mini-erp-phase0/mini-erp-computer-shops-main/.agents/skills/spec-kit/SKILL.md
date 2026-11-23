---
name: "spec-kit"
description: "GitHub Spec Kit (Spec-Driven Development) master guide and router for Antigravity. Use when the user asks to use spec-kit, SDD, or wants an overview of the /speckit-* skills (constitution, specify, clarify, plan, tasks, analyze, implement, converge, checklist)."
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  version: "1.2.6.dev0"
---

# GitHub Spec Kit — Spec-Driven Development (SDD)

This workspace is initialized with **GitHub Spec Kit** (`v1.2.6.dev0`) for **Antigravity (`agy`)** using PowerShell (`ps`) and Python (`py`) helper scripts in `.specify/`.

## Installed Spec Kit Skills

Each stage of the Spec-Driven Development lifecycle is installed as an independent Antigravity skill under `.agents/skills/`:

1. **`speckit-constitution`** (`.agents/skills/speckit-constitution/SKILL.md`):
   Create or update the project governing principles and development guidelines in `.specify/memory/constitution.md`.
2. **`speckit-specify`** (`.agents/skills/speckit-specify/SKILL.md`):
   Create or update a feature specification (`specs/<NNN-feature>/spec.md`) from a natural language description.
3. **`speckit-clarify`** (`.agents/skills/speckit-clarify/SKILL.md`):
   Identify underspecified areas in the active feature spec by asking up to 5 targeted clarification questions and encoding answers back into `spec.md`.
4. **`speckit-plan`** (`.agents/skills/speckit-plan/SKILL.md`):
   Generate technical implementation plans (`plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`) from the feature specification.
5. **`speckit-tasks`** (`.agents/skills/speckit-tasks/SKILL.md`):
   Generate an actionable, dependency-ordered `tasks.md` organized by user stories.
6. **`speckit-analyze`** (`.agents/skills/speckit-analyze/SKILL.md`):
   Perform a non-destructive cross-artifact consistency and quality analysis across `spec.md`, `plan.md`, and `tasks.md`.
7. **`speckit-checklist`** (`.agents/skills/speckit-checklist/SKILL.md`):
   Generate custom requirements-quality checklists ("unit tests for requirements") under `checklists/`.
8. **`speckit-implement`** (`.agents/skills/speckit-implement/SKILL.md`):
   Execute the implementation plan by processing and completing all tasks defined in `tasks.md`.
9. **`speckit-converge`** (`.agents/skills/speckit-converge/SKILL.md`):
   Assess the current codebase against `spec.md`, `plan.md`, and `tasks.md`, and append any remaining unbuilt work as new tasks to `tasks.md`.
10. **`speckit-taskstoissues`** (`.agents/skills/speckit-taskstoissues/SKILL.md`):
    Convert tasks from `tasks.md` into GitHub issues.

## How to Use

When the user invokes `/speckit-<command>` or asks to run a Spec Kit workflow step (e.g., "specify a new feature", "create a spec-kit plan", "break down tasks with spec-kit"), read and follow the corresponding `.agents/skills/speckit-<command>/SKILL.md` file.
