# 18 — The second outside review's bottom-nav proposal, and what actually shipped

**Size:** XS · **Status:** ruled on 2026-08-11 · **Not a task — do not implement**

Same situation as `17-gemini-review-declined-halves.md`, a second time: an outside "Gemini"
review proposed a generic Material Design 3 bottom-nav treatment, given screenshots and no
history. This file exists so the same ground isn't re-covered from scratch next time.

## What was proposed

Remove the Home tab's permanent solid FAB circle (make it a standard tab); outline icon +
muted label when inactive; filled icon + brand-colour icon/label when active; a soft
~15%-opacity pill behind the active icon only (not the label), no border, no shadow.

## What was already true

Checked against `components/BottomNav.tsx` before touching anything: the outline/filled icon
swap, the accent-coloured active icon+label, the muted inactive colour, no background on
inactive tabs, and no border/shadow on the active pill were **all already implemented** —
most of it during the 2026-07-20 through 2026-08-11 passes documented in that file's own
header. The one genuinely open gap was the pill's shape: it wraps the whole icon+label item,
not just the icon.

## What was declined, and why

**Removing Home's solid FAB.** `BottomNav.tsx`'s header documents three same-day passes
building Home's ring/FAB treatment specifically so it reads as a distinct, selected control —
reversing that was never asked for by the maintainer, only by the outside review. Confirmed
directly with the maintainer before doing anything else (AskUserQuestion): keep Home's FAB
exactly as it is.

**Narrowing the pill to hug just the icon.** Also declined — not because it's wrong, but
because the maintainer's actual ask, once clarified, was narrower than the full review: *"I'm
only thinking about the visual for the selected screen... it should also look pressed down."*
The icon-only-pill question never came up again and nothing in the app independently wants
MD3 parity here, so it wasn't built. If it resurfaces, the research already done (see this
file's git history / session record) found no existing "icon-only halo" precedent anywhere in
the app — `IconButton`'s active fill is the closest analogue, and it carries a border+shadow
the spec explicitly didn't want.

## What actually shipped

Not from the Gemini review at all — a direct maintainer follow-up to a *different*, prior fix
in the same session (`components/BottomNav.tsx`'s "sunk side tab now sits in a visible
socket" bullet): the side tabs got a "cap sinks into a base" depth cue when they went from
"pressed" to "pressed *and stays selected*" state; Home didn't get an equivalent, so it read
as inconsistent — "should also look pressed down, which none of them do now."

Home's FAB can't literally sink (`sunk={active}`) the way a side tab does: `HOME_RING`
already spends every px of slack the masked bar has around the 56px button, so any resting
downward offset immediately shrinks the ring itself (see `HOME_RING`'s and the new "Home gets
a recessed cue too" bullet in `BottomNav.tsx`'s header for the arithmetic). Instead, Home got
a second, concentric `HOME_HALO_PAD`-wide ring in the same `darken(accentSoft, 0.22)` colour
family the side tabs' socket plate already uses — a radial version of the same "recessed"
cue instead of a vertical one, with no change to the ring-sizing math at all.
