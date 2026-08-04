# 13 — Energy pips: confirm the design is stale

**Size:** XS · **Expected outcome: a documentation line and no code.**

Read `00-INDEX.md` first if you haven't.

---

## The divergence

`components/feedback/EnergyMeter.jsx` in the design project renders a flash glyph inside
**every** pip, filled and hollow alike:

```jsx
function Pip({ active }) {
  return active
    ? <span style={{ background:'radial-gradient(...)', boxShadow:'inset 0 1px 1px rgba(255,255,255,.5), ...' }}>
        <ion-icon name="flash" style={{ fontSize: PIP_SIZE*0.62, color:'#fff' }} />
      </span>
    : <span style={{ background:'var(--c-surface-inset)', border:'1.5px solid var(--c-border)' }}>
        <ion-icon name="flash-outline" style={{ fontSize: PIP_SIZE*0.62, color:'var(--c-text-muted)' }} />
      </span>;
}
```

`components/EnergyMeter.tsx` in the app says, in its own header edit notes, not to do that:

> Don't re-wrap this in `Surface`/`GlassFill`, and don't reinstate the flash-icon + …

And the reason the component was reworked at all (2026-07-31) is recorded right there:

> …because **it never said what it was**: ten saturated pips and "10 / 10" [read as a score,
> which is] what it must not read as.

The whole redesign — label on line 1, `pips · current / capacity` on line 2, permanent hint
under both — exists to stop Energy reading as a score. Putting a glyph back inside ten
saturated pips walks straight back into that.

There is also a pure-arithmetic reason the app's pip is smaller than the design's: the pip
shrank from 24px to `PIP_SIZE` (18) because at the audited 360px worst case, ten pips + the
value at the `large` font scale + the edit glyph + gaps came to ≈318px of 328px available. The
design's 16px pip is in the same family; its 0.62-of-pip glyph is not the constraint — the row
budget is.

---

## What the design gets *right*, and which the app already has

Worth confirming rather than assuming, since these landed in #479:

- **Surplus pips** — the design's `SurplusPip` is `--c-accent-soft` fill with a
  `--c-accent` outline. The app's are "soft accent-outlined pips — a third object, distinct
  from both the glossy token and the hollow spent ring", capped at `MAX_SURPLUS_PIPS` (4). The
  design caps at 4 too. **Match.**
- **The boost chip** — the design renders `+{dayBoost} today only` on a neutral
  `--c-surface-muted` fill with muted text. The app's rule: it is drawn with
  `components/Badge`, "not accent and not a fourth kind of pip: borrowed energy is a footnote
  about today, not a reward and not a bigger day." **Match** — and both are deliberately
  *neutral*, which is the part that matters.
- **The permanent hint** — the design puts an italic hint under a hairline top border. The app
  has "one small italic line (`t.energyMeter.hint`) under a hairline rule, attached directly
  below the meter", kept through the 2026-07-31 strip pass, and it is "the only thing left
  naming what the pips are". **Match.**
- **Not a card** — the design's docstring: "Not a card: no background, no shadow, no padding —
  it is chrome for the day." The app: "Don't re-wrap this in `Surface`/`GlassFill`." **Match.**

So the two agree on four of five points. The flash glyph is the only real divergence, and it is
the one the app rejected on purpose.

---

## The decision

- **(a)** Confirm the app's version, record it, no code. **← expected**
- **(b)** Bring the flash glyph back

If **(b)**: re-read `components/EnergyMeter.tsx`'s header in full first. It is long because
this component has been redesigned three times in two weeks, and every paragraph in it is a
constraint someone already paid for. Also re-check the 360px arithmetic — a glyph inside each
pip may push the minimum pip size back up, and the pip row's `flex:1 / minWidth:0 /
overflow:'hidden'` clip guard means it will silently *clip* rather than overflow, so the
failure is invisible in a casual screenshot.

---

## What (a) delivers

A line in `DESIGN_RULES_AUDIT.md` recording that the design project's `EnergyMeter.jsx` predates
the 2026-07-31 rework, that its flash-in-every-pip treatment is not to be ported, and that the
surplus pip / neutral boost chip / permanent hint / not-a-card points already match.

Fold it into the same commit as `12-check-position-confirm.md` if you're running them
back to back — one audit entry covering all the stale-design items is tidier than three.

`npx tsc --noEmit` for form. Then commit, PR into `main`, merge.

---

## One thing worth checking while you're here

`components/EnergyMeter.tsx` has a **StarterCard tutorial state** (2026-08-03) that replaces the
meter entirely while nothing carries an energy value and no capacity is set. Its gate is
`!hasEnergyItems && !hasSetCapacity` **and all three source stores `loaded`** — because "an
unloaded store looks exactly like an empty one and the wrong answer flashes teaching copy at a
long-time user."

The design project has no equivalent state, so a session comparing the two could easily read
the tutorial as an unexplained extra and try to remove it. It isn't. Note it in the audit line
so that doesn't happen.
