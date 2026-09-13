# Verification

The gate between one item and the next. Run this before starting anything in
[todo.md](./todo.md): an item is not finished until someone has watched it work in a real
browser, and a failing step is the next thing to fix.

Write what happened next to the step — a line saying it passed, or what it did instead. "It did
not work" with no observation is not a result; the console, the error text, and what you saw are.
Telling the agent is enough; the agent writes the outcome back here.

## 0. Setup (once per build)

```bash
pnpm install
pnpm --filter @meant/extension build
```

- [ ] Load `apps/extension/.output/chrome-mv3` at `chrome://extensions` → Developer mode → Load
      unpacked. Reload it after every rebuild.
- [ ] Options → pick a provider → paste a key → **Save and enable**. The provider permission
      prompt appears once. The doctor runs itself and reports a row per model.
- [ ] Every row is ✓. A ✗ says which kind of failure it was — key, model id, origin, network. Fix
      by that name, not by guessing.
      **Result:**

## 1. The fast path

- [ ] Popup → **Enable on all sites** → allow. One prompt, and every site works from then on.
- [ ] On any page with a text box: type something rough, select it, press `Alt+J`
      (`⌘J` on macOS once Chrome remaps it).
- [ ] The bar appears next to the selection, holding focus, with no request sent yet.
- [ ] `⏎` transforms. `⏎` again accepts. The selection is replaced and the rest of the page is
      untouched.
- [ ] `⌘Z` once gives the original words back.
      **Result:**

## 2. Compose mode

- [ ] Click into an **empty** field and invoke. The bar opens an intent box.
- [ ] Type a messy intent. `⌘⏎` transforms, `⌘⏎` again accepts, and the answer lands in the field.
- [ ] Do the same in a field that already has text: the intent box starts with that text.
      **Result:**

## 3. Chips, diff, refinements

- [ ] Click a chip (Who, Tone, As, Length, Effort) → it becomes an editor in place → type →
      `Tab` or `⏎` commits it. Escape abandons it.
- [ ] The next transform uses the edited value — not the one that was shown before.
- [ ] After a light edit, the result shows struck-through and underlined changes; **Show result**
      flips to the plain text.
- [ ] A refinement chip (**Shorter**, **Softer**, **Plainer**, **More formal**, **Add a next
      step**) re-runs on the result rather than starting over. `↻` tries again.
      **Result:**

## 4. Register memory

- [ ] Change the same chip twice on the same site and accept both times.
- [ ] On the third invoke, that chip carries a dot and a title saying it was learned.
- [ ] Settings → **What it has learned** lists it, and **Forget** removes it.
      **Result:**

## 5. The grip

- [ ] After the first accepted transform on a site, the offer appears once — _"Keep a grip here…"_.
- [ ] Answer **Keep it**, select something on that site: the grip appears at the end of the
      selection, and clicking it opens the bar.
- [ ] It disappears on scroll, on a click elsewhere, and never appears on a site that said no.
      **Result:**

## 6. Rich editors — the one only you can run

- [ ] Slack: select a rough message in the composer, invoke, accept. The text is replaced, the
      rest of the message survives, `⌘Z` restores.
- [ ] Gmail: the same, inside the compose iframe.
- [ ] Note anything that breaks — a lost selection, a duplicated write, undo that does not
      restore, a bar in the wrong place. These are the failures the fixture cannot show.
      **Result:**

## 7. Failure paths

- [ ] Press the shortcut with no key configured: the bar says so and offers settings.
- [ ] Turn the network off mid-transform: a retry happens, then the error is classified, not
      swallowed.
- [ ] Invoke on a page where Meant is off: the toolbar icon carries a `!` and a title explaining
      it, rather than nothing at all.
      **Result:**

## 8. The number

- [ ] After a week of daily use, read **Accepted this week** in the popup.
- [ ] The target is **≥ 60%**. Write the number and, more usefully, the two or three transforms
      you rejected and why — that is what the next item should be built from.
      **Result:**

## Rules

1. **No step is skipped because it looks fine in code.** The suite proves what the code does, not
   what the browser does with it.
2. **A failure stops the line.** Fix it before starting anything from [todo.md](./todo.md).
3. **Write the observation, not the verdict.** "The bar opened bottom-right instead of by the
   selection" is worth ten "broken"s.
