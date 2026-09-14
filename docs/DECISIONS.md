# Decisions

A lightweight decision log (ADR-style). Add an entry when a decision changes a **contract** —
storage, privacy, architecture, or roadmap scope. Newest first.

## D-007 — Configs are a library; keys belong to providers

**Date:** 2026-09-14 · **Status:** Accepted

**Decision.** Saved provider configurations live in a library (`meant.configs`) with one entry live
at a time (`meant.activeConfig`). A config is a name plus a `MeantConfig`; keys stay in
`meant.secrets`, keyed by **provider id**, shared by every config that uses that provider. The
single-config `meant.config` is read as a fallback and removed when adopted. `@meant/config` owns
the shape (`readActiveConfig`, `configLibrary`, `adoptLegacyConfig`), the worker resolves through
it, and the options page is the only editor.

**Why.** The docs already treat a config as portable data — `meant.config.json` is "what travels"
(D-003). One config at a time made the menu unable to show what someone already had, and made
switching mean re-typing. Duplicating keys per config would have been the tempting shortcut and the
wrong one: deleting or switching a config would then silently lose a key, and the same provider
would be re-authenticated for every config that mentions it.

**Consequences.**

- Switching is a pointer write: no request is fired, and the bar stays in its asking state
  (invariant 4 — calls are user-initiated).
- A config that is saved but unusable reports the reason instead of falling back to another config.
  There is no silent substitution between configs, just as there is none between providers.
- Adoption is a read, not a migration script: an existing `meant.config` keeps working, appears in
  the menu named after its provider, and the legacy key is dropped in the same write.
- The `MeantConfig` schema is unchanged, so the OpenCode subset in PROVIDERS §2 still holds and the
  importer (when it ships) has one config shape to produce.

## D-006 — `execCommand('insertText')` is the sanctioned write primitive

**Date:** 2026-09-13 · **Status:** Accepted

**Decision.** Writes place the selection and call `document.execCommand('insertText')`. The ban
stays on the destructive uses — `insertHTML`, `selectAll` + `delete`, `document.write`, wholesale
`innerHTML` — and a spec-clean fallback (`beforeinput`/`input` plus `setRangeText`, or a range
mutation for rich editors) runs wherever the command is missing or refuses.

**Why.** Invariant 5 previously said "never use `execCommand`" and "native undo must survive every
write" in the same breath, and those cannot both hold: in Chromium, `insertText` on a live
selection is the _only_ programmatic edit recorded in a field's undo stack. Assigning `value`,
calling `setRangeText`, or doing DOM surgery all silently drop the user's history. The product
promise — a `⌘Z` that gives the user their own words back — outranks the tidiness of the API we
use to keep it.

**Consequences.**

- The deprecated call is confined to one helper in `packages/adapters`; nothing else calls it.
- Undo survival is asserted in the browser suite. happy-dom exercises only the fallback, so the
  fallback has to stay correct on its own.
- If Chrome ever removes `insertText`, native undo goes with it. That is a product-level problem
  with a product-level answer, not something an adapter can paper over.

## D-005 — Register memory: local priors learned from chip corrections

**Date:** 2026-09-13 · **Status:** Accepted

**Decision.** Learn the user's _register_ corrections locally, the same way Voice learns style.
When a user overrides a chip before accepting (Tone: casual → direct; Who: channel → manager),
record the delta keyed by (surface, field role, recipient class). On later invokes in that
context, apply the prior and show it in the chip (_"direct — you usually pick this here"_), with
a per-item reset. A prior needs two observations before it applies, and decays over time.

**Why.** The moat is inference, not model access. Heuristics shipped once are copyable; priors
that converge on the user's own corrections are not. It is also cheap — a small local map and
counts, no ML, no network — and it raises accept rate without touching prompt quality.

**Consequences.**

- New local store `meant.priors`: capped, wipeable, never synced, never sent as data. Priors
  reach a prompt only as constraints, exactly like the Register and Voice.
