# Providers & BYOK

The model is a swappable part. This document defines how users bring their own key, how models
are configured, and how the same config format people already use with OpenCode and Claude tooling
port over.

## 1. Philosophy

1. **No vendor lock-in.** Anthropic, OpenAI, Google, Groq, OpenRouter, self-hosted, local — all
   equal citizens behind one interface.
2. **No backend required.** You talk directly to the provider you configured; we never proxy or
   see your traffic. A first-party hosted tier may be offered later as a convenience — the direct
   path stays permanent.
3. **Bring the config you already have.** If you've configured OpenCode, you can paste your
   provider block and go.
4. **BYOK is the free path.** No required subscription and no upsell pressure. Your key, your
   bill, your model. A hosted tier with free trials may come later, but it's one more provider
   preset behind the same interface (id `meant`) — never a fork, never a requirement.
5. **Local models are first-class**, not a footnote — the ultimate privacy answer.

## 2. Config format

Meant's config is a **subset of `opencode.json` plus one extension key** (`reasoning_model`),
so a file you already maintain is mostly valid as-is. Two files: a shareable config (no secrets)
and a local vault (secrets).

```jsonc
// meant.config.json  — safe to sync/commit; contains NO secrets
{
  "$schema": "https://meant.app/config.json",
  "model": "anthropic/claude-sonnet-4-5", // balanced / default
  "small_model": "anthropic/claude-haiku-4-5", // quick tier
  "reasoning_model": "anthropic/claude-opus-4-5", // deep tier (Meant extension)
  "provider": {
    "anthropic": {
      "options": { "baseURL": "https://api.anthropic.com/v1" },
      "models": {
        "claude-sonnet-4-5": { "name": "Claude Sonnet 4.5" },
        "claude-haiku-4-5": { "name": "Claude Haiku 4.5" },
      },
    },
  },
}
```

```jsonc
// vault (never synced, encrypted at rest when a passphrase is set)
{
  "anthropic": { "apiKey": "sk-ant-..." },
  "openrouter": { "apiKey": "sk-or-..." },
}
```

### More than one config

Both files are the contract; the extension keeps a **library of named configs** on top of it
(`meant.configs`, with `meant.activeConfig` naming the live one). Switching between them rewrites
neither: a config is data, and the live one is a pointer. Keys are keyed by **provider id** and
shared by every config that uses that provider, so switching or deleting a config can never lose a
key — and the Configs section of the options page is the only place any of it is edited.

A config saved before the library existed is adopted into it on first open, named after its
provider, and the old key is removed in the same step.

### Field reference

| Field                                      | Type               | Meaning                                                                                  |
| ------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------- |
| `model`                                    | `"provider/model"` | Balanced/default tier.                                                                   |
| `small_model`                              | `"provider/model"` | Quick tier — cheap, fast, short transforms.                                              |
| `reasoning_model`                          | `"provider/model"` | Deep tier — long docs, nuanced register. _(Meant extension; ignored by OpenCode.)_       |
| `provider.<id>.npm`                        | string             | Transport hint: `@ai-sdk/anthropic` or `@ai-sdk/openai-compatible`. Inferred if omitted. |
| `provider.<id>.name`                       | string             | Display name.                                                                            |
| `provider.<id>.options.baseURL`            | string             | Endpoint. Required for custom providers.                                                 |
| `provider.<id>.options.apiKey`             | string             | Prefer the vault; a literal here triggers a "key in config" warning.                     |
| `provider.<id>.options.headers`            | object             | Extra headers (e.g. `anthropic-dangerous-direct-browser-access`).                        |
| `provider.<id>.models`                     | map                | Model IDs → `{ name, limit: { context, output }, reasoning? }`.                          |
| `disabled_providers` / `enabled_providers` | string[]           | Allow/deny lists.                                                                        |

## 3. Compatibility with OpenCode

The importer (`packages/config`) accepts an `opencode.json`/`.jsonc` and maps it:

