# Roadmap

Scope discipline is the strategy. Each milestone ships **one complete loop** and explicitly
refuses everything else. If a feature isn't listed here, it isn't happening yet.

## Guiding rules

1. **One loop, then more places.** Nail Intent→Invoke→Transform→Accept on the generic adapter
   before adding a single site-specific integration.
2. **Every milestone must keep the fast path one gesture.** Nothing ships if it makes the
   collapsed bar slower.
3. **No surface ships until native undo survives it.** A broken undo is a broken product.
4. **Each new provider/surface is data or ~60 lines, never a new subsystem.** If it needs more,
   the abstraction is wrong.
5. **Ship the privacy controls with the feature that needs them**, not later.

---

## v0.1 — "One loop, done well" _(internal dogfood)_

The whole product, at minimum, on the most generic surface.

- **Surface:** universal adapter only — `<textarea>`, `<input type=text>`, `[contenteditable]`.
- **Mode:** Polish (select rough text → transform in place) and Compose (invoke in an empty
  field → write the intent in the bar → the answer lands in the field).
- **UI:** the Register Bar, collapsed + expanded. Four chips (Who/Tone/As/Length) + Effort.
- **Recipes:** three universal ones — _Say it better_, _Make it shorter_, _Fix the tone_.
- **Providers:** curated presets (Anthropic plus a few `openai-compatible` vendors) and Ollama /
  LM Studio on loopback, **plus a custom OpenAI-compatible endpoint** for anything not listed. The
  origin is granted at runtime when you enable one (D-004).
- **Trigger:** `chrome.commands` (`Alt+J` default, remappable) plus the context menu; the grip is
  off by default. A browser-owned shortcut can never be the default.
- **Measured:** the inference golden corpus lands _with_ the register engine, not after it —
  "register is mostly inferable" has to be a number before it's a bet.
- **Privacy:** no transform history, no context capture, keys in local storage only, and a local
  event log that records register metadata — never text — so accept rate is a number rather than a
  feeling.
- **Invocation:** the browser shortcut, the context menu, and the grip — off by default, offered
  once after the first accepted transform, per site (invariant 4).
- **Result:** inline diff when the change is a light edit, refinement chips (Shorter · Softer ·
  Plainer · More formal · Add a next step) and ↻ for a one-shot re-run.
- **Learns locally:** register memory from the chips you keep correcting, shown in the chip, one
  reset at a time (D-005).
- **Retries:** transient provider failures retry in the worker, never after text has been shown.
- **Deliberately absent:** voice memory, site adapters, the recipe library, sync.

**Exit criteria:** I use it daily for a week; accept-rate on my own transforms ≥ 60%; native undo
verified on textarea + a contenteditable editor; inference goldens green on the fixture corpus.

---

## v1.0 — "Everywhere, one loop" _(public beta)_

The version that proves it isn't a one-trick novelty.

- **Compose mode:** `Alt+J` on an empty field opens an intent box; output lands in the field.
- **Site adapters (inference only):** Gmail, Slack, LinkedIn, Jira, GitHub. Each adds recipient/
  role/thread inference; all fall back to the universal adapter.
