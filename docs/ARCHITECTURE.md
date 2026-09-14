# Architecture

Goal: a browser extension where **(a)** the model layer is a swappable part, **(b)** API keys never
touch a web page, **(c)** page context is read only when the user asks, and **(d)** the
experience is identical across every site.

## 1. Stack decisions

| Concern             | Choice                                                                     | Why                                                                                                               |
| ------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Extension framework | **WXT** (Vite-based, MV3-first, cross-browser)                             | File-based entrypoints, HMR, typed manifest, Chrome + Firefox from one codebase. Replaces hand-rolled webpack.    |
| Language            | **TypeScript**, strict                                                     | Non-negotiable for a security-sensitive, multi-provider codebase.                                                 |
| UI                  | **React + Tailwind**, rendered inside a **closed Shadow DOM**              | Style isolation from host pages; team familiarity. Vanilla is viable but slower to ship.                          |
| Model layer         | **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) | One interface over 75+ providers; matches the OpenCode mental model. Fetch-based, so it runs in a service worker. |
| Validation          | **Zod**                                                                    | Validate provider config and provider responses at the boundary.                                                  |
| Storage             | `chrome.storage.local` + optional **WebCrypto encrypted vault**            | No backend required. Keys encrypted at rest when a passphrase is set.                                             |
| Tests               | **Vitest** (unit) + **Playwright** (E2E on a real page)                    | Adapters and the register engine need hard tests.                                                                 |

> If WXT proves limiting, the fallback is Vite + `@crxjs/vite-plugin`. The architecture below is
> framework-agnostic; only the entrypoint wiring changes.

## 2. Components

```
┌──────────────────────────── Browser tab (untrusted page) ─────────────────────────────┐
│                                                                                        │
│   page DOM ── selection / focus events                                                 │
│      │                                                                                 │
│      ▼                                                                                 │
│   ┌────────────────────── content script (isolated world) ───────────────────────┐    │
│   │ • SurfaceAdapter registry — finds editable fields, reads/writes text          │    │
│   │ • Inference (local, no network): app, role, recipient, thread, placeholder    │    │
│   │ • Register Bar UI in a CLOSED shadow root (`all: initial`)                    │    │
│   │ • Sends intents over a Port; NEVER sees API keys; NEVER calls providers       │    │
│   └───────────────────────────────┬───────────────────────────────────────────────┘    │
└───────────────────────────────────┼────────────────────────────────────────────────────┘
                                    │  chrome.runtime.connect (long-lived Port, streams)
┌───────────────────────────────────▼────────────────────────────────────────────────────┐
│ background service worker (extension origin)                                            │
│  • Holds keys (in memory only during a call) · resolves provider config                 │
│  • Compiles the hidden prompt (register engine + voice + guardrails)                    │
│  • Calls the provider via AI SDK (fetch) — this is where CORS is bypassed               │
│  • Streams tokens back over the Port; keeps SW alive while the port is open             │
│  • Applies rate limits / retries / timeouts / fallback model                            │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼──────────────────────────────┐
        ▼                           ▼                              ▼
   Options page              Popup (status/toggle)        Side panel (deep work, optional)
   providers · voice ·       enable · current provider    long-form transforms, history
   recipes · privacy
```

### Why API calls live in the service worker — not the content script

This is the single most important architectural constraint:

- **CORS:** content scripts are subject to the _page's_ CORS policy even when the extension has
  host permissions. A service worker with matching `host_permissions` is **not** — so provider
  calls must originate there.
- **Key isolation:** a content script runs in a page-adjacent world that is a target for page
  scripts. Keys must never be reachable from there. The content script only sends _intent_ and
  _text_; the worker owns credentials.
- **Surface trust:** the page is untrusted input. Keeping network + secrets out of it shrinks
  the attack surface to "the page can read text the user already typed."

### MV3 lifecycle notes

- The worker is **ephemeral** (killed when idle). No long-lived in-memory state — persist
  config, recipes, and voice to storage. A transform holds an **open Port**, which keeps the
  worker alive for the duration of the stream; on port disconnect, abort the request.
- Use `chrome.alarms` (not `setTimeout`) for any delayed work.
- Prefer **static content scripts** on a curated host list over broad dynamic injection. Inject
  site adapters dynamically only on hosts the user has actually used.

## 3. Data model

