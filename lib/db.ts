/**
 * db.ts — SQLite database: connection, schema, migrations, retention pruning.
 *
 * Opens the shared `unfocus.db` handle and exports it as default. initDb()
 * creates every table/index and runs idempotent ALTER-TABLE migrations;
 * pruneOldData() trims dated history older than RETENTION_DAYS (365). All Zustand
 * stores import this db handle to run their queries.
 *
 * Connections:
 *   Imports → lib/date, lib/sqlite
 *   Used by → app/_layout.tsx, lib/backup.ts, lib/liveSync.ts, store/useAutomationStore.ts, store/useCatalogStore.ts, store/useFeedbackStore.ts, store/useHabitStore.ts, store/useHealthStore.ts, store/useInboxStore.ts, store/useMealStore.ts, store/useNotesStore.ts, store/usePeersStore.ts, store/useReceiptStore.ts, store/useSettingsStore.ts, store/useSharedStore.ts, store/useShoppingStore.ts, store/useTaskStore.ts, store/useTaskDraftStore.ts
 *   Data    → owns ALL SQLite tables: settings, tasks, shopping_items, shopping_trips, shopping_lists, dishes, ingredients, health_logs, store_items, purchase_log, shared_tasks, shared_shopping_items, habits, habit_logs, ifttt_rules, feedback_notes, energy_logs (dead — Decision 018 removed the energy check-in feature; table/pruning kept per the never-drop-tables rule, no longer written to), inbox_items, receipts, task_drafts, notes, task_steps, peers (Decision 038d — paired LAN devices + shared HMAC key), widget_snapshot (single-row localised cache for the Android home-screen widgets — lib/widgets/snapshot.ts)
 *
 * Edit notes:
 *   - Add columns via the `migrations` array ONLY — never edit a CREATE TABLE to
 *     change an existing table; migrations run on every launch and swallow
 *     "column already exists" errors.
 *   - pruneOldData() deliberately spares config-like tables (recurring tasks,
 *     dishes, habits, catalog, settings) and user-authored persistent content
 *     (notes); only dated/append-only rows are pruned.
 *   - `tasks.follows_task_id` (Decision 020) has no real FOREIGN KEY constraint —
 *     SQLite can't ALTER TABLE to add one to an existing table. It lives on the
 *     FOLLOWER row and points at its predecessor's id; ON DELETE SET NULL is
 *     enforced in application code instead (`useTaskStore.ts`'s `remove()` clears
 *     any row's `follows_task_id` pointing at the task being deleted, in the same
 *     transaction as the delete). Don't delete a task via a raw query elsewhere
 *     without doing the same cleanup.
 *   - `habits.notification_time` is dead (Decision 016 Q2 — `notification_times`
 *     is the sole live source of truth; kept unread/unwritten per the never-drop-
 *     columns rule, same precedent as `energy_logs`). `habits.reminder_mode`/
 *     `reminder_count`/`reminder_interval_min`/`reminder_start`/`reminder_end`
 *     (Decision 016 Q3) are editing metadata only — never used to recompute
 *     `notification_times`, which stays authoritative for scheduling.
 */
import { dateStr } from '@/lib/date';
import { db } from '@/lib/sqlite';