- **Recipe library:** ~20 curated recipes across the families in
  [EXPERIENCE.md](./EXPERIENCE.md#5-recipes-intelligence-without-prompt-engineering).
- **Voice memory v1:** local style profile + banned-phrases; a read-only "Your voice" card.
- **Register memory v1:** local priors from accepted chip corrections, keyed by surface and field
  role — shown in the chip, resettable per item.
- **Vault unlock:** passphrase entered on an extension surface only; locked transforms fail closed
  with _Unlock to transform_.
- **Result UX:** inline diff, per-sentence accept for long output, refinement chips, retry.
- **Providers:** presets + **Provider doctor** + **OpenCode config import** + passphrase vault.
- **Privacy:** per-site opt-in for context sharing, a preview of exactly what will be sent,
  optional redaction, and a "Local — nothing leaves this device" badge for loopback providers.
- **Distribution:** Chrome Web Store (or self-hosted `.crx` for a technical audience first).

**Exit criteria:** works end-to-end on all five surfaces without breaking native undo; p95
first-token < 2.5 s on Quick; a fresh user reaches a first accepted transform in < 60 s.

---

## v1.x — Depth without weight

- **Custom providers:** arbitrary base URLs behind a runtime per-origin grant (D-004). **Shipped in v0.1** — the options page carries the form, so this left v1.x.
- **More surfaces:** Linear, Notion, Outlook Web, Zendesk, Discord, X/Twitter, Google Docs.
- **Recipe portability:** save any accepted transform as a recipe; export/import as JSON.
- **Firefox build** (WXT makes this cheap) and an i18n pass (recipes become per-locale bundles).
- **Effort auto-tuning:** learn which Effort a Recipe really needs from accept/edit data.
- **Voice controls:** per-item toggles for lexicon, length, emoji, sign-offs.
- **Per-field polish:** never send a transform that would replace more than the user selected.

---

## v2.0 — The register engine gets smart

Only after v1 data proves the heuristics are the limiting factor.

- **Learned register inference** (on-device) replacing/augmenting rules, fed by accept/edit
  signals, never by uploading content.
- **Side panel for deep work:** long documents, sectioned diffs, multi-step transforms — without
  becoming a chat box.
- **Optional recipe sharing:** a URL/file format; no marketplace until demand is proven.
- **Enterprise-managed config:** a remote/managed provider policy (same pattern as OpenCode's
  managed settings) for teams that must pin providers or forbid cloud models.

---

## Beyond v2 — only if it earns it

**Conditional, not planned.** These ship only if the extension earns durable traction, and none
of them may weaken the local/BYOK path or the privacy posture. See
[DECISIONS.md](./DECISIONS.md#d-002--local-only-now-accounts-sync-and-a-hosted-tier-are-deferred).

### Accounts + cross-device sync

- Sign-in is **optional**; the extension is fully functional with no account, forever.
- Sync is **end-to-end encrypted**: the server stores ciphertext only and can never read keys,
  Voice, or recipes. Losing the passphrase means losing the data — stated up front.
- Sync scope is user-chosen: preferences and recipes by default; keys and Voice only on explicit
  opt-in.

### First-party hosted tier with free trials

- Offered as a **convenience**, so a non-technical user can try it in one click without hunting
  for a key — the on-ramp BYOK lacks.
- Implemented as **one more provider preset** (`meant`, OpenAI-compatible transport) behind the
  same interface. No architectural fork, no privileged code path.
- Free trials need server-side metering, quotas, and abuse controls; metering must be **visible to
  the user**, and it is the _only_ new outbound destination this adds.
- **Anti-lock-in rule:** the hosted tier is never ranked above the user's own providers in the
  picker, never made the silent default, and never gates an existing feature. If it's good, it
  wins on merit.

**Exit criteria to even start:** week-4 retention above target, and a clear signal that BYOK setup
friction (not output quality) is the main driver of drop-off.

## Explicitly not on the roadmap

| Not doing                         | Why                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A chat interface                  | It's the category we're defined against. Refinement happens in-place.                                                     |
| Grammar/style linting everywhere  | Different product; we transform, we don't nag.                                                                            |
| Team analytics / admin dashboards | Not the job; invites surveillance creep.                                                                                  |
| Browsing agent / page summarizer  | Bloats permissions; dilutes the register story.                                                                           |
| Mobile / desktop apps             | The browser is where the text is.                                                                                         |
| A _required_ hosted tier          | BYOK/local stay the free, private path forever. An optional hosted tier is planned only after traction — see "Beyond v2". |
| Autopilot (send without a human)  | This is a typing aid, not an autonomous agent.                                                                            |

## Risk register

| Risk                                         | Likelihood | Impact | Mitigation                                                                                                              |
| -------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Rich-editor breakage (Gmail/Slack DOM churn) | High       | High   | Universal adapter is the real path; site adapters only add inference; fixture tests per surface.                        |
| "Another writing extension" perception       | High       | High   | Lead with the _register_ story and the no-chat-box, no-prompt promise; demo the 3-second loop.                          |
| BYOK setup friction                          | Medium     | High   | Presets, OpenCode import, a working local path, and the Provider doctor.                                                |
| Provider CORS/auth surprises                 | Medium     | Medium | Two transports only; doctor classifies failures; ship known-good presets.                                               |
| Popover fatigue → uninstall                  | Medium     | High   | Never pop uninvited; grip is off by default and opt-in per site.                                                        |
| Trust/privacy incident                       | Low        | Severe | No backend by default, no telemetry by default, honest threat model, local option, E2E-encrypted sync if accounts ship. |
| Hosted tier read as a privacy reversal       | Medium     | High   | Keep BYOK/local the default; label the hosted tier plainly; never gate existing features.                               |
| Free-trial abuse / runaway cost              | Medium     | Medium | Server-side rate limits, per-account quotas, model caps, clear trial copy.                                              |
| Incentive to favor our own model             | Medium     | High   | Managed provider is a preset like any other; never ranked by revenue, never a silent default.                           |
| Prompt injection via page content            | Medium     | High   | Untrusted-data framing, opt-in context, previewed payloads.                                                             |
| Register inference weaker than the thesis    | Medium     | High   | Inference goldens from v0.1; register memory turns corrections into priors; chips stay overridable.                     |
| Shortcut collision / unassigned command      | High       | Low    | `chrome.commands` + grip + context menu; detect unassigned shortcuts at install and say so.                             |

## Related docs

- [PRODUCT.md](./PRODUCT.md) — the thesis and the anti-personas behind these cuts.
- [EXPERIENCE.md](./EXPERIENCE.md) — the interaction each milestone must preserve.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — build order and abstractions.
