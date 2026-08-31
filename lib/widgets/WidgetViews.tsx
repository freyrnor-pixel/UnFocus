/**
 * WidgetViews.tsx — the Android home-screen widget layouts + a name→JSX resolver.
 *
 * The live set is Shopping / Tasks / Notes / Habits / Health (WIDGET_NAMES); the retired
 * Overview layout is kept only for installs whose native build predates Habits/Health.
 * Pure presentational layouts built with react-native-android-widget primitives
 * (FlexWidget/TextWidget/ListWidget). They take an already-localised WidgetSnapshot slice
 * and a palette, so they never touch stores, i18n, or the settings theme — the app bakes
 * every string and the light/dark colours are chosen by the caller via renderWidgetByName.
 *
 * ── The card anatomy, 2026-08-28 ────────────────────────────────────────────────────────────
 * **A widget IS a card, so it is drawn like one.** The colours were re-synced on 2026-08-15 and
 * again on 2026-08-26 and have been correct since; what had gone a year stale is the SHAPE. The
 * app's card was rebuilt twice over in between (the round 19 surface reset and round 20's
 * corrected screens) and none of it reached the one surface that renders with the app process
 * dead — the same blind spot the palette had, one level up from colour. Five things came across,
 * each named against the app component that owns it:
 *
 *   1. **A lit edge** (components/Surface.tsx, round 20). The card carries a real per-side
 *      border: a white lip on the top and left, `border` on the bottom and right. That is the
 *      one app treatment a widget wants *more* than a screen does — a widget has no page behind
 *      it, only a wallpaper, and the edge is what separates the two.
 *   2. **The header is a badge + a two-storey naming column** (components/SectionRail.tsx, tier
 *      `card`): a neutral frosted plate with the hue fully opaque on top (the 2026-08-15 badge
 *      inversion), then the title with the subtitle UNDER it as a `peek` line — muted, not the
 *      hue, and not hung off the right-hand edge (round 20: a card says what it holds, in words).
 *   3. **Rows are boxed** (components/PadSheet.tsx, round 19): a neutral fill one step off the
 *      card with a quiet edge, `Radius.sm`, stacked with a 4px gap.
 *   4. **The check is on the RIGHT** (components/PadRow.tsx, the 2026-07-30 row rule, which the
 *      widgets never got): `[leading?] title → right value → [○ check]`. An empty check is a
 *      neutral RING on the boundary token; a ticked one is filled with the hue.
 *   5. **Nothing is written on a hue** (constants/theme.ts's `glassKey`, 2026-08-17). Notes' mic
 *      button is a matte key now — a flat wash of its own hue with a lit edge and a plain
 *      `text` label — instead of a solid accent pill with contrast-derived ink on it.
 *
 * What deliberately did NOT come across, so the gaps read as decisions:
 *   - **The halo.** `getGlow` is a two-pass shadow; RemoteViews has one text shadow and no view
 *     shadow at all. A key here is body + edge, and that is the whole of it.
 *   - **The card hint line** (components/CardHintLine.tsx, round 20). One muted italic line
 *     saying what a card is FOR is teaching copy for a screen you are standing on; a widget is
 *     glanced at, and the app's own "no manual" ruling applies here hardest.
 *   - **The domain GLYPH inside the badge.** Drawing an icon font in a headless RemoteViews
 *     render is the failure mode this file's own Edit notes warn about (a glyph that fails to
 *     rasterise blanks the whole widget). The plate carries a hue dot instead: the badge's
 *     construction — neutral ground, hue on top — without the risk. A widget needs no glyph to
 *     say which surface it is; there is exactly one of each.
 *   - **Fading a done row.** `PadRow` drops the whole row to `DONE_ROW_OPACITY` and strikes the
 *     title through; neither exists here, so a settled row says so with muted ink and a filled
 *     check, exactly as it did before.
 *   - **The narrator.** An empty card in the app may draw a `NarratorQuote` — a cycled,
 *     first-person, italic aside. A widget's empty line is `StarterCard`'s plain register
 *     instead: there is nothing to cycle it with, and a home screen is glanced at. See `Empty`.
 *
 * Interactivity: Tasks/Shopping/Notes/Habits rows live inside a scrollable ListWidget and
 * each carries its own clickAction so a tap writes back through the headless handler
 * (lib/widgets/handler.tsx → lib/widgets/widgetActions.ts):
 *   - Tasks   row → 'TOGGLE_TASK'      (mark done / not-done)
 *   - Shopping row → 'CYCLE_SHOP_ITEM' (list → cart → purchased)
 *   - Notes   row → 'TOGGLE_NOTE'      (check off; it then leaves the active list)
 *   - Habits  row → 'TOGGLE_HABIT'     (mark today met / not-met)
 *   - Health  medicine tray row → 'TAKE_TRAY' (log the whole window, 2026-08-15)
 * Health's SYMPTOM rows stay read-only (no clickAction — empty taps fall through to the card's
 * OPEN_APP): un-logging one deletes a dated entry with a severity and maybe a note on it, which
 * belongs in the app's own editor, not on a home screen. Its medicine trays are the exception
 * and the widget's only write into health data. The Notes header's mic + "open" buttons use
 * 'OPEN_URI' into the app (speech recognition can only run in-app), and every frame falls back
 * to OPEN_APP / OPEN_URI for empty taps.
 *
 * Connections:
 *   Imports → react-native-android-widget (FlexWidget, TextWidget, ListWidget), lib/widgets/snapshot (types)
 *   Used by → lib/widgets/handler.tsx (headless render), lib/widgets/sync.ts (in-app requestWidgetUpdate),
 *             scripts/build-widget-previews.mjs (extracts the palette tables + the layout it mirrors)
 *   Data    → none (pure)
 *
 * Edit notes:
 *   - WIDGET_NAMES must stay in lockstep with the `name` fields in app.json's
 *     react-native-android-widget `widgets` array and with the requestWidgetUpdate calls
 *     in lib/widgets/sync.ts — a mismatch means the widget silently never updates.
 *   - Per-row clickAction inside a ListWidget IS supported (RNWidgetCollectionService sets a
 *     fill-in intent per item). Keep OPEN_URI/OPEN_APP buttons OUTSIDE the ListWidget (in the
 *     header/frame) — those "special" actions route through the non-collection click path.
 *   - Colours must be `#RRGGBB` literals (the lib's ColorProp type) — that's why palette
 *     values and the snapshot accents are typed/cast to Hex here. Keep layouts shallow
 *     (Flex + Text) — no app components, no StyleSheet — they render to native RemoteViews.
 *   - ⚠️ **Every translucent layer the app draws is COMPOSITED here, never passed as an alpha.**
 *     The lib's `ColorProp` does admit `rgba(r, g, b, a)`, so this is a choice: the app's glass
 *     composites over its own backdrop, and a widget has no backdrop — only the user's
 *     wallpaper. A translucent row box would let a photo through the pane and the whole "one
 *     step off the card" relationship would depend on what someone's wallpaper happens to be.
 *     So the tables below hold each layer ALREADY composited over `card`, exactly the way
 *     constants/colors.ts derives `surface` from `surfaceGlass`. The test recomputes them.
 *   - Do NOT put Unicode symbol glyphs (☑/☐/•/…) in a TextWidget: rendering them to the
 *     RemoteViews bitmap can fail and blank the WHOLE widget. Use a FlexWidget shape (a filled
 *     dot for done/in-cart, a bordered ring for not-done/in-list) instead.
 *   - **There is no italic here, and the reason is register rather than rendering.** One shipped
 *     briefly and was reverted the same day: a widget CAN draw synthesised italic (it names no
 *     font family, so the Android limitation behind the app's ban does not apply to it) — but
 *     these empty-state strings are plain statements, which `components/StarterCard.tsx` draws
 *     upright. The app's one italic is `components/NarratorQuote.tsx`'s first-person aside, and
 *     copying the slant without the voice is decoration. See `Empty` below.
 */
