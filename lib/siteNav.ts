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
 *     app/(tabs)/_layout.tsx's <MaterialTopTabs.Screen> order.
 *   - **Nav bar has 3 items: Handle, I dag (centre), Meg (2026-08-20).** The 3-tab merge:
 *     To-do and Habits stopped being tabs and their daily rows moved onto Home, which IS the
 *     "I dag" tab now — it already previewed both, so it absorbed the merge rather than
 *     competing with it. Health keeps its own tab under the broader name.
 *     History this replaced: 5 items — Shopping, Plans, Home (centre), Habits, Health
 *     (Decision 036, amended 2026-07-23 for the Scan→Habits swap, order tweaked 2026-07-24).
 *   - **`/plans` and `/habits` are PUSHED sub-screens now** (app/plans.tsx, app/habits.tsx —
 *     no longer under app/(tabs)/). Nothing was deleted: they still hold the deep surfaces a
 *     daily list has no room for (This week, All tasks, Recurring, Washed away, per-habit
 *     setup), reached from "I dag". They stay valid SiteRoutes and fall through goToSite() to
 *     a plain router.push, exactly like /notes, /scan and /settings.
 *     ⚠️ **The 2026-07-23 E1 finding still binds**: Habits once lived INSIDE the Health tab and
 *     had to be split back out, because a tab whose name promised symptom tracking hid a whole
 *     habit system. That is not what this is — habits are merging into the surface that is
 *     literally called "today", where a recurring habit and a recurring task are the same
 *     sentence. Don't cite E1 to move habits back under Health.
 *   - **Scan drops off the bottom nav (2026-07-23, audit finding E2)**: "Scan" also did
 *     QR-share-import, not just receipt OCR, and a 5th always-visible tab for an
 *     occasional-use action was the screen-overload candidate the audit flagged. `/scan`
 *     is now a pushed sub-screen (`app/scan.tsx`, not `app/(tabs)/scan.tsx`) reached via a
 *     "Scan" header button on app/(tabs)/shopping.tsx — its own idle screen still offers
 *     both receipt OCR and QR import, so nothing scan-related was actually removed, only
 *     its permanent nav-bar seat. `/scan` stays a valid `SiteRoute` for `router.push` but
 *     is no longer in `TAB_ROUTE_NAME` (goToSite() falls through to a plain push for it now).
 *   - Removed from nav (routes/screens kept), with their access points (all wired — Decision 036):
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
 *     plans also keeps its Home "See everything" link alongside its nav tab, same as
 *     shopping's preview link.
 *   - **goToSite() invariant (post-pager-migration):** a route in TAB_ROUTE_NAME is one
 *     of the 5 pager siblings — router.navigate() switches the pager tab in place, no
 *     stack entry added. Everything else is a genuinely different screen — router.push()
 *     puts it on top of the (tabs) group; back() pops it and lands wherever the pager was
 *     left. The old push-from-Home/replace-between-sites shallow-stack hack (pre-pager,
 *     when the 5 sites were themselves separate stack routes) no longer applies now that
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
  { key: 'shop',   icon: 'cart-outline',   activeIcon: 'cart',   route: '/shopping' },
  { key: 'home',   icon: 'today-outline',  activeIcon: 'today',  route: '/'         },
  { key: 'health', icon: 'heart-outline',  activeIcon: 'heart',  route: '/health'   },
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
  '/health': 'health',
};

/** Navigate to any site. The 3 tab sites switch the pager in place; everything else pushes. */
export function goToSite(router: ImperativeRouter, pathname: string, route: SiteRoute) {
  if (route === pathname) return;
  if (TAB_ROUTE_NAME[route]) {
    router.navigate(route);
    return;
  }
  router.push(route);
}
