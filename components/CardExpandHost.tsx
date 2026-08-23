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
 *             lib/expandableCards, lib/i18n, lib/useAppTheme, react-native-reanimated
 *   Used by → <CardExpandHost/> mounted in app/_layout.tsx; expandCard()/collapseCard() called
 *             from lib/useCardExpand.ts (which every expandable card uses); useExpandedCardId()
 *             read by lib/useCardExpand.ts to know whether ITS card is the one showing
 *   Data    → none — expansion is not persisted, see lib/expandableCards.ts's edit notes
 *
 * Edit notes:
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
import GoalsEditor from '@/components/GoalsEditor';
import { RecentDaysList } from '@/components/DayPickerSheet';
import { getScreenColor } from '@/lib/screenColor';
import FoodTab from '@/components/FoodTab';
import CatalogueTab, { CatalogueHeaderControls } from '@/components/CatalogueTab';
import { Duration, Ease } from '@/constants/motion';
import { Fonts, FontSize, Radius, Spacing, getLayeredShadow } from '@/constants/theme';
import { ExpandableCardId, ExpandRect } from '@/lib/expandableCards';
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
 * To-do's Goals and Earlier days, which are whole components already — the editor the drawer
 * mounted and the day list the drawer mounted. Each takes its screen's hue, which is To-do's:
 * a card wears its HOST screen's colour, the 2026-08-10 ruling that stopped the same drawer
 * being indigo on one tab and green on another.
 */
function GoalsExpandedBody() {
  const theme = useAppTheme();
  return <GoalsEditor accent={getScreenColor(theme, 'plans').base} />;
}
function EarlierDaysExpandedBody() {
  const theme = useAppTheme();
  return <RecentDaysList accent={getScreenColor(theme, 'plans').base} />;
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
  homeToday: { title: (t) => t.tasksTabToday, Body: () => <TodoSurface section="today" /> },
  // The pane draws its own title bar, so this entry supplies the one header control the card
  // shell has that the pane would otherwise lose: the reminder bell, which IS the reminders
  // switch. Same `header` slot CatalogueExpandedBody uses for the lock and camera.
  healthMedicine: { title: (t) => t.medicine.title, Body: MedicineExpandedBody },
  todoWhenever: { title: (t) => t.tasksSectionWhenever, Body: () => <TodoSurface section="whenever" /> },
  todoToday: { title: (t) => t.tasksTabToday, Body: () => <TodoSurface section="today" /> },
  todoWeek: { title: (t) => t.todoWeekTitle, Body: () => <TodoSurface section="week" /> },
  todoRecurring: { title: (t) => t.tasksSectionRecurring, Body: () => <TodoSurface section="recurring" /> },
  // The three "Elsewhere" cards (2026-08-21). They were `CollapsedSection` drawers — a card
  // shape with a fold and no ⤢ — and two of them already had a standalone body to mount, which
  // is most of why converting them cost so little.
  todoGoals: { title: (t) => t.goals.editLinkPractical, Body: GoalsExpandedBody },
  todoEarlierDays: { title: (t) => t.dayLog.earlierDays, Body: EarlierDaysExpandedBody },
  todoWashedAway: { title: (t) => t.tasksSectionWashedAway, Body: () => <TodoSurface section="washedAway" /> },
};

type ExpandRequest = { id: ExpandableCardId; rect: ExpandRect };

let requestListener: ((req: ExpandRequest | null) => void) | null = null;
let idListeners: Array<(id: ExpandableCardId | null) => void> = [];

/** Grow `id`'s registered body from `rect` (window coordinates, from measureInWindow) to fill the screen. */
export function expandCard(id: ExpandableCardId, rect: ExpandRect) {
  requestListener?.({ id, rect });
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
    return () => {
      requestListener = null;
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
            <Surface surfaceContext="overlay" style={styles.surface}>
              <Animated.View style={[styles.header, { borderBottomColor: theme.border }, headerStyle]}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {entry.title(t)}
                </Text>
                <CardExpandButton expanded onExpand={() => {}} onCollapse={collapseCard} />
              </Animated.View>
              <Animated.View style={[styles.bodyOuter, bodyStyle]}>
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
              </Animated.View>
            </Surface>
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
  bodyOuter: { flex: 1 },
  bodyFlex: { flex: 1, paddingHorizontal: Spacing.md },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
});