import React from 'react';
import { FlexWidget, TextWidget, ListWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';

// The live set (drives the app-side requestWidgetUpdate fan-out + app.json). 'Overview' was
// retired in favour of dedicated Habits + Health widgets; its render case is kept below for
// installs whose native build still has the old Overview receiver until they update.
export const WIDGET_NAMES = ['Shopping', 'Tasks', 'Notes', 'Habits', 'Health'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

type Hex = `#${string}`;
const hex = (c: string) => c as Hex;

type Palette = {
  /** The widget's own face. A widget on a home screen IS a card, so this is `surface`. */
  card: Hex;
  text: Hex;
  muted: Hex;
  /** `theme.border` — the control-boundary token. An empty check ring and the card's shaded edge. */
  line: Hex;
  /** The badge's frosted plate (`getBadgeFrost`), composited over `card`. */
  plate: Hex;
  /** A boxed row's fill and edge (components/PadSheet.tsx's `ROW_BOX_*`), composited over `card`. */
  rowFill: Hex;
  rowEdge: Hex;
  /** The card's lit top-left lip (`getGlassEdge`'s first stop), composited over `card`. */
  edgeLit: Hex;
  dark: boolean;
};

/**
 * Hand-mirrored from constants/colors.ts — widgets render headless and can't call
 * useAppTheme(). `lib/widgets/__tests__/widgetPalette.test.ts` asserts these still equal the
 * real tokens, which is what stopped them drifting for a year.
 *
 * Refreshed 2026-08-15. Both palettes had been frozen at the 2026-07-14 values and were wrong
 * on every channel: DARK was the retired "Midnight glass" navy (`#0B0E14`/`#1A2030`) rather
 * than the true black the app went to on 2026-08-10 — and dark is the DEFAULT since
 * 2026-08-16, so that was what most people were actually looking at.
 *
 * The frame paints `card`/`surface`, not `bg`. A widget floats on the user's wallpaper with
 * no page behind it, so `surface` is what it structurally is; painting a widget `#000000`
 * would also dissolve it into any dark wallpaper. (The old `bg` field is gone rather than
 * left unused — `card` was declared and never referenced, which is how the frame ended up
 * drawn in the page colour in the first place.)
 *
 * **Re-synced 2026-08-26** (DESIGN_COMPARISON/19 phase 1's `surface`/`accent`/identity-hue
 * retune): `DARK.card` `#1E1E1E` → `#242424`; `LIGHT.card` `#F9FBFE` → `#FDFEFF` — this second
 * one had ALREADY drifted before this pass touched anything, from an earlier `surface` edit
 * that updated `constants/colors.ts` but not this hand copy (exactly the widget-palette lesson
 * this file's own header describes). Every `LIGHT_INK` entry is recomputed below because the
 * light-mode floor (`mix toward black until 4.5:1 on LIGHT.card`) depends on `LIGHT.card`,
 * which moved — so even the three unretuned hues (todo/habits/health) needed a new ink value.
 *
 * **Four DERIVED fields joined on 2026-08-28** — `plate`, `rowFill`, `rowEdge`, `edgeLit`. Each
 * is a translucent app layer already composited over `card` (see the Edit note above for why
 * compositing rather than an alpha), and each is recomputed by the test from the app source
 * that owns it: `getBadgeFrost` and `getGlassEdge` in constants/theme.ts, `ROW_BOX_*` in
 * components/PadSheet.tsx. There is no fifth: the card's SHADED edge is `line` itself, because
 * `GLASS_EDGE.card` carries no `shadeDark` and so resolves to plain `theme.border` at full
 * alpha in both modes.
 */
// `muted`/`line` lifted 2026-08-20 with constants/colors.ts's contrast pass — these are baked
// copies, and lib/widgets/__tests__/widgetPalette.test.ts recomputes them from the real palette
// and fails the PR on a drift. That is what caught this pair; keep them moving together.
const LIGHT: Palette = {
  // ⚠️ Re-derived 2026-09-01 with light `surfaceGlass` 0.94 -> 0.82, which moved `surface` to
  // `#FAFCFE`. Everything below that composites over the card moved with it — exactly the drift
  // the palette test exists to catch, and it caught all five.
  card: '#FAFCFE', text: '#1B2432', muted: '#535D6B', line: '#65768F',
  plate: '#ECEEF1', rowFill: '#F0F2F5', rowEdge: '#E4E6EA', edgeLit: '#CDD4DD',
  dark: false,
};
const DARK: Palette = {
  card: '#242424', text: '#FFFFFF', muted: '#B0B0BA', line: '#8A8A95',
  plate: '#383838', rowFill: '#303030', rowEdge: '#3A3A3A', edgeLit: '#474747',
  dark: true,
};

/**
 * A hue's light-mode ink. The five identity hues are tuned for a BLACK card — on the light
 * surface they measure 1.35–3.42:1, i.e. unreadable as the header's subtitle text and under
 * the 3:1 shape floor for the row markers. Each value here is its hue mixed toward black
 * until it clears 4.5:1 on LIGHT.card, which is exactly what lib/domainColor.ts's
 * badgeGlyphFor() computes at runtime in the app — a call this file can't make, since it
 * renders in a bare headless context. The test recomputes them from IDENTITY_HUES rather
 * than trusting the table, so a hue moving in the app moves these too.
 *
 * Recomputed 2026-08-26 for the `LIGHT.card`/`DARK.accent` retune above — keyed by hue, so
 * `#0DB34A`/`#B45CFF`/`#1E88FF` (their pre-retune values) are gone; look up by the new hex.
 *
 * ⚠️ **ONE table, used everywhere a hue is drawn in light mode — including the badge dot, which
 * the app derives separately** (2026-08-28). `badgeGlyphFor` walks each hue against the *plate*
 * to 3.3:1, so the app's badge ink and its card ink are two different values. Baking a second
 * table here would be a second thing to keep in step for no gain: this one targets the STRICTER
 * floor (4.5:1 on the card), and the test proves every entry also clears 3.3:1 on the composited
 * `plate` and 3:1 on `rowFill`, which is every ground a hue actually lands on in a widget.
 */
const LIGHT_INK: Record<string, Hex> = {
  '#FFD700': '#877200', // To-do gold
  '#05D9E8': '#038089', // Habits cyan
  '#FF8CB2': '#A85C75', // Health rose
  '#24B451': '#1B853C', // Shopping emerald
  '#B660FF': '#9951D6', // Notes violet
  '#298AFF': '#2274D6', // accent (the overview's stand-in for an identity hue)
};

/** The accent as it may actually be drawn in this palette. Identity hues pass through in dark. */
function ink(accent: Hex, p: Palette): Hex {
  if (p.dark) return accent;
  return LIGHT_INK[accent.toUpperCase()] ?? accent;
}

/**
 * One translucent layer, flattened onto the ground it is drawn over — the arithmetic half of
 * the "composite, never alpha" rule in the Edit notes. Mirrors `mix()` in constants/theme.ts,
 * which is what every app-side recipe (`getBadgeFrost`, `glassKey`, `getGlassEdge`) is built on.
 *
 * Only `keyStyle()` calls it at render time; the palette's own composited fields are baked
 * literals, because scripts/build-widget-previews.mjs extracts those tables by regex and a
 * computed field would be invisible to it.
 */
function composite(base: Hex, tint: Hex, alpha: number): Hex {
  const bytes = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = bytes(base);
  const [r2, g2, b2] = bytes(tint);
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  return hex(`#${to(r1 + (r2 - r1) * alpha)}${to(g1 + (g2 - g1) * alpha)}${to(b1 + (b2 - b1) * alpha)}`);
}

/** The white a lit edge catches, in both the card's edge and a key's — `GLASS_LIGHT`. */
const GLASS_LIGHT = '#FFFFFF' as Hex;

/**
 * The matte-glass KEY (constants/theme.ts's `glassKey`, 2026-08-17), composited.
 *
 * The app's primary action stopped being a solid accent pill with derived ink on it: it is a
 * flat wash of its own hue, a white lip on the top-left, a quiet boundary on the bottom-right,
 * and a `theme.text` label. Notes' mic button is the widget layer's one key, so it follows.
 *
 * The `KEY_BODY_ALPHA` / `KEY_EDGE_*` numbers are the app's, mirrored — the test recomputes the
 * whole style against the real `glassKey()` and fails on a drift, the same mechanism the palette
 * tables have. What is NOT here is the halo: `getGlow` is a two-pass shadow and RemoteViews has
 * none, so a key is body + edge and nothing else.
 */
function keyStyle(accent: Hex, p: Palette) {
  const body = composite(p.card, accent, p.dark ? 0.14 : 0.16);
  const lit = composite(p.card, GLASS_LIGHT, p.dark ? 0.3 : 0.9);
  const shade = p.dark ? composite(p.card, GLASS_LIGHT, 0.07) : composite(p.card, accent, 0.35);
  return {
    backgroundColor: body,
    borderWidth: 1.25,
    borderTopColor: lit,
    borderLeftColor: lit,
    borderBottomColor: shade,
    borderRightColor: shade,
  };
}

// ── Geometry ─────────────────────────────────────────────────────────────────
// **SHAPE is the app's; RHYTHM is scaled.** The two halves are split deliberately and the line
// between them is worth knowing before moving anything here.
//
// A radius and an edge width are what a card IS — a 16px corner with a 1.5px lit lip reads as
// the same object at any size — so those are `constants/theme.ts`'s tokens outright, and
// `lib/widgets/__tests__/widgetPalette.test.ts` pins each one to the token it came from.
//
// Padding and gaps are not: they are proportional to the TYPE, and this file has drawn at one
// rung below the app's since it was written (13px rows against `FontSize.md`'s 17). Spending the
// app's `Spacing.md` on a card whose minimum is 180×110dp is not fidelity, it is a smaller
// widget — measured, on the real declared size: the app's own insets plus this anatomy leave a
// 110dp-tall widget room for exactly ONE row, where the flat header and unboxed rows it replaces
// fit two. The peek line and the row boxes are the app's decisions and they cost real height; the
// padding around them is where that height is found. So the rungs below are the app's scale
// stepped down one, not new numbers: 12/8/6/3 against 16/8/8/4.
const CARD_RADIUS = 16; // Radius.md
const ROW_RADIUS = 12; // Radius.sm
const CARD_EDGE = 1.5; // BORDER_WIDTH.card
const ROW_EDGE = 1.25; // BORDER_WIDTH.field
/** The widget's own rhythm — `Spacing`, one rung down. See the block above. */
const S = { xxs: 3, xs: 6, sm: 8, md: 12 };

/** The card. A lit top-left lip, the boundary token bottom-right — components/Surface.tsx. */
function frame(p: Palette) {
  return {
    height: 'match_parent' as const,
    width: 'match_parent' as const,
    flexDirection: 'column' as const,
    paddingHorizontal: S.md,
    paddingTop: S.sm,
    paddingBottom: S.md,
    borderRadius: CARD_RADIUS,
    borderWidth: CARD_EDGE,
    borderTopColor: p.edgeLit,
    borderLeftColor: p.edgeLit,
    borderBottomColor: p.line,
    borderRightColor: p.line,
    backgroundColor: p.card,
  };
}

/**
 * A boxed row — components/PadSheet.tsx's `line` + its neutral fill/edge pair.
 *
 * The stack gap is that file's own reasoning carried over: two 1.25px borders flush against
 * each other paint a 2.5px line between every pair of rows, heavier than the card's own edge,
 * which inverts the hierarchy the fill is there to establish. It is the smallest rung here
 * rather than PadSheet's `Spacing.xs`, for the reason the geometry block above gives.
 */
function rowStyle(p: Palette) {
  return {
    width: 'match_parent' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: S.sm,
    paddingVertical: 5,
    marginBottom: S.xxs,
    borderRadius: ROW_RADIUS,
    borderWidth: ROW_EDGE,
    borderColor: p.rowEdge,
    backgroundColor: p.rowFill,
  };
}

/**
 * The row's trailing check — components/PadRow.tsx's, on the right where the row rule puts it
 * (2026-07-30: *"a paper checklist puts its ticks in the right margin"*).
 *
 * Neutral while empty and hue only once ticked, which is the app's own rule and not merely a
 * colour choice: an empty ring is a CONTROL BOUNDARY and belongs on the contrast-tuned `border`
 * token. The tick itself is the fill — there is no checkmark glyph, per the Unicode note above.
 */
function Check({ done, accent, p }: { done: boolean; accent: Hex; p: Palette }) {
  return (
    <FlexWidget
      style={{
        width: 13,
        height: 13,
        borderRadius: 7,
        marginLeft: S.sm,
        borderWidth: 2,
        borderColor: done ? accent : p.line,
        ...(done ? { backgroundColor: accent } : null),
      }}
    />
  );
}

/** Filled leading marker (an ongoing entry). */
function Dot({ color }: { color: Hex }) {
  return <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, marginRight: S.sm, backgroundColor: color }} />;
}
/** Hollow leading marker (a settled entry). */
function Ring({ color }: { color: Hex }) {
  return (
    <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, marginRight: S.sm, borderWidth: 2, borderColor: color }} />
  );
}

