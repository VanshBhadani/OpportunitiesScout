# AGENTS.md

## Project Status

Reusable OpenCode Orchestration v2.2 template. Copy `AGENTS.md`, `.opencode/`, and optionally `.ai/` into a project to use the workflow.

OpenCode project agents live in `.opencode/agents/`.

## Core Workflow

- Use `/mission` for planned multi-step work.
- Use `@worker` directly for tiny frontend, backend, API, CLI, infrastructure, mobile, AI, or test fixes.
- Use `@database-agent` for database design, schemas, migrations, queries, indexes, and data integrity.
- Use `@documentation-agent` for docs-only work.
- Use `/validate` for requested validation scopes.

## Required Policy Files

- Capability routing: `.opencode/config/capability-registry.md`
- Skill activation: `.opencode/skills/registry.md`
- Validation policy: `.opencode/config/validation-policy.md`
- Browser policy: `.opencode/config/browser-manager.md`

## Token Efficiency Rules

- Load only policy needed for the current decision.
- Load `.ai/` memory only when selected capabilities require it.
- Use Graphify only for targeted discovery or architecture context.
- Activate skills only through `.opencode/skills/registry.md`.
- Do not load UI/UX Pro Max unless frontend, UI, mobile, or UX validation work requires it.
- Default validation is Level 1 quick validation.
- Do not run expensive validators, browser automation, dependency installs, commits, or merges without explicit approval.

## Web Research

Use web search when work depends on current external behavior: frameworks, libraries, CLIs, package managers, APIs, testing tools, deployment targets, browser behavior, or unresolved tool errors. Prefer official docs and primary sources.

## Model Routing

Models are enforced by agent frontmatter:

- `@orchestrator` -> GLM-5.2
- `@worker` -> Kimi K2.7 Code
- `@database-agent` -> GLM-5.2
- `@validator` -> DeepSeek V4 Pro
- `@architecture-reviewer` -> GLM-5.2
- `@documentation-agent` -> DeepSeek V4 Flash

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Design Context

- **Strategy:** This project is a product (AI E-commerce storefront). Read PRODUCT.md for target users, brand personality (The Intelligent Boutique), and anti-references.
- **Visuals:** Read DESIGN.md for the core design system (Digital Indigo, Space Grotesk, glassmorphism, soft radii). DO NOT deviate from this system without explicit user instruction.
