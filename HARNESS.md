# Harness — how to read each audit's output

How to run and, more importantly, how to correctly INTERPRET the output of this repo's headless
verification and visual-audit scripts. Every harness here has a documented blind spot or a known
false-positive shape; read the relevant section before trusting (or "fixing") a finding.

Relocated from `AGENTS.md`'s "Common tasks" section, session S0.1 (2026-09-01). See
`docs/audit/INSTRUCTION_SURFACE_AUDIT.md` for per-claim verification status.

---

### Verify a change (headless — no device)
A full emulator isn't feasible in the remote env (no KVM/virtualization; the app is
deeply native), so verification is headless and covers the **logic/data layer** only —
not visual/gesture behavior, which still needs a real device.

> **See `TESTING.md`** for the full quality strategy — the test-pyramid layers, the
> "add a test with every helper/branch/bug fix" rule, how to write a headless store
> test, the coverage ratchet, and the CI gate (`.github/workflows/ci.yml` runs
> typecheck + lint + jest on every PR into `main`).

1. `npx tsc --noEmit` — first-pass gate. Runs & passes in the remote env now (the
   session-start hook installs deps). Also enforces i18n key parity via `no: typeof en`.
2. `scripts/test-changed.sh` — runs only the Jest suites a change affects
   (`jest --findRelatedTests` over the git diff). Full suite: `scripts/test-changed.sh --all`.
3. **Only test behavioral changes.** A pure move/rename/comment/header edit gets step 1
   only — there's nothing to re-test.
4. Test files live in `__tests__/` (+ `lib/__tests__/`); native modules are mocked
   (`__mocks__/expo-sqlite.js` is auto-applied; mock `@/lib/db` directly for store logic).
   Add a test when you add a pure helper or store logic; keep them DB-free/headless.

### Web preview for agent testing (visual/logic — not pixel-perfect native)
`docs/archive/EMULATOR_TESTING_SPIKE.md` / `docs/archive/EMULATOR_TESTING_HANDOFF.md` describe the original plan;
this is the outcome. Runs the real app as Expo Web (`react-native-web`) and drives it
headlessly with Playwright (Chromium pre-installed under `PLAYWRIGHT_BROWSERS_PATH` —
never `playwright install`) so an agent can actually *see* screens and flows without a
device or EAS build.

- **Run it:** `npm run preview` — builds (`expo export --platform web` + wires the
  sql.js fallback), serves `dist/` with COOP/COEP headers, and walks onboarding + all 5
  tabs with Playwright, screenshotting to `preview-shots/` (gitignored). Also exercises **five**
  real write paths — add a task (To-do), add a habit (Habits), add a medicine + log a dose
  (Health), and (2026-08-07) **build a card from blank in the design lab** — the first three
  confirmed to survive a tab round-trip, proving the store→DB path actually works rather than
  just static render, and the fourth checked at BOTH ends (the part's panel opens AND the card
  draws a real slider for it, since the whole point of that feature is that those two agree).
  **The fifth (2026-08-30)** hides a card from the Manage cards sheet, navigates away, returns and
  puts it back: a new settings column is only proven by a write followed by a read on the far side
  of a navigation, which is the one thing `tsc` (a valid FieldMap) and Jest (a mocked DB) both
  cannot tell you. It runs on Health because nothing later in the walk depends on that card, and it
  restores the card before moving on — a failure here must not cascade into a missing-card timeout
  three phases away, which is how this walk's failures usually get expensive.
  The lab step also switches playground screens and back, asserting the card is absent on the
  other screen and present again on its own — **the only automated proof per-screen storage
  works** — and follows the header link to the token knobs. Plus a render pass over the pushed
  sub-screens reachable without data setup (Settings, the medicine editor, the design lab).
  - `npm run preview:build` / `npm run preview:serve` run the two steps standalone.
  - `node scripts/preview.mjs --route=/some/path` for a focused single-screen recheck.
- **⚠️ The preview cannot drive a hold-and-drag gesture AT ALL** (measured 2026-08-07, not
  assumed). Playwright's mouse-down → wait → move → up does not activate
  `react-native-gesture-handler`'s `Gesture.Pan().activateAfterLongPress(400)` in the web
  build. Confirmed by a control test against the app's OWN shipped drag — dragging a row in a
  `DraggableTaskRow` list, code that predates the test and works on device, moves nothing
  either. So a drag that "doesn't work" in the preview is telling you nothing about your code.
  Don't spend a session debugging one. Split the arithmetic out into a pure function and test
  that instead (`slotAtPoint()` in `lib/designLab.ts` is the worked example); the gesture needs
  a real device, like the rest of the native-only surface.