/**
 * The card header — components/SectionRail.tsx at its `card` tier.
 *
 * A badge, then a naming COLUMN: the title, and under it the `peek`. The snapshot still calls
 * that string `subtitle` (renaming the wire format would strand every snapshot row an older
 * build persisted) but the slot it lands in is the peek: one muted line saying what the card
 * holds, where it used to be an accent-coloured chip hung off the right-hand edge. Round 20's
 * framing is that a count beside a name reads as a score and a sentence does not — and the
 * second storey is also what stopped the title having to compete with it for one row's width.
 */
function Header({
  title,
  peek,
  accent,
  p,
  right,
}: {
  title: string;
  peek: string;
  accent: Hex;
  p: Palette;
  right?: React.ReactNode;
}) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {/* The inverted badge: a neutral frosted plate with the hue fully opaque on top. */}
        <FlexWidget
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            marginRight: S.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.plate,
          }}
        >
          <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget
            text={title}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 15, fontWeight: '700', color: p.text }}
          />
          {peek ? (
            <TextWidget text={peek} maxLines={1} truncate="END" style={{ fontSize: 11, color: p.muted }} />
          ) : null}
        </FlexWidget>
      </FlexWidget>
      {right ?? null}
    </FlexWidget>
  );
}

/**
 * What an empty surface says — no container, no fill, no border, one short muted line.
 *
 * That is `components/StarterCard.tsx`'s register, not `components/NarratorQuote.tsx`'s, and the
 * difference decides the type. The narrator is a dry FIRST-PERSON aside and is the app's one
 * sanctioned italic; these strings are plain statements of fact ("Listen er tom", "Ingen vaner i
 * dag"), which StarterCard draws upright. This line was briefly italic (2026-08-28, and reverted
 * the same day): italic on copy that is not an aside is decoration, which is the exact use the
 * 2026-08-18 ban was about. If these strings are ever rewritten in the narrator's voice, the
 * italic question reopens with them — not before.
 *
 * Every widget passes a string now. `habits` and `health` were the two that passed `''`, so an
 * empty Habits or Health widget drew a header over a blank body while every other empty surface
 * in the app says something.
 */
