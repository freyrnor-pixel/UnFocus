/**
 * siteNav.ts — shared site list + navigation helper for the bottom menu.
 *
 * Single source of truth for "all the app's sites" (the screens reachable from
 * BottomNav). The 5 nav sites are siblings inside app/(tabs)/_layout.tsx's
 * material-top-tabs pager, so moving between them is a tab switch (no stack growth);
 * goToSite() still exists as the one call site every cross-site link goes through,
 * but it now just dispatches router.navigate() for those 5 and router.push() for
 * everything else (settings, meals, notes, budget, automations, shared).
 *
 * Connections:
 *   Imports → lib/i18n (Translations, for the nav label keys)
 *   Used by → components/BottomNav, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx,
 *             app/(tabs)/scan.tsx, and any other screen that links to another site
 *   Data    → none (pure navigation logic)
 *
 * Edit notes:
 *   - SITE_ITEMS order is the bottom menu's visual order (left to right) AND must match
 *     app/(tabs)/_layout.tsx's <MaterialTopTabs.Screen> order.
 *   - Nav bar has 5 items: Shopping, Plans, Home (centre), Health, Scan (Decision 036).
 *   - Removed from nav (routes/screens kept), with their access points (all wired — Decision 036):
 *       notes     → Home "More" link (app/(tabs)/index.tsx)
 *       meals     → "Food" tab in the Shopping screen's tab row (app/(tabs)/shopping.tsx) — Point 9
 *                   (the earlier Home "More → Food" link was dropped in the pager migration)
 *       automations → Settings → Varsler tab "Automatisering" link (app/settings.tsx)
 *       habits    → Health screen's inline "Habits →" section header (app/(tabs)/health.tsx)
 *       budget    → app/(tabs)/shopping.tsx done-flow + app/(tabs)/scan.tsx header link
 *       shared    → app/share-modal.tsx "Done" + app/(tabs)/scan.tsx QR-scan result
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
  | '/plans'
  | '/meals'
  | '/habits'
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
  { key: 'health', icon: 'heart-outline',    activeIcon: 'heart',    route: '/health'   },
  { key: 'scan',   icon: 'camera-outline',   activeIcon: 'camera',   route: '/scan'     },
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
  '/scan': 'scan',
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
