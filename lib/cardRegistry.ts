/**
 * cardRegistry.ts — every card in the app, declared once.
 *
 * Maintainer, 2026-08-21: *"1. Things are placed differently. 2. Not all cards can be
 * collapsed. 3. Not all cards can be in full screen. 4. It just feels like a bunch of cards per
 * screen. No order, no logic."* The ruling was to fix the EXECUTION — the three tabs and the
 * card stacks stay — and the execution kept diverging because every guard in `§8` of
 * `DESIGN_RULES.md` is a **source scan over an allowlist**: a new card is compliant by default,
 * so the tests stayed green while the screen stayed wrong (13 distinct header-control orders, 7
 * components drawing a card header, 9 of them hand-rolled, 3 fold mechanisms, ⤢ on 10 of ~30
 * cards).
 *
 * So this file is the generator, not another allowlist. A card's screen, position, hue, badge,
 * title, and whether it folds and expands are DATA here; `components/Card.tsx` is the only
 * thing that reads them and draws a header. A card that is not declared here cannot be drawn.
 *
 * **The two hand-maintained unions are derived from it**: `CardId` (lib/collapsedCards.ts) is
 * the keys with `fold: 'persisted'`, and `ExpandableCardId` (lib/expandableCards.ts) is the
 * keys with `expand: 'surface'`. That is what makes an unregistered card a **tsc error** rather
 * than a test finding, and — because `CardExpandHost`'s `CARD_BODIES` is
 * `Record<ExpandableCardId, …>` and therefore exhaustive — it makes `expand: 'surface'` with no
 * body a tsc error for free.
 *
 * Dependency-free at run time, the same discipline lib/cardLayout.ts, lib/padState.ts,
 * lib/collapsedCards.ts and lib/expandableCards.ts keep: it is evaluated in the render path of
 * every tab, so it must not be able to reach a store, the DB, the notification layer or the
 * sync layer. Hue and domain are stored as KEYS (`ScreenKey`/`Domain`) and resolved at render
 * by `components/Card.tsx`; every import below is type-only.
 *
 * Connections:
 *   Imports → (types only) lib/screenColor, lib/domainColor, lib/i18n, @expo/vector-icons
 *   Used by → components/Card.tsx, lib/collapsedCards.ts, lib/expandableCards.ts,
 *             lib/__tests__/cardRegistry.test.ts
 *   Data    → none directly. `fold: 'persisted'` keys become storage keys in
 *             settings.collapsedCards; see lib/collapsedCards.ts.
 *
 * Edit notes:
 *   - **A key is a STORAGE KEY.** Renaming one re-opens that card for everyone who had folded
 *     it, exactly as lib/collapsedCards.ts always warned. The four To-do keys were renamed
 *     `plans*` → `todo*` in the pass that created this file, because a card had a fold id and a
 *     DIFFERENT expand id (`plansToday`/`todoToday`) and one card cannot have two names here;
 *     that rename came with a `lib/db.ts` migration emptying the column, on the 2026-08-21
 *     precedent.
 *   - **`'none'` needs a written reason.** `foldDeclined`/`expandDeclined` are asserted
 *     non-empty by `lib/__tests__/cardRegistry.test.ts`. The repo banned stub full-screen panes
 *     on 2026-08-21 (`ComingSoonBody` is deleted), so declining is the supported answer and a
 *     placeholder is not — but it has to be a decision somebody wrote down, not a gap.
 *   - **`order` is the screen's deliberate sequence.** On Home it is the DEFAULT only: that tab
 *     keeps its drag-reorder (`settings.homeCardOrder`), so this decides where a card lands for
 *     a user who has never dragged one.
 *   - **`nested` marks a card drawn INSIDE another card** rather than at screen level. Those
 *     take no `order` (they have no position on the screen to hold) and are excluded from the
 *     per-screen ordering assertion. It is not an escape hatch for a SECTION: a section is
 *     drawn one-per-row-of-user-data, has no stable storage key, and is not in this file at all.
 *     ⚠️ **Nothing is nested today (2026-08-22).** The four that were — Habits' list and goals,
 *     Health's week and issues — were nested because Habits and Health were CARDS on the Me tab.
 *     Both are tabs again, so those four are ordinary top-level cards on them. The field stays
 *     because the shape is still legal and still meaningful; it is simply unused.
 *   - **Flag-dead surfaces are deliberately absent** — `HomeSharedCard`, `EnergyBalanceCard` and
 *     `SharedTasksSection` are behind `SHARING_VISIBLE` and do not render at all today. They are
 *     left untouched rather than converted or deleted; when sharing returns, they get entries.
 */

