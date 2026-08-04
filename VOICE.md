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

The banned words are checked mechanically over both `en` and `no`: `missed`, `overdue`,
`gikk glipp`, and their neighbours. A medicine tray is **still due**, never missed. Habits
have no negative kind and no broken streak. A goal's strength floors at neutral and can never
read as failing. The reward backdrop's floor is exactly the art the app always had, so a
lapsed streak never returns you to a visibly worse screen.

None of that is a stylistic preference. It is the product.

---

## The exception: one first-person line

**`t.dayLog.empty` in `lib/i18n.ts` is the only first-person sentence in the app.**

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

- **One line. There is not a second.** Do not add another first-person string anywhere in
  this feature or elsewhere. If a new empty state needs explaining, it uses `StarterCard`
  and the app's normal voice (rule 25).
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
