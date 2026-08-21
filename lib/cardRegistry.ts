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
 *   - **`order` is the screen's deliberate sequence.** On Me it is the DEFAULT only: that tab
 *     keeps its drag-reorder (`settings.homeCardOrder`), so this decides where a card lands for
 *     a user who has never dragged one.
 *   - **`nested` marks a card drawn INSIDE another card** rather than at screen level. Those
 *     take no `order` (they have no position on the screen to hold) and are excluded from the
 *     per-screen ordering assertion. It is not an escape hatch for a SECTION: a section is
 *     drawn one-per-row-of-user-data, has no stable storage key, and is not in this file at all.
 *   - **Flag-dead surfaces are deliberately absent** — `HomeSharedCard`, `EnergyBalanceCard` and
 *     `SharedTasksSection` are behind `SHARING_VISIBLE` and do not render at all today. They are
 *     left untouched rather than converted or deleted; when sharing returns, they get entries.
 */

import type { Ionicons } from '@expo/vector-icons';
import type { Domain } from '@/lib/domainColor';
import type { Translations } from '@/lib/i18n';
import type { ScreenKey } from '@/lib/screenColor';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/** Which tab's stack a card belongs to. */
export type CardScreen = 'me' | 'todo' | 'shop';

export type CardSpec = {
  screen: CardScreen;
  /** Position within the screen. Absent for a `nested` card. A default on Me — see the notes. */
  order?: number;
  /** The CardKey of the card this one is drawn inside, if any. */
  nested?: string;
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
    // The one card on this tab whose content is the reason to open the app at all.
    openAtRest: true,
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
    openAtRest: true,
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
      "Monthly is the stock list the weekly lists are built FROM, drawn one card per list; the group has no single body to grow, and the per-list cards are sections (drawn one per row of data), which never carry a ⤢ of their own.",
  },

  // ── Me ─────────────────────────────────────────────────────────────────────────────────
  // Order is this tab's DEFAULT; drag-reorder still owns the stored one.
  homeHabits: {
    screen: 'me',
    order: 1,
    hue: 'habits',
    domain: 'habit',
    title: (t) => t.nav.habits,
    // A pad card: how many rows it draws lives in lib/padState.ts. Open/closed became this
    // axis in the fold-unification commit; until then padState's 'closed' was the fold.
    fold: 'persisted',
    expand: 'surface',
  },
  homeNotes: {
    screen: 'me',
    order: 2,
    hue: 'notes',
    domain: 'note',
    title: (t) => t.notes.title,
    fold: 'persisted',
    expand: 'surface',
    // One of the maintainer's three named exceptions to "all cards start in closed state"
    // (2026-08-21: *"except 'Today' 'Notes' and 'Shopping' in middle screen"*). It used to be
    // spelled in lib/padState.ts's exception list, because Notes was a pad card and its pad
    // state was its fold; that axis no longer carries open/closed, so the exception lives here
    // with every other card's.
    openAtRest: true,
  },
  homeHealth: {
    screen: 'me',
    order: 3,
    hue: 'health',
    domain: 'health',
    icon: 'pulse',
    title: (t) => t.home.healthCardTitle,
    fold: 'persisted',
    expand: 'surface',
  },
  homeMedicine: {
    screen: 'me',
    order: 4,
    hue: 'health',
    domain: 'health',
    // `medkit`, not the domain default heart — Health's cards all fell back to DOMAIN_ICON.health
    // and read as the same badge repeated.
    icon: 'medkit',
    title: (t) => t.medicine.title,
    fold: 'persisted',
    expand: 'surface',
  },

  // ── Nested ─────────────────────────────────────────────────────────────────────────────
  // Cards drawn inside another card. They hold a persisted fold of their own (they are
  // singletons, so they have a stable key), but they ride their host's ⤢ rather than carrying
  // one — a full-screen button inside a full-screen pane opens the pane you are already in.
  habitsList: {
    screen: 'me',
    nested: 'homeHabits',
    hue: 'habits',
    domain: 'habit',
    title: (t) => t.nav.habits,
    fold: 'persisted',
    expand: 'none',
    expandDeclined: "Drawn inside the Habits card, which is what expands — it rides its host's ⤢.",
  },
  healthWeek: {
    screen: 'me',
    nested: 'homeHealth',
    hue: 'health',
    domain: 'health',
    title: (t) => t.thisWeekLabel,
    fold: 'persisted',
    expand: 'none',
    expandDeclined: "Drawn inside the Health card, which is what expands — it rides its host's ⤢.",
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
