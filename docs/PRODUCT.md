# Product Thesis

> **Meant** — write it messy, say it right, everywhere.
> Codename: `meant` (the repo). See [NAMING.md](./NAMING.md) for why the working name changed.

## 1. The reframe: this is a _register_ problem, not a writing problem

The instinct is to call this "an AI writing assistant." That framing is a trap. It puts you in
a crowded category (Grammarly, Monica, Sider, ChatGPT sidebars) and it describes the wrong job.

The real failure mode is not bad grammar. It is **register**: the same meaning has to be
expressed differently for a manager, a friend, a customer, a Jira ticket, a public LinkedIn
post, and a bug report. You know exactly what you want to say. You do not know how to say it
_here_ — and the cost of getting it wrong is social and professional risk.

So the product is not a grammar checker and not a chatbot. It is a **register layer** between
what you mean and what you send. One thought, many voices. You supply the meaning in your own
messy words; the product supplies the register.

**One-liner:** Meant turns messy intent into the right words for the room — in any text box,
without a chat thread.

## 2. Why the incumbents lose this job

| Approach                      | What it optimizes         | Why it fails here                                                                                            |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Grammarly**                 | Correctness + tone nudges | Tells you _what's wrong_. Still makes you do the writing, and it optimizes surface, not register.            |
| **ChatGPT / Claude web**      | General reasoning         | Context lives in a separate tab. You copy the situation out, paste the result back. Friction is the product. |
| **Monica / Sider / sidebars** | A chat box on every page  | A _second_ place to think. You still write the prompt, still copy/paste, still context-switch.               |
| **Raycast AI / launchers**    | Power-user commands       | Keyboard-elite, not in the field, not aware of the page's social context.                                    |
| **Notion/Gmail AI**           | In-app generation         | Trapped in one app. Inconsistent everywhere else.                                                            |

Every one of them makes you **learn prompt engineering** or **leave the text box**. Meant's
whole reason to exist is that it does neither: it meets the text where it already is and asks
only for the intent, not a prompt.

## 3. The core insight

> You already know what you want to say. You don't know how to say it to _this_ audience, in
> _this_ channel, at _this_ level of formality and detail.

Two consequences drive the entire product:

1. **Intent is cheap to produce; register is expensive.** So capture intent with near-zero
   effort (messy typing, voice-to-text, a few words) and spend all the "intelligence" on
   register selection.
2. **Register is mostly inferable.** The app you're in, the field's label, the conversation
   thread, whether it's a comment box or a DM, whether a recipient name is visible — these
   _are_ the register. Configuration should be a **correction**, never a form.

## 4. Principles

These are ranked. When two conflict, the lower number wins.

1. **Infer, don't interrogate.** Every default must be pre-filled and defensible. The user only
   touches what the machine got wrong.
2. **Meet the text where it is.** No copying. No second window. No context switch.
3. **The output is a diff, not a conversation.** You accept/reject text; you don't read a
   transcript. Chat is a tool we refuse to build.
4. **Fast path first, depth on demand.** One click for "say it better." Precision is one more
   gesture away, never in the way.
5. **Nothing leaves the device unless you send it.** Privacy is architecture, not a policy page.
6. **The model is a swappable part.** The intelligence is the register engine + inference +
   voice memory, not any vendor's weights.
7. **Never auto-obstruct.** The extension must not pop up over your writing uninvited. It earns
   attention only on an explicit gesture.
8. **Sound like the user, not like a model.** Rewrites should be indistinguishable from the
   user at their best.

## 5. Vocabulary (define it once, use it everywhere)

The product's language _is_ the product. We do not inherit the user's jargon or ours; we pick
terms that map to the mental model.

- **Intent** — the raw, messy, natural thing the user types. Not a prompt. Not a draft. Intent.
- **Register** — the bundle of _audience + tone + format + length_ that a piece of writing has
  to match. The unit of our intelligence.