- **What else the preview genuinely CANNOT reach** (learned the hard way 2026-07-28 — check here
  before writing a driver script):
  - ~~**Anything behind `Alert.alert`.**~~ **Stale as of 2026-08-01 — the weekly shopping list
    IS reachable.** This entry claimed "Create a new list" opened a native Alert that
    react-native-web won't render, making `components/ShoppingRow.tsx` unreachable in the
    preview at all. That stopped being true when the app moved off native alerts:
    `app/(tabs)/shopping.tsx` uses `showAppModal` (components/AppModal.tsx), which is a plain
    in-app `<Modal>` and renders fine on web. Driven end-to-end 2026-08-01: Shop → "Create a
    new list" → "Start empty" → expand → add an item → a real `ShoppingRow` with a live
    trailing cluster. The whole app now has **zero** `Alert.alert` call sites (the last two,
    goals' delete confirms, went to `showAppModal` the same day), so nothing is blocked this
    way any more. `scripts/preview.mjs` still doesn't walk it — that's a coverage gap in the
    driver, not a limit of the preview.
  - **A multi-button `showAppModal` was unreadable on web until 2026-08-01** — worth knowing
    because it looks like a broken app rather than a rendering artifact. `AppModal`'s stacked
    (≥3 button) layout used `flex: 0`, which Yoga reads as basis `auto` and CSS reads as
    `0 1 0%`: on web every button collapsed to its padding with the label spilling over the
    fill. Native was always correct. Fixed by spelling out `flexGrow/flexShrink/flexBasis`.
    If a dialog ever looks collapsed in a screenshot again, suspect a `flex: N` shorthand
    before suspecting the dialog.
  - Onboarding button labels differ per language and are easy to get wrong — a driver script
    that hangs on `getByRole('button', …)` is usually a wrong label, not a broken app. The
    Norwegian path is: `Norsk` → `Nei, jeg er ny her` → `Skjønner →` → `Vis meg rundt` →
    `Neste →` ×N → `Kom i gang →` → `Neste →` → `Kom i gang! 🌿`.
  - Driving a **layout switch**: the header icon's accessible name is `t.config.layouts.title`
    ("How lists look" / "Hvordan lister ser ut"), and the sheet closes on **Done**, not Close.
  - Start the server with `nohup … & disown` when running a one-off script by hand —
    `(cmd &)` inherits stdout and hangs the tool call (see the "Background HTTP servers"
    gotcha below).
- **SQLite-on-web (the gating decision):** `expo-sqlite`'s web backend (wa-sqlite/WASM)
  needs a growable `SharedArrayBuffer`-backed WASM memory for its worker bridge — this
  reliably fails with `RangeError: Out of memory: Cannot allocate Wasm memory for new
  instance` in this container (`RLIMIT_MEMLOCK` fixed at 8MB, no permission to raise it —
  confirmed unfixable from app code). **Fallback in use: `sql.js`** (in-memory,
  single-threaded, no worker/shared memory). `scripts/build-web.mjs` loads it via a plain
  `<script>` bootstrap injected into `dist/index.html` that finishes BEFORE the app
  bundle's own `<script>` tag is even inserted, so `lib/sqlite.web.ts` can read the ready
  `SQL.Database` off `window.__unfocusSqlJsDb__` synchronously at module-eval time — no
  top-level-await, no queuing tricks needed. **In-memory only — no persistence across a
  full page reload/`page.goto()`.** Navigate between tabs via BottomNav clicks (client-side
  route change), not `page.goto()`, or the DB (and onboarding state) resets.
### Visual regression — `npm run visual` (2026-08-29)
**The first check in this repo that can see a defect COME BACK.** Until it existed the
maintainer's eyes were the only detector of a visual regression: `tsc` sees valid styles, jest
has no layout, and the other three harnesses each answer a narrower question. That is why this
file reads as a list of reversals — the card header cluster order alone has now been all four of
its possible arrangements — and why the same defects kept being re-reported by hand.

It captures through `scripts/screenshot-states.mjs` and pixel-diffs against committed baselines
in `visual-baselines/<theme>/`. **21 screens per theme, light AND dark** (~3.9 MB) — curated, not
all 54, because these are PNGs in git history forever.

- `npm run visual`, `npm run visual -- --theme=dark`, `FORCE_BUILD=1` to rebuild first.
- `npm run visual -- --update` re-blesses. ⚠️ **Blessing is the whole risk** — it is both how an
  intentional redesign lands and how a real regression gets laundered in. Diffs plus `expected`
  and `actual` are written for every finding; re-bless deliberately, in its own commit, having
  looked at them. Never to make a red run go green.
- ⚠️ **Web-render vs web-render, NOT native ground truth.** Clean means "nothing changed that I
  did not intend", never "this looks right on a phone".
- **Determinism is what makes it usable and it took real work.** `components/NarratorQuote.tsx`
  picks its line by a RANDOM index on mount and several surfaces print the current date, so
  `--deterministic` (in the screenshot walk) pins `Math.random` to a seeded mulberry32 and the
  ZERO-ARGUMENT `Date` to a fixed local noon on a Wednesday. Page-level overrides; nothing in the
  app changes. Verified stable: two independent runs on one unchanged build, **44/44 shots
  bit-identical** (2026-08-30; it was 43/44 until the settle below).
  - ⚠️ **`Math.random` is a seeded STREAM, not a constant, and that bites whenever you edit the
    walk.** The narrator's line depends on how many draws happened *earlier*, so inserting one
    step upstream re-rolls every quote downstream of it — a screen the commit never touched,
    differing only in one italic sentence. Look at the diff and confirm it is only the quote
    before blessing; the failure it resembles (a card's content changing) is real. It cannot be
    a constant: `lib/id.ts` is `Date.now().toString(36) + Math.random()…` and `Date.now()` is
    frozen here, so the random half is the only thing keeping two rows in one walk from sharing
    an id. And `Date.now()` must STAY frozen — goal strength and `isWashedAway` compare stored
    timestamps written through the frozen `new Date()`, so a live clock would wash every seeded
    task away before it could be photographed.
  - ⚠️ **A settle is a PREDICATE, never a longer wait — and one screen turned out not to be a
    settle problem at all.** `habits-empty` was the only shot not bit-identical run to run; the
    pixels sat on the TabSlider's own sliding pill and converged with time — **374 px at 1100 ms
    → 73 at 2600 → 0 at 4200** on this machine. Tuning that number fixed it here and
    **reproduced it on the CI runner**, which came back with exactly the 73 px the 2600 ms run
    had produced, because a timeout cannot be right on two machines at once. So `shot()` calls
    `settle(page)`: two viewport screenshots a beat apart compared byte for byte, until they
    match or a 3 s budget runs out. A static screen costs one extra capture; an endlessly
    animating one spends the budget and proceeds, so it is unconditional and cannot hang the
    walk. It is the right fix and it stays — verified 44/44 bit-identical across two runs AND
    byte-identical to the baselines the tuned wait produced.
  - ⚠️ **…and it did not fix that screen, which is the more useful half.** With the predicate,
    CI's `habits-empty` is *stable* at the same 73 px. So it was never a race there: the pill has
    two stable resting positions and the two machines pick different ones. That screen is in
    `MACHINE_DEPENDENT` in `scripts/visual-diff.mjs` now — captured, printed on every run,
    excluded from the comparison — because the only other way to green was raising the budget
    past 73, which is 11 px under what one header icon costs, i.e. re-opening the blind spot this
    gate had just closed. It is not a coverage hole: `habits-populated` shoots the same surface
    and is stable on both machines. **A stably-red screen is worse than an excluded one** — it
    trains whoever reads the output to re-bless on reflex, which is the failure `--update`'s
    warning exists for.
  - **When this gate looks flaky, run the walk in PAIRS and diff the two outputs against each
    other.** A baseline comparison cannot tell "the app changed" from "the harness did not
    settle"; two runs of one build can. That is how the wobble above was found, and how it was
    confirmed fixed.
- **It is proven to FAIL, not just to pass** — a probe changing `SCREEN_GAP` 16→12 turned 13 of
  21 red, and the 8 that stayed green were exactly the forms and single-card screens where a card
  gap does not apply.
- ⚠️ **`--update` refuses to bless a partial set**, and four screens the set wants but the walk
  cannot reach are PRINTED on every run (`WANTED_BUT_UNCAPTURED`) rather than dropped. Move one
  into `BASELINE_SET` when its excursion is repaired; the ratchet only goes one way.
- ⚠️ **pixelmatch's threshold is BLIND to this app's ambient layer — 0.02 plus an absolute
  channel rule (2026-08-31).** Its metric is perceptual and normalised against the maximum
  possible difference, so a change between two very dark colours scores far below the same
  magnitude in the midtones — and this is a true-black OLED design whose whole backdrop lives
  there. The number that settled it: **doubling the backdrop's orb field**, a change over ~40% of
  the screen with corner pixels going rgb(22,31,15) → rgb(44,59,27), was reported at the shipped
  `threshold: 0.1` as **9 differing pixels**. The truth was **162 166**, max channel delta 31.
  The gate called it `unchanged` — the same failure as the 200 px tolerance one rung deeper, and
  the reason "it still looks the same as before" could be true while every check was green.
  A pixel now counts if EITHER pixelmatch at 0.02 says so, OR any channel differs by ≥ 4; the
  second is what catches dark-on-dark, and 4 only has to clear rasteriser jitter because the
  measured run-to-run noise floor is zero.
  ⚠️ **The ≥ 4 rule has a sub-threshold blind spot in LIGHT too, measured 2026-09-01.** A light
  token retune (`surfaceGlass` 0.94 → 0.82, `surface` `#FDFEFF` → `#FAFCFE`) shifted the whole
  backdrop and every card fill of `light/plans-today-populated` by **1 level over 46 329 pixels**
  and the gate reported it `unchanged`, because no channel moved 4 and a 1/255 step is far under
  0.02 perceptually. It surfaced only because `--update` rewrote the file and `git status` showed
  it. **So a re-bless is worth a `git status` read**: a file the gate called unchanged that
  changed on disk is a real difference the gate could not see. It is not noise — two independent
  walks came back bit-identical to each other and to the blessed file. Lowering the 4 is not
  obviously right (it would admit genuine jitter on other machines); knowing the floor exists is.
- ⚠️ **The budget is an absolute 24 px, and the 200 px it replaced was hiding real changes
  (2026-08-30).** `MAX_DIFF_RATIO` was 0.0005 on the stated premise that Chromium's text
  rasterisation is not bit-identical across runs — never measured, and false: **nine untouched
  screens came back at exactly 0.** What the tolerance actually bought was a blind spot its own
  size. The commit that measured it added ONE header icon to twelve screens and every one
  differed by **exactly 84 px** (a thin 22px outline glyph is mostly its own background), so the
  gate reported `unchanged` on twelve screens that had visibly gained a control. An absolute
  count, not a ratio, because stray rasteriser pixels do not scale with the frame. ⚠️ If CI ever
  shows a floor of its own, raise it **with the measurement in hand**.
- ⚠️ **A shot is only as good as the tab it clicks, and one of them had been wrong for eight
  days.** `health-empty` clicked **Home**, carrying a comment that was true during the 5→3 merge
  (Health was a card on Me) and stopped being true on 2026-08-22 when the five tabs came back.
  Nothing failed — the walk kept producing a `health-empty.png`; it was just a second copy of
  `home-empty`, so the committed baseline for the Health tab was a picture of a different screen.
  Caught only because the gate reported 0 changed pixels on a commit that demonstrably added a
  header icon there: **a shot that cannot move is what this rot looks like.** Re-read the walk's
  tab clicks against `components/BottomNav.tsx` whenever the bar changes, exactly as
  `npm run wraps` requires.
- ⚠️ **Shots are `fullPage: false`.** The app scrolls inside a fixed-height ScrollView, so
  "full page" never reached below the fold — it only added ~61px of bare document under the
  932px viewport, which renders as whatever the outermost background is. That strip produced 18
  false findings in one pass, every one differing at exactly y=932.

### Geometry — `npm run geometry` (2026-08-29)
Measures **vertical** placement, which nothing else did: `wraps` is horizontal, `halos` is a
sliced glow, `visual` is change-against-baseline. "The tab slider in Settings is not vertically
centred" was reported by eye twice with no check able to see it.

Targeted, not a generic DOM sweep — the first cut swept generically and reported 25 false
findings, because react-native-web wraps a View in several absolutely-positioned divs and it read
nesting as overlap. It compares the header band (`zIndex 100`) against an attached sticky bar
(`zIndex 99`), and measures a control's gaps against the bar's **visible** band rather than its
declared box.

**It prints its measurements on every run, pass or fail**, which is the point: the Settings
segments sit `3 / 4` — a systematic 1px skew in the same direction on all three, caused by
`HEADER_SEAM_OVERLAP`. That is under the 1px tolerance and is NOT a failure; a verdict alone
would have hidden it.
⚠️ `constants/theme.ts`'s `OpticalCenter` is Android-only and a no-op on web, so a label
mis-centred by Android font padding is invisible here **by construction**. That class still needs
a device.

### The visual gates run in CI (2026-08-29; both themes since 2026-09-01)
`.github/workflows/ci.yml` has a second job that builds the bundle once and runs `visual`,
`geometry`, `wraps` and `halos`, each `if: always()` so one failure does not hide the others,
uploading pixel diffs on failure. ⚠️ **Chromium is resolved by `scripts/chromium-path.mjs`**,
not by the hardcoded `/opt/pw-browsers/chromium-1194/...` seven scripts used to carry — that path
is right only in the remote dev env, and it is what made this job fail on its first run.

⚠️ **`geometry`, `wraps` and `halos` ran LIGHT-MODE ONLY from 2026-08-29 to 2026-08-31 — only
`visual` was checked in both themes.** Dark is the app's DEFAULT appearance and every glass/edge/
glow decision is tuned for it, so a dark-only regression (the 2026-08-29 backdrop/orb doubling is
the worked example — see `docs/archive/AGENTS_HISTORY.md`) was invisible to three of the four
gates by construction, even though CI was green. Fixed by giving each script a
`--theme=light|dark` flag (`scripts/force-appearance.mjs`, factored out of
`screenshot-states.mjs`'s existing `forceAppearance` — it sets `dark_mode` on the in-memory
sql.js DB from an `addInitScript`, since there is no in-app route to appearance in this harness)
and running each audit twice in CI, once per theme. **A new geometry/wraps/halos check that only
makes sense in one theme is fine** — the flag exists so a dark-only defect CAN be seen, not so
every finding must be theme-symmetric.

### Halo audit — `npm run halos` (2026-08-24)
Answers one question the other checks cannot: **is a field's neon actually being drawn, or is it
being sliced off?** A halo (`getFieldGlow`) is a `boxShadow`, so it is cut to the nearest
`overflow: hidden` ancestor — and a card clips its own body. `scripts/measure-halos.mjs` walks
the five tabs in the web preview, opens every card (a composer inside a closed card is not in the
DOM at all), and for every field-shaped haloed element compares its blur radius against the room
it has before that clip. Exits 1 on any finding, and the failure text says where the fix goes.

- `npm run halos`, `npm run halos -- --width=360`; `FORCE_BUILD=1` rebuilds `dist/` first.
- It found the 2026-08-24 report: **31 of 36 haloed fields clipped**, every composer in the app
  but one. See the `getFieldGlow` bullet above for the mechanism and the two-part fix.
- **A field is recognised by `FIELD_RADIUS` (12px) — and then FOCUSED, because that is when its
  light exists (2026-08-26).** The detector used to be "`FIELD_RADIUS` plus a coloured
  `boxShadow`", which stopped working the day the glow-budget pass made a halo a focus-only
  state: an unfocused field has no shadow to match, the scan fell from 14 fields to 4, and it
  reported a contented `0 clipped` while looking at almost nothing. A new field shape that does
  not go through `getFieldGlow` is still a field this audit does not measure.
- **Three outcomes, not two.** A field with NO halo even when focused is reported separately from
  one whose halo is clipped: the first is a possible regression in the glow budget, the second is
  the bug this audit exists for, and folding them together hides either.
- ⚠️ **Dedupe on the LEFT/RIGHT room only.** A widely-reused composer — the To-do tab's "New
  task" mounts once per card and once per weekday inside Week — has one horizontal clearance
  wherever it sits, because that comes from the component's own padding; its top/bottom room is
  just wherever the page happened to be scrolled. Keying on the full room let that noise mint a
  fresh key for a structurally identical finding, so the count swung 12/14/15 between runs with
  nothing about the app having changed. Left/right is also the only axis any clipping bug this
  audit has found has ever lived on.
- Same caveats as the wrap audit: it drives the real app, so a nav or resting-state change can
  make a step measure nothing rather than fail. The count is **12 distinct fields** at 430px and
  360px when the walk gets all the way round.
- ⚠️ **It is NOT deterministic, and this line used to say it was (corrected 2026-08-27).** The
  claim was *"it is deterministic; a lower number is un-measurement, not a pass"*, which sent a
  session hunting a regression that did not exist. Measured on ONE unchanged build, four
  consecutive runs: **10, 12, 9, 12**. `openCards()` walks with fixed `waitForTimeout`s and a
  per-tab pass budget, so a slow frame drops a card that never opens and its composer is simply
  not seen — the same silent-skip the wrap audit has, on a harness that also re-runs each tab
  several times. **`0 clipped` is the gate; the count is not.** Read the count as a floor on
  coverage, and if it comes in low, RE-RUN before believing it — a real un-measurement (a nav or
  resting-state change) reproduces every time, a slow frame does not. Comparing a suspicious
  count against the same audit on `main` is the way to tell them apart.

### Wrap audit — `npm run wraps` (2026-07-28)
Finds the "why is that on two lines when it nearly fits?" class of bug by measurement
instead of eyeballing. `scripts/measure-wraps.mjs` walks the same preview build and, for
every text node, forces `white-space: nowrap` to compare natural width against the box it
actually got. Reports four separate failure modes:
- **Clipped controls** (added 2026-08-01; the filter tightened 2026-08-21) — a NON-text element (icon button, chip, avatar)
  whose box runs past the horizontal edge of the nearest overflow-clipping ancestor, so part
  of it is physically sliced off. Added after the task editor's voice mic shipped cut in half
  at 360px (#465) and was found *by eye in a screenshot* — none of the three modes below can
  see it, since the mic has no text to wrap or truncate and its row has only two children
  (under the ≥3 that wrapped-rows needs). Two filters keep it honest, and don't remove
  either: anything inside an `<svg>` is skipped (the backdrop motifs are *supposed* to bleed
  past their mask), and a child **as wide as or wider than** its clipper is skipped as a sliding
  track. ⚠️ **That second filter was `>` until 2026-08-21 and should have been `>=`**: it skipped
  the pager's 1080px TRACK but not its PAGES, which are each exactly one window wide — so two of
  the three were "clipped" by whatever mid-settle offset the screenshot caught, and six of eight
  findings on every run named the Shop page's intro text while the audit was looking at another
  tab. Equality is the honest cut, on the principle the mode rests on: a control that had room
  and was shoved out is by definition SMALLER than its clipper (the sliced mic was 28px in a
  257px box). `WRAP_DEBUG=1` prints each finding's clipper and offsets, which is how that was
  diagnosed rather than guessed. What's left is the real shape of the bug: something that would
  fit comfortably, shoved out anyway.
- **Near-miss wrapped text** — `+Npx` = how much more width would collapse it to one line.
  A small N means the *container* is the problem, not the copy.
- **Truncated single-line text** — how tabs/chips fail instead of wrapping. **⚠️ Confirm
  these on a device**: react-native-web implements neither `adjustsFontSizeToFit` nor
  `minimumFontScale`, so an auto-shrinking label (BottomNav's "Handleliste") is reported
  here but is fine natively. Wrapped text and wrapped rows ARE faithful on web.
- **Wrapped control rows** — a horizontal row (Mon–Sun weekday chips, a tab bar) whose
  children spill to a second line. These can't be fixed by shortening copy; the row has a
  hard minimum width. Rows are only reported when the children genuinely need more width
  than the row has — absolutely-positioned children (BottomNav's sliding pill) are excluded
  because they sit at their own `top` and otherwise fake a wrap on every single-line row.

`npm run wraps -- --lang=no --width=360` (also `--json`). **Always check Norwegian** — it
ran ~7x more near-misses than English at the same width (28 vs 4 instances at 393px) before
the 2026-07-28 pass. Widths worth checking: 430 (Pro Max), 393 (iPhone 15/Pixel 8), 360
(small Android), and 327 as a proxy for the `large` font setting (1.2x) at 393. Set
`FORCE_BUILD=1` to rebuild `dist/` first; otherwise it reuses the existing bundle.

⚠️ **The whole run DIED on the 2026-08-22 nav restructure, and three more steps were pointing
at the old geography behind it (fixed 2026-08-23).** `goHome` waited on a "Meg" tab that no
longer exists, so `npm run wraps` exited 1 at the first tab loop and measured nothing. Once that
was fixed: `tabs` still held two entries, so **Habits and Health were not measured at all**; the
habit quick-add, the symptom form and the medicine editor were each reached "via Home", where
none of them lives any more; and every card outside Home's three rests closed, so a locator
aimed inside one waits 30s and the step skips. There is an `openCard(page, title)` helper for
that now, keyed on `CardCollapseToggle`'s `<card title>: <expandListLabel>` accessible name.
**A nav or resting-state change is what breaks this audit**, and it breaks it by un-measuring
screens rather than by failing — read the "screens measured" line, which is 22 screens in both
`no` and `en`.

**Coverage.** The walk measures onboarding, the tour card, all five tabs, Settings, the
**design lab** (2026-08-06 — pushed from Settings → Advanced, and scanned last because both it
and Settings are dead ends; the walk has to throw its off-by-default switch first. **Since the
playground rebuild that is SIX scans**: the playground empty, with a card on it, and with a
part's panel open — three genuinely different surfaces — then the token screen's three tabs.
A tab this walk doesn't switch to is a tab it doesn't measure, and the part panel in
particular is the densest label-plus-pill-cloud thing in the app now that it carries colour
swatches, sizes, weights, positions, lines and widths), the
**Energy config sheet** (2026-08-03 — opened from the strip's tutorial-state button on Home
and closed again before the tab loop, since a bottom sheet's scrim swallows every click
under it), **Shopping's Food and Catalogue drawers** (2026-08-10, one scan each — their
expanded body is the real `FoodTab`/`CatalogueTab` now, so the Catalogue one puts a search
field, a sort segment and name·price·trash rows inside a card that is itself inside the
screen's padding: three stacked horizontal insets, the shape that produced the task editor's
findings), and — since 2026-08-01 — the **task editor**, the **goals sheet**, the **health
form** and the **medicine editor**. Before that pass it had never opened an editor or pushed
sub-screen *at all*, so the app's densest forms were the one place it couldn't see, which is
exactly where the mic bug lived. **`--lang=en` was also broken outright** until the same
pass: it waited on a "Language: English." radio that never exists, because Basics renders in
Norwegian until that very row is tapped. Both are worth knowing before trusting a clean run —
a mode this audit doesn't walk is not a mode it passes. When you add a surface with tight
horizontal pressure, add a step for it.

Three things constrain how steps can be ordered, all verified rather than assumed:
- **The run is FOUR passes.** `settings`, `medicine-form` and — since the 2026-08-20 5→3 tab
  merge — **the To-do screen** are dead ends (pushed screens that render no `BottomNav`), so
  only one of them can end a pass. `health-form` is a push that *keeps* BottomNav, so it
  doesn't need one. ⚠️ **Two of this walk's locators had gone stale and were skipping silently**
  (found 2026-08-20): `health-form` waited on `t.logSymptomTrigger`, which has not been on the
  Health tab since that screen was rebuilt on 2026-08-11, and `goals-drawer` waited on a bare
  "Goals" where the drawer is labelled `t.goals.editLinkPractical` ("Practical goals"). Both
  printed a one-line "step skipped" and the run still reported totals, so the app's second- and
  third-densest forms were simply not being measured. **A step that skips is not a step that
  passes — check the "screens measured" list against the steps, not just the totals.**
  ⚠️ **It happened again on 2026-08-21, from a change nowhere near this script**: every card
  rests CLOSED now (`lib/cardDefaults.ts`), so the To-do walk's `.first()` "New task" composer
  lives inside a folded card and does not exist — and the whole `task-editor` + `goals-drawer`
  leg went back to skipping silently. Both walks open the card they need first. **Any pass that
  changes what a surface draws by default should re-read this list**, because the failure is a
  step that stops running rather than one that fails. The onboarding→tour→Energy-sheet on-ramp is
  shared by both passes via `walkToTabs()`, scanned only on the first (the second re-walks it
  with scanning off, since it's identical and would double every finding).
- **Never `page.goto()` or `page.goBack()` mid-walk**, except the standalone
  `basics-all-rows` route right at the end of the run. Both reload the document, which resets
  the in-memory `sql.js` DB and drops you back into onboarding.
- **`app/scan.tsx` is deliberately not walked.** The web bundle resolves `app/scan.web.tsx`,
  an OCR "not available" placeholder, so measuring it would report on a screen that doesn't
  exist on device. Like the rest of the native-only surface, it needs a real device.

Known-benign findings, don't "fix" them:
- ⚠️ **Anything the `tour-step` scan reports about a card on ANOTHER TAB.** The pager keeps all
  three screens mounted (`lazy: false`), so that scan measures Shop's and To-do's cards as well
  as the one the spotlight is on — at whatever transient width they happen to have while the
  overlay is up. At 360px it reported "Katalog" truncated by 11px while the `Handle` scan, which
  measures that card on its own settled page, reported nothing for it. **Trust the per-screen
  scans (`home`, `Handle`, `Gjøremål`) over `tour-step` for anything that is not the tour's own
  coach card.** Verified at 327/360/430 in Norwegian: no card title truncates on a directly
  measured screen.
- Two **`[y]` findings on `tour-step`** (2026-08-21): the Home tab's content and its last card,
  reported as cut off at the bottom. The tour locks scrolling while the spotlight is up, so
  ordinary below-the-fold content has no scroller to be reachable through and the walk records it
  as clipped. Nothing is wrong with the cards; the run is clean at 2 findings.
- The **goals sheet** reports 1 wrapped control row at every width. That's `starterChips` — a
  `flexWrap` cloud of four sentence-length goal suggestions, which is *supposed* to wrap. The
  detector can't be taught to ignore it without also blinding it to the weekday-chip row, which
  uses `flexWrap` too but has a hard minimum width and IS a bug when it wraps. One documented
  false positive beats a blind spot.
- The **design lab** reports 4 wrapped rows at `--lang=no --width=327` (re-measured after the
  playground rebuild — the count went 3 → 4 and the membership changed again). All four are
  `flexWrap` clouds of the `starterChips` family or the documented three-button case, and none
  is a bug:
  - `design-lab-part-panel` — the four width pills (`En firedel … Hele linja`), 26px short.
  - `design-lab-part-panel` — the colour swatch strip plus its `More…` chip. The swatches
    carry no text, which is why that row prints as `|||||||Flere…` in the report.
  - `design-lab-colour` — Send · Save · Put everything back. The same three-button action row
    as before, **now on the token screen**, still carrying the `flexWrap` + `rowGap` fix the
    task editor got: the labels are words the maintainer needs to read, so the row wraps
    rather than truncating.
  - `design-lab-controls` — the ten raw slot-option pills, unchanged.
  One near-miss is worth knowing rather than fixing: `design-lab-card`'s empty-card line misses
  one line by **8px** at 327 in Norwegian.
- ⚠️ **`quick-add-focused` (the Habits composer's options panel) reports a wrapped control row
  since phase 7 of `DESIGN_COMPARISON/19-IMPLEMENTATION.md`** (`lib/cardRegistry.ts`'s
  `habitsList.compose` table, wired into `components/HabitsSurface.tsx`'s panel): "short by
  562px | 5 items on 3 lines" at `--lang=no --width=360`. **Confirmed new, not pre-existing** —
  on `main` the same panel draws only Energy + `HabitRecurrenceCells`' 1–2 cells (2–3 total);
  phase 7 added a Target `Stepper` and a Remind toggle (plus its dependent Time cell when Remind
  is on), taking it to 5. **And confirmed NOT a layout bug** — a screenshot at 360px
  (`npm run halos`-style manual capture) shows a clean 2-column grid: pair, then one cell alone
  on its own full-width line (`Hver 1. dag`, whose two steppers need the room), then a second
  pair, then "More options". Nothing truncates, overlaps or spills off the card.
  **The "short by Npx" number is structurally meaningless for this component family**, which is
  why it joins the design-lab bullet above rather than getting a code change: the control-row
  detector sums every child's ACTUAL RENDERED width — including children already sitting on
  DIFFERENT wrapped rows — and compares that sum to the width of ONE row (`scripts/measure-wraps.mjs`'s
  `needPx` reducer, next to the "Control rows" section header). That sum only shrinks below the
  row width for a `QuickAddOptionsPanel` with one or two cells; the panel is designed to wrap
  (`components/QuickAddOptionsPanel.tsx`'s header: "cells pair two-per-line"), so any caller
  with three or more cells trips this exact false positive — precisely the shape already
  documented for `design-lab-part-panel`/`design-lab-colour`/`design-lab-controls` above. Adding
  a `wide` prop to a cell to "fix" this would make the reported number WORSE, not better (a
  `wide` cell's rendered width grows to the full row, which the sum then counts in full), for no
  visual gain — the fix that would move the number is exactly the fix that must not be made.
  Don't shorten copy, don't add `wide`, and don't re-litigate this as a regression next time the
  audit runs; if a *sixth* option cell is ever added here, expect the number to grow again for
  the same non-reason.
- The **token screen's three tab labels** may be reported as TRUNCATED by a few px at
  `--width=327`, Norwegian only. `components/TabSlider.tsx` sets `adjustsFontSizeToFit` +
  `minimumFontScale` 0.85, which react-native-web implements neither of — the exact artifact
  this audit's own TRUNCATED warning describes. A few px against a 15% shrink floor is
  comfortable; don't shorten the words for it.

**The Delete·Discard·Save row was fixed in the task editor and nowhere else, and that showed
up as a sliced Save button (2026-08-23).** `npm run wraps --lang=no --width=360` reported the
medicine editor's Discard/Save pair 7px past the pop-up pane's own overflow mask — a CLIPPED
control, the same category as the voice mic. `justifyContent: 'space-between'` shrinks nothing:
Slett (84) + Forkast·Lagre (205) needs 289px in the 267 a 92%-wide `CenterModalScreen` pane
leaves at 360, so the surplus simply hung off the end. `components/TaskCard.tsx` had carried the
fix (`flexWrap` + `rowGap`, `marginLeft: 'auto'` on the right cluster) since 2026-08-01;
`app/medicine-form.tsx` and `app/habit-form.tsx` — which copied the row and whose header even
says "same row as habit-form" — never got it. All three now agree, gap included. ⚠️ The finding
only names an unlabelled `<div>`, so the audit's CLIPPED entries carry the element's own TEXT on
both axes now ("ForkastLagre" is what made it findable); it used to be y-axis only.

The task editor's own `--width=327` findings (Energy stepper, add-step button,
Delete·Discard·Save) were **fixed** the same day; the audit is clean at 327/360/393/430 in
both languages. Three different causes, and the fix depended on which:
- a flex row whose input wouldn't shrink → `flex: 1` **plus `minWidth: 0`** (`titleInput`,
  `addStepInput`). `flex: 1` alone does nothing here — see the note in `components/TaskCard.tsx`.
- a label competing with a fixed-size control → let the **label** yield (`flex: 1` +
  `minWidth: 0` on the label side, `flexShrink` on its Text), never the stepper, which has
  no width to give.
- three labelled buttons that genuinely don't fit → **wrap the row** (`flexWrap` + `rowGap`,
  `marginLeft: 'auto'` to keep the right-hand cluster right-aligned once it wraps). This is
  the audit's own "cannot be fixed by shortening copy" case; shrinking further would have
  truncated the words off the confirm/discard buttons.

Two structural lessons from that pass, worth not re-learning: horizontal chrome **stacks**
(three nested 16px paddings plus an icon gutter left text 306 of 393px, and onboarding's
`Spacing.xl` screen padding left one card just 238px — 40% of the screen); and a control
row built from `minWidth` + `flexWrap` has a hard floor that silently breaks on smaller
phones (7 chips x 40 + 6 x 4 gap = 304px, vs ~295px available at 360px). Prefer `flex: 1`
children with no minWidth, the way `components/TaskCard.tsx`'s `weekdayChip` always has.

- **The `.web` sibling pattern** (Metro resolves `file.web.ts(x)` over `file.ts(x)` on
  web — no `Platform.OS` branches in native files): `lib/sqlite.ts`/`lib/sqlite.web.ts`
  (DB handle), `lib/lanTransport.web.ts` (LAN sync stub — `isTransportAvailable()` false),
  `lib/widgets/sync.web.ts` (Android widgets no-op), `app/(tabs)/scan.web.tsx` (OCR
  placeholder screen — `@react-native-ml-kit/text-recognition` has no web build).
  `metro.config.js` adds `.wasm` to `resolver.assetExts` (harmless leftover from the
  rejected wa-sqlite path; costs nothing to keep).
- **Not pixel-perfect native.** react-native-web renders layout/navigation/store logic
  faithfully but differs from native in shadows/elevation, some font metrics, and
  Reanimated timing. Use this for "does the flow/logic work," not final visual sign-off —
  that still goes through a device/EAS build.

### Design-review package — `npm run review-bundle` (2026-08-09)
Builds the thing you hand to someone — a person or another AI — who has never seen this
codebase and is being asked to critique its **layout and visuals**. One command, four steps
(`scripts/run-review-bundle.sh`): build the web bundle, screenshot every screen in every
state, collect every component's source, derive the connection map, zip it. Output is
`review-bundle/` + `review-bundle.zip`, both **gitignored** — 14 MB of PNGs per run would sit
in git history forever, and the whole thing regenerates in ~15 minutes.

- `review-bundle/screens/` — 80 shots with `INDEX.md` captioning each one: 56 light
  (`scripts/screenshot-states.mjs`) plus 24 dark (`--theme=dark --only=core`). **Every caption
  names the STATE**, because half the value is the empty ones — this app puts real teaching
  content where a blank list would be, so "Home, empty" is a designed screen, not an absence.
- `review-bundle/source/` — every `components/*.tsx`, every `app/**/*.tsx` and the
  colour/spacing/type/motion token files, full source with headers, chunked into ~220 KB
  Markdown files so any one of them fits in a context window whole.
- `review-bundle/CONNECTIONS.md` — the screen tree, what each screen mounts, a per-component
  table of who imports it and which screens can reach it, the 20 most-shared components
  (highest-leverage to change) and any component nothing imports. **Derived from the real
  `@/` imports**, not from the `Connections:` header prose — so it is a cross-check ON those
  headers, not a copy of them. The `INVENTORY.csv` beside it is the same data, machine-readable.
- `review-bundle/README.md` — the orientation note, including the ground rules a reviewer
  needs *before* suggesting things (one flat border per card, hue from the screen, the row
  anatomy, the three composer tiers, no-guilt copy, EN/NO length). Suggestions that break
  those have usually already been considered and rejected; the useful ones work within them.

`scripts/screenshot-states.mjs` is a different job from `scripts/preview.mjs` — preview proves
write→read paths still work, this one documents what the app looks like — and its phase order
is not cosmetic. **The web DB is in-memory sql.js and there is no in-app back button on web**
(ScreenHeader draws one on iOS only), so reaching any pushed sub-screen costs a `goBack()`,
which reloads the document and wipes every seeded row. Hence: onboarding → empty tabs → sheets
(they close in place) → pushed sub-screens as independent throwaway excursions → seed for real
and shoot the populated surfaces with **no navigation at all** → one last data-bearing push.
`ensureTabs()` is the recovery hatch: after any excursion it re-runs onboarding from scratch
if the bottom nav is gone, so a mis-landed `goBack` costs a minute rather than the run.

Two things there are worth knowing before editing it:
- **Dark mode is set under the app, not through it** (`forceDarkMode()`). Appearance lives in
  Settings, Settings is a pushed dead end, and leaving it reloads the document — which wipes
  the setting along with the DB. So an `addInitScript` intercepts the assignment of
  `window.__unfocusSqlJsDb__` and re-asserts `dark_mode='on'` before every read of the
  settings table, which also survives onboarding writing its own appearance pick over it.
- **Scroll position decides the framing.** The app scrolls inside a fixed-height ScrollView,
  not the document, so `fullPage: true` captures the viewport, not the whole screen. Every
  non-overlay shot wheels back to the top first — and the wheel has to be preceded by a
  `mouse.move()` into the content, because the cursor starts at (0,0) where the wheel is a
  no-op on several screens.

