import {
  minutesToY,
  HOUR_HEIGHT,
  PX_PER_MIN,
  GRID_START_HOUR,
  GRID_TOTAL_HEIGHT,
  layoutGridEntries,
  buildDayScale,
  gapHeightPx,
  GAP_MIN_HEIGHT,
  GAP_MAX_HEIGHT,
  DENSE_PAD_MIN,
} from '@/lib/dayGrid';

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

  it('positions against a custom y mapping when one is given', () => {
    const entries = [{ start: 9 * 60, end: 10 * 60 }];
    const [a] = layoutGridEntries(entries, { ...opts, y: (m) => m });
    expect(a.top).toBe(9 * 60);
    expect(a.height).toBe(60);
  });
});

describe('dayGrid.gapHeightPx', () => {
  it('is bounded by the min/max band heights', () => {
    expect(gapHeightPx(0)).toBe(GAP_MIN_HEIGHT);
    expect(gapHeightPx(24 * 60)).toBe(GAP_MAX_HEIGHT);
  });

  it('grows with the gap length, so a longer hole always reads taller', () => {
    const lengths = [30, 60, 180, 360];
    const heights = lengths.map(gapHeightPx);
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]);
  });
});

describe('dayGrid.buildDayScale', () => {
  const task = (h: number, mins = 60) => ({ start: h * 60, end: h * 60 + mins });

  it('is an empty axis when there is nothing to show', () => {
    const scale = buildDayScale([]);
    expect(scale.totalHeight).toBe(0);
    expect(scale.y(12 * 60)).toBe(0);
    expect(scale.hourMarks).toHaveLength(0);
  });

  it('keeps a task at full hour scale, padded on both sides', () => {
    const scale = buildDayScale([task(9)]);
    expect(scale.startMin).toBe(9 * 60 - DENSE_PAD_MIN);
    expect(scale.endMin).toBe(10 * 60 + DENSE_PAD_MIN);
    expect(scale.y(10 * 60) - scale.y(9 * 60)).toBeCloseTo(HOUR_HEIGHT);
    expect(scale.gaps).toHaveLength(0);
  });

  it('compresses the empty stretch between two distant tasks', () => {
    const scale = buildDayScale([task(8), task(20)]);
    expect(scale.gaps).toHaveLength(1);
    const gap = scale.gaps[0];
    // The real hole is ~10.5h; uncompressed that would be ~550px.
    expect(gap.endMin - gap.startMin).toBeGreaterThan(10 * 60);
    expect(gap.height).toBeLessThanOrEqual(GAP_MAX_HEIGHT);
    // …and the whole day now fits in a fraction of the uniform 24h grid.
    expect(scale.totalHeight).toBeLessThan(GRID_TOTAL_HEIGHT / 3);
  });

  it('stays monotonic across dense and compressed segments', () => {
    const scale = buildDayScale([task(7), task(13), task(21)], { now: 10 * 60 });
    let prev = -1;
    for (let m = 0; m <= 24 * 60; m += 7) {
      const y = scale.y(m);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
    expect(scale.y(24 * 60)).toBeCloseTo(scale.totalHeight);
  });

  it('gives `now` its own full-scale window so the live line is never inside a gap', () => {
    const now = 15 * 60;
    const scale = buildDayScale([task(8)], { now });
    const nowY = scale.y(now);
    const insideAGap = scale.gaps.some((g) => nowY > g.y && nowY < g.y + g.height);
    expect(insideAGap).toBe(false);
  });

  it('snaps `now`, so a 60s tick does not slide every card', () => {
    const entries = [task(8)];
    const a = buildDayScale(entries, { now: 15 * 60 + 1 });
    const b = buildDayScale(entries, { now: 15 * 60 + 29 });
    expect(b.totalHeight).toBe(a.totalHeight);
    expect(b.y(8 * 60)).toBe(a.y(8 * 60));
  });

  it('only marks hours that land inside a dense segment', () => {
    const scale = buildDayScale([task(9)]);
    const hours = scale.hourMarks.map((m) => m.hour);
    expect(hours).toContain(9);
    expect(hours).toContain(10);
    expect(hours).not.toContain(3);
  });
});