function Empty({ text, p }: { text: string; p: Palette }) {
  if (!text) return null;
  return (
    <FlexWidget
      style={{ width: 'match_parent', flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: S.xs }}
    >
      <TextWidget text={text} maxLines={2} truncate="END" style={{ fontSize: 13, color: p.muted }} />
    </FlexWidget>
  );
}

function More({ text, p }: { text: string; p: Palette }) {
  if (!text) return null;
  return <TextWidget text={text} style={{ fontSize: 12, color: p.muted, marginTop: S.xxs }} />;
}

/** Scrollable list container + a "+N more" footer, sharing the column layout of every widget.
 *  ListWidget has no flex prop (it maps to a native ListView), so it fills a flex:1 wrapper
 *  via height:'match_parent', leaving the footer its own row below.
 *  The gap above it is the header→body gap SectionRail reserves as its own `marginBottom`,
 *  which is also the whole of that separation now: the hairline rule under a card header was
 *  deleted in round 20 as a "stray artefact", and nothing replaced it. */
function ScrollBody({ more, p, children }: { more: string; p: Palette; children: React.ReactNode }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'column', marginTop: S.xs }}>
      <FlexWidget style={{ width: 'match_parent', flex: 1 }}>
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>{children}</ListWidget>
      </FlexWidget>
      <More text={more} p={p} />
    </FlexWidget>
  );
}

