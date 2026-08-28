/**
 * CardExpandHost.tsx — the one overlay a card grows into, mirroring components/AppModal.tsx's
 * imperative-API shape and components/TourSpotlight.tsx's window-coordinate discipline.
 *
 * Mounted ONCE in app/_layout.tsx beside <AppModalHost/>, as a sibling of <Stack>. That position
 * is what lets it cover the floating bottom nav for free: `PagerFloatingNav` is a `zIndex: 100`
 * view *inside* the `(tabs)` group, so an `absoluteFill` outside that group paints above it with
 * no z-index arithmetic, the same reasoning AppModalHost already relies on.
 *
 * Connections:
 *   Imports → components/Surface, components/CardExpandButton, constants/theme, constants/motion,
 *             lib/cardPane, lib/expandableCards, lib/i18n, lib/useAppTheme, react-native-reanimated
 *   Used by → <CardExpandHost/> mounted in app/_layout.tsx; expandCard()/collapseCard() called
 *             from lib/useCardExpand.ts (which every expandable card uses); useExpandedCardId()
 *             read by lib/useCardExpand.ts to know whether ITS card is the one showing
 *   Data    → none — expansion is not persisted, see lib/expandableCards.ts's edit notes
 *
 * Edit notes:
 *   - ⚠️ **`todoGoals`/`todoEarlierDays`/`todoWashedAway` left `CARD_BODIES` on 2026-08-26**
 *     (phase 5 of DESIGN_COMPARISON/19-IMPLEMENTATION.md) — they are SECTIONS inside
 *     `todoToday`/`todoWhenever` now, not their own expandable cards, so they arrive for free
 *     with those two entries' bodies. `todoMonth` joined in the same pass (a new registry card,
 *     a date filter between Week and Whenever — see lib/cardRegistry.ts).
 *   - ⚠️ **The card this pane is showing draws as the pane's BODY, not as a card (2026-08-28,
 *     lib/cardPane.ts).** Every one of these bodies is a surface whose job is to render one
 *     `<Card>`, so without the context this file paints its title bar and then lets that card
 *     paint a second Surface, a second header with the same word on it, a fold chevron and an ⤢
 *     inside it. `entry.card` names the card where it is not this pane's own id — only
 *     `homeToday`, whose body is To-do's Today card by design.
 *   - **`CARD_BODIES` is the only per-card knowledge this file holds**, and the union in
 *     lib/expandableCards.ts is the only list to keep in step with it —
 *     lib/__tests__/expandableCards.test.ts asserts every id has an entry and vice versa.
 *     `scrollable: false` is the escape hatch for a body that already owns its own scrolling —
 *     `CatalogueTab` mounts a virtualising FlatList and must not be wrapped in a second
 *     ScrollView (app/catalogue.tsx passes the equivalent `scrollable={false}` today).
 *   - **Measure the card rect and the overlay's own origin the SAME way, and subtract** — the
 *     exact bug that shipped in the guided tour (components/TourSpotlight.tsx, fixed
 *     2026-08-14): on Android, Fabric folds `includeViewportOffset` into `measureInWindow`
 *     (`−statusBarHeight` under Expo's edge-to-edge window), while this overlay's own
 *     `absoluteFill` sits in root coordinates. Using `measureInWindow` for BOTH and subtracting
 *     cancels whatever a platform folds in, with no status-bar constant hardcoded anywhere —
 *     don't "simplify" this to `measure()`; that trade was already made and reversed once.
 *   - **The overlay's frame View is ALWAYS mounted**, never behind `if (!request) return null`,
 *     for the same reason TourSpotlight's is: `overlayRef` has to be attached and measurable
 *     BEFORE the first expandCard() call, or that first origin measurement reads a ref that
 *     was never mounted. `pointerEvents` alone toggles whether it can eat a touch.
 *   - **`seq` + the exact `runOnJS(setRequest)(null)` shape inside `withTiming`'s completion
 *     callback is copied from AppModalHost's `dismiss()` verbatim** — a plain JS function called
 *     from an animation completion callback (auto-workletized, no `'worklet'` directive in the
 *     source) crashes the app on device while rendering perfectly on web, where worklets run on
 *     the JS thread. `__tests__/workletSafety.test.ts` source-scans for exactly this.
 *   - **⚠️ `seq` is a SHARED VALUE, and it must never go back to being a `useRef` (2026-08-19,
 *     from a user report: expand → collapse → expand → collapse left a dead pane on screen).**
 *     The exit animation's completion callback is workletized, so it reads `seq` on the UI
 *     thread — and react-native-worklets serializes a captured plain object ONCE and caches the
 *     clone (`serializableMappingCache`, keyed by the object). A `useRef` is a plain object, so
 *     from the SECOND `dismiss()` onward the UI-thread copy still held `current: 1` while JS had
 *     already incremented to 2: `seq.current === mySeq` was false, `setRequest(null)` never ran,
 *     and the pane stayed mounted at `progress` 0 — drawn at the card's original rect, its body
 *     at opacity 0, eating every touch aimed at the card underneath. **Every local harness this
 *     repo has says the old code is fine**: in `__DEV__` the library FREEZES the captured object,
 *     so `seq.current += 1` is a silent no-op, both sides stay at 1 and the guard passes; and the
 *     web preview runs worklets on the JS thread, where there is no clone at all. Only a release
 *     build diverges. The library's own comment on that freeze names the fix — *"If the user
 *     really wants some objects to be mutable they should use shared values instead."*
 *     `lib/__tests__/expandableCards.test.ts` pins it. The same defect was fixed in
 *     components/AppModal.tsx in the same pass; it is a repo-wide rule, not a local patch.
 *   - The expanded pane is an `overlay`-tier Surface: opaque, no blur. Not a style choice —
 *     constants/colors.ts's 2026-08-18 rule is that a surface with the app's own cards behind it
 *     (which an expanded card, by definition, has) is never translucent.
 *   - **The growth is a container transform, and the pane's OWN cross-fade is the load-bearing
 *     part of it (2026-08-19, maintainer: *"Make full screen animation look like the card
 *     expands into full screen"*).** The rect arithmetic was already right — the pane starts at
 *     the measured card rect and travels to the viewport — but the pane is an opaque `overlay`
 *     Surface, so at full strength on frame 1 it REPLACED the card with a blank box before a
 *     single pixel had moved: the card's rows blinked out, an empty rectangle travelled, and
 *     different content faded in at the far end. That is a panel opening over a card, not a card
 *     becoming a screen. Four things fix it, and they are staged rather than simultaneous:
 *     the pane fades up over the first `PANE_FADE_IN` of the travel (so the first frames are
 *     still the REAL card underneath, dissolving into what it is turning into — and, reversed,
 *     dissolving back out of it on collapse); the title follows; the body follows that; and a
 *     scrim takes the rest of the screen down so the middle frames read as one card lifting off
 *     the stack. Don't restore any of these to a constant opacity to "simplify" the styles —
 *     each one is a frame of the illusion, and the pane's is the whole illusion.
 *   - **The travel is a LAYOUT animation (left/top/width/height), never `transform: scale`.**
 *     A scaled pane stretches its title and its body's type on the way out and squashes them on
 *     the way back, which reads as a picture of a card being zoomed. Scale is cheaper; it is
 *     also the thing that would make this look like every other zoom transition instead of like
 *     the card growing.
 *   - **Timing is `Duration.cardExpand`/`cardExpandOut` (320/260), NOT `card`/`cardOut`
 *     (220/200).** This travels the whole viewport, which ANIMATION_GUIDELINES.md §1 files under
 *     "hero transitions: modals, screen navigation, full panels" at 300-400ms; at 220 the growth
 *     is over before the eye can follow the edges and reads as a cut to a new screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Surface from '@/components/Surface';
import CardExpandButton from '@/components/CardExpandButton';
import TodoSurface from '@/components/TodoSurface';
import MedicineSurface from '@/components/MedicineSurface';
import MedicineReminderBell from '@/components/MedicineReminderBell';
import NotesSurface from '@/components/NotesSurface';
import HabitsSurface from '@/components/HabitsSurface';
import HealthSurface from '@/components/HealthSurface';
import FoodTab from '@/components/FoodTab';
import CatalogueTab, { CatalogueHeaderControls } from '@/components/CatalogueTab';
import { Duration, Ease } from '@/constants/motion';
import { Fonts, FontSize, MIN_TAP_TARGET, Radius, Spacing, getLayeredShadow, rgba } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { DOMAIN_ICON } from '@/components/CardAccent';
import PressableScale from '@/components/PressableScale';
import { CardKey, cardSpec, cardsInGroup } from '@/lib/cardRegistry';
import { PaneCardContext } from '@/lib/cardPane';
import { ScreenColorContext, getScreenColor } from '@/lib/screenColor';
import { ExpandableCardId, ExpandRect, isExpandableCardId } from '@/lib/expandableCards';
import { useT, Translations } from '@/lib/i18n';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';

/**
 * How far into the growth the (opaque) pane has finished fading up over the real card beneath
 * it. Small on purpose: long enough that the first frames are the card itself rather than a
 * blank box, short enough that the pane is solid well before it has grown far enough for the
 * page behind it to show through its own edges.
 */
