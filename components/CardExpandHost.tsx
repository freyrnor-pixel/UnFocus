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
 *   - The expanded pane is an `overlay`-tier Surface: opaque, no blur. Not a style choice —
 *     constants/colors.ts's 2026-08-18 rule is that a surface with the app's own cards behind it
 *     (which an expanded card, by definition, has) is never translucent.
 *   - Body cross-fades in over the SECOND half of the growth only, so a heavy surface isn't
 *     visibly reflowing while the rect is still animating.
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
import HealthSurface from '@/components/HealthSurface';
import NotesSurface from '@/components/NotesSurface';
import { Duration, Ease } from '@/constants/motion';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { ExpandableCardId, ExpandRect } from '@/lib/expandableCards';
import { useT, Translations } from '@/lib/i18n';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';

type CardBodyEntry = {
  title: (t: Translations) => string;
  Body: React.ComponentType<Record<string, never>>;
  /** Default true. Set false when the body already owns its own scrolling (a virtualised list). */
  scrollable?: boolean;
};

/** Placeholder shown for a body not wired up yet in this pass — never ships as final. */
function ComingSoonBody() {
  const t = useT();
  const theme = useAppTheme();
  return (
    <View style={styles.placeholder}>
      <Text style={{ color: theme.textMuted, fontFamily: Fonts.regular, fontSize: FontSize.md }}>
        {t.expandCardLabel}
      </Text>
    </View>
  );
}

/**
 * One entry per lib/expandableCards.ts id. Each surface component registers itself here as it
 * is built; `lib/__tests__/expandableCards.test.ts` fails the PR if the two lists ever diverge.
 */
const CARD_BODIES: Record<ExpandableCardId, CardBodyEntry> = {
  shopLists: { title: (t) => t.nav.shop, Body: ComingSoonBody },
  shopDishes: { title: (t) => t.nav.meals, Body: ComingSoonBody },
  shopCatalogue: { title: (t) => t.catalogueTabLabel, Body: ComingSoonBody, scrollable: false },
  homeTodo: { title: (t) => t.nav.plans, Body: ComingSoonBody },
  homeHabits: { title: (t) => t.nav.habits, Body: ComingSoonBody },
  homeNotes: { title: (t) => t.notes.title, Body: () => <NotesSurface embedded /> },
  homeShopping: { title: (t) => t.nav.shop, Body: ComingSoonBody },
  homeHealth: { title: (t) => t.home.healthCardTitle, Body: () => <HealthSurface embedded /> },
  todoWhenever: { title: (t) => t.tasksSectionWhenever, Body: () => <TodoSurface section="whenever" /> },
  todoToday: { title: (t) => t.tasksTabToday, Body: () => <TodoSurface section="today" /> },
  todoWeek: { title: (t) => t.todoWeekTitle, Body: () => <TodoSurface section="week" /> },
  todoRecurring: { title: (t) => t.tasksSectionRecurring, Body: () => <TodoSurface section="recurring" /> },
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
  const seq = useRef(0);
  const overlayRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  function dismiss() {
    const mySeq = seq.current;
    if (reducedMotion) {
      progress.value = 0;
      setRequest(null);
      return;
    }
    progress.value = withTiming(0, { duration: Duration.cardOut, easing: Ease.exit }, (done) => {
      if (done && seq.current === mySeq) runOnJS(setRequest)(null);
    });
  }

  useEffect(() => {
    requestListener = (req) => {
      if (!req) {
        dismiss();
        return;
      }
      seq.current += 1;
      overlayRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
      setRequest(req);
      progress.value = reducedMotion ? 1 : withTiming(1, { duration: Duration.card, easing: Ease.enter });
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

  const rectStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.value, [0, 1], [startRect.x - origin.x, 0]),
    top: interpolate(progress.value, [0, 1], [startRect.y - origin.y, 0]),
    width: interpolate(progress.value, [0, 1], [startRect.width, screenW]),
    height: interpolate(progress.value, [0, 1], [startRect.height, screenH]),
    borderRadius: interpolate(progress.value, [0, 1], [Radius.md, 0]),
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
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
        <Animated.View style={[styles.pane, rectStyle]}>
          <Surface surfaceContext="overlay" style={styles.surface}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {entry.title(t)}
              </Text>
              <CardExpandButton expanded onExpand={() => {}} onCollapse={collapseCard} />
            </View>
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
  bodyOuter: { flex: 1 },
  bodyFlex: { flex: 1, paddingHorizontal: Spacing.md },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  placeholder: { padding: Spacing.lg, alignItems: 'center' },
});
