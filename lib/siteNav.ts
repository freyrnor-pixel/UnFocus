/**
 * siteNav.ts — shared site list + navigation helper for the bottom menu.
 *
 * Single source of truth for "all the app's sites" (the screens reachable from
 * BottomNav). The 5 nav sites are siblings inside app/(tabs)/_layout.tsx's
 * material-top-tabs pager, so moving between them is a tab switch (no stack growth);
 * goToSite() still exists as the one call site every cross-site link goes through,
 * but it now just dispatches router.navigate() for those 5 and router.push() for
 * everything else (settings, notes, budget, automations, shared, scan).
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
 *   - ⚠️ **Nav bar has 5 items again: Handle, Gjøremål, Hjem (CENTRE), Vaner, Helse
 *     (2026-08-22).** Maintainer: *"The logic was sound before. 'Home' had easy access to
 *     todays tasks, Notes, and shopping. I think 5 screens might be needed again, so we can
 *     split at least into Shopping, To-do, Home, Habits and Health."* This REVERSES both the
 *     2026-08-20 5→3 merge and the 2026-08-19 "To-do to the middle, Home becomes Meg" pass.
 *
 *     Those two passes rested on one argument — *a preview card for a neighbouring tab is a
 *     second, shorter copy of that tab* — and it is overruled, not forgotten. Home is the daily
 *     hub, and previews of the day's tasks, notes and shopping are the POINT of it: the thing a
 *     hub is for is seeing three surfaces at once without swiping to any of them. Read
 *     lib/homeCards.ts for what Home draws now.
 *
 *     Two consequences worth stating, because each one settles a question that kept reopening:
 *       1. **Home is genuinely the middle tab**, so "the app opens on the centre screen" and
 *          "the app opens on Home" stopped being in tension. `START_TAB_ROUTE_PATH` is `/`
 *          again — but for the OPPOSITE reason it used to be: not because a stored
 *          `settings.startScreen` said so (that setting is still inert and still has no
 *          picker), but because the centre tab happens to be Home. Keep reading the constant.
 *       2. **Habits and Health are tabs, not cards.** Both come off Home entirely; Medicine
 *          moves onto the Health tab. A card AND a tab for the same surface is the duplication
 *          worth avoiding — which is the surviving half of the argument above.
 *     ⚠️ **`'home'` is still the KEY and `/` is still the route.** Only the label, the icon and
 *     the position have ever moved. Renaming the key would touch `settings.startScreen`,
 *     `homeCardOrder`'s owner screen and every `TAB_ROUTE_NAME` consumer for a word.
 *     Full history: Shopping/Plans/Home/Habits/Health (Decision 036) → Shopping/Home/Health
 *     (the 2026-08-20 5→3 merge, To-do and Habits folded onto Home) → Shopping/Home/To-do (the
 *     same-day "full-screen card expansion" pass, which took Health off the bar and gave To-do
 *     its tab back) → Shopping/To-do/Home (2026-08-19) → this, which is Decision 036 again.
 *   - **The tab-level screens all live in `app/(tabs)/`**: `shopping`, `plans`, `index`,
 *     `habits`, `health`. `app/habits.tsx` and `app/health.tsx` moved back in on 2026-08-22;
 *     each is a thin `ScreenScaffold` wrapper at `tier="site"` around the surface component
 *     that holds its real content (components/HabitsSurface.tsx, components/HealthSurface.tsx),
 *     the same shape `app/(tabs)/plans.tsx` has around TodoSurface. Those surfaces exist
 *     BECAUSE of the merge — they were extracted when the tabs were folded away — which is most
 *     of why restoring the tabs cost so little.
 *   - ⚠️ **The 2026-07-23 E1 finding is live again**: Habits once lived INSIDE the Health tab
 *     and had to be split back out, because a tab whose name promised symptom tracking hid a
 *     whole habit system. Now that both are tabs again, don't cite tidiness to fold one into
 *     the other. Medicine on Health is not that: a tray of pills is health, and it is a peer
 *     card there, not a system hidden inside another one.
 *   - The deeper habit surfaces (per-habit config, the Week/Month calendar views) are still
 *     pushed routes of their own, reached from the Habits tab — only the tab-level screen moved.
 *   - **Scan drops off the bottom nav (2026-07-23, audit finding E2)**: "Scan" also did
 *     QR-share-import, not just receipt OCR, and a 5th always-visible tab for an
 *     occasional-use action was the screen-overload candidate the audit flagged. `/scan`
 *     is now a pushed sub-screen (`app/scan.tsx`, not `app/(tabs)/scan.tsx`) reached via a
 *     "Scan" header button on app/(tabs)/shopping.tsx — its own idle screen still offers
 *     both receipt OCR and QR import, so nothing scan-related was actually removed, only
 *     its permanent nav-bar seat. `/scan` stays a valid `SiteRoute` for `router.push` but
 *     is no longer in `TAB_ROUTE_NAME` (goToSite() falls through to a plain push for it now).
 *   - Removed from nav (routes/screens kept), with their access points:
 *       notes     → Home's Notes card (components/HomeNotesCard.tsx), which expands in place
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
 *     of the 5 pager siblings — router.navigate() switches the pager tab in place, no
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
  { key: 'home',   icon: 'home-outline',     activeIcon: 'home',     route: '/'         },
  { key: 'habits', icon: 'leaf-outline',     activeIcon: 'leaf',     route: '/habits'   },
  { key: 'health', icon: 'pulse-outline',    activeIcon: 'pulse',    route: '/health'   },
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
  '/habits': 'habits',
  '/health': 'health',
};

/**
 * ⚠️ **Where the app starts — the CENTRE tab, always (consistency audit, 2026-08-21).**
 *
 * Maintainer: *"Middle screen is to be the Main one where app always starts when opening it
 * fresh."* Both halves of that were untrue before 2026-08-21: the app opened on `index` (then
 * the RIGHT-hand tab, because `settings.startScreen` defaulted to `'home'`), and which tab it
 * opened on was a user setting, which "always" rules out. The setting and its column survive as
 * inert; the picker is gone from Settings and from onboarding's Basics screen.
 *
 * ⚠️ **It resolves to `index` again since the 5-tab restore (2026-08-22), and the coincidence is
 * worth naming so nobody "fixes" it back.** `index` is the CENTRE of five, so the rule and the
 * destination agree for the first time. It is not a reversion to reading `settings.startScreen`
 * — that path is still gone, and re-wiring it would immediately reproduce the old bug, since the
 * column still defaults to `'home'` for a reason unrelated to which tab is in the middle.
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
export const START_TAB_ROUTE_PATH = '/' as const;
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