const PANE_FADE_IN = 0.18;

type CardBodyEntry = {
  title: (t: Translations) => string;
  Body: React.ComponentType<Record<string, never>>;
  /** Default true. Set false when the body already owns its own scrolling (a virtualised list). */
  scrollable?: boolean;
  /**
   * Which `Card` inside `Body` is the one this pane is showing, when it is not the pane's own
   * id — that card draws as the pane's BODY (no second Surface, no second header) rather than
   * as a card. See lib/cardPane.ts for the defect this closes.
   *
   * Only `homeToday` needs it: its body is `TodoSurface section="today"`, which draws
   * `todoToday`, deliberately — Home's card is a preview of that card, so its full-screen
   * version has to be the same surface rather than a second rendering of it.
   * `lib/__tests__/expandableCards.test.ts` pins that this is the only divergence.
   */
  card?: CardKey;
};

/**
 * Full (non-embedded) FoodTab/CatalogueTab, for the `shopDishes`/`shopCatalogue` expansions.
 *
 * `onNotify` is a no-op here rather than a real toast: a ConfirmationBanner has to be a
 * SIBLING of the surface it floats over (see components/TodoSurface.tsx's day-reset-banner
 * note) and this body has no such sibling slot to reach — the underlying add/edit actions still
 * work identically, only the confirmation toast is silently skipped in this one context.
 */
