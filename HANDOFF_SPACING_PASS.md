# Handoff: spacing & text-sizing consistency pass

**Status as of hand-off:** All planned code/doc edits are written to disk on
branch `claude/app-spacing-text-sizing-4fly94`, but **NOT YET committed,
NOT YET typechecked/tested, and NOT YET pushed/PR'd/merged**, because the
Claude Code Bash tool hit a prolonged "claude-sonnet-5 is temporarily
unavailable" classifier outage mid-session (non-read-only Bash calls —
`git add`, `git commit`, `npx tsc`, etc. — were rejected repeatedly; plain
`git status`/`echo`/`pwd` kept working, since read-only calls skip the
classifier). If you're picking this up, your first move should just be to
retry these same commands — the work itself is done, only the mechanical
verify/commit/push/PR/merge steps remain.

Delete this file once the PR is merged — it's a session hand-off note, not
permanent repo documentation.

## What changed and why

This was a plain-language user request: "look at general spacing and size
in app — some places have too much, others little, and text size isn't
necessarily covered properly." A two-pass audit (grep for token usage
across `app/`/`components/`, then a manual read of Home/Shopping/Health/
Plans + shared components) found the app already has a documented spacing/
typography system (`Spacing`, `FontSize`, `Radius` in `constants/theme.ts`,
backed by `SPACING_LAYOUT_LIBRARY.md` / `TYPOGRAPHY_LIBRARY.md`), followed
~85–90% of the time, with a long tail of raw/hardcoded numbers and a few
genuinely divergent "standard" values. The full plan (context + reasoning
for each fix) is preserved at
`/root/.claude/plans/look-at-general-spacing-polished-lollipop.md` on
whatever machine ran this session — if that path isn't available to you,
this document plus the diff is the full record; nothing else is needed to
finish the task.

## Files changed (all edits already applied, working tree only)

Run `git status` / `git diff` to see the exact diff. Summary per file:

- **`constants/theme.ts`** — deleted the dead `Layout` export
  (`cardPadding`/`cardPaddingV`/`cardPaddingH`/`cardGap`/`maxVisible`). It
  was documented as "the" card-padding standard but had **zero real
  usages** anywhere in `app/`/`components/` — every actual card already
  used `Spacing.md` (16). Also updated the file header comment that
  referenced `Layout`.
- **`SPACING_LAYOUT_LIBRARY.md`, `CARD_CONTAINER_LIBRARY.md`,
  `SHADOW_ELEVATION_LIBRARY.md`, `FORM_PATTERNS_LIBRARY.md`** — replaced
  every `Layout.cardPadding`/`cardPaddingV`/`cardPaddingH`/`cardGap`/
  `maxVisible` reference with `Spacing.md` (16) (or removed the section,
  for `SPACING_LAYOUT_LIBRARY.md`'s now-pointless "Layout Tokens" block),
  so the docs match what the code actually does. Also fixed two stale
  "18px" labels that were describing the old (unused) `Layout.cardPadding`
  value.
- **`app/(tabs)/plans.tsx`** — `content.paddingBottom` was `Spacing.xl`
  (32) vs. Home/Shopping/Health's uniform 16 on every edge (ScreenScaffold
  already adds `BOTTOM_NAV_HEIGHT` (72) as bottom-nav clearance on top of
  this). Changed to plain `Spacing.md` (16) so all four tab screens land
  at the same ~88px total bottom clearance.
- **`app/(tabs)/health.tsx`** — removed a redundant
  `<View style={{height:80}}/>` spacer at the very end of the scroll
  content. It stacked on top of ScreenScaffold's own 72px clearance +
  the screen's own 16px content padding, giving Health ~168px of dead
  space at the bottom vs. ~88px everywhere else, with no floating
  FAB/overlay to justify it (health.tsx's AddFAB is inline, not
  absolutely positioned). Also added an Edit-notes bullet documenting
  that the week/month habit-grid day-abbreviation/date labels
  (`ailmentDayAbbr`/`dayAbbr`/`weekGridDayAbbr`/`weekGridDate`/
  `monthDotDate`) intentionally use raw 7–9px fontSize below the
  `FontSize.xs` (12) floor — the month view packs ~31 date+dot columns
  into one row, so there's no room for the standard scale there. Left
  those values alone on purpose; don't "fix" them without redoing the
  grid layout.
