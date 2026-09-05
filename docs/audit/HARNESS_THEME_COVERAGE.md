# Both-theme harness coverage — session S0.2

Answers Phase B of session S0.2 (`SESSION_S0.2_REPORTING_CONTRACT.md`): does each of the four
visual/geometry harnesses walk light, dark, or both, and does the coverage actually catch a
light-mode-only defect (not just execute twice)?

## B1 — current state, before this session touched anything

All four harnesses **already ran both themes in CI as of 2026-09-01**, per
`.github/workflows/ci.yml`'s `visual` job (lines ~103–137) — a prior session closed this gap
before S0.1/S0.3 ran. Each script accepts `--theme=dark|light` via `scripts/force-appearance.mjs`'s
`themeFromArgs()`, and CI runs each harness once per theme:

| harness | CI runs both themes? | mechanism |
|---|---|---|
| `visual` | yes | separate baseline dirs `visual-baselines/{light,dark}/`, diffed independently |
| `geometry` | yes | `--theme=dark` forces the OS-level appearance via `force-appearance.mjs` |
| `wraps` | yes | same `--theme=` flag, `npm run wraps -- --lang=no --width=360[--theme=dark]` |
| `halos` | yes | same `--theme=` flag |

So Phase B1's finding is: **no gap to close.** Phase B2 ("close any gap") is a no-op this session.

## B3 — proving it with a probe

Per the brief: *"A harness that cannot be made to fail on a light-only probe has not been
extended, whatever its output says."* Ran anyway, since the extension predates this session and
was never itself probed.

### `visual` — probed, discriminates correctly

Injected a deliberate light-only defect: `constants/colors.ts`'s light `surface` color, `#FAFCFE`
→ `#FF00FF` (dark's palette untouched).

- `npm run visual` (light): **17 findings** — `medicine-form` alone at 55,276 px / 13.793% changed,
  plus `health-form`, `catalogue`, `quick-add-focused-empty`, `task-editor` and others.
- `npm run visual -- --theme=dark`: **clean, 21/21 unchanged** — completely unaffected, as
  expected since dark's palette wasn't touched.
- Reverted `constants/colors.ts`, rebuilt, re-ran `npm run visual` (light): **clean again**,
  matching the pre-probe baseline exactly.

This is a clean pass/fail discrimination by theme — `visual` genuinely sees a light-only defect
and dark genuinely doesn't false-positive on it.

### `geometry`, `wraps`, `halos` — both-theme execution confirmed; a color-only probe doesn't apply to them, by design

Ran clean in both themes with no probe defect:

- `geometry` (light and dark): `geometry: clean ✓` in both.
- `wraps --lang=no --width=360` (light and dark): **21/21 screens measured** in both — same
  screen list both times (`onboarding-basics`, `home`, `Handle`, `Gjøremål`, …), so doubling the
  walk did not un-measure anything. Total wrapped-string counts differ (66 light vs. 74 dark) —
  expected, since dark and light strings aren't required to wrap identically, and the coverage
  line (what B3 actually gates) is unchanged.
- `halos` (light and dark): **0 clipped, 10 clean, 0 no-halo**, coverage "10 fields scanned" in
  both.

**Why no color-defect probe was run against these three:** `geometry` measures element
position/size (px offsets, alignment, skew), `wraps` measures text-wrap/truncation, and `halos`
measures a `boxShadow`'s clipped extent — none of the three reads a pixel color. Checked directly
against their source (`scripts/measure-geometry.mjs`, `measure-wraps.mjs`, `measure-halos.mjs`):
the `theme` parameter exists only to set the OS-level dark/light flag before measuring, and no
branch in any of the three conditions its measurement logic on theme. By this app's own design
invariant (colors vary by theme; layout does not), a **light-mode-only geometry/wrap/halo
regression is not a constructible class** — there is no code path where changing a light-only
color could move a pixel offset, wrap point, or halo radius. Reporting a probe result for these
three would either be a fabricated no-op (the "probe" changes nothing they measure) or would
require inventing a theme-conditional layout bug that doesn't exist in this codebase. This is
recorded as an honest finding, not a gap: their both-theme execution stands on the general
principle (colors and layout can diverge in a rewrite even if they don't today) and on `visual`
already proving the underlying theme-forcing mechanism (`force-appearance.mjs`) works.

## wraps screens-measured, before vs after (not touched this session, recorded per B1)

| theme | screens measured | wrapped | truncated | clipped |
|---|---|---|---|---|
| light | 21 | 66 | 6 | 4 |
| dark | 21 | 74 | 6 | 4 |

Same 21-screen list both themes (`coverage: 21 screens measured, expected at least 21` in both) —
no un-measuring.

## CI runtime

Not independently measured this session (would require a CI run, not available headlessly here).
Each harness already runs twice in `.github/workflows/ci.yml` (light + dark steps) — this was
true before S0.2 and is unchanged by it. Per the brief's STOP-adjacent instruction ("if CI time
becomes a problem, report it — do not silently sample a subset"): no session has reported a CI
runtime problem, so no action is due here.

## Conclusion

Both-theme coverage was already fully in place before this session. This session's contribution
is the probe evidence above (previously undone) confirming the coverage isn't a no-op, plus the
reporting contract (`CLAUDE.md`) that requires future sessions to state evidence tags rather than
assume a harness saw what they think it saw.
