/**
 * siteNav.ts — shared site list + navigation helper for the bottom menu.
 *
 * Single source of truth for "all the app's sites" (the screens reachable from
 * BottomNav). The 5 nav sites are siblings inside app/(tabs)/_layout.tsx's
 * material-top-tabs pager, so moving between them is a tab switch (no stack growth);
 * goToSite() still exists as the one call site every cross-site link goes through,
 * but it now just dispatches router.navigate() for those 5 and router.push() for
 * everything else (settings, meals, notes, budget, automations, shared, scan).
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
 *   - Nav bar has 5 items: Shopping, Plans, Home (centre), Habits, Health (Decision 036,
 *     amended 2026-07-23 — UX audit E1/E2: Scan swapped out for Habits; Habits/Health order
 *     swapped 2026-07-24 so Habits sits left of Health).
 *   - **Habits is back as its own tab (2026-07-23)**: app/(tabs)/habits.tsx is a NEW file
 *     extracted from app/(tabs)/health.tsx's embedded Habits section (itself ported from
 *     the once-GONE /habits screen this comment used to describe as dead). Reason:
 *     Health's tab name/icon promised symptom tracking, but a whole separate Habits
 *     system lived inside it — a name-vs-content mismatch (audit finding E1). Splitting
 *     them back into two tabs makes each match what it says on the tin.
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
  { key: 'shop',   icon: 'cart-outline',     activeIcon: 'cart',     route: '/shopping' },
  { key: 'plans',  icon: 'calendar-outline', activeIcon: 'calendar', route: '/plans'    },
  { key: 'home',   icon: 'home-outline',     activeIcon: 'home',     route: '/'         },
  { key: 'habits', icon: 'repeat-outline',   activeIcon: 'repeat',   route: '/habits'   },
  { key: 'health', icon: 'heart-outline',    activeIcon: 'heart',    route: '/health'   },
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
  '/health': 'health',
  '/habits': 'habits',
};

/** Navigate to any site. The 5 tab sites switch the pager in place; everything else pushes. */
export function goToSite(router: ImperativeRouter, pathname: string, route: SiteRoute) {
  if (route === pathname) return;
  if (TAB_ROUTE_NAME[route]) {
    router.navigate(route);
    return;
  }
  router.push(route);
}
