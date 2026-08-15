/**
 * theme.ts — design tokens: spacing/radius/type/shadow scales + glass surface finish.
 *
 * `getFontSize(base, scale)` applies the user's fontSize preference to a base pt.
 * `contrastOn(hexBg)` picks near-black or white text for the best WCAG contrast.
 * `filledEdge(base, isDark)` is the border of a FILLED control, derived from its own fill —
 * all that survives of `getMaterialStyle()`, which computed a whole frosted-glass recipe and
 * was deleted 2026-08-08 with components/GlassFill.tsx (see its tombstone comment below).
 * `getLayeredShadow(shadowColor?, level?)` returns the three-pass `boxShadow` depth.
 * `getGlow(color, level?)` (2026-07-18) returns a two-pass colored `boxShadow` halo —
 * the purposeful active/focus indicator; apply sparingly (see its own doc comment).
 * `getElevation(level, shadowColor?)` is the 3-tier depth scale (flat/raised/floating) —
 * the go-forward source of truth for shadow/elevation; see its own doc comment.
 * `Fonts` holds the rounded Nunito family tokens. Card padding across the app is `Spacing.md`
 * (16) — there is no separate `Layout` token; a prior `Layout.cardPadding/cardGap/maxVisible`
 * export was removed 2026-07-12 (zero call sites, docs disagreed with it — see
 * HANDOFF_SPACING_PASS.md).
 * `Type` (2026-07-18 typography pass) is an additive role map (display/title/heading/
 * subheading/body/bodyStrong/label/caption) — `size` still goes through `getFontSize`, `line`
 * is a lineHeight ratio. `FontSize.*` stays the base scale; not every call site is migrated
 * (see AGENTS.md's type-migration follow-up list).
 * `TabularNums` (2026-07-28 row-rule pass) is the fixed-width-figures style for values that
 * sit in a list row's right-hand column, so the column edge lines up row to row.
 * `OpticalCenter` (2026-08-10) is its vertical counterpart: the `includeFontPadding: false` +
 * `textAlignVertical: 'center'` pair that stops Android's font-metric padding making text ride
 * high inside a centred box. Spread it on any Text whose box height isn't set by the text.
 * `MIN_TAP_TARGET` + `HitSlop` + `hitSlopFor()` (2026-07-30, DESIGN_RULES.md rule 17) are the
 * target-size tokens — 48 since 2026-08-08 (Material Design 3, above WCAG 2.2's 44). Never
 * write a bare `48`, `44` or `hitSlop={8}` at a call site.
 * `PAD_*` + `DONE_ROW_OPACITY` (2026-07-30 notepad pass) are the ruled-sheet geometry every
 * list-bearing surface shares — one gutter, one row height, two spare rules, one done fade.
 * See their own doc comment; components/PadSheet.tsx draws from them.
 *
 * Connections:
 *   Imports → —
 *   Used by → constants/colors.ts (relLuminance only — see its doc comment; this file is the
 *             single home of the WCAG maths both modules need), components/Surface.tsx, components/Button.tsx,
 *             components/AddFAB.tsx, components/PhotoFrame.tsx, app/_layout.tsx, app/budget.tsx, app/capture.tsx, app/focus.tsx, app/habit-form.tsx, app/(tabs)/health.tsx, app/index.tsx, app/meals.tsx, app/onboarding/guided.tsx, app/onboarding/index.tsx, app/onboarding/language.tsx, app/onboarding/privacy.tsx, app/onboarding/step2.tsx, app/onboarding/step3.tsx, app/onboarding/step4.tsx, app/onboarding/step5.tsx, app/plans.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/shopping.tsx, app/task-form.tsx, components/DatePickerCalendar.tsx, components/ExpandableCard.tsx, components/HintCard.tsx, components/ShoppingRow.tsx, components/TimePickerWheel.tsx, lib/useAppTheme.ts
 *   Data    → none (pure constants)
 *
 * Edit notes:
 *   - Glass surface (simplified 2026-07-18): BlurView frost (overlay/chrome only) + colour
 *     wash (see Surface.tsx) so text on cards keeps the same contrast guarantees regardless
 *     of what's blurred behind.
 *   - **There is no material any more (2026-08-08).** The matte/frost/scrim/fillGradient system
 *     is deleted; a card is a flat opaque page with one border (components/Surface.tsx) and a
 *     filled button wears `filledEdge`. `computeRimGradient` survives for BottomNav/IconButton.
 *     Two things must not come back: the `specular` highlight blob (it read as gloss) and the
 *     drifting "sheen" (never implemented — it was the app's persistent-sluggishness driver).
 *     __tests__/glassMaterial.test.ts source-scans for both, so the promise survives the
 *     deletion of the machinery it used to be asserted against.
 *   - Purposeful Depth System (2026-07-14): `getElevation('flat'|'raised'|'floating')`
 *     is the go-forward depth token — flat=read-only, raised=tappable at rest,
 *     floating=the one focused/active surface. Used by PressableScale's `depth` prop,
 *     TaskCard's resting/focus-pop elevation, and Surface's `elevated` prop. The old
 *     `Shadow.*` map is untouched/back-compat only — don't mass-migrate its call sites.
 */
export type FontSizeScale = 'small' | 'default' | 'large';

const fontScaleMap: Record<FontSizeScale, number> = { small: 0.875, default: 1, large: 1.2 };