/** Title + trailing check — the shape four of the five widgets' rows take. */
function CheckRow({
  label,
  done,
  accent,
  p,
}: {
  label: string;
  done: boolean;
  accent: Hex;
  p: Palette;
}) {
  return (
    <>
      {/* The label is wrapped rather than flexed directly: TextWidget carries no `flex` of its
          own, so a bare one sizes to its content and the check drifts in beside it instead of
          sitting at the row's right edge. */}
      <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget
          text={label}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, color: done ? p.muted : p.text }}
        />
      </FlexWidget>
      <Check done={done} accent={accent} p={p} />
    </>
  );
}

// ── Shopping ─────────────────────────────────────────────────────────────────
function ShoppingWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.shopping;
  const accent = ink(hex(s.accent), p);
  return (
    <FlexWidget clickAction="OPEN_APP" style={frame(p)}>
      <Header title={s.title} peek={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {s.items.map((item, i) => (
            <FlexWidget
              key={`${i}-${item.id}`}
              clickAction="CYCLE_SHOP_ITEM"
              clickActionData={{ id: item.id }}
              style={rowStyle(p)}
            >
              <CheckRow label={item.name} done={item.state === 'cart'} accent={accent} p={p} />
            </FlexWidget>
          ))}
        </ScrollBody>
      )}
    </FlexWidget>
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────────
function TasksWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.tasks;
  const accent = ink(hex(s.accent), p);
  return (
    <FlexWidget clickAction="OPEN_APP" style={frame(p)}>
      <Header title={s.title} peek={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {s.items.map((task, i) => (
            <FlexWidget key={`${i}-${task.id}`} clickAction="TOGGLE_TASK" clickActionData={{ id: task.id }} style={rowStyle(p)}>
              <CheckRow label={task.title} done={task.done} accent={accent} p={p} />
            </FlexWidget>
          ))}
        </ScrollBody>
      )}
    </FlexWidget>
  );
}

