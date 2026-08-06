/**
 * scaleStyles.test.ts — the render-time style rewrite that carries BOTH the user's text-size
 * setting and the design lab's geometry.
 *
 * This function runs on every render of 63 of the app's ~140 components, so the property that
 * matters most is the boring one: at defaults it must return the SAME object it was given.
 * A fresh object here would invalidate every downstream memo on every tick for every user,
 * including the overwhelming majority who will never open the design lab.
 *
 * The rest is about not damaging styles it doesn't understand — a percentage padding, an
 * 'auto' margin, a style with no geometry in it at all.
 */
import { scaleStyles } from '@/lib/useAppTheme';
import { DEFAULT_SHAPE, type ShapeOverrides } from '@/lib/designLab';

const base = {
  card: { padding: 16, borderRadius: 12, borderWidth: 1.5, gap: 8 },
  title: { fontSize: 16, lineHeight: 20 },
  both: { fontSize: 14, marginTop: 4, borderTopLeftRadius: 6 },
  plain: { flexDirection: 'row' as const, alignItems: 'center' as const },
};

const shaped = (patch: Partial<ShapeOverrides>): ShapeOverrides => ({ ...DEFAULT_SHAPE, ...patch });

describe('the inert path', () => {
  it('returns the identical object when neither the size setting nor the lab has changed', () => {
    expect(scaleStyles(base, 'default')).toBe(base);
    expect(scaleStyles(base, 'default', DEFAULT_SHAPE)).toBe(base);
  });

  it('leaves a style with no font and no geometry untouched, by reference', () => {
    const out = scaleStyles(base, 'default', shaped({ radiusScale: 2 }));
    expect(out.plain).toBe(base.plain);
  });
});

describe('geometry', () => {
  it('scales radius, spacing and border widths independently', () => {
    const out = scaleStyles(base, 'default', shaped({ radiusScale: 2, spacingScale: 0.5, borderScale: 4 }));
    expect(out.card.borderRadius).toBe(24);
    expect(out.card.padding).toBe(8);
    expect(out.card.gap).toBe(4);
    expect(out.card.borderWidth).toBe(6);
  });

  it('treats borderRadius and borderWidth as different knobs despite the shared prefix', () => {
    const out = scaleStyles(base, 'default', shaped({ radiusScale: 2 }));
    expect(out.card.borderRadius).toBe(24);
    expect(out.card.borderWidth).toBe(1.5);
  });

  it('reaches per-corner radii and directional margins', () => {
    const out = scaleStyles(base, 'default', shaped({ radiusScale: 3, spacingScale: 2 }));
    expect(out.both.borderTopLeftRadius).toBe(18);
    expect(out.both.marginTop).toBe(8);
  });

  it('leaves non-numeric values exactly as written', () => {
    // Multiplying '5%' would either drop the unit or silently change what the value means.
    const withUnits = { a: { padding: '5%', marginLeft: 'auto', borderRadius: 10 } };
    const out = scaleStyles(withUnits as never, 'default', shaped({ radiusScale: 2, spacingScale: 2 }));
    expect((out as never as typeof withUnits).a.padding).toBe('5%');
    expect((out as never as typeof withUnits).a.marginLeft).toBe('auto');
    expect((out as never as typeof withUnits).a.borderRadius).toBe(20);
  });
});

describe('text', () => {
  it("scales fontSize and lineHeight in lockstep with the user's setting", () => {
    // Both move by the same factor — to within `getFontSize`'s own rounding, which lands 16pt
    // on 19 rather than 19.2 and so can't hit the ratio exactly. The property that matters is
    // that neither is left behind: a grown glyph in an unmoved line box clips its descenders
    // (the "Hjem"→"Hiem" bug this lockstep exists to prevent).
    const out = scaleStyles(base, 'large');
    expect(out.title.fontSize).toBeGreaterThan(base.title.fontSize);
    expect(out.title.lineHeight).toBeGreaterThan(base.title.lineHeight);
    expect(out.title.fontSize / base.title.fontSize).toBeCloseTo(
      out.title.lineHeight / base.title.lineHeight,
      1,
    );
  });

  it("multiplies the lab's fontScale ON TOP of the user's setting, not instead of it", () => {
    const userOnly = scaleStyles(base, 'large').title.fontSize;
    const withLab = scaleStyles(base, 'large', shaped({ fontScale: 2 })).title.fontSize;
    expect(withLab).toBeCloseTo(userOnly * 2);
  });

  it('applies the lab fontScale even when the size setting is default', () => {
    expect(scaleStyles(base, 'default', shaped({ fontScale: 0.5 })).title.fontSize).toBe(8);
  });

  it('scales font and geometry together in one style', () => {
    const out = scaleStyles(base, 'default', shaped({ fontScale: 2, spacingScale: 3 }));
    expect(out.both.fontSize).toBe(28);
    expect(out.both.marginTop).toBe(12);
  });
});
