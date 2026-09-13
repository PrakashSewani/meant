# Experience

The product's value is entirely in the interaction. This document specifies what the core loop
*feels* like, where the original concept was wrong, and how the pieces connect into one
coherent thing instead of a pile of per-app features.

## 1. The core loop

```
        messy intent                explicit gesture               right register
  ┌───────────────────────┐    ┌──────────────────────┐    ┌────────────────────────┐
  │ "ugh tell sarah the   │───▶│ Alt+J / ✦ grip click │───▶│ Register Bar (inferred │
  │  deploy slipped a day │    │  on the selection    │    │ defaults, one action)  │
  │  but we're on it"     │    └──────────────────────┘    └───────────┬────────────┘
  └───────────────────────┘                                            │
                                                                       ▼
                                              ┌─────────────────────────────────────┐
                                              │  Diff-first result: per-sentence    │
                                              │  accept/reject · refine chips ·     │
                                              │  replace / insert / copy            │
                                              └─────────────────────────────────────┘
```

Four verbs define the product: **Intent → Invoke → Transform → Accept.** Everything else is
detail.

## 2. Where the original concept was wrong (and what we do instead)

The brief proposed: describe or rough-write text → select it → a floating interface appears
around the selection → pick intelligent actions. Mostly right. Three corrections matter:

### 2.1 Govern the pop. Never appear uninvited.

A popover that appears on *every* selection is the classic "annoying extension." It fights the
OS's own selection UI, flickers in rich editors, and trains users to hate us.

**Instead:** the surface opens only on an **explicit gesture**. Raw selection shows nothing at
all — with the grip enabled for that site, it shows a small, non-intrusive mark (a 12px
affordance), and nothing else.

| Trigger | Behavior |
| --- | --- |
| Select text | Nothing, by default. With the grip enabled for this site: a small **grip** only — never a popover. |
| `Alt+J` (remappable, via `chrome.commands`) | Open the Register Bar on the selection. |
| Click the grip | Same as the shortcut (grip enabled per site first). |
| Right-click → *Sayable…* | Same, in the context menu. |
| Focus an empty field + the shortcut | **Compose mode**: the bar opens with an intent box. |

Why not `⌘J` / `Ctrl+J`: Chrome owns that family (Downloads, the DevTools console) and a page or
content script cannot reliably preempt it, so the default has to survive a stock Chrome profile.
The trigger is a real browser command, which also means users can remap it — and when their combo
is taken by something else, Chrome leaves it unassigned and the bar says so instead of silently
doing nothing.

The grip is **off by default** and enabled per site; after the first accepted transform we offer
it once (*"keep a grip here?"*). Grip, shortcut remap, and context sharing are all per-site
settings.

### 2.2 Collapse the two-step into one.

"Type messy, *then* select, *then* transform" is a three-beat dance. We support all three entry
shapes without forcing a sequence:

- **Polish** (most common): you typed something rough → select it → *Say it better*. One
  gesture, one accept. This is the fast path and it must be flawless.
- **Compose** (empty field): `Alt+J` → type the messy intent in the bar's own input → it writes
  into the field. For when you don't even want to type badly *in the document*.
- **Ask** (no text at all): the same Compose input accepts "write a reply declining this
  meeting" — still not a chat, because the output goes into the field, not into a thread.

### 2.3 Keep depth available without building a control panel.

The brief worried, correctly, about a "giant configuration panel." Our answer is **progressive
disclosure with pre-filled, visibly-inferred defaults.** The bar opens *collapsed* — one button.
Depth is one tap away. Nothing is ever blank.

## 3. The Register Bar

Anatomy. Two states: **collapsed** (default) and **expanded** (on demand).

**Collapsed — the fast path (what 80% of uses see):**

```
   ┌───────────────────────────────────────────────┐
   │  ✦  Say it better            Quick ▾     ⏎    │
   └───────────────────────────────────────────────┘
          Inferred: Slack reply · to Sarah · casual
```

**Expanded — the deep path:**

```
   ┌───────────────────────────────────────────────────────────┐
   │  ✦  Say it better                          Quick ▾   ⏎    │
   ├───────────────────────────────────────────────────────────┤
   │  Who     [ Sarah (manager) ▾ ]        ┐                   │
   │  Tone    [ Direct, warm ▾ ]           │  pre-filled from  │
   │  As      [ Slack reply ▾ ]            │  inference; each  │
   │  Length  [ Short ▾ ]                  ┘  chip is editable │
   │                                                           │
   │  ┌─────────────────────────────────────────────────────┐  │
   │  │ Anything else? e.g. "blame is on us, offer a fix"   │  │
   │  └─────────────────────────────────────────────────────┘  │
   │                                                           │
   │  Effort   Quick · [Balanced] · Deep      ⚙ model: Sonnet  │
   └───────────────────────────────────────────────────────────┘
```

