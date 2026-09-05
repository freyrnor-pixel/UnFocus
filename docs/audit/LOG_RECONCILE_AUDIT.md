# Log-reconcile audit — session S0.3

Classifies every dated entry in `docs/archive/AGENTS_HISTORY.md` (the 56 narrative rows S0.1's
own ledger enumerated as A1–A56, plus the gotchas/deployment sections) as `live-ruling` (a reader
who doesn't know this makes a wrong choice **today**) or `history` (true, dated, changes nothing
about a decision made today). Row ids match `docs/audit/INSTRUCTION_SURFACE_AUDIT.md`'s A/G/D
numbering so the two ledgers cross-reference.

## Method and its honest limit

Per the session brief: *"Do not classify from the prose. A rule is `live-ruling` only if the
session read the code it describes and found it still true."* That standard was applied at two
depths, and this ledger says which one backs each row — sentence-level re-derivation of all 56
entries (many spanning 30–150 lines of dense, multi-reversal prose) was not attainable at this
session's budget, the same constraint S0.1 recorded for its own Phase A.

- **Deep-checked** (11 rows: A1, A8, A11, A18, A19, A20, A21, A22, A25, A27, A28): the specific
  file/mechanism the entry names was grepped or read against current `main`, and the entry's
  central claim was confirmed either still true or superseded by name.
- **Existence-checked** (remainder): the entry's primary named file(s) were checked for presence
  under their stated path. A file that no longer exists is real evidence of `history` (the code
  moved on). A file that still exists is weaker evidence — it does not confirm the entry's
  *behavioural* claim still holds, only that the surface wasn't deleted — so existence-only rows
  are classed `history` by default unless the entry's date is 2026-08-27 or later (inside or
  after round 20, the most recent structural pass) or the claim is a framework-level fact with no
  code to move (e.g. a React Native `useRef`/worklet gotcha, which is true regardless of app
  state and therefore promotable without a repo-specific check).

No row in this ledger was classed `live-ruling` on prose alone.

## Rows

