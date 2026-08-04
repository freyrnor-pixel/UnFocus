# 16 — Borders everywhere, and making things feel hard, solid, pressable

**Size:** L · **Blocked by:** 06 (hue), pairs with 07 · **⚠️ This one reverses a prior call — read §2**

Maintainer notes, 2026-08-04:
> *"Buttons, icons, cards and many other things still lack a border."*
> *"I want things to feel pressable, hard, solid."*

These are one theme, so they are one task. This is the most consequential file in the folder —
it is a material direction, not a component fix.

---

## 1. What "solid" means mechanically in this codebase

The app already has the vocabulary; it is applied unevenly. Three existing pieces:

**The keycap base.** `components/PressableScale.tsx` takes a `travel` prop (px, from `Travel.*`
in `constants/motion.ts`) that translates a cap **down into a base** on press — a physical
key, not a shrinking sticker. `AGENTS.md`:

> **Press = sink, not shrink**: `PressableScale`'s `travel` translates a cap down into a base;
> `sunk` is the stays-pressed "on" state (active tab, active IconButton). A caller passing
> `travel` **must also draw a base** — see `Button.tsx`'s `keyBase` — or the cap sinks into
> nothing. Note `style` moves to the wrapper on that path.

That last sentence is the single most common way this goes wrong. **A cap with no base is the
bug**, and it looks exactly like "lacks a border".

**The edge.** `components/Surface.tsx` draws its edge as a `LinearGradient` fill clipped by
`borderRadius` — lighter top, darker bottom — rather than a flat border, precisely so it reads
as a lit solid rather than an outline. That machinery exists and works; the question is which
components use `Surface` at all.

**The rim.** The matte finish is "a flat white .22 that stops at 12%" plus a face lift of "10%
white gone by 42% plus a 4% bottom shade".

## 2. The prior call this partly reverses — read before touching the material

`AGENTS.md` and `__tests__/glassMaterial.test.ts` record a rejection:

> **Matte finish**: there is no specular highlight any more (removed — it read as gloss;
> `__tests__/glassMaterial.test.ts` asserts the token is GONE, not merely dimmed)… Don't raise
> these back — that is exactly the "too glossy, too rounded towards the user" state the
> maintainer rejected.

**"Hard and solid" is not the same request as "glossy".** The rejected state was a specular
*highlight* — a shine, which reads as wet plastic. What's being asked for now is *edge
definition and depth*: a visible boundary, a base under the cap, a sense that pressing moves
something. Those are different levers, and you can push the second without touching the first.

**So: do not re-add the specular highlight.** `glassMaterial.test.ts` will fail, and correctly.
Get solidity from borders, bases and travel instead. If you conclude the highlight is genuinely
required, that is a maintainer conversation and a separate PR — not a quiet test edit.

Also fixed and not to be reopened: `Radius.md` is **16**, nudged from 18 on 2026-07-18 "for a
calmer, less bubbly card corner." Squarer reads harder — if anything the pressure is downward,
not back to 18.

---

## 3. The audit — what actually lacks a border

Work through these in order and record findings before fixing. The claim "buttons, icons, cards
and many other things" is broad, so the deliverable starts as a list.

- **`components/Button.tsx`** — already has `keyBase`. Check every variant (primary/secondary/
  ghost, all sizes): does each draw a base, or only the primary? A ghost button with no border
  and no base is invisible as a control.
- **`components/IconButton.tsx`** — `sunk` is its stays-pressed state. Does the *unpressed*
  state have an edge? An icon button that is only a glyph on background is the clearest case of
  the complaint.
- **`components/AddFAB.tsx`** — floating, so it needs the strongest edge of anything.
- **Chips**: `components/PersonChip.tsx`, `TagChip`, `OptionalTag.tsx`, weekday chips in
  `TaskCard.tsx`.
- **Cards** — task 07 owns the card edge. **Coordinate, don't duplicate.** If 07 landed a flat
  neutral hairline, this task's job on cards is the *base/press* half only.