Rules for the bar:

- **Every chip shows its inferred value.** If inference is confident, it's pre-selected. If not,
  the chip reads *"Who? (guessing: Sarah)"* — never empty, never a blank form.
- **Only four chips matter:** Who · Tone · As (format) · Length. Effort is a slider. Model is a
  settings-level default, not a per-use decision. That's the whole vocabulary.
- **Chips show provenance.** Inferred, learned (*"direct — you usually pick this here"*), or
  guessed (*"guessing: Sarah"*). Learned values are always visible and resettable; a silent
  learned default reads as a bug.
- **The free-text box is the escape hatch**, not the primary input. Most transforms never touch
  it. It's how power users get precision without prompt engineering.
- **Keyboard-first.** `Alt+J` to open, `Tab` through chips, `⏎` to transform, `Esc` to dismiss.
  A user can complete the entire loop without touching the mouse.

**Result state — diff-first:**

```
   ┌───────────────────────────────────────────────────────────┐
   │  ~ I can't make tomorrow's standup — the deploy slipped    │
   │    a day. It's on us and we're on it; you'll have a fix    │
   │    by EOD.                        [Keep] [Undo]        │
   ├───────────────────────────────────────────────────────────┤
   │  Shorter · Softer · More formal · Add a next step · ↻      │
   └───────────────────────────────────────────────────────────┘
```

- **Show the change, not a paragraph.** Inline diff (strike/underline) so trust is immediate.
- **Per-sentence accept for long transforms** (docs, stories): accept line by line.
- **Refinement chips** are the "conversation." They replace a chat thread: each chip is a
  one-shot, reversible edit on the current result. `↻` means try again.
- **Never lose the intent.** The original messy text is always one `⌘Z` away.

## 4. The inference engine (the actual moat)

Configuration is a fallback; inference is the product. At invoke time we compute a best-guess
Register from cheap, local signals:

| Signal | Examples | Infers |
| --- | --- | --- |
| **App/site** | mail.google.com, app.slack.com, linkedin.com, *.atlassian.net, github.com | Default format + formality prior |
| **Field role** | compose body, comment box, issue description, commit message, DM composer, form textarea | Format (`As:`), length prior |
| **Placeholder/label** | "Write a comment…", "Describe the bug", "Add a description" | Format, expected detail |
| **Visible recipient** | To: field, DM header, thread @mentions, PR assignee | `Who:` |
| **Thread context** | last few messages in the visible thread (opt-in) | Tone matching, concessions, next-step awareness |
| **Field contents** | greetings, sign-offs, punctuation, emoji, "Hey" vs "Dear" | Tone baseline, formality |
| **User Voice** | local style profile from accepted edits | Phrasing, length, banned words |
| **Your corrections** | chips you overrode before accepting (Tone: casual → direct) | Learned register priors, per surface and field role |

**Confidence drives the UI.** High confidence → chip pre-filled, invisible. Low confidence →
chip shows a guess and invites a tap. This is what keeps the bar to one line most of the time.

Inference runs **locally** (no network). It is heuristic in v1 (rules + site adapters), and it
grows a local memory of your corrections (register memory) rather than learning remotely. It
never sends page content anywhere to make a guess.

## 5. Recipes: intelligence without prompt engineering

A **Recipe** is a named Register + instruction bundle. Recipes are how a user gets "a Jira user
story" or "a customer apology" without writing a prompt.

- **Curated set ships with the product** (see below). These are playbooks, not templates.
- **Users can save any transform as a Recipe** ("Save as recipe") after they accept it — the
  four chips + free-text they used become reusable. This is the *only* way users "write
  prompts," and it happens by demonstration, not configuration.
- Recipes are **local-first**, shareable as a file/URL later (v2).

Shipped Recipe families:

| Family | Examples |
| --- | --- |
| **Work chat** | Slack reply, standup update, ask for help, push back, decline |
| **Email** | Reply to manager, escalate, apologize, follow up, cold outreach |
| **Engineering** | Jira user story, bug report, PR description, commit message, incident update |
| **Customer** | Support reply, apology + remediation, release note, changelog |
| **Docs** | README section, API doc, explainer, runbook step |
| **Public** | LinkedIn post, launch announcement, comment reply |
| **Universal** | Say it better · Make it shorter · Make it clearer · Fix tone · Bulletize · Summarize |

Each Recipe declares: target register, a hidden prompt template, guardrails (e.g. *never invent
commitments*), and a preferred Effort tier.

## 6. Voice: it should sound like you, not like a model

A local, private **Voice profile** learned from accepted edits. Not a fine-tune — a compact
descriptor injected into every prompt: typical sentence length, formality range, hedging habits,
emoji policy, sign-off style, a small lexicon, and an explicit **banned-phrases** list (both the
user's own and the AI's tells: "I hope this email finds you well").

