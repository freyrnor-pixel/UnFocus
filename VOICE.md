# VOICE.md — how the app talks, and the one place it breaks its own rule

**Status:** the rules here are not new. They live in `DESIGN_RULES.md` §7 (rules 22–25) and
are enforced in CI by `lib/__tests__/copyTone.test.ts`. This file exists for one reason: to
record a **deliberate exception** so that a later session doesn't "fix" it.

Read `DESIGN_RULES.md` §7 first. This is a footnote to it, not a replacement.

---

## The rules, in one paragraph

Plain, short, **second person**, present tense. Say what a control does, not how the system
works. **No guilt, no urgency, no judgment** — never "You missed…", never a countdown, never
a verdict on a quiet day. An action keeps its name through the whole flow. Empty states give
direction, not mood.

**A sentence is the exception (rule 22a, 2026-08-17).** The line under a labelled row is a
fragment with no full stop; a full sentence is reserved for a consequence the user is about to
accept, for the guided tour (one lead line + bullets), and for the narrator voice below.

The banned words are checked mechanically over both `en` and `no`: `missed`, `overdue`,
`gikk glipp`, and their neighbours. A medicine tray is **still due**, never missed. Habits
have no negative kind and no broken streak. A goal's strength floors at neutral and can never
read as failing. The reward backdrop's floor is exactly the art the app always had, so a
lapsed streak never returns you to a visibly worse screen.

None of that is a stylistic preference. It is the product.

---

## The exception: the narrator voice

**⚠️ This section said "the only first-person sentence in the app" until 2026-08-17, and had
been wrong since 2026-08-02.** `energyPause.*` shipped that day with a header of its own
declaring "Narrator voice: first person", and `energyMeter.boostHint` followed on 2026-08-03
("tomorrow starts from **my** normal amount again"). Neither author came here to update the
count. So the exception covers **three surfaces** (five keys), not one line — the correction is
recorded rather than quietly applied, because "there is exactly one" was the load-bearing claim
and it has to be visibly retired:

| Key | Line |
|---|---|
| `dayLog.empty` | "I remember the big things…" (below) |
| `energyPause.sheetLine` | "That's more than a day's worth. **Mine** usually is too." |
| `energyPause.afterDecide` / `afterGood` | "The rest keeps. This is the one." / "Fair. Some days you just go." |
| `energyMeter.boostHint` | "…tomorrow starts from **my** normal amount again." |

All three meet the same test, and it is the test — not the count — that decides whether a
fourth surface is ever allowed: **the app has nothing to instruct, and its ordinary register
would deliver a verdict.** An empty day, an overspent day, a borrowed day. Everywhere else the
app labels a control, and second person is right.

These are also the one place rule 22a's "a sentence is the exception" does not apply — the
narrator speaks in sentences, and compressing one to a fragment turns a person into an
interface again.

---

### `t.dayLog.empty` — the original, and still the clearest case

> **NO:** Jeg husker de store tingene. Det er alt imellom som forsvinner — særlig det som
> skjedde midt i kaoset.
>
> **EN:** I remember the big things. It's everything in between that disappears — especially
> what happened in the middle of the chaos.

It is the empty state of the day log (`lib/dayLog.ts`) — the screen you see on a day with
nothing recorded yet, and on the earlier-days screen for a day that has nothing on it.

### Why it is allowed to break rule 22

Every other string in the app is an *instruction* or a *label*, and second person is right
for those: the app is telling you what a control does. This one is neither. It is the
**reason the feature exists**, said in the voice of the person it was built for.

An empty day log has nothing to instruct. "Tap to add your first note" would be a lie about
what the surface is for — the log fills itself from what you already do, so there is nothing
to add and nothing to set up. And the app's usual register ("Nothing recorded today") would
be a *verdict on a quiet day*, which rule 23 forbids more strongly than rule 22 forbids first
person. Saying why the record exists is the only thing an empty day can honestly say.

### The limits on the exception

- **Three surfaces, and a fourth needs the maintainer.** The bar is the test above, not a
  quota — but it is a high bar, and "this empty state feels flat" does not clear it. If a new
  empty state needs explaining, it uses `StarterCard` and the app's normal voice (rule 25).
  Whatever you decide, **update the table above in the same edit** — that is the step every
  previous author skipped, which is why this file was wrong for two weeks.
- It is marked with a comment at the key in `lib/i18n.ts`. Keep that comment if you touch
  the surrounding block.
- It is still bound by rule 23. It names a difficulty; it does not blame anyone for it, and
  it does not evaluate the day.

---

## Copy rules specific to the day log

Stricter than the app's baseline, because this surface is a record you check when your head
says you did nothing:

- **No count, total, percentage or rate.** Not even a friendly one. A chaotic day yields a
  low number and a low number is a verdict. Enforced structurally by
  `lib/__tests__/dayLog.test.ts`, which source-scans for aggregate derivations.
- **No evaluation.** No praise, no summary judgement, no "productive day".
- **No header on the past section.** Labelling it `Completed` / `Gjennomført` turns a record
  into a scorecard. The entries are self-explanatory.
- **Never** `Summary` / `Oppsummering`, `Progress` / `Fremgang`, `Statistics` / `Statistikk`,
  or any translation of those.
- "Nothing fixed left today." is a neutral statement of fact — not an invitation, not
  encouragement. Keep it that way.

---

## Adding a string

1. Add the key under `en` in `lib/i18n.ts`.
2. Add the Norwegian under `no` — `no: typeof en` makes a missing key a compile error, so
   `npx tsc --noEmit` is the check.
3. `npx jest lib/__tests__/copyTone.test.ts` if you are anywhere near the banned list.

Norwegian is the primary voice of this app, not a translation target. Write it as a native
sentence rather than a rendering of the English one.