function FoodExpandedBody() {
  return <FoodTab onNotify={() => {}} />;
}
function CatalogueExpandedBody() {
  // The lock is owned here rather than by CatalogueTab (2026-08-20) because its two buttons
  // live in whatever header the list sits under. This pane's header is CardExpandHost's own
  // title row, which takes no per-card controls — so they go through CatalogueTab's `header`
  // slot instead, which renders directly above the search field, i.e. still the top of this
  // surface. If a second expandable card ever wants header controls, THAT is the point to add
  // a `Controls` entry to CARD_BODIES rather than growing a second convention here.
  const [locked, setLocked] = useState(true);
  return (
    <CatalogueTab
      onNotify={() => {}}
      locked={locked}
      header={
        <View style={styles.expandedControls}>
          <CatalogueHeaderControls locked={locked} onToggleLock={() => setLocked((v) => !v)} />
        </View>
      }
    />
  );
}

/**
 * Medicine, with its reminder bell kept in reach. components/HomeMedicineCard.tsx draws the bell
 * in the card's header; expanded, the pane owns the title bar, so it is mounted above the body
 * instead rather than dropped — a control that disappears when a card grows is a control the
 * user has to shrink the card to reach.
 */
function MedicineExpandedBody() {
  return (
    <>
      <View style={styles.expandedControls}>
        <MedicineReminderBell />
      </View>
      <MedicineSurface />
    </>
  );
}

/**
 * One entry per lib/expandableCards.ts id. Each surface component registers itself here as it
 * is built; `lib/__tests__/expandableCards.test.ts` fails the PR if the two lists ever diverge.
 */
