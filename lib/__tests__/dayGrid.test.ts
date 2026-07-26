import { minutesToY, HOUR_HEIGHT, PX_PER_MIN, GRID_START_HOUR, GRID_TOTAL_HEIGHT, layoutGridEntries } from '@/lib/dayGrid';

describe('dayGrid.minutesToY', () => {
  it('maps midnight to y=0', () => {
    expect(minutesToY(GRID_START_HOUR * 60)).toBe(0);
  });

  it('maps each full hour to HOUR_HEIGHT apart', () => {
    expect(minutesToY(60)).toBeCloseTo(HOUR_HEIGHT);
    expect(minutesToY(120)).toBeCloseTo(HOUR_HEIGHT * 2);
  });

  it('maps a half-hour to half of PX_PER_MIN*30', () => {
    expect(minutesToY(90)).toBeCloseTo(HOUR_HEIGHT + 30 * PX_PER_MIN);
  });

  it('maps end-of-day (24:00) to the full grid height', () => {
    expect(minutesToY(24 * 60)).toBeCloseTo(GRID_TOTAL_HEIGHT);
  });
});

describe('dayGrid.layoutGridEntries', () => {
  const opts = { minHeightPx: 40, gapPx: 2 };

  it('gives sequential non-overlapping tasks the full width, one column each', () => {
    const entries = [
      { start: 9 * 60, end: 9 * 60 + 60 },
      { start: 10 * 60, end: 10 * 60 + 60 },
    ];
    const layout = layoutGridEntries(entries, opts);
    expect(layout).toHaveLength(2);
    layout.forEach((l) => {
      expect(l.widthPct).toBe(100);
      expect(l.leftPct).toBe(0);
    });
  });

  it('splits two genuinely overlapping tasks into side-by-side columns', () => {
    const entries = [
      { start: 9 * 60, end: 9 * 60 + 60 },
      { start: 9 * 60 + 30, end: 9 * 60 + 90 },
    ];
    const [a, b] = layoutGridEntries(entries, opts);
    expect(a.widthPct).toBe(50);
    expect(b.widthPct).toBe(50);
    expect(a.leftPct).not.toBe(b.leftPct);
  });

  it('puts three mutually overlapping tasks into three columns', () => {
    const entries = [
      { start: 9 * 60, end: 9 * 60 + 90 },
      { start: 9 * 60 + 10, end: 9 * 60 + 90 },
      { start: 9 * 60 + 20, end: 9 * 60 + 90 },
    ];
    const layout = layoutGridEntries(entries, opts);
    layout.forEach((l) => expect(l.widthPct).toBeCloseTo(100 / 3));
    const lefts = new Set(layout.map((l) => Math.round(l.leftPct)));
    expect(lefts.size).toBe(3);
  });

  it('clamps a short task height so its min-height floor cannot reach the next task', () => {
    // 10-minute task: real height is under minHeightPx, so the floor would normally push
    // its bottom edge to top+40 — but the next task starts only 15px later.
    const entries = [
      { start: 9 * 60, end: 9 * 60 + 10 },
      { start: 9 * 60 + 10, end: 9 * 60 + 40 },
    ];
    const [a, b] = layoutGridEntries(entries, opts);
    expect(a.top + a.height).toBeLessThanOrEqual(b.top - opts.gapPx + 0.01);
  });

  it('does not clamp height when nothing follows', () => {
    const entries = [{ start: 9 * 60, end: 9 * 60 + 10 }];
    const [a] = layoutGridEntries(entries, opts);
    expect(a.height).toBe(opts.minHeightPx);
  });
});