// ── Overview ("Notifications" widget — mirrors the persistent daily-overview notification) ──
function OverviewWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.overview;
  const accent = ink(hex(s.accent), p);
  return (
    <FlexWidget clickAction="OPEN_APP" style={frame(p)}>
      {/* No peek: the overview's own first line is already the summary one would go in. */}
      <Header title={s.title} peek="" accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: S.xs }}>
          {s.lines.map((line, i) => (
            <TextWidget
              key={`${i}-${line}`}
              text={line}
              maxLines={2}
              truncate="END"
              style={{ fontSize: 13, color: i === 0 ? p.text : p.muted, paddingVertical: 2 }}
            />
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────
function NotesWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.notes;
  const accent = ink(hex(s.accent), p);
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'unfocus:///notes' }} style={frame(p)}>
      <Header
        title={s.title}
        peek=""
        accent={accent}
        p={p}
        right={
          /* Mic button → opens Notes and auto-starts recording (speech runs in-app only).
             A matte key: its own hue as a flat wash, a lit edge, and a plain `text` label —
             nothing is written on a hue any more (constants/theme.ts's glassKey). */
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'unfocus:///notes?capture=voice' }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: S.sm,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
              ...keyStyle(accent, p),
            }}
          >
            <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, marginRight: 6 }} />
            <TextWidget text={s.voiceLabel} style={{ fontSize: 12, fontWeight: '600', color: p.text }} />
          </FlexWidget>
        }
      />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {s.items.map((note, i) => (
            <FlexWidget key={`${i}-${note.id}`} clickAction="TOGGLE_NOTE" clickActionData={{ id: note.id }} style={rowStyle(p)}>
              <CheckRow label={note.header || '—'} done={false} accent={accent} p={p} />
            </FlexWidget>
          ))}
        </ScrollBody>
      )}
    </FlexWidget>
  );
}

