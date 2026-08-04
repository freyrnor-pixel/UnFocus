# 09 — Coloured count pill vs the grey summary sentence

**Size:** XS · **Blocked by:** 06 · **Copy-tone rules apply — CI-gated**

Read `00-INDEX.md` first if you haven't.

---

## The decision

**Design.** A small tinted pill holding just the number, sitting beside the card title
(`ui_kits/unfocus_app/HomeScreen.jsx`'s `CountBadge`, and the same thing inline in
`components/surfaces/HabitCard.jsx`):

```jsx
borderRadius: 'var(--r-full)', padding: '2px var(--sp-sm)',
background: `color-mix(in srgb, ${accent} 16%, var(--c-surface))`,
color: accent, fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)'
```

An accent-on-accent-wash pill: 16% of the hue as the fill, the full hue as the text.

**App.** A second line of muted grey text under the title
(`components/HomeNotesCard.tsx` around lines 205–210):

```tsx
<Text style={[styles.summary, { color: theme.textMuted }]}>
  {t.pad.summary(leftCount, notes.length)}
</Text>
```

styled `fontSize: FontSize.xs, fontFamily: Fonts.semibold, ...TabularNums` — with the comment
"Tabular figures so the four Home cards' counts line up down the screen."

So the app spends a whole line and a sentence where the design spends a pill. Across four
stacked Home cards that is four extra lines of grey chrome.

**Pick one:**

- **(a)** Coloured count pill, replacing the sentence
- **(b)** Keep the grey summary sentence
- **(c)** Pill for the number, and drop the sentence — same as (a), stated as a deletion
- **(d)** Pill **and** sentence

*Recommendation: **(a)/(c)**.* The pill is scannable at a glance and costs no vertical space;
the sentence is a second line per card that says the same thing more slowly. **Not (d)** — that
is strictly more chrome than today, and this whole folder exists because the app reads busier
than the design.

---

## Two things to preserve, whichever way you go

**1. Tabular numerals.** `TabularNums` from `constants/theme.ts` is on the summary for a
reason — the four Home cards' counts line up vertically down the screen. If the number moves
into a pill, **the pill's text still needs `TabularNums`**, or a `1` and a `7` will sit at
different widths and the column stops aligning. Easy to lose in a rewrite.

**2. The count comes from the FULL list, not from what's visible.**
`components/HomeNotesCard.tsx`'s header, edit note:

> The summary count is computed from the FULL list, never from what's visible: folding the
> card must not change the number.

That is a real invariant tied to `lib/padState.ts`'s `padVisibleRows` — `PadSheet`'s caller
slices the rows, and the count must not be derived from that slice. Read the value from the
store array, not from what you pass to `PadSheet`.

---

## Copy tone — this is CI-gated, and it applies here

If the sentence goes away, nothing to check. If you **write or reword** any string:

- `DESIGN_RULES.md` §7 (rules 22–25) is the rulebook; `lib/__tests__/copyTone.test.ts` fails
  the PR on a violation.
- Banned words in `lib/i18n.ts`: **"missed", "overdue", "forgot", "behind"**. A tray is
  "still due", never "missed".
- `VOICE.md` records the app's **one** deliberate first-person exception (the day log's empty
  state). Read it before adding first-person copy anywhere — there is deliberately not a second.
- Every string goes through `useT()` and must be added to **both** `en` and `no` in
  `lib/i18n.ts`. `no: typeof en` makes a missing Norwegian key a **compile error**, so `tsc`
  catches it — but write real Norwegian, not a copy of the English.

`t.pad.summary(leftCount, total)` is the existing key. If nothing else calls it, remove it
rather than leaving it orphaned.

---

## What to touch

The four Home cards, which is where this pattern lives:
`components/HomeNotesCard.tsx`, `HomeHabitsCard.tsx`, `HomeShoppingCard.tsx`,
`PlanTaskCard.tsx`. Do all four or none — a pill on one card and a sentence on the next is
worse than either.

**Which hue for the pill?** Whatever 06 decided. The design uses a 16% wash of the accent with
full-strength accent text; `lib/domainColor.ts` already exposes a `soft` variant
(`domainColor.soft`) which is the app's equivalent of that wash — `HomeNotesCard`'s mic button
already uses it. Reuse it rather than computing a new mix.

⚠️ **Contrast.** Accent-coloured text on a 16% wash of the same accent is the exact pattern
that fails WCAG when the hue is light. `--c-card-shop` is `#D9A441` gold; gold text on pale
gold is not readable. `colors.test.ts` asserts ratios for the palette but will not
automatically cover a new pairing you invent — check it, and fall back to `theme.text` on the
wash if the accent-on-accent version doesn't clear 4.5:1.

There is an existing component worth checking before building one: `components/Badge.tsx`.

---

## Verify

1. `npx tsc --noEmit` — also proves i18n key parity.
2. `scripts/test-changed.sh` — `copyTone.test.ts` if you touched `lib/i18n.ts`; report it.
3. `npm run preview` — one shot of Home with all four cards, to confirm the numbers still line
   up in a column.
4. `npm run wraps -- --lang=no --width=360` — the pill sits on the title line, competing with a
   Norwegian title. This is precisely the near-miss case the audit finds.

## Close out

Update the four cards' headers where the summary is described. Commit, PR into `main`, merge.
