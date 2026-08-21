/**
 * siteNav.ts — shared site list + navigation helper for the bottom menu.
 *
 * Single source of truth for "all the app's sites" (the screens reachable from
 * BottomNav). The 3 nav sites are siblings inside app/(tabs)/_layout.tsx's
 * material-top-tabs pager, so moving between them is a tab switch (no stack growth);
 * goToSite() still exists as the one call site every cross-site link goes through,
 * but it now just dispatches router.navigate() for those 3 and router.push() for
 * everything else (plans, habits, settings, meals, notes, budget, automations, shared, scan).
 *
 * Connections:
 *   Imports → lib/i18n (Translations, for the nav label keys)
 *   Used by → components/BottomNav, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx,
 *             app/scan.tsx, and any other screen that links to another site
 *   Data    → none (pure navigation logic)
 *
 * Edit notes:
 *   - SITE_ITEMS order is the bottom menu's visual order (left to right) AND must match
 *     app/(tabs)/_layout.tsx's <TopTabs.Screen> order — and constants/motifs.ts's
 *     STRIP_PANEL_ORDER, which lib/__tests__/motifs.test.ts pins against the navigator.
 *   - **Nav bar has 3 items: Handle, Gjøremål (CENTRE), Meg (2026-08-19).** Maintainer:
 *     *"Make 'To-do' middle screen, and the 'Home' can be the 'Me' for Health and notes. I
 *     think that makes things more tidy."* Two changes in one:
 *       1. **To-do is the centre tab**, where "I dag" used to be. It is the surface the app is
 *          most often opened for, and the one both neighbours are one swipe from.
 *       2. **`/` is "Meg" — the personal tab**, not a daily hub: habits, notes and health
 *          (lib/homeCards.ts). It stopped carrying To-do and Shopping preview cards in the same
 *          pass, because both are now whole tabs one swipe away and a preview of a neighbouring
 *          tab is the duplication this move exists to end. Its icon went `today` → `person` with
 *          the name; `nav.home` reads Me / Meg / Ég.
 *     ⚠️ **`'home'` is still the KEY and `/` is still the route** — only the label, the icon and
 *     the position moved. Renaming the key would touch `settings.startScreen`, `homeCardOrder`'s
 *     owner screen and every `TAB_ROUTE_NAME` consumer for a word.
 *     History this replaced: Shopping/Plans/Home/Habits/Health (Decision 036) → Shopping/Home/
 *     Health (the 2026-08-20 5→3 merge, To-do and Habits folded onto Home) → Shopping/Home/
 *     To-do (the same-day "full-screen card expansion" pass, which took Health off the bar and
 *     gave To-do its tab back) → this.
 *   - **`app/plans.tsx` moved to `app/(tabs)/plans.tsx`; `app/(tabs)/health.tsx` moved to
 *     `app/health.tsx`.** `/health` and `/habits` stay valid SiteRoutes for back-compat (deep
 *     links, and Habits is still a pushed sub-screen — see the Habits bullet below) and fall
 *     through goToSite() to a plain router.push, exactly like /notes, /scan and /settings.
 *     Nothing in the UI pushes to `/health` any more; Home's Health card expands in place
 *     instead (components/HealthSurface.tsx, mounted both `embedded` there and — non-embedded,
 *     for the back-compat route — by app/health.tsx).
 *   - **`/habits` is still a PUSHED sub-screen** (app/habits.tsx, unchanged by this pass) —
 *     Home's Habits card (components/HomeHabitsCard.tsx) is a first-class card again (it had
 *     been demoted to a section inside the To-do card by the 5→3 merge; this pass reverses
 *     that — see lib/homeCards.ts) and now expands in place too, but the deeper habit-setup
 *     surfaces (per-habit config, Week/Month calendar views) still live on the pushed screen.
 *     ⚠️ **The 2026-07-23 E1 finding still binds**: Habits once lived INSIDE the Health tab and
 *     had to be split back out, because a tab whose name promised symptom tracking hid a whole
 *     habit system. Don't cite E1 to move habits back under Health.
 *   - **Scan drops off the bottom nav (2026-07-23, audit finding E2)**: "Scan" also did
 *     QR-share-import, not just receipt OCR, and a 5th always-visible tab for an
 *     occasional-use action was the screen-overload candidate the audit flagged. `/scan`
 *     is now a pushed sub-screen (`app/scan.tsx`, not `app/(tabs)/scan.tsx`) reached via a
 *     "Scan" header button on app/(tabs)/shopping.tsx — its own idle screen still offers
 *     both receipt OCR and QR import, so nothing scan-related was actually removed, only
 *     its permanent nav-bar seat. `/scan` stays a valid `SiteRoute` for `router.push` but
 *     is no longer in `TAB_ROUTE_NAME` (goToSite() falls through to a plain push for it now).
 *   - Removed from nav (routes/screens kept), with their access points (all wired — Decision 036):
 *       health    → Home's Health card (components/HomeHealthCard.tsx), expands in place;
 *                   app/health.tsx stays for deep links/back-compat, nothing pushes to it
 *       habits    → Home's Habits card (components/HomeHabitsCard.tsx), expands in place;
 *                   its "See everything" link still opens the pushed app/habits.tsx for the
 *                   deeper per-habit/calendar surfaces
 *       notes     → Home "More" link (app/(tabs)/index.tsx)
 *       meals     → NO route anymore. "Food" is now an in-place tab inside the Shopping
 *                   screen (components/FoodTab.tsx via app/(tabs)/shopping.tsx); the old
 *                   /meals screen was removed in the Shopping/Food redesign. `nav.meals`
 *                   ("Food") is kept only as the tab label source.
 *       automations → Settings → Varsler tab "Automatisering" link (app/settings.tsx)
 *       budget    → app/(tabs)/shopping.tsx done-flow header link
 *       shared    → app/share-modal.tsx "Done" + app/scan.tsx QR-scan result
 *       scan      → app/(tabs)/shopping.tsx header "Scan" button (see above)
 *       settings  → home screen header gear (and goToSite(..., '/settings') callers)
 *   - **goToSite() invariant (post-pager-migration):** a route in TAB_ROUTE_NAME is one
 *     of the 3 pager siblings — router.navigate() switches the pager tab in place, no
 *     stack entry added. Everything else is a genuinely different screen — router.push()
 *     puts it on top of the (tabs) group; back() pops it and lands wherever the pager was
 *     left. The old push-from-Home/replace-between-sites shallow-stack hack (pre-pager,
 *     when the sites were themselves separate stack routes) no longer applies now that
 *     they aren't stack routes at all.
 */
