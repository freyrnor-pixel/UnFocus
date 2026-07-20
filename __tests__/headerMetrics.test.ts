/**
 * headerMetrics.test.ts — invariants for getHeaderMetrics (constants/theme.ts), the single
 * source of the screen-header band + title geometry.
 *
 * Context (HEADER_CLIP_DEBUG.md): the header-clip bug survived six shipped fixes because
 * the title's line box and the band were sized from mismatched assumptions. These tests pin
 * the contract: everything derives from ONE capped scale, the line box always clears Nunito
 * Bold's descenders (ratio ≥ 1.45 over the fontSize actually applied), and the band always
 * fits the padded row. The consuming Text must apply these values with
 * allowFontScaling={false} — that part is a code-comment contract, not testable headlessly.
 */
import { HEADER_TITLE_BASE_SIZE, HEADER_TITLE_LINE_RATIO, MAX_FONT_SCALE, Spacing, getHeaderMetrics } from '@/constants/theme';

describe('getHeaderMetrics', () => {
  const scales = [0.85, 1.0, 1.15, 1.3, 1.4, 1.5, 2.0];

  test.each(scales)('scale %p: line box clears descenders and band fits the padded row', (raw) => {
    const { fontScale, titleFontSize, titleLineHeight, headerHeight } = getHeaderMetrics(raw);
    // The scale the metrics are built from is capped at the app-wide max.
    expect(fontScale).toBe(Math.min(raw, MAX_FONT_SCALE));
    // fontSize is the base title size scaled once by that capped scale.
    expect(titleFontSize).toBe(Math.round(HEADER_TITLE_BASE_SIZE * fontScale));
    // Line box keeps ≥ the descender-safe ratio over the fontSize it will render with.
    expect(titleLineHeight).toBeGreaterThanOrEqual(titleFontSize * HEADER_TITLE_LINE_RATIO);
    // Band = line box + the header row's vertical padding + slack, so the row can never
    // overflow the Surface mask.
    expect(headerHeight).toBeGreaterThanOrEqual(titleLineHeight + Spacing.sm * 2);
  });

  test('scaling past the cap changes nothing (1.4 vs 2.0)', () => {
    expect(getHeaderMetrics(2.0)).toEqual(getHeaderMetrics(MAX_FONT_SCALE));
  });

  test('metrics grow monotonically with the scale up to the cap', () => {
    const a = getHeaderMetrics(1.0);
    const b = getHeaderMetrics(1.2);
    const c = getHeaderMetrics(1.4);
    expect(b.titleFontSize).toBeGreaterThan(a.titleFontSize);
    expect(c.titleFontSize).toBeGreaterThan(b.titleFontSize);
    expect(b.titleLineHeight).toBeGreaterThan(a.titleLineHeight);
    expect(c.titleLineHeight).toBeGreaterThan(b.titleLineHeight);
    expect(b.headerHeight).toBeGreaterThan(a.headerHeight);
    expect(c.headerHeight).toBeGreaterThan(b.headerHeight);
  });
});