// ── Habits ───────────────────────────────────────────────────────────────────
function HabitsWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.habits;
  const accent = ink(hex(s.accent), p);
  return (
    <FlexWidget clickAction="OPEN_APP" style={frame(p)}>
      <Header title={s.title} peek={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {s.items.map((habit, i) => (
            <FlexWidget key={`${i}-${habit.id}`} clickAction="TOGGLE_HABIT" clickActionData={{ id: habit.id }} style={rowStyle(p)}>
              <CheckRow label={habit.title} done={habit.done} accent={accent} p={p} />
            </FlexWidget>
          ))}
        </ScrollBody>
      )}
    </FlexWidget>
  );
}

// ── Health (medicine trays + symptom entries) ────────────────────────────────
/**
 * One medicine tray. The ONLY actionable row on this widget — a tap logs the whole window
 * (TAKE_TRAY), the same unit the notification's "Taken" button works in.
 *
 * Three states, and the middle one is the point: taken (filled check, muted label — settled),
 * still due (empty check, full-strength label — visible without being shouted at), and
 * upcoming (empty check, muted label — not your problem yet). A tray that has passed
 * untaken looks exactly like one that has not yet arrived, apart from where the eye lands;
 * there is no red, no count of how late, no escalation of any kind. That is the tray contract
 * from lib/medicineSchedule.ts carried onto the home screen.
 *
 * The row rule's full shape, since this is the one row that uses all of it:
 * `title → ONE right-hand value → [○ check]`, with the tray's progress as that value.
 */