const CARD_BODIES: Record<ExpandableCardId, CardBodyEntry> = {
  shopDishes: { title: (t) => t.foodTabLabel, Body: FoodExpandedBody },
  shopCatalogue: { title: (t) => t.catalogueTabLabel, Body: CatalogueExpandedBody, scrollable: false },
  // ⚠️ **There are no placeholder bodies left, and there must not be another** (2026-08-21).
  // `shopLists` was the last one; it left lib/expandableCards.ts rather than getting a body —
  // see the note there for why declined rather than deferred. `ComingSoonBody` is deleted, so
  // the only way to register a stub now is to write a new one, and
  // lib/__tests__/expandableCards.test.ts fails on a body that renders nothing real.
  //
  // ⚠️ **`homeHabits` and `homeHealth` left on 2026-08-22**, when Habits and Health became tabs
  // again: their cards no longer exist, and an id whose card is gone keeps an entry alive that
  // nothing can reach while the test pinning the two lists together goes on passing over it.
  // Their surfaces are unchanged — they are simply mounted by a screen now, not by a pane.
  homeNotes: { title: (t) => t.notes.title, Body: () => <NotesSurface embedded /> },
  // Home's own "Today" card. Same body as `todoToday` one tab over, and deliberately so: the
  // card on Home is a PREVIEW of that card, so its full-screen version has to be the same
  // surface, not a second rendering of it.
  // `card: 'todoToday'` because that is what this body actually draws — see CardBodyEntry's
  // `card` note. Without it the pane would paint "Today" and then let TodoSurface paint a whole
  // second Today card inside it.
  homeToday: { title: (t) => t.tasksTabToday, Body: () => <TodoSurface section="today" />, card: 'todoToday' },
  // The pane draws its own title bar, so this entry supplies the one header control the card
  // shell has that the pane would otherwise lose: the reminder bell, which IS the reminders
  // switch. Same `header` slot CatalogueExpandedBody uses for the lock and camera.
  healthMedicine: { title: (t) => t.medicine.title, Body: MedicineExpandedBody },
  // ⚠️ **These two arrived on 2026-08-27 (round 20 phase 6) by REVERSING a written
  // `expandDeclined`** — see lib/cardRegistry.ts's note on each for why, and note that neither
  // mounts its whole surface: `habitsList`'s tab holds exactly one card, so `HabitsSurface` IS
  // that card's body, while `healthWeek` passes `section="week"` so its pane is This week alone
  // rather than the Health tab over again. Both are members of the `growth` group, which is what
  // the panes exist for — the strip below can only switch to a card that has one.
  habitsList: { title: (t) => t.nav.habits, Body: () => <HabitsSurface /> },
  healthWeek: { title: (t) => t.thisWeekLabel, Body: () => <HealthSurface section="week" /> },
  todoWhenever: { title: (t) => t.tasksSectionWhenever, Body: () => <TodoSurface section="whenever" /> },
  todoToday: { title: (t) => t.tasksTabToday, Body: () => <TodoSurface section="today" /> },
  todoWeek: { title: (t) => t.todoWeekTitle, Body: () => <TodoSurface section="week" /> },
  // NEW (2026-08-26) — see lib/cardRegistry.ts's `todoMonth` note. Same "one rendering, two
  // hosts" contract as its three siblings.
  todoMonth: { title: (t) => t.todoMonthTitle, Body: () => <TodoSurface section="month" /> },
  todoRecurring: { title: (t) => t.tasksSectionRecurring, Body: () => <TodoSurface section="recurring" /> },
  // ⚠️ **`todoGoals`/`todoEarlierDays`/`todoWashedAway` left this registry on 2026-08-26** —
  // they are SECTIONS now, drawn inside `todoToday` (Goals, Earlier days) and `todoWhenever`
  // (Washed away), so they travel for free with those two cards' own `section="today"`/
  // `section="whenever"` bodies above and need no entry of their own. See
  // lib/cardRegistry.ts's note at their old position.
};

/**
 * The `growth` strip: every OTHER card in the open card's group, one tap from replacing it in
 * this pane (2026-08-27, round 20 phase 6 — DESIGN_COMPARISON/19-card-surface-reset.html's
 * `gtabs`). A group spans SCREENS by design, so this is the only way to get from the Habits tab's
 * card to Health's two without collapsing, changing tab and expanding again.
 *
 * Three deliberate departures from the prototype:
 *   - **It scrolls, it does not wrap.** The prototype's `.gtabs` is `flex-wrap`, which is the
 *     "row must fit 360px" defect the handoff names: three Norwegian titles plus glyphs do not
 *     fit one 360px line, and a wrapped control row is also a `npm run wraps` finding by
 *     construction. A horizontal scroller has no width it can fail at.
 *   - **`MIN_TAP_TARGET`, not the prototype's 40px** — DESIGN_RULES.md rule 17 is not negotiable
 *     against a mockup, and `Spacing`/`Radius` tokens replace its raw 7/13/6px.
 *   - **Members with no pane are filtered out, not drawn dead.** The prototype drew a tab for
 *     every member and opened a pane for it regardless of its own `expand:false` — the
 *     contradiction that made this feature look buildable when it was not. Here the filter is the
 *     honest expression of the same rule, and `lib/__tests__/cardRegistry.test.ts` additionally
 *     asserts no group is left with fewer than two reachable members, so a future
 *     `expand: 'none'` on a group member fails the suite instead of silently emptying the strip.
 */
