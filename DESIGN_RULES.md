# Design Rules — Visual & General

**Status:** Invariants. Treat these as build criteria, not suggestions.
**Adopted:** 2026-07-30. **Audit:** `DESIGN_RULES_AUDIT.md` (rule-by-rule pass/fix/conflict).
**Enforced by:** `lib/__tests__/designTokens.test.ts`, `lib/__tests__/copyTone.test.ts`,
`lib/__tests__/colors.test.ts`, `lib/__tests__/screenRhythm.test.ts` — these run in CI on
every PR into `main`.

These exist to fix recurring visual problems — spacing, placement, color, order,
hierarchy — by removing the per-decision guesswork. When a rule gives a number,
use that number; don't reinvent it per screen. Every rule is grounded in
universal-design practice (WCAG 2.2 and the W3C cognitive-accessibility
guidance) and tuned for the app's neurodivergent-first principles: predictability
and low noise beat novelty every time.

If a new screen or feature would violate one of these, the rule wins — change the
design, not the rule.

> **Where a rule and the shipped code disagree, see [Open conflicts](#open-conflicts--pending-maintainer-decision)
> at the bottom.** Those are listed, not silently resolved: the code is unchanged
> until the maintainer rules on each one. A rule with an open conflict is not yet
> an invariant — it's a proposal.

> **Numbers live in code, not in prose.** `constants/theme.ts`, `constants/colors.ts`
> and `constants/motion.ts` are the source of truth for every value below. Where a
> rule restates a number, the token wins. This doc points at tokens rather than
> copying them, because copying is how `HANDOFF_SPACING_PASS.md`'s 18px phantom card
> padding happened — a documented standard the code never had. Several of the older
> `*_LIBRARY.md` files have drifted the same way (see the audit's "Stale docs" note);
> trust `constants/` over any prose, including this file.

---

## 1. Spacing

1. **Use a fixed spacing scale only.** The scale is `Spacing` in `constants/theme.ts` —
   no arbitrary values. Most "spacing feels off" problems disappear when every gap
   comes from this set. *(Open conflict #1: the proposed 4/8/12/16/24/32 and the
   shipped 4/8/16/24/32/48 are not the same set.)*
2. **Minimum 16px padding inside any card** (`Spacing.md`). Content never touches a
   card edge. Inside a pad/notepad card the one horizontal inset is `PAD_GUTTER` —
   don't add a second one.
3. **One gap between top-level cards on a screen, and the SCREEN owns it.** The token is
   `SCREEN_GAP` (`constants/theme.ts`), declared as `gap` on the screen's scroll-content
   container; **a card must not carry a vertical margin of its own.** Pinned by
   `lib/__tests__/screenRhythm.test.ts`.
   *(Rewritten 2026-08-08. It read "minimum 12px between sibling cards; minimum 24px between
   distinct sections", which is unenforceable as stated — it makes spacing a property of the
   child, and every card then declares its own. Measured before the pass, one column on the
   To-do tab ran 8 → 40 → 0 → 0 px: `PlanTaskCard` said `marginBottom: Spacing.sm`,
   `SectionCard`/`CollapsedSection` said `marginTop: Spacing.xl`, and `SubScreenLinkButton`
   said nothing at all, so the only thing separating two link cards was the 8px key-base
   sliver `Surface` draws under a tappable card. Home ran the whole screen at 8. The
   minimums were being met and the screen still read as arbitrary, because a rule with a
   floor and no ceiling does not produce a rhythm.)*
3a. **Proximity is still the grouping signal — express it by GROUPING, not by spacing.**
   Things that belong together go in one card as rows; things that don't get their own card.
   With every gap equal, a difference in spacing carries no information, so the card boundary
   has to carry it instead. Worked example: the To-do tab's "Goals" and "Earlier days" were
   two separate full-width cards indistinguishable from the content section above them, and
   were two rows in one card (`SubScreenLinkButton`), and since 2026-08-10 are one
   `components/CollapsedSection.tsx` drawer each — the app's single shape for "a surface this
   screen leads to", shared with Habits' Goals and Shopping's Food/Catalogue. The grouping
   point stands either way: what says "these are not sections of this screen" is that they are
   a different KIND of card, not that they sit further apart.
   **A closed `Collapsible` still books a gap slot** — it stays mounted at zero height — so
   an always-mounted, sometimes-empty child must be grouped or conditionally rendered, or it
   pays for a gap it does not use.
4. **One idea per row.** Never place two unrelated controls on the same
   horizontal line. The row anatomy that implements this is `components/PadRow.tsx`
   (see AGENTS.md "The row rule").
   *(One instructed exception, 2026-08-10: `components/CollapsedSection.tsx`'s header carries
   both a name that opens the surface and a chevron that expands a preview of it. They are the
   same idea at two depths — look at it here / go to it — not two unrelated controls, and both
   are ≥ `MIN_TAP_TARGET`. Don't generalise it into "section headers can carry a second
   control".)*
5. ~~**Whitespace over lines.**~~ **OVERRULED 2026-08-05 — borders are now the
   grouping signal.** The maintainer's card-design reset says the opposite of this
   rule, in as many words: *"Borders around cards, buttons, text-boxes, options and
   so on for separating them."* Every card, row, field, option cell and button now
   carries a visible border, graded by importance through the screen's own hue
   (`computeBorderRamp`/`computeBorderTone`, `constants/theme.ts`). This is a
   deliberate reversal, not drift — do not "restore" rule 5 by stripping borders.
   What the reset kept from it: **dividers** are gone (the notepad rules and the
   quick-add panel's hairlines were both deleted), so the app separates with
   *boundaries*, never with *lines between things*. Spacing still does the work
   between sections; borders do it between peers. *(This resolves former open
   conflict #8's first half — see the conflicts table.)*

## 2. Placement & order

6. **Exactly one primary action per screen,** visually dominant, placed top or
   bottom-center — never floating mid-screen. If two actions feel equally
   primary, one of them isn't.
7. **Order content by what the user needs first, not by data category.** On
   Home: today → next action → everything else. The most-needed thing is never
   below the fold.
8. **Same element, same position, every screen.** Back, ⓘ, and the primary
   button always land in the same place app-wide. Predictability lowers
   cognitive load more than any visual polish. `components/ScreenHeader.tsx` is
   what guarantees this for headers — route new screens through it.
9. **Layout is stable — nothing jumps.** Never reflow, reorder, or inject
   content after a screen has loaded. Reserve space for things that load
   asynchronously so the layout doesn't shift under the user's thumb.
   *(Open conflict #8: first-visit ⓘ hints auto-expand; `NewSinceGlow` paints late.)*

## 3. Color

10. **Body text ≥ 4.5:1 contrast; large text ≥ 3:1; non-text UI ≥ 3:1 (WCAG AA).**
    Check every theme, light and dark. This is a hard floor, not a target.
    **Already enforced** — `lib/__tests__/colors.test.ts` asserts it over the palette
    in both modes; `contrastOn()` and `contrastRatio()` (`constants/theme.ts`,
    `constants/colors.ts`) are the helpers. Add new colour tokens to that test in the
    same edit that adds the token.
10a. **Five DARK-mode assertions were relaxed on 2026-08-10, by instruction, when the
    true-black palette landed.** Light is untouched and still at full strength. Listed here
    because a relaxed bound with no record is indistinguishable from drift, and because two of
    them are worth arguing about again if a device ever disagrees. The reasoning for each lives
    beside it in the test file — read that before moving any of them further.
    | What | Was | Now | Kind |
    |---|---|---|---|
    | halation band, `text` on `surface` | 7–12:1 | 7–**16**:1 | a real accessibility trade — see below |
    | `surfaceMuted`↔`surfaceInset` step | ≥1.10 | ≥1.05 | arithmetic: `bg` at `#000000` leaves no room |
    | `rule` lower bound | ≥1.2:1 | ≥1.1:1 | keeps the supplied `#27272A`; the `<3:1` upper bound stands |
    | `accentInk` on `accent` | ≥4.5:1 | ≥3.0:1 | structural: `#3B82F6` admits no AA ink in either direction |
    | chromatic tokens on `bg`/`surface` | ≥4.5:1 | ≥4.4:1 | `bad` `#EF4444` measures 4.43 |
    **The halation one is the only one with a cost, and it was accepted knowingly.** The ≤12
    ceiling existed because near-white text on a dark surface blooms for astigmatic readers —
    the most common dark-mode legibility complaint there is — and it is why `text` was pulled
    back from `#E9EDF5` to `#C7CBD1` in 2026-07-31's addendum. It was overridden in favour of
    an outside review's contrast-first palette. **If a real-device complaint arrives, pull
    `text` back toward `~#D8DADF` and lower the ceiling with it — do not darken a surface to
    chase it.** The ceiling still exists and still catches the runaway case; it now sits at
    the shipped value plus headroom rather than at the comfort threshold.
11. **Never use color as the only signal.** Pair it with an icon or text label.
    Status, selection, and meaning must survive in greyscale.
12. **One accent color for actions, plus a neutral grey scale.** Add semantic
    colors (success / warning / error) only where they carry meaning, and keep
    them muted, not saturated. *(Open conflict #5: the app runs one additional
    identity-hue system on purpose, `lib/domainColor.ts`'s 4-hue card identity.
    `lib/screenColor.ts`'s 9 screen hues were a SECOND such system until
    2026-07-31 (addendum A.5) retired it — zero production consumers as of
    2026-08-04's DESIGN_COMPARISON/06, which reaffirmed keeping it retired.)*
13. **Low-saturation backgrounds by default.** Reserve the highest contrast on a
    screen for the single thing you want looked at.

## 4. Visual hierarchy

14. **Max three type sizes per screen:** title, body, caption. Signal hierarchy
    with size and weight — not also with color. *(Open conflict #3.)*
15. **One focal point per screen.** If everything is emphasized, nothing is.
    Spend emphasis once. This is also the rule that governs `getGlow()` — the
    purposeful halo is for the one active/focused surface, never decoration.
16. **Max two font weights in use at a time.** Regular for body, one heavier
    weight for emphasis. More than that reads as noise. *(Open conflict #4.)*

## 5. Interaction & targets

17. **Every tappable target ≥ 48×48px** with ≥ 8px of dead space
    around it, so nothing is hit by accident. The token is `MIN_TAP_TARGET`
    (`constants/theme.ts`); when the visual control is smaller than that, expand the
    hit area with a `HitSlop` token rather than growing the art — that's what
    `components/IconButton.tsx` does (`Math.max(MIN_TAP_TARGET, size + Spacing.sm)`).
    Never hardcode `48` — or `44` — or a bare `hitSlop` number. *(Open conflict #6: three
    deliberate sub-target row/control heights.)*
    **48, not 44, since 2026-08-08** — Material Design 3's touch target, adopted on the
    maintainer's instruction and clearing WCAG 2.2's 44 with margin. It is the ONE thing
    taken from MD3: adopting MD3 as a *look* would fight decisions already made on purpose
    here (`Radius.md` was reduced 18→16 for a calmer corner; colour is confined to the
    border). Don't "restore" 44 by citing WCAG. `PAD_ROW_MIN_HEIGHT` — the pad composer
    line, a real text field — tracks the token; `PAD_ROW_HEIGHT` (38) deliberately does not.
    Note `MIN_TAP_TARGET_FLOOR` in `lib/designLab.ts` stays 44 and has now diverged on
    purpose: that is the accessibility floor the lab may tune down to, not the app's default.
18. **Visible keyboard/focus state on every interactive element.** Focus is
    never invisible.
19. **Destructive or irreversible actions require a confirm step; everything
    else is immediately reversible (undo).** The app must be safe to explore —
    a user should never fear tapping something. Existing vocabulary: `undoBtn`,
    and "This cannot be undone." on every confirm body in `lib/i18n.ts`.
19a. **A boolean is always a slider.** An on/off setting or flag is rendered with
    `Switch` (`components/FormControls.tsx`) — coloured track when on, grey when
    off — never a checkbox, a pill, a chip, a tick, or a highlighted row. One
    shape, everywhere. This does not apply to a list row's own completion check
    (that's `PadRow`'s `○`, not a setting), a `SegmentedControl`/`TabSlider`/
    `SlideSelector` (3+ options), or a multi-select chip row (tags, weekdays,
    people) — those are membership or choice, not on/off. (`DESIGN_COMPARISON/
    15-toggles-always-sliders.md`.)

## 6. Motion

20. **Respect the OS reduce-motion flag, and provide an in-app "Reduce motion"
    setting.** When either is on, disable all non-essential animation.
    **Already implemented** — `useAccessibility().reducedMotion` (`lib/useAppTheme.ts`)
    is the union of the in-app toggle and a live `AccessibilityInfo` subscription.
    Full guidance: `ANIMATION_GUIDELINES.md` §7.
21. **Motion must mean something.** Animate to show where something came from or
    went, or to connect a cause to its effect. Never animate for decoration.
    Keep essential transitions short (≤ 200ms feel) — use `Duration.*` from
    `constants/motion.ts`, never a raw millisecond literal. Timing, easing and
    spring values: `ANIMATION_GUIDELINES.md` §1–2.

## 7. Copy (words are design material)

> This section has no other home in the repo — it is the one genuinely new
> rulebook here, and the part most worth enforcing. `lib/__tests__/copyTone.test.ts`
> checks it over both `en` and `no` in `lib/i18n.ts`.

22. **Plain, short, second person, present tense.** Say what a control does, not
    how the system works. "Save changes," not "Submit."
23. **No guilt, no urgency, no judgment.** Never "You missed…", never a
    countdown. This is a hard rule, not a stylistic preference — it's core to
    the app's purpose. The established precedent: a medicine tray is never
    "missed", an untaken dose is "still due" (AGENTS.md); habits have no negative
    kind and no broken streak; a goal's strength floors at neutral and can never
    read as failing. *(Open conflict #7: the proposed blanket ban on "!" also
    catches the 13 celebratory strings — "Nice work!", "All done!" — which are the
    opposite of guilt.)*
24. **An action keeps its name through the whole flow.** The button that says
    "Publish" produces a toast that says "Published." Consistent vocabulary is
    how users learn their way around.
25. **Empty and error states give direction, not mood.** An empty screen says
    what to do next; an error says what happened and how to fix it, in the
    interface's voice — never a vague apology. The implementation of this is
    `components/StarterCard.tsx` + `StarterExampleRow.tsx` — an explainer plus one
    concrete example row, gone once the user has their own.
25a. **An example must not be mistakable for content.** The example row is drawn as a
    provisional sketch — dashed neutral border, no fill, muted italic title — plus its
    "Example" chip; only its "+" carries the accent, because that is a real action.
    *(Reversed 2026-08-10, from the report "Examples are not visible examples, they look
    like a part of the card or an active task, not as a temporary thing." The previous
    rule, from the opposite report on 2026-07-27, was that the suggestion should be
    "designed the same as other rows in app" — it copied a live row's wash, border, padding
    and full-strength title, and succeeded so completely that a one-word chip was the only
    thing left distinguishing it. Read `components/StarterExampleRow.tsx`'s Edit notes
    before restoring any of it.)*

---

## Open conflicts — pending maintainer decision

Eight rules contradict a shipped, deliberately-made decision. **Nothing in the code
was changed for any of them.** Each needs a ruling: either the rule bends, or the
code does. Until then, treat the rule as proposed, not binding — and don't "fix"
one of these in passing.

| # | Rule | What the code actually does | Where |
|---|------|------------------------------|-------|
| 1 | Rule 1 — scale is 4/8/**12**/16/24/32 | `Spacing` is 4/8/16/24/32/**48**. There is no 12; 48 is real. Adding 12 makes every existing `Spacing.md` call site ambiguous; deleting 48 breaks 3 call sites. | `constants/theme.ts` `Spacing` |
| 2 | Rule 1 — "no arbitrary values" | ~46% of component files carry 1–6px optical nudges (`2`×40, `4`×29, `6`×19). These are sub-token corrections, not a rival scale — but they are literals. | `PlanTaskCard.tsx` (13), `TaskCard.tsx` (11) |
| 3 | Rule 14 — max 3 type sizes | Three coexisting systems: `FontSize` (7 steps), the `Type` role map (8 roles), and `HEADER_TITLE_BASE_SIZE`. The `FontSize`→`Type` migration is deliberate and unfinished. | `constants/theme.ts` |
| 4 | Rule 16 — max 2 font weights | 5 weights defined, 4 in real use (semibold 168×, bold 140×, medium 42×, regular 21×). | `constants/theme.ts` `Fonts` |
| 5 | Rule 12 — one accent | **RULED ON 2026-08-05: the app runs two colour systems on purpose, and they no longer overlap.** `lib/screenColor.ts` is revived and un-dormant — each screen owns one `feat*` hue, and it is the only thing that colours a card/field/option BORDER. `lib/domainColor.ts`'s four `card*` hues survive for the gradient BADGE and its ink — a glyph plate, never an edge. The conflict that got screenColor retired on 2026-07-31 was the two systems fighting over the same bevel; splitting them by *channel* (edge vs badge) is what settled it. Rule 12 stays formally violated, deliberately. | `constants/colors.ts`, `lib/screenColor.ts` |
| 6 | Rule 17 — every target ≥ 48px | `PAD_ROW_HEIGHT` is 38 — an explicit 2026-07-30 response to a user report ("lines can be compressed for all except the empty one"). `Button` size `sm` is 36, and FormControls has 40px rows. **`TabSlider`'s segment joined them at 34 on 2026-08-10** ("the tab slider should be slightly vertically slimmer"), which is the smallest of the four — the sticky tab row is a full-width 3-segment control, so each target is ~100px wide and the height is the only axis under pressure. `PAD_ROW_MIN_HEIGHT` (the type line, a real field) tracks the token and rose 44→48 with it on 2026-08-08; the other three did **not**, so raising the token widened this conflict rather than closing it. That is known and accepted — closing it is its own change with its own layout cost. | `constants/theme.ts`, `components/Button.tsx` |
| 7 | Rule 23 — never "!" | 13 shipped strings use one, all celebratory: "Nice work!", "All done!", "Paired!", "List received!". The rule's stated purpose is anti-guilt/anti-urgency; these are its opposite. | `lib/i18n.ts` (EN + NO twins) |
| 8 | Rules 5 & 9 — whitespace over lines; nothing jumps | **Half resolved 2026-08-05.** The rule-5 half is settled: the notepad rules are DELETED and rule 5 itself is overruled — every row is its own bordered box now (see rule 5's own entry above). The rule-9 half stands: first-visit ⓘ hints auto-expand and `NewSinceGlow` paints after load, both intentional teaching moments. | `components/PadSheet.tsx`, `lib/useFirstVisitHint.ts`, `components/NewSinceGlow.tsx` |

---

## How to apply this

- When Code generates or edits a screen, it should be checkable against this
  list. A screen that can't satisfy a rule is a signal the design is wrong, not
  that the rule needs an exception.
- The numbered values (spacing scale, contrast ratios, target sizes, type-size
  and weight counts) are the ones to hard-code into shared tokens/components so
  they can't drift. **If a value here disagrees with an existing token, reconcile
  to the stricter of the two — and change the token, not just this file**, so the
  test that guards it moves with it.
- Spend boldness in one place per screen (rule 15). Everything else stays quiet
  and disciplined. Calm and predictable is the aesthetic — not a limitation of it.

## Quick self-check before shipping a screen

- [ ] Every gap comes from `Spacing`; every radius from `Radius`.
- [ ] Cards stack on the screen's `gap: SCREEN_GAP` — no card declares a vertical margin.
- [ ] Exactly one primary action, in the standard position.
- [ ] Back / ⓘ / primary button are where they are on every other screen.
- [ ] All text passes AA contrast in light and dark (new tokens added to `colors.test.ts`).
- [ ] No meaning is carried by color alone.
- [ ] Three type sizes max, two weights max, one focal point.
- [ ] Every target ≥ `MIN_TAP_TARGET`, via size or `HitSlop` — no bare `44`.
- [ ] Nothing reflows or jumps after load.
- [ ] Reduce-motion honored; durations come from `Duration.*`.
- [ ] Copy is plain, reversible actions, no guilt or urgency.