function TrayRow({ tray, accent, p }: { tray: NonNullable<WidgetSnapshot['health']['trays']>[number]; accent: Hex; p: Palette }) {
  return (
    <FlexWidget clickAction="TAKE_TRAY" clickActionData={{ id: tray.id }} style={rowStyle(p)}>
      <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget
          text={tray.label}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, color: tray.taken || !tray.due ? p.muted : p.text }}
        />
      </FlexWidget>
      <TextWidget text={tray.detail} style={{ fontSize: 12, color: p.muted, marginLeft: S.sm }} />
      <Check done={tray.taken} accent={accent} p={p} />
    </FlexWidget>
  );
}

/** Severity 1–5 as a compact scale of filled dots (accent) over hollow rings (line). */
function SeverityScale({ severity, accent, p }: { severity: number; accent: Hex; p: Palette }) {
  const filled = Math.max(0, Math.min(5, severity));
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginLeft: S.sm }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <FlexWidget
          key={i}
          style={
            i < filled
              ? { width: 7, height: 7, borderRadius: 4, marginLeft: 3, backgroundColor: accent }
              : { width: 7, height: 7, borderRadius: 4, marginLeft: 3, borderWidth: 1, borderColor: p.line }
          }
        />
      ))}
    </FlexWidget>
  );
}

function HealthWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.health;
  const accent = ink(hex(s.accent), p);
  // `?? []` because a snapshot row persisted by a build older than the 2026-08-15 medicine
  // fold-in has no `trays` key at all, and the handler renders that row verbatim.
  const trays = s.trays ?? [];
  return (
    <FlexWidget clickAction="OPEN_APP" style={frame(p)}>
      <Header title={s.title} peek={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {/* Trays first: they are the actionable half, and they are a fixed short list (at
              most four), so they can't push the entries off the top of a scrolling body. */}
          {trays.map((tray) => (
            <TrayRow key={`tray-${tray.id}`} tray={tray} accent={accent} p={p} />
          ))}
          {s.items.map((entry, i) => (
            // Read-only: no per-row clickAction (empty taps fall through to the card's
            // OPEN_APP), and so no check — the row rule's trailing slot is for a control, and
            // there is none. The ongoing/settled mark is a LEADING one, which is the slot the
            // rule keeps for exactly this: a state the row carries rather than a thing to press.
            <FlexWidget key={`${i}-${entry.id}`} style={rowStyle(p)}>
              <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                {entry.ongoing ? <Dot color={accent} /> : <Ring color={p.line} />}
                <TextWidget text={entry.label} maxLines={1} truncate="END" style={{ fontSize: 13, color: p.text }} />
              </FlexWidget>
              <SeverityScale severity={entry.severity} accent={accent} p={p} />
            </FlexWidget>
          ))}
        </ScrollBody>
      )}
    </FlexWidget>
  );
}

function viewForName(name: string, snap: WidgetSnapshot, p: Palette) {
  switch (name) {
    case 'Shopping':
      return <ShoppingWidget snap={snap} p={p} />;
    case 'Tasks':
      return <TasksWidget snap={snap} p={p} />;
    case 'Notes':
      return <NotesWidget snap={snap} p={p} />;
    case 'Habits':
      return <HabitsWidget snap={snap} p={p} />;
    case 'Health':
      return <HealthWidget snap={snap} p={p} />;
    case 'Overview':
    default:
      // Retired widget — retained for installs still running the pre-Habits/Health native build.
      return <OverviewWidget snap={snap} p={p} />;
  }
}

/**
 * Resolve a widget name to a light/dark-aware WidgetRepresentation. Both the headless
 * task handler and the in-app requestWidgetUpdate path go through here, so all four
 * widgets stay visually identical no matter which context rendered them.
 */
export function renderWidgetByName(name: string, snap: WidgetSnapshot) {
  return {
    light: viewForName(name, snap, LIGHT),
    dark: viewForName(name, snap, DARK),
  };
}
