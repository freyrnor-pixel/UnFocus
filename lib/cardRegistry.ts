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
 * **Two more things are DATA here as of 2026-08-26** (phases 7 and 8 of
 * DESIGN_COMPARISON/19-IMPLEMENTATION.md): a card's quick-add OPTIONS table (`compose` —
 * Effort/Goal/Repeat/On/…, the tier-2 shape AGENTS.md's three-tier composer contract describes)
 * and its cross-screen GROUP (`group` — currently only `'growth'`, pairing the Habits tab's card
 * with two of Health's). Neither draws anything: `compose` is the table the real composer in
 * each card's own surface component (`TodoSurface`/`HabitsSurface`/`MedicineSurface`/…) is built
 * against, and `group` is what `cardsInGroup()` reads — searching every screen, never just the
 * caller's own, which is the whole point (see that function's doc for the bug a screen-scoped
 * lookup would reopen).
 *
 * Connections:
 *   Imports → (types only) lib/screenColor, lib/domainColor, lib/i18n, @expo/vector-icons
 *   Used by → components/Card.tsx, lib/collapsedCards.ts, lib/expandableCards.ts,
 *             lib/__tests__/cardRegistry.test.ts; `compose` is read by each card's own surface
 *             component (documented per-card, e.g. components/TodoSurface.tsx's `InlineTaskAdd`)
 *             and `cardsInGroup()` by nothing yet — see that function's doc for what a caller
 *             drawing the actual group strip still needs to build
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

/**
 * A cross-screen family, drawn as one strip wherever any one member expands (phase 8 of
 * DESIGN_COMPARISON/19-IMPLEMENTATION.md). **Only one exists today: `'growth'`**, pairing the
 * Habits tab's one card with two of Health's — the habit-forming/consistency surfaces, spanning
 * two screens on purpose (see `GROUPS` below and `cardsInGroup()`).
 */
export type CardGroup = 'growth';

/**
 * A card's per-card quick-add options — the "options" tier of the three-tier composer contract
 * (AGENTS.md "The hierarchy of settings when making a row"), made DATA (phase 7 of
 * DESIGN_COMPARISON/19-IMPLEMENTATION.md). This does not draw anything by itself — it is the
 * table the real composer (in the card's own surface component: TodoSurface, HabitsSurface,
 * MedicineSurface, …) is built against, so the shipped options and this list can be diffed
 * against each other rather than drifting apart silently.
 */
export type ComposeOption =
  | 'time'
  | 'day'
  | 'date'
  // ⚠️ Was `'effort'` until 2026-08-27 (round 20). Nothing in the app has ever built an "effort"
  // cell — the word is the round 19 prototype's, and what actually ships on these cards is the
  // ENERGY stepper (`t.energyGiveTakeLabel`, gated on `energySystemEnabled`). The table named a
  // control that did not exist for as long as it was inert; naming the real one is what lets it
  // be checked. See `lib/__tests__/cardRegistry.test.ts`'s "every declared option is built".
  | 'energy'
  | 'goal'
  | 'repeat'
  | 'on'
  | 'qty'
  | 'category'
  | 'price'
  | 'howOften'
  | 'target'
  | 'remind'
  | 'dose'
  | 'trays';

export type ComposeSpec = {
  /** The tier-2 "options" shape (AGENTS.md's three-tier contract) — `'panel'` for the labelled
   *  `QuickAddOptionsPanel` cell design every card here uses EXCEPT `shopCatalogue`, whose
   *  options live in `components/CatalogueAddSheet.tsx`'s own pop-up instead (that screen's
   *  composer was already a sheet rather than an inline `AddRow`/`PadTypeRow`, before phase 7 —
   *  see that file's header). Nothing here uses the older inline `extras` chip row; a caller may
   *  still have pre-existing `extras` for OTHER, non-table settings, which this data does not
   *  describe. */
  depth: 'panel';
  opts: ComposeOption[];
};

export type CardSpec = {
  screen: CardScreen;
  /** Position within the screen. Absent for a `nested` card. A default on Home — see the notes. */
  order?: number;
  /** The CardKey of the card this one is drawn inside, if any. */
  nested?: string;
  /**
   * A cross-screen family this card belongs to (phase 8) — see `CardGroup`'s doc. Deliberately
   * NOT the same field the 2026-08-21→2026-08-26 To-do "Elsewhere" group rail used (that one
   * grouped cards within ONE screen and is gone with the cards it grouped — see the note at
   * `todoToday`'s old neighbours below); this is a different, wider idea: a strip spanning
   * SCREENS, assembled by `cardsInGroup()` searching every screen, not the current one.
   * **Home's cards carry no group** — they are previews of other tabs, and a preview and its
   * source sharing a group is exactly the "Today · This week · Today" duplicate-title bug the
   * prototype found; see `cardRegistry.test.ts`'s "no group holds two cards with the same
   * title" test.
   */
  group?: CardGroup;
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
  /** This card's quick-add options table (phase 7) — see `ComposeSpec`. Absent for a card whose
   *  composer offers no options beyond the bare line (tier 1 only) or has no composer at all
   *  (e.g. `healthIssues`, whose "add" is its own sheet, not a quick-add row). */
  compose?: ComposeSpec;
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
    // ⚠️ **`openAtRest` again as of 2026-08-26** (phase 5 of
    // DESIGN_COMPARISON/19-IMPLEMENTATION.md, decision (b): "the first card on each screen
    // rests open"). It lost this 2026-08-22 on the reasoning that Home already has its own
    // Today (`homeToday`) resting open, and two Todays open one tab apart was the duplication
    // that exception was never about — that reasoning is about Home's THREE NAMED cards
    // specifically, not about whether a tab's own first card gets a bare header on first open.
    // This is a separate, narrower exception: every OTHER screen's own first card rests open
    // too (`shopLists`, `habitsList`, `healthWeek`), which Home's rule never covered.
    openAtRest: true,
    // Phase 7's table for this card. Wired into components/TodoSurface.tsx's `InlineTaskAdd`
    // (`compose="today"`) — Time is a TimeBoxInput cell, Effort a signed Stepper gated on
    // `energySystemEnabled`, Goal `components/GoalQuickCell.tsx` gated on `featureGoals`.
    compose: { depth: 'panel', opts: ['time', 'energy', 'goal'] },
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
    // Wired into InlineTaskAdd via `compose="week"` + `dateChoices` — Day is a picker over the
    // week's own seven dates (defaulting to the weekday section the row was added on).
    compose: { depth: 'panel', opts: ['day', 'time', 'goal'] },
  },
  // NEW (2026-08-26). A DATE FILTER, not monthly recurrence — AGENTS.md excludes monthly
  // recurrence from normalizeRecurringTasks because there's no per-occurrence completion row;
  // this asks the same question todoWeek already does, one rung out ("what's dated later this
  // month"), and is wired to nothing in lib/taskRecurrence.ts beyond the same taskOccursOn every
  // other dated card already reads.
  todoMonth: {
    screen: 'todo',
    order: 3,
    hue: 'plans',
    domain: 'task',
    icon: 'calendar-outline',
    title: (t) => t.todoMonthTitle,
    fold: 'persisted',
    expand: 'surface',
    // Wired via `compose="month"` + `dateChoices` — Date picks among this card's own dates
    // (the month's days not already claimed by This week), labelled by day number.
    compose: { depth: 'panel', opts: ['date', 'goal'] },
  },
  todoWhenever: {
    screen: 'todo',
    order: 4,
    hue: 'plans',
    domain: 'task',
    title: (t) => t.tasksSectionWhenever,
    fold: 'persisted',
    expand: 'surface',
    // ⚠️ **The shipped panel is a SUPERSET of this table** (Effort + Goal, per the table below,
    // PLUS the pre-existing Time + Repeat cells — see components/TodoSurface.tsx's
    // `wheneverEnergyValue`/`wheneverGoalId` note for why those two weren't deleted to match
    // the table exactly: Whenever already doubled as the general "add any task" composer, and
    // Repeat here creates a genuinely recurring task, which is shipped, tested behaviour). This
    // field states the table's own two; it is not a claim that Time/Repeat are absent.
    compose: { depth: 'panel', opts: ['time', 'repeat', 'energy', 'goal'] },
  },
  todoRecurring: {
    screen: 'todo',
    order: 5,
    // Borrows the health hue so three To-do cards in a column aren't one colour — see
    // constants/colors.ts's card-identity addendum. The glyph is what names it.
    hue: 'health',
    domain: 'health',
    icon: 'repeat',
    title: (t) => t.tasksSectionRecurring,
    fold: 'persisted',
    expand: 'surface',
    // Repeat opens a showAppModal picker; On (the weekday multi-select) is the DEPENDENT
    // option — it only renders once Repeat says Weekly, the exact shape that once froze the
    // shipped app (see components/TodoSurface.tsx's note by `recurringDays`).
    compose: { depth: 'panel', opts: ['repeat', 'on', 'time'] },
  },

  // ⚠️ **`todoGoals`/`todoEarlierDays`/`todoWashedAway` are GONE from this registry as of
  // 2026-08-26** (phase 5 of DESIGN_COMPARISON/19-IMPLEMENTATION.md) — not deleted, turned into
  // SECTIONS drawn inside `todoToday` (Goals, Earlier days) and `todoWhenever` (Washed away).
  // They were the app's only cards with `group: 'elsewhere'`; per the registry's own boundary —
  // "a card is registry-named, a section is drawn one-per-row-of-user-data and rides its
  // parent's Surface/fold/⤢" — a card that exists only to hold a short, fixed, non-list body
  // one card below its natural home was the boundary being violated in exactly the direction
  // the boundary exists to prevent. Removing a key here is tsc-guided (CardId/ExpandableCardId
  // are derived) and needs no fold migration (sanitizeCollapsedCards drops unknown ids on
  // read) — see components/TodoSurface.tsx for where the content actually lives now.

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
    // ⚠️ **`openAtRest` again as of 2026-08-26** — see `todoToday`'s note: this is the Shop
    // tab's OWN first card resting open (decision (b) of DESIGN_COMPARISON/19-IMPLEMENTATION.md
    // phase 5), a different exception from Home's three named cards, which it lost 2026-08-22
    // on the reasoning that Home's "Shopping" preview already covered "Shopping rests open".
    // That reasoning was about Home's rule, not this tab's own; this tab gets its own first-card
    // exception like every other screen now.
    openAtRest: true,
    // Already shipped, not new: components/InlineAddItem.tsx's flat panel already carries a
    // quantity Stepper and category chips for every weekly/monthly list — see that file's
    // header. This states what was already true rather than adding anything.
    compose: { depth: 'panel', opts: ['qty', 'category'] },
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
    // components/CatalogueAddSheet.tsx (a pop-up, not an inline AddRow panel — see that file's
    // header for why) — Price already shipped; Category is new as of phase 7, a wrapping chip
    // row over lib/shoppingCategories.ts's preset list.
    compose: { depth: 'panel', opts: ['price', 'category'] },
  },
  // ⚠️ **`shopMonthly` is GONE from this registry as of 2026-08-26** (phase 5 of
  // DESIGN_COMPARISON/19-IMPLEMENTATION.md) — turned into a SECTION drawn inside `shopLists`,
  // the same boundary move that took `todoGoals`/`todoEarlierDays`/`todoWashedAway` out of the
  // registry: Monthly was already declared `expand: 'none'` for exactly the section reason
  // ("the per-list cards are sections… which never grow to fill the screen on their own") —
  // the outer `shopMonthly` wrapper around them was the one piece of that card that was still a
  // CARD rather than a section, and it held no user data of its own to justify it. See
  // app/(tabs)/shopping.tsx for where the content lives now (still every bit of it — the
  // per-list `Surface`s, the filter bar, the empty state — just without an outer registry card).

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
  // on a tab of its own is simply a card. This card expanded from 2026-08-27 (round 20 phase 6)
  // — see its own note for why the "the tab IS the full-screen version" refusal was reversed.
  habitsList: {
    screen: 'habits',
    order: 1,
    hue: 'habits',
    domain: 'habit',
    title: (t) => t.nav.habits,
    fold: 'persisted',
    // ⚠️ **This declined a pane until 2026-08-27 (round 20, phase 6), and the reversal is the
    // maintainer's call, not a drift.** The refusal read: *"Today's habits are the Habits tab's
    // primary content, so a full-screen copy of them is a second rendering of the screen you are
    // already on — the same refusal shopLists makes on Shop."* That reasoning is still true in
    // isolation; what changed is that it is no longer in isolation. The `growth` group's strip
    // (components/CardExpandHost.tsx) lets one pane switch to another member's WITHOUT going back
    // to the tab, and a member with no pane cannot be switched to — so of three members only
    // `healthMedicine` had one, and the strip had nothing to be a strip of. The prototype had the
    // same contradiction and hid it (it marked this card `expand:false` and its tab handler opened
    // a pane anyway); making the refusal and the strip agree is the fix, in the direction the
    // maintainer chose. **`shopLists` keeps its identical refusal** — it is in no group, so
    // nothing about this applies to it; don't "make it consistent".
    expand: 'surface',
    // This tab has exactly one card, so "the first card rests open" (2026-08-26, phase 5 of
    // DESIGN_COMPARISON/19-IMPLEMENTATION.md decision (b)) and "always open" coincide here —
    // still worth stating explicitly rather than leaving it implicit, since every other
    // screen's version of this flag is genuinely partial.
    openAtRest: true,
    // Phase 8's "Growth" group (see `GROUPS` below) — the habit-forming/consistency family,
    // spanning this screen and two of Health's.
    group: 'growth',
    // Phase 7's table for this card. Wired into components/HabitsSurface.tsx's quick-add panel:
    // How often is components/HabitRecurrenceCells.tsx (already shipped); Target is a Stepper,
    // suppressed for `weekly-flexible` (whose own weekly-goal Stepper already IS the target —
    // see that component's `habitTargetValue` note); Remind is a toggle cell plus a dependent
    // Time cell, the same shape as Recurring's Repeat/On pair.
    compose: { depth: 'panel', opts: ['howOften', 'target', 'remind'] },
  },
  // ⚠️ **`habitsGoals` is GONE from this registry as of 2026-08-26** — turned into a SECTION
  // drawn inside `habitsList`, the same boundary move as To-do's Goals/Earlier days/Washed
  // away (see the note at `todoGoals`'s old position above). See components/HabitsSurface.tsx
  // for where the content lives now.

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
    // ⚠️ Reversed in the same 2026-08-27 pass, for the same reason — see `habitsList`'s note. The
    // refusal read: *"This week's issues are the Health tab's primary content — a pane for them is
    // a second rendering of the screen you are already on."* Its pane mounts
    // `HealthSurface section="week"`, which is that card's body ALONE — deliberately not the whole
    // surface, or the pane really would be the second rendering the old refusal warned about.
    expand: 'surface',
    // `openAtRest` (2026-08-26, phase 5 decision (b) — "the first card on each screen rests
    // open") — this tab's own first card, same exception as `todoToday`/`shopLists`/`habitsList`.
    openAtRest: true,
    // Phase 8's "Growth" group — see `habitsList`'s note and `GROUPS` below.
    group: 'growth',
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
    // Phase 8's "Growth" group — see `habitsList`'s note and `GROUPS` below. A dose taken on
    // schedule is as much a consistency habit as anything on the Habits tab.
    group: 'growth',
    // Phase 7's table for this card. Wired into components/MedicineSurface.tsx's quick-add
    // panel — both fields already existed on `Medicine` (dose free text, trays a TrayId[]), so
    // this was composer wiring only, no schema change.
    compose: { depth: 'panel', opts: ['dose', 'trays'] },
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

/**
 * Every card in `group`, across EVERY screen — the whole point of phase 8's cross-screen groups
 * (DESIGN_COMPARISON/19-IMPLEMENTATION.md). Unlike `cardsForScreen`, this does NOT take a
 * screen: a lookup scoped to "the current screen" is exactly what would have hidden the
 * duplicate-title bug the prototype found (see `cardRegistry.test.ts`'s test for it), because
 * `time` there held both `todoToday` and `homeToday` and nothing ever looked at both at once.
 * Order within the result is registry declaration order, not screen order — a strip reads the
 * same way regardless of which member's card the user opened it from.
 */
export function cardsInGroup(group: CardGroup): CardKey[] {
  return CARD_KEYS.filter((k) => cardSpec(k).group === group);
}
