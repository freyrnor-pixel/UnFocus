# AUDIT.md — Phase 0

Read-only audit for `UnFocus-Code-Handoff.md` Phase 0 and the `Colour & Order` addendum.
**No source file was modified.** Commit `9ced73a`, branch `claude/multi-agent-task-dispatch-ye7i54`, 2026-07-31.

Baselines captured before any change (Appendix B): `tsc --noEmit` clean, **61 suites / 848 tests passing**, wrap audit NO@360px = 30 wrapped / 12 truncated / 0 wrapped rows.

---

## Conflict register — read this before approving any phase

The handoff says: *"If any instruction here conflicts with what you find in the code, stop and report the conflict. Do not resolve it yourself."* Twelve conflicts found. Nothing has been resolved or actioned; each is listed with the evidence and the decision that is yours to make.

Severity: **BLOCKER** = the task cannot be done as written. **REWORK** = the task's premise is wrong but the goal survives. **NOTE** = do it, with a caveat.

| # | Task | Severity | The conflict |
|---|---|---|---|
| 1 | A.2 surface ladder | **BLOCKER** | The proposed palette **breaks 6 existing CI contrast assertions**. This violates the handoff's own global constraint ("if a change fails one of them, the change is wrong — not the test"). See §0.3b. |
| 2 | A.0 #4 badge contrast | **BLOCKER** | The "six of eight badges fail 4.5:1" finding is **largely void** — the app picks badge ink dynamically via `contrastOn()`, so white-on-fill is a combination it never draws. A real but *different* defect exists in dark mode. See §0.3b. |
| 3 | A.0 #3 / A.3 hue collisions | **REWORK** | All three deuteranopia ΔE figures are **wrong (2–2.8× low) and the ranking is inverted**. The brief's worst pair is safe; the actual collisions are different, and protanopia (untested in the brief) is worse than deuteranopia. The four-hue cut may still be right — but not for the stated reasons. See §0.3b. |
| 4 | B.2 Food/Catalogue move | **BLOCKER** | The author's own stated precondition fails. Monthly list needs both destinations; the buttons already render on both tabs and are the app's only route to them. See §0.7. |
| 5 | B.2 Quick log → strip | **REWORK** | The author's own stated precondition fails: it is **four inputs**, not one field. Author's written fallback applies — keep it a card, move it above Medicine. See §0.7. |
| 6 | B1-3 ⓘ auto-expand | **REWORK** | Only 2 screens auto-expand, and on both the hint body holds **the only copy of real setup controls** (notification switches; reset cadence pickers). Removing auto-expand as written buries working settings. See §0.2. |
| 7 | Phase 3 data model | **REWORK** | `started_at`/`ended_at INTEGER` epoch-ms contradicts the table's split-TEXT format and a key AGENTS.md invariant; `ended_at` **duplicates existing `end_date`/`end_time`** columns. See §0.6. |
| 8 | Phase 3 retention | **NOTE** | `pruneOldData()` filters `log_date` alone with no end guard — an episode open >365 days is **deleted**. New feature, pre-existing bug. See §0.6. |
| 9 | B1-5 `Waiting for you` | **NOTE** | **Dead key.** `t.backlog` has no render site anywhere in the app. Changing it is free but changes nothing on screen. See §0.5. |
| 10 | B1-4 nav label | **NOTE** | Premise confirmed (`Handleliste` needs +16px, worst by 5×), but the acceptance criterion "all five NO labels fit" **cannot pass** — `Gjøremål` also truncates by 3px and B1-4 doesn't touch it. Plus a known web false-positive. See Appendix B. |
| 11 | B2-3 Home cards | **NOTE** | Direction inverted. The **Home cards are the newer code**; `PadRow` is used by the four Home cards and *no tab screen*. The tabs are what drifted. See §0.4. |
| 12 | B1-6 AI guide | **NOTE** | Not in Settings → Advanced (it's General → Local account), and it is **shown to every new user** on the guided tour's closing card. See Appendix A. |

### Two live bugs found incidentally

- **`app/onboarding/features.tsx:89`** seeds `picked` to all-`false`, so re-running onboarding and pressing Next silently switches `featureSharing` and `featureAutomations` **off**. B1-1 deletes this screen, which removes the bug as a side effect — worth knowing it was there.
- **`pruneOldData()`** — conflict #8 above.

### Where the docs are stale

`AGENTS.md` and several file headers no longer match the code. Flagged so they can be corrected as the phases land, per the repo's update-headers-as-you-go rule:

- `AGENTS.md`: "every list-bearing surface draws through `PadRow`" — it is used by 4 Home cards and no tab screen.
- `AGENTS.md`: "every StarterCard caller uses a plain `length === 0`" — wrong for 3 of 7 callers.
- `app/onboarding/features.tsx:9` header: "Three rows here" — there are two.
- `components/EnergyMeter.tsx:13` header: "Always rendered" — it is gated on `settings.energySystemEnabled`.

### Scope note

§0.7 (screen order + headers) is **pre-work for the addendum's Part B**, not part of the requested Phase 0. It is included because Part B asks for violations to be reported before fixing, and gathering it now cost one parallel pass. Nothing in it has been acted on.

---

## 0.1 Onboarding

Read-only audit of the onboarding flow in `/home/user/UnFocus`. Every claim below is
anchored to `file:line`. Where something does not exist it is stated explicitly.

The onboarding directory contains exactly 8 files and nothing else:
`_layout.tsx`, `basics.tsx`, `energy.tsx`, `features.tsx`, `guided.tsx`, `index.tsx`,
`privacy.tsx`, `restore.tsx`. There is **no** `app/onboarding/language.tsx`, **no**
`app/onboarding/intro.tsx` and **no** `app/first-run.tsx` — all three are genuinely
deleted, matching AGENTS.md.

---

### 1. Screen list / router, in real render order

**Declared order (the backdrop's list, not the navigator's):**
`/home/user/UnFocus/app/onboarding/_layout.tsx:58`

```ts
const STEPS = ['basics', 'restore', 'privacy', 'guided', 'energy', 'features', 'index'] as const;
```

There is **no `<Stack.Screen>` list anywhere** — `_layout.tsx:132-138` renders a bare
`<Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: {backgroundColor:'transparent'} }} />`.
So the router imposes **no order at all**; order is entirely determined by the
`router.push` call inside each screen. `STEPS` is used only to position the backdrop.

**Real navigation graph (verified call-by-call):**

| # | Screen | File | Entry | Exit call | Line |
|---|--------|------|-------|-----------|------|
| 1 | **basics** | `app/onboarding/basics.tsx` | `app/_layout.tsx:473` + `:477` guards `router.replace('/onboarding/basics')`; also Settings' "Run setup again" (`app/settings.tsx:1283`) and reset (`app/settings.tsx:1063`) | `commit()` → `router.push('/onboarding/restore')` — fired by **both** the "Skip for now" and the "Continue" button | `basics.tsx:121`, buttons at `:198-209` / `:210-220` |
| 2 | **restore** | `app/onboarding/restore.tsx` | pushed from basics | "No, I'm new" → `router.push('/onboarding/privacy')`. Restore CTA instead runs `restoreBackup()` + `reloadApp()` and never continues the flow (`restore.tsx:48-85`). Footer "Previous" = `router.back()` (`:123`) | `restore.tsx:114` |
| 3 | **privacy** | `app/onboarding/privacy.tsx` | pushed from restore | single CTA → `router.push('/onboarding/guided')`; footer "Previous" = `router.back()` (`:75`) | `privacy.tsx:66` |
| 4 | **guided** | `app/onboarding/guided.tsx` | pushed from privacy | **Branch point.** `goGuided()` → `router.push('/onboarding/energy')` (`:66`). `goExplore()` → writes `{setupComplete:true, lastMonthlyReset: todayStr()}`, syncs reminders, then `router.replace('/')` (`:69-87`) | `guided.tsx:66` / `:86` |
| 5 | **energy** | `app/onboarding/energy.tsx` | pushed from guided (Guided path only) | `next()` → `settings.update(picked)` then `router.push('/onboarding/features')` | `energy.tsx:101-104` |
| 6 | **features** | `app/onboarding/features.tsx` | pushed from energy | `next()` → `settings.update(picked)` then `router.push('/onboarding')` | `features.tsx:99-102` |
| 7 | **index** (name + finish) | `app/onboarding/index.tsx` | pushed from features | `finish()` → writes `userName`/`setupComplete`/`lastMonthlyReset`, `publishSelfName()`, reminder sync, `router.replace('/')` | `index.tsx:68-95` |

**Verdict vs AGENTS.md:** the claimed order
`basics → restore → privacy → guided/explore → energy → features → index (name) → home`
is **accurate**. The only nuance AGENTS.md does not spell out here: the order lives in
seven independent hard-coded `router.push` string literals, not in any single list —
`STEPS` in `_layout.tsx:58` is a *parallel* list that only drives the backdrop and can
silently drift out of sync with the real pushes (an unknown segment falls back to index
0, `_layout.tsx:86`).

The guided **tour** (`lib/tourSteps.ts` + `components/TourSpotlight.tsx`) is *not* part of
this stack — it runs on the real tab app afterwards, gated on `settings.tourProgress`
(`store/useSettingsStore.ts:397`, `674`).

---

### 2. Feature-picker screen component

`/home/user/UnFocus/app/onboarding/features.tsx` — default export `OnboardingFeatures`
at **line 80**. Renders a `Surface` card of rows from the module-level `ROWS` array
(**line 67-78**), each a label/hint pair from `t.config.features.*` plus a
`FormControls` `Switch` (`:127`). Footer is Previous / Next (`:143-144`).

Title/sub come from `t.featurePicker.title` / `.sub` (`:114-115`), i18n at
`lib/i18n.ts:408-413` (EN) and `lib/i18n.ts:2070-2075` (NO).

**It offers exactly TWO rows today**, not three:

```ts
// app/onboarding/features.tsx:67
const ROWS = [
  { key: 'featureSharing',     copy: (t) => t.config.features.sharing },
  { key: 'featureAutomations', copy: (t) => t.config.features.automations },
];
```

Its own file header (`features.tsx:9`) still says "**Three rows here** — Sharing & QR,
Automations, and Quiet growth". That header is **stale**: `showGrowth` was moved out to
`energy.tsx` (noted in the inline comment at `features.tsx:74-77`, and the header's own
later paragraph contradicts its opening line).

---

### 3. Where the feature picker writes its result

`app/onboarding/features.tsx:100`:

```ts
settings.update(picked as Partial<Settings>);
```

- Target: the **Zustand settings store** `store/useSettingsStore.ts`, which writes through
  to the single-row SQLite `settings` table (id = 1).
- Keys written: **`featureSharing`** and **`featureAutomations`** only.
- SQLite columns: `feature_sharing`, `feature_automations` — mapped in the FieldMap at
  `store/useSettingsStore.ts:569` and `:572`.
- Timing: one write, on Next only. Local state `picked` (`features.tsx:89-92`) is
  seeded to `{featureSharing:false, featureAutomations:false}` — deliberately **not**
  from current settings.

**Refactor-relevant gotcha:** because `picked` always starts `false`, re-entering this
screen (e.g. via a re-run of onboarding) and pressing Next will **turn both flags off**
even if the user had enabled them in Settings. `energy.tsx:91-94` deliberately does the
opposite (seeds from current settings).

---

### 4. Feature switches and their real defaults

#### 4a. In the picker

| Settings field | DB column | `defaultSettings` | `ALTER TABLE` default | Later corrective `UPDATE` | Effective fresh-install value |
|---|---|---|---|---|---|
| `featureSharing` | `feature_sharing` | `false` (`store/useSettingsStore.ts:660`) | `INTEGER DEFAULT 0` (`lib/db.ts:773`) | `lib/db.ts:783` — `SET feature_sharing = 1 WHERE setup_complete = 1` (back-fill for *existing* users only) | **OFF** |
| `featureAutomations` | `feature_automations` | `false` (`:663`) | `INTEGER DEFAULT 0` (`lib/db.ts:776`) | same back-fill at `lib/db.ts:783`, `WHERE setup_complete = 1` | **OFF** |

#### 4b. Feature switches NOT in the picker

Settings → Advanced → Features (`FEATURE_ROWS`, `app/settings.tsx:288-299`) holds **six**
rows — four more than the picker:

| Settings field | DB column | `defaultSettings` | `ALTER TABLE` default | Corrective `UPDATE`s | Effective |
|---|---|---|---|---|---|
| `featureGoals` | `feature_goals` | `true` (`:659`) | `DEFAULT 0` (`lib/db.ts:772`) | `lib/db.ts:783` (`=1 WHERE setup_complete=1`), then **`lib/db.ts:802` `UPDATE settings SET feature_goals = 1`** (unconditional) | **ON** |
| `featureMedicine` | `feature_medicine` | `true` (`:664`) | `DEFAULT 1` (`lib/db.ts:864`) | `lib/db.ts:865` `UPDATE … feature_medicine = 1` (unconditional) | **ON** |
| `energySystemEnabled` | `energy_system_enabled` | `true` (`:645`) | `DEFAULT 1` (`lib/db.ts:673`) | three, in order: `:788` `=0 WHERE setup_complete=0`; `:797` `=1 WHERE setup_complete=0`; `:818` **`UPDATE settings SET energy_system_enabled = 1`** (unconditional, last word) | **ON** |
| `showGrowth` ("Quiet growth") | `show_points` | `false` (`store/useSettingsStore.ts:600`) | `DEFAULT 0` (`lib/db.ts:280`) | **none** — `grep show_points lib/db.ts` returns only the ALTER at `:280` and a comment at `:1018` | **OFF** |
| `featureScan` | `feature_scan` | `true` (`:661`) | `DEFAULT 0` (`lib/db.ts:774`) | `:783` back-fill, then `lib/db.ts:809` `UPDATE settings SET feature_scan = 1, feature_food = 1` (unconditional) | **ON — but inert**: not in `FEATURE_ROWS`, not in the picker, no gate reads it |
| `featureFood` | `feature_food` | `true` (`:662`) | `DEFAULT 0` (`lib/db.ts:775`) | same as above (`:783`, `:809`) | **ON — inert**, same as `featureScan` |

`showGrowth` **is** toggled during onboarding, but on `energy.tsx`, not the picker
(`app/onboarding/energy.tsx:78`, written at `:102`).

Completeness note — the Settings → Personal → **Device features** card
(`app/settings.tsx:1310-1344`) holds four more switches. These are OS-permission gates,
not feature flags, and are excluded from `FEATURE_ROWS`/the picker on purpose:
`voiceNotesEnabled` (`voice_notes_enabled`, `defaultSettings` **true**, ALTER `DEFAULT 0`
at `lib/db.ts:355`, forced on by unconditional `UPDATE` at `lib/db.ts:651`);
`contactsEnabled` (`contacts_enabled`, default false, ALTER `DEFAULT 0` `lib/db.ts:632`);
`locationEnabled` (`location_enabled`, false, `lib/db.ts:352`);
`calendarSyncEnabled` (`calendar_sync_enabled`, false, `lib/db.ts:354`).

**Summary of the DB-vs-store consistency check:** every field's `defaultSettings` value
agrees with the *final* effective DB state after all corrective UPDATEs. The two places
where reading only `defaultSettings` or only the `ALTER TABLE` would mislead are
`featureGoals`/`featureScan`/`featureFood` (`DEFAULT 0` in the ALTER, forced to 1 later)
and `energySystemEnabled` (flipped 1 → 0 → 1 → 1 across four statements).

---

### 5. The "Energy explained" screen (`app/onboarding/energy.tsx`)

**Structure: ONE component rendered TWICE, vertically stacked — not two components, not
two columns.**

The two halves are data rows in a module-level `CARDS` array
(`app/onboarding/energy.tsx:63-81`):

```ts
const CARDS = [
  { key: 'energySystemEnabled', icon: 'battery-half-outline', motif: 'halo-ring',     copy: (t) => t.energyIntro.energy },
  { key: 'showGrowth',          icon: 'leaf-outline',          motif: 'canopy-corner', copy: (t) => t.energyIntro.growth },
];
```

JSX skeleton (`energy.tsx:106-148`):

```
SafeAreaView
└ ScrollView (contentContainerStyle: paddingHorizontal lg, gap Spacing.md)   :108
  ├ View.top                                                                  :109
  │   ├ Text heading  = t.energyIntro.title                                   :110
  │   └ Text sub      = t.energyIntro.sub                                     :111
  ├ CARDS.map(...)  →  per card:                                              :114
  │   Surface (flexDirection:'row')                                           :117
  │     ├ View.iconWrap (52×52)                                               :119
  │     │    ├ Motif  id={motif} (absolute-filled, behind)                    :120
  │     │    └ Ionicons name={icon}                                           :121
  │     └ View.cardBody (flex:1)                                              :124
  │          ├ View.cardHead (row): Text cardTitle + FormSwitch               :125-128
  │          ├ Text cardText  = copy.body                                     :129
  │          └ Text cardNote  = copy.note (left accent rule)                  :130
  └ View.footNote  (info icon + t.energyIntro.note)                           :138-141
Footer View: Button "Previous" (router.back) | Button "Next" (next())          :144-147
```

The `row` direction is *within* a card (icon left, text right); the two cards themselves
stack vertically via the ScrollView's `gap: Spacing.md` (`energy.tsx:158`). There is no
two-column layout anywhere on this screen.

**Screen title string + i18n key:**

- key: **`t.energyIntro.title`** — used at `app/onboarding/energy.tsx:110`
- EN: `'Two things worth explaining'` — `lib/i18n.ts:391`
- NO: `'To ting som er verdt en forklaring'` — `lib/i18n.ts:2056`

Sub-heading `t.energyIntro.sub`: EN `'Both of these sound like scoring. Neither one is,
and you can turn either off.'` (`lib/i18n.ts:392`) / NO `'Begge høres ut som poeng. Ingen
av dem er det, og du kan slå av begge.'` (`lib/i18n.ts:2057`).

Card titles: `t.energyIntro.energy.title` = EN `'Energy'` (`:394`) / NO `'Energi'`
(`:2059`); `t.energyIntro.growth.title` = EN `'Quiet growth'` (`:399`) / NO
`'Stille vekst'` (`:2064`).

Writes: `settings.update(picked)` at `energy.tsx:102` — `energySystemEnabled` +
`showGrowth`, seeded from current settings at `:91-94`.

---

### 6. What happens if a user skips onboarding

**Is skipping possible from the UI? Only partially — there is no global "skip
onboarding" affordance.** Per screen:

| Screen | Skip affordance? |
|---|---|
| basics | **Yes** — "Skip for now" (`t.firstRun.skip`), `basics.tsx:197-209`. It is *not* a skip of the flow: it calls the same `commit(picks)` as Continue and pushes to `/onboarding/restore` (`basics.tsx:121`). Both buttons are the same size and place, by design (`basics.tsx:58-60`). |
| restore | **No skip.** Only "No, I'm new" → privacy (`restore.tsx:114`) and Previous. |
| privacy | **No skip.** One CTA → guided (`privacy.tsx:66`), plus Previous. |
| guided | **This is the only real skip** — the "Explore" card (`guided.tsx:131-147` → `goExplore()` at `:69`) bypasses energy, features and the name step. |
| energy | **No skip** — Previous / Next only (`energy.tsx:145-146`). |
| features | **No skip** — Previous / Next only (`features.tsx:143-144`). |
| index (name) | **No skip**, but the name field may be left blank; `finish()` writes `userName: ''` (`index.tsx:70`). |

**What marks it complete — two separate flags, written in two different places:**

1. **`firstRunComplete`** (column `first_run_complete`) is written by **basics**, always,
   via the one atomic patch: `settingsPatchFromPicks()` returns
   `{...motion, ...handedness, language, darkMode, fontSize, startScreen, firstRunComplete: true}`
   (`lib/firstRunOptions.ts:196-208`), applied at `basics.tsx:119`. Skip and Continue are
   identical here.
2. **`setupComplete`** (column `setup_complete`) is written in exactly **two** places:
   - Explore path: `guided.tsx:76` — `settings.update({ setupComplete: true, lastMonthlyReset: todayStr() })`
   - Guided path: `index.tsx:69-77` — `{ userName, setupComplete: true, lastMonthlyReset: todayStr() }`

   Both then request notification permission if `taskNotificationsEnabled ||
   remindersEnabled`, call `syncReminders()` + `useTaskStore.syncAllTaskNotifications()`,
   and `router.replace('/')` (`guided.tsx:77-86`, `index.tsx:83-94`).

**Defaults that apply on the Explore path** (i.e. "skipped"): everything in
`defaultSettings` (`store/useSettingsStore.ts:585-680`) as amended by the migrations —
so `featureSharing` OFF, `featureAutomations` OFF, `showGrowth` OFF, `featureGoals` ON,
`featureMedicine` ON, `energySystemEnabled` ON, `userName` `''`, and the six basics values
as chosen (or as defaulted) on screen 1. Explore does **not** call
`usePeopleStore.publishSelfName()` — that only happens in `index.tsx:80` — so the
People-registry self row stays nameless on the Explore path.

**Force-quitting mid-flow** leaves `firstRunComplete = 1` but `setupComplete = 0`; on next
launch `app/_layout.tsx:472-474` redirects back to `/onboarding/basics` and the whole flow
runs again. Guards: `app/_layout.tsx:470-480` (redirect), `:510-511` (`routeSettled`
gate). Both gates are one-way and satisfied by skipping, so neither can trap a user.

---

### 7. The backdrop progress motif (`onboarding-triptych`)

Everything that computes position lives in **`/home/user/UnFocus/app/onboarding/_layout.tsx`**.
The motif geometry itself is generated data in `constants/motifs.ts:169` (`w: 1170,
h: 844`) — that file is generated by `scripts/build-motifs.mjs` and must not be hand-edited.

The exact chain, in order:

```ts
// _layout.tsx:58 — the step list, keyed by ROUTE SEGMENT
const STEPS = ['basics', 'restore', 'privacy', 'guided', 'energy', 'features', 'index'] as const;

// _layout.tsx:61-62 — panel arithmetic, derived from the generated motif dimensions
const TRIPTYCH_PANELS = MOTIFS['onboarding-triptych'].w / MOTIFS['screen-bg-calm'].w; // 1170/390 = 3
const TRAVEL_PANELS   = TRIPTYCH_PANELS - 1;                                          // = 2

// _layout.tsx:84-87 — index resolution + the position formula
const leaf = segments[segments.length - 1];
const found = STEPS.indexOf((leaf === 'onboarding' ? 'index' : leaf) as (typeof STEPS)[number]);
const stepIndex = found < 0 ? 0 : found;                       // unknown segment ⇒ 0, never throws
const progress  = STEPS.length > 1 ? stepIndex / (STEPS.length - 1) : 0;

// _layout.tsx:112 — the strip is rendered 3 screens wide
width: width * TRIPTYCH_PANELS

// _layout.tsx:115-118 — progress drives translateX
translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -width * TRAVEL_PANELS] })
```

**The single driving formula is therefore:**

```
translateX(step) = -(stepIndex / (STEPS.length - 1)) * 2 * screenWidth
```

with `screen-bg-calm.w` (390) as the panel unit and the motif's own `w` (1170) supplying
the panel count. Motion is `Animated.timing` at `Duration.card` / `Ease.move`
(`_layout.tsx:95-100`), snapped instead of animated when `reducedMotion` (`:91-93`).

**For the planned 7 → 5 screen cut:** there is **no per-screen position table and no
hard-coded offsets** — positions are fully derived. Removing two entries from `STEPS`
(`_layout.tsx:58`) is the *only* required change: the denominator becomes `4`, so each
step moves `2/4 = 0.5` panels instead of the current `2/6 ≈ 0.333`, and the last step still
lands exactly on the full-tree panel. `TRIPTYCH_PANELS`/`TRAVEL_PANELS` need no change
unless the SVG itself gains/loses a panel (in which case re-run `scripts/build-motifs.mjs`
rather than editing `constants/motifs.ts`).

Two traps to carry into the refactor:
- `STEPS` is matched on **route segment**, and the name step is matched as the literal
  `'index'` after remapping the leaf `'onboarding'` (`_layout.tsx:85`). A removed/renamed
  route that is not also removed from `STEPS` silently resolves to index 0 rather than
  erroring (`:86`).
- `STEPS` is a *second, parallel* declaration of the flow order. The authoritative order is
  the seven `router.push` literals listed in section 1. Nothing keeps the two in sync —
  no test asserts it (`lib/__tests__/motifs.test.ts` checks the *tab* backdrop panel order,
  not this one).

---

## 0.2 Teaching layers

Scope: the four teaching mechanisms that can fire at once on a fresh install — the ⓘ HintCard
(+ its first-visit auto-expand), the StarterCard empty-state explainer, the in-card
`CardHintNote` explainers on Home's preview cards, and the guided tour spotlight.

---

### 1. The ⓘ hint card and its first-visit auto-expand

#### 1a. `components/HintCard.tsx` — the card itself

| Line | What it is |
|---|---|
| `components/HintCard.tsx:77` | `export default function HintCard({ text, example, open: openProp, onToggle: onToggleProp, noPill, children })` |
| `:82` | `const [openInternal, setOpenInternal] = useState(false)` — **uncontrolled default is CLOSED**. |
| `:84–85` | `isControlled = openProp !== undefined`; `open = isControlled ? openProp : openInternal`. |
| `:87–91` | `toggle()` — runs `LayoutAnimation.configureNext(...)` unless `reducedMotion`, then either calls the controlled `onToggle` or flips internal state. |
| `:94–106` | **`noPill` (header-driven) branch** — renders *nothing* unless `openProp` is true; the body is mounted/unmounted by the parent. This is the branch all five tab screens use. |
| `:108–133` | **Pill branch** — a self-managed ⓘ + chevron button (`PressableScale`, `:110–120`) plus the body when `open` (`:121–130`). Used by the screens that do **not** go through `useFirstVisitHint` (scan, meals, notes, habit-form, health-form, health-log, and `app/goals.tsx`). |

`HintCard` itself contains **no first-visit logic at all** — it has no store access, no seen-flag,
no auto-open. Its file header (`:20–25`, `:37–40`) explicitly documents that the auto-open lives
in `lib/useFirstVisitHint.ts`.

#### 1b. `lib/useFirstVisitHint.ts` — the auto-expand (this is the piece that would change)

Full mechanism, line by line:

| Line | Behaviour |
|---|---|
| `lib/useFirstVisitHint.ts:45–59` | `useFirstVisitHint(key: string, autoOpen: boolean = true)` → returns `[boolean, setter]`, the same tuple shape a screen's header ⓘ toggle expects. |
| `:60` | `const [hintOpen, setHintOpen] = useState(false)` — the actual open state. |
| `:65–73` | `setHintOpenAnimated` — a `useMemo`-stable wrapper that calls `LayoutAnimation.configureNext(easeInEaseOut)` (skipped when `reducedMotion`) before **every** state flip: auto-open, blur-collapse and the header ⓘ toggle all route through it. |
| `:75–86` | `useFocusEffect(useCallback(...))` — **the trigger is SCREEN FOCUS**, not mount. It re-runs on every focus of that tab. |
| `:77` | `const { seenScreenHints, markScreenHintSeen } = useSettingsStore.getState();` — read via `getState()` deliberately, so unrelated settings changes don't re-run the effect. |
| `:78` | `if (!seenScreenHints.includes(key))` — **the "have we already done this" test**. This is the ONLY read of `seenScreenHints` anywhere in the app (see §2). |
| `:81` | `markScreenHintSeen(key)` — **the "never again" memory write**. Runs *regardless of `autoOpen`* (documented at `:79–80`). |
| `:82` | `if (autoOpen) setHintOpenAnimated(true);` — **THE AUTO-EXPAND. This single line is the whole automatic-opening behaviour.** |
| `:84` | `return () => setHintOpenAnimated(false);` — the focus-effect cleanup; **collapses the hint on blur** (leaving the tab). Not a persisted memory — it's a per-visit reset. |

**Precise answers to the planned-change questions:**

- **What triggers the auto-expand:** the `useFocusEffect` at `:75`, on the first focus of a screen
  whose `key` is absent from `settings.seenScreenHints` (`:78`), and only when the hook's second
  argument `autoOpen` is true (`:82`).
- **When it fires:** on screen focus (tab becomes active / screen mounts focused), not on app
  launch. Because `lazy: false` pre-mounts all five tab screens, it still waits for real focus —
  `useFocusEffect` is focus-driven, not mount-driven.
- **What collapses it:** (a) the focus-effect cleanup on blur, `:84`; (b) the user tapping the
  header ⓘ, which calls the same returned setter (`onInfoToggle={() => setHintOpen(v => !v)}` on
  each screen). There is no auto-timeout and no swipe-to-dismiss.
- **What "collapse forever" memory exists:** `settings.seenScreenHints` via `markScreenHintSeen`
  at `:81`. It is a *"has already auto-opened once"* flag — it does not remember a user-initiated
  collapse, and it does not hide the ⓘ button.

**Lines that would change to remove ONLY the automatic opening:**

1. **`lib/useFirstVisitHint.ts:82`** — delete `if (autoOpen) setHintOpenAnimated(true);`. That is
   the minimal, sufficient change. Everything else (the button, the content, the `markScreenHintSeen`
   memory) is untouched.
2. Consequential dead code, if the change is taken further:
   - `:46–58` the `autoOpen` parameter + its long doc comment, and `:85` its dependency entry.
   - The four call sites passing `false` become redundant: `app/(tabs)/plans.tsx:525`,
     `app/(tabs)/habits.tsx:546`, `app/(tabs)/health.tsx:112`, `app/goals.tsx:88`.
   - **`:78` and `:81` become the only remaining use of `seenScreenHints`, and it becomes
     write-only** — nothing would read the flag for any behaviour. See §2: after this change the
     entire `seenScreenHints` field/column is inert unless deliberately repurposed. This is the
     "collapse-forever memory" the brief says to keep, so it must be retained on purpose, not by
     accident.
3. **Do NOT touch** (these are the "button + content" the change preserves):
   - `components/HintCard.tsx` — all of it. The `noPill` body (`:94–106`) and the pill button
     (`:110–120`) are unaffected.
   - `components/ScreenHeader.tsx:316–330` — the header ⓘ button (`infoButton`), which is the
     manual toggle; plumbed through `components/ScreenScaffold.tsx:194–195, 276–277, 514–515`.
   - `lib/useFirstVisitHint.ts:84` — blur collapse (behaviour is unchanged either way, since the
     hint would simply already be closed).

#### 1c. Every `useFirstVisitHint` call site

| Screen | Line | Key | `autoOpen` |
|---|---|---|---|
| `app/(tabs)/index.tsx:192` | Home | `'home'` | **true (default)** |
| `app/(tabs)/shopping.tsx:457` | Shopping | `'shopping'` | **true (default)** |
| `app/(tabs)/plans.tsx:525` | To-do/Plans | `'plans'` | `false` |
| `app/(tabs)/habits.tsx:546` | Habits | `'habits'` | `false` |
| `app/(tabs)/health.tsx:112` | Health | `'health'` | `false` |
| `app/goals.tsx:88` | Goals (sub-screen) | `'goals'` | `false` |

Rationale recorded at `lib/useFirstVisitHint.ts:47–57`: Home and Shopping keep auto-open because
their hint body is the **only** place a real setup control lives —
`app/(tabs)/index.tsx:595–625` embeds the task-notifications + weekly-reminders switches inside
`HintCard`'s `children`, and `app/(tabs)/shopping.tsx:1477–1526` embeds the weekly-reset weekday
picker + monthly reset-date input. Removing the auto-open therefore strands those two controls
behind an ⓘ nobody necessarily taps — that is the concrete regression risk of the planned change.

The `HintCard` mount points (all `noPill`, `open={hintOpen}`):
`app/(tabs)/index.tsx:595`, `app/(tabs)/plans.tsx:844`, `app/(tabs)/shopping.tsx:1477`,
`app/(tabs)/habits.tsx:679`, `app/(tabs)/health.tsx:220`.
`app/goals.tsx:142` is the odd one out — `{hintOpen && <HintCard … />}` with the **pill** variant
(no `noPill`), so it renders its own pill button *inside* the conditionally-mounted card.

Other `HintCard` users with **no** first-visit logic at all (pure pill, always collapsed):
`app/scan.tsx`, `app/meals.tsx`, `app/notes.tsx`, `app/habit-form.tsx`, `app/health-form.tsx`,
`app/health-log.tsx` (per `components/HintCard.tsx:12–15`).

---

### 2. Where "first visit" is persisted

**One field, keyed per screen** — not one flag, and not one row per screen.

- **Settings field:** `seenScreenHints: string[]` — `store/useSettingsStore.ts:295`
  (type declared, with the explanatory comment at `:292–294`).
- **DB column:** `settings.seen_screen_hints`, `TEXT DEFAULT ''` — migration at
  `lib/db.ts:613` (comment `:609–612`). Single-row `settings` table (`id = 1`).
- **Storage format:** **JSON array of strings**, e.g. `["home","shopping"]`.
  - Write: `store/useSettingsStore.ts:558` — `seenScreenHints: { col: 'seen_screen_hints', to: (v) => JSON.stringify(v) }`.
  - Read: `store/useSettingsStore.ts:470` — `readJson<string[]>(row, 'seen_screen_hints', [])`.
  - (Contrast with `tourProgress`, which is a **comma-separated** string, not JSON — §4.)
- **Default:** `store/useSettingsStore.ts:643` — `seenScreenHints: []`.

**Every read site (behavioural):**
1. `lib/useFirstVisitHint.ts:78` — `seenScreenHints.includes(key)`. **This is the only one.**
2. `store/useSettingsStore.ts:470` — hydration from the DB row.
3. `store/useSettingsStore.ts:717` — the idempotence guard inside `markScreenHintSeen`.

**Every write site:**
1. `store/useSettingsStore.ts:715–725` — `markScreenHintSeen(key)`: no-ops if already present
   (`:717`), otherwise appends and persists via
   `updateRow('settings', rowValues({ seenScreenHints }, SETTINGS_COLUMNS), 'id = 1')` (`:720`).
   Declared on the store type at `:410`.
2. Called from exactly one place: `lib/useFirstVisitHint.ts:81`.
3. The generic `settings.update()` path can also write it (it's in `SETTINGS_COLUMNS` at `:558`),
   but **no caller does** — grep finds no `update({ seenScreenHints … })` anywhere.

**Not cleared by anything.** Settings → "Reset onboarding" (`app/settings.tsx:1058–1069`) only
sets `setupComplete: false` and routes to `/onboarding/basics`; it does **not** clear
`seenScreenHints` (nor `tourProgress`). So re-running onboarding does not bring the first-visit
hints back. There is no factory-reset path that touches the column.

Also of note: `PREFERENCES.md:219` records that the older `showHints` setting is now inert —
`seenScreenHints` replaced it.

Keys in use: `'home'`, `'plans'`, `'shopping'`, `'habits'`, `'health'`, `'goals'` (six).
There is **no** central list/enum of these keys — each screen passes its literal.

---

### 3. `components/StarterCard.tsx` and its empty/non-empty conditions

**The component:** `components/StarterCard.tsx:81–105`. Props: `text` (already-localized),
`example` (a ReactNode — normally `components/StarterExampleRow`), `children` (action slot),
`compact`. It is a **neutral-bordered** `Surface` (`:85`, `borderColor={theme.border}`) with an
`empty-branch` motif watermark (`:90–92`), a bulb glyph + italic text (`:93–96`), the example block
(`:97–101`) and the children slot (`:102`). It has **no state and no store access** — the caller
owns the condition entirely. The header (`:15–19`) states the deliberate visual contrast with
`HintCard` precisely because both can be on screen on a first visit.

**Every render site and its exact condition:**

| File:line | Condition (verbatim) | Notes |
|---|---|---|
| `app/(tabs)/plans.tsx:859–874` | `{(tasks.length === 0 \|\| planStarterAdded) && !(tab === 'today' && layoutSpec.timeline) && (` | **NOT a plain `length === 0`.** Two extra terms: `planStarterAdded` (state at `:537`) keeps the card mounted for the rest of the visit after its "+" is pressed, and the `timeline` term suppresses it on Today's timeline layout because `PlanTaskCard` already draws its own explainer there (comment `:846–858`). |
| `app/(tabs)/health.tsx:231–247` | `{(logs.length === 0 \|\| healthStarterAdded) && (` | `healthStarterAdded` state at `:120`. Gated on the WHOLE log being empty, not this week's. |
| `app/(tabs)/habits.tsx:738 / 750–775` | outer `visibleHabits.length === 0 ?` then inner `profileHabits.length === 0 ?` | Two kinds of empty. StarterCard only on the inner branch (no habits at all); the "none due today" branch gets a plain one-liner Surface (`:778–782`). No `example` row — its `children` are two one-tap starter chips (`:757–774`). |
| `app/(tabs)/shopping.tsx:1539–1541` | `{lists.length === 0 && items.length === 0 && (` | **Two conditions AND-ed**, deliberately not `monthlyLists` (a seeded empty monthly list means that count is never 0 — comment `:1533–1538`). Text-only, no example rows. |
| `app/goals.tsx:144–164` | `{goals.length === 0 ? (` | Plain `length === 0`. `children` = starter goal chips. |
| `components/GoalsSheet.tsx:110–130` | `{goals.length === 0 ? (` | Plain `length === 0`, inside the goal-picker sheet. |
| `components/MedicineTrayCard.tsx:205` | `{medicines.length === 0 && <StarterCard text={t.starters.medicine.text} compact />}` | The only `compact` caller; sits inside the Health tab's Medicine card. |

So **AGENTS.md's "every caller gates it on a plain `length === 0`" is now inaccurate for three of
seven callers** — plans and health add an `|| …StarterAdded` sticky term (2026-07-31), plans adds a
layout suppression term, shopping AND-s two collections, and habits gates on `profileHabits` rather
than the `visibleHabits` it is rendered in place of. `components/StarterCard.tsx:9–13` documents
the exception; the AGENTS.md prose does not.

#### 3a. The two Home preview cards that explain INLINE, without a StarterCard wrapper

Both use `components/CardHintNote.tsx` (a borderless one-line note) rendered at the **foot of the
card**, deliberately not a `StarterCard` — `components/CardHintNote.tsx:36` states the reason
("a StarterCard is a bordered Surface for an empty SCREEN"; a Surface inside a Surface reads as a
nested panel).

| File:line | Condition | Difference from StarterCard callers |
|---|---|---|
| `components/PlanTaskCard.tsx:1186` — `{showEmpty ? <CardHintNote text={t.starters.plans.text} noBorder /> : null}` | `showEmpty` defined at `:880`: **`pendingCount === 0 && doneTasks.length === 0`** (`pendingCount` at `:511` = `anytimePending.length + timedPending.length`) | Not `tasks.length === 0` at all — it is *this day's* view being empty. A user with 200 tasks still sees it on an empty day. Also has no "sticky after add" term, so it does vanish the instant a task is added. |
| `components/PlanTaskCard.tsx:997–1017` | same `showEmpty`, plus `onAddExample ?` (`:1007`) | The suggested-add `StarterExampleRow` sits *where the content would be* (`:1008–1016`), while the explainer sits at the card foot (`:1186`) — split across the card, unlike StarterCard which bundles them. |
| `components/HomeShoppingCard.tsx:436` — `{totalCount === 0 ? <CardHintNote text={t.starters.shopping.text} noBorder /> : null}` | `totalCount = progress.total` (`:197`) | Counts **items in the current week's list**, not lists-and-items globally like `app/(tabs)/shopping.tsx:1539`. Uses the one-line `t.starters.shopping.text` where the Shopping tab uses the two-line `textWeekly`/`textMonthly` split. No example row at all. |

Third, same pattern, worth listing for completeness:
`components/HomeHabitsCard.tsx:322` — `{habits.length === 0 ? <CardHintNote text={t.starters.habits.text} noBorder /> : null}`,
with starter chips at `:266–291` on the same `habits.length === 0` gate and a separate
`dueTodayHabits.length === 0` branch at `:292`.

And the permanent exception: `components/EnergyMeter.tsx:384` renders
`<CardHintNote text={t.energyMeter.hint} />` **unconditionally** — it never disappears (header
`:20`, comment `:380–383`).

---

### 4. The guided tour: controller, steps, persistence

**Step definitions — `lib/tourSteps.ts` (dependency-free, no store/i18n/notifications):**
- `TourStep` type at `:38–45`: `{ id, route, targetId }`. `id` is the stable persisted key,
  `route` is the tab path so the tour can navigate itself, `targetId` must match a
  `<TourTarget id=…>`.
- `TOUR_STEPS` at `:51–57` — exactly five, in order:
  `home → /` (`tour.home.today`), `plans → /plans` (`tour.plans.list`),
  `shopping → /shopping` (`tour.shopping.list`), `habits → /habits` (`tour.habits.list`),
  `health → /health` (`tour.health.log`).
- `TOUR_DISMISSED = 'dismissed'` sentinel at `:60`.
- Pure helpers: `parseProgress` `:72–80`, `formatProgress` `:83–85`, `isTourComplete` `:88–91`,
  `nextStep` `:100–103`, `stepPosition` `:106–108`.
- Copy lives at `t.tour.steps[<id>]` in `lib/i18n.ts` (from ~`:462`), keyed by step id.

**Persistence — `settings.tourProgress`:**
- Field: `store/useSettingsStore.ts:397` (`tourProgress: string`).
- Column: `settings.tour_progress TEXT DEFAULT ''`, migration `lib/db.ts:1034`, immediately
  followed by the back-fill `lib/db.ts:1035` — `UPDATE settings SET tour_progress = 'dismissed'
  WHERE setup_complete = 1`, so the tour only ever greets a genuinely new install.
- Format: **comma-separated set of ids** (not JSON — different from `seenScreenHints`), sorted on
  write (`lib/tourSteps.ts:83–85`). Read `store/useSettingsStore.ts:496`, write map `:579`,
  default `''` at `:674`.
- Read sites: `components/TourSpotlight.tsx:88` (+`:92`), `components/TourTarget.tsx:88` (+`:94`).
- Write sites: `components/TourSpotlight.tsx:149` (`record`) and `:158` (`dismissAll`) — both via
  `settings.update({ tourProgress: formatProgress(next) })`.

**Skip vs complete — they are literally the same write:**
`components/TourSpotlight.tsx:267–268`:
```
<Button label={t.tour.skipStep} onPress={() => record(step.id)} … />
<Button label={t.tour.next}     onPress={() => record(step.id)} … />
```
Both call `record(step.id)` (`:144–152`), which adds the id to the set. A skipped step and a
completed step are therefore **indistinguishable** by design (`lib/tourSteps.ts:12–16`, `:96–98`).
"Skip the tour" (`:270`) calls `dismissAll` (`:154–159`), adding the `'dismissed'` sentinel.

**What triggers the tour to start / render:**
- `components/TourSpotlight.tsx` is mounted **once**, at `app/(tabs)/_layout.tsx:494` (imported
  `:197`), above the pager and bottom nav.
- Gate at `:173`: `if (!setupComplete || dismissed) return null;` — so the tour begins the moment
  onboarding sets `settings.setupComplete` (from `app/onboarding/index.tsx`'s finish or
  `app/onboarding/guided.tsx`'s Explore path) and `tourProgress` is still `''`.
- `step = nextStep(done)` (`:93`) picks the first not-yet-recorded step; the effect at `:114–120`
  calls `router.navigate(step.route)` — **the tour drives navigation itself**, so it is what
  causes the user's first visit to Shopping/Habits/Health.
- `showFinale` at `:96` (all steps done, not dismissed) renders the closing card `:176–201` — the
  "experimental build" note and the AI setup guide download.
- Render gate at `:203`: `if (!step || !rect) return null;` — the rect must exist AND pass the
  on-screen test at `:108` (`raw.x > -width/2 && raw.x < width*1.5`), because `lazy: false`
  pre-mounts all five screens and all five targets measure immediately.
- The "hole" is four dim rects (`:224–232`) plus an outline ring (`:238–250`) — the card
  underneath stays **live and tappable**.

**Targets — `components/TourTarget.tsx`:** module-level registry (`:57–75`), `running` derived
internally at `:91–96` (never passed per-screen), `measureInWindow` at `:102–108`, re-measure on
focus + a delayed second pass at `:126–133`. Mount sites, one per screen:
`app/(tabs)/index.tsx:518` (wraps Home's **Plans preview card**),
`app/(tabs)/plans.tsx:990` (the day-view section),
`app/(tabs)/shopping.tsx:1599` (wraps only the **Food/Catalogue link row**, not the list — comment
`:1595–1598` explains a hole around the whole screen highlights nothing),
`app/(tabs)/habits.tsx:688` (the habits section),
`app/(tabs)/health.tsx:259` (the Quick log card).

---

### 5. Overlap analysis — what fires simultaneously on a first visit with no content

The key structural fact: **the tour navigates the user to each tab itself**
(`components/TourSpotlight.tsx:114–120`). So on a fresh install the user's *first visit* to
Plans/Shopping/Habits/Health happens **while the tour spotlight is already on screen**. The
first-visit ⓘ auto-expand and the StarterCard are therefore not "later" layers — they render
underneath the tour's dim/hole on the very same frame.

Per screen, fresh install, no content:

| Screen | ⓘ auto-expand | StarterCard | Inline `CardHintNote` explainer | Tour spotlight | Layers at once |
|---|---|---|---|---|---|
| **Home** (`index`) | **YES** — `index.tsx:192`, `autoOpen` default true. Hint body carries two live setting switches (`:595–625`) | no StarterCard on Home | **YES ×3** — `PlanTaskCard.tsx:1186`, `HomeShoppingCard.tsx:436`, `HomeHabitsCard.tsx:322`, plus `EnergyMeter.tsx:384` (permanent) and `PlanTaskCard.tsx:1008` suggested-add row | **YES** — step 1, ringing the Plans preview card (`index.tsx:518`) | **THREE (arguably five distinct explainer blocks)** |
| **Shopping** | **YES** — `shopping.tsx:457`, default true. Hint body carries the weekly-reset weekday + monthly reset-date controls (`:1477–1526`) | **YES** — `shopping.tsx:1539` (`lists.length === 0 && items.length === 0`) | — | **YES** — step 3, ringing the Food/Catalogue links (`:1599`) | **ALL THREE** |
| **To-do / Plans** | no (`plans.tsx:525`, `autoOpen=false`) | **YES** — `plans.tsx:859`, unless Today is on the timeline layout | **YES if** Today is on the timeline layout — then `PlanTaskCard`'s own explainer replaces the screen-level StarterCard (mutually exclusive by construction) | **YES** — step 2 (`:990`) | **TWO** |
| **Habits** | no (`habits.tsx:546`) | **YES** — `habits.tsx:750`, with two one-tap starter chips | — | **YES** — step 4 (`:688`) | **TWO** |
| **Health** | no (`health.tsx:112`) | **YES ×2** — screen-level `health.tsx:231` **and** the compact one inside the Medicine card, `MedicineTrayCard.tsx:205` | — | **YES** — step 5 (`:259`) | **TWO layers, three cards** |
| **Goals** (sub-screen) | no (`goals.tsx:88`) | **YES** — `goals.tsx:144` | — | no tour step | ONE |

**Screens that show all three named layers at once: Shopping, and Home.**

- **Shopping is the unambiguous case**: the auto-expanding ⓘ (with two setup controls inside it),
  the `StarterCard` two-line weekly/monthly explainer directly beneath it, and the tour's step-3
  spotlight dimming everything except the Food/Catalogue link row — which means **both the hint
  and the StarterCard are rendered under the tour's dim scrim, greyed out and un-highlighted, at
  the exact moment they auto-open.** The hint's embedded reset-day/reset-date controls are
  inside that dimmed region and are not the thing the spotlight is pointing at.
- **Home is the same shape with a different third layer**: auto-expanding ⓘ + tour step 1 +
  three separate inline `CardHintNote` explainers (Plans/Shopping/Habits previews) rather than a
  StarterCard. Counting the permanent `EnergyMeter` hint and the `StarterExampleRow` suggested-add
  row, a first-visit Home can carry five distinct teaching blocks under the tour scrim.
- Plans / Habits / Health max out at two (StarterCard + spotlight) — this is the deliberate result
  of the 2026-07-28 pass that set `autoOpen=false` on exactly those three
  (`lib/useFirstVisitHint.ts:47–57`, and the matching comments at `plans.tsx:522–524`,
  `habits.tsx:544–545`, `health.tsx:110–111`). Home and Shopping were exempted *only* because
  their hint body is load-bearing, not because the stacking was judged acceptable there.

**Implication for the planned change:** removing `lib/useFirstVisitHint.ts:82` reduces Home and
Shopping from three layers to two, matching the other three tabs — but it also removes the only
automatic surfacing of the notification/reminder switches (Home) and the weekly/monthly reset
controls (Shopping), which have no other home in the app. `settings.seenScreenHints` becomes
write-only at that point.

---

## 0.3 Colour

**Scope note.** Everything below is read-only observation of the tree at
`/home/user/UnFocus` (2026-07-31). All paths absolute. Line numbers are from the
files as they stand now.

### 0.3.0 Where colour actually lives — the four layers

| Layer | File | What it holds |
|---|---|---|
| Raw palette (closed token set, light + dark) | `/home/user/UnFocus/constants/colors.ts` | `ThemePalette` interface (L37–120), `defaultLight` (L156–286), `defaultDark` (L288–366), `THEMES` registry (L370), `getThemePalette()` (L378), `contrastRatio()` (L148) |
| Derivation helpers (no colour values except two constants) | `/home/user/UnFocus/constants/theme.ts` | `lighten`/`darken`/`mix`/`rgba`/`contrastOn` (L75–122), `DARK_TEXT = '#1E293B'` (L110), `computeRimGradient()` (L498), `getMaterialStyle()` (L537), `getGlow()` (L621), `getLayeredShadow()` (L641) |
| Screen-hue mapping | `/home/user/UnFocus/lib/screenColor.ts` | `SCREEN_TOKEN` map (L37–44), `getScreenColor()` (L57), `ScreenColorContext` (L67), `useScreenColor()` (L70) |
| Card-identity mapping | `/home/user/UnFocus/lib/domainColor.ts` | `CARD_BADGE_DEEP = '#1E3A8A'` (L57), `Domain` type (L59), `DomainTriad` (L69), `DOMAIN_TOKEN` map (L88–97), `getDomainColor()` (L100), `RowStatus` (L111), `getStatusColor()` (L117) |

Two further colour channels exist and are **not** part of either family under
audit, but overlap them visually and are worth naming so a refactor doesn't
mistake one for the other:

- `/home/user/UnFocus/lib/personColor.ts` — `PERSON_PALETTE` (L48–55), six flat
  hexes, no light/dark variants (deliberate: the hex is persisted + synced).
- `/home/user/UnFocus/components/FoodTab.tsx` — `MEAL_COLORS` (L105–111), a
  private five-hue meal palette that **bypasses the `card*` ramp entirely**.
  `dinner: '#D9825A'` is byte-identical to `cardMeal` light; the other four are
  unique to this file.

---

### 0.3.1 Screen hues — the `feat*` family

**Real token names are `featPlan / featTask / featHabit / featHealth / featMeal /
featShop / featBudget / featNote / featScan`** — nine, not the eight in the audit
request. The request's "indigo/blue/sky/teal/orange/green/amber/yellow/violet"
list is exactly right as a description of the hues; the names are `feat*`, not
colour words.

#### Definition site + exact values

Declared: `/home/user/UnFocus/constants/colors.ts` L76–84 (interface).
Light values: L216–228. Dark values: L323–333.

| Token | Described as | Light hex | Dark hex | Routine-sequence slot |
|---|---|---|---|---|
| `featPlan` | indigo | `#6E74EE` | `#8A90FF` | 1 · plan the day |
| `featTask` | blue | `#4C8DF0` | `#6BA5FF` | 2 · do tasks |
| `featHabit` | sky | `#22A7E0` | `#4CC3F5` | 3 · keep habits |
| `featHealth` | teal | `#17BEB0` | `#2DD4C4` | 4 · track health (kept off `bad` red) |
| `featMeal` | orange | `#E88A52` | `#F09763` | 5 · eat |
| `featShop` | green | `#3DAF6F` | `#50C68C` | 6 · shop |
| `featBudget` | amber | `#D69420` | `#EAB84C` | 7 · money |
| `featNote` | yellow | `#E6BC1C` | `#FBD24B` | 8 · reflect / note |
| `featScan` | violet | `#9B72E3` | `#BE9DF7` | (screen hue only, no domain bubble) |

#### Route → token mapping

`/home/user/UnFocus/lib/screenColor.ts` L37–44:

| Route | Token | Hue |
|---|---|---|
| `shopping` | `featShop` | green |
| `plans` | `featPlan` | indigo |
| `index` (Home) | `featTask` | blue |
| `home` (alias of `index`) | `featTask` | blue |
| `health` | `featHealth` | teal |
| `habits` | `featScan` | violet (inherited from the retired Scan tab slot) |

Unmapped routes fall back to `theme.accent` (`screenColor.ts` L59). **Four tokens
are therefore never reachable through `getScreenColor` at all:** `featHabit`,
`featMeal`, `featBudget`, `featNote` — they survive only via the three direct
call sites listed below.

`ScreenHue.soft` (`screenColor.ts` L50, `rgba(base, 0.14)`) has **zero production
consumers** — only `/home/user/UnFocus/lib/__tests__/screenColor.test.ts:41`
reads it.

#### COMPLETE consumer map — screen hues

**A. Direct `theme.feat*` reads (production code) — 6 lines in 3 files**

| File | Line | Token | Use |
|---|---|---|---|
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 1672 | `featBudget` | `borderColor` of the budget pill (outline) |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 1679 | `featBudget` | Ionicons `wallet-outline` colour (icon) |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 1680 | `featBudget` | budget-pill label (text) |
| `/home/user/UnFocus/app/scan.tsx` | 609 | `featShop` | action-row icon colour (`images-outline`) |
| `/home/user/UnFocus/app/scan.tsx` | 610 | `featBudget` | action-row icon colour (`pencil-outline`) |
| `/home/user/UnFocus/components/NoteRow.tsx` | 129 | `featShop` | `cart-outline` icon colour |
| `/home/user/UnFocus/components/NoteRow.tsx` | 137 | `featTask` | `checkbox-outline` icon colour |

(That is 7 rows / 6 distinct statements — `shopping.tsx` 1679+1680 sit in the same pill.)

**B. Indirect — `getScreenColor()` call sites (the whole per-tab hue system)**

| File | Line | Call |
|---|---|---|
| `/home/user/UnFocus/app/(tabs)/habits.tsx` | 113 (import), 668 | `getScreenColor(theme, 'habits').base` → `<ScreenScaffold screenColor=…>` |
| `/home/user/UnFocus/app/(tabs)/health.tsx` | 101 (import), 215 | `getScreenColor(theme, 'health').base` |
| `/home/user/UnFocus/app/(tabs)/index.tsx` | 143 (import), 589 | `getScreenColor(theme, 'index').base` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 169 (import), 829 | `getScreenColor(theme, 'plans').base` |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 416 (import), 1590 | `getScreenColor(theme, 'shopping').base` |

**C. The context plumbing (2 files, and the only place the hue is *rendered*)**

| File | Line | Use |
|---|---|---|
| `/home/user/UnFocus/components/ScreenScaffold.tsx` | 148 (import), 244 (`screenColor?` prop), 285, 486–488 | wraps the scroll body in `ScreenColorContext.Provider` |
| `/home/user/UnFocus/components/Surface.tsx` | 91 (import), 213 (`useScreenColor()`), 226 (`edgeHue = borderColor ?? tint ?? (glass && screenHue ? screenHue : theme.border)`) | **the screen hue's only visual output: the beveled rim gradient of every un-domain-coded `Surface` on a tab screen** |

So: `Surface.tsx:226` is the single line through which the entire `feat*` family
reaches pixels for four of the five tabs. Everything else is a 7-line tail.

**D. Test-only consumers (not production, but will break on a rename)**

- `/home/user/UnFocus/lib/__tests__/screenColor.test.ts` L17–21, 26, 30, 35–37, 41
- `/home/user/UnFocus/lib/__tests__/colors.test.ts` L27 (token-presence list), L148 (`k.startsWith('feat')` contrast loop)
- `/home/user/UnFocus/lib/__tests__/domainColor.test.ts` L42 (`…not.toBe(theme.featShop)`)

**E. Stale reference worth flagging**

`/home/user/UnFocus/app/scan.tsx:19` lists `lib/screenColor` in its `Imports →`
header block, but the file has **no such import** any more. The header is stale.

**Screen-hue family total: 10 production files.**

---

### 0.3.2 Card identity hues — the `card*` family

Real token names: **`cardPlan / cardTask / cardHabit / cardHealth / cardMeal /
cardShop / cardBudget / cardNote / cardScan`** — nine. The audit request's
"teal-blue/indigo/moss/coral/terracotta/rose-mauve/sage-olive/violet" is eight
of them; the missing ninth is `cardScan` (blue-violet), which is **defined but
has no `Domain` mapping and therefore zero consumers** (`Domain` in
`domainColor.ts` L59–67 has no `'scan'` member).

#### Definition site + exact values

Declared: `/home/user/UnFocus/constants/colors.ts` L91–99 (interface).
Light values: L254–265. Dark values: L338–346 (each light stop lightened ~0.20, hue preserved).

| Token | Domain it owns | Hue angle | Light hex | Dark hex | Description |
|---|---|---|---|---|---|
| `cardPlan` | `plan` | h195 | `#3789A6` | `#5FA1B8` | teal-blue |
| `cardTask` | `task` | h233 | `#4E62C8` | `#7181D3` | indigo |
| `cardHabit` | `habit` | h128 | `#2E943B` | `#57A862` | moss green (moved off h185 teal on 2026-07-30) |
| `cardHealth` | `health` | h350 | `#C4667A` | `#D08595` | muted coral — deliberately NOT `bad` red |
| `cardMeal` | `meal` | h18 | `#D9825A` | `#E19B7B` | terracotta (same hex as FoodTab's `dinner`, on purpose) |
| `cardShop` | `shop` | h330 | `#BC6494` | `#C983A9` | rose-mauve |
| `cardBudget` | `budget` | h100 | `#7C9B55` | `#96AF77` | sage-olive — deliberately NOT `good` green |
| `cardNote` | `note` | h278 | `#8A5EC5` | `#A17ED1` | violet |
| `cardScan` | *(none — unmapped)* | h258 | `#6A5FC9` | `#887FD4` | blue-violet |

Derived values (`/home/user/UnFocus/lib/domainColor.ts` L100–109), all computed
from the token, none stored:

- `accent` = the raw token hex
- `soft` = `rgba(accent, 0.14)`
- `ink` = `contrastOn(accent)`
- `washTop` = `mix(theme.surface, accent, 0.22)` ← **the "header wash" stop**
- `badgeGradient` = `[accent, mix(accent, CARD_BADGE_DEEP /* #1E3A8A */, 0.35)]`

Domain→token map: `/home/user/UnFocus/lib/domainColor.ts` L88–97.

`budget` is a live `Domain` but has **no `getDomainColor(theme, 'budget')` call
anywhere** — `cardBudget` reaches pixels through no path at all. `cardScan` and
`cardBudget` are therefore both dead stops in the ramp.

#### COMPLETE consumer map — card identity hues

**A. `getDomainColor()` call sites — 18 files, 24 call expressions**

| File | Line | Domain | Bound to |
|---|---|---|---|
| `/home/user/UnFocus/app/(tabs)/habits.tsx` | 112 (import), 550 | `habit` | `habitDomainColor` |
| `/home/user/UnFocus/app/(tabs)/health.tsx` | 100 (import), 124 | `health` | `healthDomainColor` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 168 (import), 480 | `task` | `wheneverHue` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 481 | `meal` | `repeatingHue` (borrows the meal *token* only — the section has no meal identity; see its L474 note) |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 415 (import), 447 | `meal` | `mealDomainColor` |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 448 | `shop` | `shopDomainColor` |
| `/home/user/UnFocus/app/health-log.tsx` | 52 (import), 62 | `health` | `domainColor` |
| `/home/user/UnFocus/app/settings.tsx` | 252 (import), 1180 | `shop` | inline |
| `/home/user/UnFocus/components/CardAccent.tsx` | 58 (import), 97 | *(prop)* | `badgeGradient` |
| `/home/user/UnFocus/components/CardAccent.tsx` | 140 | *(prop)* | `washTop` |
| `/home/user/UnFocus/components/CatalogueTab.tsx` | 131 (import), 218 | `shop` | `domainColor` |
| `/home/user/UnFocus/components/FoodTab.tsx` | 80 (import), 120 | `meal` | `domainColor` |
| `/home/user/UnFocus/components/HomeHabitsCard.tsx` | 91 (import), 111 | `habit` | `domainColor` |
| `/home/user/UnFocus/components/HomeNotesCard.tsx` | 109 (import), 118 | `note` | `domainColor` |
| `/home/user/UnFocus/components/HomeShoppingCard.tsx` | 96 (import), 154 | `shop` | `domainColor` |
| `/home/user/UnFocus/components/MedicineTrayCard.tsx` | 65 (import), 99 | `health` | `healthColor` |
| `/home/user/UnFocus/components/PlanTaskCard.tsx` | 248 (import), 396 | `plan` | `domainColor` |
| `/home/user/UnFocus/components/SendToSheet.tsx` | 39 (import), 58 | `plan` | inline (icon colour) |
| `/home/user/UnFocus/components/SendToSheet.tsx` | 59 | `shop` | inline (icon colour) |
| `/home/user/UnFocus/components/SendToSheet.tsx` | 60 | `habit` | inline (icon colour) |
| `/home/user/UnFocus/components/SharedTasksSection.tsx` | 38 (import), 56 | `shop` | `hue` |
| `/home/user/UnFocus/components/SharedTasksSection.tsx` | 107 | `shop` | inline `.soft` |
| `/home/user/UnFocus/components/WeekListCard.tsx` | 154 (import), 293 | `shop` | `domainColor` |

**B. `domain=` prop consumers (reach the hue through `CardAccent` / `SectionCard`
/ `SectionRail` / `SubScreenLinkButton`) — 21 JSX sites**

| File | Line | Component | Domain |
|---|---|---|---|
| `/home/user/UnFocus/app/(tabs)/habits.tsx` | 836 | `SubScreenLinkButton` | `habit` |
| `/home/user/UnFocus/app/(tabs)/health.tsx` | 268 | `CardAccentBadge` | `health` |
| `/home/user/UnFocus/app/(tabs)/health.tsx` | 341 | `CardAccentBadge` | `health` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 926 | `SectionCard` | `task` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 952 | `SectionCard` | `meal` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 977 | `SectionCard` | `task` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 1083 | `SectionCard` | `task` |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | 1121 | `SubScreenLinkButton` | `task` |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 1569 | `CardAccentBadge` | `meal` |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 1581 | `CardAccentBadge` | `shop` |
| `/home/user/UnFocus/components/HomeHabitsCard.tsx` | 241 | `CardAccentWash` | `habit` |
| `/home/user/UnFocus/components/HomeHabitsCard.tsx` | 246 | `CardAccentBadge` | `habit` |
| `/home/user/UnFocus/components/HomeNotesCard.tsx` | 207 | `CardAccentWash` | `note` |
| `/home/user/UnFocus/components/HomeNotesCard.tsx` | 216 | `CardAccentBadge` | `note` |
| `/home/user/UnFocus/components/HomeShoppingCard.tsx` | 293 | `CardAccentWash` | `shop` |
| `/home/user/UnFocus/components/HomeShoppingCard.tsx` | 299 | `CardAccentBadge` | `shop` |
| `/home/user/UnFocus/components/MedicineTrayCard.tsx` | 189 | `CardAccentBadge` | `health` |
| `/home/user/UnFocus/components/PlanTaskCard.tsx` | 966 | `CardAccentWash` | `plan` (only when `readOnly`) |
| `/home/user/UnFocus/components/PlanTaskCard.tsx` | 974 | `CardAccentBadge` | `plan` |
| `/home/user/UnFocus/components/SharedTasksSection.tsx` | 93 | `SectionCard` | `shop` |
| `/home/user/UnFocus/components/WeekListCard.tsx` | 420 | `CardAccentBadge` | `shop` |

**C. Type-only importers of `Domain` (rename surface, no colour of their own)**

- `/home/user/UnFocus/components/SectionCard.tsx:46`
- `/home/user/UnFocus/components/SectionRail.tsx:42`
- `/home/user/UnFocus/components/SubScreenLinkButton.tsx:29`

**D. Test consumers**

- `/home/user/UnFocus/lib/__tests__/domainColor.test.ts` L11, 24, 33, 41, 43, 48, 55, 63–67
- `/home/user/UnFocus/lib/__tests__/colors.test.ts` L28, L148 (`k.startsWith('card')`)

**Card-identity family total: 21 production files** (18 with `getDomainColor` +
`SectionCard`, `SectionRail`, `SubScreenLinkButton` type-only).

---

### 0.3.3 Components that consume BOTH families

Six files, but only four of them are true dual consumers of the *hue values*:

| File | Screen-hue touch | Card-hue touch |
|---|---|---|
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | `getScreenColor` L416/1590 **and raw `theme.featBudget` L1672, 1679, 1680** | `getDomainColor` L415/447/448; `CardAccentBadge` L1569, 1581 |
| `/home/user/UnFocus/app/(tabs)/habits.tsx` | `getScreenColor` L113/668 | `getDomainColor` L112/550; `SubScreenLinkButton domain="habit"` L836 |
| `/home/user/UnFocus/app/(tabs)/health.tsx` | `getScreenColor` L101/215 | `getDomainColor` L100/124; `CardAccentBadge` L268, 341 |
| `/home/user/UnFocus/app/(tabs)/plans.tsx` | `getScreenColor` L169/829 | `getDomainColor` L168/480/481; `SectionCard`/`SubScreenLinkButton` L926, 952, 977, 1083, 1121 |
| `/home/user/UnFocus/app/(tabs)/index.tsx` | `getScreenColor` L143/589 | **none directly** — its child cards (`HomeShoppingCard`, `HomeNotesCard`, `HomeHabitsCard`, `PlanTaskCard`) each carry their own |
| `/home/user/UnFocus/components/Surface.tsx` | `useScreenColor()` L213 | receives a card hue as the `borderColor` prop from 8 callers | 

**`Surface.tsx` is the structural collision point.** Line 226 resolves the edge
hue in strict priority: `borderColor` (a card hue, passed by a domain-coded card)
→ `tint` → screen hue from context → `theme.border`. Both families arrive at the
same CSS property in the same expression. Any refactor that retires one family
has to reason about this line, not just about the token names.

`shopping.tsx` is the only file that reads a **raw `feat*` token** and a card hue
in the same render.

---

### 0.3.4 Identity-hue usage, categorised per consumer

Categories: **(a)** badge fill · **(b)** card edge/border · **(c)** header wash ·
**(d)** text colour · **(e)** icon colour · **(f)** other.

**Does a "header wash" actually exist? Yes.** `CardAccentWash`
(`/home/user/UnFocus/components/CardAccent.tsx` L137–156) renders a
`[washTop → theme.surface]` `LinearGradient` band pinned to the top 64px of a
card, `pointerEvents: 'none'`, corner-rounded to `radius - GLASS_EDGE_WIDTH`.
It has exactly **four** call sites (HomeHabitsCard 241, HomeNotesCard 207,
HomeShoppingCard 293, PlanTaskCard 966 — the last only in `readOnly` mode).

| File | Line | Category | Detail |
|---|---|---|---|
| `components/CardAccent.tsx` | 97–116 | **(a)** | `CardAccentBadge`: `badgeGradient` two-stop `LinearGradient` fill, white glyph, `rgba(255,255,255,0.55)` rim |
| `components/CardAccent.tsx` | 140–154 | **(c)** | `CardAccentWash`: `washTop → surface` gradient band |
| `app/(tabs)/habits.tsx` | 690 | **(b)** | `<Surface borderColor={habitDomainColor.accent}>` |
| `app/(tabs)/habits.tsx` | 767 | **(b)** | starter chip `borderColor` |
| `app/(tabs)/habits.tsx` | 769, 771 | **(e)** | `HabitIcon` + `add` glyph colour |
| `app/(tabs)/habits.tsx` | 803 | **(f)** | `AddRow accent=` → drives the "+" chip **fill** and the confirm-button fill (`AddRow.tsx` L105, 163, 226) |
| `app/(tabs)/habits.tsx` | 836 | **(a)** | `SubScreenLinkButton` → `CardAccentBadge` |
| `app/(tabs)/health.tsx` | 261, 337 | **(b)** | `<Surface borderColor={healthDomainColor.accent}>` ×2 |
| `app/(tabs)/health.tsx` | 268, 341 | **(a)** | `CardAccentBadge` ×2 |
| `app/(tabs)/health.tsx` | 276 | **(f)** | `AddRow accent=` (fill) |
| `app/(tabs)/health.tsx` | 405 | **(e)** | `document-text-outline` icon |
| `app/(tabs)/plans.tsx` | 868, 943 | **(f)** | `AddRow accent={wheneverHue}` (fill) |
| `app/(tabs)/plans.tsx` | 926, 952, 977, 1083 | **(b)** + **(a)** + **(d)** | `SectionCard hue=` → `Surface borderColor` (b), `SectionRail` dot fill / domain badge (a), `mix(hue, text, 0.3)` label (d), `rgba(hue, 0.25)` header rule (f) |
| `app/(tabs)/plans.tsx` | 937 | **(b)** | `borderLeftColor: wheneverHue` on the add-row card |
| `app/(tabs)/plans.tsx` | 1121 | **(a)** | `SubScreenLinkButton domain="task"` |
| `app/(tabs)/shopping.tsx` | 1565, 1580 | **(b)** | `<Surface borderColor={mealDomainColor.accent / shopDomainColor.accent}>` |
| `app/(tabs)/shopping.tsx` | 1569, 1581 | **(a)** | `CardAccentBadge` ×2 |
| `app/(tabs)/shopping.tsx` | 1892 | **(f)** | 4px `unallocatedAccent` bar — `backgroundColor` (a solid rail, not a badge) |
| `app/health-log.tsx` | 120 | **(b)** | `Surface borderColor` |
| `app/health-log.tsx` | 126 | **(f)** | `AddRow accent=` (fill) |
| `app/settings.tsx` | 1180 | **(f)** | `ExpandableCard accentColor=` → a left accent **bar** fill (`ExpandableCard.tsx` L126) |
| `components/CatalogueTab.tsx` | 472 | **(f)** | `AddRow accent=` (fill) |
| `components/FoodTab.tsx` | 569 | **(f)** | `AddRow accent=` (fill) |
| `components/HomeHabitsCard.tsx` | 189, 306, 317 | **(f)** | `AddRow`/`PadTypeRow` accent (fill) |
| `components/HomeHabitsCard.tsx` | 193, 195, 259, 285, 287 | **(e)** | check / habit / chevron / starter icons |
| `components/HomeHabitsCard.tsx` | 214 | **(f)** | `adjBtnPlus` solid `backgroundColor` (button fill) |
| `components/HomeHabitsCard.tsx` | 235 | **(b)** | `Surface borderColor` |
| `components/HomeHabitsCard.tsx` | 241, 246 | **(c)**, **(a)** | wash + badge |
| `components/HomeHabitsCard.tsx` | 283 | **(b)** | starter chip `borderColor` |
| `components/HomeNotesCard.tsx` | 202 | **(b)** | `Surface borderColor` |
| `components/HomeNotesCard.tsx` | 207, 216 | **(c)**, **(a)** | wash + badge |
| `components/HomeNotesCard.tsx` | 239 | **(f)** | mic pill `backgroundColor: domainColor.soft` (soft fill) |
| `components/HomeNotesCard.tsx` | 240, 281 | **(b)** | pill / chip `borderColor` |
| `components/HomeNotesCard.tsx` | 247, 297 | **(e)** | mic + toggle icon colour |
| `components/HomeNotesCard.tsx` | 282 | **(f)** | chip `backgroundColor: domainColor.soft` |
| `components/HomeNotesCard.tsx` | 261, 327, 341, 364 | **(f)** | `AddRow`/`PadTypeRow`/`PadRow` accent (fill) |
| `components/HomeShoppingCard.tsx` | 261, 379, 403, 429 | **(f)** | `PadTypeRow`/`AddRow`/`PadRow` accent (fill) |
| `components/HomeShoppingCard.tsx` | 266 | **(b)** | target chip `borderColor` |
| `components/HomeShoppingCard.tsx` | 276 | **(e)** | target chip icon |
| `components/HomeShoppingCard.tsx` | 278, 316 | **(d)** | target chip label + badge count **text** |
| `components/HomeShoppingCard.tsx` | 290 | **(b)** | `Surface borderColor` |
| `components/HomeShoppingCard.tsx` | 293, 299 | **(c)**, **(a)** | wash + badge |
| `components/HomeShoppingCard.tsx` | 314 | **(f)** | badge `backgroundColor: domainColor.soft` + `rgba(accent,0.4)` border |
| `components/HomeShoppingCard.tsx` | 328, 343 | **(f)** | `tint={domainColor.accent}` on a nested surface |
| `components/HomeShoppingCard.tsx` | 348 | **(f)** | `ProgressBar color=` (bar fill) |
| `components/MedicineTrayCard.tsx` | 183 | **(b)** | `Surface borderColor` |
| `components/MedicineTrayCard.tsx` | 189 | **(a)** | `CardAccentBadge` |
| `components/MedicineTrayCard.tsx` | 385 | **(b)** | PRN button `borderColor` |
| `components/MedicineTrayCard.tsx` | 392 | **(e)** | PRN button icon |
| `components/MedicineTrayCard.tsx` | 436 | **(f)** | `AddRow accent=` (fill) |
| `components/PlanTaskCard.tsx` | 690 | **(f)** | follower badge `backgroundColor: domainColor.soft` |
| `components/PlanTaskCard.tsx` | 691 | **(d)** | follower badge **text** |
| `components/PlanTaskCard.tsx` | 731, 773, 909, 936 | **(b)** | row / chip borders (`rgba(accent, 0.2/0.5)` and solid) |
| `components/PlanTaskCard.tsx` | 778 | **(f)** | `GlowPulse color=` (halo) |
| `components/PlanTaskCard.tsx` | 910, 937 | **(f)** | chip `backgroundColor: domainColor.soft` |
| `components/PlanTaskCard.tsx` | 921, 989, 1031, 1163 | **(e)** | icon colours |
| `components/PlanTaskCard.tsx` | 924 | **(d)** | quick-chip **text** |
| `components/PlanTaskCard.tsx` | 960 | **(b)** | `Surface borderColor` |
| `components/PlanTaskCard.tsx` | 966, 974 | **(c)**, **(a)** | wash (readOnly only) + badge |
| `components/PlanTaskCard.tsx` | 902, 1013, 1048, 1180 | **(f)** | `AddRow`/`PadRow` accent (fill) |
| `components/SendToSheet.tsx` | 58, 59, 60 | **(e)** | three target icons, each its own domain hue |
| `components/SharedTasksSection.tsx` | 93 | **(b)**+**(a)**+**(d)** | `SectionCard hue` (see plans.tsx row) |
| `components/SharedTasksSection.tsx` | 107 | **(f)** | direction chip `backgroundColor: …soft` |
| `components/WeekListCard.tsx` | 405, 408 | **(b)** | `edgeColor` → `Surface borderColor` |
| `components/WeekListCard.tsx` | 420 | **(a)** | `CardAccentBadge domain="shop"` |
| `components/SectionRail.tsx` | 76 | **(a)** | `styles.dot` `backgroundColor: hue` — a plain filled dot |
| `components/SectionRail.tsx` | 69, 71 | **(d)** | label = `mix(hue, theme.text, 0.3)` — deliberately NOT pure hue |
| `components/SectionRail.tsx` | 84 | **(f)** | header rule `backgroundColor: rgba(hue, 0.25)` |
| `components/SectionCard.tsx` | 69 | **(b)** | `Surface borderColor={hue}` |

**Summary for the "fills only" rule.** Card hues are currently used as:
- **(a) badge fill** — 10 sites (all via `CardAccentBadge`) + `SectionRail`'s dot
- **(b) card edge/border** — ~22 sites, the single largest category, and the one
  the "fills only" rule would eliminate wholesale (every `Surface borderColor=`,
  every chip `borderColor`, `plans.tsx:937`'s `borderLeftColor`)
- **(c) header wash** — 4 sites
- **(d) text colour** — 6 sites (`HomeShoppingCard` 278/316, `PlanTaskCard` 691/924,
  `SectionRail` 69, plus `SectionCard` via rail)
- **(e) icon colour** — ~17 sites
- **(f) other** — ~30 sites, dominated by `AddRow`/`PadRow`/`PadTypeRow`
  `accent=` (which *is* a fill: the "+" chip and confirm button), plus soft
  backgrounds, a `GlowPulse` halo, a `ProgressBar` fill, two `Surface tint=`
  passes, and `shopping.tsx:1892`'s 4px rail.

---

### 0.3.5 Status tokens — `good` / `bad` / `warn` (+ `*Soft`)

Definition: `/home/user/UnFocus/constants/colors.ts` L59–64 (interface), light
L188–195, dark L308–313.

| Token | Light hex | Dark hex | Note |
|---|---|---|---|
| `good` | `#177E56` | `#34D399` | light darkened 2026-07-30 from `#1FA974` (2.69:1 → 4.53:1 on `bg`) |
| `goodSoft` | `#C4EFDD` | `#123227` | |
| `bad` | `#CA3939` | `#FB7185` | light darkened from `#EF4444` (3.37:1 → 4.53:1) |
| `badSoft` | `#FEE2E2` | `#3A1620` | |
| `warn` | `#9A6217` | `#F0B24A` | light darkened from `#BF7A1C` (3.13:1 → 4.55:1) |
| `warnSoft` | `#FBEBD3` | `#33240F` | |

Mapping layer: `getStatusColor()` (`/home/user/UnFocus/lib/domainColor.ts`
L117–134) — `done→good/goodSoft`, `overdue→bad/badSoft`, `soon→warn/warnSoft`,
`default→` the domain accent. **`getStatusColor` itself has no production
callers** — only `lib/__tests__/domainColor.test.ts` L63–67. Every status colour
in the app reads `theme.good/bad/warn` directly.

Complete consumer map (F = fill, T = text, I = icon, B = border):

| File | Line | Token | Use |
|---|---|---|---|
| `app/(tabs)/habits.tsx` | 120 | `good` | `habitColor()` return — consumed downstream as a fill/border |
| `app/(tabs)/habits.tsx` | 124 | `good` | `progressColor()` ratio ≥ 1 |
| `app/(tabs)/habits.tsx` | 154–158 | `good`/`bad` | energy pill: B (155 borderColor) + I (156) + T (157) |
| `app/(tabs)/plans.tsx` | 271 | `good` | `SectionRail hue` → dot F + label T + rule |
| `app/(tabs)/plans.tsx` | 274 | `good` | chevron I |
| `app/(tabs)/plans.tsx` | 452 | `good` | done-count T |
| `app/(tabs)/shopping.tsx` | 1450 | `good` | tab-cue dot F |
| `app/(tabs)/shopping.tsx` | 1696 | `warn`/`good` | spend-pace T |
| `app/(tabs)/shopping.tsx` | 1904, 1933 | `good` | allocate button F |
| `app/budget.tsx` | 107 | `warn`/`good` | `barColor` → `ProgressBar` F |
| `app/budget.tsx` | 183 | `warn`/`good` | pace figure T |
| `app/habit-form.tsx` | 701, 715 | `bad` | I |
| `app/habit-form.tsx` | 702, 716 | `bad` | T |
| `app/medicine-form.tsx` | 287 | `bad` | error T |
| `app/medicine-form.tsx` | 405, 422 | `bad` | I |
| `app/medicine-form.tsx` | 406, 423 | `bad` | T |
| `app/onboarding/privacy.tsx` | 59 | `good` | I |
| `app/pair-device.tsx` | 200 | `bad` | link T |
| `app/scan.tsx` | 586 | `good` | `Surface borderColor` B |
| `app/scan.tsx` | 587 | `good` | tip accent bar F |
| `app/scan.tsx` | 588, 611 | `good` | I |
| `app/settings.tsx` | 1029 | `warn` | T |
| `app/settings.tsx` | 1047 | `badSoft` | card `borderColor` B |
| `app/settings.tsx` | 1048 | `bad` | `ExpandableCard accentColor` → left bar F |
| `app/settings.tsx` | 1049, 1051, 1055, 1068, 1688 | `bad` | danger-button T |
| `app/share-modal.tsx` | 251 | `goodSoft` | button F |
| `app/share-modal.tsx` | 255 | `good` | button T |
| `components/AddFromMonthlyModal.tsx` | 186 | `good` | footer button F |
| `components/AddRow.tsx` | 105 | `good` | **default `fill`** when no `accent` is passed → "+" chip F + confirm F |
| `components/AiSetupPreviewModal.tsx` | 75 | `warnSoft` | banner F |
| `components/AiSetupPreviewModal.tsx` | 76 | `warn` | banner T |
| `components/AppModal.tsx` | 118 | `bad` | destructive button F |
| `components/Badge.tsx` | 34–36 | `goodSoft`/`warnSoft`/`badSoft` | badge F |
| `components/Badge.tsx` | 39–41 | `good`/`warn`/`bad` | badge T |
| `components/Button.tsx` | 106 | `bad` | `danger` variant F |
| `components/CatalogueTab.tsx` | 404 | `good` | icon button F |
| `components/CatalogueTab.tsx` | 408 | `badSoft` | icon button F |
| `components/CatalogueTab.tsx` | 414 | `bad` | I |
| `components/ConfirmationBanner.tsx` | 102 | `bad`/`warn`/`good` | banner F |
| `components/EnergyBalanceCard.tsx` | 119 | `warn` | value T |
| `components/EnergyBalanceCard.tsx` | 124 | `warn` | `ProgressBar` F (overrides the identity hue) |
| `components/EnergyBalanceCard.tsx` | 136 | `warn` | summary T |
| `components/EnergyMeter.tsx` | 252 | `good` | glow/pulse colour (F-ish) |
| `components/EnergyMeter.tsx` | 338, 344, 352, 358 | `good`/`warn` | I |
| `components/EnergyMeter.tsx` | 345, 359 | `warn` | warning T |
| `components/FlightOverlay.tsx` | 144, 169 | `good` | I |
| `components/FlightOverlay.tsx` | 168 | `good` | check `borderColor` B |
| `components/FoodTab.tsx` | 453 | `bad` | I |
| `components/FoodTab.tsx` | 454 | `bad` | T |
| `components/FoodTab.tsx` | 486 | `good` | popup button F |
| `components/FormControls.tsx` | 207 | `bad` | input `borderColor` B (error state) |
| `components/FormControls.tsx` | 234 | `bad` | error T |
| `components/HomeCardManager.tsx` | 162 | `bad` | remove-dot F |
| `components/HomeNotesCard.tsx` | 239 | `badSoft` | mic pill F (listening) |
| `components/HomeNotesCard.tsx` | 240 | `bad` | pill B |
| `components/HomeNotesCard.tsx` | 247 | `bad` | I |
| `components/HomeShoppingCard.tsx` | 353 | `warn`/`good` | pace T |
| `components/MedicineTrayCard.tsx` | 140, 149 | `warn`/`good` | status-line T |
| `components/MedicineTrayCard.tsx` | 282 | `warn` | I |
| `components/MedicineTrayCard.tsx` | 291, 321, 420 | `good` | meta T |
| `components/MedicineTrayCard.tsx` | 336 | `good` | check B |
| `components/MedicineTrayCard.tsx` | 337 | `good` | check F |
| `components/NoteRow.tsx` | 104 | `bad` | I |
| `components/PlanTaskCard.tsx` | 948 | `good`/`warn` | energy chip I |
| `components/ProgressBar.tsx` | 56 | `good`/`bad`/`warn` | bar F |
| `components/SavedListsModal.tsx` | 84 | `goodSoft` | row icon F |
| `components/SavedListsModal.tsx` | 85 | `good` | I |
| `components/SavedListsSection.tsx` | 78 | `good` | `ExpandableCard accentColor` → left bar F |
| `components/SavedListsSection.tsx` | 92 | `goodSoft` | row icon F |
| `components/SavedListsSection.tsx` | 93 | `good` | I |
| `components/ScreenHeader.tsx` | 379 | `good` | I |
| `components/ScreenHeader.tsx` | 392 | `bad` | I |
| `components/ShoppingItemSheet.tsx` | 218 | `good` | stock T |
| `components/ShoppingRow.tsx` | 308 | `goodSoft` + `good` | highlight F + B |
| `components/ShoppingRow.tsx` | 347 | `good` | in-stock meta T |
| `components/ShoppingRow.tsx` | 368 | `bad` | I |
| `components/ShoppingRow.tsx` | 378–381 | `good` | check F + B |
| `components/ShoppingRow.tsx` | 393 | `good` | I |
| `components/TaskCard.tsx` | 711, 784, 958 | `good` | check F + B |
| `components/TaskCard.tsx` | 714, 787, 961 | `contrastOn(good)` | check glyph I |
| `components/TaskCard.tsx` | 837 | `badSoft` | mic pill F |
| `components/TaskCard.tsx` | 838 | `bad` | pill B |
| `components/TaskCard.tsx` | 842 | `bad` | I |
| `components/TaskCard.tsx` | 1366, 1380 | `bad` | I |
| `components/TaskCard.tsx` | 1367, 1381 | `bad` | T |
| `components/UpdateSheet.tsx` | 169 | `bad`/`badSoft` | delete button F |
| `components/UpdateSheet.tsx` | 174 | `bad` | T |
| `components/VoiceNoteFAB.tsx` | 73 | `bad` | FAB F (listening) |
| `components/WeekListCard.tsx` | 462, 671, 681 | `good` | I |
| `components/WeekListCard.tsx` | 474 | `good` | `IconButton color` I |
| `components/WeekListCard.tsx` | 475 | `bad` | `IconButton color` I |
| `components/WeekListCard.tsx` | 512 | `good` | section label T |
| `components/WeekListCard.tsx` | 513 | `good` | section rule F |
| `components/WeekListCard.tsx` | 529, 559, 591 | `good` | `borderLeftColor` B |
| `components/WeekListCard.tsx` | 607 | `goodSoft` | F |
| `components/WeekListCard.tsx` | 608 | `good` | B |
| `components/WeekListCard.tsx` | 647 | `good` | `AddRow accent=` F |
| `components/WeekListCard.tsx` | 783 | `good` | progress F |
| `lib/domainColor.ts` | 124, 126, 128 | all six | `getStatusColor()` (no production caller) |

Rough split: **~48 fill uses, ~34 text uses, ~34 icon uses, ~14 border uses.**
Note `good` is doing double duty as a *default action* colour, not only a status
one — `AddRow.tsx:105` makes it the fallback confirm-button fill for every
`AddRow` that doesn't pass a domain accent.

---

### 0.3.6 The `accent` token and where a solid accent FILL is used

Definition: `/home/user/UnFocus/constants/colors.ts` L54–56 (interface).

| Token | Light hex | Dark hex |
|---|---|---|
| `accent` | `#2563EB` | `#6EA8FF` |
| `accentSoft` | `#CFE0FB` | `#1B2C49` |
| `accentInk` | `#FFFFFF` | `#080B12` |

Volume: **284** `theme.accent` references, **31** `theme.accentSoft`, **87**
`theme.accentInk`, across the app. `accent` is also the fallback for any
unmapped route in `getScreenColor` (`lib/screenColor.ts:59`).

**Solid `accent` fills, grouped by screen/surface** (a "fill" = `backgroundColor`
set to `theme.accent` at full opacity, or a `Button variant="primary"`). Chips
whose fill is `accentSoft`, and `rgba(theme.accent, …)` washes, are excluded and
noted separately.

*Global chrome (present on every screen — this alone breaks a strict "one accent fill per screen" rule):*
- `components/BottomNav.tsx:369, 387` — centre FAB fill
- `components/AddFAB.tsx:114` — FAB fill
- `components/Button.tsx:104` — `primary` variant fill (used app-wide)
- `components/DebugGeneralNoteButton.tsx:77, 104`; `components/DebugNoteAnchor.tsx:126, 138, 167` — debug FAB/bubble/composer (only when `debugModeEnabled`)

*Home (`app/(tabs)/index.tsx`)*
- L639 — `doneBtn` fill
- via children: `components/PlanTaskCard.tsx:608` (check fill), `:833` (now-line bar), `components/HomeSharedCard.tsx:61` (left accent bar)

*To-do / Plans (`app/(tabs)/plans.tsx`)*
- No direct `backgroundColor: theme.accent`; uses `SectionCard hue={theme.accent}` at L1060, 1095 which becomes a **border**, plus `SectionRail`'s dot fill
- via children: `components/PlanTaskCard.tsx:608, 833`; `components/DayGridLines.tsx:78, 79` (now dot + bar); `components/TaskCard.tsx:1026, 1100` (weekday chips), `:1384` (save button)

*Shopping (`app/(tabs)/shopping.tsx`)*
- L1492 — weekly-reset-day chip fill
- via children: `components/WeekListCard.tsx:716` (in-cart section rule); `components/MonthlyTableRow.tsx:89` (step button), `:117` (check fill); `components/NewMonthlyListRow.tsx:119` (primary button); `components/ShoppingQuickAddSheet.tsx:125`; `components/ShoppingItemSheet.tsx:223`; `components/ListSettingsSheet.tsx:92, 112`; `components/SavedListsSection` (soft only)

*Habits (`app/(tabs)/habits.tsx`)* — no direct accent fill; `app/habit-form.tsx:465, 592, 643, 674, 719` (chips + save)

*Health (`app/(tabs)/health.tsx`)* — no direct accent fill; `app/health-form.tsx:114, 419`; `app/medicine-form.tsx:230, 269, 429`

*Sub-screens*
- `app/scan.tsx` — 433, 447, 479, 556, 596, 664, 697, 724, 784 (**nine** accent fills on one screen)
- `app/settings.tsx` — 773, 1189, 1569
- `app/automations.tsx` — 128, 148, 191
- `app/budget.tsx` — 196
- `app/notes.tsx` — 143 (divider bar, explicitly documented at L27 as intentional)
- `app/shared.tsx` — 196, 231
- `app/share-modal.tsx` — 213
- `app/onboarding/basics.tsx` — 215

*Shared components with an accent fill*
- `components/AddDishSheet.tsx:243`, `components/AiSetupPreviewModal.tsx:123`,
  `components/DatePickerCalendar.tsx:186`, `components/ErrorBoundary.tsx:69`,
  `components/FoodTab.tsx:494`, `components/GoalsSheet.tsx:184`,
  `components/InlineAddItem.tsx:269`, `components/LayoutPickerSheet.tsx:145`,
  `components/MonthlyResetReviewSheet.tsx:206, 224`,
  `components/MonthlyResetSummaryModal.tsx:114`, `components/NewSinceGlow.tsx:119`,
  `components/NoteRow.tsx:110`, `components/SlideSelector.tsx:131`,
  `components/Stepper.tsx:80`, `components/TabSlider.tsx:168` (fallback when an
  option supplies no colour), `components/UpdateSheet.tsx:143, 161`,
  `components/VoiceNoteFAB.tsx:73`, `components/EnergyMeter.tsx:278` (pip badges),
  `components/FormControls.tsx:71` (animated checkbox fill)

*Translucent accent (NOT solid fills — listed so they aren't miscounted)*
- `components/PlanTaskCard.tsx:646` `rgba(accent, 0.14)`, `:730` `0.05`,
  `:772` `0.05/0.1`, `:1148` `0.03`

**Bottom line for the "one accent fill per screen" rule:** every screen already
exceeds it before its own content renders, because `BottomNav`'s centre button,
`AddFAB` and `Button variant="primary"` are all accent fills. `app/scan.tsx`
(nine) and `app/habit-form.tsx` (five) are the worst single-screen offenders.

---

### 0.3.7 Border / divider tokens

**There is exactly ONE border token doing both jobs.** `/home/user/UnFocus/constants/colors.ts`
L50–51 declares `border` and `borderStrong`:

| Token | Light hex | Dark hex |
|---|---|---|
| `border` | `#7689A8` | `#5B6C8A` |
| `borderStrong` | `#2B5FD9` | `#7891B6` |

`borderStrong` has **exactly one consumer**: `/home/user/UnFocus/components/FormControls.tsx:207`
(a focused text input's border). Everything else — control boundaries *and*
notepad rules — is `theme.border`: **265 references across 82 files**.

There is no dedicated `divider`, `rule`, `separator` or `hairline` token.

#### (i) Decorative rules / notepad lines — `theme.border` used as a horizontal rule

| File | Line(s) | What it draws |
|---|---|---|
| `/home/user/UnFocus/components/PadSheet.tsx` | 84 (`const rule = { backgroundColor: theme.border }`), applied at 91, 101, 107 | **the notepad rules** — the type-line rule, per-row rules, and the spare "keep writing" lines. Full-width (`ROW_DIVIDER_INSET` is deleted); `styles.rule` height = `StyleSheet.hairlineWidth` (L134) |
| `/home/user/UnFocus/components/FieldDivider.tsx` | 27 | the shared standalone rule component |
| `/home/user/UnFocus/components/SectionDivider.tsx` | 48 | `Motif id="trunk-divider" color={theme.border}` — the decorative branch divider |
| `/home/user/UnFocus/app/settings.tsx` | 763, 805, 830, 838, 846, 857, 940, 967, 971, 978, 983, 989, 993, 1033, 1053, 1057, 1097, 1121, 1132, 1140, 1150, 1205, 1253, 1267, 1282, 1314, 1325, 1336, 1448, 1469, 1506, 1680 (**32 occurrences**) | `styles.divider` bars between settings rows |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 1728, 1757, 1776, 1848 | `styles.rowDivider` between list rows |
| `/home/user/UnFocus/components/WeekListCard.tsx` | 546, 581, 596, 628, 733, 763 | `styles.rowDivider` |
| `/home/user/UnFocus/components/CatalogueTab.tsx` | 524 | `ItemSeparatorComponent` |
| `/home/user/UnFocus/components/SavedListsSection.tsx` | 104 | `styles.rowDivider` |
| `/home/user/UnFocus/components/AddFromMonthlyModal.tsx` | 174 | `styles.rowDivider` |
| `/home/user/UnFocus/components/LayoutPickerSheet.tsx` | 103 | `styles.divider` |
| `/home/user/UnFocus/components/EnergyBalanceCard.tsx` | 135 | `styles.divider` |
| `/home/user/UnFocus/components/EnergyMeter.tsx` | 348 | `styles.divider` |
| `/home/user/UnFocus/app/inventory-edit.tsx` | 133 | `styles.rowDivider` |
| `/home/user/UnFocus/app/onboarding/features.tsx` | 121 | `styles.divider` |
| `/home/user/UnFocus/components/AddRow.tsx` | 128 | `showDivider` → hairline `borderTopWidth`/`borderTopColor` |
| `/home/user/UnFocus/components/ExpandableCard.tsx` | 123, 149 | hairline top divider between stacked cards + the body's top rule |
| `/home/user/UnFocus/components/GoalPicker.tsx` | 128, 141 | hairline row separators |
| `/home/user/UnFocus/components/TaskCard.tsx` | 1332 | hairline row separator |
| `/home/user/UnFocus/components/MonthlyResetReviewSheet.tsx` | 170, 193 | `borderTopColor` row rules |
| `/home/user/UnFocus/components/SharedRequestsSection.tsx` | 99 | `borderTopColor` row rule |
| `/home/user/UnFocus/components/CardHintNote.tsx` | 57 | `borderTopColor` row rule |
| `/home/user/UnFocus/components/FoodTab.tsx` | 397 | ingredient-row `borderTopColor` |
| `/home/user/UnFocus/app/(tabs)/habits.tsx` | 324 | week-strip `borderTopColor` |
| `/home/user/UnFocus/app/(tabs)/health.tsx` | 403 | log-link `borderTopColor` |
| `/home/user/UnFocus/app/(tabs)/shopping.tsx` | 1911, 1928 | unallocated-row `borderTopColor` |
| `/home/user/UnFocus/app/health-form.tsx` | 296 | suggest-row `borderTopColor` |
| `/home/user/UnFocus/app/scan.tsx` | 691 | totals-row `borderTopColor` |
| `/home/user/UnFocus/components/NoteRow.tsx` | 144 | body-input `borderTopColor` |
| `/home/user/UnFocus/components/ScreenScaffold.tsx` | 503 | header `borderBottomColor` hairline |

That is roughly **95 divider/rule uses**.

`/home/user/UnFocus/components/PadRow.tsx` **does not draw a divider itself** —
it is a row body only; `PadSheet` owns every rule. Two rules are drawn in a
*different* colour and are the only exceptions to `theme.border` as the rule
colour: `/home/user/UnFocus/components/WeekListCard.tsx:513` (`theme.good`) and
`:716` (`theme.accent`), plus `/home/user/UnFocus/app/notes.tsx:143`
(`theme.accent`, documented as intentional at L27), and
`/home/user/UnFocus/components/HomeSharedCard.tsx:83, 106` (`theme.surfaceMuted`).

#### (ii) Control boundaries — the remaining ~170 `theme.border` uses

The same token draws every inactive control edge. Representative sites (not
exhaustive, but this is the class the refactor would need to split from the
rules above):

- `/home/user/UnFocus/components/Surface.tsx` 226 (`edgeHue` fallback), 294, 295, 296 — the card edge when no hue applies
- `/home/user/UnFocus/components/IconButton.tsx` 87 — inactive→active border interpolation
- `/home/user/UnFocus/components/FormControls.tsx` 207 — input at rest
- `/home/user/UnFocus/components/TagChip.tsx` 57, `/home/user/UnFocus/components/PersonChip.tsx` 97 — unselected chip edge
- `/home/user/UnFocus/components/TimeBoxInput.tsx` 80 — inactive field box
- `/home/user/UnFocus/components/PadRow.tsx`, `/home/user/UnFocus/components/PadTypeRow.tsx` (2 refs) — the unchecked check circle
- `/home/user/UnFocus/components/LayoutPickerSheet.tsx` 87, 116; `/home/user/UnFocus/components/ShoppingItemSheet.tsx` 199 — unselected option chips
- `/home/user/UnFocus/components/MedicineTrayCard.tsx` 336; `/home/user/UnFocus/components/PlanTaskCard.tsx` 645, 909, 936; `/home/user/UnFocus/components/HomeNotesCard.tsx` 281; `/home/user/UnFocus/components/TaskCard.tsx` 656 — inactive chip/check borders
- `/home/user/UnFocus/components/StarterCard.tsx` (4 refs) — the neutral starter-card shell
- `/home/user/UnFocus/components/SendToSheet.tsx` 71 + the sheet handle at 68
- `/home/user/UnFocus/app/(tabs)/habits.tsx:126` — `progressColor()`'s zero-progress return (deliberately neutral, "no red punishment colour")

Per-file counts for `theme.border` (top of the list): `app/settings.tsx` 48,
`app/(tabs)/shopping.tsx` 14, `app/(tabs)/habits.tsx` 14,
`components/PlanTaskCard.tsx` 11, `app/scan.tsx` 10, `components/WeekListCard.tsx` 9,
`app/habit-form.tsx` 8, `components/Surface.tsx` 7.

---

### 0.3.8 Notes for the refactor

1. **Retiring `feat*` is small; retiring `card*` is not.** The screen-hue family
   has 10 production files and one load-bearing line (`Surface.tsx:226`). The
   card family has 21 files and ~90 distinct colour bindings.
2. **Four `feat*` tokens and two `card*` tokens are already dead.**
   `featHabit`/`featMeal`/`featBudget`/`featNote` are unreachable via
   `getScreenColor` (only `featBudget`, `featShop`, `featTask` survive through
   three direct call sites); `cardScan` has no `Domain` member and `cardBudget`
   has no caller.
3. **`getStatusColor()` has no production callers** — the status mapping layer is
   test-covered but unused; every status colour is a direct `theme.good/bad/warn`
   read.
4. **Tests that will fail on a rename**: `/home/user/UnFocus/lib/__tests__/colors.test.ts`
   (L27–28 token lists, L146–154 the `startsWith('feat')||startsWith('card')`
   3:1 badge-ink contrast loop), `/home/user/UnFocus/lib/__tests__/screenColor.test.ts`,
   `/home/user/UnFocus/lib/__tests__/domainColor.test.ts`.
5. **`components/FoodTab.tsx`'s `MEAL_COLORS` (L105–111) is a fifth palette** that
   never went through either family — if the refactor consolidates hues, that
   file is an unlisted consumer of the same visual space.

---

## 0.3b Colour measurements — re-verified against source

**Source of truth:** `/home/user/UnFocus/constants/colors.ts` (the palette actually lives here;
`constants/theme.ts` holds only the derived helpers `contrastOn`/`mix`/`rgba`, and there is no
`getTheme`/`Colors` export — the resolver is `getThemePalette(name, isDark)` and
`lib/useAppTheme.ts` re-derives only `accentInk`). Test file is
`/home/user/UnFocus/lib/__tests__/colors.test.ts` (not `constants/__tests__/`).

Method: throwaway node script, no dependencies — WCAG 2.x relative luminance/contrast, CIE L\*
(D65), CIEDE2000, and the Viénot 1999 LMS dichromacy reduction. Sanity-pinned:
black↔white ΔE2000 = 100.0, L\*(#808080) = 53.6, L\*(#FFFFFF) = 100.0, deuteranope(#FFFFFF) =
#FFFFFF, deuteranope(#FF0000) = olive.

---

### Step 1 — the real tokens

The brief made no per-token hex claims; these are reported so every later number is traceable.
**No token in the brief was found to be misquoted at the hex level** — where the brief cited a
derived number, the underlying hex was right (the errors are all downstream, see Steps 2 and 4).

| Token | Light | Dark |
|---|---|---|
| `bg` | `#EEF3F9` | `#080B12` |
| `surface` | `#FCFDFF` | `#151C2B` |
| `surfaceMuted` | `#E7EDF4` | `#10151F` |
| `surfaceInset` | `#DEE6EF` | `#0B0F17` |
| `border` | `#7689A8` | `#5B6C8A` |
| `borderStrong` | `#2B5FD9` | `#7891B6` |
| `text` | `#1B2432` | `#E9EDF5` |
| `textMuted` | `#5F6A79` | `#8B95A7` |
| `textInverse` | `#FFFFFF` | `#080B12` |
| `accent` | `#2563EB` | `#6EA8FF` |
| `good` | `#177E56` | `#34D399` |
| `bad` | `#CA3939` | `#FB7185` |
| `warn` | `#9A6217` | `#F0B24A` |

Card-identity hues (`lib/domainColor.ts` maps domain → `card*`; the `feat*` octet is the
*screen* hue and a separate ramp):

| Identity hue | Light | Dark | L\* (light) | L\* (dark) |
|---|---|---|---|---|
| `cardPlan` | `#3789A6` | `#5FA1B8` | 53.4 | 62.8 |
| `cardTask` | `#4E62C8` | `#7181D3` | 45.0 | 56.0 |
| `cardHabit` | `#2E943B` | `#57A862` | 54.1 | 62.4 |
| `cardHealth` | `#C4667A` | `#D08595` | 54.7 | 63.6 |
| `cardMeal` | `#D9825A` | `#E19B7B` | 62.9 | 70.1 |
| `cardShop` | `#BC6494` | `#C983A9` | 54.0 | 62.9 |
| `cardBudget` | `#7C9B55` | `#96AF77` | 60.2 | 68.4 |
| `cardNote` | `#8A5EC5` | `#A17ED1` | 48.8 | 59.1 |
| `cardScan` | `#6A5FC9` | `#887FD4` | — (9th token; not a `Domain`, no badge) | |

> **Note the brief undercounts.** It says "eight identity hues". There are **nine** `card*`
> tokens and **nine** `feat*` tokens. `cardScan`/`featScan` are real palette entries that the CI
> sweep does test, even though `cardScan` has no entry in `DOMAIN_TOKEN` and so never renders a
> badge. Any "all identity hues" statement that stops at eight is incomplete.

---

### Step 2 — computed contrast

#### Surface / text ladder

| Pair | Light | Dark |
|---|---|---|
| `bg` ↔ `surface` | **1.10** | **1.16** |
| `surface` ↔ `surfaceMuted` | **1.16** | 1.07 |
| `surfaceMuted` ↔ `surfaceInset` | **1.07** | 1.05 |
| `border` vs `surface` | **3.49** | 3.21 |
| `border` vs `bg` | 3.18 | 3.71 |
| `text` vs `surface` | 15.34 | **14.52** |
| `text` vs `bg` | 14.00 | 16.77 |
| `textMuted` vs `surface` | **5.40** | 5.64 |
| `textMuted` vs `bg` | 4.92 | 6.52 |

#### The seven headline claims — all CONFIRMED

| Brief claim | Computed | Verdict |
|---|---|---|
| light `bg`↔`surface` = 1.10:1 | 1.10 | **PASS** |
| light `surface`→`surfaceMuted` = 1.16:1 | 1.16 | **PASS** |
| light `surfaceMuted`→`surfaceInset` = 1.07:1 | 1.07 | **PASS** |
| light `border` = 3.49:1 | 3.49 (vs `surface`) | **PASS** — but note it is 3.18 vs `bg`; the brief quotes only the friendlier of the two |
| dark `bg`→`surface` = 1.16:1 | 1.16 | **PASS** |
| dark `text` on `surface` = 14.5:1 | 14.52 | **PASS** |
| light `textMuted` = 5.40:1 | 5.40 (vs `surface`) | **PASS** — 4.92 vs `bg`, again the friendlier figure |

The brief's arithmetic on the surface ladder is **sound**. Its implicit thesis (the light
surface ladder is nearly invisible — 1.10 / 1.16 / 1.07, and dark is worse at 1.16 / 1.07 / 1.05)
survives contact with the source intact.

#### White text on identity-hue badge fills

**The six numbers are exactly right. The finding built on them is largely void.** Read both halves.

| Hue | Brief: white contrast | Computed (light, flat accent) | Verdict |
|---|---|---|---|
| meal | 2.88 | **2.88** | PASS |
| budget | 3.15 | **3.15** | PASS |
| health | 3.80 | **3.80** | PASS |
| habit | 3.88 | **3.88** | PASS |
| shop | 3.90 | **3.90** | PASS |
| plan | 3.97 | **3.97** | PASS |
| task | (not claimed) | 5.38 | clears 4.5 |
| note | (not claimed) | 4.68 | clears 4.5 |

Six of eight below 4.5:1 against white — **arithmetically confirmed**.

##### …but what does the code actually put on a badge?

**Almost nothing renders white text on a raw identity hue.** Every identity-hue consumer I found
picks its ink through `contrastOn()` (`constants/theme.ts:116`), which returns whichever of
`#1E293B` or `#FFFFFF` scores higher:

`components/TagChip.tsx:58` · `components/PersonChip.tsx:47,98` · `components/AddRow.tsx:164,241` ·
`components/InlineAddItem.tsx:247,302` · `components/PadTypeRow.tsx:182` · `components/FoodTab.tsx:389` ·
`components/SharedTasksSection.tsx:125` · `lib/personColor.ts:88` · `lib/domainColor.ts:105` (`ink:`).

For the six "failing" hues, `contrastOn()` returns **dark ink, not white**, at these ratios:

| Hue | `contrastOn()` returns | Ratio |
|---|---|---|
| meal | `#1E293B` | 5.08 |
| budget | `#1E293B` | 4.65 |
| health | `#1E293B` | 3.85 |
| habit | `#FFFFFF` | 3.88 |
| shop | `#FFFFFF` | 3.90 |
| plan | `#FFFFFF` | 3.97 |

So for meal/budget/health the brief measured a colour combination **the app never draws**.

##### The one real exception — and it is a genuine, uncaught gap

`components/CardAccent.tsx:114` hardcodes the badge glyph:

```
<Ionicons name={glyph} size={Math.round(size * 0.44)} color="#FFFFFF" />
```

This is the only hardcoded white on an identity fill. Three qualifiers matter:

1. **It is an icon, not text.** WCAG 1.4.11 applies (3:1 for non-text UI), not 1.4.3's 4.5:1.
   The brief's 4.5 threshold is the wrong gate for this element.
2. **The fill is a gradient, not a flat colour** — `badgeGradient = [accent, mix(accent, #1E3A8A, 0.35)]`
   (`lib/domainColor.ts:107`). The brief's numbers describe only the lightest (top-left) stop.
3. Against the **darker** stop every hue clears 4.5 in light mode: plan 5.55, task 6.75, habit 5.57,
   health 5.59, meal 4.60, shop 5.67, budget 4.79, note 6.28.

Applying the correct 3:1 non-text floor to the worst-case (lightest) stop:

| Mode | Hues where the white glyph is **under 3:1** at the lightest gradient stop |
|---|---|
| Light | **meal only** (2.88) |
| Dark | **plan 2.89, habit 2.92, health 2.81, meal 2.29, shop 2.88, budget 2.42** (6 of 8); task 3.63 and note 3.27 clear it |

**This is a real defect that CI does not catch** — see Step 3. But it is a dark-mode icon-contrast
issue at one corner of a gradient, not the "six of eight badges fail body-text contrast" the brief
describes. **The headline finding as written does not survive.**

#### CIEDE2000 between identity hues

Normal vision, light mode — **every claimed value is exact:**

| Pair | Brief | Computed | Verdict |
|---|---|---|---|
| health/shop | 8.9 | **8.9** | PASS |
| habit/budget | 11.1 | **11.1** | PASS |
| task/note | 12.4 | **12.4** | PASS |
| shop/note | 18.1 | **18.1** | PASS |
| plan/task | 19.6 | **19.6** | PASS |

The brief's normal-vision colour maths is reproducible to the decimal. Remaining light-mode pairs
run 21.4 (health/meal) up to 68.2 (habit/shop). Dark mode is uniformly tighter: health/shop 7.4,
habit/budget 10.6, task/note 11.9, shop/note 15.7, plan/task 18.0.

##### Simulated dichromacy — the brief's numbers do not reproduce

Because normal-vision agreement is exact, the divergence below is a **simulation-model
disagreement, not an arithmetic error on either side**. I ran two standard Viénot variants (the
transform applied in linear-RGB, and applied directly to gamma-encoded sRGB — both are in common
use). Neither reproduces the brief:

| Brief claim (deuteranopia) | Viénot / linear | Viénot / gamma | Verdict |
|---|---|---|---|
| plan/task = 4.7 | **13.1** | **10.5** | **FAIL — off by 2.2–2.8×** |
| health/shop = 7.0 | **16.7** | **16.3** | **FAIL — off by ~2.4×** |
| health/meal = 7.9 | **15.8** | **17.7** | **FAIL — off by ~2×** |

More damaging than the magnitudes: **the brief flags the wrong pairs.** It names plan/task as the
worst deuteranope collision. Under both models it is nowhere near worst — the genuinely dangerous
pairs are ones the brief never mentions:

| Worst deuteranope pairs (light) | linear | gamma |
|---|---|---|
| **meal/budget** | **5.5** | **3.2** |
| **task/note** | **5.8** | **5.4** |
| habit/budget | 7.0 | 10.5 |
| plan/note | 8.2 | 6.3 |

And protanopia is worse still, again on pairs the brief is silent about: **task/note collapses to
1.5 (linear) / 1.2 (gamma)** — effectively the same colour — with meal/budget at 4.2/5.2 and
habit/budget at 4.9/5.7.

**Verdict: the brief's dichromacy section is directionally right that the ramp has CVD collisions,
but every specific number is wrong and its worst-offender ranking is inverted.** Do not act on its
pair list; act on meal/budget, task/note, habit/budget.

---

### Step 3 — what CI actually asserts

Single relevant file: `/home/user/UnFocus/lib/__tests__/colors.test.ts`. (`lib/__tests__/domainColor.test.ts:34`
adds one more assertion, noted below. `lib/__tests__/designTokens.test.ts` contains **no** colour
assertions — it is tap-target/motion tokens only.)

**Asserted pairs and thresholds:**

| Assertion | Lines | Threshold |
|---|---|---|
| `text` vs `bg` **and** `surface`, light & dark | 63–93 | ≥ 4.5 |
| `textMuted` vs `bg` **and** `surface`, light & dark | 71–93 | ≥ 4.5 |
| `accent`, `good`, `bad`, `warn`, `borderStrong` as text vs `bg` and `surface` | 104–113 | ≥ 4.5 |
| `border` vs `surface` and `bg` | 116–120 | ≥ 3 |
| `text` on `accentSoft`/`goodSoft`/`badSoft`/`warnSoft`/`hintBg` | 123–134 | ≥ 4.5 |
| `accentInk` on `accent` | 136–139 | ≥ 4.5 |
| `contrastOn(token)` on every `feat*`/`card*` fill | 146–155 | ≥ 3 |
| dark depth ordering `bg` < `surface` < `border` (luminance) | 158–184 | ordering only |
| `getDomainColor().ink` vs `.accent` (`domainColor.test.ts`) | 34 | ≥ 3 |

**Is text-on-identity-badge-fill asserted? The brief's suspicion is CORRECT — and the gap is
sharper than suspected.** The sweep exists, but it tests the wrong colour:

```
146    MODES.forEach((mode) => {
147      const p = THEMES.default[mode] as unknown as Record<string, string>;
148      Object.keys(p)
149        .filter((k) => k.startsWith('feat') || k.startsWith('card'))
150        .forEach((token) => {
151          test(`${mode}: contrastOn(${token}) ≥ 3:1 as badge ink on that fill`, () => {
152            expect(contrastRatio(contrastOn(p[token]), p[token])).toBeGreaterThanOrEqual(3);
153          });
154        });
155    });
```

Line 152 asserts `contrastOn(fill)` — **the best-case ink**, chosen adaptively per hue. But
`components/CardAccent.tsx:114` renders an unconditional `#FFFFFF`. Wherever `contrastOn()` returns
dark ink, this test passes on a colour the badge does not use. Concretely: `cardMeal` passes at
5.08 (dark ink) while the shipped badge draws white at 2.88. **In dark mode all eight domain hues
resolve `contrastOn()` to dark ink, so the test never exercises white at all — yet the badge is
white in dark mode too.** The test is structurally incapable of catching the Step 2 defect.

Two further notes on the sweep's shape:
- It is a **prefix scan** over live palette keys, so a new `card*`/`feat*` token is auto-enrolled
  with no test edit (good), but a new identity token named anything else is silently exempt.
- The comment at 142–145 explicitly caps this at 3:1 rather than 4.5, deferring the harder gate to
  "open conflict #5". So the brief's 4.5 framing contradicts a documented, deliberate decision — it
  is not an oversight to be fixed by tightening the number.

**Blanket "every border-ish token clears 3:1"? No such test exists.** Lines 116–120 name the single
token `border` literally (`p.border`), inside a `MODES.forEach`. There is no prefix scan over
border-like names and no `rule` token in the palette today. **A new decorative `rule` token would
therefore be exempt automatically, with zero test changes required** — which also means its
exemption would be invisible in review. Worth adding an explicit comment rather than relying on
silence.

---

### Step 4 — the proposed replacements

#### Light surfaces

| Claim | Computed | Verdict |
|---|---|---|
| bg `#E4EBF4` ↔ surface `#FFFFFF` = 1.20:1 | **1.20** | **PASS** |
| `rule` `#D3DBE6` = 1.37:1 vs surface | **1.40** | **FAIL (minor)** |

The `rule` miss is traceable: **1.37 is the ratio against the *old* surface `#FCFDFF`**, and it is
quoted verbatim in a source comment at `constants/colors.ts:168` — "*bumped from #D3DBE6 (1.25:1 on
bg, 1.37:1 on surface)*". The brief lifted the number from that comment instead of recomputing it
against the proposed pure-white surface. Harmless to the argument, but it confirms the brief was
reading comments rather than measuring.

Also note the proposal **reverses the surface ladder's spacing** without saying so:
`surface`↔`surfaceMuted` goes 1.16 → **1.13** (worse), while `surfaceMuted`↔`surfaceInset` goes
1.07 → **1.17** (better). Net, the first step gets *less* visible.

#### ⚠️ The proposed light `bg` breaks five existing CI assertions

`#E4EBF4` is **darker** than today's `#EEF3F9`. Every token asserted against `bg` loses ground, and
five drop below their floor. **This is not flagged anywhere in the brief.**

| Token | vs current `bg` | vs proposed `bg` | Floor | Result |
|---|---|---|---|---|
| `accent` `#2563EB` | 4.63 | **4.30** | 4.5 | ❌ breaks `colors.test.ts:110` |
| `good` `#177E56` | 4.53 | **4.21** | 4.5 | ❌ breaks `colors.test.ts:110` |
| `bad` `#CA3939` | 4.53 | **4.21** | 4.5 | ❌ breaks `colors.test.ts:110` |
| `warn` `#9A6217` | 4.55 | **4.23** | 4.5 | ❌ breaks `colors.test.ts:110` |
| `border` `#7689A8` | 3.18 | **2.96** | 3.0 | ❌ breaks `colors.test.ts:119` |
| `borderStrong` | 5.03 | 4.67 | 4.5 | ✅ (thin) |
| `textMuted` | 4.92 | **4.57** | 4.5 | ✅ (very thin) |
| `text` | 14.00 | 13.00 | 4.5 | ✅ |

The semantic trio was darkened *to exactly 4.53/4.53/4.55* on 2026-07-30 specifically to clear 4.5
against the current `bg` (see the comment block at `constants/colors.ts:178–195`). Darkening `bg`
undoes that pass one day later. Any adoption of `#E4EBF4` must re-darken `accent`, `good`, `bad`,
`warn` and `border` in the same change.

#### Dark surfaces

| Claim | Computed | Verdict |
|---|---|---|
| bg `#0A0F19` ↔ surface `#1C2536` = 1.25:1 | **1.25** | **PASS** |
| text `#D2DAE7` on surface = 10.9:1 | **10.91** | **PASS** |

Depth ordering `bg` < `surface` < `border` still holds (0.00476 < 0.01836 < 0.14784), so
`colors.test.ts:175–181` survives.

**But the proposed dark `surface` is *lighter* than today's `#151C2B`, and that breaks one test:**

| Token | vs current dark `surface` | vs proposed | Floor | Result |
|---|---|---|---|---|
| `border` `#5B6C8A` | 3.21 | **2.89** | 3.0 | ❌ breaks `colors.test.ts:118` |
| `borderStrong` | 5.29 | 4.77 | 4.5 | ✅ (thin) |
| `bad` `#FB7185` | 6.33 | 5.71 | 4.5 | ✅ |
| `textMuted` | 5.64 | 5.09 | 4.5 | ✅ |

So **both** proposed surface changes break the `border` 3:1 assertion — light via a darker `bg`,
dark via a lighter `surface`. `border` needs adjusting in both modes.

#### Proposed identity hues — every claim CONFIRMED

| Hue | Claim | Computed | Verdict |
|---|---|---|---|
| To-do `#3F52B5` | white 6.81, L\* 38.6 | **6.81**, **38.6** | **PASS** |
| Habits `#1F7A2E` | white 5.41, L\* 44.8 | **5.41**, **44.8** | **PASS** |
| Health `#A84A60` | white 5.51, L\* 44.3 | **5.51**, **44.3** | **PASS** |
| Shopping `#D9A441` | dark `#1B2432` 6.94, L\* 70.7 | **6.94**, **70.7** | **PASS** |

Caveats the brief omits:
- Shopping `#D9A441` needs **dark** ink (white is 2.25). `contrastOn()` would pick `#1E293B`
  (6.50), not the `#1B2432` the brief measured against — close, but the app's own helper gives a
  different number than the brief's. More importantly, `CardAccentBadge`'s hardcoded white glyph
  would render at **2.25:1** on this hue — failing even 3:1. The proposal does not fix the Step 2
  defect; it makes one hue's instance of it worse.
- As a card **edge/border** on dark surface `#1C2536`, three of four fall below 3:1: To-do 2.26,
  Health 2.79, Habits 2.84 (Shopping 6.83). Dark-mode variants would still be required.

##### Proposed ΔE2000

| Claim | Computed | Verdict |
|---|---|---|
| worst normal-vision pair = 31.3 | **31.3** (todo/health) | **PASS** |
| worst simulated pair = health/shop 16.8 | see below | **FAIL** |

Full proposed set, normal vision: todo/health **31.3**, habits/shopping 40.2, health/shopping 45.1,
todo/habits 51.0, habits/health 61.7, todo/shopping 62.8. The 31.3 claim is exact.

The simulated claim is wrong on **both** the pair and the value:

| Model | Worst simulated pair | ΔE | health/shopping (the brief's pick) |
|---|---|---|---|
| Viénot / linear, deut | **habits/health** | **11.1** | 29.5 |
| Viénot / gamma, deut | **habits/health** | **13.9** | 34.2 |
| Viénot / linear, prot | **habits/shopping** | **19.3** | 41.1 |
| Viénot / gamma, prot | todo/health | 20.7 | 45.4 |

health/shopping is not the worst pair under any model — it is among the *safest*. The true floor is
**habits/health at ~11–14**, roughly 20% *below* the brief's stated worst case. The four-hue
proposal is still a large improvement on today's ramp (whose deuteranope floor is 3.2–5.5), but the
brief's specific reassurance figure is not one to quote.

#### Do the proposed text tokens still clear AA on the proposed surfaces?

Light, against surface `#FFFFFF`: `text` 15.61 ✅, `textMuted` 5.49 ✅, `accent` 5.17 ✅,
`good`/`bad` 5.05 ✅, `warn` 5.08 ✅, `borderStrong` 5.61 ✅, `border` 3.55 ✅ (3:1 floor).
**All pass on `surface`.** The failures are all against the new `bg` — see the table above.

Dark, against surface `#1C2536`: proposed `text` `#D2DAE7` 10.91 ✅, `textMuted` `#8B95A7` 5.09 ✅,
`accent` 6.37 ✅, `good` 7.99 ✅, `bad` 5.71 ✅, `warn` 8.17 ✅, `borderStrong` 4.77 ✅,
`border` **2.89 ❌**.

---

### Summary of verdicts

| Brief claim | Verdict |
|---|---|
| Seven surface/text contrast figures | **All 7 CONFIRMED exactly** |
| Six white-on-badge contrast figures | **Arithmetic CONFIRMED exactly** |
| …the *finding* those figures support | **VOID for most call sites** — identity-hue ink is `contrastOn()`-picked, not white. One real exception (`CardAccent.tsx:114`), and it is an icon on a gradient, gated at 3:1 not 4.5:1 |
| Five normal-vision ΔE2000 figures | **All 5 CONFIRMED exactly** |
| Three deuteranopia ΔE2000 figures | **All 3 WRONG** (2–2.8× low) and the worst-offender ranking is inverted |
| CI does not assert badge-ink contrast | **CONFIRMED, and worse than suspected** — the sweep asserts `contrastOn()`, a colour the badge never uses |
| Proposed light bg↔surface 1.20 | **CONFIRMED** |
| Proposed `rule` 1.37 vs surface | **WRONG** — 1.40; 1.37 is stale, copied from a source comment |
| Proposed dark 1.25 / text 10.9 | **Both CONFIRMED** |
| Four proposed hues: contrast + L\* (8 figures) | **All 8 CONFIRMED exactly** |
| Proposed worst normal-vision ΔE = 31.3 | **CONFIRMED** |
| Proposed worst simulated ΔE = health/shop 16.8 | **WRONG** — worst is habits/health at ~11–14 |
| Unstated by the brief | Proposed light `bg` breaks **5** CI assertions; proposed dark `surface` breaks **1**; the palette has **9** identity hues, not 8 |

**Overall:** the brief's static contrast and normal-vision colour-difference maths is reliable and
reproducible to the decimal. Its two failure modes are (a) **measuring combinations the code does
not render** — the white-on-badge finding — and (b) **an unreproducible dichromacy model** that
misidentifies which hue pairs are actually at risk. It also proposes surface values that silently
break six existing CI assertions.

---

## 0.4 Home

Read-only audit. All paths absolute-relative to `/home/user/UnFocus`.

---

### 1. The Home screen and its card order

**Screen component**: `app/(tabs)/index.tsx` — `export default function HomeScreen()` at
line 184. File is 749 lines; lines 1–120 are the JSDoc header. Mounts through
`ScreenScaffold` (line 582), which owns background/particles/header chrome/BottomNav.

**Render order inside `<View style={styles.content}>` (line 594) — top to bottom:**

| # | Thing | Line | Fixed or reorderable? |
|---|---|---|---|
| 1 | `HintCard` (first-visit ⓘ, with two embedded notification switches) | 595–625 | Fixed |
| 2 | Greeting block (`DebugNoteAnchor id="home.greeting"`) + the inline **"Edit cards"/"Done"** toggle top-right | 629–663 | Fixed |
| 3 | **`EnergyMeter`** (gated on `energySystemEnabled`) | 671–675 | **Fixed — outside the reorder set** |
| 4 | **`HomeSharedCard`** (gated on `hasIncomingShared`) | 683–687 | **Fixed — outside the reorder set** |
| 5 | **`HomeCardManager`** — the reorderable stack (plans / habits / notes / shopping) | 691–699 | **Reorderable + removable** |
| 6 | "You've done N things" cumulative line | 702–708 | **Fixed to the bottom** |

`FlightOverlay` (line 711) is a sibling of `ScreenScaffold`, deliberately outside its
internal ScrollView.

**Default order constant** — `HOME_CARD_KINDS` at `app/(tabs)/index.tsx:170`:
```ts
const HOME_CARD_KINDS = ['plans', 'habits', 'notes', 'shopping'] as const;
```
Type `HomeCardKind` at line 171. This is *also* the fallback whenever the persisted order
is empty/corrupt.

**The persisted setting**:
- `store/useSettingsStore.ts:300` — `homeCardOrder: string[]` on the `Settings` type.
- `store/useSettingsStore.ts:471` — load: `readJson<string[]>(row, 'home_card_order', ['plans','habits','notes','shopping'])`.
- `store/useSettingsStore.ts:559` — FieldMap: `{ col: 'home_card_order', to: (v) => JSON.stringify(v) }`.
- `store/useSettingsStore.ts:644` — `defaultSettings.homeCardOrder = ['plans','habits','notes','shopping']`.

**Migration history (append-only) in `lib/db.ts`:**
- `lib/db.ts:656` — `ALTER TABLE settings ADD COLUMN home_card_order TEXT DEFAULT '["notes","plans","shopping"]'`
- `lib/db.ts:661` — targeted `UPDATE` → `["plans","notes","shopping"]` (Tasks first, 2026-07-20)
- `lib/db.ts:970` — targeted `UPDATE` → `["plans","habits","notes","shopping"]` (Habits card added, 2026-07-28)
- `lib/db.ts:978` — targeted `UPDATE` → `["plans","habits","goals","notes","shopping"]` (Goals card, 2026-07-28)
  — **`'goals'` is now dead**: the Goals Home card was dropped 2026-07-29 and
  `components/HomeGoalsCard.tsx` does not exist. Installs that took migration 978 still
  carry `"goals"` in the DB column; it is silently dropped at read time by
  `sanitizeHomeCardOrder` (unknown kinds are filtered) — see below. No corrective
  migration exists, and none is needed.

**How the saved reorder is applied**:
- `sanitizeHomeCardOrder(order)` at `app/(tabs)/index.tsx:174–182` — drops unknown and
  duplicate kinds, falls back to `[...HOME_CARD_KINDS]` if the result is empty.
- Applied at line 284: `const homeCardOrder = useMemo(() => sanitizeHomeCardOrder(homeCardOrderRaw), [homeCardOrderRaw])`.
- Passed to `HomeCardManager` as `order` (line 692); `renderHomeCard(kind)`
  (lines 508–572) is the per-kind render function passed as `renderCard`.
- Write-back callbacks (lines 695–697): `onReorder` → `updateSettings({ homeCardOrder: next })`;
  `onRemove` → filter the kind out; `onAdd` → append the kind.

**Edit mode / reorder mechanics** — `components/HomeCardManager.tsx` (245 lines):
- `editMode` is a **controlled prop** (line 67), owned by Home as `cardsEditMode`
  (`app/(tabs)/index.tsx:378`), flipped by the pencil "Edit cards" / green "Done" button
  rendered inline in the greeting header (lines 637–661).
- **Long-press always drags to reorder, independent of edit mode.** Each card is wrapped in
  `DraggableTaskRow` (line 148) with `handleDragStart/Move/End` (lines 97–127); drag math is
  `reorderByDrag` from `lib/reorder` (line 113). `handleDragStart` never touches `editMode`.
- **Removal**: only while `editMode` is on — a red `×` badge per card (lines 158–174),
  `handleRemove` at line 129.
- **Which cards can be REMOVED**: only the four managed kinds — **plans, habits, notes,
  shopping**. Any of them can be removed, but there is a hard floor:
  `if (order.length <= 1) return;` (line 130) plus the badge is `disabled` and dimmed
  (lines 164, 168) — **the last remaining card can never be removed**, so Home always has at
  least one preview card.
- **Re-adding**: a dashed "Add a card" tile (lines 179–192) appears in edit mode when
  `missingKinds` is non-empty (line 90), opening a `Modal` picker (lines 194–206),
  `handleAdd` at line 136.
- **NOT removable / NOT reorderable, explicitly**: the Energy meter, `HomeSharedCard`, the
  greeting, the hint card, and the "You've done N things" line. They are rendered directly by
  Home, outside `HomeCardManager` entirely.

---

### 2. THE KEY QUESTION — real feature component, or bespoke Home-only code?

**Summary verdict: 1 of 4 shared, 3 of 4 bespoke.** Only the to-do card is the real feature
component. The plan's claim that the to-do card "reportedly already" routes through the real
component is **VERIFIED**.

Cross-checked by reading each tab screen's import list directly (not inferring from names):

| Card | Component | Also rendered by its tab screen? | Evidence |
|---|---|---|---|
| To-do | `components/PlanTaskCard.tsx` | **YES (shared)** | `app/(tabs)/plans.tsx:134` imports it; mounted at `plans.tsx:1031` |
| Habits | `components/HomeHabitsCard.tsx` | **NO — bespoke Home-only** | `app/(tabs)/habits.tsx` import block (lines 72–114) has no `HomeHabitsCard` |
| Notes | `components/HomeNotesCard.tsx` | **NO — bespoke Home-only** | `app/notes.tsx` import block (lines 41–55) has no `HomeNotesCard` |
| Shopping | `components/HomeShoppingCard.tsx` | **NO — bespoke Home-only** | `app/(tabs)/shopping.tsx` import block (lines 356–415) has no `HomeShoppingCard` |

Each component's `Used by →` header line independently confirms this: `HomeHabitsCard.tsx:25`,
`HomeNotesCard.tsx:39`, `HomeShoppingCard.tsx:44` all say **only** `app/(tabs)/index.tsx`.
`PlanTaskCard.tsx:5–8` explicitly documents the shared arrangement.

#### 2a. To-do — `components/PlanTaskCard.tsx` (1371 lines) — **SHARED. Reference implementation confirmed.**

- Home mount: `app/(tabs)/index.tsx:520–538`, with `readOnly` (line 522).
- Tab mount: `app/(tabs)/plans.tsx:1031–1046`, no `readOnly`, with `onPressTask` to `/task-form`.
- Header states the contract verbatim (`PlanTaskCard.tsx:5–8`): *"The To-do tab renders it
  interactively; the Home preview renders the SAME component with `readOnly` … There is
  intentionally no Home-specific variant."* And at `plans.tsx:1029`: *"the same component Home
  mounts — there is deliberately no second implementation."*
- **Caveat worth recording**: the sharing is **layout-conditional on the tab side**. `plans.tsx`
  only mounts `PlanTaskCard` when `layoutSpec.timeline` is true (`plans.tsx:1024`, the tab's
  seeded default). For the other layouts the tab renders `TaskCard` rows inside `SectionCard`s
  (`plans.tsx:930, 958, 983, 1019, 1069, 1089, 1103`) or a bespoke in-file `FocusFirstToday`
  (line 1048). Home's card, conversely, defaults to the ruled-list layout. So the two surfaces
  share one component but only overlap on one of six layouts.
- **`readOnly` gates row tap-through ONLY** — `PlanTaskCard.tsx:588`, `726`, `762`, `801`, `1058`.
  Everything else is gated on the callback being passed, not on `readOnly` (documented at
  lines 147–151).
- **Tick-in-place: YES.** `onToggleTask` passed alongside `readOnly` (`index.tsx:524` →
  `handleToggleTask` at `index.tsx:400` → `useTaskStore.toggle`). Internally
  `handleToggle(task)` at `PlanTaskCard.tsx:581`, wired to `PadRow`'s `onToggle` at line 1061.
- **Inline add: YES.** `onAddTask` (`index.tsx:525` → `handleAddTask` at `index.tsx:429–455`,
  creates an undated task dated today). Inside the card, `typeRow` = `PadTypeRow`
  (`PlanTaskCard.tsx:896–…`) with extras for time / recurring / energy; `commitAdd()` at line 450.
- **Also passed alongside `readOnly`**: `onDeleteTask` / `deletedTasks` / `onRestoreTask`
  (`index.tsx:526–528`, handlers at `index.tsx:405–406`) and `onAddExample`
  (`index.tsx:529` → `handleAddExampleTask` at `index.tsx:410–421`).
- **Draws through `PadRow`: YES** — import at `PlanTaskCard.tsx:233`, `<PadSheet>` at 1043,
  `<PadRow>` at 1045, plus a type-row-only `PadSheet` at 1104.
- Home gives it its own layout surface `homeTodo` (`index.tsx:272` `useSurfaceLayout('homeTodo')`,
  passed as `spec` at line 535; surface declared in `lib/cardLayout.ts:46, 75`).

#### 2b. Habits — `components/HomeHabitsCard.tsx` — **BESPOKE Home-only**

- Its own header says so at lines 15–17: *"Self-contained (reads `useHabitStore` directly) —
  no props"*. Mounted prop-less at `app/(tabs)/index.tsx:545`.
- **What the tab renders instead**: an in-file `function HabitCard(...)` declared at
  `app/(tabs)/habits.tsx:202`, mounted at `habits.tsx:786`, inside a plain `Surface`
  (`habits.tsx:690`). Rows are hand-rolled `PressableScale` blocks (`habits.tsx:245, 300, 310, 333`).
- **Duplicated rendering logic** (two independent implementations of the same behaviour):
  - Due-today filtering: both call `habitOccursOn` (`habits.tsx:108` import; HomeHabitsCard
    header line 34 documents mirroring it) — but the Home card deliberately **omits** the tab's
    People/family person filter (documented `HomeHabitsCard.tsx:35–39`).
  - Increment/decrement log control: `habits.tsx:302, 312` vs `HomeHabitsCard.tsx:183, 205, 226`.
  - Progress display: both call `habitProgress` (`habits.tsx:223`, `HomeHabitsCard.tsx:179`).
  - Empty state: both render `t.noHabitsYet` + `HABIT_STARTERS` chips, explicitly cross-referenced
    in comments (`habits.tsx:749, 754`).
  - Quick-add: both use `PadTypeRow`, but with two separate creation functions —
    `HomeHabitsCard.createHabit` (line 134) / `commitHabit` (line 162) vs the tab's own
    `createHabit` + `<PadTypeRow>` at `habits.tsx:798`. `HomeHabitsCard.tsx:131` says it
    "mirrors habits.tsx's own createHabit exactly".
- **Tick-in-place: YES.** `onToggle` on `PadRow` at `HomeHabitsCard.tsx:226`
  (`isDone ? decrement(...) : counted()`); `counted` closure at line 180 wrapping
  `increment(habit.id, today)` at 183. For `dailyGoal > 1` the toggle is `undefined` and a
  `−`/`+` pair renders in `trailing` (lines 199–224).
- **Inline add: YES.** `PadTypeRow` at line 301, `onSubmit={commitHabit}` → `createHabit`.
- **Draws through `PadRow`: YES** — import at line 80, `<PadRow>` at 186, `<PadSheet>` at 298.
  (Note: it uses the shared *row* primitive while the tab does not.)

#### 2c. Notes — `components/HomeNotesCard.tsx` — **BESPOKE Home-only**

- Mounted prop-less at `app/(tabs)/index.tsx:513`. Header `Used by →` (line 39): only Home.
- **What the notes screen renders instead**: `app/notes.tsx` (179 lines) imports
  `components/NoteRow.tsx` (line 48) and renders it via a local `renderRow()` at
  `notes.tsx:110–125`, inside two hand-built sections (active / checked) split by an accent
  divider (`notes.tsx:135–155`).
- **Duplicated logic**: the active/checked split (`notes.tsx:80–81` `notes.filter(...)` vs
  `HomeNotesCard`'s own `visibleNotes`/`sunkNotes` computation and "Checked off" `Collapsible`
  zone at `HomeNotesCard.tsx:318–334`); toggle handling (`notes.tsx:114` vs
  `HomeNotesCard.handleToggle` line 183); note creation (`notes.tsx` has *no* manual add at all —
  only `VoiceNoteFAB` at line 160 — whereas the Home card has a full quick-add).
- **Behavioural divergence, not just duplication**: `NoteRow` supports inline header/body
  editing plus shopping/plans quick-action buttons; `HomeNotesCard` rows are read-only previews
  with a `⋯` send-to action (`HomeNotesCard.tsx:351`) and the card's checked notes stay in place
  until tomorrow (`checkedAt` / `isDoneRowStillInPlace`, header lines 21–24) — a rule the
  `/notes` screen does not implement.
- **Tick-in-place: YES.** `handleToggle(id)` at line 183 → `useNotesStore.toggleChecked`
  (selector line 122); wired to `PadRow`'s `onToggle` at lines 331 and 356.
- **Inline add: YES.** `PadTypeRow` at line 256, `onSubmit={commitNoteDraft}` (function at
  line 157) → `useNotesStore.add` (line 123), with extras for a body field, an "also add as a
  task" chip (→ `useTaskStore.add`, line 125) and a `TimeBoxInput`.
- **Draws through `PadRow`: YES** — import at line 81, `<PadSheet>` at 253, `<PadRow>` at 324
  and 338. `HomeNotesCard.tsx:1–2` calls itself "the reference implementation of the pad
  language every other list-bearing card follows".

#### 2d. Shopping — `components/HomeShoppingCard.tsx` — **BESPOKE Home-only**

- Mounted at `app/(tabs)/index.tsx:551–566` with 12 props. Header `Used by →` (line 44): only Home.
- **What the shopping tab renders instead**: `components/ShoppingRow.tsx` (imported
  `shopping.tsx:367`, mounted at `shopping.tsx:2086` and `1847`), plus
  `components/MonthlyTableRow.tsx` (`1719, 1748, 1767`), `components/ExpandableCard.tsx` dish
  accordions (`1716`), `components/InlineAddItem.tsx` (`1801`), `WeekListCard`,
  `ShoppingFilterBar`, `DraggableTaskRow` reorder, and `SavedListsSection`. `shopping.tsx` is
  2473 lines.
- **Duplicated logic**: week bucketing (both call `weekOfMonthlyCycle` /
  `dateRangeForCycleWeek` / `formatDateRange` — `index.tsx:139, 333, 340` vs `shopping.tsx:405`;
  the shared helpers are the only thing keeping them in agreement); dish grouping
  (`computeListGroups` at `index.tsx:335` vs `shopping.tsx:410`'s `groupByDish` /
  `groupByCategory` / `computeListGroups`); progress (`listProgress` in both); the in-cart
  section; the spend-pace line (`computeSpendPace` — `index.tsx:371` vs `shopping.tsx:414`);
  and item creation (`handleAddShoppingItem` at `index.tsx:465–496` re-implements the tab's
  own catalog/ad-hoc add, and auto-creates a week list via `addShoppingList` when none exists).
- **Shared sub-component**: both mount `components/ShoppingItemSheet.tsx`
  (`HomeShoppingCard.tsx:73` region / `shopping.tsx:393`) — that is the one editor for a weekly
  item's quantity/unit/price/category, so at least the detail editor is not duplicated.
- **Tick-in-place: YES.** `handleToggle(item)` at `HomeShoppingCard.tsx:242` (wraps the flight
  animation, falls through to the `onToggle` prop), on `PadRow`'s `onToggle` at line 418; also a
  cart-row toggle at line 385. Home supplies `onToggle` = `handleToggleShopping`
  (`index.tsx:497`) and `onCollect` = `handleCollectShopping` (`index.tsx:498`).
- **Inline add: YES.** `typeRow` at `HomeShoppingCard.tsx:255` (`PadTypeRow` + a quantity
  `Stepper` + a Weekly/Monthly target chip); `commitAdd()` at line 230 calls
  `onAddItem(name, addQty, monthlyListId)` at line 234 → `handleAddShoppingItem`
  (`index.tsx:465`).
- **Draws through `PadRow`: YES** — import at line 69, `<PadSheet>` at 366, `<PadRow>` at 376
  (cart rows) and 401 (list rows).

#### 2e. `PadRow` adoption — the actual state

`components/PadRow.tsx` is used by **exactly four files, all four of them the Home cards**:
`HomeNotesCard.tsx:81`, `HomeHabitsCard.tsx:80`, `HomeShoppingCard.tsx:69`,
`PlanTaskCard.tsx:233`. **No tab screen draws rows through `PadRow`** — `habits.tsx` hand-rolls
`HabitCard`, `notes.tsx` uses `NoteRow`, `shopping.tsx` uses `ShoppingRow`/`MonthlyTableRow`,
`plans.tsx` uses `TaskCard` (except in the timeline layout, where `PlanTaskCard` does it).
This contradicts the AGENTS.md line "every list-bearing surface should draw through it" — in
practice the pad language is Home-only plus `PlanTaskCard`.

---

### 3. The Energy card — `components/EnergyMeter.tsx` (451 lines)

- **Component**: `export default function EnergyMeter()` at `components/EnergyMeter.tsx:147`.
  Takes **no props** — reads `useSettingsStore` / `useEnergyStore` / `useTaskStore` /
  `useHabitStore` directly (lines 152–165).
- **Current form**: a plain `<Surface style={styles.card}>` (line 308). Style at line 395:
  `{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs }` —
  **deliberately tighter vertical padding than a standard card** (comment lines 391–394,
  2026-07-27 user report "the card can be vertically shorter"). **No shadow is set on the card
  itself** — `Surface` provides the material/border; the only shadow tokens in this file are on
  the individual energy pips (`pipBadge`, line 434: `shadowOffset/shadowOpacity/shadowRadius/
  elevation: 4`). No `borderColor` prop is passed, so it uses `Surface`'s default border —
  unlike the four domain cards, which pass a domain accent.
- **Contents**: header row (flash icon + `t.energyMeter.title` at 18px, line 402) with the
  `current / capacity` value hoisted onto the header line in the common single-meter case
  (`singleMeter`, line 187; rendered 315–319); one or two pip rows (`row()` at line 245); calm
  depleted / over-committed warning lines (336–361); a `Collapsible` capacity editor with
  `Stepper`s (363–378); then the permanent hint.
- **Where it sits in Home's order**: `app/(tabs)/index.tsx:671–675` — **third block**, directly
  after the greeting header and **before** `HomeSharedCard` and before the whole
  `HomeCardManager` stack. Wrapped only in `<View style={styles.section}>`, no
  `DebugNoteAnchor`, no `TourTarget`.
- **Part of the reorder set? NO.** `'energy'` is not a member of `HOME_CARD_KINDS`
  (`index.tsx:170`), it is not in `homeCardLabels` (`index.tsx:285–293`), and it is rendered
  outside `HomeCardManager`. It cannot be dragged.
- **Can it be removed in edit mode? NO.** No `×` badge is ever drawn over it (the badge is
  rendered only inside `HomeCardManager`'s per-kind `DraggableTaskRow`,
  `HomeCardManager.tsx:158–174`). The only way to make it disappear is the feature flag.
- **What gates it**: `settings.energySystemEnabled` — selector at `index.tsx:253`
  (`const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled)`), gate at
  `index.tsx:671` (`{energySystemEnabled && ( … )}`). Comment at 665–670 records that it was
  unconditional 2026-07-26 → 2026-07-31 and became a real toggle again on 2026-07-31, on by
  default. **The component's own header at `EnergyMeter.tsx:13` is now STALE** — it still says
  *"Always rendered (2026-07-26): Energy stopped being a toggle"*, which no longer matches the
  call site.
- **Permanent inline hint**: `components/CardHintNote` rendered at `EnergyMeter.tsx:384`:
  `<CardHintNote text={t.energyMeter.hint} style={styles.hint} />`. Style at line 449
  (`marginTop: 2`). It is unconditional — always present, never self-hiding (rationale in the
  header, lines 19–27: an explainer that self-destructs isn't there months later).
  - **EN** — `lib/i18n.ts:165`: `hint: 'Plan the day around the energy you actually have.'`
  - **NO** — `lib/i18n.ts:1860`: `hint: 'Planlegg dagen ut fra energien du faktisk har.'`
- Related copy on the same card: `t.energyMeter.depletedDay/depletedWeek` (`i18n.ts:169–170`
  EN / `1861–1862` NO) and `overCommittedDay/Week` (`i18n.ts:161–162` / `1858–1859`).

---

### 4. `HomeSharedCard` and the cumulative count line

#### `components/HomeSharedCard.tsx` (component at line 38)

- **Position in the order**: `app/(tabs)/index.tsx:683–687` — **fourth block**, between the
  Energy meter and the `HomeCardManager` stack. Wrapped in
  `<DebugNoteAnchor id="home.sharedPreview" … style={styles.section}>`.
- **Not part of the reorder set.** `'shared'` is not in `HOME_CARD_KINDS`; the comment at
  `index.tsx:161–163` states it explicitly: *"HomeSharedCard is a separate, automatic/
  data-driven inbox, not a discretionary card, so it stays outside this set."* It cannot be
  dragged and cannot be removed in edit mode.
- **Render condition — double-gated:**
  1. **At the call site** (`index.tsx:255–258`), `hasIncomingShared` =
     `featureSharing && (sharedTasks.some(x => x.direction === 'in' && !x.done) ||
     sharedShoppingItems.some(i => i.direction === 'in' && !i.done))`.
     `featureSharing` selector at `index.tsx:251` — off by default on a fresh install
     (Settings → Advanced → Features).
  2. **Inside the component** (`HomeSharedCard.tsx:47–52`): the same incoming filter, then
     `if (total === 0) return null;`.
     The outer gate exists specifically so no empty `styles.section` wrapper (with its
     `marginTop: Spacing.xl`) is mounted around a card that renders nothing — comment at
     `index.tsx:239–242`.
- **So: yes, it only renders when something has actually arrived** — specifically incoming,
  not-yet-actioned rows (`direction === 'in' && !done`). Outgoing/sent and done history live on
  `/shared`. Rows are read-only previews capped at `PREVIEW_PER_SECTION = 3` per section
  (`HomeSharedCard.tsx:36`, slices at 81 and 104) with a `+N` overflow chip (lines 92–96,
  117–121) and a "See all →" route to `/shared` (`openShared`, line 54).

#### The cumulative "You've done N things" line

- **Rendered at `app/(tabs)/index.tsx:702–708`** — the **last** child of the content `View`,
  after `HomeCardManager` and before the closing `</View>` (line 709). So it is **fixed to the
  bottom** of Home's content: it is not in `HOME_CARD_KINDS`, not passed to `HomeCardManager`,
  cannot be reordered, and cannot be removed in edit mode.
- **Gate**: `{completedCount > 0 && ( … )}` — so it is absent until the first task is completed.
- **Data source**: `const completedCount = useSettingsStore((s) => s.lifetimeCompletedTasks)`
  at `index.tsx:282`. That field is at `store/useSettingsStore.ts:323` (type), `:471`/`:477`
  (load, `lifetime_completed_tasks`), `:565` (FieldMap), `:650` (default `0`). It is an
  all-time counter maintained by `useTaskStore` so it survives `pruneOldData()`.
- **Styling**: `styles.pointsText` at `index.tsx:736` — `fontSize: FontSize.sm`,
  `Fonts.medium`, `textAlign: 'center'`, coloured `theme.textMuted`. Wrapped in
  `<View style={styles.section}>` (`marginTop: Spacing.xl`). It is plain centred text, **not a
  card / not a `Surface`**.
- **Copy**: `t.smallThingsCount(n)` —
  - EN `lib/i18n.ts:138`: ``(n) => `You've done ${n} thing${n !== 1 ? 's' : ''} — small things add up!` ``
  - NO `lib/i18n.ts:1838`: ``(n) => `Du har fullført ${n} ting — småting teller!` ``

---

### Things that explicitly DO NOT exist

- **`components/HomeGoalsCard.tsx` — does not exist.** Deleted 2026-07-29; `'goals'` was
  removed from `HOME_CARD_KINDS`. Goals is now reached via `SubScreenLinkButton` on Habits and
  Plans. A leftover `"goals"` entry in a user's persisted `home_card_order` (from the
  `lib/db.ts:978` migration) is silently filtered by `sanitizeHomeCardOrder`.
- **No `HomeEnergyCard` / no Home-only Energy wrapper** — `EnergyMeter` is mounted directly.
- **No `'energy'` or `'shared'` entry in `HOME_CARD_KINDS`** — neither is manageable.
- **No shared component between Home's habits/notes/shopping cards and their tab screens**
  beyond the low-level primitives (`PadRow`/`PadSheet`/`PadTypeRow`, `Surface`,
  `ShoppingItemSheet`) and the pure helper libs (`habitRecurrence`, `shoppingGroups`, `date`,
  `budget`).
- **No `components/BubbleMenu.tsx`** (confirmed absent, consistent with AGENTS.md).

---

## 0.5 Strings

### 1. Shopping nav label (`t.nav.*`) — all five BottomNav labels

Source: `/home/user/UnFocus/lib/i18n.ts`
- EN object: `nav: { … }` at **lines 965–970**
- NO object: `nav: { … }` at **lines 2901–2906**

`lib/siteNav.ts` (`SITE_ITEMS`, lines 85–91) defines the real 5 BottomNav entries, in left-to-right order, each keyed into `t.nav`: `shop`, `plans`, `home`, `habits`, `health`. `components/BottomNav.tsx` renders each tab's visible label via `label={(item) => t.nav[item.key]}` (lines 420, 432) and the centre Home button's `accessibilityLabel={t.nav[item.key]}` (line 367).

| Key | EN value | EN chars | NO value | NO chars |
|---|---|---|---|---|
| `nav.shop` (Shopping tab) | `Shopping` | 8 | `Handleliste` | 11 |
| `nav.plans` (Plans/To-do tab) | `To-do` | 5 | `Gjøremål` | 8 |
| `nav.home` (Home tab, centre) | `Home` | 4 | `Hjem` | 4 |
| `nav.habits` (Habits tab) | `Habits` | 6 | `Vaner` | 5 |
| `nav.health` (Health tab) | `Health` | 6 | `Helse` | 5 |

(Char counts are of the raw string, no trimming needed — none contain leading/trailing whitespace.)

The `nav` object also holds keys NOT rendered in BottomNav (`newTask`, `meals`, `scan`, `settings`, `capture`, `budget`, `automations`, `shared`, `settingsLabel`) — these back other UI (radial/menu-era labels, `Translations['nav']` type used elsewhere), not the 5 tab bar entries. Confirmed via `lib/siteNav.ts` header comment: "Single source of truth for 'all the app's sites' (the screens reachable from BottomNav)."

**Shopping SCREEN TITLE — a genuinely different key, confirmed distinct:**
- Key: `t.shoppingTitle`
- EN: `lib/i18n.ts:534` → `'Shopping list'`
- NO: `lib/i18n.ts:2176` → `'Handleliste'`
- Call site: `app/(tabs)/shopping.tsx:1590` — `<ScreenScaffold title={t.shoppingTitle} … >` (the screen header title)
- Also used by `components/HomeShoppingCard.tsx:302` — `{t.shoppingTitle}` (Home's shopping preview card header)

So: `t.nav.shop` (EN "Shopping" / NO "Handleliste") is the bottom-tab label; `t.shoppingTitle` (EN "Shopping list" / NO "Handleliste") is the screen's own header title. **They are different keys** with different EN text ("Shopping" vs "Shopping list") but — notably — currently **identical NO text** ("Handleliste" for both). A change to `nav.shop` alone will not touch `shoppingTitle`, but be aware the two currently read the same in Norwegian, so a NO-only edit to one may look like it "did nothing" if eyeballed only in Norwegian.

---

### 2. `Waiting for you` (`t.backlog`)

- Key: `backlog`
- EN: `lib/i18n.ts:62` → `backlog: 'Waiting for you',`
- NO: `lib/i18n.ts:1769` → `backlog: 'Venter på deg',`

**Finding: this key currently has NO render call site anywhere in the app.** Exhaustive grep for `t.backlog` (and for the raw strings "Waiting for you" / "Venter på deg") across all `.ts`/`.tsx` files turns up nothing outside `lib/i18n.ts` itself. The only other "backlog" hits in code are unrelated: `store/useTaskStore.ts`'s `backlogTasks(today)` (a data-fetch method, not a UI string) and its call site in `lib/db.ts`.

`app/(tabs)/index.tsx`'s header (lines ~96–98) explicitly documents why: *"Deliberately NOT ported: … the old pre-rebuild Backlog preview (Habits WAS on this list until 2026-07-28 — see HomeHabitsCard above)…"* — i.e. the Home "Backlog" preview card that this string used to label was dropped during the rebuild and never re-added. `DESIGN_RULES_AUDIT.md` and `PROGRESS_LOG.md` corroborate: pre-rebuild Home had a "Backlog" section (hide-entirely-when-empty pattern) that no longer exists.

**Conclusion: `t.backlog` is an orphaned/dead i18n key** — not rendered on Home, Plans, or anywhere else in the current codebase. It is neither personified in a bad way nor neutral in practice, because it never appears on screen today. If context is "renders on Home as a section header," that premise is currently false; confirm with the requester whether they mean a *planned* re-introduction, or whether they actually meant `t.tasksSectionWhenever` ('Whenever' — the current undated-tasks section on the To-do screen, see item 5) or the day-view "gap" strings (`dayViewGapUntil`, line 69). As literally named, though, both EN ("Waiting for you") and NO ("Venter på deg", a direct translation — "waiting for you") already personify identically; neither is neutral relative to the other.

---

### 3. `Log occurrence` (`t.logSymptomTrigger`)

- Key: `logSymptomTrigger`
- EN: `lib/i18n.ts:1037` → `logSymptomTrigger: 'Log occurrence',`
- NO: `lib/i18n.ts:2967` → `logSymptomTrigger: 'Logg hendelse',`

**Verdict: it is a FIELD PLACEHOLDER (+ accessibility label), not a fixed button caption.** Evidence:

Call sites (both pass it to the shared `AddRow` component as `placeholder`, not as a button's static text child):
- `app/(tabs)/health.tsx:272,279`:
  ```tsx
  <AddRow
    placeholder={t.logSymptomTrigger}
    value={quickDraft}
    onChangeText={setQuickDraft}
    onSubmit={handleQuickLog}
    accent={healthDomainColor.accent}
    confirmIcon="checkmark"
    showDivider={false}
    accessibilityLabel={t.logSymptomTrigger}
  />
  ```
- `app/health-log.tsx:121-129` — identical pattern (`confirmIcon="arrow-forward"` there instead).

`components/AddRow.tsx` (the shared component) uses that one `placeholder` string in **two** visual roles, confirmed by reading the component itself:
1. **Collapsed state** (lines 151–171): a pressable "+" bar whose visible text IS the placeholder — `<Text style={styles.addBarLabel}>{placeholder}</Text>` next to a "+" icon chip, i.e. it reads on screen as "+ Log occurrence" and functions as the tap target that expands the row (`accessibilityRole="button"`, `accessibilityLabel={accessibilityLabel ?? placeholder ?? t.a11yAdd}`).
2. **Expanded state** (lines 181–187): a real `<TextInput placeholder={placeholder} placeholderTextColor={theme.textMuted} … />` — i.e. the standard grey placeholder text inside the input field once tapped open.

So `t.logSymptomTrigger` is never a discrete "Log" action button with a fixed caption; it is the label/prompt text for a quick-entry text field (shown both on the collapsed "+" affordance and as the input's placeholder). **This matters for the planned change**: replacing it with a question-phrased prompt ("What's bothering you?") is stylistically consistent with a placeholder/field-prompt (many apps phrase input placeholders as questions), and would NOT be misapplied to a fixed button caption — but note it will also appear as the collapsed "+ What's bothering you?" tap-to-expand bar text, which is a slightly unusual (though not wrong) place for a question, so it's worth eyeballing that collapsed state specifically after the change.

---

### 4. `Freyr-mode` — every "Freyr" string

Key path: `t.config.freyrMode.label` / `t.config.freyrMode.hint` (nested under `config: {` at EN line 1214, NO line 2507; `freyrMode` sub-object at EN 1320–1323, NO 2592–2595).

| | EN | NO |
|---|---|---|
| `config.freyrMode.label` (`lib/i18n.ts:1321` / `:2593`) | `'Freyr-mode'` | `'Freyr-modus'` |
| `config.freyrMode.hint` (`lib/i18n.ts:1322` / `:2594`) | `'Adds a starter set of shopping items, tasks, a habit, and notes. Turning this off removes only what it added.'` | `'Legger til en startpakke med handleliste-varer, oppgaver, en vane og notater. Slår du den av igjen, fjernes kun det den la til.'` |

Renders at exactly one place: `app/settings.tsx:1652-1653`, inside a standalone single-toggle card on the Advanced settings tab:
```tsx
<Text style={[styles.switchLabel, { color: theme.text }]}>{t.config.freyrMode.label}</Text>
<Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.freyrMode.hint}</Text>
```
paired with `<FormSwitch checked={settings.freyrModeEnabled} onChange={handleToggleFreyrMode} />` (line 1655). No other "Freyr" string exists in `lib/i18n.ts` — the only other repo hits of "Freyr" are code identifiers/comments (`lib/freyrModeSeed.ts`, `lib/db.ts:568`, `store/useSettingsStore.ts:18,284`, `app/settings.tsx` comments) and doc files (`AGENTS.md:327`, `PREFERENCES.md:183,315`), none of which are user-facing i18n strings.

**What the feature actually does** (per `lib/freyrModeSeed.ts` header comment and the i18n hint text itself): a one-tap developer/demo toggle (Settings → Advanced tab) that seeds a fixed starter set of rows — shopping items, tasks, one habit, and notes — into the user's real data; disabling it removes exactly the rows it added (tracked via `FreyrSeedIds`) and restores any settings values it had overwritten. `lib/freyrModeSeed.ts:29` notes it encodes "Freyr's actual personal routine (2026-07-22), not placeholder content." `PREFERENCES.md:183` explicitly labels it "Personal/dev tool, not a user feature." It is gated to the Advanced settings tab, not part of onboarding.

---

### 5. `Whenever` (`t.tasksSectionWhenever`)

- Key: `tasksSectionWhenever`
- EN: `lib/i18n.ts:93` → `tasksSectionWhenever: 'Whenever',`
- NO: `lib/i18n.ts:1796` → `tasksSectionWhenever: 'Når som helst',`
- Companion keys: `tasksSectionWheneverEmpty` (EN `lib/i18n.ts:97` "Nothing here yet" / NO `:1800` "Ingenting her ennå") and `taskWhenWhenever` (EN `:111` "Whenever" / NO `:1811` "Når som helst" — a per-task "when" picker option, separate render site, not a section header).

It is a section for **undated, non-recurring tasks** on `app/(tabs)/plans.tsx` (the To-do screen). Confirmed by that file's own header/comments (e.g. lines 89, 109, 113: "section order is now Whenever → Repeating → …"; "New tasks are always created in Whenever (undated, non-recurring)").

**Render order relative to the dated list, per sub-tab:**

- **Today tab** (`plans.tsx:970-1077`): Whenever renders **above** (before) the day's own Today list — comment at lines 972-975: *"Whenever always sits on top (debug-note 2026-07-21) — undated tasks lead, the dated Today section follows."* **Exception**: when the active card layout is `focusFirst` ("One thing at a time", `layoutSpec.id === 'focusFirst'`), the Whenever `SectionCard` is suppressed entirely (`layoutSpec.id !== 'focusFirst'` gate at line 976) — its count instead surfaces only as a "Whenever" chip inside that layout's own "Later" row.
- **This week tab** (`plans.tsx:1080` onward, Whenever block at `1082-1090`): Whenever renders **above** the weekday groups, unconditionally (no focusFirst-style exception found for this tab) — comment: *"Whenever always sits on top (debug-note 2026-07-21) — before the weekday groups."*
- **All tasks tab** (`plans.tsx:923-965`): comment at line 923 states the fixed order explicitly: **"ALL TASKS (order: Whenever → Repeating → Shared)"** — Whenever (`SectionCard` at line 926) first, then Repeating, then (if `featureSharing`) the `SharedTasksSection` for sent/shared-out tasks (line 965).

So on every one of the three sub-tabs, **Whenever renders first**, ahead of the dated/day-specific content — the sole exception being the Today tab's `focusFirst` ("One thing at a time") layout, which drops the Whenever section from view entirely (though the underlying tasks remain live/reachable via the Later row's Whenever chip).

**Open design-rules conflict on this exact point**: `DESIGN_RULES_AUDIT.md` lines 122-132 ("Rule 7 — content is ordered by category, not by need") flags this as a live, unresolved audit finding: *"the Whenever card (the no-date backlog — by definition the least time-sensitive thing on the screen) renders above the day's own content… pushing today's actual list below it… Not fixed here because it's a section-order change to a tab the user reads daily…"* — i.e. this is a known, deliberately-deferred issue, not an oversight to silently "fix" as a drive-by.

---

### Copy-tone test — `lib/__tests__/copyTone.test.ts`

Yes, it exists and is a real CI gate (enforces `DESIGN_RULES.md` rule 23 by scanning every string literal in `lib/i18n.ts`, EN and NO). Read only — not modified for this audit.

**Forbidden patterns** (`BANNED` array, lines 53-70):

| Pattern | Line | Reason (as commented) |
|---|---|---|
| `/\byou missed\b/i` | 54 | EN: blames the user for an absence |
| `/\bmissed\b/i` | 55 | EN: an untaken dose/task is "still due", never "missed" |
| `/\boverdue\b/i` | 56 | EN: frames lateness as a debt |
| `/\bforgot\b/i` | 57 | EN: attributes the gap to a personal failing |
| `/\bdon'?t forget\b/i` | 58 | EN: a nag |
| `/\bshould have\b/i` | 59 | EN: retrospective judgment |
| `/\bfalling behind\b|\bbehind schedule\b/i` | 60 | EN: implies a pace the user is failing |
| `/\btoo late\b/i` | 61 | EN: closes a door |
| `/\bhurry\b|\burgent\b/i` | 62 | EN: manufactured urgency |
| `/\byou failed\b|\byou broke\b/i` | 63 | EN: direct judgment |
| `/\bglem\w*/i` | 64 | NO: "glemte/glemt/ikke glem" — blames or nags |
| `/\bgikk glipp\b/i` | 65 | NO: "missed out" |
| `/\bforsinket\b|\bfor sent\b/i` | 66 | NO: frames lateness |
| `/\bdu burde\b|\bskulle ha\b/i` | 67 | NO: retrospective judgment |
| `/\bhaster\b|\bskynd deg\b/i` | 68 | NO: manufactured urgency |
| `/\bmislyktes\b/i` | 69 | NO: "failed" |

Plus two extra checks (not regex-table-driven):
- **Line 77-82**: no countdown framing — `/\bonly \d+ (left|remaining)\b/i` or `/\bbare \d+ igjen\b/i`.
- **Line 84-111**: exclamation marks are frozen to a fixed allowlist of 13 known-celebratory strings (`ALLOWED` set, lines 88-104) — a ratchet that may shrink but never grow (adding a new "!" string anywhere in `i18n.ts` fails this test unless it's already on the list).

None of the five strings audited above ("Waiting for you"/"Venter på deg", "Log occurrence"/"Logg hendelse", "Freyr-mode"/"Freyr-modus", "Whenever"/"Når som helst") trip any BANNED pattern as currently written. A planned rewording of `logSymptomTrigger` to a question like "What's bothering you?" would also pass — it contains none of the banned stems in either language.

---

## 0.6 Health data model

All line numbers are in the working tree at `/home/user/UnFocus` as of 2026-07-31. Migration
indices are 0-based positions in the `migrations` array in `lib/db.ts` (the array literal spans
lines 272–1036).

---

### 1. `health_logs` — full current schema

Origin: `CREATE TABLE IF NOT EXISTS health_logs` inside the bootstrap `db.execSync(...)` block at
**`lib/db.ts:114–121`** (runs *before* the migrations array, on every launch, `IF NOT EXISTS`).
Five columns were then added by `ALTER TABLE` migrations.

| Column | Type | Null / default | Origin | Meaning |
|---|---|---|---|---|
| `id` | TEXT | PRIMARY KEY, not null | CREATE TABLE, `db.ts:115` | App-generated id (`generateId()` from `lib/id.ts`). Not an INTEGER rowid alias. |
| `log_date` | TEXT | `NOT NULL`, no default | CREATE TABLE, `db.ts:116` | **`YYYY-MM-DD`** — the day the issue *started*. In-memory field is `date` (renamed in the store). |
| `ailment` | TEXT | `NOT NULL`, no default | CREATE TABLE, `db.ts:117` | Free-text display name of the symptom. Kept even when `symptom_id` is set. |
| `severity` | INTEGER | `DEFAULT 3` | CREATE TABLE, `db.ts:118` | 1–5 scale. Rendered via `lib/severity.ts`. |
| `notes` | TEXT | `DEFAULT ''` | CREATE TABLE, `db.ts:119` | Free text. |
| `created_at` | TEXT | `DEFAULT (datetime('now'))` | CREATE TABLE, `db.ts:120` | **SQLite `datetime('now')` → `'YYYY-MM-DD HH:MM:SS'` in UTC**, not epoch-ms, not ISO-with-`T`. Never written by app code and never read into the store type; only `lib/widgets/headlessSnapshot.ts:240` uses it (as an `ORDER BY` tiebreaker). |
| `symptom_id` | TEXT | `DEFAULT NULL` (nullable) | **migration idx 127**, `db.ts:558` | FK-in-spirit to `symptoms.id` (no real `FOREIGN KEY` — SQLite can't `ALTER` one in). `NULL`/`''` = legacy free-text-only row; grouping then falls back to the `ailment` string. |
| `start_time` | TEXT | `DEFAULT ''` | **migration idx 132**, `db.ts:576` | **`HH:MM` 24-hour wall-clock string**, `''` = no time recorded. Pairs with `log_date`. |
| `end_date` | TEXT | `DEFAULT ''` | **migration idx 133**, `db.ts:577` | **`YYYY-MM-DD`**. `''` = **still ongoing** (see §7). |
| `end_time` | TEXT | `DEFAULT ''` | **migration idx 134**, `db.ts:578` | **`HH:MM`**, `''` = none. |
| `medicine_id` | TEXT | `DEFAULT NULL` (nullable) | **migration idx 198**, `db.ts:859` | Optional attribution to a `medicines.id` ("possibly from this medicine"). No `FOREIGN KEY`; `useMedicineStore.remove()` deliberately does **not** clear it, so a dangling id is an accepted state. |

Index: `CREATE INDEX IF NOT EXISTS idx_health_date ON health_logs(log_date);` — `lib/db.ts:258`.
There is **no index on `end_date`**, `symptom_id`, or `medicine_id`.

**Timestamp format — the answer for a planned epoch-ms `started_at`/`ended_at`:**
Every user-facing time on this table is a **split date string + time string pair**, both TEXT:
`log_date`/`start_time` and `end_date`/`end_time`, in `YYYY-MM-DD` + `HH:MM` local wall-clock,
with `''` as the "unset" sentinel (not `NULL`). **Nothing on `health_logs` is epoch-ms.** The only
machine timestamp is `created_at`, which is SQLite's `'YYYY-MM-DD HH:MM:SS'` UTC text.

Epoch-ms *does* have precedent elsewhere in this schema, if the planned columns want a consistent
style: `ifttt_rules.created_at INTEGER DEFAULT 0` (`db.ts:198`), written from `Date.now()`
(`store/useAutomationStore.ts:100`). By contrast `goals.strength_updated_at` is `TEXT`
(`db.ts:744`) holding an ISO string. So both shapes exist; **`health_logs` itself has neither.**

Note for an additive migration: `pruneOldData()` compares `log_date` against a `YYYY-MM-DD`
cutoff string (see §8) — an epoch-ms column would need its own comparison, it cannot be added to
that same `< ?` string comparison.

### Related table: `symptoms` (catalog, config-like)

`CREATE TABLE IF NOT EXISTS symptoms` — **migration idx ~126**, `lib/db.ts:551–556`.

| Column | Type | Null / default | Meaning |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Stable derived id `'sym_' + name.toLowerCase().replace(/\s+/g,'_')` (`useHealthStore.ts:120–122`) so seeding is idempotent. |
| `name` | TEXT | `NOT NULL` | Display name. |
| `category` | TEXT | `DEFAULT 'other'` | Seeded from `lib/symptomSeed.ts`. |
| `created_at` | TEXT | `DEFAULT (datetime('now'))` | Never read by the store. |

Not pruned (config table).

---

### 2. Medicine tables

#### `medicines` — **migration idx 194**, `lib/db.ts:827–840`

**Primary key type: `id TEXT PRIMARY KEY`** (`db.ts:828`), populated by `generateId()`
(`store/useMedicineStore.ts:197`). **A planned `relief_medicine_id` FK must therefore be
`TEXT`, nullable, defaulting to `NULL`** — exactly matching the existing precedent
`health_logs.medicine_id TEXT DEFAULT NULL` (`db.ts:859`). There is no INTEGER id anywhere on
this table.

| Column | Type | Null / default | Meaning |
|---|---|---|---|
| `id` | TEXT | **PRIMARY KEY** | `generateId()` string id. |
| `name` | TEXT | `DEFAULT ''` | Display name. |
| `dose` | TEXT | `DEFAULT ''` | Free text ("30 mg", "2 tablets") — never parsed. |
| `trays` | TEXT | `DEFAULT '[]'` | JSON array of `TrayId` (`'morning'|'midday'|'evening'|'night'`). Always `[]` when `as_needed`. Read via `readJson` + `toTrayIds()`. |
| `as_needed` | INTEGER | `DEFAULT 0` | PRN flag (0/1). Belongs to no tray; guarded by the two columns below. |
| `min_interval_min` | INTEGER | `DEFAULT 0` | Minimum minutes between PRN doses. 0 = no gap rule. |
| `max_per_day` | INTEGER | `DEFAULT 0` | PRN daily cap. 0 = no cap. |
| `child_name` | TEXT | `DEFAULT ''` | People/family mode. **A NAME, not a person id** — deliberate, because medicines never sync (`useMedicineStore.ts:78–81`). `''` = me. |
| `notes` | TEXT | `DEFAULT ''` | Free text. |
| `active` | INTEGER | `DEFAULT 1` | Soft on/off. Store treats `NULL` as `true` (`useMedicineStore.ts:127`). |
| `sort_order` | INTEGER | `DEFAULT 0` | Manual ordering; `load()` orders by `sort_order, created_at`. |
| `created_at` | TEXT | `DEFAULT (datetime('now'))` | **Overridden by the app**: `add()` writes `new Date().toISOString()` (`useMedicineStore.ts:213, 217`), i.e. an **ISO-8601 `YYYY-MM-DDTHH:MM:SS.sssZ` string**, NOT the column default's `'YYYY-MM-DD HH:MM:SS'`. Rows can therefore hold either format. |

Config-like — **not pruned** (`db.ts:826`, confirmed at `db.ts:1094`).

#### `medicine_doses` — **migration idx 195**, `lib/db.ts:846–853`

| Column | Type | Null / default | Meaning |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | `generateId()`. |
| `medicine_id` | TEXT | `NOT NULL` | Points at `medicines.id`. **No `FOREIGN KEY`** — the cascade is application-enforced in `useMedicineStore.remove()` (`useMedicineStore.ts:239–242`). |
| `log_date` | TEXT | `DEFAULT ''` | **`YYYY-MM-DD`**. In-memory field is `date`. |
| `tray` | TEXT | `DEFAULT ''` | A `TrayId` for a scheduled dose; `''` for an as-needed dose. |
| `taken_at` | TEXT | `DEFAULT ''` | **`HH:MM` wall-clock only** (`nowHHMM()`, `useMedicineStore.ts:158–162`) — *not* a full timestamp. |
| `note` | TEXT | `DEFAULT ''` | Free text. |

Indices: `idx_medicine_doses_date ON medicine_doses(log_date)` (**idx 196**, `db.ts:854`) and
`idx_medicine_doses_medicine ON medicine_doses(medicine_id)` (**idx 197**, `db.ts:855`).

Uniqueness of a scheduled dose is `(medicine_id, log_date, tray)`, enforced **in the store, not by
a UNIQUE constraint** (`useMedicineStore.ts:254`, via `isDoseTaken`). PRN doses (`tray = ''`) are
intentionally repeatable.

Dated history — **pruned** past `RETENTION_DAYS` (`db.ts:1095`).

#### `asNeededState` — derived, no table

`asNeededState` is **not a column and not a table**: it is a pure function in
`lib/medicineSchedule.ts:227–247` returning `AsNeededState` (`lib/medicineSchedule.ts:211–220`)
— `{ takenToday, nextAllowedMinutes, atDailyLimit, canTake }` — computed on the fly from
`medicine_doses` rows + `min_interval_min`/`max_per_day`. Nothing is persisted.

#### Related settings columns (on `settings`, not a medicine table)

| Column | Migration idx / line | Default |
|---|---|---|
| `feature_medicine` | idx 199, `db.ts:864` (+ back-fill `UPDATE` idx 200, `db.ts:865`) | `INTEGER DEFAULT 1` |
| `medicine_tray_times` | idx 201, `db.ts:868` | `TEXT DEFAULT '{"morning":"08:00","midday":"12:00","evening":"18:00","night":"21:00"}'` |
| `medicine_reminders_enabled` | idx 202, `db.ts:869` | `INTEGER DEFAULT 1` |

---

### 3. Every read/write site for health entries

**Sole owner of the SQL:** `store/useHealthStore.ts`. Every screen goes through it — no screen
issues raw SQL against `health_logs`. The one exception is the headless widget snapshot (below),
which reads the table directly because it runs without the Zustand stores.

#### Store layer — `store/useHealthStore.ts` (the only writer)

| Line | R/W | Statement | Columns touched |
|---|---|---|---|
| 144 | **read** | `loadAll('health_logs', rowToHealthLog, { orderBy: 'log_date DESC' })` | `SELECT *`; mapper (84–97) reads `id, log_date, start_time, end_date, end_time, ailment, symptom_id, severity, notes, medicine_id` |
| 145 | read | `loadAll('symptoms', …, { orderBy: 'name' })` | `symptoms.id/name/category` |
| 151–162 | **write (INSERT)** | `insertRow('health_logs', {…})` | `id, log_date, start_time, end_date, end_time, ailment, symptom_id, severity, notes, medicine_id` (`symptom_id`/`medicine_id` coerced `'' → null`). `created_at` left to the column default. |
| 170 | **write (UPDATE)** | `updateRow('health_logs', rowValues(patch, HEALTH_LOG_FIELDS), 'id = ?', [id])` | Only the patched columns, via `HEALTH_LOG_FIELDS` (107–117) |
| 176 | **write (DELETE)** | `db.runSync('DELETE FROM health_logs WHERE id = ?', [id])` | whole row |
| 127–130 | write | `INSERT OR IGNORE INTO symptoms …` (`seedSymptoms`, runs on every `load()`) | `symptoms.id/name/category` |
| 200 | write | `INSERT OR IGNORE INTO symptoms …` (`ensureSymptom`) | `symptoms.id/name/category` |
| 213–218 | read | `logsForSymptom()` — in-memory filter, matches `symptomId` else lowercased `ailment` | `symptom_id`, `ailment` |

`FieldMap` (`HEALTH_LOG_FIELDS`, lines 107–117) is the canonical field↔column map — **a new column
must be added here plus `rowToHealthLog` plus the `insertRow` literal in `add()`**, three places in
this file.

#### Screens

| File:line | R/W | What |
|---|---|---|
| `app/_layout.tsx:299` | read | `useHealthStore.getState().load()` — boot/foreground load |
| `app/(tabs)/health.tsx:105` | read | `s.logs` — weekly summary + per-(symptom,date) max-severity index (137–159); reads `symptomId, ailment, severity, date` |
| `app/(tabs)/health.tsx:106–107` | **write** | `add()` + `ensureSymptom()` |
| `app/(tabs)/health.tsx:169–179` | **write** | `addHealthStarterLog()` — writes `date=todayStr(), startTime:'', endDate:'', endTime:'', ailment, symptomId, severity:3, notes:'', medicineId:''` |
| `app/(tabs)/health.tsx:190–200` | **write** | `handleQuickLog()` — same nine fields; duration (minutes, UI-only) is converted to `endDate`/`endTime` via `addDurationToTime` (`lib/date.ts:167`). **Duration is never stored.** |
| `app/health-form.tsx:172` | read | `s.logs` → `existing = logs.find(l => l.id === id)` (190) |
| `app/health-form.tsx:194–206` | read | seeds local state from `ailment, symptomId, severity, date, startTime, endDate, endTime, medicineId`. Note 199: `ongoing = !existing.endDate` |
| `app/health-form.tsx:234–249` | **write** | `save()` builds the full nine-field payload and calls `updateLog(existing.id, payload)` or `addLog(payload)` |
| `app/health-form.tsx:255` | **write** | `removeLog(existing.id)` |
| `app/health-log.tsx:56` | read (only) | `s.logs`; groups by `symptomId || ailment.toLowerCase()` (83), reads `ailment, severity` (90–95). Header states read-only (line 21). |
| `app/health-detail.tsx:52–53` | read (only) | `logsForSymptom(symptomId, ailment)` + `logs`; builds a 90-day per-date max-severity series (63–72), reads `date, severity` |
| `app/medicine-form.tsx:83, 116` | read (only) | `useHealthStore.logs` filtered by `l.medicineId === existing.id` — the "side effects" list; renders `ailment`, `severity` (363–373) |

#### Lib helpers

| File:line | R/W | What |
|---|---|---|
| `lib/widgets/sync.ts:116–120` | read | `useHealthStore.getState().logs` filtered `endDate === '' \|\| date === today`; maps `id, ailment, severity`, and `ongoing = endDate === ''` |
| `lib/widgets/headlessSnapshot.ts:239–251` | **read, raw SQL** | `SELECT id, ailment, severity, end_date FROM health_logs WHERE end_date = ? OR log_date = ? ORDER BY log_date DESC, created_at DESC` with params `['', today]` — the only direct SQL read outside the store. **A change to the "ongoing" representation must be mirrored here.** |
| `lib/severity.ts` | read-only constants | `SEVERITY_COLORS`, `severities`, `severityInk` — shared severity ramp for all four health screens |
| `lib/symptomSeed.ts` | seed data | `SYMPTOM_SEED`, consumed by `useHealthStore.seedSymptoms()` |
| `lib/backup.ts:106–125` | read | `listTables()` + `SELECT * FROM "<table>"` — **schema-agnostic**, enumerates every user table from `sqlite_master`, so `health_logs`/`medicines`/`medicine_doses` are backed up and restored automatically. A new column needs **no** backup change. |
| `store/useHealthStore.ts:46, 165/172/178` | side effect | `scheduleWidgetSync()` after every mutation |

---

### 4. How migrations are run

**File:** `lib/db.ts`. **Pattern:** a flat array of SQL strings, replayed in order, indexed by
`PRAGMA user_version`.

- The `migrations` array literal: `lib/db.ts:272` (`const migrations = [`) through `lib/db.ts:1036` (`];`).
- Runner: `lib/db.ts:1043–1057`:

```ts
1043  const appliedVersion = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
1044  for (let i = appliedVersion; i < migrations.length; i++) {
1045    try {
1046      db.execSync(migrations[i]);
1047    } catch (e) {
...       // 'duplicate column' is swallowed; anything else is console.error'd
1052        console.error(`Migration failed: ${migrations[i]}`, e);
...
1057  db.execSync(`PRAGMA user_version = ${migrations.length}`);
```

- **Version tracking:** `PRAGMA user_version` holds the count of applied entries and is set to
  `migrations.length` after the loop. So `user_version` **is** the array length, and each entry's
  0-based index is its version boundary.
- **Current migration count: 226** (verified by parsing the array literal — every element is a
  string literal; there are no non-literal entries). Therefore **the current `user_version` on an
  up-to-date install is `226`**, the last entry is index `225`, and **a newly appended migration
  is index `226`**, bumping `user_version` to `227`.
- Bootstrap `CREATE TABLE`s run *before* the array, in one `db.execSync` block (`lib/db.ts:~60–269`),
  all `IF NOT EXISTS`.
- Errors containing `duplicate column` are swallowed, which is what makes the whole array safe to
  replay on a fresh install.

**Last three entries, verbatim with line numbers** (append in this exact style — 4-space indent,
double-quoted, trailing comma, with a `//` comment block above explaining the *why*):

```ts
1023    // settings.lifetimeGrowth (the best streak of active days ever reached). Migrations are
1024    // an append-only log, so the names stay — do NOT edit this line to match the new
1025    // fields; the FieldMap in store/useSettingsStore.ts is what maps them.
1028    "ALTER TABLE settings ADD COLUMN lifetime_bonsai_points INTEGER DEFAULT 0",
```
```ts
1029    // Guided-tour progress (2026-07-31) — a comma-separated set of completed/skipped step ids
1030    // (lib/tourSteps.ts), same storage shape as tasks.tag_ids. Device-local: it is where you
1031    // are in a walkthrough, not configuration, so it is deliberately NOT synced and NOT part
1032    // of the AI setup guide. Existing users are back-filled to 'dismissed' below so the tour
1033    // only ever greets a genuinely new install.
1034    "ALTER TABLE settings ADD COLUMN tour_progress TEXT DEFAULT ''",
```
```ts
1035    "UPDATE settings SET tour_progress = 'dismissed' WHERE setup_complete = 1",
```

(Index 223 = line 1028, index 224 = line 1034, index 225 = line 1035.)

**THE RULE — never edit an already-merged migration.** Stated in three places:

- `lib/db.ts:1037–1042`: *"the migrations array is an append-only log — never reorder or remove
  entries, since `user_version` indexes into it."*
- `lib/db.ts:16–18` (file header): *"Add columns via the `migrations` array ONLY — never edit a
  CREATE TABLE to change an existing table."*
- `AGENTS.md`: *"Migrations in `lib/db.ts` are an append-only log — `PRAGMA user_version` indexes
  into the array, so an already-merged line must never be edited, reordered, or removed. Fixing a
  migration's behaviour after the fact means appending a new corrective `UPDATE`, not touching the
  old line."*

Concrete precedent for the corrective-append pattern: `db.ts:818` (`"UPDATE settings SET
energy_system_enabled = 1"`) supersedes two earlier conditional flips rather than editing them.

**A new health column is therefore: one appended `"ALTER TABLE health_logs ADD COLUMN … DEFAULT …"`
string at index 226 (before the closing `];` at line 1036), plus the three touch points in
`store/useHealthStore.ts` (§3).**

---

### 5. Sync status — definitive answer

**No. `health_logs`, `symptoms`, `medicines` and `medicine_doses` are NOT synced between paired
devices.**

`lib/liveSync.ts:47`:
```ts
export type SyncTable = 'tasks' | 'shopping_items' | 'people' | 'tags';
```
`lib/liveSync.ts:50`:
```ts
const SYNC_TABLES: readonly SyncTable[] = ['tasks', 'shopping_items', 'people', 'tags'] as const;
```
`lib/liveSync.ts:53` — `TABLE_COLUMNS: Record<SyncTable, string[]>` whitelists syncable columns for
exactly those four tables. `lib/syncService.ts:33, 107` consumes the same `SyncTable` type.

Corroborating evidence:
- `store/useMedicineStore.ts:78–81` — `child_name` is a NAME rather than a person id specifically
  *"because medicines never sync, so no second device can disagree about who this is."*
- `store/useHealthStore.ts` neither imports `lib/liveSync` nor `lib/syncService`, and calls no
  `touchRow`/`softDelete`/`broadcastRow`.
- `lib/liveSync.ts:33` — *"Adding a table means adding it to BOTH `SyncTable` and `SYNC_TABLES`."*

**Consequence for the planned migration:** a new `health_logs` column carries **none** of the
extra sync requirements — no `TABLE_COLUMNS` entry, no LWW/tombstone (`updated_at`/`deleted_at`/
`origin_device_id`) handling, no cross-device conflict story. `health_logs` also has none of those
meta columns to begin with. It is purely device-local, and the only cross-device path is
`lib/backup.ts`, which is schema-agnostic and needs no change.

---

### 6. AI setup guide — health/medicine exclusion confirmed

**`AI_SETUP_SCHEMA_VERSION` is currently `3`** — `lib/aiSetupGuide.ts:63`:
```ts
export const AI_SETUP_SCHEMA_VERSION = 3;
```

**Importable domains** are enumerated by `AiSetupResult` in `lib/aiSetupApply.ts:72–81`:
```ts
  tasks: DomainResult;
  habits: DomainResult;
  goals: DomainResult;
  notes: DomainResult;
  shoppingLists: DomainResult;
  shoppingItems: DomainResult;
  inventoryItems: DomainResult;
  catalogueItems: DomainResult;
  meals: DomainResult;
  monthlyLists: DomainResult;
```
There is **no `health` and no `medicines` domain**, no `processHealth*`/`processMedicine*`
function, and `aiSetupApply.ts` does not import `useHealthStore` or `useMedicineStore` (import
list, `aiSetupApply.ts:13–17`).

**Explicit exclusion in the guide text** — `lib/aiSetupGuide.ts:232–234`:
```
- Automations (IFTTT-style "when X, do Y" rules) and health-log entries are
  NOT supported by this import. If asked, say this app version can't set
  those up this way — the human can still add them manually in the app.
```
and the footer, `lib/aiSetupGuide.ts:340–342`:
```
  const footer = `Guide version: ${AI_SETUP_SCHEMA_VERSION}
Reminder: automations (IFTTT-style rules) and health-log entries cannot be
set up through this file yet — add those directly in the app.`;
```

**Medicine exclusion** — `lib/aiSetupGuide.ts:31–38` (file header edit note):
```
 *   - **Medicines and doses (2026-07-27) are deliberately OUT of scope** — do not add a
 *     medicine domain here. Medicine names and doses are the most sensitive rows in the
 *     database, and this guide already refuses health-log data for the same reason. The
 *     exclusion is intentionally NOT spelled out in the guide's own text: no `medicines`
 *     ... `health_logs.medicine_id`.
```
Mirrored at `store/useMedicineStore.ts:39–41`.

**Implication:** a new `health_logs` column requires **no** `lib/aiSetupGuide.ts` /
`lib/aiSetupApply.ts` change and **no** `AI_SETUP_SCHEMA_VERSION` bump — the AGENTS.md cookbook
rule ("if this column is on a domain the guide already imports…") does not apply, because health
is not an imported domain. The only `health_logs` reference in the guide is the `medicine_id`
mention in the header comment (`aiSetupGuide.ts:38`), which is documentation, not schema.

---

### 7. Does anything like `episode_state` or a duration column already exist?

**No — there is no `episode_state` column, no status/state enum, and no duration column on
`health_logs`.**

What *does* exist is a weaker, implicit two-state convention:

- **Open/closed is encoded as `end_date === ''`.** `''` means still ongoing. It is a sentinel on a
  date string, not a state column. Documented at `lib/db.ts:573–575` (*"end_date = '' means still
  ongoing"*) and `store/useHealthStore.ts:18–19, 52`.
- Every consumer re-derives "ongoing" from that same string test, in four places:
  `app/health-form.tsx:199` (`ongoing = !existing.endDate`), `app/health-form.tsx:237–238`
  (`ongoing ? '' : …`), `lib/widgets/sync.ts:116, 119, 120` (`ongoing: l.endDate === ''`), and
  `lib/widgets/headlessSnapshot.ts:240, 244, 248` (`end_date = ?` with `''`).
- There are **only two states** — open (`end_date === ''`) or closed (`end_date` set). No
  paused/resolved/relapsed/aborted state exists anywhere.
- **Duration is never stored.** `app/(tabs)/health.tsx`'s Quick log takes a duration in minutes as
  UI-only local state and converts it at save time into `endDate`/`endTime` via
  `addDurationToTime()` (`app/(tabs)/health.tsx:189, 193–194`; helper at `lib/date.ts:167`). The
  file header says so explicitly (`app/(tabs)/health.tsx:65–66`: *"duration (minutes) is
  quick-log-only UI that's converted to `endTime`/`endDate`"*). Any duration shown is computed
  from the two date/time pairs on the fly.
- Note the wall-clock-only limitation this creates: `start_time`/`end_time` are `HH:MM` with no
  date-of-day beyond `log_date`/`end_date`, and `''` is a valid value for either, so an episode's
  real elapsed time is currently not reliably computable. That is the gap epoch-ms
  `started_at`/`ended_at` would close.

---

### 8. Retention — `pruneOldData()` and open episodes

`RETENTION_DAYS = 365` — `lib/db.ts:51`.
`pruneOldData()` — `lib/db.ts:1069–1097`, called once on startup. Cutoff is a `YYYY-MM-DD` string
(`const c = dateStr(cutoff)`, `db.ts:1072`), which compares correctly against both `YYYY-MM-DD`
columns and `'YYYY-MM-DD HH:MM:SS'` timestamps (`db.ts:1066–1067`).

The health/medicine statements:
```ts
1083    db.runSync('DELETE FROM health_logs WHERE log_date < ?', [c]);
1095    db.runSync('DELETE FROM medicine_doses WHERE log_date < ?', [c]);
```
`symptoms` and `medicines` are **not** pruned (config tables — `db.ts:826`, `db.ts:1094`,
`useHealthStore.ts:27–28`). The whole function is wrapped in `try { … } catch {}`
(`db.ts:1073, 1096`) so it never blocks startup.

**Answer: YES — an episode left open longer than 365 days WOULD be deleted.**

The predicate is purely `log_date < cutoff`. It looks **only at the start date** and does **not**
consider `end_date` at all, so it makes no distinction between a closed episode and one still
ongoing. A health entry started more than 365 days ago with `end_date = ''` — i.e. an episode the
user still considers active — is silently deleted on the next launch.

This is different in kind from the task rule immediately above it, which deliberately spares live
rows: `db.ts:1079–1082` prunes tasks only `WHERE recurring = 'none' AND has_start_date = 1 AND
done = 1 AND task_date < ?`, with the comment *"undone tasks are still live backlog"*
(`db.ts:1074–1078`). **There is no equivalent `AND end_date != ''` guard on the `health_logs`
delete.**

**Recommendation for the planned feature:** if long-running episodes are a supported case, the same
migration pass should append a corrective change to the prune predicate — e.g. sparing rows where
the episode is still open — following the tasks precedent. Note this is a change to
`pruneOldData()`'s function body, **not** a migrations-array entry, so the append-only rule does
not apply to it; the function is ordinary code and may be edited directly.

---

### Quick reference — the checklist for one additive `health_logs` column

1. Append **one** `"ALTER TABLE health_logs ADD COLUMN … DEFAULT …"` string at **index 226**,
   immediately before `];` at `lib/db.ts:1036`, with a `//` comment above explaining the why.
   Never touch an existing entry. `user_version` becomes 227 automatically.
2. `store/useHealthStore.ts`: add the field to the `HealthLog` type (48–61), to `rowToHealthLog`
   (84–97), to `HEALTH_LOG_FIELDS` (107–117), and to the `insertRow` literal in `add()` (151–162).
3. Update the callers that build a full payload: `app/health-form.tsx:234–244`,
   `app/(tabs)/health.tsx:169–179` and `:190–200` (all three pass every field explicitly and will
   fail typecheck otherwise).
4. If the column affects "ongoing", mirror it in `lib/widgets/sync.ts:116–120` **and** the raw SQL
   at `lib/widgets/headlessSnapshot.ts:239–251`.
5. **No** sync work (§5), **no** AI-setup-guide work and no `AI_SETUP_SCHEMA_VERSION` bump (§6),
   **no** backup work (`lib/backup.ts` is schema-agnostic).
6. Consider the retention gap in §8 separately.
7. Update the `Connections:`/`Edit notes` headers of every file touched, per AGENTS.md.

---

## 0.7 Screen order + headers (Part B pre-work)

Read-only audit of the current repo state at `/home/user/UnFocus` (2026-07-31). Nothing was
modified. All line numbers are from the files as they stand on this branch.

**Tab order verified.** `app/(tabs)/_layout.tsx:482–486` registers, in order:
`shopping` → `plans` → `index` (Home) → `habits` → `health`. This matches AGENTS.md's
Shopping / Plans (To-do) / Home / Habits / Health and `lib/siteNav.ts`'s `SITE_ITEMS`
(pinned by `lib/__tests__/motifs.test.ts`, which checks the backdrop strip's panel order
against it). Home is the centre tab; `unstable_settings.initialRouteName = 'index'`
(`_layout.tsx:315`) is the deep-link back target, while the *runtime* initial tab is
`settings.startScreen`, frozen at mount (`_layout.tsx:326–330`, `449`).

---

### 1. Per-tab top-to-bottom render order

Every tab mounts `ScreenScaffold` with `tier="site"`, `bottomNav={false}`,
`pagerFloatingNav`, `ownBackground={false}`. The scaffold draws, in fixed order:
L1/L2 background (hoisted to the pager — off here), the **header band**, an optional
**sticky-below-header** slot, then the scroll content. So "position 0" on every screen is
the header, and only Shopping and Plans have anything in the sticky slot.

#### 1a. Shopping — `app/(tabs)/shopping.tsx`

| # | Element | Lines |
|---|---|---|
| 0 | `ScreenHeader` band (title + controls — see §2) | 1590 |
| 0b | **Sticky bar**: `TabSlider` — 2 segments, `Week lists` / `Monthly list`; each segment carries an `accessory` node (count badge + the cross-tab green ✓ cue) | 1424–1458, 1463–1472 |
| 1 | `HintCard` (`noPill`, header-driven) — **with an embedded settings block**: weekly-reset day chip row + monthly-reset-date `TextInput` | 1477–1526 |
| 2 | `StarterCard` (text-only, two bullets) — gated `lists.length === 0 && items.length === 0` | 1539–1541 |
| 3 | `SharedRequestsSection kind="shopping"` — gated `featureSharing` | 1545 |
| 4 | **`foodCatalogueLinks`** — two-button row (Food / Catalogue), wrapped in `TourTarget`. **Rendered before the tab conditional → visible on BOTH tabs.** | 1556–1586, mounted 1599 |
| 5 | *(tab === 'monthly')* `ShoppingFilterBar` (search + category), gated `anyMonthlyItems` | 1605–1613 |
| 6 | *(monthly)* empty placeholder Surface, **or** one `Surface` card per Monthly list | 1615–1862 |
| 6a | ↳ card header row: lock `IconButton` + name (tap-to-rename) ∥ Budget pill + `file-tray-full-outline` + kebab `⋮` | 1630–1693 |
| 6b | ↳ per-list spend-pace line | 1695–1699 |
| 6c | ↳ items: dish groups (`ExpandableCard` → `MonthlyTableRow`) → category clusters / flat `rowsCard` → total line | 1706–1786 |
| 6d | ↳ **`InlineAddItem`** ("+ Add item", collapsed bar → in-place form) | 1801–1806 |
| 6e | ↳ "Add dish" trigger (opens `AddDishSheet`, `mode:'monthly'`) | 1813–1822 |
| 6f | ↳ **resolved zone**: "Purchased this month", per-trip collapsible, `ShoppingRow variant="purchased"` | 1827–1857 |
| 7 | *(monthly)* `NewMonthlyListRow` ("+ new list") | 1864 |
| 8 | *(monthly)* "Reset all lists" text link | 1866–1871 |
| 9 | *(tab === 'weekly')* unsaved-lists badge (lock-open icon + count) | 1877–1885 |
| 10 | *(weekly)* **Unallocated** card (dishes pushed from Food, not yet in a dated list) | 1890–1945 |
| 11 | *(weekly)* `SavedListsSection` (accordion of template lists, drag targets) | 1949–1956 |
| 12 | *(weekly)* four week sections (`SectionDivider` between), each a drop target, each holding `DraggableTaskRow` → `WeekListCard` | 1965–2109 |
| 13 | *(weekly)* big `EmptyState` card — only when no lists, no templates, no unallocated | 2111–2122 |
| 14 | *(weekly)* "+ New list" trigger (plain surface button, icon only) | 2130–2144 |
| — | Sheets/overlays (siblings, not in flow): `AddDishSheet` 2150, `UpdateSheet` 2159, `MonthlyResetReviewSheet` 2161, `MonthlyResetSummaryModal` 2170, `SavedListsModal` 2172, `ListSettingsSheet` 2179, `LayoutPickerSheet` 2190, `ShoppingItemSheet` 2195, `FlightOverlay` 2201, `ConfirmationBanner` 2202, two confirm `Modal`s 2209 / 2228 | |

`WeekListCard`'s own internal order (`components/WeekListCard.tsx`): header (badge/lock/name/save-discard/kebab) 410–500 → **"To buy"** section 506–638 → **`InlineAddItem` add row 645** → **"In cart"** 708–744 → **"Purchased" (collapsed `ExpandableCard`)** 746–774 → green "Done shopping" CTA 776–790.

Against the proposed law: **no state strip** (the old summary line under the tabs was deleted 2026-07-21 — see the note at 1460–1470), sub-screen navigation (Food/Catalogue) sits at **position 4, above the list**, not at the bottom, and the resolved zone is per-card, not per-screen.

#### 1b. To-do / Plans — `app/(tabs)/plans.tsx`

| # | Element | Lines |
|---|---|---|
| 0 | `ScreenHeader` band | 823–837 |
| 0b | **Sticky bar**: `TabSlider` — `Today` / `This week` / `All tasks`; per-segment count accessory only under the `focusFirst` layout | 785–820 |
| 1 | `HintCard` (`noPill`) | 844 |
| 2 | `StarterCard` + `StarterExampleRow` ("Tidy up") — gated `tasks.length === 0 \|\| planStarterAdded`, suppressed on `today` + timeline layout | 859–875 |
| 3 | Person filter row (`Collapsible`, People mode + >1 person) | 879–897 |
| 4 | `EnergyBalanceCard` — gated `energySystemEnabled && showPeople && tab !== 'all'` | 901 |
| 5 | Tag filter row (`Collapsible`, tags exist) | 905–921 |
| 6 | *(tab === 'all')* `SectionCard` **Whenever** (rows + the one always-present `AddRow`) | 926–948 |
| 7 | *(all)* `SectionCard` **Recurring** | 951–963 |
| 8 | *(all)* `SharedTasksSection` — gated `featureSharing` | 965 |
| 9 | *(tab === 'today')* `SectionCard` **Whenever** — `DoneSplitList`, suppressed only for `focusFirst` | 976–987 |
| 10 | *(today)* the day itself — one of four shapes: **By person** `SectionCard`s 998–1023 ∥ **timeline** `PlanTaskCard` 1031–1046 (the default) ∥ **`FocusFirstToday`** 1052–1058 ∥ plain `SectionCard` + `DoneSplitList` 1060–1072 | 990–1075 |
| 11 | *(tab === 'week')* `SectionCard` **Whenever** | 1083–1092 |
| 12 | *(week)* one `SectionCard` per weekday, each `DoneSplitList` + inline add | 1094–1107 |
| 13 | **`SubScreenLinkButton` "Edit Goals"** — bottom of the screen, all tabs, gated `featureGoals`; opens `GoalsSheet` (popup, not a route) | 1119–1126 |
| — | `LayoutPickerSheet` 1128, `GoalsSheet` 1133 | |

`DoneSplitList` (defined 197–284) renders: unfinished cards 246 → "The rest" collapsible (focus mode) 247–261 → **`footer` (the add row) 262** → **`Done (n)` zone 263–281**.

#### 1c. Home — `app/(tabs)/index.tsx`

| # | Element | Lines |
|---|---|---|
| 0 | `ScreenHeader` band (`isHome`) | 582–593 |
| 1 | `HintCard` (`noPill`) — **with two embedded `Switch`es** (task notifications, weekly reminders) | 595–625 |
| 2 | Greeting block (`greeting()` + date) **+ inline "Edit cards" / "Done" toggle top-right** | 629–663 |
| 3 | `EnergyMeter` — gated `energySystemEnabled` | 671–675 |
| 4 | `HomeSharedCard` — gated `featureSharing && hasIncomingShared` | 683–687 |
| 5 | `HomeCardManager` — user-ordered stack of `plans` / `habits` / `notes` / `shopping` cards (`settings.homeCardOrder`, default order at 170) | 691–699 |
| 6 | "Small things add up" completed count — gated `completedCount > 0` | 702–708 |
| — | `FlightOverlay` (sibling) 711 | |

Home has no sticky bar, no sub-screen link buttons (Notes is reached by tapping `HomeNotesCard`'s title; Shopping by tapping `HomeShoppingCard`'s header).

#### 1d. Habits — `app/(tabs)/habits.tsx`

| # | Element | Lines |
|---|---|---|
| 0 | `ScreenHeader` band | 662–671 |
| 1 | `HintCard` (`noPill`) | 679 |
| 2 | **One `Surface` "habits card"** (was a `SectionCard`; the duplicate "Habits" heading was dropped 2026-07-30) containing 3–5: | 690–822 |
| 3 | ↳ person filter `ScrollView` (`Collapsible`, People mode) | 692–712 |
| 4 | ↳ `SlideSelector` view tabs — Today / Week / Month | 719–724 |
| 5 | ↳ *(Today, kept mounted via `display:none`)* habit rows, **or** `StarterCard` + 2 starter chips (no habits at all), **or** the quiet "none due today" surface | 734–790 |
| 6 | ↳ **`PadTypeRow`** — the always-open "Type habit" line, at the foot of the Today list | 798–804 |
| 7 | ↳ *(Week)* `WeekView` grid / *(Month)* `MonthView` grid | 807–821 |
| 8 | **`SubScreenLinkButton` "Edit Goals"** — bottom, gated `featureGoals`, opens `GoalsSheet` | 834–841 |
| 9 | spacer `View` | 843 |

There is **no `Done (n)` zone anywhere on Habits** — a met habit is struck/checked in place (deliberate; see the "X / Y done" removal note at 735–736).

#### 1e. Health — `app/(tabs)/health.tsx`

| # | Element | Lines |
|---|---|---|
| 0 | `ScreenHeader` band | 209–218 |
| 1 | `HintCard` (`noPill`) | 220 |
| 2 | `StarterCard` + `StarterExampleRow` — gated `logs.length === 0 \|\| healthStarterAdded` | 231–248 |
| 3 | **`MedicineTrayCard`** — gated `featureMedicine` (deliberately ABOVE Quick log) | 255 |
| 4 | **Quick log** card (`TourTarget` → `DebugNoteAnchor` → `Surface`): badge+label row 263–270, `AddRow` 271–280, then a conditionally-revealed block (start time + duration + severity chips) 281–329 | 259–333 |
| 5 | **This week** card: badge+label 339–343, empty line 344–346, per-symptom rows (name + bar + count + 7-day severity strip) 347–394, and a **footer link to `/health-log`** folded into the card 398–408 | 336–411 |
| 6 | spacer `View` | 413 |

`MedicineTrayCard` internal order: header badge/title/reminder toggle 185–199 → `StarterCard` when no medicines (~205) → reminder panel (`Collapsible`) → 4 tray sections (morning/midday/evening/night) → As-needed section 348–430 → **`AddRow` at the very bottom 431–439**. No `Done (n)`.

Health has no sticky bar and no `SubScreenLinkButton` — its one sub-screen link is *inside* the This-week card.

---

### 2. Header inventory

`components/ScreenHeader.tsx` is the only implementation. Site-tier assembles
`siteControls` at **line 403–405** in this fixed order (right-handed; the whole row mirrors
when `settings.leftHanded`, gear stays outermost):

```
[update] [bug] [✓ email] [✕ delete] [layout] [scan] [share] [ⓘ info] [gear]
```

Every entry is `null` unless its condition holds, then filtered.

| Icon | Rendered when | Line |
|---|---|---|
| ☁ `cloud-download-outline` (or spinner) | `isHome && (isUpdateAvailable \|\| isUpdatePending)` from `Updates.useUpdates()`; polled on mount / foreground / 10 min. Silent no-op in dev (`Updates.isEnabled` false) | 334–348, poll 183–199 |
| 🐛 `bug` | `settings.debugModeEnabled` — **only turns debug OFF**; turning it on is Settings → Advanced | 357–368 |
| ✓ `checkmark-circle` (green, email all notes) | `debugModeEnabled`; dimmed at 0 notes | 370–381 |
| ✕ `close-circle` (red, delete all notes) | `debugModeEnabled`; dimmed at 0 notes | 383–394 |
| ☰ `list-outline` (layout picker) | screen passes `onLayoutPress` | 305–315 |
| 📷 `camera-outline` | screen passes `onScanPress` | 291–301 |
| ↗ `share-social-outline` | screen passes `onSharePress` | 280–290 |
| ⓘ `information-circle(-outline)` | screen passes `onInfoToggle`; filled + accent when `infoActive` | 316–331 |
| ⚙ `settings-outline` → `/settings` | **always, site tier** | 269–279 |

Sub tier (**454–466**) is: iOS-only "Back" text link → title → `rightSlot` (`headerRight`).
Grep confirms only `app/health-form.tsx:273` and `app/habit-form.tsx:352` ever pass
`headerRight` — **every sub-screen in the audit list is title-only.**

#### Per-screen

| Screen | Tier | Header controls (default install, debug off) | Deviation from `title + ⓘ + ⚙` |
|---|---|---|---|
| Shopping `(tabs)/shopping.tsx:1590` | site | `[layout] [scan] [share?] [ⓘ] [⚙]` — `onLayoutPress` always, `onScanPress` always (`/scan`), `onSharePress` only if `featureSharing` (`/share-modal?kind=s`) | **Worst: 4–5 icons.** +layout +scan +share |
| To-do `(tabs)/plans.tsx:823` | site | `[layout] [share?] [ⓘ] [⚙]` | +layout, +share (`?kind=t`) |
| Home `(tabs)/index.tsx:582` | site | `[☁?] [ⓘ] [⚙]` | +cloud when an OTA is available/pending |
| Habits `(tabs)/habits.tsx:662` | site | `[ⓘ] [⚙]` | ✅ conforms |
| Health `(tabs)/health.tsx:209` | site | `[ⓘ] [⚙]` | ✅ conforms |
| `app/notes.tsx:127` | **site** (!) | `[⚙]` only — **no `onInfoToggle` passed**, so its `HintCard` (129) renders its own in-content ⓘ pill instead | Title + gear; hint toggle is in the content, not the header. Also: `bottomNav` defaults to `true` and is not overridden, so this screen renders its own `BottomNav` |
| `app/goals.tsx:135` | **site** | `[ⓘ] [⚙]` | Same `bottomNav` default note as Notes |
| `app/food.tsx:39` | sub | title only (+ iOS back) | title-only ✅ |
| `app/catalogue.tsx:49` | sub | title only (+ iOS back), `scrollable={false}` | title-only ✅ |
| `app/budget.tsx:123 / 135` | sub | title only (+ iOS back); two variants (global vs per-list title) | title-only ✅ |
| `app/scan.tsx:581 / 653 / 750` | sub | title only (+ iOS back); three scaffolds (idle / result / manual) | title-only ✅ |
| `app/health-log.tsx:112` | sub | title only (+ iOS back) | title-only ✅ |
| `app/settings.tsx:730` | sub | title only (+ iOS back) + a `TabSlider` in `stickyBelowHeader` (General/Personal/Advanced) | title-only ✅. Note: `ScreenHeader`'s edit note (line 47–54) says Settings is the `plainBackground` exception, but `settings.tsx` no longer passes `plainBackground` — that comment is stale |

With debug mode **on**, every site-tier header gains 3 more icons; Shopping then shows up to
**8** (bug, ✓, ✕, layout, scan, share, ⓘ, gear) — the documented title-ellipsis edge case
(ScreenHeader 84–88).

**Layout-picker gap worth noting:** `LayoutPickerSheet` is only reachable from Shopping and
Plans headers. Home's cards resolve their own layouts (`useSurfaceLayout('homeTodo')`,
`('shopping')` — `index.tsx:272`, `347`) but Home has **no** header layout icon, so
`homeTodo`'s layout has no in-app entry point except Settings → Personal → Layout's global
default.

---

### 3. Accent-fill audit (solid `backgroundColor`, full opacity)

Two classes are listed separately because they read differently on screen:
**(A)** the brand token `theme.accent`, and **(B)** other full-opacity identity/status fills
(`CardAccentBadge`'s domain gradient, `theme.good`, a domain accent, a person colour, a
severity colour). Low-alpha washes (`accentSoft`, `goodSoft`, `rgba(accent, 0.05)`,
`CardAccentWash`) are **excluded** per the brief.

#### Shopping

**A — `theme.accent` solid:**
| Element | File:line | Notes |
|---|---|---|
| `TabSlider` active pill | `components/TabSlider.tsx:168` (colour set `shopping.tsx:1425–1426`) | always on screen (sticky) |
| Tab count badge | `shopping.tsx:1442` | when active + `ukelisteBadge > 0` |
| Weekly-reset day chip (selected) | `shopping.tsx:1492` | inside the ⓘ hint |
| `MonthlyTableRow` "+" stepper | `components/MonthlyTableRow.tsx:89` | **one per monthly row** |
| `MonthlyTableRow` check (pendingRestock) | `MonthlyTableRow.tsx:117` | per row |
| `InlineAddItem` qty "+" | `components/InlineAddItem.tsx:269` | one per open add form |
| `WeekListCard` "In cart" section rule | `components/WeekListCard.tsx:716` | per week list |
| `NewSinceGlow` edge | `components/NewSinceGlow.tsx:119` | transient after a layout switch |

**B — other solid fills:** Food link badge `shopping.tsx:1569` and Catalogue link badge
`:1581` (`CardAccentBadge`, domain gradient); `WeekListCard.tsx:420` shop badge (per list);
green cross-tab ✓ cue `:1450`; Unallocated 4px meal bar `:1892`; "Allocate" buttons `:1904`,
`:1933` (`theme.good`); `WeekListCard.tsx:513` "To buy" rule and `:783` "Done shopping" CTA
(`theme.good`); `ShoppingRow.tsx:378/380/381` checks (`theme.good`, **per row**).

**Count — Shopping: 8 distinct `theme.accent` fills (several multiplied per row/per list) + ~8 other solid fills. This is by far the highest; the review's expectation is CONFIRMED.**

#### To-do / Plans

**A:** `TabSlider` pill (`TabSlider.tsx:168`, no per-option colour → falls back to
`theme.accent`; mounted `plans.tsx:790`) · `AddRow` collapsed "+" chip
(`components/AddRow.tsx:163`) and expanded confirm (`AddRow.tsx:226`) — accent for the
Today/weekday adds (`plans.tsx:1067`, `1101`, `1057`), task-blue for Whenever · `TagChip`
selected (`components/TagChip.tsx:56`) · `PersonChip` "Everyone" selected
(`components/PersonChip.tsx:96` — falls back to `theme.accent` with no colour) · under the
**timeline layout (the tab default)**: `PlanTaskCard.tsx:608` grid card when happening-now/done,
`components/DayGridLines.tsx:78–79` now-dot + now-bar, `PadTypeRow.tsx:167` confirm button.

**B:** `SectionRail` badge per section (`components/SectionRail.tsx:74`) or hue dot (`:76`) —
Whenever / Recurring / Today / 7 weekday cards each ⇒ **up to 9 on the This-week tab** ·
`PersonChip` per-person fills · `TaskCard.tsx:711` done check + `:784`/`:958` step checks
(`theme.good`) · `SubScreenLinkButton.tsx:50` Goals badge.

**Count — Plans: 5–8 `theme.accent` fills (layout-dependent) + up to ~12 other solid fills.**

#### Home

**A:** "Done" edit-mode button `index.tsx:639` · `EnergyMeter.tsx:278` pip badges (**one per
energy pip**) · `HomeSharedCard.tsx:61` accent bar (only when something is incoming) ·
`Stepper.tsx:80` "+" inside `HomeShoppingCard`'s type row · `PadTypeRow.tsx:167` confirm ×4
cards · `DayGridLines.tsx:78–79` if the to-do card is in timeline layout.

**B:** four `CardAccentBadge`s, one per preview card — `PlanTaskCard.tsx:974`,
`HomeHabitsCard.tsx:246`, `HomeNotesCard.tsx:216`, `HomeShoppingCard.tsx:299` ·
`HomeHabitsCard.tsx:214` per-row "+" (domain accent) · `PadRow.tsx:165` done check (domain
accent, per done row) · `HomeCardManager.tsx:162` remove badge (`theme.bad`, edit mode).

**Count — Home: ~4–6 `theme.accent` fills (the pip row alone is n fills) + 4 badges + per-row fills.**

#### Habits

**A:** `SlideSelector.tsx:131` active pill (always) · `PadTypeRow.tsx:167` confirm ·
`habits.tsx:252` habit accent bar and `:311` "+" button — both `barColor`, which **is**
`theme.accent` for any partially-done habit (`progressColor`, `habits.tsx:123–128`), so this
is **2 accent fills per in-progress habit row** · `habits.tsx:191`, `:420`, `:515` week/month
dots filled with `progressColor` ⇒ accent for partial days (**dozens on the Month grid**) ·
`PersonChip` "Me" selected.

**B:** `SectionRail`/`SubScreenLinkButton.tsx:50` Goals badge · `theme.good` variants of the
same bar/dots when a habit is met · rest-day button `habits.tsx:337` (`theme.textMuted`).

**Count — Habits: 1 fixed accent fill + 2 per in-progress row + n grid dots. Second-worst by multiplicity, though it has no tab-count badges.**

#### Health

**A: zero.** Health mounts no `TabSlider`/`SlideSelector`, and every add affordance passes
`healthColor.accent` (the health domain hue), not `theme.accent` — `AddRow.tsx:163/226`
(Quick log `health.tsx:276`, Medicine `MedicineTrayCard.tsx:436`).

**B:** three `CardAccentBadge`s — Medicine `MedicineTrayCard.tsx:189`, Quick log
`health.tsx:268`, This week `health.tsx:341` (all `domain="health"`, deliberately distinct
glyphs) · five severity chips `health.tsx:316` (`s.color`, solid) · `health.tsx:365`
overview bar fill (`SEVERITY_COLORS[2]`) · per-day severity dots `:380–387` · dose circles
`MedicineTrayCard.tsx:337` (`theme.good`, one per taken medicine).

**Count — Health: 0 `theme.accent`, but ~5 solid-fill *kinds* and the busiest colour vocabulary (5 severity colours) of any tab.**

**Ranking (worst → best) for "one solid accent fill per screen": Shopping ≫ Plans > Habits > Home > Health.**

---

### 4. Shopping: Food + Catalogue reachability — **the move is NOT safe as proposed**

**Is the screen tabbed?** Yes, but only **two** tabs: `type Tab = 'weekly' | 'monthly'`
(`shopping.tsx:419`), default `'weekly'` (`:456`), labelled `Week lists` / `Ukelister` and
`Monthly list` / `Måned` (`lib/i18n.ts:549–550`, `2191–2192`). Catalogue and Food were
**removed as tabs** in the 2026-07-23 UX-audit F1 pass and became pushed sub-screens
(`app/food.tsx`, `app/catalogue.tsx`).

**Where are the entry points?** Not header icons — a **two-button row** built at
`shopping.tsx:1556–1586` (`foodCatalogueLinks`) and mounted at **`shopping.tsx:1599`**,
inside `TourTarget id="tour.shopping.list"`. Each button is a `PressableScale` → `Surface`
with a `CardAccentBadge` (`domain="meal"` icon `fast-food` for Food, `domain="shop"` icon
`list` for Catalogue) + a label, pushing `/food` and `/catalogue` respectively.

**The decisive fact:** line 1599 sits **above** both `{tab === 'monthly' && …}` (1601) and
`{tab === 'weekly' && …}` (1875). The row is therefore **rendered unconditionally on both
tabs**, and it is the *only* entry point to either screen anywhere in the app
(`grep -rn "'/food'\|'/catalogue'"` returns these two call sites only).

**Does the Monthly tab need them? Yes — both.**

1. **Food.** The Monthly tab's own "Add dish" trigger (`shopping.tsx:1813–1822`) opens
   `AddDishSheet` with `{mode:'monthly', listId}`. `components/AddDishSheet.tsx` is
   **pick-only** — it lists saved dishes from `useMealStore` and, when there are none,
   renders a dead-end `t.noDishesAvailable` line (`AddDishSheet.tsx:201`) with no route out.
   Dishes can only be authored on the Food screen. Remove the Food button from the Monthly
   tab and "Add dish" becomes unusable for any user who hasn't already built a dish
   elsewhere.
2. **Catalogue.** The Monthly tab's `InlineAddItem` (`shopping.tsx:1801`) autocompletes from
   `useCatalogStore.suggest()` (`InlineAddItem.tsx:29`, `40`, `47–48` — "accurate for the
   catalog caller (Monthly tab)"), and `components/CatalogueTab.tsx:11–13` states the
   catalogue "is the single basis both the week lists and the Food screen draw item
   names/prices from". Fixing a wrong catalogue price/name is a Catalogue-screen action, and
   the Monthly tab is where those prices are summed (`monthlyTotal`, `shopping.tsx:1782`).

**Verdict:** moving the two buttons to a row at the bottom of the *Week lists* tab would strand
the Monthly tab without either. If the move goes ahead, either (a) duplicate the row at the
foot of the Monthly tab, (b) keep the row shared and only move it *down* (still outside the
tab conditional), or (c) give `AddDishSheet` its own "create a dish" route and give
`InlineAddItem` an inline "edit catalogue" affordance first.

---

### 5. To-do: `Whenever`, `Done (n)`, and the Goals link

**Whenever, per sub-tab:**

| Sub-tab | Position | Lines |
|---|---|---|
| **Today** | `SectionCard` **ABOVE** the day's list — undated tasks lead, the dated Today section follows (comment at 972–975: "Whenever always sits on top"). Suppressed **only** for `layoutSpec.id === 'focusFirst'` ("a second list above the hero is the opposite of one thing at a time"). Still present above `PlanTaskCard` on the **timeline default** and above the By-person groups. | 976–987 |
| **This week** | `SectionCard` **ABOVE** the seven weekday groups | 1083–1092 |
| **All tasks** | The **first** section of three (Whenever → Recurring → Shared); on this tab it holds *all* non-recurring tasks including dated ones (selector at 622–625) | 926–948 |

**Is it collapsible?** **No.** It is a `SectionCard` (`components/SectionCard.tsx:68–74`),
which is a plain `Surface` + `SectionRail` + content — no `Collapsible`, no chevron, no
`right` control passed at any of the three call sites. Only the *Done* zone inside it and the
focus-mode "The rest" group collapse.

**Does it show a count?** **Yes** — `count={undatedWhenever.length}` / `{wheneverAll.length}`,
rendered by `SectionRail.tsx:81–83` as a tabular-figure number after the label.

**`Done (n)`:** rendered by `DoneSplitList` at **`plans.tsx:263–281`** — a framed `doneZone`
(border + `theme.surface`) whose header is a `SectionRail` hued `theme.good`, label
`t.tasksDoneLabel`, `count={finished.length}`, collapsed by default (`doneOpen` initial
`false`, line 224), chevron in the rail's `right` slot. It is **always last inside its
section**, after the `footer` add row (262). Applies to: Today's Whenever, Today's day card,
each This-week weekday group, This-week's Whenever, and each By-person group. **The All-tasks
tab has no done zone at all** — those sections render flat. Under the timeline layout the day
uses `PlanTaskCard`'s own "Done today (n)" zone instead (`PlanTaskCard.tsx:1103–1123`), and
under `focusFirst` it degrades to a single centred green line, `t.focusFirst.doneToday(n)`
(`plans.tsx:451–453`).

**Goals link:** `SubScreenLinkButton` at **`plans.tsx:1119–1126`** — the **last element in the
scroll content**, below every tab's list, outside the tab conditionals so it shows on all
three. Gated `featureGoals`. Label `t.goals.editLink` ("Edit Goals"), icon `flag`,
`domain="task"`. It opens `GoalsSheet` as a popup (1133), **not** a route push — moved to the
bottom + renamed + converted to a popup on 2026-07-31. Habits carries an identical button
(`habits.tsx:834–841`).

---

### 6. Health: is "Quick log" one field? — **No. It is a four-field form.**

Verbatim JSX, `app/(tabs)/health.tsx:271–329`:

```tsx
<AddRow
  placeholder={t.logSymptomTrigger}
  value={quickDraft}
  onChangeText={setQuickDraft}
  onSubmit={handleQuickLog}
  accent={healthDomainColor.accent}
  confirmIcon="checkmark"
  showDivider={false}
  accessibilityLabel={t.logSymptomTrigger}
/>
{quickDraft.trim().length > 0 && (
  <>
    <View style={styles.quickTimeRow}>
      <View style={styles.quickTimeField}>
        <Text style={[styles.quickSeverityLabel, { color: theme.textMuted }]}>{t.whenStartedLabel}</Text>
        <Input
          value={quickStartTime}
          onChangeText={setQuickStartTime}
          placeholder={t.timeInputPlaceholder}
          keyboardType="numbers-and-punctuation"
          style={styles.quickTimeInput}
        />
      </View>
      <View style={styles.quickTimeField}>
        <Text style={[styles.quickSeverityLabel, { color: theme.textMuted }]}>{t.durationLabel}</Text>
        <Input
          value={quickDuration}
          onChangeText={setQuickDuration}
          placeholder={t.durationPlaceholder}
          keyboardType="number-pad"
          style={styles.quickTimeInput}
        />
      </View>
    </View>
    <View style={styles.quickSeverityRow}>
      <Text style={[styles.quickSeverityLabel, { color: theme.textMuted }]}>{t.severityLabel}</Text>
      <View style={styles.quickSeverityChips}>
        {SEVERITIES.map((s) => {
          const active = quickSeverity === s.value;
          return (
            <PressableScale
              key={s.value}
              onPress={() => setQuickSeverity(s.value)}
              style={[
                styles.quickSevChip,
                { backgroundColor: s.color },
                active && { borderColor: theme.text, borderWidth: 2 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={severityLabel(s.value)}
            >
              <Text style={[styles.quickSevChipText, { color: severityInk(s.value) }]}>{s.value}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  </>
)}
```

**Definitive answer:** the card holds **four inputs** — name (`AddRow`), start time (`Input`),
duration (`Input`), and a five-chip severity picker — plus two label rows and a card header
(`CardAccentBadge` + `t.quickLogLabel`, lines 263–270). Three of the four are behind
progressive disclosure (`quickDraft.trim().length > 0`), so the **resting** state is one line
plus a header, but the **active** state is a three-row form with a 5-swatch colour picker.
`handleQuickLog` (184–205) reads all four and converts duration into `endTime`/`endDate`.
Converting this to "a thin one-line strip" would drop start time, duration and severity, or
require moving them into a sheet — the proposal's precondition does **not** hold as written.
The file's own header (lines 12–20) documents this growth: severity was added first, then
start time + duration on 2026-07-24 "per user feedback that hiding them behind the full form
made quick-logging feel incomplete."

**Medicine tray position:** `MedicineTrayCard` renders at **`health.tsx:255`**, i.e. directly
**ABOVE** Quick log and below the `StarterCard`. This is deliberate and documented at 250–254
and in the file header (22–29): "doses are the time-sensitive, recurring thing you open this
tab for, while symptom logging is reactive." Gated on `settings.featureMedicine`.

---

### 7. Per-card order: `Done (n)` vs. the always-open add line

`components/PadSheet.tsx` (the shared ruled-sheet body) pins the type row **first**
(lines 88–93: `typeRow` → rule → rows → spare lines) and draws `footer` **last**, only when
`state === 'open'` (line 110). So every pad-based card is structurally add-line-then-done.

| Card | Add line | Resolved zone | Order | Verdict |
|---|---|---|---|---|
| `PlanTaskCard` (Home to-do + Plans timeline) | `PadTypeRow` on the pad's first rule (`:1043` via `PadSheet`, or a standalone `PadSheet` at `:969` for timeline/empty/all-done) | "Done today (n)" `:1103–1123`, then "Recently deleted (n)" `:1129–1167` | add **above** done | ✅ |
| `HomeNotesCard` | `PadTypeRow` `:256–303` (top) | "Checked (n)" in `PadSheet footer` `:305–332` | add above done | ✅ |
| `HomeShoppingCard` | `PadTypeRow` `:255–284` (top, via `typeRow`) | "In cart (n)" in `footer` `:369–390` | add above done | ✅ |
| `HomeHabitsCard` | `PadTypeRow` `:300–309` | *(no done zone — habits strike in place)* | n/a | ✅ |
| `plans.tsx` `DoneSplitList` sections | `InlineTaskAdd`/`AddRow` passed as `footer`, rendered at `:262` | `Done (n)` zone `:263–281` | add **immediately above** done — explicitly engineered that way (comment 84–88: "the green 'Done' zone always sits last, instead of green being sandwiched between the tasks and the add row", 2026-07-16 colour-order fix) | ✅ |
| `WeekListCard` (Shopping weekly) | `InlineAddItem` `:645` | "In cart" `:708`, "Purchased" `:746`, green CTA `:776` | add above both zones | ✅ order, ⚠️ the add is a **collapsed "+" bar**, not an always-open type line |
| Shopping Monthly list card | `InlineAddItem` `:1801` + "Add dish" `:1813` | "Purchased this month" `:1827` | add above done | ✅ order, ⚠️ collapsed bar, and **two** add affordances |
| `MedicineTrayCard` | `AddRow` `:431–439` (bottom) | *(none)* | n/a | ⚠️ collapsed bar, and it sits below the As-needed section rather than on a first rule |
| Health "Quick log" | `AddRow` `:271` | *(none — This week is a separate card)* | n/a | ⚠️ collapsed bar |
| `habits.tsx` Today list | `PadTypeRow` `:798` (bottom of the list) | *(none)* | n/a | ✅ type line, but at the **foot**, unlike the four pad cards which put it first |
| `app/notes.tsx` | *(none — `VoiceNoteFAB` only)* | "Checked" section `:146–151`, below "Active" | — | ⚠️ **no add line at all**; the checked section is a plain always-expanded section, not a collapsed `Done (n)` |

**No card renders `Done (n)` above its add line.** The proposal's add-then-done requirement is
already satisfied everywhere it applies. The real divergence is *which kind* of add line:
four cards use the always-open `PadTypeRow`, five still use the collapsed `AddRow`/
`InlineAddItem` "+ bar", and `app/notes.tsx` has neither.

---

### 8. Rows still carrying a trailing trash/send/put-back button

AGENTS.md claims these were consolidated into `PadRow`'s single `⋯`. **Partially true.**

`components/PadRow.tsx` is genuinely adopted by exactly **four** components (verified by
import, not by comment): `HomeNotesCard.tsx:81`, `HomeHabitsCard.tsx:80`,
`HomeShoppingCard.tsx:69`, `PlanTaskCard.tsx:233`. In those, the row action is `onAction`
→ the `⋯` glyph (`PadRow.tsx:150–161`): notes' "Send it to…" (`HomeNotesCard.tsx:340`),
shopping's remove (`HomeShoppingCard.tsx:412`), cart-collect (`:384`), task delete
(`PlanTaskCard.tsx:1059`).

Rows that **have not** been converted and still draw their own trailing button:

| Row | File:line | Trailing control |
|---|---|---|
| `ShoppingRow` (every weekly-list row, both tabs) | `components/ShoppingRow.tsx:358–370` | `close-outline` remove / `InventoryIcon` **put-back**, then the check — exactly the "assorted trailing trash/put-back" pattern `PadRow` was meant to absorb |
| `MonthlyTableRow` (every Monthly-list row) | `components/MonthlyTableRow.tsx:108–112` | `close` remove, then the check. Also keeps an inline `−/×n/+` stepper on its meta line (`:86–92`) |
| `NoteRow` (the `/notes` screen) | `components/NoteRow.tsx:102–104` | `trash-outline` (`theme.bad`), then the check. Plus a second row of two action buttons below (`:121–139`) |
| `PlanTaskCard` flat + grid rows (timeline / horizontal layouts, i.e. the **To-do tab default**) | `components/PlanTaskCard.tsx:620–636`, used at `:739` and `:783` | a bare `trash-outline` stacked with the done toggle — the same card's *pad* rows use `⋯`, so the two layouts disagree |
| Shopping "Unallocated" rows | `app/(tabs)/shopping.tsx:1916–1918`, `1933–1938` | `close` remove (+ an `arrow-forward` allocate button on ungrouped rows) |
| `HabitCard` header (Habits tab) | `app/(tabs)/habits.tsx:292–319` | gear `IconButton` + `−` + `+` — three trailing controls, no `⋯` |
| `MedicineTrayCard` med rows | `components/MedicineTrayCard.tsx:323–342` | dose circle only (no delete) — but as-needed rows add an undo text button `:405–420` |
| `TaskCard` (Plans list/week/all rows) | `components/TaskCard.tsx:1362–1370` | delete lives in the expanded editor's bottom action bar, not on the row — no row-level `⋯` either |
| `CatalogueTab` rows | `components/CatalogueTab.tsx:200`, `:414` | `trash-outline` per row |
| `FoodTab` dish/ingredient rows | `components/FoodTab.tsx:453`, `:482` | `trash-outline` / `close` |
| `GoalPicker` rows | `components/GoalPicker.tsx:137` | `trash-outline` `IconButton` |
| `app/goals.tsx` goal cards | `app/goals.tsx:190–198` | `close-outline` delete in the card header |

**Conclusion:** the `⋯` consolidation reached the four Home-preview pad cards only. Every
Shopping row, the Notes rows, the Habits rows, the Goals rows, and `PlanTaskCard`'s own
non-pad layouts still carry bespoke trailing trash/close/put-back controls. The AGENTS.md
claim should be read as "the pattern exists and is adopted in four places", not "done".

---

# Appendix A — B1-6 AI setup guide removal cost


Answering the three questions asked in B1-6. **One premise in the handoff is wrong** — see "Reachability".

### How many files / components / lines it accounts for

| File | Lines | Disposition if removed |
|---|---|---|
| `lib/aiSetupGuide.ts` | 475 | delete whole |
| `lib/aiSetupApply.ts` | 533 | delete whole |
| `components/AiSetupPreviewModal.tsx` | 163 | delete whole |
| `__tests__/aiSetupGuide.test.ts` | 255 | delete whole |
| `lib/i18n.ts` — `aiSetup` block | 86 × 2 languages ≈ 172 | delete block from `en` (l.1385) + `no` (l.2655) |
| `app/settings.tsx` | ≈ 80 | partial edit — see below |
| `components/TourSpotlight.tsx` | ≈ 15 | partial edit — see below |
| **Total** | **≈ 1,690 lines across 7 files** | 4 whole-file deletes, 3 partial edits |

`app/settings.tsx` breakdown: imports l.244–246; state `aiSetupConfig` l.350 + derived `aiSetupPreview` memo l.352; four handlers `handleDownloadAiGuideToDevice` l.663, `handleDownloadAiGuide` l.678, `handleUploadAiSetup` l.688, `handleConfirmAiSetupImport` l.700; three buttons + dividers l.985–997; modal mount l.1708–1713.

`components/TourSpotlight.tsx` breakdown: import l.62; `handleAiGuide` l.161–169; the download button on the closing card.

### Whether anything else depends on its export/import code

**No. It is a clean leaf.** Exactly two files import it — `app/settings.tsx` and `components/TourSpotlight.tsx` — and both only call the top-level entry points (`exportAiSetupGuide`, `exportAiSetupGuideToDevice`, `pickAndParseAiSetupFile`, `previewAiSetupConfig`, `applyAiSetupConfig`). Nothing imports its types or helpers for any other purpose. `AI_SETUP_SCHEMA_VERSION` is consumed only by the guide itself and its own test file.

Every other hit for "aiSetup" in the repo is a **comment** documenting a deliberate exclusion, not a dependency — `store/useNotesStore.ts` l.51, `store/useMedicineStore.ts` l.39, `lib/db.ts` l.994. Those comments would need a light edit or can be left as harmless history.

It is **not gated by any feature flag** — there is no `featureAi` field in `store/useSettingsStore.ts`. So it cannot be soft-disabled by flipping a switch; it is either present or removed.

### Whether it is reachable anywhere other than Settings → Advanced

**Two corrections to the premise.**

1. **It is not in Settings → Advanced at all.** It lives in Settings → **General** → the "Local account" card (`app/settings.tsx` l.985–997), directly under the backup/restore buttons.

2. **More importantly, it is not buried — it is shown to every new user.** `components/TourSpotlight.tsx` renders the AI-guide download on the **guided tour's closing card**, the last panel every user sees after onboarding. That file's own header (l.16–18) records why: the note and the download "used to live on the deleted intro slideshow's final pages and had nowhere else to be reachable from onboarding."

That materially changes the cost/benefit. The handoff's argument — a high-executive-function flow is a poor fit for the audience — is *strengthened*, not weakened, by this: the flow is not an opt-in curiosity for power users, it is placed in front of every new user at the exact moment they finish onboarding. If the feature stays, the tour placement is the thing worth reconsidering first; removing just that one button is a ~15-line change and needs no decision about the other 1,675.

### One argument for removal not in the handoff

`AGENTS.md` makes updating this guide a **standing tax on unrelated future work**. "Add a new SQLite column" step 4 and "Add a new setting toggle" step 6 both require extending `aiSetupGuide.ts`/`aiSetupApply.ts` and bumping `AI_SETUP_SCHEMA_VERSION` in the same edit. Every future column and setting pays that cost. Removing the guide removes the tax; keeping it means Phase 3's new health columns must at minimum be *considered* against it (they are excluded, so in that specific case: no work — but the consideration recurs forever).

### Recommendation

The removal is **low-risk and mechanically clean** — no dependents, no flag, no data migration, no native surface. Nothing about this decision needs to happen in Phase 1; it can be done at any later point at identical cost. The two decisions worth separating:

- **Cheap and independent:** drop the tour's closing-card button (~15 lines). Removes the feature from every new user's path without deciding its fate.
- **The full removal** (~1,690 lines): a judgement call about audience fit, unblocked whenever you want it.

---

# Appendix B — Pre-change baselines


Phase 1 acceptance asks for "no **new** wrap near-misses at 360px" and "all copy tests pass". Both are differential claims, so here is the before-state they must be measured against. Captured on `claude/multi-agent-task-dispatch-ye7i54` at commit `9ced73a`, tree clean.

### Test + typecheck baseline

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **clean**, exit 0 |
| `npx jest` (full suite) | **61 suites / 848 tests, all passing**, ~18s |

### Wrap audit baseline — Norwegian, 360px

Command: `FORCE_BUILD=1 npm run wraps -- --lang=no --width=360 --json`
Raw output kept at `wraps-baseline-clean.json`.

| Screen | wrapped | truncated | wrapped rows |
|---|---|---|---|
| onboarding-basics | 1 | 0 | 0 |
| onboarding-privacy | 2 | 0 | 0 |
| onboarding-energy | 7 | 0 | 0 |
| onboarding-features | 5 | 0 | 0 |
| onboarding-name | 1 | 0 | 0 |
| tour-step | 3 | 2 | 0 |
| home | 2 | 2 | 0 |
| Handleliste (Shopping) | 2 | 2 | 0 |
| Gjøremål (To-do) | 2 | 2 | 0 |
| Helse (Health) | 2 | 2 | 0 |
| Vaner (Habits) | 2 | 2 | 0 |
| settings | 1 | 0 | 0 |
| **Total** | **30** | **12** | **0** |

**Zero wrapped control rows** — the hardest class to fix. Nothing in Phase 1 should introduce one.

### What this says about B1-4 (nav label) — measured, not estimated

The 12 "truncated" hits are not 12 distinct problems. They are the **same two BottomNav labels** re-measured on each of the five tab screens plus home/tour:

| NO nav label | available | natural | shortfall |
|---|---|---|---|
| `Handleliste` | 47px | 63px | **+16px** |
| `Gjøremål` | 47px | 50px | **+3px** |
| `Hjem` / `Vaner` / `Helse` | 47px | fits | — |

Two things follow, and they pull in opposite directions:

1. **B1-4's premise is confirmed on the numbers.** `Handleliste` is the tightest label by more than 5×, needing +16px against `Gjøremål`'s +3px. Of the five, it is unambiguously the one to fix.

2. **But B1-4's acceptance criterion cannot be met as written, and not because of Shopping.** It asks to "verify all five NO labels fit at 360px without truncation." `Gjøremål` also truncates by 3px and B1-4 does not change it — so the criterion fails on a label the task never touches.

**Before acting on either, note the known false-positive.** `AGENTS.md` flags exactly this measurement as unreliable: react-native-web implements neither `adjustsFontSizeToFit` nor `minimumFontScale`, and it names BottomNav's `Handleliste` as the specific example of a label reported here that **auto-shrinks correctly on a real device**. So the web tool cannot distinguish "truncates natively" from "shrinks a little natively". Wrapped text and wrapped rows are faithful on web; single-line truncation is not.

This does not sink B1-4 — shortening an 11-char label to 6 is defensible on its own terms (it stops the auto-shrink and keeps the label at full size). It does mean the acceptance criterion should be rewritten as *"no NO nav label auto-shrinks on device"*, verified by the maintainer on hardware, rather than as a web-measured truncation check that `Gjøremål` will fail regardless.

### Two Phase-1 tasks will move these numbers on their own

- **B1-1 deletes `onboarding-features`** → its 5 wrapped instances disappear from the baseline.
- **B1-2 halves `onboarding-energy`**, today the worst screen in the app at 7 wrapped → expect a meaningful drop.

So a post-Phase-1 total *below* 30 wrapped is the expected outcome. The acceptance check should compare **per-surviving-screen**, not on the total, or the deletions will mask a regression introduced elsewhere.
