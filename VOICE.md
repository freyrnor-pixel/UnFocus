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

## ⚠️ The "one line" limit was lifted on 2026-08-19 — the narrator

**Read this before the section below it, which is now history plus a still-valid argument.**

The maintainer asked for a **narrator quote system**: an "empty-state narrator" with a
"witty, non-judgmental UnFocus narrator voice", replacing every generic empty-state
placeholder (`Ingen oppgaver`, `Tom liste`) across To-do, Shopping, Health and Habits. The
lines are first person by construction — the required Health line is *"did you take your meds,
or think really hard about taking them? (no judgment — mine are still on the counter)"*.

So the exception below is no longer one line, and "there is not a second" is no longer the
rule. What replaced it is **narrower than "first person is fine now"**:

- **Where.** Only where there is nothing to instruct — an empty list, and nothing else. Every
  *instruction* and every *label* in the app stays second person, and rule 22 is untouched for
  them. A narrator line never appears beside content, only instead of it.
- **What.** `lib/narratorQuotes.ts` holds every line; `components/NarratorQuote.tsx` is the
  only thing that renders one. There is no second implementation and no inline first-person
  string anywhere else. If a surface wants a narrator line, it mounts the component.
- **Register.** *The narrator admits things; the user is never told what they did.* A joke
  about the user's memory told by an app is a verdict. The same joke told about the narrator's
  own memory is company. That distinction is the whole licence.
- **Still bound by rule 23, harder than the rest of the app.** Nothing counts, compares, or
  can tell how long the screen has been empty — no "still nothing here", no day counter, no
  line that reads differently on an emptier screen. And nothing asks for anything: if a line
  can be reworded as "you should…", it is the wrong line.
- **One carve-out, as a ratchet.** `glem*` / `forgot` / `gleym*` stay banned in `lib/i18n.ts`,
  where they can only ever point at the user. Two narrator lines are *about* forgetting and
  are the anti-shame content itself, so `lib/__tests__/narratorQuotes.test.ts` allows the stem
  only in an explicit set of exact strings. Entries may be removed, never added.

The reasoning in the section below is why the *day log's* line is right, and it still is —
that line is unchanged and is not a narrator quote. Read it as the argument that made this
system defensible, not as a cap that still applies.

---

## The (former) exception: one first-person line

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

- ~~**One line. There is not a second.**~~ **Lifted 2026-08-19 — see the narrator section at
  the top of this file.** What survives of it: do not hand-write a first-person string
  anywhere. An empty state that wants the narrator's voice mounts
  `components/NarratorQuote.tsx`; an empty state that needs *explaining* still uses
  `StarterCard` and the app's normal second person (rule 25). The two are different jobs and
  co-exist on the same card — Habits shows the narrator where its rows would be, and
  StarterCard's "Forslag" drop-down under it.
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