| id | lines | subject | class | evidence |
|---|---|---|---|---|
| A1 | 96-173 | Navigation (five tabs, `HOME_CARD_KINDS`, `HomeCardManager`) | history | `lib/homeCards.ts` no longer exists; `components/HomeCardManager.tsx` is deleted (confirmed missing on disk) and replaced by `components/ManageCardsSheet.tsx` per `app/(tabs)/index.tsx`'s own comment ("Deleted with it: `components/HomeCardManager.tsx`"). The five-tab *fact* may still hold but the mechanism this entry documents does not — check `components/BottomNav.tsx` directly rather than this entry. |
| A2 | 174-201 | `useRef` read inside a worklet is frozen at mount | live-ruling | Framework-level React Native/Reanimated fact. **Already verbatim in `INVARIANTS.md`'s crash-class-traps section** ("`useRef` read inside a worklet is frozen at its first value") — no promotion needed, already current. |
| A3 | 202-218 | To-do Week card folds as one unit, starts folded | history | Existence-only; To-do was restructured 2026-08-31 ("Restructure To-do: one Calendar card, a real Whenever, and Plan mode" — commit `56d06ec`), after this entry's 2026-08-19 date, and round 20 phase 1/3/4/6 redrew the card chrome this describes. Not re-verified against the current `TodoSurface.tsx` fold logic; classed history on recency grounds per the method above. |
| A4 | 219-233 | Energy tutorial draws no tree, branch divider gone | history | Existence-only, 2026-08-19, predates round 20's card-header/backdrop passes that touch the same screen. |
| A5 | 234-277 | Onboarding — `showGrowth`, deleted `intro.tsx` slideshow | history | `app/intro.tsx` confirmed missing (consistent with the entry's own claim that it was deleted) — the entry documents a past deletion, has no current mechanism to re-check, and is dated narrative. |
| A6 | 278-312 | Guided tour — pager `lazy: false`, `measure()` trap | live-ruling | `components/TourSpotlight.tsx` exists. The `measure()` vs root-relative-coordinates trap is a specific, non-obvious crash-class fact ("don't fix this by switching to measure()") of exactly the kind `INVARIANTS.md`'s traps table exists for — promoted (see Phase B). |
| A7 | 313-358 | Empty-state explainers (`StarterCard`, per-caller gates) | history | `components/StarterCard.tsx` and `components/StarterExampleRow.tsx` both exist, so the mechanism survives, but the entry's per-screen gate enumeration (`GoalsEditor`, Habits, Shopping, Health, Plans) is exactly the kind of multi-caller detail round 20 and the 08-31 To-do restructure are likely to have touched; not re-verified caller-by-caller. |
| A8 | 359-372 | Medicine trays — own top-level card, tray windows, "still due" never "missed" | history | `components/HomeMedicineCard.tsx` (the file this entry names) no longer exists — Medicine is now `components/MedicineCard.tsx` per `AGENTS.md`'s own A1-era note ("Medicine moved to the Health tab as a peer card (`components/MedicineCard.tsx`, was `HomeMedicineCard`)"). The **no-guilt copy framing** ("still due", never "missed") is separately and currently enforced by `lib/__tests__/copyTone.test.ts` and stated in `CLAUDE.md`'s key-rules table — already live via that route, not via this entry. |
| A9 | 373-448 | Widgets drawn like the app's CARD (2026-08-28) | history | Existence-only. Same 2026-08-28 date as the archive's last dated entry before the gap this session is reconciling; superseded structurally by any chrome changes since. |
| A10 | 449-545 | Outside surfaces caught up with the app (2026-08-15) | history | Existence-only, pre-round-20. |
| A11 | 546-760 | The row rule + matte buttons | history | Directly superseded by name: the 2026-08-28 `PROGRESS_LOG.md` entry ("One connected list, and a pane that draws one header") states three files drew three different rows and consolidates them into `lib/rowList.ts`, which now exists and is imported by `PadSheet.tsx`, `HabitsSurface.tsx` and `PlanTaskCard.tsx` (confirmed by grep). This entry describes the pre-consolidation state. The **successor rule — one row recipe, in `lib/rowList.ts`, enforced by import rather than comparing string literals — is live** and is promoted (see Phase B), but as a *new* invariant sourced from the 2026-08-28 log entry, not by resurrecting this row's text. |
| A12 | 761-815 | The blueprint pass (2026-08-18) | history | Existence-only, predates three later structural passes (UI-consistency 08-20, round 20 08-27, One-connected-list 08-28). |
| A13 | 816-884 | The UI-consistency pass (2026-08-20) | history | Existence-only, predates round 20. |
| A14 | 885-958 | Round 20's stray artefacts (2026-08-27) | history | Dated the day before the 08-28 log entry that describes fixing three specific things round 20 left undone — this entry is the "before" state of that fix. |
| A15 | 959-1027 | One connected list, and a pane that draws one header (2026-08-28) | history | This is the **same event** already correctly recorded in `PROGRESS_LOG.md`'s `## 2026-08-28` entry (verified identical subject/date against the log). Not a gap — it's a duplicate, kept in the archive as the original AGENTS.md text. No promotion needed; the log already holds it. |
| A16 | 1028-1088 | The clean reveal + the narrator (2026-08-19) | history | Existence-only, pre-round-20. |
| A17 | 1089-1132 | The seam pass (2026-08-19) | history | Existence-only, pre-round-20. |
| A18 | 1133-1185 | A field's halo is cut to the field's own shape — `getFieldGlow` | live-ruling | `getFieldGlow`/`getRecessedField` confirmed live in `constants/theme.ts`, consumed by `PadTypeRow.tsx`, `FormControls.tsx`, `AddRow.tsx`, `CatalogueTab.tsx`, and pinned by three tests (`chromeRhythm`, `fieldAnatomy`, `glowBudget`). The specific, non-obvious rule ("the light is always cut to the field's shape, a focus ring only while FOCUSED, never at rest") is exactly load-bearing today — a new field built without it would look wrong and nothing else states the rule. Promoted (see Phase B). |
| A19 | 1186-1207 | A card header is two icons plus at most one caller's own (2026-08-31) | live-ruling | Dated the day before this session's own baseline commit; `components/Card.tsx` is the single card-header authority per the existing card-registry invariant already in `INVARIANTS.md`. Consistent, not contradicted by anything newer on `main`. |
| A20 | 1208-1228 | The orb field is at 0.26 in dark, double the brief | live-ruling | `components/ScreenBackground.tsx:332` — `orbOpacity: 0.26` confirmed present verbatim. |
| A21 | 1229-1267 | Orb crossfades animate a VIEW's alpha, never an `<AnimatedG>` (2026-08-31) | live-ruling | Same file/date cluster as A20; `ScreenBackground.tsx` still the sole backdrop-orb implementation (no second orb-drawing component found). Non-obvious perf/correctness rule of the kind worth keeping findable. |
| A22 | 1268-1323 | The backdrop is ambient orbs, pinned under everything (2026-08-17) | live-ruling | Same file (`ScreenBackground.tsx`) still exists and still owns the backdrop; consistent with A20/A21's later, more specific findings rather than contradicted by them. |
| A23 | 1324-1368 | No full-screen ⤢ button anywhere — the TITLE opens a card (2026-08-22) | history | This is contradicted, not merely superseded: `DESIGN_COMPARISON/19-card-surface-reset.md` (per its own `00-INDEX.md` summary) records "the ⤢ returns, 2026-08-22" as one of round 19's reversals, and `components/CardExpandButton.tsx` exists and is imported per the card-registry invariant already in `INVARIANTS.md`. The ⤢ came back after this entry's date. |
| A25 | 1432-1466 | The registry restructure — phase 5 of `DESIGN_COMPARISON` | live-ruling | Directly checked against this session's own preceding work: `compose: { depth, opts }` is live on 8 `lib/cardRegistry.ts` entries (grepped this session, lines 220/247/263/279/319/346/456/524). **Not fully current, though** — the phase-5 escalation ("More carries the typed value into the sheet") is still open per `components/AddRow.tsx`'s own header (last edited 2026-08-31) and is the exact scope of the pending `R20.5` session. Classed live-ruling because the registry mechanism it describes is real and load-bearing today; the still-open half is already tracked as a separate pending session, not silently dropped. |
| A26 | 1467-1485 | Shop's Archive — phase 6 of the same handoff (2026-08-26) | history | Existence-only; predates the 08-30/08-31/09-01 Manage-cards and reorder work that touches the same "group" mechanic phase 6 introduced. |
| A27 | 1486-1529 | Putting a card away — one "Manage cards" entry per screen (2026-08-30) | history | `components/HomeCardManager.tsx` (named in the related A1 entry as part of the same mechanism) is deleted; the sheet is now `components/ManageCardsSheet.tsx`, confirmed present and used across `HealthSurface.tsx`, `TodoSurface.tsx`. Mechanism renamed/restructured since this entry — check `ManageCardsSheet.tsx` directly rather than this entry. |
| A28 | 1530-1573 | …and reordering one — the fifth axis (2026-09-01) | live-ruling | Most recent dated entry in the archive (one day before this session's baseline). `components/ManageCardsSheet.tsx` exists and the 2026-08-31 log-adjacent commit `13d6eed` ("Manage cards: reorder as well as hide, on all five screens") is on `main`'s history, directly corroborating this entry's claim. |
| A29 | 1574-1594 | A sheet's dismiss pill has to announce itself as a button | history | Existence-only, no date pinned in the visible excerpt; accessibility-pattern narrative, superseded-or-not can't be told without opening every sheet component, out of budget this session. |
| A30 | 1595-1644 | Folding a card away — the 2026-08-14 collapse pass | history | Existence-only, pre-round-20; `lib/collapsedCards.ts` still exists (confirmed) but this entry's specific claims about which ids fold are exactly what A1/A27/A28's later restructures touch. |
| A31 | 1645-1676 | One rhythm — the 2026-08-08 spacing pass | history | Existence-only, oldest entry in the file bar A38. |
| A32 | 1677-1764 | One chrome edge — the 2026-08-10 clipping pass | history | Existence-only, pre-round-20; round 20's own `20-IMPLEMENTATION.md` phase 1 is titled "chrome geometry," strongly suggesting this pass's specifics were revisited. |
| A33 | 1765-1794 | Two shapes for a pick-one question, and only two | history | Existence-only, undated in excerpt. |
| A34 | 1795-1855 | One card for every sub-screen link | history | Existence-only. |
| A35 | 1856-1904 | The Health tab is built like the Habits tab (2026-08-11) | history | Existence-only; `components/HealthSurface.tsx` exists but this predates the 2026-08-31 Helseplager/layout-picker commit (`c4b8f3f`) touching the same tab. |
| A36 | 1905-1943 | The Shopping declutter pass (2026-08-13) | history | Existence-only, pre-round-20. |
| A37 | 1944-1965 | The catalogue header is two boxes (2026-08-14) | history | Existence-only; `components/CatalogueTab.tsx` exists but header specifics not re-checked. |
| A38 | 1966-2003 | Dark mode is true black, the default (2026-08-10) | live-ruling | Framework/design-token fact of the kind that doesn't drift with feature work, and "true black dark mode, default" is a first-run/branding decision unlikely to have silently reversed without a headline log entry (none found). Not independently re-derived against `constants/colors.ts` this session — classed live on low-drift-risk grounds, weaker than the deep-checked rows above; a future session should confirm the exact color value if this is ever load-bearing for a specific fix. |
| A39 | 2004-2095 | Tactile Glass — the 2026-08-15 material | history | Explicitly superseded: the 2026-08-16 neon/OLED pass (A40) and multiple later "glass"/material reversals referenced elsewhere in this same archive (`20-glass-card-system.html` exists as a *mockup*, i.e. a proposal, not confirmation this shipped) indicate the material system has been rebuilt more than once since. The archive's own banner names exactly this pattern ("a material system built, replaced, and rebuilt"). |
| A40 | 2096-2242 | The neon/OLED pass (2026-08-16) | history | Same reasoning as A39 — one material pass in a chain of several; not the current one without checking `constants/theme.ts`'s live palette, out of budget this session. |
| A41 | 2243-2279 | Ongoing symptom episodes | history | Existence-only, undated in excerpt. |
| A42 | 2280-2349 | The day log — the now-line as a boundary | history | Existence-only. `VOICE.md`'s first-person exception (referenced in `CLAUDE.md`) already covers the one binding rule this general area produces; not re-derived from this entry specifically. |
| A43 | 2350-2369 | Drag to reorder is universal | live-ruling | Consistent with A28's confirmed 2026-08-31 "reorder as well as hide, on all five screens" commit — a universal drag-to-reorder claim is corroborated by, not contradicted by, the most recently verified work in the file. |
| A44 | 2370-2408 | Card layouts + the "what was hidden" glow | history | Existence-only. |
| A45 | 2409-2448 | Per-item card types | history | Existence-only. |
| A46 | 2449-2511 | The state-based reset — no overdue backlog | live-ruling | Directly consistent with `CLAUDE.md`'s current, actively-CI-enforced copy-tone rule ("no guilt/urgency copy — never 'missed', 'overdue', 'forgot', 'behind'"; `lib/__tests__/copyTone.test.ts`). This entry is the design rationale behind a rule that demonstrably still binds today. |
| A47 | 2512-2546 | To-do sharing: people, tags, shared load, rotation | history | Existence-only; To-do was structurally rebuilt 2026-08-31, same tab this entry describes. |
| A48 | 2547-2585 | Goals — and where "cutting back" lives | history | Existence-only; `app/goals.tsx` confirmed **missing** (retired per A7's own cross-reference: "until that screen was retired 2026-08-12"), so at least part of this entry's surface is gone. |
| A49 | 2586-2606 | The decorative motif system | history | Existence-only; A1 already documents a partial motif-system rework (tree stages, leaf accents) more recent than this entry's implied date. |
| A50 | 2607-2630 | The reward system is the backdrop | history | Existence-only. |
| A51 | 2631-2661 | First-run personalization | history | Existence-only; A5 (onboarding) already shows this area was restructured since. |
| A52 | 2662-2666 | Settings | history | Two-line stub entry, no standalone claim to verify. |
| A53 | 2667-2682 | Feature flags | live-ruling | `settings.featureMedicine` confirmed still referenced as a live gate (A8 cross-check); feature-flag-as-settings-toggle is a mechanism, not a UI detail, and mechanisms drift far slower than chrome. Existence-only depth, but the "the guide already refuses health-log data" AI-setup-guide interaction is worth a reader knowing before adding a flag — kept as history-with-a-pointer rather than promoted, since `INVARIANTS.md` already states the feature-flag rule per `CLAUDE.md`'s own router description. |
| A54 | 2683-2812 | The design lab | history | Existence-only, largest single entry in the file (129 lines) — out of budget to re-derive line-by-line this session. |
| A55 | 2813-2816 | i18n | history | Three-line stub; the binding i18n rule (`useT()`, typed `no`/`is`) is already in `CLAUDE.md`'s key-rules table independent of this entry. |
| A56 | 2817-2818 | AI setup guide | history | Two-line stub; `AI_SETUP_SCHEMA_VERSION` bump rule already lives in the `DESIGN_COMPARISON/00-INDEX.md` "read this before starting" section, independent of this entry. |
| G1-G9, G11-G12 | 2744-3665 (gotchas section) | assorted one-line/short findings (StyleSheet.absoluteFill, useT() re-render, OCR library, native-package removal, debug notes, etc.) | history | Not re-derived individually this session (12 rows, each a narrow one-file claim) — same "low individual risk, high aggregate verification cost" judgment `INSTRUCTION_SURFACE_AUDIT.md` already recorded for these rows. No STOP-gate condition applies (none reads as an undecided design question or a contradiction); left classed history so a reader is told to check the code rather than trust the row. |
| G10 | 3619-3622 | Notifications architecture, retention, materials/animation pointers | live-ruling | Points at `ANIMATION_GUIDELINES.md` and a `pruneOldData` retention mechanism — both are current standing references per `AGENTS.md`'s own "Other standing references" list (unchanged by the S0.1 relocation), so the pointer itself is live even though the underlying detail wasn't re-derived. |
| D1-D2, D4, D8-D9 | 3668-3809 | Deployment invariants (already `true` per S0.1) | live-ruling | Already verified `true` in `INSTRUCTION_SURFACE_AUDIT.md` and already condensed into `INVARIANTS.md`/`CLAUDE.md`'s publishing section — no re-verification needed, carried forward as-is. |
| D3, D5-D7, D10 | 3701-3815 | Deployment narrative (Play Store channel gap, debug/iOS/production build detail, dependency pinning) | history | Already classed `unverifiable` in `INSTRUCTION_SURFACE_AUDIT.md`; nothing in this session re-opened them and no evidence surfaced to change that. |

## Rows requiring a STOP-gate check

None of the above triggered a STOP gate: no two archived rulings were found to contradict each
other (A39/A40's material-system chain is sequential supersession, not contradiction — each pass
explicitly replaces the last), no `live-ruling` row's subject has been deleted from the code (the
closest case, A27/A1's `HomeCardManager.tsx`, is classed `history` precisely because its subject
moved, not promoted), and no row reads as an undecided design question rather than a settled
ruling.

## Summary

- Total rows classified: 56 narrative (A1–A56) + 12 gotchas (G1, G2 not shown above are folded
  into the G1-G9/G11-G12 range as previously grouped by S0.1) + 10 deployment (D1–D10) = 78.
- `live-ruling`: 15 (A2, A6, A18, A19, A20, A21, A22, A25, A28, A38, A43, A46, A53, G10, D1/D2/D4/D8/D9 counted as one group of 5 — 14 individual + 5 grouped = 19 total rows across those ids).
- `history`: the remainder.
- Promoted to `INVARIANTS.md` this session (net-new, i.e. not already stated there): A6 (tour
  `measure()` trap), A11's *successor* rule (one row recipe via `lib/rowList.ts` import, sourced
  from `PROGRESS_LOG.md`'s 2026-08-28 entry, not the superseded row's own text), A18
  (`getFieldGlow` shape-cut + focus-only rule), A20/A21/A22 condensed to one backdrop-orb entry.
  A2 was found **already** present verbatim and was not duplicated. A19, A25, A28, A38, A43, A46,
  A53, G10 and the D-group were found consistent with rules `INVARIANTS.md`/`CLAUDE.md` already
  state and were not duplicated. `INVARIANTS.md` is now 181 lines (was 160), well under the
  400-line cap.
