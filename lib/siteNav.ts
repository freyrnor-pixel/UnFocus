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
 *   - **Nav bar has 3 items: Handle, I dag (centre), Gjøremål (2026-08-20, "full-screen card
 *     expansion" pass).** Health left the bottom nav and became a Home card
 *     (components/HomeHealthCard.tsx) — it no longer needs a tab of its own now that every
 *     card can grow to fill the screen in place, which was the whole point of trading pushed
 *     screens for expansion. To-do (`/plans`) took its slot: the To-do tab dropped its
 *     Today/This week/All tasks slider in favour of four cards (Whenever/Today/Week/
 *     Recurring), each independently expandable, so the deep surface Home's To-do preview
 *     couldn't show now has its own tab again.
 *     History this replaced: Shopping/Plans/Home/Habits/Health (Decision 036) → Shopping/Home/
 *     Health (the 2026-08-20 5→3 merge, To-do and Habits folded onto Home) → this.
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
  { key: 'shop',   icon: 'cart-outline',   activeIcon: 'cart',   route: '/shopping' },
  { key: 'home',   icon: 'today-outline',  activeIcon: 'today',  route: '/'         },
  { key: 'plans',  icon: 'checkbox-outline', activeIcon: 'checkbox', route: '/plans' },
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

/** Navigate to any site. The 3 tab sites switch the pager in place; everything else pushes. */
export function goToSite(router: ImperativeRouter, pathname: string, route: SiteRoute) {
  if (route === pathname) return;
  if (TAB_ROUTE_NAME[route]) {
    router.navigate(route);
    return;
  }
  router.push(route);
}
