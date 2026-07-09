# Architecture

This repository contains an OpenCode Orchestration v2.2 system under `.opencode/`.

## Primary Architecture

- Orchestrator clarifies missions, selects capabilities, and manages approval gates.
- General implementation uses `@worker`; database work uses `@database-agent`; documentation work uses `@documentation-agent`.
- A single validator runs requested scopes and levels from policy.
- Architecture reviewer handles architecture-sensitive review when requested or risk requires it.
- Discovery and handoff behavior are selected through the Skill Registry.
- Capability activation, dispatch agent selection, skill activation, validation behavior, and browser behavior are centralized in config files.

## Boundaries

- `.opencode/agents/` contains OpenCode-discoverable agent behavior contracts.
- `.opencode/commands/` contains user-facing command prompts.
- `.opencode/skills/` contains skill implementations and the Skill Registry.
- `.opencode/config/` contains orchestration policy.
- `.opencode/docs/` contains design rationale and migration docs.
- `.ai/` contains lightweight project memory for future missions.

## Principles

- Clarify before planning.
- Plan before implementation.
- Pass only relevant context to workers.
- Prefer quick validation by default.
- Ask before expensive validation, browser installation, or commits.
- Add new capabilities through the Capability Registry, not new worker files.
- Runtime-enforced models are set directly in `.opencode/agents/*.md` frontmatter.
