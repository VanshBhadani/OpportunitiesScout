# Dependency Map

## Runtime Dependencies

- UI/UX Pro Max uses local Python scripts and CSV data under `.opencode/skills/ui-ux-pro-max/`.
- No npm dependency install is required for the template after cleanup.

## Orchestration Dependencies

- OpenCode discovers project agents from `.opencode/agents/`.
- Agents depend on `.opencode/config/capability-registry.md` for capability activation.
- Agents depend on `.opencode/skills/registry.md` for skill activation.
- Validator depends on `.opencode/config/validation-policy.md`.
- Browser validation depends on `.opencode/config/browser-manager.md`.
- Workers and orchestrator depend on `.ai/` memory before broad exploration.