Surfaced in exactly two places: a read-only **"Your voice"** card in settings (with per-item
toggles so it's controllable, not opaque) and the `⌘Z` of a bad transform. Never a dashboard.

## 7. Surfaces: one product, not nine features

The trap is "support Gmail, Slack, LinkedIn, Jira, GitHub…" as nine integrations. We build **one
adapter contract** and thin adapters. The experience is identical everywhere; only the inferred
Register changes.

**The adapter contract** (every supported field implements):

```ts
interface SurfaceAdapter {
  id: string;                       // "slack", "gmail", "generic"
  matches(url: URL): boolean;
  findEditable(el: Element): Editable | null;   // textarea | input | contenteditable
  read(el: Editable): string;                   // get current text
  write(el: Editable, text: string): boolean;   // replace text, preserve undo
  replaceRange(el: Editable, range: Range, text: string): boolean;
  getSelection(el: Editable): { text: string; range: Range } | null;
  inferContext(el: Editable): RegisterHints;    // role, recipient, thread, placeholder
}
```

**The universal adapter** handles everything else: `<textarea>`, `<input type=text>`, and
`[contenteditable]`. This single adapter is what makes "arbitrary text fields" work — and it
covers a surprising amount, because Slack, Gmail, LinkedIn, and Jira are *all* contenteditable
rich editors. So the "generic" path is the main path, not a fallback.

**Site adapters only add inference**, never behavior. A site adapter is ~30–60 lines: recognize
the field role, find the recipient, grab nearby labels. If a site adapter breaks (DOM change),
the universal adapter still works — degraded inference, never a broken product.

| Surface | What the adapter adds |
| --- | --- |
| Gmail | Detect compose vs reply; read `To:`; prior = semi-formal email |
| Slack | Detect DM vs channel; read thread + participants; prior = casual, short |
| LinkedIn | Detect post vs comment vs DM; prior = polished-professional, public-facing |
| Jira | Detect issue description vs comment; prior = structured (As a…/I want…/So that…) |
| GitHub | Detect PR body vs issue vs review comment; prior = terse-technical, markdown |
| Forms | Detect label/placeholder; prior = precise, field-shaped answer |

**Rich-editor reality check:** Slack/Gmail/LinkedIn use `contenteditable` with their own
selection models, sometimes inside iframes (Gmail's compose is an iframe) and Shadow DOM. The
adapter layer must: read/write via `document.execCommand`-free DOM surgery that preserves
native undo, handle iframe injection (`all_frames: true` for known hosts only), and render our
bar in a **closed Shadow DOM with `all: initial`** so page CSS can't touch it. This is the
highest-risk engineering area — see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 8. States & microcopy

Copy is part of the design. Plain, short, human.

| State | Surface |
| --- | --- |
| Idle grip | *(unlabeled 12px mark)* |
| Collapsed bar | `✦ Say it better` + inferred register line |
| Loading | Streaming text into a ghost overlay; `Esc` cancels; no spinner-only void |
| Empty result | *"Nothing to change — it's already clean."* |
| Error (provider) | *"Couldn't reach Anthropic. Check your key in Settings."* + `Open settings` |
| Error (rate limit) | *"Rate limited. Try Quick effort or another model."* |
| Low confidence | Chip shows *"guessing: Sarah"* |
| No key configured | First-run only: *"Add a key or run a local model — takes a minute."* |
| Vault locked | *"Unlock to transform."* → opens the options page. Never a passphrase field in the page. |
| Shortcut taken | *"Chrome owns that shortcut. Remap it, or use the grip."* + `Open shortcuts` |
| Refused/unsafe | *"I can't invent commitments you didn't state."* (guardrail, not a scold) |

## 9. Anti-patterns we refuse

- ❌ Auto-popover on every text selection.
- ❌ A persistent chat sidebar.
- ❌ A settings modal in the critical path.
- ❌ Requiring the user to write or see a "prompt."
- ❌ Silently rewriting the whole document when the user selected one sentence.
- ❌ Sending page/thread context without an explicit, remembered, per-site opt-in.
- ❌ Toasts, badges, streaks, or growth-hack nagging.
- ❌ Making the user choose a model per transform.

## 10. Accessibility & input methods

- Full keyboard operation of the entire loop; visible focus rings; ARIA `role="dialog"` on the
  bar with a live region announcing streamed results.
- Respects `prefers-reduced-motion`; no animation required to understand state.
- Works with dictation: Voice-to-intent is a first-class input (the user speaks messy; we
  register it) — the natural fit for "I'm bad at writing."
- Localization-ready copy; Recipes are per-locale bundles.

## Related docs

- [PRODUCT.md](./PRODUCT.md) — why this experience, for whom.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the bar, adapters, and inference are built.
- [ROADMAP.md](./ROADMAP.md) — which surfaces and Recipes ship when.
