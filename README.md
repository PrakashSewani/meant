# Meant

**Say what you mean.**

> Codename: `meant` (this repo). Product name lives in one constant — see
> [docs/NAMING.md](./docs/NAMING.md).

Meant is a browser extension that turns your messy, natural intent into the right words for
the room — in any text box, without a chat thread and without writing a prompt.

You type what you actually mean (badly, quickly, in your own words), select it, and Meant
rewrites it for the audience, tone, format, and length the situation demands: an email to your
manager, a Slack reply, a Jira user story, a bug report, a customer apology, a PR description,
a LinkedIn post, or a one-line message to a friend. Same meaning, different register.

## Why this exists

The problem isn't grammar. It's **register** — knowing how to say the same thing to a manager
versus a friend versus a customer. You already know what you want to say; you don't know how to
phrase it _here_. Existing tools make it worse: Grammarly tells you what's wrong (you still
write it), and ChatGPT-style sidebars make you leave the text box, copy the situation out, and
paste the answer back.

Meant lives where the text already is, asks only for your intent, and does the register work
for you.

**The whole product is four verbs:** Intent → Invoke → Transform → Accept.

## What makes it different

- **No chat box.** The output is a diff you accept, not a transcript you read. Refinement is
  inline chips ("shorter", "softer", "less formal"), not a conversation.
- **No prompt engineering.** You answer _Who · Tone · Format · Length_ — and every one is
  pre-filled by inference from the page, so most transforms are a single click.
- **It infers the register.** The app, the field, the thread, the recipient, the placeholder —
  those _are_ the register. Configuration is a correction, not a form.
- **It sounds like you — and learns each room.** A local Voice profile plus register memory (the
  chips you correct) make output indistinguishable from you at your best, and better in month
  three than day one.
- **BYOK by default, no backend required.** Any provider, any model, your key — Anthropic,
  OpenAI, OpenRouter, Groq, Gemini, a gateway, or a local model via Ollama / LM Studio /
  llama.cpp. An optional hosted tier may come later; it's another provider, never a requirement.
- **Privacy is architecture.** No Meant server in the loop, no telemetry by default; page
  context is read only when you ask and is previewed before it's sent.

## The fast path

```
   ┌───────────────────────────────────────────────┐
   │  ✦  Say it better            Quick ▾     ⏎    │
   └───────────────────────────────────────────────┘
        Inferred: Slack reply · to Sarah · casual
```

`Alt+J` on a rough draft → one accept → done. Everything else (chips, recipes, effort) is one
gesture further, never in the way. Full spec in [docs/EXPERIENCE.md](./docs/EXPERIENCE.md).

## Status

**Pre-alpha / design-complete.** The product thesis, interaction model, architecture, and BYOK
contract are specified in [`docs/`](./docs). Implementation is next — see
[docs/ROADMAP.md](./docs/ROADMAP.md) for the v0.1 dogfood slice.

## Documentation

| Doc                                            | What's in it                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [docs/PRODUCT.md](./docs/PRODUCT.md)           | Thesis, principles, personas, differentiation, non-goals.             |
| [docs/EXPERIENCE.md](./docs/EXPERIENCE.md)     | The core interaction, the Register Bar, inference, recipes, surfaces. |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | MV3 components, data flow, security, permissions, repo structure.     |
| [docs/PROVIDERS.md](./docs/PROVIDERS.md)       | BYOK config (OpenCode-compatible), providers, tiers, key storage.     |
| [docs/ROADMAP.md](./docs/ROADMAP.md)           | Milestones, scope cuts, risk register.                                |
| [docs/NAMING.md](./docs/NAMING.md)             | Identity and the name decision record.                                |
| [docs/DECISIONS.md](./docs/DECISIONS.md)       | Decision log: key custody, deferred hosted tier, transports.          |
| [AGENTS.md](./AGENTS.md)                       | Conventions for humans and AI agents working in this repo.            |

## Architecture at a glance

```
content script (page)                    service worker (extension)
  finds fields · infers register           holds keys · compiles prompt
  renders the Register Bar in a    ──▶     calls the provider · streams
  closed Shadow DOM · no keys              tokens back over a Port
```

Provider calls must run in the service worker: content scripts are subject to the page's CORS
policy, and API keys must never be reachable from a page. Details in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

Repo layout: `apps/extension` (WXT MV3 app) · `packages/core` (register engine, provider layer,
no DOM/`chrome`) · `packages/adapters` (surface adapters) · `packages/config` · `packages/ui`.

## Bring your own key

Meant's config is a subset of `opencode.json`, so a config you already maintain mostly works:

```jsonc
{
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5",
  "provider": {
    "anthropic": {
      "options": { "baseURL": "https://api.anthropic.com/v1" },
    },
  },
}
```

Keys go in a separate, local, passphrase-encryptable vault — never in the shareable config, and
never synced in plaintext. Full contract in [docs/PROVIDERS.md](./docs/PROVIDERS.md).

## Privacy

- **No backend required.** Today the extension talks only to the provider you configure — there
  is no Meant server in the loop. A future hosted tier is opt-in and never replaces this path.
- **Local by default.** Inference, Voice, Recipes, and history live on your device.
- **Context is opt-in and previewed.** Nothing about the page leaves until you press transform.
- **Local models supported.** Point it at Ollama and nothing leaves your machine at all.

## Contributing

Read [AGENTS.md](./AGENTS.md) first — it defines the hard invariants (no keys in content scripts,
no provider calls outside the worker, `core` stays DOM-free, native undo must survive).
Repo-local agent skills in [`.commandcode/skills/`](./.commandcode/skills) cover the common
workflows: adding a provider, adding a surface adapter, authoring a recipe.

## License

MIT — see [LICENSE](./LICENSE).
