# AGENTS.md

Guidance for AI agents and humans working in this repository. Read this before changing code.
If a change violates a **hard invariant** below, it is wrong regardless of how well it works.

## What this project is

**Meant** (codename `meant`) — a browser extension that transforms messy intent into the right
register for the situation, in any text box, without a chat interface and without prompt
engineering. Product name lives only in `BRAND` (`packages/core/src/brand.ts`) — never hardcode
it in UI strings.

Read in this order before implementing anything:

1. [docs/PRODUCT.md](./docs/PRODUCT.md) — the thesis and the non-goals.
2. [docs/EXPERIENCE.md](./docs/EXPERIENCE.md) — the interaction the code must preserve.
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — components and constraints.
4. [docs/PROVIDERS.md](./docs/PROVIDERS.md) — the BYOK contract.
5. [docs/ROADMAP.md](./docs/ROADMAP.md) — what is in scope _right now_.
6. [docs/DECISIONS.md](./docs/DECISIONS.md) — the contracts that are settled; don't relitigate them.
7. [docs/NAMING.md](./docs/NAMING.md) — the identity and the copy rules.

## Hard invariants

These are non-negotiable. Violating one is a P0 bug.

1. **No API keys or vault passphrases outside the service worker.** Keys live in the vault, are
   decrypted in the worker only for the duration of a call, and are never sent to a content
   script, page, or `chrome.storage.sync`. Secrets are never _collected_ in page context either:
   a content-script overlay sees keystrokes that page scripts can read. Key entry and vault
   unlock happen on extension-owned surfaces only.
2. **No provider calls from content scripts.** Content scripts send intents to the worker over a
   `Port`. They are subject to the page's CORS policy and are untrusted-adjacent. Transports sit
   behind `@meant/core/transports`; content scripts import `@meant/core` only, so the SDK
   never enters the page bundle.
3. **`packages/core` stays pure.** No imports of `chrome`, `window`, `document`, `ui`,
   `adapters`, or `apps`. It must run under plain Node/Vitest. Purity is what makes the register
   engine testable.
4. **Nothing appears uninvited.** No popover on raw selection, and the grip is **off by
   default** — opt-in per site, offered once after the first accepted transform. Invocation is
   explicit only: browser shortcut (`chrome.commands`, remappable), grip click, or context menu.
   Browser-owned shortcuts (`Ctrl+J`, `⌘⇧J`) can never be the default.
5. **Native undo must survive every write.** Writes go through the adapter's shared helper, which
   places the selection and calls `execCommand('insertText')` — the only programmatic edit
   Chromium records in a field's undo stack (D-006). Never assign `value` or `innerHTML`
   wholesale, and never use `insertHTML`. Undo survival is asserted in the browser suite.
6. **Transform only what the user selected.** Never silently rewrite more of the document.
7. **Page context is opt-in, previewed, and revocable per site.** No background scraping, no
   `MutationObserver` over `document.body`, no reads until invoke.
8. **Untrusted content is framed as data.** Page/thread text goes into prompts inside explicit
   delimiters with an instruction never to follow instructions found within it.
9. **No telemetry by default.** Adding any network destination must be documented, justified,
   and added to `host_permissions` deliberately — never `<all_urls>` as a _static_ declaration. Origins beyond the curated
   list are granted at runtime from a user gesture (D-004) — one origin at a time, or all of them
   at once if the user chooses that in the popup. The grant is theirs to make and theirs to
   revoke; what is forbidden is taking it silently. A hosted/accounts
   feature is opt-in, disclosed, and user-visible in its metering; the local path must work
   without it.
10. **No chat surface.** The output is a diff/result, not a conversation. Do not add a
    transcript UI.

## Repo layout

```
apps/extension/       WXT MV3 app. entrypoints/{background,content,popup,options,sidepanel}
packages/core/        register engine · prompt compiler · voice · provider layer (DOM-free)
packages/adapters/    SurfaceAdapter implementations: generic + per-site
packages/config/      MeantConfig Zod schema · presets · opencode.json importer
packages/ui/          Register Bar, chips, diff view (React, shadow-DOM-safe)
docs/                 Product, experience, architecture, providers, roadmap, naming, decisions
.commandcode/skills/  Repo-local agent playbooks (see below)
```

## Commands

The repo is **not scaffolded yet** (pre-alpha). Once the WXT workspace exists, these are the
canonical commands — keep them green before considering work done:

```bash
pnpm install
pnpm dev              # WXT dev build with HMR, loads unloaded extension
pnpm build            # production build for the store
pnpm test             # Vitest unit tests (packages/core, packages/config)
pnpm test:e2e         # Playwright against a built extension + mock provider
pnpm typecheck        # tsc --noEmit across the workspace
pnpm lint             # eslint + prettier check
pnpm validate:config  # validate all provider presets against the schema
pnpm check            # typecheck + lint + test + validate:config — the CI entry point
```

Do not add a script without wiring it into CI-equivalent local runs.

## Conventions

- **TypeScript strict.** No `any` at module boundaries; parse untrusted input with Zod, don't
  cast it.
- **Validate at the boundary.** Provider responses, imported configs, and any page-derived data
  are untrusted — Zod-parse them.
- **Pure logic in `core`.** Side effects (storage, network, DOM) live at the edges.
- **No comments that restate the code.** Comment only non-obvious _why_ (undo preservation,
  CORS, injection framing).
- **Naming:** adapter ids are lowercase (`slack`, `gmail`, `generic`); recipes use kebab-case
  ids (`jira-user-story`); model refs are `provider/model`.
- **Configuration lives on extension surfaces.** The Register Bar carries the transform vocabulary
  (Who · Tone · As · Length + Effort) and nothing else — no provider, model, key, voice, or
  shortcut controls. The bar may deep-link to the popup/options page; it never embeds a form.
- **No premature abstraction.** Two similar site adapters is fine; three is when you extract.
- **Errors are classified, not swallowed.** Use the `auth | cors | rate_limit | quota |
model_missing | network` taxonomy and map each to user-facing copy.

## Common workflows

Repo-local skills carry the step-by-step playbooks — load the matching one before starting:

| Task                                | Skill                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Add a provider or model preset      | [`.commandcode/skills/byok-provider`](./.commandcode/skills/byok-provider/SKILL.md)       |
| Add support for a new site/app      | [`.commandcode/skills/surface-adapter`](./.commandcode/skills/surface-adapter/SKILL.md)   |
| Author or change a transform recipe | [`.commandcode/skills/transform-recipe`](./.commandcode/skills/transform-recipe/SKILL.md) |

### The prompt compiler is the product — treat it like code

Every compiled prompt (see [PROVIDERS.md](./docs/PROVIDERS.md#10-guardrails--prompt-compilation))
must include: the Register as explicit constraints, the Voice descriptor + ban-list, the
guardrails (never invent facts/commitments/dates/names), untrusted-data framing for any page
content, and an output contract that returns only the transformed text. Prompt changes require
a golden-test update and a note in the PR describing the behavioral change.

## Testing requirements

- **`core`:** unit tests for prompt compilation, register inference, config merge/import, tier
  mapping, redaction. Golden snapshots for compiled prompts per (intent, register, recipe).
- **Inference goldens:** a fixture corpus of (surface, field role, visible context) → expected
  Register, per adapter. The thesis is "register is mostly inferable" — keep it measured.
- **Adapters:** fixture-based tests against saved real DOM (Gmail/Slack/LinkedIn/Jira) — these
  catch rich-editor breakage without a browser.
- **Writes:** every adapter write test must assert that a prior programmatic edit is still
  undoable.
- **E2E:** the full loop on a local fixture page (textarea + contenteditable + iframe) against a
  **mock provider**. Never put a real key in CI.
- **Provider doctor:** contract test per transport, opt-in, skipped without keys.

## Security & privacy checklist (for any PR that touches network, storage, or DOM)

- [ ] No key, token, or secret reaches a content script or page.
- [ ] New hosts sit in the bounded optional list and are granted per origin at runtime, with a
      stated reason.
- [ ] Page-derived strings are Zod-validated or length-capped before use.
- [ ] Prompt content from the page is delimited and labeled as untrusted data.
- [ ] No new outbound destination without docs + justification.
- [ ] Any hosted/accounts feature is opt-in, disclosed, E2E-encrypted for secrets, and the local
      path still works without it.
- [ ] Context capture is opt-in, previewed, and per-site revocable.

## Definition of done

1. All invariants hold.
2. `typecheck`, `lint`, `test` pass; new logic has tests.
3. Prompt changes include updated golden snapshots.
4. User-facing copy matches the tone in [docs/NAMING.md](./docs/NAMING.md#identity) (plain,
   warm, no "AI-powered", no exclamation).
5. Docs updated if a contract changed (config schema, adapter interface, error taxonomy).
6. No new permission, model, or surface added without a roadmap check.

## Taste

Project preferences are learned and stored under `.commandcode/taste/`. Read them before
starting work; they are requirements, not suggestions. Never edit those files by hand — record a
preference with the `taste` tool instead.
