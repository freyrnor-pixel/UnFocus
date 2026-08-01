# Ongoing symptom episodes — specification

**Status: specification only. No implementation code exists yet. Nothing in this document has
been written to `lib/db.ts`, `store/useHealthStore.ts`, `lib/i18n.ts` or any screen.**

Author: agent session, 2026-07-31, branch `claude/multi-agent-task-dispatch-ye7i54`.
Source of truth for every schema fact below: `AUDIT.md` §0.6 (health data model), read and
trusted rather than re-derived. Line references are to the working tree as of this date.

---

## 0. What this is, and the one framing constraint

A symptom entry that is **still happening**, rather than one logged after the fact.

**It is not a stopwatch.** No live elapsed-time counter, anywhere, at any point. Three reasons,
each of which alone is sufficient:

1. A ticking number aimed at someone mid-migraine is a number that stares at them.
2. The app shows no number, no streak, no level, anywhere (`lib/growth.ts` deliberately shows
   the user *no number at all*). A live counter breaks that flat.
3. Forgotten timers produce garbage data and an alarming "42 hours" reading on a screen whose
   entire job is to not alarm.

So: **an episode is a state, not a stretch of elapsed time.** Duration is computed on read,
rounded into plain language, and shown in exactly one place (History). It is never stored.

Two existing precedents this feature is modelled on, both already in the repo:

- **A medicine tray is a window, not a deadline** (`lib/medicineSchedule.ts`, AGENTS.md) — an
  untaken dose is "still due", never "missed".
- **A goal's strength floors at neutral** (`lib/goalStrength.ts`) — there is no state in which
  it reads as failing.

An open episode is the same shape: it is a fact about right now, not a debt.

---

## 1. Data model

### 1.1 The problem with the handoff's proposal

The handoff proposed `started_at INTEGER` / `ended_at INTEGER`, epoch milliseconds. Three
things in the codebase say no (all from `AUDIT.md` §0.6):

1. **`health_logs` has no epoch-ms column and no epoch-ms convention.** Every user-facing time
   on the table is a **split TEXT pair**: `log_date`/`end_date` are `YYYY-MM-DD`,
   `start_time`/`end_time` are `HH:MM` local wall-clock, and the unset sentinel is `''` — not
   `NULL`. The only machine timestamp is `created_at`, which is SQLite's
   `'YYYY-MM-DD HH:MM:SS'` UTC text, never written or read by app code.
   "Date format is always `YYYY-MM-DD` strings" is a **key invariant** in AGENTS.md, used as a
   map key throughout the stores.
2. **`end_date` and `end_time` already exist** — migrations idx 133/134, `lib/db.ts:577–578`,
   added for `app/health-form.tsx`'s "When finished" field. `ended_at` would be a second,
   parallel representation of the same fact, and the two would drift the first time anything
   wrote one without the other.
3. **An epoch column would not survive `pruneOldData()` unchanged.** That function compares a
   `YYYY-MM-DD` cutoff string against date columns (`lib/db.ts:1072`); an INTEGER column can't
   join that comparison and would need its own predicate.

### 1.2 Decision — reuse the existing columns, add state

**Start** stays `log_date` + `start_time`. **End** stays `end_date` + `end_time`. **No epoch-ms
column is added.** What is added is the thing the table genuinely lacks: an explicit state.

The handoff correctly warns against "`ended_at IS NULL` means ongoing". That anti-pattern is
**already shipped**: `end_date === ''` is today's implicit ongoing sentinel, re-derived in four
places (`app/health-form.tsx:199`, `app/health-form.tsx:237–238`, `lib/widgets/sync.ts:116–120`,
`lib/widgets/headlessSnapshot.ts:239–251`). That strengthens the case for an explicit state
column — but the migration must **reconcile** with the existing sentinel, not pretend it isn't
there. See §1.5.

### 1.3 Final column list

Three new columns on `health_logs`, plus one index.

