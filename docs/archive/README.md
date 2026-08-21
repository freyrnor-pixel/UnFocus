# Archived docs — history, not current state

**Nothing in this directory is binding.** These files record how something was built or what was
proposed at the time; where they disagree with the current code, the code is right. Several say
so about themselves.

Moved here on **2026-08-21** by the consistency audit (`../../CONSISTENCY_AUDIT.md`). The repo
root held **41 markdown files**, and that was one of the three causes the audit identified for
sixteen visual defects recurring after passes that had already fixed them: rules were spread
widely enough that each session read a different subset and re-derived its own answer.
`DESIGN_RULES.md` said as much in its own header — *"Several of the older `*_LIBRARY.md` files
have drifted the same way… trust `constants/` over any prose, including this file."*

**Nothing was deleted.** Every file is here, and references to them elsewhere in the repo were
rewritten to `docs/archive/<name>` in the same change, so a grep still lands.

## What is still live

For a UI change, two files and the tokens they point at:

| Live | What it covers |
|---|---|
| `../../DESIGN_RULES.md` | The 33 rules. **§8 (Component identity) is the newest and the one to read first** — §1–7 govern values, §8 governs which component owns a thing. |
| `../../AGENTS.md` | Architecture, cookbook tasks, gotchas, build/deploy. |
| `constants/theme.ts`, `constants/colors.ts`, `constants/motion.ts` | The source of truth for every number. A doc that restates one is wrong the moment the token moves. |

Also still at root and still live: `ANIMATION_GUIDELINES.md` (timings, easing, haptics),
`TESTING.md` (test strategy and the CI gate), `VOICE.md` (copy voice), `PUBLISHING.md` /
`OTA_BUILD_WORKFLOW.md` (releases), `EPISODES.md`, `PRIVACY.md`, `HEADER_CLIP_DEBUG.md` (its Yoga
reproduction method is cited by AGENTS.md as the only thing in the repo that can see that class
of bug), and the `*_AUDIT.md` / `REBUILD_*` / `PROGRESS_LOG.md` records.

## What is here, and what replaced it

### Design-system libraries — superseded by the tokens themselves
`DESIGN_SYSTEM_LIBRARY_INDEX.md` · `BUTTON_LIBRARY.md` · `COLOR_THEME_LIBRARY.md` ·
`FORM_PATTERNS_LIBRARY.md` · `ICON_LIBRARY.md` · `SPACING_LAYOUT_LIBRARY.md` ·
`TYPOGRAPHY_LIBRARY.md`

Prose copies of values that live in `constants/`. This is the drift `DESIGN_RULES.md` warns
about by name, and `SPACING_LAYOUT_LIBRARY.md` is the worked example: it documented an 18px card
padding the code never had.

### Handoffs — work that has since shipped
`HANDOFF_EXPLAINER_PLACEMENT.md` · `HANDOFF_SPACING_PASS.md` · `HANDOFF_UI_REDESIGN.md` ·
`HANDOFF_UI_REFINEMENTS.md` · `INTERACTION_HANDOFF.md` · `FLIGHT_ANIMATION_HANDOFF.md` ·
`BUTTON_PRESS_ANIMATIONS_HANDOFF.md` · `BUTTON_PRESS_ANIMATIONS_CHECKLIST.md` ·
`WIDGET_BUILD_HANDOFF.md`

Briefs for passes that are done. The outcomes are in `AGENTS.md` and in the affected files' own
headers, which is where they stay current.

### Spikes — investigations with a settled answer
`EMULATOR_TESTING_SPIKE.md` · `EMULATOR_TESTING_HANDOFF.md`

The plan for headless testing. The outcome is `npm run preview` and AGENTS.md's "Web preview for
agent testing" section, including the limits that were measured rather than assumed.

### Point-in-time audits
`USABILITY_ANALYSIS.md` · `USABILITY_FIX_PLAN.md` · `SCREEN_FUNCTIONS_AUDIT.md` ·
`STALE_CODE_AUDIT.md`

Snapshots of the app as it was. Useful for "why is this like this", misleading for "what is it
now".

### Proposals that were not adopted
`MD3_FUTURE_PLAN.md`

Material Design 3 as a look. The one thing taken from MD3 is the 48px touch target
(`MIN_TAP_TARGET`); its visual language was deliberately declined, because it fights decisions
made on purpose here. `DESIGN_RULES.md` rule 17 says so.

## Adding to this directory

Move a file here when it describes a finished pass or a value that now lives in code — and say in
this index what replaced it. A file whose guidance is still followed belongs at root instead.

**Better still: write the guard, not the doc.** The audit's other two causes were that guards
used hand-maintained file lists and that the rulebook had nothing to say about component
identity. A rule with a CI scan behind it does not need a document to be remembered.
