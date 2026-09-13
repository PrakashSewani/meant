---
name: surface-adapter
description: Add support for a new site or app in Sayable by implementing a SurfaceAdapter that adds register inference only. Use when adding Gmail, Slack, LinkedIn, Jira, GitHub, Linear, Notion, or any new text surface, or when a site's DOM change breaks inference.
---

# Add a surface adapter

Sayable is **one product, not nine integrations**. The universal adapter handles all editable
fields; a site adapter only improves *inference*. It must never add behavior, and it must never
be required for the product to work.

## Before you start

Read [docs/EXPERIENCE.md](../../../docs/EXPERIENCE.md#7-surfaces-one-product-not-nine-features)
and the adapter contract there. Read the invariants in [AGENTS.md](../../../AGENTS.md) — especially
"nothing appears uninvited" and "native undo must survive every write."

## The contract

```ts
interface SurfaceAdapter {
  id: string;
  matches(url: URL): boolean;
  findEditable(el: Element): Editable | null;
  read(el: Editable): string;
  write(el: Editable, text: string): boolean;   // MUST preserve native undo
  replaceRange(el: Editable, range: Range, text: string): boolean;
  getSelection(el: Editable): { text: string; range: Range } | null;
  inferContext(el: Editable): RegisterHints;    // the whole point of a site adapter
}
```

## Steps

1. **Prove the universal adapter is insufficient.** Navigate the site with the extension
   installed and confirm the generic path finds the field but infers the wrong register. If the
   generic path is fine, **do not write an adapter** — that is a feature.

2. **Create `packages/adapters/src/<id>.ts`.** Keep it small (~30–60 lines). If it grows past
   that, the inference you're encoding probably belongs in shared heuristics, not one adapter.

3. **Implement `matches` and `findEditable` with resilient selectors.** Prefer semantic
   attributes (`[contenteditable]`, `[role="textbox"]`, `aria-label`, `name`) over generated
   class names. Never depend on a single brittle class.

4. **Implement `inferContext` — the real work.** Return `RegisterHints`, not a full Register:
   - field role (compose body / reply / comment / issue description / commit message)
   - visible recipient or participants
   - nearby labels/placeholders
   - thread text, if visible (marked for opt-in before it is ever sent)
   - a formality prior for the site
   Return `{}` when unsure — inference is a best guess the UI can correct, never a requirement.

5. **Implement reads/writes through the shared text-write helper.** Never use `execCommand`.
   Never replace `innerHTML`. After any write, assert the field is still undoable.

6. **Handle the site's reality.** Gmail's compose is an iframe (`all_frames: true` on a curated
   host). Some editors use their own selection model. If a site needs main-world access, document
   why — but prefer isolated-world DOM access.

7. **Register the adapter** in `packages/adapters/src/registry.ts` (order matters: specific
   before `generic`).

8. **Add a fixture test.** Save real DOM (HTML) from the site into
   `packages/adapters/src/__fixtures__/<id>/` and test: finds the right field, infers the right
   role/recipient, reads/writes text, and **a prior programmatic edit remains undoable**.

9. **Scope host access.** Add the minimum host pattern to the curated content-script list,
   justified in the PR. Sites outside the curated list get a runtime per-origin grant instead
   (D-004), followed by `chrome.scripting.registerContentScripts`. No `<all_urls>`.

10. **Update the surfaces table** in `docs/EXPERIENCE.md` and note the adapter in the roadmap
    milestone it belongs to.

## Decision rules

- **Adapter breaks after a site redesign?** The product must degrade to the universal path —
  never throw, never block. Inference returning `{}` is the correct failure mode.
- **Site needs behavior beyond inference?** Refuse. That is a roadmap conversation, not a
  surgical adapter change.
- **Rich editor inside a shadow root?** Use `composedPath()` from `event.target`; do not pierce
  closed shadow roots belonging to the page.
- **Twitter/X, Notion, Google Docs canvas?** They may not expose a normal editable node. If the
  universal adapter can't read/write, the adapter may be impossible — document that instead of
  shipping a fragile hack.

## Worked example: Linear

`matches` on `linear.app`. `findEditable` targets `[contenteditable][role="textbox"]` and the
description editor. `inferContext` detects issue description vs comment vs project update,
returns prior `terse-technical` and `format: "issue"`. Write path via the shared helper; fixture
test asserts undo survives. Registered before `generic`; host pattern
`https://linear.app/*`.

## Verify

- [ ] Adapter returns `{}` gracefully when DOM changes (no throw).
- [ ] Fixture tests pass, including the undo-preservation assertion.
- [ ] Removing the adapter leaves the universal path fully functional.
- [ ] Host permission is the narrowest viable pattern.
- [ ] `docs/EXPERIENCE.md` surfaces table updated.