- Learned defaults are **visible and revocable**. A hidden learned default reads as a bug.
- Adds a layer to the register engine ([PRODUCT.md](./PRODUCT.md#7-what-intelligence-means-here))
  between context inference and recipe resolution, and a signal row in EXPERIENCE.md §4.
- Not telemetry: nothing leaves the device to make this work. Aggregate learning is not a
  requirement and would need its own decision.

## D-004 — Runtime host permissions; presets only in v1

**Date:** 2026-09-13 · **Status:** Accepted

**Decision.** The manifest declares a **bounded optional host-permission set** — the shipped
provider presets plus loopback — and nothing else. Origins are granted at **runtime**, one
provider or one site at a time, from a user gesture on an extension page
(`chrome.permissions.request`) and revocable the same way. Custom provider base URLs are supported through that same flow: the user describes the
endpoint, and enabling it grants exactly that origin.

**Why.** "`host_permissions` contains only the origins the user configures" is not expressible
in a static MV3 manifest. Without optional permissions, every non-preset provider and every
non-curated site fails at CORS, so the BYOK-custom path and the per-site opt-in model both break
at runtime. Declaring `https://*/*` statically is what invariant 9 forbids; declaring a fixed
optional list and requesting one origin at a time keeps the granted surface narrow and the
declared set enumerable.

**Consequences.**

- Enabling a provider or a site shows a browser permission prompt. The copy must say what the
  origin is for — an unexplained prompt is a trust cost we pay deliberately, not accidentally.
- To let any site be enabled, the manifest declares `https://*/*` **optionally**. The declaration
  is broad; the grant is not. One origin, from a click in the popup, revocable there, and nothing
  is granted at install.
- v1 ships a curated provider list (Anthropic, OpenAI, OpenRouter, Groq, Gemini, and local
  Ollama / LM Studio / llama.cpp) **and** a custom endpoint form for anything OpenAI-shaped that is
  not listed — a gateway, a proxy, someone’s own server.
- Sites outside the curated content-script list are enabled with a runtime grant _followed by_
  `chrome.scripting.registerContentScripts` — never by broadening the static list.
- The curated hosts are declared in `host_permissions`, not only as content-script matches: the
  worker needs the grant to inject the bar bundle into a frame on first invoke, and a match alone
  does not permit that. The list is bounded and is the same one the product claims to support.
- The bar's stylesheet is handed to the injected script by the worker rather than fetched from the
  page: a page-context fetch of an extension resource needs `web_accessible_resources`, and a
  public path is a fingerprint any page could read.
- The popup offers **enable on all sites**: one runtime grant of `https://*/*` that registers a
  broad dynamic content script. It is still granted at runtime from a gesture and still revocable,
  but the grant is large, and the user chooses it knowing what Chrome's prompt says. Per-site
  remains available for anyone who wants the smaller grant — but it is a choice, not a chore.
- The Web Store review impact of that broad optional declaration is still to be verified before
  submission, and the answer recorded here.

## D-003 — Key custody: `chrome.storage.local` + optional encrypted vault

**Date:** 2026-09-13 · **Status:** Accepted

**Decision.** API keys live in `chrome.storage.local` (per-extension, per-profile, on-device),
encrypted at rest with **AES-GCM + PBKDF2** when the user sets a vault passphrase. Keys are
decrypted in the service worker's memory only for the duration of a call; `chrome.storage.session`
holds them in memory while the vault is unlocked. `chrome.storage.sync` is **never** used for
secrets.

**Why.** There is no backend in v1, so local is the only option — and it is also the honest one.
`storage.sync` would place keys on a third-party server by default, which contradicts the privacy
posture for zero user benefit (keys can't roam without breaking the "no cloud" promise anyway).

**Consequences.**

- Extension storage is **not a secure enclave**: anyone with profile/filesystem access or devtools
  on the extension can read it. Documented, not hidden; local models and BYO-gateways are the
  answer for high-sensitivity users.
- Secrets don't sync, so a second device means re-entering keys. The shareable
  `meant.config.json` (providers/models, no secrets) is what travels.
- A future accounts tier must sync the vault **end-to-end encrypted** (server = ciphertext only)
  — see D-002.

## D-002 — Local-only now; accounts, sync, and a hosted tier are deferred

**Date:** 2026-09-13 · **Status:** Accepted

**Decision.** Ship v1 with **local user storage and BYOK only** — no accounts, no server, no
cross-device sync. If the extension earns durable traction, add — as separately-justified,
opt-in features — (1) optional sign-in, (2) end-to-end-encrypted sync, and (3) a first-party
hosted provider with free trials.

**Why.** Local-only keeps the privacy claim literally true, removes backend cost/liability while
the product is unproven, and stops auth/recovery/key-custody/abuse work from dominating v1 and
distracting from the register engine — the actual differentiator.

**Consequences.**

- Docs say **"no backend required"**, not "zero backend": the hosted tier is _another provider
  behind the same interface_ (`meant`), never a requirement, and never disables BYOK or local.
- Any future sync is E2E-encrypted and opt-in per data class; secrets and Voice never sync in
  plaintext.
- "No telemetry by default" holds. A hosted tier adds exactly one network destination (our
  endpoint) with **user-visible metering**, disclosed and `host_permissions`-scoped. It is the
  _only_ new outbound destination permitted.
- **Anti-lock-in:** the hosted provider is a preset like any other — never ranked by revenue,
  never a silent default, never gating a feature.

**Revisit when:** the week-4 retention target is met _and_ BYOK setup friction (not output
quality) is the top drop-off cause.

## D-001 — Two transports only: `anthropic` and `openai-compatible`

**Date:** 2026-09-13 · **Status:** Accepted

**Decision.** Cover the provider ecosystem with exactly two transports. New providers are data
(presets), not code.

**Why.** Two adapters reach Anthropic plus every OpenAI-shaped API (OpenAI, Gemini's compat
endpoint, Groq, DeepSeek, OpenRouter, Vercel/Cloudflare gateways, Ollama/LM Studio/llama.cpp).
More transports means more auth/CORS surface for no coverage gain.

**Consequences.** A provider fitting neither transport is out of scope until proven necessary.
Anthropic browser-origin calls auto-add `anthropic-dangerous-direct-browser-access: true`.

## D-000 — No chat surface

**Date:** 2026-09-13 · **Status:** Accepted

**Decision.** The output is a diff/result, never a conversation transcript. Refinement happens
in-place via chips and one-shot re-runs.

**Why.** Chat is the category we are defined against; it re-introduces the copy/paste and
context-switching we exist to remove. See [PRODUCT.md](./PRODUCT.md) and
[EXPERIENCE.md](./EXPERIENCE.md).
