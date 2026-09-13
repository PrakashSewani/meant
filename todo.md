# Todo

Pending work, in the order I would take it. Completed work is in the git history and in
[docs/ROADMAP.md](./docs/ROADMAP.md); this file holds only what is still open.

**Nothing on this list starts until the previous item is verified.** The steps are in
[VERIFICATION.md](./VERIFICATION.md), and the rule is in [AGENTS.md](./AGENTS.md). An unverified
item is not finished, and a failing step is the next thing to fix — not a new item.

## Open

| #   | Item                           | What it is                                                                                                                                                              | Why it is next                                                                                                                                          |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Dogfood week**               | Use it daily for a week and read the accept rate in the popup.                                                                                                          | This is v0.1's exit criterion. Everything else exists to make this number real, and no amount of building replaces it.                                  |
| 2   | **Rich editor on a live site** | Ten minutes on Slack or Gmail with the real extension.                                                                                                                  | The documented top risk, and the only thing the fixture cannot stand in for. Do it before trusting anything else.                                       |
| 3   | **Voice memory**               | A local style profile — sentence length, formality, hedging, emoji, sign-off, banned phrases — injected into every prompt.                                              | The compiler already takes a descriptor and nothing fills it. Learning needs accepted edits to learn from, which the dogfood week produces.             |
| 4   | **Site adapters**              | Per-site inference of field role and recipient: Gmail's `To:`, a Slack DM header, Jira's issue-vs-comment.                                                              | The Who chip is never pre-filled today, so the most useful register signal is left to typing. Wants saved real DOM, so it wants the dogfood week first. |
| 5   | **Recipe library**             | The ~20 curated recipes across the families in EXPERIENCE §5, plus "Save as recipe".                                                                                    | Three universal recipes is the v0.1 plan; breadth is what makes it feel like a product.                                                                 |
| 6   | **Per-sentence accept**        | For long results: accept line by line instead of all at once.                                                                                                           | EXPERIENCE §3 promises it; the diff only helps if the granularity does.                                                                                 |
| 7   | **Passphrase vault**           | AES-GCM + PBKDF2 at rest, unlocked into `chrome.storage.session`, unlock on an extension surface only (D-003).                                                          | Keys are OS-protected today, which is D-003's no-passphrase case. This is the disclosed upgrade, not a fix.                                             |
| 8   | **Accessibility pass**         | ARIA live region for streamed results, `prefers-reduced-motion`, a full keyboard sweep of every surface.                                                                | EXPERIENCE §10 promises all three; the bar is keyboard-first and the rest has not been swept.                                                           |
| 9   | **Optional history**           | `meant.history`: the last N transforms, off by default, local, capped, wipeable.                                                                                        | Documented in ARCHITECTURE §5 and deliberately absent in v0.1.                                                                                          |
| 10  | **Redaction pass**             | Optional local stripping of emails, tokens, and phone numbers before send, per site.                                                                                    | Promised under the privacy posture; unbuilt.                                                                                                            |
| 11  | **Effort auto-tuning**         | Learn which Effort a recipe actually needs from accept/edit data.                                                                                                       | v1.x. The event log already records what it would need.                                                                                                 |
| 12  | **Firefox, i18n, store**       | A Firefox build (WXT makes it cheap), per-locale recipe bundles, a privacy policy, and the Web Store review question about the broad optional host declaration (D-004). | Distribution work, and the last thing before anyone outside this machine can use it.                                                                    |
| 13  | **Side panel**                 | Long documents and sectioned diffs, without it becoming a chat box.                                                                                                     | v2.0, and only if the register engine proves itself first.                                                                                              |

## Related

- [VERIFICATION.md](./VERIFICATION.md) — what to run before starting the next item.
- [AGENTS.md](./AGENTS.md) — the rule that makes this list a gate rather than a wish.
- [docs/ROADMAP.md](./docs/ROADMAP.md) — the milestones these sit inside.
