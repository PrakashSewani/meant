# Name & Identity

**The product name is `Meant`.** That is the owner's decision, taken on 2026-09-13: the working
name was right, so it stops being a codename and becomes the name. The analysis below is kept as
the record of how the alternatives were weighed, not as a live recommendation.

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

| Name                     | Fit | Distinct | Say/Spell | Sound | Risk | Notes                                                                                                                        |
| ------------------------ | :-: | :------: | :-------: | :---: | :--: | ---------------------------------------------------------------------------------------------------------------------------- |
| **Meant** _(chosen)_     |  5  |    2     |     5     |   4   | High | Tagline writes itself ("what you mean"). But it's an everyday word: terrible search, crowded mark, easy to mishear.          |
| **Sayable** _(rejected)_ |  5  |    5     |     4     |   5   | Low  | "Make what you mean sayable." Coined, ownable, warm, works as noun and verb-adjacent. Minor: reads like a utility (`-able`). |
| Register                 |  5  |    3     |     5     |   4   | High | Linguistically exact (register = formality/context of language) but overloaded: sign-up, CPU, audio, cash.                   |
| Timbre                   |  4  |    5     |     3     |   5   | Low  | "The color of a voice." Beautiful and ownable; pronunciation (TAM-ber) trips people.                                         |
| Subtext                  |  4  |    5     |     5     |   4   | Med  | Captures the hidden-intent layer, but connotes concealment/deception — wrong emotional read for a trust product.             |
| Utter                    |  4  |    3     |     5     |   4   | Med  | Short, means "to say," also intensifies ("utter clarity"). Likely taken.                                                     |
| Lilt / Verso             |  3  |    5     |    4/3    |   5   | Low  | Evocative but obscure; nobody gets it without a footnote.                                                                    |

## Decision

**`Meant`.** The word carries the whole thesis — the gap between what you mean and what you say is
the product's reason to exist — and it is short enough to work as a noun and a verb ("meant it").
Its weakness is the same as its strength: an everyday word means real search and trademark risk,
which has to be worked before launch.

**Tagline:** _Say what you mean._ (Lineage: the original "turn what you mean into what you say"
keeps working in long-form copy.)

The name lives in one constant, so a future rename stays a one-line change:

```ts
// packages/core/src/brand.ts
export const BRAND = {
  name: 'Meant',
  codename: 'meant',
  tagline: 'Say what you mean.',
  domain: 'meant.app', // placeholder — verify availability before public launch
};
```

## Identity

- **Category we claim:** _the register layer for writing_ (not "AI writing assistant").
- **Voice:** plainspoken, warm, a little dry. It sounds like a sharp colleague, not a mascot and
  not a brand strategist. Never exclamation-heavy. Never "unleash your potential."
- **The one metaphor:** a translator for tone. You speak your language; it speaks the room's.
- **What we never say:** "prompt," "AI-powered," "supercharge," "10x your writing."

## Naming hygiene (before public launch)

1. Run a USPTO/EUIPO knockout search and a quick app-store / GitHub / npm availability check. It
   matters more for an everyday word than it did for a coined one.
2. Check the `.com` / `.app` domain and the `@meant` handle across the platforms we care about.
3. If `Meant` is encumbered, fall back in this order: **Timbre → Lilt → Sayable**.
4. Whatever is chosen, it lands in `BRAND` only — never hardcode the name in UI strings.

## Related docs

- [PRODUCT.md](./PRODUCT.md) — the thesis the identity serves.
