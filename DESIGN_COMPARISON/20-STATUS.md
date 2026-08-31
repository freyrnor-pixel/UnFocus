# 20 — The mockups against the app, screen by screen

Checked 2026-08-31 against `main` at `83b1a98`, built and driven at 390×800, dark, English, with
the three mockups rendered beside it using the app's own hues in place of their missing
`styles.css`. Pixel figures come from sampling the built preview, not from reading source.

⚠️ **Read the date.** An earlier version of this file was written against a branch that was 43
commits behind `main`, and several of its "outstanding" rows had already been built. If this file
and the app disagree, the app is right and this file is stale — re-run the capture rather than
trusting it.

Three verdicts, and the middle one carries the most information:

- **Done** — the app does what the mockup asks.
- **Deliberately different** — the app does something else *and there is a written reason*, usually
  a maintainer ruling the mockup did not have in front of it. Not a TODO. Changing one means
  reopening the decision under it.
- **Outstanding** — the mockup asks for something the app does not do, and nothing argues against it.

---

## The nine global fixes

| # | Mockup's instruction | Status |
|---|---|---|
| 1 | Glass had nothing to blur — put light behind the cards | **Done.** The backdrop wears the active tab's hue on the corner discs. Corners peak at L 0.0098–0.0129; the mid-gutter, where cards sit, is `rgb(0,0,0)` on every tab. |
| 2 | Control cluster drifted — one order, one size | **Done.** Fold → caller's controls → ⤢, ⤢ at `IconSize.compact`. Not literally two icons: a card may still pass its own (Katalog's lock, Medicine's bell). |
| 3 | Accents are tokens, not hexes | **Already true.** The mockups are the ones carrying literals. |
| 4 | Glow spent on chrome — never blue on a pink or cyan screen | **Mostly done, and measurable.** `useControlHue` fixed every `IconButton`, and the expanded pane provides its own hue. Scanning the five tabs for strongly-blue pixels: Habits **0**, Health **0**, Home **0** (its 51 violet px are the Notes badge) — but Shop **1379** and To-do **530**, all `#298AFF`. See Outstanding #1. |
| 5 | Cards were mostly hint text — one slot, two lines | **Done.** One component, one mount site, and only on a card that has content. |
| 6 | Counts read as failure — words instead of a bare `0` | **Done.** 16 cards carry a peek; a zero count is not drawn beside one. 156 peeks measured at 360px Norwegian, 0 over budget. |
| 7 | The tab bar clipped the stack | **Done, both ends.** 9.5px top, 11.0px bottom. |
| 8 | Stray artefacts — loose dots, a hard black rule inside I dag, hairlines under every header | **Two of three.** The header hairline is gone. **The black rule inside Today is still drawn** — measured `rgb(23,23,23)` across a card whose pane is `rgb(36,36,36)`. See Outstanding #2. |
| 9 | Composer was inconsistent — one quick row | **Done, and past the mockup.** The registry's `compose` table is bound to the real cells, and "More options" carries the whole draft, not just the typed name. |

---

## Hjem / Home

