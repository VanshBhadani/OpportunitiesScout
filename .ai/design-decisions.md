# Design Decisions

## Orchestration v2.2

- Keep a small real-agent set: orchestrator, worker, database-agent, validator, architecture-reviewer, documentation-agent.
- Store agents in `.opencode/agents/` to match OpenCode project-agent discovery.
- Add specialist agents only for genuinely distinct runtime models or responsibility boundaries.
- Centralized capability activation in `.opencode/config/capability-registry.md`.
- Centralized skill activation in `.opencode/skills/registry.md`.
- Runtime-enforced model frontmatter exists on each real agent.
- Centralized validation behavior in `.opencode/config/validation-policy.md`.
- Browser tooling is managed by policy, not by validators.
- Architecture review is separate from code review.
- Workers produce handoffs and quick validation results before developer approval.

## Rationale

These decisions reduce repeated context loading, prevent unnecessary validation cost, and avoid fake model routing by using real OpenCode agents for model-sensitive work.