| OpenCode                                                                               | Meant              | Note                                                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `provider`, `model`, `small_model`                                                     | same               | Direct.                                                                                                                   |
| `options.baseURL`, `options.headers`, `models`, `limit`                                | same               | Direct.                                                                                                                   |
| `options.apiKey`, `{env:VAR}`, `{file:...}`                                            | **prompt → vault** | Browsers have no env/filesystem. We detect placeholders and ask for the value once, then store it in the encrypted vault. |
| `agent.*`, `mcp`, `plugin`, `formatter`, `lsp`, `tui`, `server`, `permission`, `share` | **ignored**        | Not meaningful for a text-transform extension; we say so instead of silently dropping.                                    |

Import is explicit and previewed: the user sees exactly which providers/models were imported and
which keys are needed.

## 4. Transports

Two adapters cover virtually every provider:

- **`anthropic`** — Anthropic Messages API. Browser-origin calls **require** the header
  `anthropic-dangerous-direct-browser-access: true`; Meant sets it automatically for
  Anthropic-transport providers. (The name is alarming; it is Anthropic's opt-in flag for
  client-side apps. Here the "client" is your extension's service worker, not a public website,
  and the key stays in your vault.)
- **`openai-compatible`** — `POST {baseURL}/v1/chat/completions`. Covers OpenAI, Gemini's
  OpenAI endpoint, Groq, DeepSeek, Mistral, xAI, Together, Fireworks, Cerebras, OpenRouter,
  Vercel/Cloudflare AI Gateways, Ollama, LM Studio, llama.cpp, and anything else OpenAI-shaped.

Anthropic-transport and `openai-compatible` share one streaming interface in
`packages/core`, so recipes and the register engine never know which is in use.

## 5. Model tiers ↔ Effort

The UI never asks "which model?" It asks **Effort**, and the config decides the mapping:

| Effort (UI)  | Config key                         | Typical use                                       |
| ------------ | ---------------------------------- | ------------------------------------------------- |
| **Quick**    | `small_model` (fast tier)          | "Say it better" on a Slack line; fix tone.        |
| **Balanced** | `model` (main tier)                | Default for email, PR descriptions, replies.      |
| **Deep**     | `reasoning_model` (reasoning tier) | Long docs, user stories, nuanced/sensitive prose. |

Defaults are auto-assigned per Recipe (a LinkedIn post wants Balanced; a one-line reply wants
Quick), and the user can override Effort inline without touching config.

## 6. Provider presets