/** The app keeps at most this many days of historical, time-stamped data. */
export const RETENTION_DAYS = 365;

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      user_name TEXT DEFAULT '',
      weekly_reset_day INTEGER DEFAULT 0,
      monthly_reset_date INTEGER DEFAULT 1,
      shopping_list_mode TEXT DEFAULT 'weekly',
      reminders_enabled INTEGER DEFAULT 0,
      reminder_time TEXT DEFAULT '08:00',
      task_notifications_enabled INTEGER DEFAULT 0,
      setup_complete INTEGER DEFAULT 0,
      holidays_enabled INTEGER DEFAULT 1
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      task_date TEXT NOT NULL,
      task_time TEXT,
      task_type TEXT DEFAULT 'start-at',
      duration_minutes INTEGER,
      done INTEGER DEFAULT 0,
      recurring TEXT DEFAULT 'none',
      recurring_days TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount TEXT DEFAULT '1',
      unit TEXT DEFAULT '',
      list_type TEXT DEFAULT 'weekly',
      checked INTEGER DEFAULT 0,
      store TEXT DEFAULT '',
      price REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dishes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      meal_type TEXT DEFAULT 'dinner',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      dish_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount TEXT DEFAULT '1',
      unit TEXT DEFAULT '',
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS health_logs (
      id TEXT PRIMARY KEY,
      log_date TEXT NOT NULL,
      ailment TEXT NOT NULL,
      severity INTEGER DEFAULT 3,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      store TEXT DEFAULT '',
      price REAL DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_log (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      store TEXT DEFAULT '',
      price REAL DEFAULT 0,
      was_on_list INTEGER DEFAULT 1,
      purchased_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shared_tasks (
      id TEXT PRIMARY KEY,
      source_task_id TEXT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      direction TEXT NOT NULL,
      shared_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shared_shopping_items (
      id TEXT PRIMARY KEY,
      source_item_id TEXT,
      name TEXT NOT NULL,
      amount TEXT DEFAULT '1',
      unit TEXT DEFAULT '',
      done INTEGER DEFAULT 0,
      direction TEXT NOT NULL,
      shared_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      icon TEXT DEFAULT '⭐',
      kind TEXT DEFAULT 'build',
      category TEXT DEFAULT 'other',
      cue TEXT DEFAULT '',
      craving TEXT DEFAULT '',
      response TEXT DEFAULT '',
      reward TEXT DEFAULT '',
      daily_goal INTEGER DEFAULT 1,
      recurrence TEXT DEFAULT 'daily',
      recurrence_days TEXT DEFAULT '[]',
      notification_enabled INTEGER DEFAULT 0,
      notification_time TEXT DEFAULT '08:00',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ifttt_rules (
      id TEXT PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      trigger_params TEXT DEFAULT '{}',
      action_type TEXT NOT NULL,
      action_params TEXT DEFAULT '{}',
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS feedback_notes (
      id TEXT PRIMARY KEY,
      screen TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS energy_logs (
      log_date TEXT PRIMARY KEY,
      level TEXT DEFAULT 'medium'
    );

    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      receipt_date TEXT NOT NULL,
      store TEXT DEFAULT '',
      total REAL DEFAULT 0,
      category TEXT DEFAULT 'other',
      month TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Single-row cache of the fully-localised home-screen-widget snapshot
    -- (lib/widgets/snapshot.ts). Written by the app whenever today's tasks /
    -- shopping change; read by the headless widget task handler so it can render
    -- without re-deriving store logic. CREATE-only, never pruned (config-like).
    CREATE TABLE IF NOT EXISTS widget_snapshot (
      id INTEGER PRIMARY KEY,
      payload TEXT
    );

    -- Indexes for the columns we filter / sort / join on most often.
    CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(task_date);
    CREATE INDEX IF NOT EXISTS idx_shopping_list ON shopping_items(list_type);
    CREATE INDEX IF NOT EXISTS idx_ingredients_dish ON ingredients(dish_id);
    CREATE INDEX IF NOT EXISTS idx_health_date ON health_logs(log_date);
    CREATE INDEX IF NOT EXISTS idx_habit_logs ON habit_logs(habit_id, log_date);
    CREATE INDEX IF NOT EXISTS idx_store_items_name ON store_items(name);
    CREATE INDEX IF NOT EXISTS idx_purchase_log_date ON purchase_log(purchased_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_notes_screen ON feedback_notes(screen);
    CREATE INDEX IF NOT EXISTS idx_receipts_month ON receipts(month);
    -- Append-only tables are read/pruned ordered by created_at — index it.
    CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_items(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_notes_created ON feedback_notes(created_at);
    CREATE INDEX IF NOT EXISTS idx_shared_tasks_created ON shared_tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_shared_shopping_created ON shared_shopping_items(created_at);
  `);

  // Schema migrations — safe to run repeatedly (errors = column already exists)
  const migrations = [
    "ALTER TABLE tasks ADD COLUMN importance TEXT DEFAULT 'regular'",
    "ALTER TABLE settings ADD COLUMN color_theme TEXT DEFAULT 'warm'",
    "ALTER TABLE settings ADD COLUMN work_mode_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN work_hours_start TEXT DEFAULT '09:00'",
    "ALTER TABLE settings ADD COLUMN work_hours_end TEXT DEFAULT '17:00'",
    "ALTER TABLE settings ADD COLUMN enforce_work_hours INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN essentials_mode_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN show_points INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN show_hints INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN language TEXT DEFAULT 'no'",
    "ALTER TABLE shopping_items ADD COLUMN category TEXT DEFAULT 'other'",
    "ALTER TABLE settings ADD COLUMN holidays_enabled INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN dark_mode TEXT DEFAULT 'off'",
    "ALTER TABLE shopping_items ADD COLUMN monthly_allocated INTEGER DEFAULT 0",
    "ALTER TABLE shopping_items ADD COLUMN monthly_source_id TEXT DEFAULT NULL",
    "ALTER TABLE settings ADD COLUMN work_days TEXT DEFAULT '[0,1,2,3,4]'",
    "ALTER TABLE habits ADD COLUMN routine_order INTEGER DEFAULT 0",
    "ALTER TABLE habits ADD COLUMN child_name TEXT DEFAULT ''",
    "ALTER TABLE settings ADD COLUMN child_profiles TEXT DEFAULT '[]'",
    // Proposal 4 — Accessibility
    "ALTER TABLE settings ADD COLUMN reduced_motion INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN font_size TEXT DEFAULT 'default'",
    // Proposal 6 — Companion pet
    "ALTER TABLE settings ADD COLUMN pet_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN pet_name TEXT DEFAULT ''",
    "ALTER TABLE settings ADD COLUMN pet_type TEXT DEFAULT 'cat'",
    "ALTER TABLE settings ADD COLUMN pet_color TEXT DEFAULT '#A78BFA'",
    // Left-handed mode
    "ALTER TABLE settings ADD COLUMN left_handed INTEGER DEFAULT 0",
    // 1.1.0 — custom theme colors
    "ALTER TABLE settings ADD COLUMN custom_primary_color TEXT DEFAULT '#3B82F6'",
    "ALTER TABLE settings ADD COLUMN custom_secondary_color TEXT DEFAULT '#10B981'",
    // 1.1.0 — inventory tracking for shopping items
    "ALTER TABLE shopping_items ADD COLUMN inventory_qty REAL DEFAULT 0",
    // Track whether a catalog item's price came from the seed list or a real purchase
    "ALTER TABLE store_items ADD COLUMN price_source TEXT DEFAULT 'seed'",
    // Bubble menu surface finish
    "ALTER TABLE settings ADD COLUMN bubble_material TEXT DEFAULT 'glass'",
    // Estimated cost per dish, shown in the meals library
    "ALTER TABLE dishes ADD COLUMN estimated_price_nok REAL DEFAULT 0",
    // Groups shopping items pushed from a dish under that dish's name
    "ALTER TABLE shopping_items ADD COLUMN dish_name TEXT DEFAULT NULL",
    // Persistent "today's overview" notification toggle
    "ALTER TABLE settings ADD COLUMN persistent_notif_enabled INTEGER DEFAULT 0",
    // Debug mode — feedback pins + bubble-wheel tuning overlay
    "ALTER TABLE settings ADD COLUMN debug_mode_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN bubble_size REAL DEFAULT 50",
    "ALTER TABLE settings ADD COLUMN bubble_spacing REAL DEFAULT 78",
    "ALTER TABLE settings ADD COLUMN bubble_spring_intensity REAL DEFAULT 50",
    "ALTER TABLE settings ADD COLUMN bubble_anim_speed REAL DEFAULT 50",
    // AP-03 — task priority (separate from importance), energy check-in, habit rest days
    "ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'",
    "ALTER TABLE habit_logs ADD COLUMN rest_day INTEGER DEFAULT 0",
    // AP-05 — notification quiet hours
    "ALTER TABLE settings ADD COLUMN quiet_hours_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN quiet_hours_start TEXT DEFAULT '21:00'",
    "ALTER TABLE settings ADD COLUMN quiet_hours_end TEXT DEFAULT '08:00'",
    // AP-06B — receipts + budget tracking
    "ALTER TABLE purchase_log ADD COLUMN receipt_id TEXT DEFAULT NULL",
    "ALTER TABLE settings ADD COLUMN monthly_budget_nok REAL DEFAULT 0",
    // Shopping list redesign — monthly staged/in-cart/purchased pipeline + temporary items,
    // weekly purchased-by-week history, and automatic payday-boundary reset tracking
    "ALTER TABLE shopping_items ADD COLUMN status TEXT DEFAULT 'list'",
    "ALTER TABLE shopping_items ADD COLUMN is_temporary INTEGER DEFAULT 0",
    "ALTER TABLE shopping_items ADD COLUMN purchased_at TEXT DEFAULT NULL",
    "ALTER TABLE shopping_items ADD COLUMN week_key TEXT DEFAULT NULL",
    "ALTER TABLE settings ADD COLUMN last_monthly_reset TEXT DEFAULT ''",
    // Debug overlay notes — replaced the old tap-to-pin annotations with header + freetext notes
    "ALTER TABLE feedback_notes ADD COLUMN title TEXT DEFAULT ''",
    // Multiple daily reminders per habit — JSON array of HH:MM times (empty = fall back to notification_time)
    "ALTER TABLE habits ADD COLUMN notification_times TEXT DEFAULT '[]'",
    // Hue-only custom theme picker (handoff 1D) — primary/secondary colors above are derived from this
    "ALTER TABLE settings ADD COLUMN custom_hue INTEGER DEFAULT 217",
    // Katalog/Ukeliste redesign — staging tray + shopping trips, replacing the
    // monthly list/staged/in_cart pipeline and weekKey-grouped weekly history.
    "ALTER TABLE shopping_items ADD COLUMN pending_restock INTEGER DEFAULT 0",
    "ALTER TABLE shopping_items ADD COLUMN target_quantity INTEGER DEFAULT 1",
    "ALTER TABLE shopping_items ADD COLUMN shopping_trip_id TEXT DEFAULT NULL",
    // Permission pre-bake — location-based reminders, calendar sync, voice notes, settings toggles
    "ALTER TABLE settings ADD COLUMN location_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN background_location_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN calendar_sync_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN voice_notes_enabled INTEGER DEFAULT 0",
    "ALTER TABLE tasks ADD COLUMN location_lat REAL DEFAULT NULL",
    "ALTER TABLE tasks ADD COLUMN location_lng REAL DEFAULT NULL",
    "ALTER TABLE tasks ADD COLUMN location_radius_m INTEGER DEFAULT NULL",
    "ALTER TABLE tasks ADD COLUMN geofence_id TEXT DEFAULT NULL",
    "ALTER TABLE tasks ADD COLUMN calendar_event_id TEXT DEFAULT NULL",
    "ALTER TABLE tasks ADD COLUMN audio_uri TEXT DEFAULT NULL",
    "ALTER TABLE tasks ADD COLUMN transcript TEXT DEFAULT NULL",
    `CREATE TABLE IF NOT EXISTS shopping_trips (
      id TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL,
      label TEXT NOT NULL,
      month_reset_date INTEGER DEFAULT 1
    )`,
    "CREATE INDEX IF NOT EXISTS idx_shopping_trips_completed ON shopping_trips(completed_at)",
    // Remap the old status pipeline ('list'|'staged'|'in_cart'|'purchased') onto the
    // new one ('catalog'|'staged'|'inWeeklyList'|'purchased') so existing rows aren't
    // orphaned. Weekly rows never used 'staged'/'in_cart', so they only need the
    // 'list' -> 'inWeeklyList' remap (the weekly list IS the working list now).
    "UPDATE shopping_items SET status = 'inWeeklyList' WHERE list_type = 'weekly' AND status = 'list'",
    "UPDATE shopping_items SET status = 'catalog' WHERE list_type = 'monthly' AND status = 'list'",
    "UPDATE shopping_items SET status = 'inWeeklyList' WHERE list_type = 'monthly' AND status = 'in_cart'",
    "UPDATE shopping_items SET status = 'catalog', pending_restock = 1 WHERE list_type = 'monthly' AND status = 'staged'",
    // Cart "collected" checkbox state (distinct from 'checked', which now means
    // "moved to cart") + provenance flag for the monthly reset summary's
    // inventory-vs-ad-hoc split.
    "ALTER TABLE shopping_items ADD COLUMN collected INTEGER DEFAULT 0",
    "ALTER TABLE shopping_items ADD COLUMN from_catalog INTEGER DEFAULT 0",
    // Backfill: the ADD COLUMN above defaults every pre-existing row to 0, which
    // wrongly marks the user's actual standing Katalog rows as "not from catalog" —
    // breaking the red put-back icon (ShoppingRow.tsx) and putBackToInventory routing
    // (app/shopping.tsx's handleRemoveWeeklyItem) for all data older than this migration.
    // Rows currently sitting at status='catalog' ARE the inventory by definition, so
    // backfill those; addToWeeklyFromCatalog/confirmStagingTray flip status in place on
    // the same row (never re-insert), so this also fixes any future weekly/cart view of
    // them. Rows already flipped to inWeeklyList/purchased before this migration ran
    // can't be retroactively attributed and are left at 0 (they cycle out on next reset).
    "UPDATE shopping_items SET from_catalog = 1 WHERE status = 'catalog'",
    // Follow-up backfill: the migration above only caught rows still sitting at
    // status='catalog' at that moment. Any row already moved to inWeeklyList/purchased
    // before that migration ran (i.e. basically every pre-existing weekly-list item, since
    // the from_catalog feature is new) was left at 0 and never got the red put-back icon —
    // this is exactly what users with an existing list see ("the icon is totally lacking").
    // Heuristic fix: a weekly/purchased row whose name matches a still-standing catalog
    // row almost certainly originated from that same catalog item, so attribute it now.
    "UPDATE shopping_items SET from_catalog = 1 WHERE from_catalog = 0 AND status IN ('inWeeklyList', 'purchased') AND name IN (SELECT name FROM shopping_items WHERE status = 'catalog')",
    // Habit notifications toggle — master switch for all habit reminders
    "ALTER TABLE settings ADD COLUMN habit_notifications_enabled INTEGER DEFAULT 1",
    // Particle effects toggle — animated particles on home screen background
    "ALTER TABLE settings ADD COLUMN particles_enabled INTEGER DEFAULT 1",
    // Multiple, named, recurring shopping lists — see store/useShoppingListStore.ts.
    // The Katalog (status='catalog') stays one global standing inventory: list_id is
    // only meaningful for status='inWeeklyList' rows and is NULL for everything else.
    `CREATE TABLE IF NOT EXISTS shopping_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_recurring INTEGER DEFAULT 0,
      recurrence_interval_weeks INTEGER DEFAULT 1,
      is_custom_name INTEGER DEFAULT 0,
      is_template INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    "CREATE INDEX IF NOT EXISTS idx_shopping_lists_dates ON shopping_lists(start_date, end_date)",
    "ALTER TABLE shopping_items ADD COLUMN list_id TEXT DEFAULT NULL",
    "ALTER TABLE shopping_items ADD COLUMN order_index INTEGER DEFAULT 0",
    "CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id)",
    "ALTER TABLE shopping_trips ADD COLUMN list_id TEXT DEFAULT NULL",
    // Padlock-gated Containers — Week list edit lock state (see store/useShoppingListStore.ts)
    "ALTER TABLE shopping_lists ADD COLUMN locked INTEGER DEFAULT 0",
    // Plans: durable "Unsaved" drafts for open/dirty task Containers (see store/useTaskDraftStore.ts)
    `CREATE TABLE IF NOT EXISTS task_drafts (
      task_id TEXT PRIMARY KEY,
      title TEXT,
      date TEXT,
      time TEXT,
      time_enabled INTEGER,
      task_type TEXT,
      duration_minutes INTEGER,
      recurring TEXT,
      recurring_days TEXT,
      importance TEXT,
      priority TEXT,
      dirty_fields TEXT DEFAULT '[]',
      updated_at TEXT
    )`,
    // Notater — free-form notes with a checkmark + shopping/plans quick-action buttons (see store/useNotesStore.ts)
    `CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      header TEXT DEFAULT '',
      body TEXT DEFAULT '',
      checked INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    "CREATE INDEX IF NOT EXISTS idx_notes_checked ON notes(checked, sort_order)",
    // Plans: checkable, reorderable steps owned by a task (one-to-many, FK cascade-delete)
    `CREATE TABLE IF NOT EXISTS task_steps (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`,
    "CREATE INDEX IF NOT EXISTS idx_task_steps_task ON task_steps(task_id)",
    // Manual drag-sort position within a task's Important/General section (app/plans.tsx)
    "ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0",
    // Freeform "next-time hint" note (Decision 019) — display-only, no behavior.
    "ALTER TABLE tasks ADD COLUMN hint TEXT DEFAULT ''",
    // One-to-one "then" follower link (Decision 020) — surfacing-only, no notification.
    // Lives on the FOLLOWER row, pointing at its predecessor's id (see the header's
    // Edit notes for the ON-DELETE-SET-NULL enforcement, since SQLite can't ALTER
    // TABLE to add a real FK here).
    "ALTER TABLE tasks ADD COLUMN follows_task_id TEXT DEFAULT NULL",
    // Habit reminder editing recipe (Decision 016 Q3, storage shape 3B-ii) — metadata
    // only, so a habit reopens in the mode that created it. notification_times stays
    // the sole authoritative source for actual scheduling; these are never read back
    // into it. Only meaningful when notification_enabled is true — null otherwise.
    // The legacy notification_time column above is NOT read/written by the live store
    // (Decision 016 Q2) and is kept only because columns are never dropped.
    "ALTER TABLE habits ADD COLUMN reminder_mode TEXT DEFAULT NULL",
    "ALTER TABLE habits ADD COLUMN reminder_count INTEGER DEFAULT NULL",
    "ALTER TABLE habits ADD COLUMN reminder_interval_min INTEGER DEFAULT NULL",
    "ALTER TABLE habits ADD COLUMN reminder_start TEXT DEFAULT NULL",
    "ALTER TABLE habits ADD COLUMN reminder_end TEXT DEFAULT NULL",
    // Local account (Decision 039) — a device-only, user-held profile. NO server,
    // NO credentials, NO cloud: account_name is a display label and account_created
    // stamps when the user created their local account. Both live in the settings
    // row, so lib/backup.ts already carries them in the local backup file — a backup
    // IS the account's backup. Empty account_created = no local account created yet.
    "ALTER TABLE settings ADD COLUMN account_name TEXT DEFAULT ''",
    "ALTER TABLE settings ADD COLUMN account_created TEXT DEFAULT ''",
    // Paired LAN peers (Decision 038d) — one row per remembered device from the QR
    // key-exchange handshake. `secret` is the shared HMAC key used to verify inbound
    // LAN envelopes (lib/peerAuth.ts); `device_id` is the peer's advertised id from
    // 038a transport. Config-like table — pruneOldData() leaves it untouched.
    `CREATE TABLE IF NOT EXISTS peers (
      device_id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      secret TEXT NOT NULL,
      paired_at TEXT DEFAULT (datetime('now'))
    )`,
    // Live-sync bookkeeping (Decision 038b) — first cut is tasks + shopping_items only.
    // `updated_at` drives last-write-wins on receive; `origin_device_id` is the LWW
    // tiebreak + delegation origin; `deleted_at` is a soft-delete tombstone so a delete
    // isn't undone by a stale peer copy. Backfill updated_at from created_at for rows that
    // predate live sync so their first sync timestamp is meaningful.
    "ALTER TABLE tasks ADD COLUMN updated_at TEXT DEFAULT ''",
    "ALTER TABLE tasks ADD COLUMN origin_device_id TEXT DEFAULT ''",
    "ALTER TABLE tasks ADD COLUMN deleted_at TEXT DEFAULT NULL",
    "UPDATE tasks SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''",
    "ALTER TABLE shopping_items ADD COLUMN updated_at TEXT DEFAULT ''",
    "ALTER TABLE shopping_items ADD COLUMN origin_device_id TEXT DEFAULT ''",
    "ALTER TABLE shopping_items ADD COLUMN deleted_at TEXT DEFAULT NULL",
    "UPDATE shopping_items SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''",
    // Child-mode variant (Decision 038c) — same binary, a locked mode gated by a
    // parent password. Only FLAGS live here: `child_mode` (currently locked) and
    // `child_mode_password_set` (a password exists). The password itself is NEVER
    // stored in SQLite — it lives in expo-secure-store (lib/childLock.ts).
    "ALTER TABLE settings ADD COLUMN child_mode INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN child_mode_password_set INTEGER DEFAULT 0",
    // LAN live-sync app integration (Decision 038, wiring the 038a/038d/038b
    // foundations together): device_id is THIS install's stable identity, used as
    // both the lanTransport advertised id and the liveSync origin_device_id — generated
    // once (useSettingsStore.load() self-heals an empty value) and persisted so peers
    // recognise this device across relaunches. lan_sync_enabled gates whether
    // lib/syncService's transport is running at all.
    "ALTER TABLE settings ADD COLUMN device_id TEXT DEFAULT ''",
    "ALTER TABLE settings ADD COLUMN lan_sync_enabled INTEGER DEFAULT 0",
    // Week-of-monthly-cycle scheduling for weekly lists — comma-joined ints ("1,3");
    // empty string means "every week" (unchanged behaviour). See store/useShoppingListStore.ts.
    "ALTER TABLE shopping_lists ADD COLUMN active_weeks TEXT DEFAULT ''",
    // Auto-backup to a fixed local path (settings UI toggle); school mode toggle placeholder.
    "ALTER TABLE settings ADD COLUMN auto_backup_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN school_mode_enabled INTEGER DEFAULT 0",
    // Tasks → "Oppgaver" redesign: richer recurrence (daily/weekly/monthly) + a
    // Start/Finish time-box, an explicit "has a start date" flag (undated =
    // Whenever-anchored), and a "shared out" flag. `recurring` (already TEXT) now
    // accepts 'none' | 'daily' | 'weekly' | 'monthly'. duration_minutes stays and is
    // derived from task_time → finish_time on save so the Home PlanTaskCard day-view
    // keeps working unchanged. See store/useTaskStore.ts (taskOccursOn) for the
    // recurrence semantics these columns drive.
    "ALTER TABLE tasks ADD COLUMN recurring_week_interval INTEGER DEFAULT 1",
    "ALTER TABLE tasks ADD COLUMN recurring_monthly_mode TEXT DEFAULT 'day'",
    "ALTER TABLE tasks ADD COLUMN recurring_month_day INTEGER DEFAULT 1",
    "ALTER TABLE tasks ADD COLUMN recurring_month_ordinal TEXT DEFAULT 'first'",
    "ALTER TABLE tasks ADD COLUMN recurring_month_weekday INTEGER DEFAULT 0",
    "ALTER TABLE tasks ADD COLUMN finish_time TEXT DEFAULT NULL",
    "ALTER TABLE tasks ADD COLUMN has_start_date INTEGER DEFAULT 0",
    "ALTER TABLE tasks ADD COLUMN shared_out INTEGER DEFAULT 0",
    // Health redesign — a symptom catalog (predefined + custom, mirrors store_items)
    // so every health log links to a stable symptom id for reliable trend review,
    // instead of drifting free-text ailment strings ('headache' vs 'Headache').
    `CREATE TABLE IF NOT EXISTS symptoms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    // Link each health log to its catalog symptom (NULL = legacy/free-text-only row).
    "ALTER TABLE health_logs ADD COLUMN symptom_id TEXT DEFAULT NULL",
    // Shopping/Food redesign — per-ingredient line price (NOK). A dish's total price is
    // the sum of its ingredients' price_nok; also carried onto the shopping_items rows
    // created when a dish is pushed to the week/monthly list. See store/useMealStore.ts.
    "ALTER TABLE ingredients ADD COLUMN price_nok REAL DEFAULT 0",
    // Catalogue tab soft-delete: seedCatalog() re-inserts every seed row on each load
    // (INSERT OR IGNORE, stable ids), so a hard DELETE of a seed item would reappear on
    // next focus. A `deleted` tombstone keeps the row (so it isn't re-seeded) while
    // hiding it from the catalogue. See store/useCatalogStore.ts.
    "ALTER TABLE store_items ADD COLUMN deleted INTEGER DEFAULT 0",
    // Freyr-mode (Additional modes tab) — one-tap seed/unseed of a starter set of
    // shopping/task/habit/note rows. freyr_seed_ids stores the exact ids created by
    // the seed so toggling off removes precisely those rows. See lib/freyrModeSeed.ts.
    "ALTER TABLE settings ADD COLUMN freyr_mode_enabled INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN freyr_seed_ids TEXT DEFAULT ''",
    // Health redesign — a dedicated add/edit form (app/health-form.tsx) replaces the
    // inline "+" log button; a log now tracks when the issue started AND finished,
    // not just a single log_date. end_date = '' means still ongoing.
    "ALTER TABLE health_logs ADD COLUMN start_time TEXT DEFAULT ''",
    "ALTER TABLE health_logs ADD COLUMN end_date TEXT DEFAULT ''",
    "ALTER TABLE health_logs ADD COLUMN end_time TEXT DEFAULT ''",
    // Plans day-view rail orientation toggle — see components/PlanTaskCard.tsx.
    "ALTER TABLE settings ADD COLUMN plan_timeline_horizontal INTEGER DEFAULT 0",
    // Habits: General/Essential importance, mirroring tasks.importance (Decision 018) —
    // gates Focus-mode visibility/notifications the same way for both entities.
    "ALTER TABLE habits ADD COLUMN importance TEXT DEFAULT 'regular'",
    // People / family mode (2026-07-12 redesign): one on/off toggle that surfaces the
    // person selector (Me + each child_profiles entry) in BOTH the task editor and the
    // habit form. tasks.assignee holds the chosen profile name ('' = Me / self).
    "ALTER TABLE settings ADD COLUMN people_mode_enabled INTEGER DEFAULT 0",
    "ALTER TABLE tasks ADD COLUMN assignee TEXT DEFAULT ''",
  ];
  // Track applied migrations with PRAGMA user_version so we don't re-run the whole
  // (ever-growing) list on every launch. IMPORTANT: the migrations array is an
  // append-only log — never reorder or remove entries, since user_version indexes
  // into it. On the first launch after this change user_version is 0, so every
  // migration runs once more (harmless — duplicate-column errors are swallowed),
  // then the version is advanced and later launches skip the applied ones.
  const appliedVersion = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  for (let i = appliedVersion; i < migrations.length; i++) {
    try {
      db.execSync(migrations[i]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Expected once a column exists — anything else means a migration silently
      // failed and new columns/features may be missing.
      if (!msg.includes('duplicate column')) {
        console.error(`Migration failed: ${migrations[i]}`, e);
      }
    }
  }
  // PRAGMA can't be parameterised; migrations.length is a trusted integer.
  db.execSync(`PRAGMA user_version = ${migrations.length}`);
}

/**
 * Keep the local database to roughly the last year of history. Runs once on
 * startup. Recurring tasks, dishes, habits, the item catalog and settings are
 * configuration (not dated history) and are deliberately left untouched —
 * only dated, append-only rows older than the cutoff are removed.
 *
 * The cutoff is a `YYYY-MM-DD` string; it compares correctly against both
 * `YYYY-MM-DD` date columns and `YYYY-MM-DD HH:MM:SS` timestamp columns.
 */
export function pruneOldData() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const c = dateStr(cutoff);
  try {
    db.runSync("DELETE FROM tasks WHERE recurring = 'none' AND task_date < ?", [c]);
    db.runSync('DELETE FROM health_logs WHERE log_date < ?', [c]);
    db.runSync('DELETE FROM habit_logs WHERE log_date < ?', [c]);
    db.runSync('DELETE FROM purchase_log WHERE purchased_at < ?', [c]);
    db.runSync('DELETE FROM shared_tasks WHERE date < ?', [c]);
    db.runSync('DELETE FROM shared_shopping_items WHERE created_at < ?', [c]);
    db.runSync('DELETE FROM receipts WHERE receipt_date < ?', [c]);
    db.runSync('DELETE FROM energy_logs WHERE log_date < ?', [c]);
    db.runSync('DELETE FROM inbox_items WHERE created_at < ?', [c]);
  } catch { /* never block startup on cleanup */ }
}

export default db;