- **Transform** — turning an Intent into text that fits a Register.
- **Recipe** — a named, reusable Register + instruction bundle ("Jira user story", "Reply to a
  customer apology", "LinkedIn launch post").
- **Register Bar** — the floating surface that appears near the selection.
- **Voice** — the user's learned style memory, stored locally. Makes output sound like them.
- **Correction** — a chip the user overrides before accepting. Corrections are the only
  "training" the product needs, and they stay on the device (see _register memory_).
- **Effort** — how much reasoning/cost a transform spends: _Quick · Balanced · Deep_.
- **As** — the bar's label for **format**. One concept, one name in docs, one label in the UI.

Notice what's **absent**: "prompt," "temperature," "system message," "chat." Those are
implementation words, and exposing them is the failure we're avoiding.

## 6. Who it's for

**Primary — "the fluent-adjacent professional."** Engineers, PMs, designers, support and sales
people who communicate constantly in writing and feel the friction: the Slack message they
rewrite four times, the Jira ticket they dread, the LinkedIn post they never publish, the
customer email they over-think. They are competent writers who are _slow_ because register
switching taxes them. They already pay for AI tools and would happily bring their own key.

**Secondary — "the non-native speaker."** Highly capable, but every professional message is a
register calculation. For them, the register layer is the difference between being heard and
being misread.

**Tertiary — "the privacy-constrained team."** People who _cannot_ paste work context into a
hosted chat product. BYOK + local models + local-only storage turns them from non-users into
users.

**Anti-personas (explicitly not for v1):** long-form authors and novelists; marketing teams
optimizing for SEO volume; anyone who wants a general chatbot; anyone who wants grammar linting
in every sentence. We will disappoint these people on purpose.

## 7. What "intelligence" means here

The differentiator is not access to a model — everyone has that. It is the **register engine**:
a stack that turns (messy intent + page context + user voice) into (a correct register + a good
prompt the user never sees).

Layers, in order of leverage:

1. **Context inference** — read the _surface_: site/app, field role (comment, DM, issue body,
   commit message, email compose), placeholder/label text, visible recipient, thread
   participants, form structure. Output: a best-guess Register.
2. **Register memory** — a local prior learned from the corrections you accept, keyed by surface
   and field role. Your edits are the training signal; nothing is uploaded, and an applied prior
   is always shown in the chip that carries it.
3. **Recipe resolution** — map the inferred Register to a curated transform playbook.
4. **Voice memory** — a local, compact profile of the user's accepted edits (lexicon, sentence
   length, formality baselines, signature phrases, banned phrases).
5. **Prompt compilation** — assemble the hidden prompt: intent + register + voice + guardrails.
   The user never writes it.
6. **Model routing** — send to the configured provider, at the configured Effort tier.
7. **Diff generation** — produce a reviewable, minimal change set, not a wall of new text.

Layers 1–4 and 7 are ours. Layer 6 is commodity by design.

## 8. Why it survives the novelty cliff

Most AI writing extensions are installed, tried once, and forgotten because they solve a
one-time curiosity, not a recurring pain. What makes Meant sticky:

- **A repeated painful task, hit constantly.** Not "write a blog post" (rare) but "answer this
  Slack message" (dozens of times a day).
- **Muscle memory.** One shortcut, the same gesture in every app. It becomes a reflex, not a
  destination.
- **It gets _better_ at being you.** Voice memory and register memory mean month three is
  noticeably better than day one — and better _in each specific room_ — a retention mechanic no
  stateless wrapper has.
- **Cost and trust you control.** BYOK + local option + no server means no surprise bills, no
  vendor lock-in, and no "where did my data go."
- **It removes shame.** The product's emotional job is to erase the "I'm bad at writing"
  feeling. That's a feeling people pay to be rid of.

## 9. Non-goals (v1)

Saying no is the strategy. Not in v1:

- No chat box, ever. No conversation transcript as the primary output.
- No grammar/style linting across every sentence. That is a different product.
- No team dashboards, analytics, or admin console.
- No summarization of arbitrary pages or browsing agent.
- No mobile apps, no desktop app (browser only).
- No _required_ hosted tier — BYOK and local are the default and the free path forever. An
  optional hosted tier with free trials is planned post-traction; see [ROADMAP.md](./ROADMAP.md).
- No marketplace. Recipes are local until they're proven.

## 10. Success signals

- **Activation:** % of installs where a transform is accepted within the first session.
- **The real metric — repeat:** transforms accepted per active day, and % of active days with
  ≥3 accepts (habit formation, not novelty).
- **Quality:** accept rate (accepted / generated) and _edit-then-accept_ rate (proxy for "close
  but not me").
- **Trust:** % of users on local/custom providers; zero unexplained network calls.
- **Retention:** week-4 retention of users who have accepted ≥10 transforms.

## Related docs

- [EXPERIENCE.md](./EXPERIENCE.md) — how the core interaction actually feels.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how it's built.
- [PROVIDERS.md](./PROVIDERS.md) — BYOK and the model layer.
- [ROADMAP.md](./ROADMAP.md) — what ships when, and what we cut.
- [NAMING.md](./NAMING.md) — the identity and name decision.