| Mockup fix | Status |
|---|---|
| Energy was a lone glowing pill — make it a slim card with three chips | **Half.** The pill is the screen's gold now, not blue. It is still a lone pill in an otherwise empty card rather than Low · Middle · High. See Outstanding #3. |
| I dag was empty apart from a quote and a stray black rule | **Half.** Rows and composer are right; the rule survives (Outstanding #2). |
| Remove ⋮ from I dag and the mic from Notater | **Mic done.** The ⋮ is **deliberately different** — it is the per-card Manage-cards menu that replaced the deleted "Edit cards" mode, so removing it takes away the only way to retire a card. |
| Notater collapsed with a peek line | **Done** — "None yet". |

## Gjøremålsliste / To-do

| Mockup fix | Status |
|---|---|
| Replace the `0` badges with peek lines | **Done** — "Nothing this week yet", "Nothing this month yet", "Nothing waiting". |
| Praktiske mål / Tidligere dager as group rows with counts | **Done** — `sub`-tier rows inside the Today card. |
| Quick add below the rows it adds to | **Done.** |
| Last card no longer under the tab bar | **Done** — 11px clearance. |

## Handleliste / Shop

| Mockup fix | Status |
|---|---|
| The bullet-list hint card at the top becomes one hint line inside Handlelister | **Outstanding.** Still the first thing on the screen, still owned by no card. See Outstanding #4. |
| Empty state is one line and one button; the nested inner card with two competing links is gone | **Outstanding.** Still a card-inside-a-card with a heading, a subtitle, "Start empty" and "Saved lists" — and both links are the blue of Outstanding #1. |
| Katalog loses its camera and lock from the header | **Camera gone; lock stays, deliberately.** The 2026-08-20 instruction was *"the two buttons for camera and lock should be in the top part instead"* — the mockup argues against a maintainer ruling, so only the half with no ruling behind it moved. |
| Mat keeps its count because 66 is information | **Done, and now says it twice** — `66` beside the title and "66 dishes" underneath. See Outstanding #5. |

## Vaner / Habits

| Mockup fix | Status |
|---|---|
| Show habits with their rings and counts | **Content done.** The control is **deliberately different**: `0/1` with a −/+ pair rather than a ring, so un-counting is possible (2026-08-06). |
| Personlige mål as a group row with a count | **Done.** |
| Remove the hairline divider and the loose dots | **Hairline done.** The dots are the backdrop's particle layer. |
| Rings use a shame-free muted track | **N/A** — no rings; the neutral counter carries the same principle. |

## Helse / Health

| Mockup fix | Status |
|---|---|
| Denne uken logs the week | **Done.** |
| The blue bell halo on Medisin is gone; the glow is pink | **Done** — verified by pixel, and Health now scans 0 blue pixels. |
| Helseplager 0 becomes a peek line; drop the lone open-in-new button | **Peek done.** The button is **deliberately different** — it opens the sheet where a symptom is added or untracked, made a header control on purpose (2026-08-26). |
| Hint trimmed to one line | **Done** — two lines maximum, absent while the card is empty. |

---

## What the mockups got wrong, and the app does not copy

Full evidence in `20-MEASUREMENTS.md`; listed so a later round does not "restore" them.

1. **Chrome translucent enough that content reads through it while scrolling** — card text is
   legible through the mockup's topbar and collides with its nav labels.
2. **A peek line that truncates 7 of 8 times in English**, the shorter language.
3. **A Manage cards sheet at ≈1.2:1 in light mode**, and 3 of 7 card names truncating.
4. **A backdrop wash strong enough to fail AA for three of five identity hues.**
5. **29/32/40px tap targets** — the app takes the smaller visual and keeps the 48px reach.

---

## Outstanding

1. **Blue on a hued screen, in the hand-rolled action pills.** `#298AFF` still covers 1379px of
   Shop and 530px of To-do — "Start empty", "Saved lists", "Put the day away". `Button` and
   `IconButton` both resolve the screen hue; the ~18 pills that draw themselves
   (`AppModal`'s dialog buttons, bottom-sheet Dones, scan's confirm bar) do not. One shared
   resolution plus a scan banning a raw `theme.accent` fill in a screen-scoped control.
2. **The stray black rule inside Today** — `rgb(23,23,23)` on a `rgb(36,36,36)` pane. On the
   mockup's own "stray artefacts" list; the loose dots and the header hairline went, this did not.
3. **The Energy strip is still a lone pill in an empty card.** Right colour, wrong shape: the
   mockup's slim three-chip card is the round's oldest unbuilt instruction.
4. **Shop's two stacked framing problems** — the ownerless bullet card at the top, and the
   card-inside-a-card empty state with two competing links. One screen, both changes.
5. **`Food 66` / "66 dishes" says the same number twice.** Either suppress a count the peek
   already states, or drop the peek where the count is the whole story.