- **Rows** — `PadRow` sits on notepad rules by design; task 10 owns that. A border per row is
  boxing, which is 10's option (b). Don't do it here by the back door.

**Where the token floor is:** `theme.border` (`#7284A2`) is contrast-tuned — 3.128:1 on bg,
3.792:1 on surface — and clears WCAG 1.4.11 for a control boundary. That is the right token for
a button or icon edge. **`--c-rule` / `theme.rule` is NOT** — `constants/colors.ts` says
"DECORATIVE row divider ONLY… Never use for an input outline, card edge, chip border or focus
ring." Using `rule` to make a button edge "subtle" is the specific mistake to avoid.

---

## 4. Rules for the press feel

- **Travel comes from `Travel.*`** (`constants/motion.ts`), duration from `Duration.*`. A bare
  `duration: 220` fails `lib/__tests__/designTokens.test.ts` in CI.
- **Every `travel` needs a base.** Repeat of §1 — model it on `Button.tsx`'s `keyBase`.
- **`style` moves to the wrapper** on the travel path. Documented, and it silently misplaces
  padding/margins if you forget.
- **Read `ANIMATION_GUIDELINES.md` before writing any of this.** `AGENTS.md` is explicit:
  "read `ANIMATION_GUIDELINES.md` (repo root) before writing or editing any of these — it has
  the real timing/easing/spring values and the `lib/haptics.ts` contract this codebase actually
  uses. Paste its §8 block at the top of any animation/interaction/haptics prompt." Do that.
- **Haptics** go through `lib/haptics.ts`, never a direct Expo call.
- **Reduced motion.** Travel is motion. `useAccessibility()` ORs in the OS flag; a phone asking
  for less movement must not get a sinking key. Falling back to a static pressed *colour* is
  fine — the border does the work when the motion can't.

---

## 5. What not to do

- **Don't add a border to everything indiscriminately.** The app's own guideline is that
  hierarchy comes from *depth* (`inset < muted < bg < surface`) as much as from outlines. If
  every element gets a 1px edge, nothing reads as foreground. Prioritise: **controls get edges**
  (buttons, icon buttons, chips, switches, inputs), **containers get depth** (surface + shadow),
  **rows get rules**.
- **Don't touch `Surface`'s two-layer structure** — outer = border + `getLayeredShadow`, inner
  `overflow:'hidden'` mask = fill. It exists so shadows aren't clipped.
- **Don't pass borders through `style` to `Surface`** — it silently drops every
  border/background key (its own header and `PadSheet.tsx` both warn).
- **Don't do this in one PR.** Buttons + icon buttons is one PR; chips is another; cards belong
  to 07. A single sweeping material commit is unreviewable and un-revertable, and this is
  precisely the kind of change that needs to be looked at on a device before it spreads.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — **`__tests__/glassMaterial.test.ts` and
   `lib/__tests__/designTokens.test.ts` are the two that matter.** Report both by name. If
   `glassMaterial` fails, you raised the finish — re-read §2, don't edit the test.
3. `npm run preview` — **required**, both themes, and check a screen with mixed controls
   (Settings has buttons, switches and rows together).
4. `npm run wraps -- --lang=no --width=360` — borders add horizontal bulk to chips and buttons.
   The audit's **"clipped controls"** mode was added specifically after an icon button shipped
   sliced in half at 360px and was only caught by eye. That is this task's exact risk class.
5. **Flag honestly what the preview cannot test:** press feel, travel, haptics and gestures are
   native-only. react-native-web differs on shadows, font metrics and Reanimated timing. A
   clean preview is *not* sign-off on "feels solid" — say so in the PR and expect a device pass.

## Close out

Update the headers of every component touched. If the material direction changes, record it in
`DESIGN_RULES.md` / `DESIGN_RULES_AUDIT.md` — the current text says don't raise the finish, and
a future session will obey it unless the nuance in §2 is written down. Commit, PR into `main`,
merge.
