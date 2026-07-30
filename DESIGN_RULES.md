# Design Rules — Visual & General

**Status:** Invariants. Treat these as build criteria, not suggestions.
**Adopted:** 2026-07-30. **Audit:** `DESIGN_RULES_AUDIT.md` (rule-by-rule pass/fix/conflict).
**Enforced by:** `lib/__tests__/designTokens.test.ts`, `lib/__tests__/copyTone.test.ts`,
`lib/__tests__/colors.test.ts` — these run in CI on every PR into `main`.

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
3. **Minimum 12px gap between sibling cards; minimum 24px between distinct
   sections** (`Spacing.lg`). Related things sit closer; unrelated things sit further
   apart — proximity is the primary grouping signal.
4. **One idea per row.** Never place two unrelated controls on the same
   horizontal line. The row anatomy that implements this is `components/PadRow.tsx`
   (see AGENTS.md "The row rule").
5. **Whitespace over lines.** Group with spacing and shared containers, not with
   borders and dividers everywhere. Reach for a divider only when spacing alone
   genuinely can't separate two things. *(Open conflict #8: the notepad pass draws
   full-width rules on every list card by design.)*

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
11. **Never use color as the only signal.** Pair it with an icon or text label.
    Status, selection, and meaning must survive in greyscale.
12. **One accent color for actions, plus a neutral grey scale.** Add semantic
    colors (success / warning / error) only where they carry meaning, and keep
    them muted, not saturated. *(Open conflict #5: the app runs two additional
    identity-hue systems, `lib/screenColor.ts` and `lib/domainColor.ts`, on purpose.)*
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

17. **Every tappable target ≥ 44×44px** (WCAG 2.2) with ≥ 8px of dead space
    around it, so nothing is hit by accident. The token is `MIN_TAP_TARGET`
    (`constants/theme.ts`); when the visual control is smaller than that, expand the
    hit area with a `HitSlop` token rather than growing the art — that's what
    `components/IconButton.tsx` does (`Math.max(MIN_TAP_TARGET, size + Spacing.sm)`).
    Never hardcode `44` or a bare `hitSlop` number. *(Open conflict #6: three
    deliberate sub-44 row/control heights.)*
18. **Visible keyboard/focus state on every interactive element.** Focus is
    never invisible.
19. **Destructive or irreversible actions require a confirm step; everything
    else is immediately reversible (undo).** The app must be safe to explore —
    a user should never fear tapping something. Existing vocabulary: `undoBtn`,
    and "This cannot be undone." on every confirm body in `lib/i18n.ts`.

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
| 5 | Rule 12 — one accent | 1 `accent` + 9 `feat*` screen hues + 9 `card*` domain hues. `lib/screenColor.ts` and `lib/domainColor.ts` are two independent systems *deliberately allowed to disagree on the same screen*. | `constants/colors.ts` |
| 6 | Rule 17 — every target ≥ 44px | `PAD_ROW_HEIGHT` is 38 — an explicit 2026-07-30 response to a user report ("lines can be compressed for all except the empty one"). `Button` size `sm` is 36. `PAD_ROW_MIN_HEIGHT` stays 44 for the type line. | `constants/theme.ts`, `components/Button.tsx` |
| 7 | Rule 23 — never "!" | 13 shipped strings use one, all celebratory: "Nice work!", "All done!", "Paired!", "List received!". The rule's stated purpose is anti-guilt/anti-urgency; these are its opposite. | `lib/i18n.ts` (EN + NO twins) |
| 8 | Rules 5 & 9 — whitespace over lines; nothing jumps | The 2026-07-30 notepad pass draws **full-width rules** on every list card on purpose ("look like notepads"). First-visit ⓘ hints auto-expand, and `NewSinceGlow` paints after load — both intentional teaching moments. | `components/PadSheet.tsx`, `lib/useFirstVisitHint.ts`, `components/NewSinceGlow.tsx` |

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
- [ ] Exactly one primary action, in the standard position.
- [ ] Back / ⓘ / primary button are where they are on every other screen.
- [ ] All text passes AA contrast in light and dark (new tokens added to `colors.test.ts`).
- [ ] No meaning is carried by color alone.
- [ ] Three type sizes max, two weights max, one focal point.
- [ ] Every target ≥ `MIN_TAP_TARGET`, via size or `HitSlop` — no bare `44`.
- [ ] Nothing reflows or jumps after load.
- [ ] Reduce-motion honored; durations come from `Duration.*`.
- [ ] Copy is plain, reversible actions, no guilt or urgency.