| Column | Type | Default | Meaning |
|---|---|---|---|
| `episode_state` | `TEXT` | `'point'` | **The single source of truth.** One of `'point'` \| `'ongoing'` \| `'closed'`. Nothing anywhere may re-derive open/closed from `end_date`. |
| `relief_note` | `TEXT` | `''` | Free text answer to "Did anything help?". `''` = not answered (which is the common case, and fine). |
| `relief_medicine_id` | `TEXT` | `NULL` | Optional pointer to `medicines.id`. **TEXT, not INTEGER** — `medicines.id` is `TEXT PRIMARY KEY` populated by `generateId()` (`lib/db.ts:828`), and the existing `health_logs.medicine_id` is already `TEXT DEFAULT NULL` (`lib/db.ts:859`). No `FOREIGN KEY` (SQLite can't `ALTER` one in); a dangling id is an accepted state, same as `medicine_id`. |

Index: `idx_health_episode_state ON health_logs(episode_state)` — the "are any episodes open?"
query runs on every Health-tab mount, on every widget refresh (`lib/widgets/sync.ts`) and in the
headless snapshot (`lib/widgets/headlessSnapshot.ts`). There is currently only one index on this
table (`idx_health_date`, `lib/db.ts:258`).

**Deliberately NOT added:**

- `started_at` / `ended_at` epoch-ms — §1.1.
- A `duration` column — duration is derived; the repo already refuses to store it
  (`app/(tabs)/health.tsx:65–66`: quick-log duration is UI-only, converted to `endTime`/`endDate`
  at save via `addDurationToTime`, `lib/date.ts:167`).
- A `child_name` / person column — §9.
- Anything syncable — `health_logs` is not in `liveSync`'s `SyncTable` (§8).

### 1.4 Migration lines (exact, in the repo's style)

Append **at index 226** (the array currently has 226 entries, indices 0–225; last entry is
`lib/db.ts:1035`), immediately before the closing `];` at `lib/db.ts:1036`. Five entries, so
`PRAGMA user_version` goes 226 → 231.

**Never edit, reorder or remove an already-merged entry.** Corrections are new appended
statements (precedent: `lib/db.ts:818`).

```ts
    // Ongoing symptom episodes (2026-08-01) — an entry that is STILL HAPPENING, as opposed
    // to one logged after the fact. `episode_state` is the SINGLE SOURCE OF TRUTH for that:
    //   'point'   — a moment logged after it was over (every legacy row, and the default
    //               for a new entry, because most logging happens afterwards)
    //   'ongoing' — still happening right now
    //   'closed'  — was ongoing, then ended; end_date/end_time carry when
    // Deliberately NOT derived from `end_date = ''`. That sentinel already means three
    // different things — a quick log with no duration, an entry whose end was never typed,
    // and "still ongoing" — so reading it as "open" would reclassify years of history as
    // open episodes. Duration is never stored: it is computed on read from
    // log_date/start_time + end_date/end_time (see lib/episodes.ts).
    "ALTER TABLE health_logs ADD COLUMN episode_state TEXT DEFAULT 'point'",
    // Every pre-existing row is 'point', regardless of its end_date. SQLite's ADD COLUMN
    // already back-fills existing rows with the constant DEFAULT above, so this is
    // belt-and-braces for any row an out-of-band build left NULL/''. It must NOT be
    // written as "set 'ongoing' where end_date = ''" — that is precisely the silent
    // reclassification this column exists to prevent.
    "UPDATE health_logs SET episode_state = 'point' WHERE episode_state IS NULL OR episode_state = ''",
    // "Did anything help?" — asked once, when an episode is closed, and never required.
    // This is the second half of the Health tab's own promise ("Log what bothers you. And
    // what helps.", t.starters.health.text), which had no storage until now.
    "ALTER TABLE health_logs ADD COLUMN relief_note TEXT DEFAULT ''",
    // TEXT to match medicines.id (TEXT PRIMARY KEY, generateId()) and the existing
    // health_logs.medicine_id — NOT an INTEGER. No FOREIGN KEY; like medicine_id, a
    // deleted medicine leaves a dangling id rather than losing the symptom entry.
    "ALTER TABLE health_logs ADD COLUMN relief_medicine_id TEXT DEFAULT NULL",
    // "Any open episodes?" runs on every Health-tab mount, every widget refresh and in the
    // headless snapshot. health_logs had exactly one index (idx_health_date) before this.
    "CREATE INDEX IF NOT EXISTS idx_health_episode_state ON health_logs(episode_state)",
```

### 1.5 What happens to a legacy row that already has an empty `end_date`

**It becomes `'point'`. Every existing row does, without exception.**

This is the single most important line in the migration. Today `end_date = ''` is by far the
most common state on the table — `app/(tabs)/health.tsx`'s Quick log writes `''` whenever no
duration was typed (`app/(tabs)/health.tsx:193–194`), the StarterExampleRow's "+" writes `''`
unconditionally (`:172–173`), and `app/health-form.tsx` defaults its Ongoing switch to **on**
for a new entry (`:199`, header note at `:38–40`). Backfilling those to `'ongoing'` would
open an episode for every headache the user has logged since the feature shipped, and the
next-visit prompt (§4.3) would greet them with a wall of them.

Consequences, stated so nobody "fixes" them later:

- A row that genuinely *was* ongoing when the user last touched it becomes `'point'` at
  migration. That is a deliberate, accepted, one-time loss of an inference we never actually
  had. The user can re-open nothing — but they lose nothing either, because the row, its
  severity, its start and its notes are all untouched.
- `end_date = ''` keeps its existing meaning ("no end recorded") and keeps being written by
  the quick-log path. It simply stops being consulted about whether something is open.
- After the migration, `episode_state = 'ongoing'` implies `end_date = ''`, but the converse is
  **not** true and must never be assumed.

### 1.6 Store touch points

`store/useHealthStore.ts` is the sole writer of this table. Four edits in that one file
(`AUDIT.md` §0.6 checklist):

1. `HealthLog` type (lines 48–61) — add
   `episodeState: EpisodeState; reliefNote: string; reliefMedicineId: string;`
   with the same `''`-not-null convention as `medicineId`.
2. `rowToHealthLog` (84–97) — `readStr(row, 'episode_state')` normalised through
   `toEpisodeState()` (`lib/episodes.ts`, §10) so an unknown value degrades to `'point'` rather
   than rendering an empty status.
3. `HEALTH_LOG_FIELDS` (107–117) — `episodeState: { col: 'episode_state' }`,
   `reliefNote: { col: 'relief_note' }`,
   `reliefMedicineId: { col: 'relief_medicine_id', to: (v) => v || null }` (mirrors
   `medicineId`).
4. `add()`'s `insertRow` literal (151–162) — the three new columns, with
   `episode_state: entry.episodeState || 'point'`.

Callers that build a full payload and will fail typecheck otherwise:
`app/health-form.tsx:234–244`, `app/(tabs)/health.tsx:169–179` (starter row) and
`:190–200` (quick log).

Two convenience actions belong on the store rather than in screens, because both need to write
several columns atomically:

- `startEpisode(entry)` — thin wrapper over `add()` forcing `episodeState: 'ongoing'`,
  `endDate: ''`, `endTime: ''`.
- `closeEpisode(id, { endDate, endTime, reliefNote, reliefMedicineId })` — one `update()` that
  sets `episodeState: 'closed'` **and** the end pair in the same patch, so no intermediate
  state exists in which a row is closed without an end or ended without being closed.

Both call `scheduleWidgetSync()` via the existing `add`/`update` path — no new side effect.

### 1.7 Widget mirroring (required — this is a behaviour change)

Two places derive "ongoing" from `end_date` and **must** switch to `episode_state`:

- `lib/widgets/sync.ts:116–120` — currently
  `logs.filter(l => l.endDate === '' || l.date === today)` with `ongoing: l.endDate === ''`.
  Becomes `l.episodeState === 'ongoing' || l.date === today`, and
  `ongoing: l.episodeState === 'ongoing'`.
- `lib/widgets/headlessSnapshot.ts:239–251` — the **only raw SQL against `health_logs` outside
  the store**. `SELECT … WHERE end_date = ? OR log_date = ?` with params `['', today]` becomes
  `WHERE episode_state = ? OR log_date = ?` with params `['ongoing', today]`, and the selected
  column changes from `end_date` to `episode_state`.

This makes the widget's `healthOngoing` count *correct* for the first time: today it counts
every entry that never got an end typed. Expect the number on existing installs to drop to 0
right after the migration, which is the intended outcome, not a regression.

---

## 2. States and transitions

```
                    (new entry, default)
                            │
      ┌─────────────────────┴─────────────────────┐
      │                                           │
   "It's over"                              "Still going"
      │                                           │
      ▼                                           ▼
   ┌───────┐                                 ┌─────────┐
   │ point │                                 │ ongoing │
   └───────┘                                 └────┬────┘
   (legacy rows                        close │    │ delete
    land here too)                           ▼    ▼
                                        ┌────────┐  gone
                                        │ closed │  (row deleted;
                                        └────────┘   no tombstone,
                                                      no 'abandoned' state)
```

| From | To | Trigger | Writes |
|---|---|---|---|
| — | `point` | New entry, "It's over" (default) | `episode_state='point'`; `end_date`/`end_time` as today's flow already writes them |
| — | `ongoing` | New entry, "Still going" | `episode_state='ongoing'`, `end_date=''`, `end_time=''`, start pair from the backdate choice |
| `ongoing` | `closed` | Close sheet (§4.4) | `episode_state='closed'` + end pair + optional relief fields, **one patch** |
| `ongoing` | *gone* | Delete (existing `removeLog`) | Row deleted. No tombstone, no "abandoned" state, nothing left behind |
| `point` | `ongoing` | Editing an entry in `health-form` and switching the state control | Allowed. Clears the end pair. |
| `closed` | `ongoing` | Same, via edit | Allowed — a symptom that came back the same evening is a real thing. Clears the end pair. |

**There is no auto-close, ever.** Not at midnight, not at 24 hours, not at 7 days, not at
retention. Nothing in the app moves an episode out of `ongoing` except the user.

**There is no "abandoned"/"expired"/"stale" state.** Staleness is a property of the calendar,
not of the row; see §5.

---

## 3. Backdating

**Mandatory, not optional, on both branches** — "It's over" needs a start time just as much as
"Still going" does, and a close needs a stop time. People log after the fact; a flow that
assumes "now" produces wrong data on the majority path.

Four options, identical set everywhere a time is asked for:

| Option | Resolves to |
|---|---|
| `Just now` | today's date, current `HH:MM` |
| `This morning` | today's date, `08:00` |
| `Last night` | **previous day's** date, `21:00` |
| `Pick a time` | opens the existing `DateChipPicker` + `HH:MM` `Input` pair already used by `app/health-form.tsx:352–367` — no new picker component |

Rules:

- The three presets always produce a concrete `HH:MM`. They never write `''`. This is what
  makes duration computable for every episode created through this feature (legacy rows and
  quick logs may still have `''` — §6 handles that by showing nothing rather than guessing).
- `Last night` crossing the date boundary is the only reason this needs a helper rather than
  inline code; see `backdatedStart()` in §10.
- `Just now` is the pre-selected option. It is not the *default state* of the screen in the
  sense of being committed — nothing is written until save.
- Backdating a close is what makes a forgotten episode **fully recoverable**: a user who
  notices on Thursday that Monday's migraine is still marked open closes it with
  `Pick a time` → Monday evening, and the history is correct. This is the entire reason the
  feature can safely refuse to auto-close (§5).

---

## 4. UI per surface

Everything below obeys `DESIGN_RULES.md` — tap targets through `MIN_TAP_TARGET`/`HitSlop`,
motion through `Duration.*`, no bare `44`/`hitSlop: 8`/`duration: 220`
(`lib/__tests__/designTokens.test.ts` fails the PR otherwise).

### 4.1 New entry — `app/health-form.tsx`

The existing Issue → Severity → When started flow is **unchanged**. Two changes below it:

- The "When finished" block's `Switch` (`:372–397`, labelled `t.ongoingLabel` = "Ongoing" /
  "Pågår fortsatt") is replaced by a **two-option segmented control**: `Still going` /
  `It's over`, defaulting to **`It's over`**.
  - Default rationale: most logging happens afterwards, because during it people are not
    opening apps. This is the opposite of today's default (`:199` starts `ongoing = true`),
    and the change is deliberate — see D5 in §12.
  - Picking `It's over` reveals the existing end date + end time fields, plus the backdate
    presets row.
  - Picking `Still going` hides them entirely (an end and an open episode contradict) and
    reveals nothing new — the start is already captured above.