import type { Ionicons } from '@expo/vector-icons';
import type { Domain } from '@/lib/domainColor';
import type { Translations } from '@/lib/i18n';
import type { ScreenKey } from '@/lib/screenColor';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/**
 * Which tab's stack a card belongs to.
 *
 * ⚠️ **Five since 2026-08-22**, when the bottom nav went back to five tabs. `'me'` is `'home'`
 * again — the tab is the daily hub rather than a personal shelf — and `'habits'`/`'health'` are
 * screens of their own instead of two cards on it. See lib/siteNav.ts for the reversal.
 */
export type CardScreen = 'shop' | 'todo' | 'home' | 'habits' | 'health';

export type CardSpec = {
  screen: CardScreen;
  /** Position within the screen. Absent for a `nested` card. A default on Home — see the notes. */
  order?: number;
  /** The CardKey of the card this one is drawn inside, if any. */
  nested?: string;
  /**
   * A group sub-header this card sits under. The screen draws the rail once, before the first
   * card that names it; every card after it on that screen belongs to it.
   *
   * There is exactly one today — To-do's "Elsewhere" — and the two screens with none are that
   * way on instruction: the maintainer declined an "Inventory" grouping on Shop and a "Health"
   * grouping over the Health and Medicine cards. Recorded here so nobody adds one back.
   */
  group?: 'elsewhere';
  /** Screen hue the card's rail wears — resolved through lib/screenColor.ts at render. */
  hue: ScreenKey;
  /** Badge identity — resolved through lib/domainColor.ts at render. */
  domain: Domain;
  /** Override the badge GLYPH while `domain` still drives its colour. */
  icon?: IoniconsName;
  /** Paint the badge in `hue` rather than the domain's own (aliased) colour. */
  badgeHue?: true;
  title: (t: Translations) => string;
  fold: 'persisted' | 'none';
  foldDeclined?: string;
  expand: 'surface' | 'none';
  expandDeclined?: string;
  /** Drawn open when the user has chosen nothing. Replaces lib/cardDefaults.ts. */
  openAtRest?: true;
};

/**
 * Every card, by screen and in each screen's order.
 *
 * ⚠️ To-do's four keys were `plansToday`/`plansWhenever`/`plansWeek`/`plansRecurring` for the
 * fold and `todoToday`/`todoWhenever`/`todoWeek`/`todoRecurring` for the expansion — two names
 * for one card, which is precisely the divergence this file exists to make impossible. The
 * `todo*` spelling won (it matches the tab) and the stored column was emptied.
 */