import type { ImperativeRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Translations } from '@/lib/i18n';

export type IoniconsName = keyof typeof Ionicons.glyphMap;
export type SiteKey = Exclude<keyof Translations['nav'], 'newTask' | 'capture'>;

export type SiteRoute =
  | '/'
  | '/shopping'
  | '/health'
  | '/habits'
  | '/plans'
  | '/notes'
  | '/scan'
  | '/budget'
  | '/shared'
  | '/automations'
  | '/settings';

export type SiteItem = {
  key: SiteKey;
  route: SiteRoute;
  icon: IoniconsName;
  activeIcon: IoniconsName;
};

export const SITE_ITEMS: SiteItem[] = [
  { key: 'shop',   icon: 'cart-outline',     activeIcon: 'cart',     route: '/shopping' },
  { key: 'plans',  icon: 'checkbox-outline', activeIcon: 'checkbox', route: '/plans'    },
  { key: 'home',   icon: 'person-outline',   activeIcon: 'person',   route: '/'         },
];

/**
 * SiteRoute → the Expo Router screen name registered inside app/(tabs)/_layout.tsx.
 * '/' maps to 'index' (the file is app/(tabs)/index.tsx); the rest match their filename.
 * Used by BottomNav (as the pager's tab bar) to match a pager route to a SITE_ITEMS entry,
 * and by goToSite() to tell a tab site apart from every other (pushed) site.
 */
export const TAB_ROUTE_NAME: Partial<Record<SiteRoute, string>> = {
  '/': 'index',
  '/shopping': 'shopping',
  '/plans': 'plans',
};

/**
 * ⚠️ **Where the app starts — the CENTRE tab, always (consistency audit, 2026-08-21).**
 *
 * Maintainer: *"Middle screen is to be the Main one where app always starts when opening it
 * fresh."* Both halves of that were untrue before this: the app opened on `index` (the RIGHT-hand
 * tab, because `settings.startScreen` defaulted to `'home'`), and which tab it opened on was a
 * user setting, which "always" rules out. The setting and its column survive as inert; the
 * picker is gone from Settings and from onboarding's Basics screen.
 *
 * It lives HERE, beside `SITE_ITEMS`, rather than in `app/(tabs)/_layout.tsx`, because two very
 * different callers need the same answer and neither should import a route component to get it:
 * the pager's `initialRouteName` (and its `unstable_settings` deep-link back target, which used
 * to be a SEPARATE hard-coded value and so disagreed) and `components/TourSpotlight.tsx`, which
 * hands the user off to the start screen when the tour ends.
 *
 * The two constants are the same tab in the navigator's two vocabularies — a registered
 * `TopTabs.Screen` NAME and a router PATH. Keep them in step: an `initialRouteName` the
 * navigator does not have is silently ignored and the app opens on the first tab (Shop) with no
 * error anywhere. `lib/__tests__/firstRunOptions.test.ts` pins both against `SITE_ITEMS`.
 */
export const START_TAB_ROUTE_PATH = '/plans' as const;
export const START_TAB_ROUTE = TAB_ROUTE_NAME[START_TAB_ROUTE_PATH]!;

/** Navigate to any site. The 3 tab sites switch the pager in place; everything else pushes. */
export function goToSite(router: ImperativeRouter, pathname: string, route: SiteRoute) {
  if (route === pathname) return;
  if (TAB_ROUTE_NAME[route]) {
    router.navigate(route);
    return;
  }
  router.push(route);
}
