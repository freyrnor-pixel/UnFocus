/**
 * screenColor.ts — per-SCREEN hue layer. **REVIVED 2026-08-05 (card design reset).**
 *
 * Maps each screen to ONE hue so a screen reads as a single colour family, and grades that
 * hue by element WEIGHT so importance is legible without a second colour: the card border is
 * the deepest tone, a field or option border is lighter, a button's border lighter still.
 * Combined with components/Surface.tsx's flat white fill, the border is now the *only* place
 * colour lives on a card — which is why this module came back.
 *
 * **History worth knowing before touching this.** This layer existed, was retired on
 * 2026-07-31 (addendum A.5), and is now back with the conflict that killed it resolved. It
 * was retired because the per-screen hue and lib/domainColor.ts's per-CARD identity hue were
 * two systems competing for the same 2.5px bevel, and an un-coded card on a tab drew the
 * tab's colour whether or not that made sense. The maintainer's 2026-08-05 ruling settles it:
 * **one colour per screen wins, and it is the card border.** domainColor.ts survives for the
 * gradient BADGE and its ink (components/CardAccent.tsx) — the glyph plate, not the edge — so
 * the two systems no longer touch the same pixels. Don't re-derive a card edge from
 * domainColor; ask this module.
 *
 * **Home is deliberately neutral.** It has no hue of its own; each of its preview cards wears
 * the hue of the screen it previews (see `getScreenColor(theme, 'habits')` in
 * components/HomeHabitsCard.tsx and its siblings), so Home reads as an index of the other
 * screens rather than a sixth colour. Settings is neutral for the same "this is chrome, not a
 * domain" reason. Both resolve to `theme.border`, which is a real ≥3:1 token — neutral here
 * means grey, never invisible.
 *
 * Connections:
 *   Imports → constants/colors (ThemePalette), constants/theme (rgba), react
 *   Used by → components/ScreenScaffold.tsx (provides ScreenColorContext for the screen body),
 *             components/CardExpandHost.tsx (provides the OPEN CARD's hue inside a full-screen
 *             pane — it is mounted outside every scaffold, so without it every hue-reading
 *             control in an expanded card fell back to the blue accent),
 *             components/Surface.tsx (edge hue fallback via useScreenColor), the 5 tab roots
 *             + the sub-tier screens that name their own key, and the Home preview cards
 *             (which call getScreenColor directly with their SOURCE screen's key).
 *             `useControlHue` → components/IconButton, components/VoiceNoteFAB,
 *             components/AddFAB, components/NewSinceGlow — the glow-bearing controls
 *   Data    → pure functions + a React context (no store/DB)
 *
 * Edit notes:
 *   - Keys are react-navigation route names where one exists ('shopping', 'plans', 'index',
 *     'health', 'habits'); sub-tier screens pass their own key explicitly since they have no
 *     pager route. 'home' is an alias for 'index'.
 *   - **An unknown route resolves to NEUTRAL, not to `accent`.** It used to fall back to
 *     `theme.accent`, which meant any screen this module didn't know about drew the action
 *     colour on every card edge — the accent is for things you can press, so a card wearing it
 *     reads as tappable when it isn't. A screen with no hue is grey on purpose.
 *   - `soft` is a translucent tint for a fill that needs to belong to the screen (a section
 *     wash, a selected chip). It is NOT for text — same rule as domainColor's accent: these
 *     hues separate by lightness and several of them (Shopping's green, Notes' yellow) are far
 *     below 4.5:1 as ink. Pass `theme.text`/`theme.textMuted` for words.
 *   - Adding a screen means adding a key here AND passing it from that screen's scaffold.
 *     A screen that forgets the second half is neutral, not broken.
 */
import React from 'react';
import { ThemePalette } from '@/constants/colors';
import { rgba } from '@/constants/theme';

/**
 * Every screen that owns a hue, plus the two that deliberately don't ('index'/'home' and
 * 'settings' — see the header). Tab routes use their react-navigation route name; sub-tier
 * screens use their own name, since they have no pager route to read.
 */
export type ScreenKey =
  | 'shopping'
  | 'plans'
  | 'index'
  | 'home'
  | 'health'
  | 'habits'
  | 'notes'
  | 'food'
  | 'scan'
  | 'goals'
  | 'settings';

/**
 * Screen → palette token (2026-08-05, maintainer-specified). The `feat*` tokens were built
 * for exactly this and kept contrast-tested through the retirement, so this mapping needed no
 * new colour: see constants/colors.ts, where they are ordered by routine sequence.
 *
 * `null` = deliberately no hue; resolves to the neutral `theme.border` below.
 *
 * ⚠️ **The hue NAMES below are the LIGHT palette's (2026-08-16).** The dark `feat*` octet was
 * aligned onto `IDENTITY_HUES`' five neon categoricals so a screen's pane wash and the badge on
 * it stopped disagreeing (that wash was deleted on 2026-08-20 — a card is white glass now — but
 * the alignment still serves the badge, the nav tab and a primary key's halo) — so in dark mode
 * `plans` is amber, `habits` cyan, `health` rose,
 * `shopping` green, `notes` amethyst. This table is unchanged: which TOKEN a screen reads is
 * the same in both modes, only the values behind them differ. See constants/colors.ts.
 */
