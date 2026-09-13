# Taste

- Wants the agent to act as a critical thinking partner — challenge assumptions, surface weaknesses and better alternatives, and rethink the idea where it can be materially improved — rather than literally implementing the brief as written. Confidence: 0.9
- Treats their own wording, terminology, and early name/naming ideas as open to revision ("do not assume my wording... is correct"). Confidence: 0.85
- When the agent surfaces open questions, expects it to also state its own recommended answer and make the call ("suggest something") rather than bounce decisions back to them. Confidence: 0.6
- Frames requests at a product/strategy level (thesis, positioning, differentiation, UX) and expects the agent to think like a product strategist and designer, not just execute features. Confidence: 0.7
- Prefers AI integrations to be provider-agnostic and BYOK (bring your own key) — deliberately not tied to a single AI company or model. Confidence: 0.8
- Expects new projects to interoperate with the config formats of tools they already use (e.g. OpenCode, Claude Code). Confidence: 0.65
- Expects documentation and agent scaffolding to be created proactively for a new project — README.md, AGENTS.md, and organized `docs/` — not just code. Confidence: 0.75
- Wants the agent to research the internet for relevant knowledge and to create/reuse reusable skills (playbooks) for the work. Confidence: 0.6
- Treats privacy and user control as fundamental design requirements, not afterthoughts. Confidence: 0.7
- Keeps configuration/secret surfaces strictly separate from in-page UI: BYOK keys, providers, models, and general settings live in the extension's own surfaces (popup/options page), while in-page/inline surfaces (e.g. the Register Bar) stay free of config controls — they may deep-link to settings but must never embed a config form. Confidence: 0.75
- Sequences work as spec-then-build: wants decisions and docs written up and committed as their own step before implementation starts, and expects the agent to flag any remaining exploration/risks ("or do you want to explore more") rather than silently jumping into code. Confidence: 0.6
- Expects implementation in TypeScript ("typescript ofc") with a deliberately organized folder structure — e.g. a pnpm workspace split into separate packages (core, config, adapters, ui) and an app — rather than a flat repo. Confidence: 0.7
- Wants tests and CI workflows set up as part of the initial scaffold, not bolted on later (explicitly asks for "tests and workflows" when kicking off implementation). Confidence: 0.7
- Favors phased/staged delivery: ship the simple, self-contained version first and defer heavier infrastructure (accounts, login, cross-device sync, a hosted tier) to "a much later step," gated on the product proving traction. Confidence: 0.65