- The **backdate presets row** (§3) sits under "When started", above the existing
  `DateChipPicker`, as a row of four chips reusing `app/health-form.tsx`'s existing `chip` /
  `chipRow` styles (`:473–475`). Tapping a preset sets the date + time fields below it, which
  stay visible and editable — the presets are a shortcut, not a replacement.

Editing an existing entry seeds the control from `episodeState` (not from `!endDate`, which is
what `:199` does today).

### 4.2 Quick log — `app/(tabs)/health.tsx`

The Quick log card's expanded state (shown once a name is typed, `:281–329`) gains the same
two-option control, defaulting to `It's over`.

- `It's over` — the card behaves exactly as today (start time + duration → `endDate`/`endTime`
  via `addDurationToTime`), writing `episode_state='point'`.
- `Still going` — the **Duration field is hidden** (a duration contradicts an open episode) and
  the entry is written with `episode_state='ongoing'`, `endDate=''`, `endTime=''`.
- `addHealthStarterLog()` (`:167–182`, the StarterCard example's "+") writes
  `episode_state='point'`. The teaching example must not create an open episode the user then
  has to close.

### 4.3 Returning to Health with an episode open — the prompt

A new `components/OpenEpisodeCard.tsx`, rendered on `app/(tabs)/health.tsx` **above
`MedicineTrayCard`** (`:255`) and below the StarterCard, **one card per open episode**.

Content: `{symptom} — still going?` and two buttons, `Still going` · `It's over`.

Hard constraints — this must not read as an alert:

- **Flat `Surface`.** Not `elevated` (which deepens to the `floating` shadow tier,
  `components/Surface.tsx:120–123`), not `raised`. Border is `theme.border` — **not** the health
  domain accent, and **not** a severity colour. This deliberately differs from the surrounding
  cards, which all carry `borderColor={healthDomainColor.accent}`.
- **No accent bar, no `CardAccentBadge`.** Every other card on this screen has one; this one
  doesn't, because a coloured badge on a prompt reads as a status light.
- **No icon that means "warning".** If an icon is used at all, a neutral outline glyph only.
- **No animation.** It does not slide, pulse, fade in, or use any `Duration.*` entrance. It is
  simply present.
- It is **identical on day 1 and day 9** — see §5.

Behaviour:

- `Still going` **dismisses the card for the session and writes nothing.** No column is
  touched, no timestamp is recorded, no "last confirmed" is stored. Dismissal is a
  `useState<Set<string>>` of log ids held by `HealthScreen`. The five tabs are co-mounted
  (`lazy: false`), so this survives tab switches for the whole app session and returns on next
  launch — which is correct, because the app genuinely does not know whether it ended.
- `It's over` opens the close sheet (§4.4).
- Tapping the card body (not a button) opens `app/health-form.tsx` for that entry.
- If more than three episodes are open, render the three most recent and a plain
  "…" row that opens `/health-log`. A column of eight prompts is itself alarming.

### 4.4 Closing — `components/EpisodeCloseSheet.tsx`

One sheet, two optional fields, one `Skip`.

1. **`When did it stop?`** — the four backdate options from §3. Pre-selected: `Just now`.
2. **`Did anything help?`** — a free-text `Input` plus a row of one-tap chips.
   - Chips are the medicines with a dose logged **between the episode's start and its stop**
     (`store/useMedicineStore.ts`'s `doses`, `medicine_doses.log_date` + `taken_at`). Computed
     by `reliefCandidates()` (§10). If there are none, the chip row is absent — not empty, not
     a placeholder.
   - Chips reuse `app/health-form.tsx`'s "Possibly from" chip styling (`:410–435`) so the two
     medicine-pickers on this domain look like the same control.
   - Selecting a chip sets `reliefMedicineId`. Selecting none is normal.
3. **`Skip`** — reuses the existing `t.skipBtn` key. Closes the episode with **neither** field:
   `episode_state='closed'`, end pair from the pre-selected `Just now`, `relief_note=''`,
   `relief_medicine_id=NULL`.

**The second field never blocks the close.** There is no validation on it, no "are you sure",
no return trip. The sheet's primary action is always live from the moment it opens.

Same sheet is reachable from a row's action in `app/health-log.tsx` / `app/health-detail.tsx`,
so an episode can be closed from history without going through the prompt.

### 4.5 An ongoing row in a list

In `app/health-log.tsx` and `app/health-detail.tsx`, the row's **right-hand value column** —
the slot a closed entry uses for duration (per the row rule in AGENTS.md: *one right-hand
value*, `components/PadRow.tsx`) — shows the word `Ongoing` / `Pågår`.

- **Never a live count.** No minutes, no hours, no "since 09:14".
- The row **does not animate, pulse, or change colour over time.** It has exactly one
  appearance, from minute one to day nine.
- Rendered with `TabularNums` (`constants/theme.ts:372`) on that column, same as every other
  right-hand value, so a mixed column of `Ongoing` / `About 4 hours` / `Under an hour` stays
  aligned row to row.
- The severity colour on the row is unchanged. Openness is not a severity.

### 4.6 History — the only place duration appears

In `app/health-log.tsx` and `app/health-detail.tsx`, a **closed** entry's right-hand value is a
plain-language duration:

`Under an hour` · `About an hour` · `About 4 hours` · `Most of a day` · `About a day` ·
`About 3 days`

Never `3h 47m`. Never a total. Never a per-symptom average, minimum, maximum or trend. The
rounding is deliberate: the underlying data is a wall-clock pair the user typed from memory,
and rendering it to the minute implies a precision it does not have.

When duration is not computable (legacy row, `start_time` or `end_time` is `''`), the value
column shows **nothing**. Not "unknown", not "—". `describeDuration()` returns `null` and the
caller renders no value.

---

## 5. Stale episodes

An episode open for more than 24 hours is **normal**. Migraine, flare-ups and chronic pain run
for days. Policy, in full:

- **Do not auto-close.** Not ever, at any horizon.
- **Do not notify. Nothing in this feature ever produces a notification.** No scheduled
  reminder, no `lib/notifications.ts` call, no entry in `lib/reminders.ts`'s `syncReminders`,
  nothing on the `'medicine-reminder'`/`'task-reminder'` categories, no persistent-notification
  line. A push about an open illness episode is a nag about being unwell.
- **Do not escalate the prompt.** No colour change, no bolding, no "still?", no "day 3", no day
  counter, no reordering it up the screen, no second prompt. §4.3's card renders **byte-for-byte
  identically on day 1 and day 9.**
- **Do not badge, count or aggregate open episodes anywhere else** — no number on the tab bar,
  no Home card, no "3 open" chip. The widget's existing `healthOngoing` count (§1.7) is the one
  pre-existing exception and it stays as it is.
- **Recoverability is the answer to staleness.** Because closing always allows backdating (§3),
  a user who forgot for a week loses nothing: they close it with the real stop time and the
  history is right. That is why the app never needs to guess on their behalf.

---

## 6. Duration on read

Computed by `episodeDurationMinutes()` (§10), from `log_date` + `start_time` →
`end_date` + `end_time`, using the existing `parseTimeToMinutes` / `parseDateStr`
(`lib/date.ts:151`, `:35`). Returns `null` unless **all four** parts are present and parseable.

Buckets (`describeDuration(minutes)`):

| Minutes | Key |
|---|---|
| `< 60` | `underHour` |
| `60 – 89` | `aboutAnHour` |
| `90 – 599` | `hours(round(m/60))` |
| `600 – 1079` (10–18h) | `mostOfADay` |
| `1080 – 2159` (18–36h) | `aboutADay` |
| `≥ 2160` | `days(round(m/1440))` |
| `null` / negative | *(render nothing)* |

Negative durations (an end typed before the start) return `null` rather than a bogus value.
There is no error state and no correction prompt — the row simply carries no value.

---

## 7. "Did anything help?" — scope, and the hard limit

**Why it's in scope:** the Health tab's own starter copy promises *"Log what bothers you. And
what helps."* / *"Logg plagene dine. Og hva som hjelper."* (`lib/i18n.ts`, `starters.health.text`).
The second half has never existed. `relief_note` + `relief_medicine_id` are that half.

**The hard limit, to be stated in the file header of `lib/episodes.ts` so it survives this
document:**

> Recorded relief data is **displayed plainly and never interpreted**. No causal claim, no
> correlation, no strength, no percentage, no trend arrow, no "works / doesn't work", no
> ranking of what helps most, no "you usually take X for this". A list of what was logged,
> nothing inferred.

Concretely, on a symptom's page (`app/health-detail.tsx`) and a medicine's page
(`app/medicine-form.tsx`'s existing side-effects list, `:83`/`:116`), relief data appears only
as: the entry's own line, showing the note text and/or the medicine name, next to that entry's
date. Never aggregated across entries.

This is a diary, not a clinical tool. The sample size is always one, the confounders are
unbounded, and a user acting on an app's inference about their medication is a harm this
feature must not be able to cause.

---

## 8. Sync, backup, AI import/export

- **Sync: nothing to do.** `lib/liveSync.ts:47/50` defines
  `SyncTable = 'tasks' | 'shopping_items' | 'people' | 'tags'`. `health_logs` is not in it,
  has none of the LWW meta columns (`updated_at`/`deleted_at`/`origin_device_id`), and
  `useHealthStore` imports neither `liveSync` nor `syncService`. The new columns therefore carry
  no `TABLE_COLUMNS` entry, no tombstone handling and no conflict story. **Do not add
  `health_logs` to `SyncTable`** as part of this feature.
- **Backup: nothing to do.** `lib/backup.ts:106–125` enumerates every user table from
  `sqlite_master` and does `SELECT *` — schema-agnostic, so the new columns are backed up and
  restored automatically.
- **AI setup guide: nothing to add, and nothing may be added.** Confirmed exclusion points:
  - `lib/aiSetupApply.ts:72–81` — `AiSetupResult` enumerates ten importable domains; there is
    no `health` and no `medicines` domain, and the file imports neither store.
  - `lib/aiSetupGuide.ts:232–234` — the guide text tells the external AI that *"health-log
    entries are NOT supported by this import"*.
  - `lib/aiSetupGuide.ts:340–342` — the footer repeats it.
  - `lib/aiSetupGuide.ts:31–38` — medicines/doses are deliberately out of scope, and the
    exclusion is intentionally not spelled out in the guide's own text.

  **No `AI_SETUP_SCHEMA_VERSION` bump** (currently `3`, `lib/aiSetupGuide.ts:63`). The AGENTS.md
  cookbook rule "if this column is on a domain the guide already imports…" does not apply,
  because health is not an imported domain. `episode_state`, `relief_note` and
  `relief_medicine_id` must never appear in an `Ai*Draft` type, in `SETTINGS_WHITELIST`, or in
  `validateSettingValue()`. An AI-authored file that could open or close a health episode, or
  assert what medicine relieved a symptom, is a strictly worse idea than the medicine
  exclusion that already exists.

---

## 9. Per-person (`child_name`)

**Out of scope for this feature. Do not add a person column to `health_logs`.**

`health_logs` has **no** person column today — not `child_name`, not `assignee_id`. (Medicines
do: `medicines.child_name`, a NAME rather than a person id, precisely because medicines never
sync — `store/useMedicineStore.ts:78–81`.) Symptom entries are implicitly about the phone's
owner.

Reasons to leave it that way here:

1. Adding a person dimension to symptom data is a bigger decision than this feature, with its
   own privacy weight — the same reasoning that keeps health out of the AI guide and out of
   sync.
2. The open-episode prompt (§4.3) would immediately need a person filter, or a parent would be
   asked "Headache — still going?" about their child's headache with no indication whose it is.
3. It is additive and reversible later: one more append-only column (`child_name TEXT DEFAULT ''`,
   matching the medicine convention), a `PersonChip` on the row's meta line, and a filter on
   `openEpisodes()`. Nothing in this spec blocks it.

One interaction to be careful about now: `relief_medicine_id` may point at a medicine whose
`child_name` is set. **Display the medicine's name only.** Do not infer, show or store a person
from it.

---

## 10. New pure helper module — `lib/episodes.ts`

Dependency-free by design, in the same spirit as `lib/cardLayout.ts` and `lib/growth.ts`: plain
values in, plain values out. **It must not import `lib/db`, any store, `lib/notifications`,
`lib/reminders` or `lib/widgets/*`.** (`lib/__tests__/cardLayout.test.ts` sets the precedent of
asserting exactly that; §11.)

```ts
export type EpisodeState = 'point' | 'ongoing' | 'closed';

/** Anything unrecognised (legacy NULL, '', a typo) degrades to 'point'. */
export function toEpisodeState(raw: string): EpisodeState;

/** State only — never end_date. This is the function that replaces the four
 *  scattered `endDate === ''` checks. */
export function isOpen(log: { episodeState: EpisodeState }): boolean;

export function openEpisodes<T extends { episodeState: EpisodeState }>(logs: T[]): T[];

export type BackdatePreset = 'now' | 'thisMorning' | 'lastNight';

/** Resolves a preset against a supplied `now` (injected, never read from the clock
 *  inside, so it is testable). 'lastNight' = 21:00 on the PREVIOUS day. */
export function backdatedStart(preset: BackdatePreset, now: Date): { date: string; time: string };

/** null unless all four of log_date/start_time/end_date/end_time are present and
 *  parseable, and the end is not before the start. */
export function episodeDurationMinutes(log: {
  date: string; startTime: string; endDate: string; endTime: string;
}): number | null;

/** Bucket key + optional count for the History value column. null → render nothing. */
export function describeDuration(minutes: number | null):
  | { kind: 'underHour' | 'aboutAnHour' | 'mostOfADay' | 'aboutADay' }
  | { kind: 'hours' | 'days'; n: number }
  | null;

/** Medicines with a dose logged between the episode's start and its stop, for the
 *  close sheet's chips. Doses and medicines are passed in. */
export function reliefCandidates<M extends { id: string; name: string }>(
  medicines: M[],
  doses: { medicineId: string; date: string; takenAt: string }[],
  episode: { date: string; startTime: string },
  stop: { date: string; time: string },
): M[];

/** The one atomic patch that closes an episode. Never returns a patch that sets
 *  state without an end, or an end without state. */
export function closePatch(input: {
  stop: { date: string; time: string };
  reliefNote?: string;
  reliefMedicineId?: string;
}): { episodeState: 'closed'; endDate: string; endTime: string; reliefNote: string; reliefMedicineId: string };
```

---

## 11. The prune bug and its fix

### The bug (pre-existing, not introduced here)

`pruneOldData()` — `lib/db.ts:1069–1097`, called once on startup from `app/_layout.tsx` —
runs at `lib/db.ts:1083`:

```ts
    db.runSync('DELETE FROM health_logs WHERE log_date < ?', [c]);
```

`RETENTION_DAYS = 365` (`lib/db.ts:51`). The predicate looks **only at the start date**. It
makes no distinction between a closed entry and one still happening. **An episode open longer
than the retention window is silently deleted out from under the user on the next launch.**

Contrast the tasks delete immediately above it (`lib/db.ts:1079–1082`), which deliberately
spares live rows — `recurring = 'none' AND has_start_date = 1 AND done = 1` — with the comment
*"undone tasks are still live backlog"*. Health has no equivalent guard.

### The fix

Replace `lib/db.ts:1083` with:

```ts
    // An episode the user still considers open is live data, not history — the same
    // reasoning as the tasks guard above ("undone tasks are still live backlog"). Also
    // spare an entry whose END is still inside the retention window even though its
    // start isn't: a migraine that began 370 days ago and ended 300 days ago is one the
    // user can still see in History, and half-deleting it is worse than keeping it.
    // Note `episode_state != 'ongoing'` is NULL-unsafe by design: a row with a NULL
    // state fails the predicate and is KEPT. Failing safe means not deleting.
    db.runSync(
      "DELETE FROM health_logs WHERE log_date < ? AND episode_state != 'ongoing' AND (end_date = '' OR end_date < ?)",
      [c, c]
    );
```

Two notes:

- This is a change to a **function body**, not a migrations-array entry. The append-only rule
  does not apply; the function is ordinary code and may be edited directly.
- The `end_date` half of the guard is not strictly required by this feature, but it is the
  same class of bug and costs one clause. It is called out separately in §12 (D7) so the
  maintainer can drop it and keep only the `episode_state` guard.
- `medicine_doses` (`lib/db.ts:1095`) is untouched — doses are genuinely point events.

---

## 12. Copy

New keys under a single nested `episodes` object in **both** `en` and `no` in `lib/i18n.ts`
(`no: typeof en` makes a missing Norwegian key a compile error).

| Key | EN | NO |
|---|---|---|
| `episodes.ongoing` | `Ongoing` | `Pågår` |
| `episodes.stillGoing` | `Still going` | `Holder på` |
| `episodes.itsOver` | `It's over` | `Det er over` |
| `episodes.stillGoingPrompt(symptom)` | `${symptom} — still going?` | `${symptom} — holder det på?` |
| `episodes.whenDidItStop` | `When did it stop?` | `Når ga det seg?` |
| `episodes.didAnythingHelp` | `Did anything help?` | `Var det noe som hjalp?` |
| `episodes.when.justNow` | `Just now` | `Akkurat nå` |
| `episodes.when.thisMorning` | `This morning` | `I morges` |
| `episodes.when.lastNight` | `Last night` | `I går kveld` |
| `episodes.when.pickTime` | `Pick a time` | `Velg tidspunkt` |
| `episodes.duration.underHour` | `Under an hour` | `Under en time` |
| `episodes.duration.aboutAnHour` | `About an hour` | `Omtrent en time` |
| `episodes.duration.hours(n)` | `About ${n} hours` | `Omtrent ${n} timer` |
| `episodes.duration.mostOfADay` | `Most of a day` | `Mesteparten av en dag` |
| `episodes.duration.aboutADay` | `About a day` | `Omtrent et døgn` |
| `episodes.duration.days(n)` | `About ${n} days` | `Omtrent ${n} døgn` |

**`Skip` reuses the existing `t.skipBtn`** (`lib/i18n.ts:560` / `:2189` — already `Skip` /
`Hopp over`). No new key. (`t.onboarding.skip` at `:411`/`:2053` is "Skip for now" / "Hopp
over" and is a different control — don't reuse that one.)

### Tone check against `lib/__tests__/copyTone.test.ts`

Every string above was checked against the test's actual banned patterns
(`lib/__tests__/copyTone.test.ts:53–70`), not against a paraphrase of them:

- EN stems `you missed` / `missed` / `overdue` / `forgot` / `don't forget` / `should have` /
  `falling behind` / `behind schedule` / `too late` / `hurry` / `urgent` / `you failed` /
  `you broke` — **no match** in any string.
- NO stems `glem*` / `gikk glipp` / `forsinket` / `for sent` / `du burde` / `skulle ha` /
  `haster` / `skynd deg` / `mislyktes` — **no match**. In particular `Når ga det seg?` and
  `Mesteparten av en dag` were checked against `for sent` and `forsinket`.
- Countdown framing (`only N left`, `bare N igjen`) — none. `About 4 hours` is a retrospective
  measurement of something already finished, not a countdown, and it is the only place any
  number about an episode is rendered.
- **Exclamation marks: none.** The `!` allowlist at `:88–104` is a **ratchet — entries may be
  removed, never added**. No string above contains `!`, so the frozen set of 13 is untouched.
  Any future copy for this feature must keep that property.
- Tone beyond the automated test: `{symptom} — still going?` is a question about the world, not
  about the user's diligence. It is not "you left this open", "you forgot to close this", or
  "still ongoing?" with an implied *really?*. `Still going` / `Holder på` is the same phrasing
  as the question, so answering it is not a confession.

### The `pågående` / `Pågår` collision

`lib/i18n.ts:950` / `:2874` already define
`widgets.healthOngoing: (n) => n === 1 ? '1 ongoing' : '${n} ongoing'` /
`'${n} pågående'`, mirrored in `lib/widgets/headlessSnapshot.ts:78`/`:99`.

**Resolution: both spellings stay, and they are not in conflict.**

- `pågående` is an **adjective agreeing with a count** — "2 pågående" is correct Norwegian and
  "2 Pågår" is not. That key keeps its wording. Its *meaning* changes (§1.7): it starts counting
  actual open episodes instead of every entry with a blank end date.
- `Pågår` is a **standalone status word** in a row's value column — a verb form, which is what
  reads correctly alone. This is the new `episodes.ongoing`.
- `t.ongoingLabel` (`:1033` `Ongoing` / `:2950` `Pågår fortsatt`) is used **only** by
  `app/health-form.tsx:377`'s switch, which §4.1 replaces. Delete it from both dictionaries in
  the same edit as the form change (TypeScript enforces the pair). If the maintainer prefers to
  keep it, it becomes dead copy — say so rather than leaving it ambiguous.

---

## 13. Test plan

Repo rule (`TESTING.md`, AGENTS.md): a test with every pure helper, every branch and every bug
fix; headless and DB-free; native modules mocked. New suite `lib/__tests__/episodes.test.ts`,
plus one added `describe` block in the existing `lib/__tests__/db.test.ts`.

> Note for whoever implements: concurrent sessions are editing test files. Coordinate before
> touching `lib/__tests__/db.test.ts`.

### `lib/__tests__/episodes.test.ts`

| Helper | Assertions |
|---|---|
| `toEpisodeState` | `'point'`/`'ongoing'`/`'closed'` round-trip; `''`, `'POINT'`, `'weird'`, `undefined`-as-`''` all → `'point'`. **The degradation direction is the point** — never `'ongoing'`. |
| `isOpen` | true only for `'ongoing'`. **A row with `episodeState: 'point'` and `endDate: ''` is NOT open** — this is the regression test for the whole migration decision (§1.5). |
| `openEpisodes` | Filters by state only; a list of legacy-shaped rows (`state 'point'`, `endDate ''`) returns `[]`; preserves input order. |
| `backdatedStart` | `'now'` → today + current `HH:MM` zero-padded; `'thisMorning'` → today + `'08:00'`; `'lastNight'` → **previous day** + `'21:00'`; `'lastNight'` on the 1st of a month rolls to the previous month; on Jan 1 rolls to Dec 31 of the previous year. `now` is injected, so no fake timers needed. |
| `episodeDurationMinutes` | Same-day 09:00→11:30 = 150; crossing midnight 23:30→00:30 next day = 60; multi-day 3-day span; `null` when `startTime === ''`; `null` when `endTime === ''`; `null` when `endDate === ''`; `null` for a malformed `'9am'`; `null` for a negative span (end before start). |
| `describeDuration` | Each bucket boundary exactly: 0, 59 → `underHour`; 60, 89 → `aboutAnHour`; 90 → `hours n:2`, 599 → `hours n:10`; 600, 1079 → `mostOfADay`; 1080, 2159 → `aboutADay`; 2160 → `days n:2`; `null` in → `null` out. **Assert no branch ever returns a minutes value** — nothing may leak `3h 47m`. |
| `reliefCandidates` | Includes a medicine dosed inside the window; excludes one dosed before the start; excludes one dosed after the stop; includes one dosed exactly at the start minute and exactly at the stop minute (inclusive bounds); handles a window crossing midnight; returns `[]` when `doses` is empty; ignores doses whose `medicineId` matches no medicine. |
| `closePatch` | Always sets `episodeState: 'closed'` **and** both end fields together; omitted relief fields become `''` (never `undefined`, which `rowValues` would skip); a patch is never producible with `'closed'` and an empty `endDate`. |
| module purity | Follows `lib/__tests__/cardLayout.test.ts`'s precedent: read `lib/episodes.ts`'s source and assert it imports none of `@/lib/db`, `@/store/*`, `@/lib/notifications`, `@/lib/reminders`, `@/lib/widgets/*`. |
| no-notification guarantee | Source-scan `lib/episodes.ts` + `components/OpenEpisodeCard.tsx` + `components/EpisodeCloseSheet.tsx` for `scheduleDailyReminder`, `scheduleNotification`, `syncReminders`, `expo-notifications` — assert **zero** hits. §5 is a product promise; this is what keeps it true. |

### `lib/__tests__/db.test.ts` — new `describe('pruneOldData — health_logs query')`

Exactly the shape of the existing tasks block (`:19–35`), asserting on the SQL text passed to
the mocked `runSync`:

- The `FROM health_logs` / `DELETE FROM health_logs` call exists.
- `sql` contains `log_date < ?`.
- `sql` contains `episode_state != 'ongoing'` — **the guard against deleting a live episode.**
- `sql` contains `end_date` (the second half of the guard, if D7 is accepted).
- `params` are two `YYYY-MM-DD` strings.
- The existing "never blocks startup if a delete throws" test already covers the try/catch.

### Not covered headlessly (needs a device)

The prompt card's visual weight (does it read as an alert?), sheet gestures, and the row value
column's alignment under the `large` text scale. `npm run preview` can drive the Health tab and
the close flow — but note `app/(tabs)/health.tsx`'s Quick log path is reachable there while
anything behind `Alert.alert` is not (AGENTS.md, "What the preview genuinely CANNOT reach").
Use `showAppModal`, not `Alert.alert`, for any confirm in this feature — as
`app/health-form.tsx:261` already does.

### Gate before opening the PR

1. `npx tsc --noEmit` — also catches a missing `no` key.
2. `scripts/test-changed.sh` — report which suites ran and their result, not "all green".
3. `lib/__tests__/copyTone.test.ts` must pass unchanged (no allowlist edits — it is a ratchet).

---

## 14. Files touched (for the implementation session)

| File | Change |
|---|---|
| `lib/db.ts` | 5 appended migrations at idx 226–230; `pruneOldData()` health delete rewritten (§11) |
| `lib/episodes.ts` | **new** — pure helpers (§10) |
| `store/useHealthStore.ts` | 3 fields, 4 touch points, `startEpisode`/`closeEpisode` (§1.6); header `Edit notes` updated |
| `lib/i18n.ts` | `episodes` object in `en` + `no`; delete `ongoingLabel` (§12) |
| `app/health-form.tsx` | State control replaces the Ongoing switch; backdate presets (§4.1) |
| `app/(tabs)/health.tsx` | State control on Quick log; `OpenEpisodeCard` above `MedicineTrayCard` (§4.2, §4.3) |
| `app/health-log.tsx`, `app/health-detail.tsx` | Right-hand value column: `Ongoing` or a plain-language duration (§4.5, §4.6) |
| `components/OpenEpisodeCard.tsx` | **new** (§4.3) |
| `components/EpisodeCloseSheet.tsx` | **new** (§4.4) |
| `lib/widgets/sync.ts`, `lib/widgets/headlessSnapshot.ts` | `episode_state` replaces the `end_date === ''` derivation (§1.7) |
| `lib/__tests__/episodes.test.ts` | **new** (§13) |
| `lib/__tests__/db.test.ts` | One added `describe` (§13) — coordinate, concurrent edits |

**Not touched:** `lib/liveSync.ts`, `lib/syncService.ts`, `lib/backup.ts`, `lib/aiSetupGuide.ts`,
`lib/aiSetupApply.ts`, `constants/colors.ts`. Every file touched gets its `Connections:` /
`Edit notes` header updated in the same edit (AGENTS.md token policy).

---

## 15. Open questions / decisions taken

Every place this spec departs from the handoff, or made a call the maintainer may want to
overrule. Each is written so it can be reversed without unpicking the rest.

**D1 — `started_at`/`ended_at INTEGER` epoch-ms: rejected.** Reuse `log_date`/`start_time` and
`end_date`/`end_time`. *Why:* `health_logs` has no epoch-ms convention, `YYYY-MM-DD` is a key
AGENTS.md invariant, `end_date`/`end_time` already exist and a parallel representation would
drift, and an INTEGER column can't join `pruneOldData()`'s string cutoff comparison.
*Cost, stated honestly:* wall-clock pairs with `''` allowed make some legacy durations
uncomputable (§6 renders nothing for those). *To overrule:* add both epoch columns, write them
alongside the TEXT pair, and make the TEXT pair the display source — but then something must own
the invariant that they agree, and nothing in this codebase currently does that for any table.

**D2 — `ended_at` reconciled by deletion, not addition.** There is no new "end" column at all.
Closing writes the existing `end_date`/`end_time`. *To overrule:* see D1; they are the same
decision.

**D3 — the belt-and-braces `UPDATE health_logs SET episode_state = 'point' WHERE …` at idx 227.**
SQLite's `ADD COLUMN` with a constant `DEFAULT` already back-fills existing rows, so this entry
is arguably redundant. It is included because it makes the backfill *intent* explicit at the
exact place a future session would otherwise be tempted to write the dangerous version
("`SET 'ongoing' WHERE end_date = ''`"). **Decide before merge — after merge it is permanent**
(append-only). Dropping it changes nothing functionally.

**D4 — `relief_medicine_id` is singular.** One medicine per closed episode. *Why:* it matches
the existing `health_logs.medicine_id` precedent exactly, keeps the question one tap, and the
free-text `relief_note` catches "ibuprofen and a dark room". *To overrule:* make it
`relief_medicine_ids TEXT DEFAULT ''`, comma-separated, following the `tasks.tag_ids` precedent
(`lib/tags.ts`) — that is the established multi-value shape in this repo, and a join table would
be wrong here for the same reason it was wrong there. **This is the open question I'd most like
a ruling on**, because it is the one that is expensive to change after data exists.

**D5 — the new-entry default flips to "It's over".** Today `app/health-form.tsx:199` defaults a
new entry to *ongoing* (`ongoing = true`), and its header at `:38–40` says so deliberately:
*"most symptoms are logged while still happening"*. This spec asserts the opposite — most
logging happens afterwards, because during it people are not opening apps — per the handoff's
explicit instruction. **These two claims contradict each other and only the maintainer knows
which is true of real use.** The spec follows the handoff; the existing header comment is the
evidence for the other side. *To overrule:* flip one default in `health-form` and one in Quick
log; nothing else changes.

**D6 — no auto-close, no notification, no escalation, at any horizon.** Taken as an absolute,
including "not even after 30 days" and "not even a silent one". *To overrule:* don't. If open
episodes accumulate in practice, the right fix is making the close cheaper (a one-tap close on
the History row), not a nudge.

**D7 — the prune guard has a second clause (`end_date = '' OR end_date < ?`).** The feature
strictly requires only `episode_state != 'ongoing'`. The extra clause also spares an entry whose
start is outside retention but whose end is inside it. *To overrule:* drop the clause and the
corresponding test assertion; the open-episode protection is unaffected.

**D8 — `t.ongoingLabel` is deleted.** It becomes unused once the form's switch is replaced.
*To overrule:* leave it in both dictionaries as dead copy.

**D9 — per-person is out of scope** (§9). *To overrule:* one appended
`ALTER TABLE health_logs ADD COLUMN child_name TEXT DEFAULT ''`, a `PersonChip` on the row's
meta line, and a person filter in `openEpisodes()` — but decide the privacy question first,
since it is the same question that keeps health out of sync and out of the AI guide.

**D10 — the prompt is capped at three cards** (§4.3), with a "…" row to `/health-log` beyond
that. Invented here; the handoff says "one quiet prompt per open episode" with no cap. *Why:*
eight stacked prompts is itself the alarming state the feature is trying to avoid.
*To overrule:* remove the cap; nothing else depends on it.

**Unsettled — what "the session" means for the prompt's dismissal.** §4.3 uses screen-level
`useState`, which given `lazy: false` on the pager survives tab switches and dies on app
restart. That is a defensible reading of "dismisses for the session and writes nothing", and it
is the only reading that writes nothing at all. But it means a user who force-quits and reopens
sees the prompt again the same afternoon. The alternative — persisting a dismissal — requires
storage, and storage of "I asked and you said yes at 14:02" is a timestamp about being unwell
that this feature has no other reason to keep. **Flagging rather than deciding:** I could not
settle whether the restart re-prompt is a mild annoyance or the correct behaviour.