const SCREEN_TOKEN: Record<ScreenKey, keyof ThemePalette | null> = {
  plans: 'featTask',      // blue   — the to-do list
  habits: 'featHabit',    // sky    — habits
  health: 'featHealth',   // teal   — health
  shopping: 'featShop',   // green  — shopping
  notes: 'featNote',      // yellow — notes
  food: 'featMeal',       // orange — food & meals
  scan: 'featScan',       // violet — scan & receipts
  // Indigo — goals. **No screen passes this key any more** (2026-08-12): app/goals.tsx was
  // retired, and the Goals drawer that replaced it deliberately wears its HOST screen's hue
  // (see components/CollapsedSection.tsx's `badgeHue` note — a drawer that changed colour
  // depending on which tab you opened it from was the 2026-08-10 "wrong coloring" report).
  // Kept because goals are still a domain with a colour, and this table is the one place that
  // is written down; don't wire it up to the drawer.
  goals: 'featPlan',
  // ⚠️ **'index' has its own hue as of 2026-09-01 — the app's blue, `featHome`.** It aliased
  // `featTask` from the 5→3 merge until then, on the reasoning that Home WAS the day's tasks. The
  // five tabs came back on 2026-08-22 and that stopped being true: To-do is one swipe away and
  // wears the same gold, so the two neighbouring tabs lit up identically and every categorical
  // control on Home — the Energy tutorial button's halo most visibly — came out gold on the one
  // screen that is not a category. Both halves were reported.
  //   The old note's point still stands and is what rules out going back to `null`: a neutral key
  // makes `navTabHue` fall through to `theme.accent`, i.e. a tab with no cue of its own. Naming
  // the accent explicitly gets the same pixels with the meaning the other way round — Home is the
  // app, not an absence — and it is what the standing mark in components/BottomNav.tsx pairs with.
  index: 'featHome',
  // Still neutral: 'home' is the legacy key for the same screen, kept for callers that pass
  // it, and `settings` is chrome rather than a domain.
  home: null,
  settings: null,
};

/**
 * How prominent the element wearing this hue is. This is the "green → light green" ramp the
 * maintainer asked for, in its across-elements half: one screen, one hue, stepped lighter as
 * the element gets smaller and less important. The within-one-border half is
 * `computeBorderRamp` in constants/theme.ts, which consumes the tone this produces.
 *
 * Deliberately only three rungs. A fourth would be a distinction nobody can see, and the
 * whole point of the reset is that there is one obvious answer per element.
 */
export type HueWeight =
  /** A card's own edge — the deepest tone, the boundary that matters most on a screen. */
  | 'card'
  /** A text box, an option row, a picker — the things inside a card. */
  | 'field'
  /** A button's edge. Lightest: the button already carries its own fill and state. */
  | 'button';

export type ScreenHue = {
  /** The screen's dominant hue at full strength — the base every weight is derived from. */
  base: string;
  /** Translucent tint of the base, for a fill that should belong to the screen. Never text. */
  soft: string;
  /** True when this screen deliberately has no hue (Home, Settings) — its base is grey. */
  neutral: boolean;
};

/**
 * Resolve a screen key to its hue. An unknown or missing key resolves to the neutral
 * `theme.border` (NOT `accent` — see the Edit notes), so a screen that hasn't been given a
 * hue reads as calm grey rather than as one big action.
 */
export function getScreenColor(theme: ThemePalette, route: string | null | undefined): ScreenHue {
  const known = route && route in SCREEN_TOKEN;
  const token = known ? SCREEN_TOKEN[route as ScreenKey] : null;
  const base = token ? (theme[token] as string) : theme.border;
  return { base, soft: rgba(base, 0.14), neutral: !token };
}

/**
 * The active screen's base hue, or null outside a screen that provides one — AND null on a
 * screen whose key is deliberately neutral ('home', 'settings'), which ScreenScaffold collapses
 * rather than passing that key's grey base down. Every consumer reads
 * `useScreenColor() ?? theme.border`, which is the value a neutral key resolved to anyway, so
 * the two cases draw identically; what the collapse buys is that `null` means "no hue" rather
 * than "grey", which `useControlHue` below depends on.
 */
export const ScreenColorContext = React.createContext<string | null>(null);

/** Read the ambient screen hue set by the nearest ScreenScaffold (null if none). */
export function useScreenColor(): string | null {
  return React.useContext(ScreenColorContext);
}

/**
 * The hue a CONTROL lights up in — its active glyph, its body wash and its halo.
 *
 * **Dark mode only, and that is measured rather than chosen.** Round 20's brief: *"Glow belongs
 * to accent icons, the active chip and the primary button only, and is always the card's own
 * feature hue — never blue on a pink or cyan screen."* In DARK that is straightforwardly better
 * than the blue it replaces: the five hues measure 3.79–7.77:1 as a glyph on their own 14% key
 * body, against `theme.accent`'s 3.82, so four of the five gain contrast and Notes' violet is a
 * wash with it. In LIGHT the same swap is a regression — light's `feat*` octet is the 2026-08-10
 * cinematic mid-tone set, not the neon ladder, and it measures 2.48–4.08:1 there against the
 * accent's 4.39. Notes' violet at **2.48 fails WCAG 1.4.11's 3:1 floor for a non-text control**,
 * and Health's teal (3.07) and Habits' sky (3.30) only just clear it. So light keeps the accent.
 *
 * This is the SAME split `components/BottomNav.tsx`'s `navTabHue` already makes, for the same
 * measured reason (see AGENTS.md's neon-pass entry) — it is one rule applied twice, not a second
 * rule. `lib/__tests__/screenColor.test.ts` pins both halves, the light-mode FAILURE included, so
 * nobody "finishes the job" by making light categorical too.
 *
 * A screen with no hue of its own (outside a ScreenScaffold — a modal, a sheet) gets
 * `theme.accent`, exactly as `components/Button.tsx` already falls back. Never the neutral grey:
 * a grey halo is a smudge, not an identity.
 */
export function useControlHue(theme: ThemePalette, isDark: boolean): string {
  const screenHue = useScreenColor();
  return isDark && screenHue ? screenHue : theme.accent;
}
