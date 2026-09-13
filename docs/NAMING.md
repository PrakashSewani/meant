# Name & Identity

This is a decision record, not a brainstorm dump. The repo currently holds the codename
**`meant`**. This document challenges it and recommends a name.

## Criteria

Scored 1–5. We care most about _distinctiveness_ and _meaning fit_, because those are what make
a name stick and stay ownable; searchability and spelling follow.

| Criterion           | Why it matters                                                 |
| ------------------- | -------------------------------------------------------------- |
| **Meaning fit**     | Does it evoke "turn intent into the right words"?              |
| **Distinctiveness** | Ownable, not a word everyone already uses a dozen times a day. |
| **Say / spell**     | Survives being said out loud and typed once.                   |
| **Sound**           | Feels good in a professional context; not cutesy, not cold.    |
| **Risk**            | Trademark crowding, unfortunate meanings, SEO dead zone.       |

## Candidates

| Name                           | Fit | Distinct | Say/Spell | Sound | Risk | Notes                                                                                                                        |
| ------------------------------ | :-: | :------: | :-------: | :---: | :--: | ---------------------------------------------------------------------------------------------------------------------------- |
| **Meant** _(current codename)_ |  5  |    2     |     5     |   4   | High | Tagline writes itself ("what you mean"). But it's an everyday word: terrible search, crowded mark, easy to mishear.          |
| **Sayable** _(recommended)_    |  5  |    5     |     4     |   5   | Low  | "Make what you mean sayable." Coined, ownable, warm, works as noun and verb-adjacent. Minor: reads like a utility (`-able`). |
| Register                       |  5  |    3     |     5     |   4   | High | Linguistically exact (register = formality/context of language) but overloaded: sign-up, CPU, audio, cash.                   |
| Timbre                         |  4  |    5     |     3     |   5   | Low  | "The color of a voice." Beautiful and ownable; pronunciation (TAM-ber) trips people.                                         |
| Subtext                        |  4  |    5     |     5     |   4   | Med  | Captures the hidden-intent layer, but connotes concealment/deception — wrong emotional read for a trust product.             |
| Utter                          |  4  |    3     |     5     |   4   | Med  | Short, means "to say," also intensifies ("utter clarity"). Likely taken.                                                     |
| Lilt / Verso                   |  3  |    5     |    4/3    |   5   | Low  | Evocative but obscure; nobody gets it without a footnote.                                                                    |

## Decision

**Recommendation: `Sayable`.**

Rationale: it names the _outcome_ the user wants ("make this sayable") in one coined word that
is easy to own, easy to say, and has no baggage. It works in a sentence — _"just make it
sayable"_ — which is the test most names fail. It also extends cleanly: the action is "sayable
it," the surface is the "Sayable bar," and the tagline is the existing one.

**Tagline:** _Say what you mean._ (Lineage: the original "turn what you mean into what you say"
keeps working in long-form copy.)

**Retained:** keep `meant` as the repository name and package scope for now (low-churn), and
expose the product name as a single brand constant so a rename is a one-line change:

```ts
// packages/core/src/brand.ts
export const BRAND = {
  name: 'Sayable',
  codename: 'meant',
  tagline: 'Say what you mean.',
  domain: 'sayable.app', // placeholder — verify availability before public launch
};
```

## Identity

- **Category we claim:** _the register layer for writing_ (not "AI writing assistant").
- **Voice:** plainspoken, warm, a little dry. It sounds like a sharp colleague, not a mascot and
  not a brand strategist. Never exclamation-heavy. Never "unleash your potential."
- **The one metaphor:** a translator for tone. You speak your language; it speaks the room's.
- **What we never say:** "prompt," "AI-powered," "supercharge," "10x your writing."

## Naming hygiene (before public launch)

1. Run a USPTO/EUIPO knockout search and a quick app-store / GitHub / npm availability check.
2. Check the `.com` / `.app` domain and the `@sayable` handle across the platforms we care about.
3. If `Sayable` is encumbered, fall back in this order: **Timbre → Lilt → Meant**.
4. Whatever is chosen, it lands in `BRAND` only — never hardcode the name in UI strings.

## Related docs

- [PRODUCT.md](./PRODUCT.md) — the thesis the identity serves.