/** Apply the user's fontSize preference to any base point size. */
export function getFontSize(base: number, scale: FontSizeScale): number {
  return Math.round(base * fontScaleMap[scale]);
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [100, 100, 100];
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

export function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * Blend `t` (0..1) of `overlay` into `base` and return an opaque hex. Used to derive a
 * soft solid card tint from a domain accent (e.g. mix(theme.surface, accent, 0.15)) — a
 * solid hex is required because Surface's `tint` can't parse an rgba().
 */
export function mix(base: string, overlay: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(overlay);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * `#rrggbb` → `{ h: 0-360, s: 0-100, l: 0-100 }`.
 *
 * Added 2026-08-07 for the design lab's colour picker. `lighten`/`darken` above walk a colour
 * toward white or black in RGB, which is fine for a tint but useless for "make this the same
 * colour, more saturated" or "the same brightness, a different hue" — the two questions a
 * picker is actually asked. Those need the polar axes, hence this pair.
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** The inverse of `hexToHsl`. Out-of-range inputs are wrapped (hue) or clamped (s/l). */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const lum = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lum - c / 2;
  const sector = Math.floor(hue / 60) % 6;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[sector];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * WCAG relative luminance of a hex colour.
 *
 * Exported for `constants/colors.ts`'s `contrastRatio()` — the two used to hold
 * byte-identical private copies of this and of `hexToRgb`, which had to stay in lockstep or
 * the WCAG gate in lib/__tests__/colors.test.ts and the runtime `contrastOn()` below could
 * silently disagree about the same colour. One implementation now; don't re-copy it.
 */
export function relLuminance(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const DARK_TEXT = '#1E293B';

/**
 * Returns whichever of near-black (DARK_TEXT) or white text has the higher WCAG
 * contrast ratio against hexBg.
 */
export function contrastOn(hexBg: string): string {
  const bgLum = relLuminance(hexBg);
  const darkLum = relLuminance(DARK_TEXT);
  const contrastWithWhite = (Math.max(bgLum, 1) + 0.05) / (Math.min(bgLum, 1) + 0.05);
  const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
  return contrastWithDark >= contrastWithWhite ? DARK_TEXT : '#FFFFFF';
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/**
 * The ONE vertical gap between top-level cards on a screen (2026-08-08).
 *
 * **The screen's scroll content owns this gap; a card must not carry a vertical margin of
 * its own.** That is the whole point of the token, and the reason it exists as a token
 * rather than a `Spacing.md` at each call site.
 *
 * Before this, spacing between stacked cards was a property of the CHILD, and roughly half
 * the children forgot to declare one. The measured result on the To-do tab was five
 * different gaps down one column: 40px between the day card and the Whenever drawer
 * (`PlanTaskCard`'s `marginBottom: Spacing.sm` plus `SectionCard`/`CollapsedSection`'s
 * `marginTop: Spacing.xl`), then **0** between Whenever and each sub-screen link — the
 * only visible separation there was the 8px key-base sliver `Surface` draws under a
 * tappable card. Habits had the same split inside one card: `Spacing.md` between the
 * heading, tips and suggestions, then 0 between the list, the composer and the Goals row.
 *
 * A card that needs to sit apart from its neighbours says so by being in a different
 * GROUP (its own Surface with rows inside), never by growing a margin — see
 * components/CollapsedSection.tsx, the one card every sub-screen link is drawn as.
 */
export const SCREEN_GAP = Spacing.md;

export const Radius = {
  sm: 12,
  // md nudged 18 → 16 (2026-07-18 "colored glass"): a calmer, less bubbly card corner so
  // surfaces read as lifelike glass panes rather than rounded plastic tiles.
  md: 16,
  lg: 24,
  full: 999,
};

/**
 * Shared width/height ratios for photo/media tiles (components/PhotoFrame.tsx).
 * `fit` means "no forced ratio" (contain, natural proportions) — the other keys are
 * width/height values for a fixed crop (cover). Golden (φ ≈ 1.618) is the classic
 * landscape proportion. Only apply a fixed ratio to genuinely visual/media tiles —
 * never to variable-length text/content cards.
 */
export const AspectRatio = {
  fit: undefined,
  square: 1,
  classic: 4 / 3,
  widescreen: 16 / 9,
  golden: 1.618,
} as const;

export type AspectRatioKey = keyof typeof AspectRatio;

// Shared compact "resting" height for Home's collapsed preview cards (Notes/Plans/Shopping)
// so an empty or light card reads as one intentional size (each with its own designed empty
// state — see HomeNotesCard/HomeShoppingCard/PlanTaskCard) instead of a big blank band. Applied
// only while
// collapsed/unexpanded; it's a floor, not a cap — content past it (added rows up to 5, an
// expanded task's steps, Plans' proportional time-gap rail) is free to grow taller.
export const HOME_PREVIEW_CARD_MIN_HEIGHT = 140;

/**
 * Pad ("notepad") geometry — the shared ruled-sheet language every list-bearing surface
 * draws itself with (2026-07-30, user report: "look like notepads", "related cards should
 * look practically the same", "the feel of 1, 2, 3, everything inside a card is connected
 * and in orderly fashion feels like it's not there").
 *
 * Before this, one Home card could carry FOUR different left edges — a title row inset 52
 * to clear an absolutely-pinned badge, rows at Spacing.md, a day-grid at GUTTER_WIDTH +
 * Spacing.xs, and dividers at ShoppingRow's old 30px check inset — which is most of why
 * nothing inside a card read as belonging to the same list. `PAD_GUTTER` is the ONE
 * horizontal inset for everything inside a pad card: header, rules, rows, type line,
 * footer. Don't add a second one.
 *
 * `PAD_ROW_MIN_HEIGHT` is the always-open TYPE line's own rhythm (PadTypeRow) — it needs the
 * fuller height for its 32px commit button + comfortable typing target. It tracks
 * MIN_TAP_TARGET and rose 44→48 with it (2026-08-08): this line is a real text FIELD, i.e. a
 * control, so it takes the control floor. `PAD_ROW_HEIGHT` below deliberately does not.
 * `PAD_ROW_HEIGHT` (2026-07-30, user report: "lines can be compressed for all except the
 * empty one with the Type text-box") is the shorter rhythm for actual list rows (PadRow) and
 * the blank spare lines after them — a real row's 22px check + hitSlop don't need 44px of
 * air, and the taller uniform height read as loose/floaty next to the type line above it.
 * Rules are drawn by components/PadSheet.tsx and run the full card width (there is no
 * leading check column to inset past any more — see the row rule in AGENTS.md).
 */
// Literal, not `MIN_TAP_TARGET`: that const is declared further down this file, and `const`
// is not hoisted — referencing it here is a TDZ ReferenceError at module eval, not a type
// error, so tsc would not catch it. Keep the two in step by hand; the pad-token doc above
// and designTokens.test.ts both record that they are meant to match.
export const PAD_ROW_MIN_HEIGHT = 48;
export const PAD_ROW_HEIGHT = 38;
export const PAD_GUTTER = Spacing.md;
/** Blank ruled lines drawn after the last real row — the "keep writing" invitation. */
export const PAD_SPARE_LINES = 2;
/** Rows shown in a pad card's middle ("preview") state, between closed and open. */
export const PAD_PREVIEW_ROWS = 3;

/**
 * A finished row's fade. Struck through AND faded, in place — the shared "done" treatment
 * for notes, tasks, shopping items and completed habits, so one tick looks the same
 * everywhere. Promoted here from components/ShoppingRow.tsx's `CHECKED_OPACITY` (same
 * value, still re-exported there for its existing callers).
 */
export const DONE_ROW_OPACITY = 0.55;

/**
 * Minimum tappable target, in px (DESIGN_RULES.md rule 17).
 * A hard floor, not a preference: never write a bare `48` — or `44` — at a call site.
 *
 * **48, not 44, since 2026-08-08 — a deliberate call, not drift.** This was 44 (WCAG 2.2's
 * AAA target size) and is now Material Design 3's 48dp, on the maintainer's instruction. It
 * is the one thing taken from MD3: adopting MD3 as a *look* would fight decisions this app
 * has already made on purpose (`Radius.md` was REDUCED 18→16 for a calmer corner; colour is
 * confined to the border by `lib/screenColor.ts`), but a bigger touch target is a measurable
 * ergonomic win for an app built for ADHD/anxiety users and costs only vertical room. Don't
 * "restore" 44 by citing WCAG — 48 clears it with margin.
 *
 * Note `MIN_TAP_TARGET_FLOOR` in lib/designLab.ts stays **44** and has now diverged from this
 * on purpose: that is the accessibility floor the lab refuses to go below, while this is the
 * app's shipped default. A lab session may tune down to 44 and still be compliant.
 *
 * When the *visual* control is deliberately smaller than this (an icon button's 36px
 * cap, a chip), don't grow the art — expand the touch area instead, either with a
 * `minHeight`/`minWidth` of MIN_TAP_TARGET or with a `HitSlop` token. The pattern is
 * components/IconButton.tsx: `Math.max(MIN_TAP_TARGET, size + Spacing.sm)`.
 *
 * Three shipped heights sit deliberately below this — `PAD_ROW_HEIGHT` (38, the
 * compressed notepad row the user asked for on 2026-07-30), `Button`'s `sm` (36) and
 * FormControls' 40px rows. They're open conflict #6 in DESIGN_RULES.md and are NOT to
 * be "fixed" in passing; `sm` buttons carry a HitSlop to reach target touch area instead.
 * Raising this token widens that gap rather than closing it — that is known and accepted,
 * and closing it is its own change with its own layout cost.
 */
export const MIN_TAP_TARGET = 48;

/**
 * The slop needed to lift a `visualSize`-px control up to MIN_TAP_TARGET of touch area.
 * **Prefer this over a hand-picked `HitSlop.*` constant** — it takes the one number you
 * actually know (how big the icon/glyph is) and does the arithmetic, so the target can't
 * silently come out under 44 the way a guessed `hitSlop={6}` on a 22px check does (34px).
 *
 *   <Pressable hitSlop={hitSlopFor(CHECK_SIZE)}>   // 22px check → 11px slop → 44px target
 *
 * Returns 0-slop for a control already at or over target. RN's `hitSlop` extends the touch
 * area outside the view's bounds and does not affect layout, so this is free.
 */
export function hitSlopFor(visualSize: number) {
  const pad = Math.max(0, Math.ceil((MIN_TAP_TARGET - visualSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}

/**
 * Named hitSlop values, replacing the eight different bare numbers this codebase carried
 * (8, 6, 13, 4, 12, 16, 10, 2). Each is labelled with the *smallest visual control it
 * actually makes compliant*, because that — not the slop number — is what rule 17 is about.
 * If your control is smaller than the label says, use `hitSlopFor(size)` instead of reaching
 * for the next token up.
 *
 * DESIGN_RULES.md rule 17 also asks for ≥8px of dead space *around* a target, so don't put
 * `loose` on two controls sitting 8px apart — their touch areas would overlap and the wrong
 * one wins.
 *
 * Every value here rose by 2px when MIN_TAP_TARGET went 44→48 (2026-08-08), so each token
 * still lifts exactly the control size its label promises — the alternative was relabelling
 * them upward, which would have silently un-complied every existing call site on a smaller
 * control. `check` is the exception: it was already sized for 48.
 */
export const HitSlop = {
  /** 6px — lifts a ≥36px control (an IconButton cap) to target. */
  tight: { top: 6, bottom: 6, left: 6, right: 6 },
  /** 8px — lifts a ≥32px control to target. */
  snug: { top: 8, bottom: 8, left: 8, right: 8 },
  /** 10px — lifts a ≥28px control (most header/row icons) to target. */
  base: { top: 10, bottom: 10, left: 10, right: 10 },
  /** 13px — the row check: 22px + 26 = 48px of target. Was deliberately above the old 44
   *  minimum and is now exactly at target, so it is the one token that did NOT move;
   *  components/PadRow.tsx's header warns not to shrink it to tidy up the trailing cluster. */
  check: { top: 13, bottom: 13, left: 13, right: 13 },
  /** 18px — lifts a ≥12px glyph/dot to target. */
  loose: { top: 18, bottom: 18, left: 18, right: 18 },
} as const;

/**
 * The trailing cluster — the ⋯/× action and the ○ check at the end of a row.
 *
 * This is the one place in the app where two independent tap targets sit side by side, and
 * the pair is the exact one rule 17 singles out: complete and delete. The warning three
 * comments up ("don't put `loose` on two controls sitting 8px apart") was being broken by
 * the rows themselves — `HitSlop.base` on the action (8) plus `HitSlop.check` on the check
 * (13) across a `Spacing.sm` gap overlapped by 13px, and RN hit-tests siblings in reverse
 * order, so the check (rendered last) won. The right ~5px of the visible × or ⋯ silently
 * fired "complete" instead. Measured on components/{PadRow,ShoppingRow}.tsx, 2026-08-01.
 *
 * These are deliberately NOT `HitSlop.*` tokens: those are symmetric by contract (pinned in
 * lib/__tests__/designTokens.test.ts), and the fix here is asymmetry. Each control is clipped
 * on the side it shares with its neighbour, and `gap` is sized so that after both clips there
 * is still dead space between the two touch areas:
 *
 *   action  28 + 8 + 4 = 40 wide,  28 + 20 = 48 tall
 *   check   22 + 4 + 13 = 39 wide, 22 + 26 = 48 tall
 *   between them  16 − 4 − 4 = 8px belonging to neither
 *
 * The two land at 39–40px wide rather than 48. That is a knowing trade, not an oversight:
 * two fully-compliant targets with 8px between them need over 100px of row, and a shopping
 * row at 360px in Norwegian does not have it to give. The axis a thumb actually misses on in
 * a scrolling list is the vertical one, and both controls keep ≥48 there. If the row budget
 * ever grows, widen the *boxes* — growing the slop back is what reintroduces the overlap.
 *
 * `actionSlop`'s vertical went 8→10 when MIN_TAP_TARGET rose 44→48 (2026-08-08): 28 + 16 was
 * exactly 44 and would otherwise have fallen under the new floor. Only the vertical moved —
 * the horizontal 8/4 asymmetry is what keeps the two touch areas apart, and widening it is
 * precisely the "tidy-up" that reintroduced the overlap this whole block exists to prevent.
 */
export const RowTrailing = {
  /** The ⋯ / × box. */
  actionSize: 28,
  /** The ○ check circle. (ShoppingRow's `bigTouch` layout widens it to 32, which only helps.) */
  checkSize: 22,
  /** Between the action and the check. Sized to leave 8px dead after both slops. */
  gap: 16,
  /** ⋯ / × — clipped on the right, where the check is. */
  actionSlop: { top: 10, bottom: 10, left: 8, right: 4 },
  /** ○ check — clipped on the left, where the action is; spreads right into card padding. */
  checkSlop: { top: 13, bottom: 13, left: 4, right: 13 },
} as const;

// Body text is never below 16; secondary/caption text never below 14.
//
// **Raised ~8% on 2026-08-13** (user report: "the text in general and all that is a bit too
// small in Normal Size"). The bump is on the BASE ladder rather than on `fontScaleMap.default`
// deliberately: that map's three rungs are 0.875 / 1 / 1.2, so moving `default` up toward
// `large` would have squeezed the Size setting's own range from both ends — "Large" would have
// become a 9% step instead of a 20% one, and "Small" would have stopped being smaller by much.
// Raising the ladder itself moves every rung together, so Normal gets bigger and the three
// choices stay as far apart as they were. Ratios between the steps are preserved.
export const FontSize = {
  xs: 13,
  sm: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  hero: 38,
};

/**
 * The global `maxFontSizeMultiplier` applied to every RNText/RNTextInput in
 * app/_layout.tsx. Header metrics below cap font scaling at the same value so the
 * band/line-box math matches what the title actually renders at.
 */
export const MAX_FONT_SCALE = 1.4;

/**
 * Screen-header title metrics, derived together from the OS text-size scale so they can
 * never disagree (they live in two files — ScreenHeader draws the title, ScreenScaffold
 * sizes the band). Two clippers have to be satisfied at once:
 *   1. the Text's own line box must clear Nunito Bold's deep descenders (g/j/p/q/y) — a
 *      lineHeight below the font's ~1.36 natural ratio chops their tails ("Hjem"→"Hiem");
 *   2. the row (line box + vertical padding) must fit inside the header band, or the glass
 *      Surface's overflow:hidden mask clips the bottom instead.
 *
 * ⚠️ The values are PRE-SCALED, so the consuming Text MUST set `allowFontScaling={false}`
 * and apply `titleFontSize` + `titleLineHeight` verbatim. With `allowFontScaling` left on
 * (the earlier, broken arrangement), RN treats BOTH the style fontSize AND the style
 * lineHeight as SP and multiplies them by the OS font scale again — see Android's
 * `TextAttributes.effectiveLineHeight` (`toPixelFromSP(lineHeight, maxFontSizeMultiplier)`).
 * That double-scaled the line box (57 → ~80px at the 1.4× cap) while the band stayed
 * single-scaled (89px), overflowing the row — the "cut headers" bug that survived #189/
 * #194/#195/#198. (The old comments claimed "a px lineHeight never scales; only fontSize
 * does" — that's exactly backwards on Android, and react-native-web doesn't emulate the
 * SP conversion, which is why the web preview could never reproduce the clip.)
 */
export const HEADER_TITLE_LINE_RATIO = 1.45; // headroom over Nunito Bold's ~1.36 natural ratio
// Header prominence pass (2026-07-20): kept as its own token (not a bump to FontSize.xxl
// itself) since that scale is reused by unrelated onboarding screens this pass isn't meant
// to touch. Same-day follow-up dialed the size back to 28 (matching the old FontSize.xxl
// this token was split from) after the initial 32 + uppercase + centering fix together read
// as too large — the row's centering (paddingVertical: Spacing.md in ScreenHeader.tsx, which
// must stay put — see that file's comment) is kept. The uppercase casing that pass also
// introduced was REMOVED 2026-07-28 (design review): all-caps at 24px reads as a label style
// at a heading size. This token still drives the band height in lockstep, unchanged.
// 2026-07-24: dialed 28 → 24. This value drives ALL header titles uniformly (and the band
// height below, in lockstep), so lowering it makes every screen's title one consistent,
// still-legible size AND gives the long uppercase "HANDLELISTE" (11 chars, extrabold) room
// to sit on one line next to Shopping's 5-icon control row without the old per-screen
// autosize shrink hack (removed in ScreenHeader.tsx the same day — see that file's edit note).
export const HEADER_TITLE_BASE_SIZE = 24;
export function getHeaderMetrics(rawFontScale: number) {
  const fontScale = Math.min(rawFontScale, MAX_FONT_SCALE);
  // The OS text-size scale is applied HERE, once — the title Text opts out of RN's own
  // scaling (allowFontScaling={false}), so accessibility sizing still works but through
  // this single, band-aware code path with the same MAX_FONT_SCALE cap.
  const titleFontSize = Math.round(HEADER_TITLE_BASE_SIZE * fontScale);
  const titleLineHeight = Math.ceil(titleFontSize * HEADER_TITLE_LINE_RATIO);
  // Band = title line box + the header row's vertical padding (Spacing.sm each side) + a
  // Spacing.md slack so the descender never sits flush against the mask edge.
  const headerHeight = titleLineHeight + Spacing.sm * 2 + Spacing.md;
  return { fontScale, titleFontSize, titleLineHeight, headerHeight };
}

/**
 * Rounded-typeface family tokens (Nunito). Loaded in app/_layout.tsx via expo-font;
 * the regular face is also set as the global Text default there.
 */
export const Fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

/**
 * Refined Nunito hierarchy (additive, 2026-07-18 typography pass) — `FontSize.*` stays the
 * source of truth for the many existing call sites; `Type` is a higher-level role map for
 * new/converted call sites. `size` is the base pt fed through `getFontSize(size,
 * settings.fontSize)` at the call site (same pattern as existing code); `line` is a
 * lineHeight *ratio* (multiply by the scaled size), not a fixed pt value.
 */
export const Type = {
  display: { fontFamily: Fonts.extrabold, size: 34, line: 1.15 },
  title: { fontFamily: Fonts.extrabold, size: 26, line: 1.20 },
  heading: { fontFamily: Fonts.bold, size: 20, line: 1.25 },
  subheading: { fontFamily: Fonts.semibold, size: 17, line: 1.30 },
  body: { fontFamily: Fonts.regular, size: 16, line: 1.45 },
  bodyStrong: { fontFamily: Fonts.semibold, size: 16, line: 1.45 },
  label: { fontFamily: Fonts.semibold, size: 14, line: 1.30 },
  caption: { fontFamily: Fonts.medium, size: 13, line: 1.35 },
} as const;

/**
 * Tabular (fixed-width) figures — the row rule's "right edge is a single column"
 * (design-system v6 `Checklist Redesign Options`). Apply to any value that sits in a
 * list row's right-hand slot (a time, a price, a count) so the digits occupy the same
 * width on every row and the column's edge lines up instead of jittering between
 * "1" and "11". Nunito ships the `tnum` feature, so this is a font-feature switch,
 * not a font swap — it never changes the family, size or weight it's mixed into.
 *
 * Deliberately NOT applied to prose or to numbers inside a sentence: proportional
 * figures read better there, and there's no column to align to.
 */
/* Not `as const`: React Native types `fontVariant` as a MUTABLE `FontVariant[]`, and a
   `readonly [...]` tuple won't assign to it. This file stays import-free (see the header),
   so the element type is written out rather than pulled from react-native's `TextStyle`. */
export const TabularNums: { fontVariant: 'tabular-nums'[] } = { fontVariant: ['tabular-nums'] };

/**
 * `OpticalCenter` (2026-08-10) — the two properties that make a line of text actually sit in
 * the middle of a vertically-centred box **on Android**.
 *
 * Android defaults `includeFontPadding` to true, adding the font's own ascent/descent metric
 * padding around the glyphs. That padding is not symmetric, so a `justifyContent: 'center'`
 * box centres the padded LINE BOX while the visible glyphs ride high inside it — the box
 * looks correctly sized and the text looks wrong. `textAlignVertical: 'center'` then centres
 * the glyph within whatever line box is left (which also reserves room for descenders j/g/p/y
 * and Norwegian top accents å/ø). iOS and react-native-web have no equivalent property and
 * are unaffected either way, which is exactly why this is invisible in `npm run preview` and
 * has to be caught by eye or on a device.
 *
 * Found the same way seven separate times before this token existed — ScreenHeader (#198),
 * FormControls, TabSlider, PersonChip and three Home cards each carry a hand-written copy
 * with the same reasoning. Spread this instead of writing the pair out again, and reach for
 * it whenever a Text sits inside a box whose height it does not itself determine.
 */
/* Not `as const`: React Native types `textAlignVertical` as a mutable union, and this file
   stays import-free (see the header), so the union is written out rather than pulled from
   react-native's `TextStyle`. */
export const OpticalCenter: { includeFontPadding: boolean; textAlignVertical: 'center' } = {
  includeFontPadding: false,
  textAlignVertical: 'center',
};

export type ElevationLevel = 'flat' | 'raised' | 'floating';

/**
 * 3-tier depth scale (Purposeful Depth System, 2026-07-14): `flat` = informational/
 * read-only, `raised` = tappable at rest, `floating` = the one focused/active/modal
 * surface on screen. Roughly: `Shadow.card`/`button` ≈ `raised`, `Shadow.cardHeavy`/
 * `fab` ≈ `floating` — new code should prefer `getElevation` over the `Shadow` map
 * below (kept for its 15+ existing call sites, not migrated in this pass). Pass
 * `theme.shadow` for a theme-tinted shadow (matches Surface); omit for legacy black.
 */
export function getElevation(level: ElevationLevel, shadowColor: string = '#000') {
  switch (level) {
    case 'flat':
      return { shadowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
    case 'raised':
      return { shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 };
    case 'floating':
      return { shadowColor, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.20, shadowRadius: 14, elevation: 10 };
  }
}

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 5,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
  // Raised "toward the user" button depth (2026-07-13 depth pass): a stronger downward
  // offset + elevation so small tappable controls (AddRow confirm, habit +/- adjusters,
  // chips) read as physical, pressable buttons instead of flat recessed wells. Pair with
  // a fill that is NOT surfaceMuted (use surface or an accent) and a light top edge.
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
};

// ─── Materials: what is left of the glass surface finish ─────────────────────
//
// `MaterialStyle`, `MaterialMode`, `MaterialVariant`, `ScrimGradient` and
// `MATERIAL_BORDER_WIDTH` lived here until 2026-08-08 and are deleted along with
// `getMaterialStyle()` (see its tombstone further down) and `components/GlassFill.tsx`. They
// described a translucent, frosted, top-lit surface; nothing in the app draws one any more.
// What survives is the RIM — a flat, single-tone hue-tinted edge — because `computeRimGradient`
// has three live consumers of its own (BottomNav ×2, IconButton) that never went through the
// material recipe.

/** expo-linear-gradient requires ≥2 colour/location stops — a tuple, not a plain array. */
type GradientColors = readonly [string, string, ...string[]];
type GradientStops = readonly [number, number, ...number[]];

/**
 * The keycap border ring — a vertical hue-tinted gradient padding-ring.
 *
 * Named for the raised-keycap chamfer it originally drew (top-light → bottom-dark). Since the
 * 2026-08-05 flat-rim pass every stop is the SAME colour, so it renders as one evenly-weighted
 * edge; the shape is kept so the five `LinearGradient` call sites don't all need rewriting.
 */
/**
 * `start`/`end` are OPTIONAL and were added for `getGlassEdge()` (2026-08-15), which needs a
 * diagonal sweep rather than the top-to-bottom one every earlier consumer wanted. Omitting them
 * means "vertical", so `computeRimGradient` and `computeBorderRamp` are byte-identical to before
 * and no existing call site changed.
 */
export type GradientPoint = { x: number; y: number };
export type RimGradient = {
  colors: GradientColors;
  locations: GradientStops;
  start?: GradientPoint;
  end?: GradientPoint;
};

/**
 * The raised-keycap rim recipe, extracted so callers whose edge hue differs from their fill hue
 * (Surface's `edgeHue` — a domain/screen colour — vs. its neutral frosted `base` fill) can
 * compute a rim from that different hue without duplicating the colour math. `getMaterialStyle`
 * calls this with its own `base` for `mat.rim` (Button/AddFAB); Surface.tsx calls it directly
 * with `edgeHue`. Still named/shaped as a `RimGradient` (a `LinearGradient`'s `colors`/
 * `locations`) for every consumer's sake, but as of the flat pass below it is a DEGENERATE
 * gradient — every stop the same colour — which is what makes it render as one flat, evenly-
 * weighted edge rather than removing the `LinearGradient` plumbing from five call sites.
 *
 * **Flat pass (2026-08-05, user report + screenshot, explicit override of
 * `DESIGN_RULES_AUDIT.md` item 8's "(a) keep the beveled gradient edge" call from the day
 * before)**: a border should not be affected by light — only a surface's own content/face
 * earns that treatment (see Button.tsx/GlassFill's flat-face pass, same day). The light-top/
 * dark-bottom ramp this used to draw is gone; each edge is now ONE hue-tinted tone, still
 * derived from `base` so the per-card/per-button identity colour ("domain ramp") survives —
 * only the light-gradient SHAPE is what's removed, not the hue. `DESIGN_RULES_AUDIT.md` item 8
 * is left in place as history (the call it records was real and reasoned) with a dated
 * addendum noting this override, rather than rewritten as if it never happened.
 *
 * Alpha bumped versus the old bottom-stop tone (0.38/0.42 → ~0.48/0.5): the prior 2026-07-24
 * contrast pass found the ring's non-lit portion read as barely-there on its own, so a single
 * tone carrying the WHOLE edge needs to be at least that visible everywhere, not just at one
 * end — this is also the direct fix for "borders look weak". Dark mode still lightens rather
 * than darkens (a black edge is close to invisible against a near-black surface) — same
 * light-on-dark logic the old top stop used, just held for the full edge instead of a sliver.
 */
export function computeRimGradient(base: string, isDark: boolean): RimGradient {
  return isDark
    ? { colors: [rgba(lighten(base, 0.28), 0.5), rgba(lighten(base, 0.28), 0.5)], locations: [0, 1] }
    : { colors: [rgba(darken(base, 0.16), 0.48), rgba(darken(base, 0.16), 0.48)], locations: [0, 1] };
}

// ─── The border ramp (card design reset, 2026-08-05) ─────────────────────────

/**
 * How prominent the bordered element is. Mirrors `HueWeight` in lib/screenColor.ts — that
 * module picks WHICH hue a screen uses, this one decides how heavily a given element wears it.
 * Kept as a separate local type so constants/ doesn't import from lib/ (the token layer has no
 * dependencies by design).
 */
export type BorderWeight = 'card' | 'field' | 'button';

/**
 * Border thickness per weight. "Simple border" means one thickness per rung and no per-side
 * variation — not a hairline. `card` stays at the material's 1.5 so a card edge still reads at
 * arm's length; the smaller rungs step down so a card containing five bordered options doesn't
 * turn into a grid of equal-weight lines.
 */
export const BORDER_WIDTH: Record<BorderWeight, number> = {
  card: 1.5,
  field: 1.25,
  button: 1.25,
};

/**
 * Per-weight tuning of the ramp: how far the two stops sit either side of the screen hue, and
 * how opaque the whole edge is. Lower alpha at the smaller rungs is what makes the family read
 * as "green → light green" going inward, without needing three separate colour tokens.
 */
const RAMP: Record<BorderWeight, { deep: number; light: number; alpha: number }> = {
  card: { deep: 0.14, light: 0.20, alpha: 0.92 },
  field: { deep: 0.06, light: 0.26, alpha: 0.62 },
  button: { deep: 0.04, light: 0.30, alpha: 0.5 },
};

/**
 * The card-design-reset border: ONE hue, ramped deep→light down the edge, at the strength its
 * `weight` earns (2026-08-05, maintainer-specified — "it goes from green to light green", and
 * confirmed as BOTH a ramp inside one border AND a family stepping across elements).
 *
 * **This deliberately re-introduces a gradient edge that was flattened the day before** (see
 * `computeRimGradient` above, 2026-08-05 "flat pass", whose stated reason was that a border
 * should not be affected by light). Both are true and they are not in conflict: that pass
 * removed a *lighting* ramp — a white lit lip fading to a hue-dark bottom, which simulated a
 * light source and made the edge read as a bevel. This ramp is entirely within the screen's own
 * hue, has no white and no black in it, and is decorative rather than physical. Nothing here
 * claims the card is moulded. If a future pass wants the edge flat again, that is a real design
 * change to ask about, not a revert to `computeRimGradient` — that function still exists only
 * for the back-compat consumers listed at its own call sites.
 *
 * Dark mode ramps the other way round the neutral point (lightening the deep stop rather than
 * darkening it) for the same reason every other token here does: a darkened hue on a near-black
 * surface is an invisible edge, not a subtle one.
 *
 * Returns a `RimGradient` so it drops straight into the `LinearGradient` ring Surface and
 * Button already render — no new plumbing at any call site.
 */
export function computeBorderRamp(
  hue: string,
  isDark: boolean,
  weight: BorderWeight = 'card',
  strength: number = 1,
): RimGradient {
  const base = RAMP[weight];
  // `strength` is the design lab's borderRampStrength knob (lib/designLab.ts) and defaults to
  // 1, so every existing caller and every pinned test gets byte-identical output. It scales
  // only how far the two stops sit either side of the hue: at 0 both collapse onto the hue
  // itself and the edge is flat, which is the "is the gradient doing anything for me?"
  // question the maintainer has asked of this border twice. Alpha is deliberately NOT scaled —
  // that would fade the border away rather than flatten it, answering a different question.
  const deep = base.deep * strength;
  const light = base.light * strength;
  const alpha = base.alpha;
  // Light mode: deep at the top, lighter toward the bottom. Dark mode keeps the same
  // top-is-stronger direction, but both stops move UP in lightness off the near-black surface.
  const top = isDark ? lighten(hue, deep + 0.22) : darken(hue, deep);
  const bottom = isDark ? lighten(hue, light + 0.30) : lighten(hue, light);
  return {
    colors: [rgba(top, alpha), rgba(bottom, alpha)],
    locations: [0, 1],
  };
}

/**
 * The flat single-tone equivalent, for the places that can't render a gradient — a plain
 * `borderColor` on a View (FormControls' Input, a chip, the glass-off fallback). Same hue
 * family and the same per-weight strength as `computeBorderRamp`, sampled at the ramp's
 * midpoint so a bordered field sitting next to a bordered card looks like it belongs to the
 * same system rather than to a different one.
 */
export function computeBorderTone(
  hue: string,
  isDark: boolean,
  weight: BorderWeight = 'card',
  strength: number = 1,
): string {
  const base = RAMP[weight];
  const deep = base.deep * strength;
  const light = base.light * strength;
  const alpha = base.alpha;
  const mid = (deep + light) / 2;
  return rgba(isDark ? lighten(hue, mid + 0.26) : mix(darken(hue, deep), lighten(hue, light), 0.5), alpha);
}

// ── Tactile Glass (2026-08-15) ───────────────────────────────────────────────
//
// ⚠️ This section REVERSES two decisions that were made deliberately and written down, and it
// is the "maintainer conversation and a separate PR" that
// DESIGN_COMPARISON/16-solid-pressable-materials.md §2 required before either could be
// reopened. Read that file and DESIGN_RULES_AUDIT.md's 2026-08-15 addendum before editing:
//   - the 2026-08-05 card reset removed all translucency ("no frost, no BlurView, no
//     translucent wash, no beveled rim"); it is back, as the app's material.
//   - the same pass removed a LIGHTING ramp (a white lip fading to a dark bottom) on the
//     grounds that a border should not simulate a light source. It now does simulate one,
//     because that is precisely what the Tactile Glass brief asks a pane's edge to do.
// `computeBorderRamp`/`computeBorderTone` above still exist and still work; what they lost is
// consumers, not correctness. The screen-identity hue did not go away either — it moved off
// the EDGE and into the pane's own faint tint and the icon badge (lib/screenColor.ts,
// lib/domainColor.ts), per the 2026-08-15 ruling.

/**
 * Per-weight strength of the glass edge, mirroring `RAMP` above so the card → field → button
 * family still steps DOWN in presence. That hierarchy is the thing that stops a card full of
 * bordered controls reading as a grid, and it survives the material change unchanged in spirit;
 * `lib/__tests__/borderRamp.test.ts` still asserts the ordering.
 *
 * The two sides are tuned independently and asymmetrically, which is the whole point:
 *   - `lit` is the light CATCH. On a light pane it is near-opaque white and contributes almost
 *     no contrast (~1.04:1) — it is a highlight, not a boundary.
 *   - `shade` is the BOUNDARY, and it is plain `theme.border`, which is contrast-tuned to clear
 *     WCAG 1.4.11's 3:1 on every rung it is drawn against (3.658:1 on the light pane, 3.817:1
 *     on the dark one). This is what lets DESIGN_RULES.md rule 10b relax the bg↔surface FILL
 *     step under glass: the boundary moved from the fill to the edge, and unlike the fill step
 *     it is measured on both sides.
 * Never make `shade` fainter than `lit` at the card rung — that inverts the light direction and
 * the pane reads as lit from below.
 *
 * ── `shadeDark` and the asymmetric card edge (2026-08-16, brief §3) ────────────────────────
 * The brief asks for the edge to exist on the TOP and LEFT only — `borderTopWidth: 1`,
 * `borderLeftWidth: 1`, `borderBottomWidth: 0`, `borderRightWidth: 0` — because a lip that
 * stops halfway round is what reads as a thick piece of glass catching a light source above
 * and to the left, where a closed rectangle reads as a drawn frame.
 *
 * It is implemented as a THIRD GRADIENT STOP fading to transparent, not as per-side border
 * widths, and that is deliberate: these edges are drawn as a `LinearGradient` padding-ring
 * (see `getGlassEdge` and components/Surface.tsx) precisely because RN's native border renderer
 * cannot blend two colours around a rounded corner. Mixing per-side widths INTO that ring would
 * mean abandoning the ring, and a hard 1px→0px transition at the corner of a `Radius.lg` card
 * is visibly a cut rather than a fade. A gradient that reaches zero alpha by the bottom-right
 * produces the same read and survives the corner.
 *
 * ⚠️ **It applies to the CARD rung in DARK mode only, and both halves of that scope are
 * load-bearing.**
 *   - **Cards only.** `shade` at full strength is plain `theme.border`, and it is what carries
 *     WCAG 1.4.11's 3:1 boundary for anything that identifies a CONTROL. A card is a container,
 *     not a control, and on black it is separated by its own fill plus a `getLayeredShadow`
 *     underneath — so it can afford to lose its bottom-right edge. A text field or a button
 *     cannot, and they keep theirs. Do not "finish the job" by extending this to `field`.
 *   - **Dark only.** The trick works because the ground is `#000000` and the pane is lighter
 *     than it. In light mode the pane is `#F9FBFE` on a `#E2EAF5` backdrop — a 1.17 fill step
 *     with nothing else to separate them — so removing the boundary there would leave a card
 *     with no edge at all. Light keeps `shade` and therefore keeps its measured boundary.
 */
const GLASS_EDGE: Record<
  BorderWeight,
  { lit: number; litDark: number; shade: number; shadeDark?: number }
> = {
  // `shadeDark: 0` is the asymmetric top-left-only lip — see the block above.
  card: { lit: 0.95, litDark: 0.16, shade: 1, shadeDark: 0 },
  field: { lit: 0.75, litDark: 0.12, shade: 0.68 },
  button: { lit: 0.62, litDark: 0.1, shade: 0.52 },
};

/** The light source, per the brief: a white lip on the top and left edges. */
const GLASS_LIGHT = '#FFFFFF';

/**
 * The Tactile Glass edge: one stroke that catches the light on its TOP-LEFT and carries the
 * control boundary on its BOTTOM-RIGHT.
 *
 * Returns a `RimGradient`, so it drops straight into the `LinearGradient` padding-ring
 * `components/Surface.tsx` already renders — no new plumbing at the call site, exactly as
 * `computeBorderRamp` did. The difference is the DIAGONAL (`start` top-left → `end`
 * bottom-right): a vertical sweep would light the top edge and leave the left one dark, which
 * is not how a pane of glass catches a light source above and to the left of it.
 *
 * ── The asymmetric case (2026-08-16, brief §3) ─────────────────────────────────────────────
 * A dark-mode CARD returns a THREE-stop ramp instead of two: the white lip, the same lip at a
 * third of its alpha a third of the way across, then fully transparent at the bottom-right. The
 * middle stop is what makes it a lip rather than a wash — without it the highlight is linear
 * across the whole diagonal and reads as a gradient fill on the border, not as light landing on
 * an edge. See `GLASS_EDGE`'s block above for why this is scoped to cards, to dark mode, and to
 * a gradient rather than per-side border widths.
 *
 * @param shade the boundary colour — pass `theme.border`. NOT a screen hue: colour left the
 *   card edge in the 2026-08-15 pass and lives in the pane tint and the badge now. Ignored
 *   entirely on the asymmetric path, which has no shaded side to colour.
 */
export function getGlassEdge(
  shade: string,
  isDark: boolean,
  weight: BorderWeight = 'card',
  strength: number = 1,
): RimGradient {
  const w = GLASS_EDGE[weight];
  // `strength` is the design lab's borderRampStrength knob and defaults to 1, so every pinned
  // test sees unscaled output. It scales both sides together — fading the edge as a whole is
  // the honest answer to "make the border quieter", where scaling only one side would tilt the
  // light source instead.
  const lit = (isDark ? w.litDark : w.lit) * strength;
  const shadeAlpha = (isDark && w.shadeDark !== undefined ? w.shadeDark : w.shade) * strength;
  // Only the top-left catches light; the rest of the ring fades out rather than closing into a
  // frame. `rgba(GLASS_LIGHT, 0)` and not `'transparent'`, because interpolating a named
  // transparent against an rgba white goes through black on Android and leaves a dirty smudge
  // along the bottom-right instead of nothing at all.
  if (shadeAlpha === 0) {
    return {
      colors: [rgba(GLASS_LIGHT, lit), rgba(GLASS_LIGHT, lit * 0.34), rgba(GLASS_LIGHT, 0)],
      locations: [0, 0.34, 1],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    };
  }
  return {
    colors: [rgba(GLASS_LIGHT, lit), rgba(shade, shadeAlpha)],
    locations: [0, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  };
}

/**
 * The pane fill: the translucent glass, or the fully-opaque composite when the user has asked
 * for less transparency.
 *
 * `settings.glassSurfaces` is LIVE again as of 2026-08-15. It was the reduce-transparency
 * accessibility toggle, and between the 2026-08-05 card reset and this pass it was inert
 * because every surface was already opaque — the state it was asking for. Now that translucency
 * is back, so is the toggle, and it needs no new copy: the shipped EN/NO strings already read
 * "Frosted glass finish on cards, buttons and the add button. Turn off for plain, solid
 * surfaces."
 *
 * The screen's identity TINT is deliberately not handled here — a hue cannot be mixed into an
 * `rgba()` string without parsing it, and the tint is a property of the pane rather than of the
 * glass. `components/Surface.tsx` paints it as its own `SCREEN_TINT` wash inside the mask, which
 * also means it composites identically whether the fill under it is translucent or opaque.
 *
 * @param glass   `theme.surfaceGlass` or `theme.surfaceGlassStrong`
 * @param opaque  `theme.surface` — the SAME colour, already composited over the backdrop. The
 *   two are derived from each other by construction (see the `surfaceGlass` doc in
 *   constants/colors.ts) and `__tests__/glassMaterial.test.ts` asserts they still agree, so
 *   turning glass off changes what is drawn but never what is measured for contrast.
 */
export function getGlassFill(glass: string, opaque: string, enabled: boolean): string {
  return enabled ? glass : opaque;
}

/**
 * How much of the screen's identity hue a glass pane carries. 5% — enough to read as "this
 * screen is the green one" when two are compared, not enough to be seen as colour when one is
 * looked at alone. This is where `lib/screenColor.ts` went after the 2026-08-15 ruling took hue
 * off the card edge; it is the QUIET half of the screen's identity, and the icon badge
 * (lib/domainColor.ts) is the loud one. Raising it re-creates the exact problem the ruling
 * solved — a differently-coloured card on a single-colour screen.
 */
export const SCREEN_TINT = 0.05;

/**
 * The two halves of a hardware key's face, per the Tactile Glass brief: *"a subtle top-edge
 * highlight (inner shadow)"* at rest, and *"a dark inner shadow… to simulate the button being
 * depressed into the hardware casing"* while held.
 *
 * React Native has no inner shadow, so both are `LinearGradient` overlays inside the cap's
 * clipping mask — one fading DOWN from the top edge, one fading down from the top edge in the
 * opposite colour. `components/PressableScale.tsx` cross-fades them off the SAME `press` shared
 * value that already drives the sink and the fill darken, so the four cues are one gesture on
 * one curve and cannot disagree. That also means reduced motion needs no branch: `press` is
 * assigned instantly there, so the face snaps with the travel.
 *
 * Returned as plain colour tuples rather than styles because they are consumed inside an
 * animated component — anything computed here must be computed on the JS thread and captured,
 * never called from inside a worklet (`__tests__/workletSafety.test.ts`).
 */
export const KEY_FACE_STOPS = [0, 0.45, 1] as const;

/**
 * The frosted badge plate (Tactile Glass, 2026-08-15) — the neutral disc an identity-hue glyph
 * sits on, per the brief's "a translucent frosted circle with a brightly colored, fully opaque
 * vector icon sitting on top".
 *
 * Returns BOTH halves from one place, deliberately: `paint` is the translucent colour that gets
 * drawn, `plate` is the same thing already composited over the pane, which is what
 * `badgeGlyphFor()` has to measure the glyph against. Keeping the alpha in one constant is the
 * whole point — a palette token plus a separate compositing helper would be two copies of
 * `0.09` free to drift, and a drifted alpha here means a glyph whose measured contrast is not
 * the contrast it actually has. That is the exact failure mode A.4 rule 1 was written about.
 *
 * NEUTRAL in both modes, and the light one is a DARK wash rather than a white one: a white
 * frost on a near-white pane gives a gold glyph nothing to sit on (measured 1.92:1).
 */
const BADGE_FROST = { light: { tint: '#0F172A', alpha: 0.06 }, dark: { tint: '#FFFFFF', alpha: 0.09 } };

export function getBadgeFrost(surface: string, isDark: boolean): { paint: string; plate: string } {
  const { tint, alpha } = isDark ? BADGE_FROST.dark : BADGE_FROST.light;
  return { paint: rgba(tint, alpha), plate: mix(surface, tint, alpha) };
}

/** Resting: light catches the top edge of the cap. */
export function getTopHighlight(strength = 0.18): GradientColors {
  return [rgba('#FFFFFF', strength), rgba('#FFFFFF', strength * 0.25), 'rgba(255,255,255,0)'];
}

/** Held: the cap has sunk into its housing and the housing shades its top edge. */
export function getInnerShade(strength = 0.28): GradientColors {
  return [rgba('#000000', strength), rgba('#000000', strength * 0.3), 'rgba(0,0,0,0)'];
}

/**
 * The edge of a FILLED control, derived from its own fill.
 *
 * A filled button/FAB can't wear the screen hue the way a `ghost` button or a card does — its
 * border has to come from the colour it is filled with, or an accent-filled button on a green
 * screen grows a green rim. This is a lightened, semi-transparent version of the fill: present
 * enough to read as an edge, restrained enough not to look like an outline drawn round a shape.
 *
 * **This is `getMaterialStyle().innerLine`, extracted (2026-08-08).** That function computed a
 * whole glass recipe — wash, scrim, fill gradient, rim, shadows, elevation — and both of its
 * remaining callers (`Button`, `AddFAB`) used this one field and discarded the rest, so ~90
 * lines of colour maths ran on every button render to produce one string. The recipe went with
 * the frosted surfaces it was for; this is the only part anything still asks for.
 *
 * The two alphas are the 2026-07-24 contrast pass's values, unchanged: 0.26/0.5 read as
 * barely-there on a neutral edge hue, so they were bumped until the edge is dependably visible
 * and not only on hues far from the backdrop.
 */
export function filledEdge(base: string, isDark: boolean): string {
  return isDark ? rgba(lighten(base, 0.16), 0.4) : rgba(lighten(base, 0.06), 0.65);
}

/**
 * `getMaterialStyle()` lived here until 2026-08-08 and is DELETED.
 *
 * It computed the whole frosted-glass recipe from one base colour — translucent wash, adaptive
 * scrim, fill gradient, keycap rim, shadow, elevation — for `Surface`, `Button`, `AddFAB` and
 * `GlassFill`. The 2026-08-05 card reset took `Surface` and `Button` off it ("a card is a flat
 * opaque page with ONE border"), which left two callers reading exactly one field, `innerLine`,
 * and discarding every other thing it computed. Flattening `AddFAB` (the last `GlassFill`
 * mount) finished that, so the recipe had no reader at all.
 *
 * Where its parts went:
 *   - `innerLine` → `filledEdge()` above, unchanged formula. This is the only live part.
 *   - `rim` → `computeRimGradient()` below already exists separately and still has three
 *     consumers (BottomNav ×2, IconButton). Untouched.
 *   - wash / scrim / fillGradient / washAlpha / contrastBase → gone with `components/GlassFill.tsx`,
 *     which is deleted in the same change. Nothing rendered them any more.
 *
 * **The no-gloss promise outlived the function.** `__tests__/glassMaterial.test.ts` used to
 * assert `'specular' in getMaterialStyle(...) === false`, which is now vacuous; it asserts over
 * the SOURCE instead, so "don't re-add the specular highlight"
 * (DESIGN_COMPARISON/16-solid-pressable-materials.md §2) is still enforced with the thing it
 * was guarding gone. Re-introducing gloss now means writing a new system, not flipping a token.
 */

/**
 * Soft colored halo — PURPOSEFUL indicator ONLY (primary action + the single active/focused
 * element on a screen). Not decoration; do not apply broadly. New-Arch boxShadow (iOS+Android).
 */
export function getGlow(color: string, level: 'soft' | 'strong' = 'soft') {
  // ── Strengthened for the black canvas, 2026-08-16 (brief §4) ────────────────────────────
  // 0.34 / 0.55 were tuned in 2026-07-18 against a PALE backdrop, where a coloured halo only
  // has to tint a light surface slightly to read. On `#000000` the same alphas are close to
  // invisible: there is no ambient light for the halo to modulate, so what reaches the eye is
  // just `alpha × colour`, and a third of an accent on black is a dark smudge.
  //
  // The brief asks for `shadowOpacity: 0.8` outright ("must use a shadow colored with their
  // respective accent color to create a 'glow'... it should look like LED lights"). `strong`
  // takes that number as-is; `soft` goes to 0.55, i.e. exactly what `strong` used to be, which
  // keeps the two rungs a real step apart rather than collapsing them onto one bright value.
  //
  // The RADII are deliberately NOT the brief's literal 12. This is a two-pass halo — a tight
  // inner glow plus a wide outer bloom at 1.8× — and 12 is a sensible single-pass number that
  // would make the outer pass a 22px near-duplicate of the inner one. Implement the states,
  // not the numbers (the same rule the 2026-08-12 button pass recorded for Travel/elevation).
  // Held at 15/22 so the bloom stays wider than the source it comes from.
  const alpha = level === 'strong' ? 0.8 : 0.55;
  const radius = level === 'strong' ? 22 : 15;
  return {
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: radius, spreadDistance: 0, color: rgba(color, alpha) },
      { offsetX: 0, offsetY: 0, blurRadius: Math.round(radius * 1.8), spreadDistance: 0, color: rgba(color, alpha * 0.5) },
    ],
  };
}

/**
 * Layered depth (take-two fix 3): three shadow passes — contact (tight, grounds the
 * pane), near (mid, the bulk of the float), and cast (soft/wide, the ambient drop) —
 * instead of one flat shadow, so the eye reads real elevation. Returned as an RN
 * `boxShadow` value array (New Arch, RN 0.76+); apply it to the outer surface view and
 * DON'T also set `shadowOpacity`/`elevation` there (they'd double up). `shadowColor` is
 * the theme's shadow token so depth shifts hue with the colour theme. `level` scales the
 * spread: `raised` for resting cards/buttons, `floating` for the FAB and focus-popped cards.
 */
export function getLayeredShadow(shadowColor: string = '#000', level: Exclude<ElevationLevel, 'flat'> = 'raised') {
  const k = level === 'floating' ? 1.6 : 1;
  // Strengthened (2026-07-18 vision tune): higher alphas + a deeper cast so raised-keycap cards
  // POP off the colorful field with real depth/layering, not sit flush like flat tiles. The
  // three passes are contact (tight, grounds the key), near (the bulk of the lift), and cast
  // (soft/wide ambient drop).
  return [
    { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: rgba(shadowColor, 0.10) },
    { offsetX: 0, offsetY: Math.round(4 * k), blurRadius: Math.round(14 * k), spreadDistance: 0, color: rgba(shadowColor, 0.14) },
    { offsetX: 0, offsetY: Math.round(10 * k), blurRadius: Math.round(26 * k), spreadDistance: -2, color: rgba(shadowColor, 0.10) },
  ];
}