export const CARDS = {
  // ── To-do ──────────────────────────────────────────────────────────────────────────────
  // Time horizon: today, then the week around it, then the undated backlog, then what repeats.
  todoToday: {
    screen: 'todo',
    order: 1,
    hue: 'plans',
    domain: 'task',
    icon: 'today',
    title: (t) => t.tasksTabToday,
    fold: 'persisted',
    expand: 'surface',
    // ⚠️ **No `openAtRest` since 2026-08-22.** It had one because this was the only "Today" the
    // app had while Home was the Me tab; Home has its own Today card again (`homeToday`), which
    // is the one the maintainer's exception names. Two Todays resting open, one tab apart, is
    // the duplication the exception was never about.
  },
  todoWeek: {
    screen: 'todo',
    order: 2,
    hue: 'plans',
    domain: 'task',
    icon: 'calendar',
    title: (t) => t.todoWeekTitle,
    fold: 'persisted',
    expand: 'surface',
  },
  todoWhenever: {
    screen: 'todo',
    order: 3,
    hue: 'plans',
    domain: 'task',
    title: (t) => t.tasksSectionWhenever,
    fold: 'persisted',
    expand: 'surface',
  },
  todoRecurring: {
    screen: 'todo',
    order: 4,
    // Borrows the health hue so three To-do cards in a column aren't one colour — see
    // constants/colors.ts's card-identity addendum. The glyph is what names it.
    hue: 'health',
    domain: 'health',
    icon: 'repeat',
    title: (t) => t.tasksSectionRecurring,
    fold: 'persisted',
    expand: 'surface',
  },

  // The three cards that are not the day's work — what you're aiming at, what's behind you, and
  // what quietly stopped mattering. They were `CollapsedSection` drawers, a fourth card shape
  // with its own fold and no ⤢; they are ordinary cards now, under the one group rail on this
  // tab.
  todoGoals: {
    screen: 'todo',
    order: 5,
    group: 'elsewhere',
    hue: 'plans',
    domain: 'task',
    icon: 'flag',
    title: (t) => t.goals.editLinkPractical,
    fold: 'persisted',
    expand: 'surface',
  },
  todoEarlierDays: {
    screen: 'todo',
    order: 6,
    group: 'elsewhere',
    hue: 'plans',
    domain: 'task',
    icon: 'time-outline',
    title: (t) => t.dayLog.earlierDays,
    fold: 'persisted',
    expand: 'surface',
  },
  todoWashedAway: {
    screen: 'todo',
    order: 7,
    group: 'elsewhere',
    hue: 'plans',
    domain: 'task',
    icon: 'water-outline',
    title: (t) => t.tasksSectionWashedAway,
    fold: 'persisted',
    expand: 'surface',
  },

  // ── Shop ───────────────────────────────────────────────────────────────────────────────
  // The maintainer's order, verbatim, and deliberately with NO group headers over it — he
  // declined an "Inventory" grouping, so nobody should add one back.
  shopLists: {
    screen: 'shop',
    order: 1,
    hue: 'shopping',
    domain: 'shop',
    badgeHue: true,
    title: (t) => t.weeklyTabLabel,
    fold: 'persisted',
    expand: 'none',
    // Declined, not deferred (2026-08-21): the lists ARE this tab's primary content, so a
    // full-screen copy of them is a second rendering of the screen you are already on.
    expandDeclined:
      "Shopping's lists are the Shop tab's primary content — a full-screen copy of them is a second rendering of the screen you are already looking at, and each list card already expands its rows in place.",
    // ⚠️ **No `openAtRest` since 2026-08-22.** The maintainer's exception is *"'Today' 'Notes'
    // and 'Shopping' in middle screen"* — the middle screen is Home, and all three of those
    // cards live there now. This is the Shop tab's own lists card, which the exception never
    // named; it was carrying the flag only because Home had no Shopping card to carry it.
  },
  shopDishes: {
    screen: 'shop',
    order: 2,
    // Food's own orange, not Shopping's green: lib/domainColor.ts aliases shop/meal/budget/scan
    // onto one emerald, so `domain="meal"` and `domain="shop"` drew the identical badge.
    hue: 'food',
    domain: 'meal',
    icon: 'fast-food',
    badgeHue: true,
    title: (t) => t.foodTabLabel,
    fold: 'persisted',
    expand: 'surface',
  },
  shopCatalogue: {
    screen: 'shop',
    order: 3,
    hue: 'shopping',
    domain: 'shop',
    icon: 'list',
    title: (t) => t.catalogueTabLabel,
    fold: 'persisted',
    expand: 'surface',
  },
  shopMonthly: {
    screen: 'shop',
    order: 4,
    hue: 'shopping',
    domain: 'plan',
    icon: 'calendar',
    badgeHue: true,
    title: (t) => t.monthlyTabLabel,
    fold: 'persisted',
    expand: 'none',
    expandDeclined:
      "Monthly is the stock list the weekly lists are built FROM, drawn one card per list; the group has no single body to grow, and the per-list cards are sections (drawn one per row of data), which never grow to fill the screen on their own.",
  },

  // ── Home (the CENTRE tab) ──────────────────────────────────────────────────────────────
  // Maintainer, 2026-08-22: *"'Home' had easy access to todays tasks, Notes, and shopping."*
  // Exactly those three, in that order, and nothing else. Habits and Health were cards here
  // until this pass and are tabs again — a card AND a tab for one surface is the duplication
  // worth avoiding, which is the surviving half of the argument that took them OFF the bar.
  // Order is this tab's DEFAULT; drag-reorder still owns the stored one (settings.homeCardOrder).
  homeToday: {
    screen: 'home',
    order: 1,
    hue: 'plans',
    domain: 'task',
    icon: 'today',
    title: (t) => t.tasksTabToday,
    fold: 'persisted',
    expand: 'surface',
    // One of the maintainer's three named exceptions to "all cards start closed"
    // (*"except 'Today' 'Notes' and 'Shopping' in middle screen"*). All three are on this tab
    // for the first time, so that sentence is now literally true rather than approximately.
    openAtRest: true,
  },
  homeNotes: {
    screen: 'home',
    order: 2,
    hue: 'notes',
    domain: 'note',
    title: (t) => t.notes.title,
    fold: 'persisted',
    expand: 'surface',
    openAtRest: true,
  },
  homeShopping: {
    screen: 'home',
    order: 3,
    hue: 'shopping',
    domain: 'shop',
    badgeHue: true,
    title: (t) => t.shoppingTitle,
    fold: 'persisted',
    expand: 'none',
    // ⚠️ The ONE card on this tab that does not grow to fill the screen, and it is the same
    // refusal `shopLists` makes one tab over, for the same measured reason: the Shop tab's
    // weekly/monthly list content is ~2000 lines of window-coordinate drag/merge state and
    // flight-animation refs inside app/(tabs)/shopping.tsx, with no standalone surface
    // component the way To-do, Health, Habits and Notes have. There is nothing to mount in a
    // pane that would not be a second implementation of that screen. The full-screen version
    // of this card is the Shop tab, two swipes away; a `ShoppingListsSurface.tsx` extraction
    // is what would change this answer.
    expandDeclined:
      "Shopping's list content has no standalone surface component — it is ~2000 lines of drag/merge and flight-animation state inside app/(tabs)/shopping.tsx — so a pane for it would be a second implementation of the Shop tab rather than the same code at a different size. Extracting ShoppingListsSurface.tsx is what would change this.",
    openAtRest: true,
  },

  homeRetired: {
    screen: 'home',
    order: 4,
    hue: 'home',
    domain: 'task',
    icon: 'archive-outline',
    badgeHue: true,
    title: (t) => t.home.retired.title,
    fold: 'persisted',
    expand: 'none',
    expandDeclined:
      'The shelf a hidden card falls to. Its body is a short list of names, one tap from coming back — a full-screen copy of it is the same three names, larger.',
  },

  // ── Habits ─────────────────────────────────────────────────────────────────────────────
  // Top-level cards on their own tab again since 2026-08-22. They were `nested` under the Me
  // tab's Habits card and rode its ⤢; with that card gone there is no host to ride, and a card
  // on a tab of its own is simply a card. Neither expands: this tab IS the full-screen version
  // of both, so a pane would be the screen you are already looking at.
  habitsList: {
    screen: 'habits',
    order: 1,
    hue: 'habits',
    domain: 'habit',
    title: (t) => t.nav.habits,
    fold: 'persisted',
    expand: 'none',
    expandDeclined:
      "Today's habits are the Habits tab's primary content, so a full-screen copy of them is a second rendering of the screen you are already on — the same refusal shopLists makes on Shop.",
  },
  habitsGoals: {
    screen: 'habits',
    order: 2,
    hue: 'habits',
    domain: 'habit',
    icon: 'flag',
    title: (t) => t.goals.editLinkPersonal,
    fold: 'persisted',
    expand: 'none',
    expandDeclined:
      'A short list of what the habits above are aiming at, with its own add and delete rows inside the card. Full screen it is the same handful of lines with more air around them; the fold is the control that matters here.',
  },

  // ── Health ─────────────────────────────────────────────────────────────────────────────
  // Also top-level and also on their own tab again. Medicine joins them: it was its own card on
  // the Me tab from 2026-08-21, and a tray of pills is health. It is a PEER card here, never a
  // card drawn inside Health's Surface — that was the card-in-a-card CONSISTENCY_AUDIT.md §11
  // measured, and moving screens is not a reason to rebuild it.
  healthWeek: {
    screen: 'health',
    order: 1,
    hue: 'health',
    domain: 'health',
    title: (t) => t.thisWeekLabel,
    fold: 'persisted',
    expand: 'none',
    expandDeclined:
      "This week's issues are the Health tab's primary content — a pane for them is a second rendering of the screen you are already on.",
  },
  healthIssues: {
    screen: 'health',
    order: 2,
    hue: 'health',
    domain: 'health',
    icon: 'medical-outline',
    title: (t) => t.healthIssues.title,
    fold: 'persisted',
    expand: 'none',
    expandDeclined:
      "A standing list of what is being kept an eye on. Its fuller surface is the Health issues sheet — where a symptom is added or untracked — reached from this card's own header control, so a pane would be a third way to see the same names.",
  },
  healthMedicine: {
    screen: 'health',
    order: 3,
    hue: 'health',
    domain: 'health',
    // `medkit`, not the domain default heart — Health's cards all fell back to DOMAIN_ICON.health
    // and read as the same badge repeated.
    icon: 'medkit',
    title: (t) => t.medicine.title,
    fold: 'persisted',
    expand: 'surface',
  },
} as const satisfies Record<string, CardSpec>;

/** Every card in the app, by key. */
export type CardKey = keyof typeof CARDS;

export const CARD_KEYS = Object.keys(CARDS) as CardKey[];

export function cardSpec(key: CardKey): CardSpec {
  return CARDS[key];
}

/** Cards on `screen`, at screen level (not nested), in their declared order. */
export function cardsForScreen(screen: CardScreen): CardKey[] {
  return CARD_KEYS.filter((k) => cardSpec(k).screen === screen && !cardSpec(k).nested).sort(
    (a, b) => (cardSpec(a).order ?? 0) - (cardSpec(b).order ?? 0),
  );
}
