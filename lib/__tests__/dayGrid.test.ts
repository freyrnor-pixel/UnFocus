import { minutesToY, HOUR_HEIGHT, PX_PER_MIN, GRID_START_HOUR, GRID_TOTAL_HEIGHT } from '@/lib/dayGrid';

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