A curated preset list (generated from [models.dev](https://models.dev) where possible) means
setup is "paste a key," not "know a base URL." Each preset carries: transport, base URL,
auth style, a couple of model IDs, and a browser-CORS note.

| Preset                                                     | Transport                    | Base URL                                                   | Browser note                                                         |
| ---------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Anthropic                                                  | anthropic                    | `https://api.anthropic.com/v1`                             | Auto-adds the browser-access header.                                 |
| OpenAI                                                     | openai-compatible            | `https://api.openai.com/v1`                                | Blocked from _pages_ by design; works from the worker.               |
| Google Gemini                                              | openai-compatible            | `https://generativelanguage.googleapis.com/v1beta/openai/` | —                                                                    |
| OpenRouter                                                 | openai-compatible            | `https://openrouter.ai/api/v1`                             | One key, hundreds of models. Recommended default for BYOK newcomers. |
| Groq                                                       | openai-compatible            | `https://api.groq.com/openai/v1`                           | Very fast Quick tier.                                                |
| DeepSeek / Mistral / xAI / Together / Fireworks / Cerebras | openai-compatible            | vendor                                                     | —                                                                    |
| Vercel AI Gateway                                          | openai-compatible            | `https://ai-gateway.vercel.sh/v1`                          | Multi-vendor, one key.                                               |
| Cloudflare AI Gateway                                      | openai-compatible            | `https://gateway.ai.cloudflare.com/v1/<acct>/<gw>/...`     | Good for orgs.                                                       |
| Ollama (local)                                             | openai-compatible            | `http://localhost:11434/v1`                                | Fully local.                                                         |
| LM Studio (local)                                          | openai-compatible            | `http://127.0.0.1:1234/v1`                                 | Fully local.                                                         |
| llama.cpp (local)                                          | openai-compatible            | `http://127.0.0.1:8080/v1`                                 | Fully local.                                                         |
| Azure OpenAI                                               | openai-compatible (advanced) | `https://<res>.openai.azure.com/`                          | Needs `api-version` + deployment-name mapping.                       |

**Custom endpoints are a first-class flow.** Pick **Custom (OpenAI-compatible)**, give it an id,
a base URL, a key, and the model ids you want per tier. The only thing that makes it different
from a preset is that its origin is not in the manifest’s declared list, so enabling it asks for
that origin at runtime (D-004) — one prompt, revocable, and the same transport handles it. Reach
for a preset when one exists; a preset is a custom endpoint someone already got right.

## 7. Local models

Local is the strongest privacy story: nothing leaves the machine.

```jsonc
{
  "model": "ollama/qwen3-coder",
  "small_model": "ollama/llama3.2",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": { "qwen3-coder": { "name": "Qwen3 Coder (local)" } },
    },
  },
}
```

Notes: add the loopback origin to the bounded optional host list when a local provider is enabled
(granted at enable time, D-004). Loopback is exempt from mixed-content blocking, but never use
`https://` for a local server unless it has a cert. Show a "Local — nothing leaves this device"
badge in the UI whenever the active provider is loopback.

## 8. Key storage & threat model

Be honest about what "secure" means in a browser extension.

- Keys live in `chrome.storage.local`, namespaced per extension, and are **encrypted at rest
  with AES-GCM + PBKDF2** when the user sets a vault passphrase. Without a passphrase they are
  protected by the browser profile's OS-level permissions only.
- Keys are decrypted **in memory in the service worker, only for the duration of a call**, and
  never sent to a content script or page.
- The passphrase is entered only on extension-owned surfaces (options page or a small extension
  window). It is never typed into page context — a content-script overlay sees keystrokes that
  page scripts can read.
- With a passphrase set, the vault starts locked at browser launch, unlocks into
  `chrome.storage.session`, and fails closed: a locked transform offers _Unlock to transform_
  rather than erroring. The doctor is gated the same way.
- `chrome.storage.sync` is **never** used for keys — no key ever crosses devices.
- **We do not claim** hardware-backed secrecy or immunity to a compromised OS/profile. We
  document the limit rather than overpromise; users who need more run a local model or a gateway.
- **If a hosted/accounts tier ships**, keys stay end-to-end encrypted in transit and at rest on
  the server; the server never holds a decryptable key, and selecting the hosted provider is an
  explicit, reversible choice — see [DECISIONS.md](./DECISIONS.md).

## 9. CORS, diagnostics, and failure copy

- Provider calls run in the **service worker** with matching `host_permissions` (granted
  per-origin at enable time, D-004); content scripts never call providers (they are subject to
  page CORS).
- On failure, classify and explain: `auth` (bad key), `cors` (origin/permission block),
  `rate_limit`, `quota`, `model_missing`, `network`. Each maps to specific, non-scolding copy
  and a "Fix in Settings" affordance.
- A built-in **Provider doctor** probes each model the configuration actually reaches — one
  1-token ping per model, labeled with the Effort tiers that use it — and reports the classified
  failure rather than the raw provider error. It runs when you save a provider, and on demand from
  the options page. A key is rarely what is wrong; a mistyped model id is, and that only shows up
  when the model is called. The fastest path out of "why doesn't my key work."

## 10. Guardrails & prompt compilation

The user never writes a prompt; `packages/core` compiles one. Every compiled prompt includes:

- The **Register** (who/tone/format/length) as explicit constraints.
- The **Voice** descriptor (and the ban-list, e.g. AI tells).
- **Guardrails**: never invent facts, commitments, dates, names, or numbers; preserve the
  user's claims; keep the meaning; if context is insufficient, ask one clarifying question
  rather than hallucinate.
- **Untrusted-data framing**: any page/thread content is delimited and labeled as data the model
  must not treat as instructions (prompt-injection defense — see
  [ARCHITECTURE.md](./ARCHITECTURE.md#6-security--privacy)).
- **Output contract**: return only the transformed text (or a minimal diff), no preamble, no
  "Here's your email."

## 11. Adding a provider

Presets are data, not code. See the repo skill
[`.commandcode/skills/byok-provider`](../.commandcode/skills/byok-provider/SKILL.md) for the
end-to-end checklist (preset entry → schema → transport check → doctor test → docs).

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — where the provider layer sits.
- [EXPERIENCE.md](./EXPERIENCE.md) — how Effort and model choice surface to the user.