- **`app/(tabs)/shopping.tsx`** — Weekly tab's `content` gap was
  `Spacing.md` (16), half of the Monthly tab's own `bodyGap`
  (`Spacing.xl`, 32) and half of Home/Health/Plans' `section` gap (also
  32). Changed `content`'s gap to `Spacing.xl` (32) for consistency.
  **Caveat:** `content` is the single container for HintCard +
  SharedRequestsSection + all tab body content, so this also widens the
  gap between the top-of-screen HintCard/SharedRequestsSection and the
  first real section — worth a visual sanity check in the web preview
  (Home's equivalent HintCard→content gap is ~0 via `header:{marginBottom:0}`,
  a different pattern). If it looks over-spaced at the top in the
  preview screenshots, the better fix is restructuring the JSX so
  HintCard/SharedRequestsSection sit outside the `Spacing.xl`-gapped
  flow (matching Home's pattern) rather than reverting to 16 — that
  wasn't done here because it's a bigger structural change than a
  same-session style-value pass, and the plan's non-goals explicitly
  ruled out restructuring.
  Also fixed a raw `fontSize: 10` badge-count label → `FontSize.xs` (12).
- **`components/SharedRequestsSection.tsx`** — `card.padding` was
  `Spacing.sm` (8), half the app-wide card-padding norm of `Spacing.md`
  (16). Changed to `Spacing.md`.
- **`components/AddItemSheet.tsx`** — `card.padding` was `Spacing.lg`
  (24), above the norm. Changed to `Spacing.md` (16). (Left `overlay`'s
  own `Spacing.lg` padding alone — that's the backdrop-to-modal-edge
  margin, a different, legitimately larger, slot.)
- **`app/(tabs)/index.tsx`** — Home's greeting text was `FontSize.xxl`
  (28) while every other tab's chrome title (`ScreenHeader.tsx`) renders
  at `FontSize.xl` (22) — Home doesn't use `ScreenHeader`'s title for its
  primary heading, it renders its own bigger greeting instead, so the
  biggest text a user sees differed by tab. Changed Home's greeting to
  `FontSize.xl` (22).
- **`app/settings.tsx`, `app/(tabs)/scan.tsx`, `components/WeekListCard.tsx`,
  `components/DatePickerCalendar.tsx`** — snapped scattered raw
  padding/margin/gap numeric literals (2, 4, 5, 6, 10, 11, 12, 13, 18, 30,
  32) to the nearest `Spacing` token (`xs:4, sm:8, md:16, lg:24, xl:32`)
  wherever they were a general layout gap. Left two decorative glyph
  sizes alone on purpose (`scan.tsx`... actually `settings.tsx`'s
  `langFlag: fontSize:24` emoji flag, `DatePickerCalendar.tsx`'s
  `navArrow: fontSize:26` "‹"/"›" character) — those are icon-scale
  glyphs, not body text, matching the same precedent as onboarding's
  72px icon glyphs (never tokenized in this codebase; intentionally out
  of scope).

## What's verified vs. not

- **Manually reviewed**: every edited block was re-read after editing to
  confirm no syntax errors (balanced braces, correct token names). High
  confidence this compiles, but **`npx tsc --noEmit` has not actually been
  run** — do this first.
- **Not run**: `scripts/test-changed.sh` (Jest), `npm run preview` (Expo
  Web + Playwright screenshots across all 5 tabs).
- **Not committed, not pushed, no PR opened.**

## Next steps (in order)

1. `npx tsc --noEmit` — must pass clean. If it doesn't, the likely culprit
   is a leftover `Layout.` reference somewhere `grep -rn "Layout\." --include='*.tsx' --include='*.ts'`
   didn't catch (re-run that grep — it should return nothing outside of
   `components/PlanTaskCard.tsx`'s unrelated "Layout is the proportional
   rail" prose comment and `PROGRESS_LOG.md`'s unrelated Reanimated
   `Layout.springify()` mentions).
2. `scripts/test-changed.sh` — run the Jest suites related to changed
   files. Report pass/fail, don't just assume green.
3. `npm run preview` — build the Expo Web preview, screenshot all 5 tabs.
   Specifically check:
   - Home's heading is no longer oversized vs. other tabs' chrome title.
   - Shopping's Weekly tab: does the wider gap between HintCard/
     SharedRequestsSection and the first section look right, or
     over-spaced? (See the caveat under `shopping.tsx` above — if it
     looks wrong, that's the one change in this pass most likely to need
     a follow-up fix.)
   - Card padding looks uniform across TaskCard/SharedRequestsSection/
     AddItemSheet/other cards.
   - Health tab: bottom of the habit list isn't awkwardly close to
     BottomNav now that the extra 80px spacer is gone, and the tiny
     7–9px grid labels are still legible (expected — intentional,
     documented in the file header).
4. Commit on `claude/app-spacing-text-sizing-4fly94` (already the checked
   out branch — do NOT create a new branch), push, open a PR into `main`,
   and **merge it yourself** — this is standing repo policy (see
   `AGENTS.md` / `CLAUDE.md` "Publishing" section: OTA only fires on push
   to `main`, and the agent is expected to merge, not hand it back to the
   user). This is a pure JS/style/doc change — no native/config touched,
   so no APK build is needed, OTA picks it up automatically once merged.
5. Delete this handoff file (`HANDOFF_SPACING_PASS.md`) as part of that
   same commit — it's scaffolding for the handoff, not permanent repo
   content.