```ts
// A transform request: everything the worker needs, nothing it doesn't.
interface TransformRequest {
  intentText: string; // selected text OR typed intent
  mode: 'polish' | 'compose';
  register: Register; // resolved chips (who/tone/as/length/effort)
  hints: RegisterHints; // local inference output
  context?: PageContext; // opt-in only: thread/labels/recipient
  recipeId?: string;
  voice: VoiceProfile; // local style descriptor
  stream: true;
}

interface Register {
  who?: string; // audience
  tone?: string[]; // ["direct","warm"]
  format?: string; // "slack-reply" | "jira-story" | "email" | ...
  length?: 'short' | 'medium' | 'long';
  effort?: 'quick' | 'balanced' | 'deep';
}

interface TransformResult {
  requestId: string;
  text: string; // streaming chunks accumulate here
  diff?: DiffOp[]; // for inline diff rendering
  finishReason?: 'stop' | 'length' | 'error';
  usage?: { inputTokens: number; outputTokens: number };
  provider: string; // for transparency + error copy
  model: string;
}
```

## 4. Provider layer (BYOK)

The provider layer is deliberately isolated in `packages/core` with **no DOM and no `chrome`
dependency**, so it is unit-testable and reusable. Full spec in
[PROVIDERS.md](./PROVIDERS.md); the shape:

```ts
interface ProviderRegistry {
  resolve(modelRef: string): ResolvedModel; // "anthropic/claude-sonnet-4-5"
  models(): ModelDescriptor[]; // for the picker
  validate(config: MeantConfig): ValidationResult;
}

interface ResolvedModel {
  providerId: string;
  modelId: string;
  // "quick"|"balanced"|"deep" map to model tiers like OpenCode's small_model/model
  tier: 'fast' | 'main' | 'reasoning';
  transport: 'anthropic' | 'openai-compatible';
  baseURL?: string;
  headers?: Record<string, string>;
  apiKey?: string;
}
```