function GroupStrip({ current }: { current: ExpandableCardId }) {
  const theme = useAppTheme();
  const t = useT();
  const scroller = useRef<ScrollView>(null);
  // Where the ACTIVE tab starts, from its own onLayout. Measured rather than computed: the tabs
  // are text-width, so their x depends on the language (Norwegian's "Denne uken" against
  // English's "This week") and on the user's text-size setting, neither of which a constant here
  // could know. See `scrollToActive` for why it is needed at all.
  const activeX = useRef(0);
  const group = cardSpec(current).group;
  // Every member across every screen — never scoped to the current one, which is the whole point
  // of the feature; see cardsInGroup's own doc.
  const members = (group ? cardsInGroup(group) : []).filter(isExpandableCardId);
  if (!group || members.length < 2) return null;

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.groupStrip}
    >
      {members.map((key) => {
        const spec = cardSpec(key);
        const hue = getScreenColor(theme, spec.hue).base;
        const on = key === current;
        const label = spec.title(t);
        return (
          <PressableScale
            key={key}
            // ⚠️ **The active tab must be ON SCREEN when the pane opens, and at 360px it is not.**
            // Measured in the web preview: three Norwegian growth titles overflow a 360px line, so
            // opening Medicine — the last member in declaration order — drew its own tab sliced by
            // the right edge, i.e. the card you are looking at labelled by a half-tab. The strip
            // scrolls, so it was reachable; it was just not where the eye needed it. Scrolling to
            // the active tab fixes it at every width and every group size, where trimming padding
            // to make three specific words fit only fixes it for those three words in one
            // language. `x - Spacing.md` leaves the preceding tab peeking, which is what says the
            // row scrolls.
            onLayout={(e) => {
              if (!on) return;
              activeX.current = e.nativeEvent.layout.x;
              scroller.current?.scrollTo({ x: Math.max(0, activeX.current - Spacing.md), animated: false });
            }}
            onPress={() => switchExpandedCard(key)}
            disabled={on}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={[
              styles.groupTab,
              {
                backgroundColor: on ? rgba(hue, 0.2) : theme.surfaceMuted,
                borderColor: on ? rgba(hue, 0.45) : 'transparent',
              },
            ]}
          >
            <Ionicons
              name={spec.icon ?? DOMAIN_ICON[spec.domain]}
              size={16}
              color={on ? hue : theme.textMuted}
            />
            <Text style={[styles.groupTabLabel, { color: on ? hue : theme.textMuted }]} numberOfLines={1}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

type ExpandRequest = { id: ExpandableCardId; rect: ExpandRect };

let requestListener: ((req: ExpandRequest | null) => void) | null = null;
// Separate from `requestListener` because a switch carries no rect — it reuses the open pane's,
// which only the component holds. See switchExpandedCard.
let switchListener: ((id: ExpandableCardId) => void) | null = null;
let idListeners: Array<(id: ExpandableCardId | null) => void> = [];

/** Grow `id`'s registered body from `rect` (window coordinates, from measureInWindow) to fill the screen. */
export function expandCard(id: ExpandableCardId, rect: ExpandRect) {
  requestListener?.({ id, rect });
  idListeners.forEach((l) => l(id));
}

/**
 * Swap the pane to another card in the SAME group, keeping the pane exactly where it is
 * (2026-08-27, round 20 phase 6 — the group strip). Deliberately not `expandCard`: that one
 * takes a rect and restarts the growth, so re-using it here would shrink the open pane back to
 * the new card's rect and grow it again — and on a card that is on ANOTHER SCREEN, that rect is
 * whatever the unmounted tab last measured, i.e. stale or zero. Switching keeps `request.rect`
 * and only changes the id, so `progress` is left alone at 1 and nothing animates.
 */
export function switchExpandedCard(id: ExpandableCardId) {
  switchListener?.(id);
  idListeners.forEach((l) => l(id));
}

/** Shrink the currently-expanded card back to its card. A no-op if nothing is expanded. */
export function collapseCard() {
  requestListener?.(null);
  idListeners.forEach((l) => l(null));
}

/** Which card (if any) is currently expanded — read by lib/useCardExpand.ts. */
export function useExpandedCardId(): ExpandableCardId | null {
  const [id, setId] = useState<ExpandableCardId | null>(null);
  useEffect(() => {
    idListeners.push(setId);
    return () => {
      idListeners = idListeners.filter((l) => l !== setId);
    };
  }, []);
  return id;
}

export default function CardExpandHost() {
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [request, setRequest] = useState<ExpandRequest | null>(null);
  const progress = useSharedValue(0);
  // A SHARED value, not a `useRef` — see the "`seq` is a shared value" edit note. The exit
  // animation's completion callback reads it on the UI thread, and a plain ref read there is
  // frozen at the value it had the first time that callback was serialized.
  const seq = useSharedValue(0);
  const overlayRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  function dismiss() {
    const mySeq = seq.value;
    if (reducedMotion) {
      progress.value = 0;
      setRequest(null);
      return;
    }
    progress.value = withTiming(0, { duration: Duration.cardExpandOut, easing: Ease.exit }, (done) => {
      if (done && seq.value === mySeq) runOnJS(setRequest)(null);
    });
  }

  useEffect(() => {
    requestListener = (req) => {
      if (!req) {
        dismiss();
        return;
      }
      seq.value += 1;
      overlayRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
      setRequest(req);
      progress.value = reducedMotion
        ? 1
        : withTiming(1, { duration: Duration.cardExpand, easing: Ease.enter });
    };
    // A switch keeps the open pane's rect and its finished `progress`, changing only which body
    // is mounted — see switchExpandedCard. Guarded on `prev` so a switch with nothing open is a
    // no-op rather than a pane with no geometry.
    switchListener = (id) => setRequest((prev) => (prev ? { ...prev, id } : prev));
    return () => {
      requestListener = null;
      switchListener = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  useEffect(() => {
    if (!request) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      collapseCard();
      return true;
    });
    return () => sub.remove();
  }, [request]);

  const startRect: ExpandRect = request?.rect ?? { x: 0, y: 0, width: screenW, height: screenH };

  // The pane travels by LAYOUT (left/top/width/height), never by `transform: scale` — a scaled
  // pane would stretch its title and its body's type on the way out and squash them on the way
  // back, which reads as a picture of a card being zoomed rather than as a card growing.
  const rectStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.value, [0, 1], [startRect.x - origin.x, 0]),
    top: interpolate(progress.value, [0, 1], [startRect.y - origin.y, 0]),
    width: interpolate(progress.value, [0, 1], [startRect.width, screenW]),
    height: interpolate(progress.value, [0, 1], [startRect.height, screenH]),
    borderRadius: interpolate(progress.value, [0, 1], [Radius.md, 0]),
    // The cross-fade that makes this a card GROWING rather than a pane appearing over one.
    // The pane is opaque, so at full strength on frame 1 it replaces the card's own content
    // with a blank surface before a single pixel has moved — the card's rows blink out, an
    // empty box travels, new content fades in. Coming up over the first sliver of the growth
    // instead means what you see at the moment of the tap is still the real card underneath,
    // dissolving into the pane it is turning into (and, on the way back, out of it).
    opacity: interpolate(progress.value, [0, PANE_FADE_IN], [0, 1], Extrapolation.CLAMP),
  }));

  // The chrome and the content arrive in the order they would if the card were really growing:
  // the container first, then its title, then what it holds. A heavy body is also not visibly
  // reflowing while the rect is still moving.
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [PANE_FADE_IN, 0.55], [0, 1], Extrapolation.CLAMP),
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.45, 0.9], [0, 1], Extrapolation.CLAMP),
  }));

  // The rest of the screen recedes as the card lifts off it, so the middle frames read as one
  // card rising out of a stack rather than as a rectangle inflating over a still page. Fully
  // hidden behind the pane by the time the growth finishes, so it only ever does work in flight.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.7], [0, 1], Extrapolation.CLAMP),
  }));

  const entry = request ? CARD_BODIES[request.id] : null;
  const scrollable = entry?.scrollable !== false;
  // ⚠️ **The pane provides its card's own hue (2026-08-28).** It is mounted in app/_layout.tsx,
  // OUTSIDE every `ScreenScaffold`, so until now `useScreenColor()` was null for everything
  // inside it and every hue-reading control fell back to `theme.accent` — a blue focus ring, a
  // blue key halo and a blue row rail on a full-screen Health or Habits card, which is exactly
  // the *"never blue on a pink or cyan screen"* complaint round 20's glow pass was about. The
  // card's own registry hue is the right answer here for the same reason
  // components/CenterModalScreen.tsx provides one: an expanded card is the surface you are
  // standing on, not a context-free overlay.
  const paneHue = request ? getScreenColor(theme, cardSpec(request.id).hue).base : null;

  return (
    <View
      ref={overlayRef}
      style={[StyleSheet.absoluteFill, styles.root]}
      pointerEvents={request ? 'box-none' : 'none'}
      collapsable={false}
    >
      {request && entry && (
        <>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, scrimStyle]}
            pointerEvents="none"
          />
          {/* The lift, and it has to hang HERE rather than on the Surface: `styles.pane` is
              `overflow: 'hidden'` (that clip is what gives the animated borderRadius something
              to cut), so a shadow cast by any descendant — including the Surface's own
              `elevated` one — is clipped away to nothing. A view's own boxShadow is outside its
              border box and unaffected by its overflow, so the pane can carry it. `floating`
              rather than the resting `raised` tier, because a card that is travelling should
              read as being off the stack; it costs nothing once the growth finishes, when the
              shadow is cast past every edge of the viewport. */}
          <Animated.View
            style={[styles.pane, { boxShadow: getLayeredShadow(theme.shadow, 'floating') }, rectStyle]}
          >
            <ScreenColorContext.Provider value={paneHue}>
            <Surface surfaceContext="overlay" style={styles.surface}>
              <Animated.View style={[styles.header, { borderBottomColor: theme.border }, headerStyle]}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {entry.title(t)}
                </Text>
                <CardExpandButton expanded onExpand={() => {}} onCollapse={collapseCard} />
              </Animated.View>
              <Animated.View style={[styles.bodyOuter, bodyStyle]}>
                <GroupStrip current={request.id} />
                {/* ⚠️ **The card this pane is showing draws as the pane's BODY, not as a card**
                    (2026-08-28, lib/cardPane.ts). Every one of these bodies is a surface whose
                    job is to render one `<Card>`, so without this the pane painted its title and
                    then let that card paint a second Surface, a second header with the same word
                    on it, a fold chevron and an ⤢ — 76px of duplicated chrome and two controls
                    that cannot act on a pane. `entry.card` names it where it is not the pane's
                    own id (only `homeToday`). */}
                <PaneCardContext.Provider value={entry.card ?? request.id}>
                  {scrollable ? (
                    <ScrollView
                      contentContainerStyle={styles.scrollContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      <entry.Body />
                    </ScrollView>
                  ) : (
                    <View style={styles.bodyFlex}>
                      <entry.Body />
                    </View>
                  )}
                </PaneCardContext.Provider>
              </Animated.View>
            </Surface>
            </ScreenColorContext.Provider>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  pane: { position: 'absolute', overflow: 'hidden' },
  surface: { flex: 1, borderRadius: 0, padding: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  title: { flex: 1, fontFamily: Fonts.bold, fontSize: FontSize.lg, marginRight: Spacing.sm },
  // The catalogue's camera + lock inside the expanded pane. Right-aligned and boxless — the
  // rule this pass established is that these two sit in the surface's top part, not in an edge
  // of their own.
  expandedControls: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  // The strip sits between the pane's title bar and its body — the prototype's placement, and
  // the only one that works: above the title it would compete with the card's own name, and
  // below the body it would be off the bottom of a long list.
  groupStrip: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  groupTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  groupTabLabel: { fontFamily: Fonts.bold, fontSize: FontSize.sm },
  bodyOuter: { flex: 1 },
  bodyFlex: { flex: 1, paddingHorizontal: Spacing.md },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
});
