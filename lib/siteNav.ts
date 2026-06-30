/**
 * siteNav.ts — shared site list + navigation helper for the bottom menu.
 *
 * Single source of truth for "all the app's sites" (the screens reachable from
 * BottomNav), plus goToSite(), which keeps the navigation stack shallow so
 * hardware/gesture "back" always lands on Home instead of whatever site was
 * visited previously. Used by both BottomNav (tab taps) and every cross-site
 * link inside the site screens themselves (header icons, "see all" links,
 * etc.) so the stack-depth invariant holds no matter which UI element
 * triggers the navigation.
 *
 * Connections:
 *   Imports → lib/i18n (Translations, for the nav label keys)
 *   Used by → components/BottomNav, components/SiteSwipeView, app/index, app/shopping,
 *             and any other screen that links to another site
 *   Data    → none (pure navigation logic)
 *
 * Edit notes:
 *   - SITE_ITEMS order is the bottom menu's visual order (left to right).
 *   - Nav bar has 5 items: Shopping, Plans, Home (centre), Health, Scan.
 *   - Removed from nav (routes/screens kept): notes, meals, budget, shared, automations,
 *     settings, habits. Access points: notes via a Home preview card (app/index.tsx),
 *     positioned between the Plans and Shopping preview cards, same "see everything" link
 *     pattern as those two; habits is reached via health's inline summary → /habits;
 *     settings in home screen header (and goToSite(..., '/settings') callers); plans also
 *     keeps its Home "See everything" link alongside its nav tab, same as shopping's preview link.
 *   - goToSite() invariant: Home ('/') is always the stack root. Going from Home to
 *     any site pushes (so back() returns to Home). Going from one non-Home site to
 *     another replaces (so the stack never grows past depth 2). Going to Home
 *     pops back if possible, otherwise replaces. Do not swap push/replace here
 *     without re-checking bug "back goes to another site instead of menu."
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

/** Navigate between sites while keeping the stack shallow (Home stays the root). */
export function goToSite(router: ImperativeRouter, pathname: string, route: SiteRoute) {
  if (route === pathname) return;
  if (route === '/') {
    if (router.canGoBack()) router.back();
    else router.replace('/');
    return;
  }
  if (pathname === '/') router.push(route);
  else router.replace(route);
}