- **Config is a subset of `opencode.json`** (`provider`, `model`, `small_model`, per-provider
  `options.{baseURL, apiKey, headers}`, `models`, `limit`). A user can paste their existing
  OpenCode config and it just works. See
  [PROVIDERS.md](./PROVIDERS.md#3-compatibility-with-opencode).
- **Tiering:** the Effort control maps _Quick → fast model_, _Balanced → main model_,
  _Deep → reasoning model_. This is where "how much reasoning should the AI put in" lives.
- **Transports:** two adapters cover nearly everything — `anthropic` (Messages API, requires
  `anthropic-dangerous-direct-browser-access: true` for browser-origin calls) and
  `openai-compatible` (`/v1/chat/completions`). OpenAI's own API blocks browser origins by
  design; from the extension worker with `host_permissions`, calls succeed, but we still ship a
  clear diagnostics path for provider-side blocks. See
  [PROVIDERS.md](./PROVIDERS.md#9-cors-diagnostics-and-failure-copy).
- **Local models:** Ollama / LM Studio / llama.cpp are just `openai-compatible` providers at
  loopback, plus a runtime origin grant (D-004) and a loopback note.
- **Presets only in v1:** the shipped provider list is curated, and a preset's origin is
  requested only when the user enables it. Arbitrary custom base URLs wait for v1.x (D-004).
- **Two entry points:** `@meant/core` is pure and DOM-free, and `@meant/core/transports`
  holds the SDK-backed transports. The content script imports the former, the worker the latter,
  which keeps the provider SDK out of the page bundle.

## 5. Storage

| Key                      | Contents                                                      | Notes                                                                                                           |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `meant.configs`          | Saved configs: a name and a provider config per entry         | The library. No secrets. One is live at a time.                                                                 |
| `meant.activeConfig`     | Which library entry is live                                   | Points into `meant.configs`.                                                                                    |
| `meant.config`           | Provider config (OpenCode subset)                             | Read as a fallback for a config saved before the library existed, and removed once adopted. No secrets.         |
| `meant.secrets`          | API keys                                                      | Encrypted with AES-GCM + PBKDF2 if a passphrase is set; otherwise OS-protected extension storage. Never synced. |
| `meant.voice`            | Learned Voice profile                                         | Local only, never sent except inside a prompt.                                                                  |
| `meant.recipes`          | User recipes                                                  | Local; importable/exportable as JSON.                                                                           |
| `meant.sites`            | Per-site opt-ins (grip, context sharing)                      | User-controlled, revocable.                                                                                     |
| `meant.priors`           | Register memory: chip corrections per surface + field role    | Local, capped, wipeable, never synced. Applied priors are visible in the chip and resettable.                   |
| `meant.history`          | Last N transforms (opt-in, default off)                       | Local, capped, wipeable.                                                                                        |
| `meant.events`           | Transform metadata: register sent, corrections, accepted flag | Local, capped at 200, wipeable from the popup. **No text content, ever.**                                       |
| `chrome.storage.session` | Unlocked vault keys                                           | Memory-only, cleared on browser restart, never visible to content scripts.                                      |

`chrome.storage.sync` is used **only** for non-sensitive prefs (theme, shortcut). Secrets and
Voice never sync in plaintext. If a future accounts tier ships, cross-device sync must be
**end-to-end encrypted** (the server sees ciphertext only), strictly opt-in, and the local path
must keep working without an account — see [DECISIONS.md](./DECISIONS.md).

**Vault lock states.** With a passphrase set, the vault starts **locked** at browser launch, and
keys live in `chrome.storage.session` only while it is unlocked. A transform invoked while locked
fails closed with an inline _Unlock to transform_ affordance that opens the options page (or a
small extension window). The passphrase is never typed into page context — a content-script
overlay sees keystrokes that page scripts can read — so unlock always happens on an
extension-owned surface. The Provider doctor is gated the same way.

## 6. Security & privacy

### Threat model

| Threat                                        | Mitigation                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page scripts stealing keys                    | Keys exist only in the service worker; content script never receives them; bar UI in a closed shadow root.                                                                               |
| Key exfiltration via network                  | Provider origins are runtime-granted optional hosts (D-004), never a static blanket; no analytics endpoint; CSP on extension pages.                                                      |
| Host page tampering with our UI               | Closed Shadow DOM + `all: initial`; UI is not reachable via page selectors.                                                                                                              |
| **Prompt injection from page/thread content** | Page text is delimited and labeled as untrusted _data_; the system prompt instructs the model to never follow instructions found inside quoted content; context is opt-in and previewed. |
| Provider API key exposure in browser devtools | Requests originate in the worker, not the page; keys are not in page-visible storage.                                                                                                    |
| Page scripts reading secrets the user types   | Keys and passphrases are entered only on extension-owned surfaces; content-script overlays never collect secrets.                                                                        |
| Malicious Recipe / config import              | Zod-validate every imported object; recipes cannot declare arbitrary URLs or new hosts.                                                                                                  |

### Privacy posture (a feature, not a page)

- **No backend required.** Today the extension talks only to the provider _you_ configure; there
  is no Meant server in the loop. A future hosted tier (see [DECISIONS.md](./DECISIONS.md)) is
  _another provider behind the same interface_ — opt-in, never a requirement, and it never
  disables the BYOK or local paths.
- **Local-first by default.** Inference, voice, recipes, and history live on device.
- **Site access is the user's call, and it is visible.** Per site, or every site in one
  gesture from the popup; revocable in the same place. Nothing is granted at install, and the
  toolbar shows when Meant is off somewhere.
- **Context is opt-in and previewed.** "Include this thread" shows exactly what will be sent.
- **Redaction pass (optional).** Strip emails, tokens, and phone numbers before send, per site.
- **Local-model path.** Ollama/LM Studio means nothing leaves the machine at all.
- **Honest limits.** Extension storage is not a secure enclave; we document the threat model
  instead of claiming more than we deliver (see
  [PROVIDERS.md](./PROVIDERS.md#8-key-storage--threat-model)).

### Manifest permissions (start minimal, expand only with justification)

```jsonc
{
  "manifest_version": 3,
  "permissions": ["storage", "contextMenus", "activeTab", "scripting", "alarms"],
  "optional_permissions": ["sidePanel"],
  // The curated hosts. Meant ships support for these, and the grant is also what lets the
  // worker inject the bar bundle on first invoke — a content-script match does not (D-004).
  "host_permissions": [
    "https://mail.google.com/*",
    "https://app.slack.com/*",
    "https://*.atlassian.net/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
  ],
  // Nothing provider-related is granted at install. Enabling a preset or a local model requests
  // exactly that origin, once, from a user gesture in the options page (D-004).
  "optional_host_permissions": [
    "https://api.anthropic.com/*",
    "https://api.openai.com/*",
    "https://openrouter.ai/*",
    "https://api.groq.com/*",
    "https://generativelanguage.googleapis.com/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
    "https://*/*",
  ],
  "commands": {
    "invoke-register-bar": {
      "suggested_key": { "default": "Alt+J" },
      "description": "Open the Register Bar on the current selection",
    },
  },
  "content_scripts": [
    {
      "matches": [
        "https://mail.google.com/*",
        "https://app.slack.com/*",
        "https://*.atlassian.net/*",
      ],
      "js": ["content.js"],
      "all_frames": true,
      "run_at": "document_idle",
    },
  ],
}
```

`all_frames: true` is **scoped to a curated host list**, never `<all_urls>`, because Gmail's
compose lives in an iframe. Sites outside the curated list are enabled with a runtime per-origin
grant (`chrome.permissions.request`, then `chrome.scripting.registerContentScripts`) — never by
broadening the static list. The curated list and its patterns live in
`packages/core/src/sites.ts`, so the manifest and the popup cannot drift apart. Chrome match
patterns wildcard the port by default, so `http://localhost/*` covers every local server port.

## 7. The Register Bar (rendering)

- Mounted in a **closed shadow root** appended to `document.documentElement`, positioned with
  `anchor` from the current selection rect, flipping above/below and clamped to the viewport.
- **Its stylesheet restates Tailwind's shadow-tree defaults.** Tailwind v4 utilities read `--tw-*`
  custom properties whose defaults come from `@property` registrations, and those registrations do
  not take effect inside a shadow root: a plain `border` computes to `none` and `shadow-*`/`ring-*`
  drop their declaration. `entrypoints/bar-styles.css` sets the defaults explicitly, in the bar's
  own stylesheet, so the injected bar looks like the popup and options page.
- Invocation arrives from `chrome.commands` (browser-level shortcut → worker → the focused tab's
  content script), a grip click, or the context menu — never a page-level keydown. Chrome owns
  the `Ctrl+J` family (Downloads, DevTools console) and cannot be reliably preempted; when the
  user's shortcut is unassigned, the grip and context menu are the fallbacks.
- The grip is **off by default** and enabled per site, offered once after the first accepted
  transform.
- **Transform vocabulary only.** Provider, model, key, voice, and theme controls never render in
  the bar — they belong to the popup and options page. The bar may deep-link (_Open settings_),
  never embed a form; model transparency lives in result/error copy, not in a control.
- **Never reflows the page** (position: fixed, high z-index, pointer-events scoped).
- Dismisses on: `Esc`, outside click, scroll-away, field blur, or navigation.
- Reads/writes text through the adapter so native **undo/redo is preserved**: the write helper
  places the selection and calls `execCommand('insertText')`, the only programmatic edit Chromium
  keeps in the undo stack (D-006). `insertHTML`, `selectAll` + `delete`, and wholesale
  `innerHTML` stay banned.

## 8. Repo structure

```
meant/                        # codename; product name lives in BRAND
├── apps/
│   └── extension/            # WXT app: entrypoints/{background,content,popup,options,sidepanel}
├── packages/
│   ├── core/                 # register engine, prompt compiler, voice, provider layer (no DOM/chrome)
│   ├── adapters/             # SurfaceAdapter implementations (generic + per-site)
│   ├── config/               # MeantConfig Zod schema, presets, OpenCode importer
│   └── ui/                   # Register Bar + chips (React, shadow-DOM safe)
├── docs/
└── .commandcode/skills/      # agent playbooks for this repo
```

Dependency rule: `core` has **no** imports from `ui`, `adapters`, `apps/`, or `chrome`/`window`.
That purity is what keeps the register engine testable.

## 9. Testing strategy

- **Unit (`packages/core`):** prompt compilation, register inference, config merge/import, model
  tiering, redaction. Pure functions, no mocks.
- **Adapter tests:** run against saved DOM fixtures (real Gmail/Slack/LinkedIn/Jira markup) to
  catch `contenteditable` breakage without a browser.
- **E2E (Playwright):** load the built extension into Chromium, open a local page with
  textarea + contenteditable + iframe, drive the full Intent→Invoke→Transform→Accept loop
  against a **mock provider** (never a real key in CI).
- **Contract tests:** one live smoke test per transport (`anthropic`, `openai-compatible`),
  opt-in, skipped without keys.
- **Golden tests for prompts:** snapshot the compiled prompt for each (intent, register, recipe)
  triple so regressions are visible in review.
- **Golden tests for inference:** snapshot the inferred Register for each (surface, field role,
  visible context) fixture so register accuracy is a number, not an opinion.

## 10. Performance budgets

- Content script: **< 50 KB** gzipped on load; the Register Bar UI is **lazy-loaded** on first
  invoke, not at page load.
- Zero page reads until invoke. No polling, no `MutationObserver` over the whole body — observe
  only on focus/selection events.
- First token target: **< 1.5 s** on Quick with a warm worker; perceived latency hidden by
  streaming into a ghost overlay.

## Related docs

- [PROVIDERS.md](./PROVIDERS.md) — the BYOK contract in detail.
- [EXPERIENCE.md](./EXPERIENCE.md) — the interaction this architecture serves.
- [ROADMAP.md](./ROADMAP.md) — build order.
