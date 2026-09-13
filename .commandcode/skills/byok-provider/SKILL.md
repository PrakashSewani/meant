---
name: byok-provider
description: Add or change a BYOK provider or model preset in Meant — pick the transport, wire the preset and host permission, store the key in the vault, and prove it with a doctor test. Use when adding a provider, model, gateway, or local model to the extension's config.
---

# Add a BYOK provider

The model layer is a swappable part. Adding a provider is **data plus one verification test** —
if it needs a new subsystem, stop and reconsider the abstraction.

## Before you start

Read [docs/PROVIDERS.md](../../../docs/PROVIDERS.md) and the hard invariants in
[AGENTS.md](../../../AGENTS.md). Two rules dominate this task:

- **Keys never go in the shareable config.** They belong in the encrypted vault
  (`meant.secrets`), decrypted only in the service worker during a call.
- **Only the service worker calls providers.** Never add a fetch path from a content script.

## Steps

1. **Pick the transport.** Exactly two exist:
   - Provider speaks the Anthropic Messages API (`/v1/messages`) → `anthropic`.
   - Provider is OpenAI-shaped (`/v1/chat/completions`) → `openai-compatible`.
     If a provider offers both, prefer `openai-compatible` unless it is Anthropic itself.
     Record the choice in the preset's `npm` field: `@ai-sdk/anthropic` or
     `@ai-sdk/openai-compatible`.

2. **Add the preset** to `packages/config/src/presets.ts`, following the existing shape:

   ```ts
   {
     id: "groq",
     name: "Groq",
     transport: "openai-compatible",
     baseURL: "https://api.groq.com/openai/v1",
     auth: "apiKey",
     local: false,
     models: [
       { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", tier: "fast" },
     ],
     notes: "Very fast Quick tier.",
   }
   ```

3. **Scrub secrets.** If you copied the preset from real user config, ensure no literal key
   survives. A key in the config file must trigger the `key-in-config` warning path, never be
   silently accepted.

4. **Scope the host permission narrowly.** Add the exact origin to the **bounded
   `optional_host_permissions` list** — never a wildcard, never `<all_urls>`. The origin is
   granted at runtime when the user enables the preset (D-004), so the UI copy must say what the
   grant is for. For loopback providers add `http://localhost/*` / `http://127.0.0.1/*` (Chrome
   wildcards the port) and set `local: true` so the UI shows the "nothing leaves this device"
   badge.

5. **Set the browser-CORS note.** For Anthropic, confirm the transport auto-adds
   `anthropic-dangerous-direct-browser-access: true`. For anything known to block browser
   origins (e.g. OpenAI), keep the note so error copy can explain it. Custom headers go in
   `options.headers`, never in the shareable config.

6. **Register the tier mapping.** Ensure the preset can satisfy Quick/Balanced/Deep
   (`small_model`/`model`/`reasoning_model`). If a provider has no fast model, say so in the
   preset rather than pretending.

7. **Add the doctor contract test.** In the provider test file, add an opt-in smoke test that
   sends a 1-token ping through the new transport, skipped when the key env var is absent. It
   must assert the classified error (`auth`/`cors`/`network`) on a bad key, not just the happy
   path.

8. **Validate.** Run `pnpm validate:config` and `pnpm test`. Every preset must parse against the
   Zod schema and expose at least one model per tier it claims.

9. **Document.** Add a row to the preset table in `docs/PROVIDERS.md`. If the provider needs a
   non-obvious step (Azure deployment names, a gateway account id), write it in the notes column
   and in the preset `notes`.

## Decision rules

- **Unknown provider shape?** Try `openai-compatible` first; it covers the overwhelming
  majority. Fall back to `anthropic` only for Anthropic-compatible endpoints.
- **Key exposed via `{env:...}` or `{file:...}` during OpenCode import?** Browsers have neither
  — prompt once, store in the vault, and never write the resolved value back to the config.
- **Local model?** Mark `local: true`. Do not require a key. Do not add a cloud fallback.
- **Gateway vs direct?** Both are just `openai-compatible` with a different `baseURL`; do not
  build a gateway abstraction.
- **A provider with a non-preset origin?** Supported: the options page has a custom
  OpenAI-compatible form (id, base URL, model ids, key) whose origin is granted at runtime
  (D-004). Add a preset anyway when a provider is common — a preset is a custom endpoint someone
  already got right, without the typing.

## Worked example: Groq

Transport `openai-compatible`, base URL `https://api.groq.com/openai/v1`, one fast model for the
Quick tier. Host permission `https://api.groq.com/*`. No special headers. Doctor test pings
`/chat/completions` with `max_tokens: 1`, skips without `GROQ_API_KEY`, and asserts a bad key
classifies as `auth`. Add the row to the PROVIDERS preset table with the note "very fast Quick
tier."

## Verify

- [ ] `pnpm validate:config` passes.
- [ ] Doctor test passes with a key, and classifies a bad key correctly without one.
- [ ] No key appears in `meant.config`; the origin is in the bounded optional list and granted
      at runtime.
- [ ] `docs/PROVIDERS.md` preset table updated.
