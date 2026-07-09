/**
 * severity.ts — shared 1–5 symptom severity color ramp.
 *
 * Decision 024: fixed purple→blue 5-step data-viz ramp, deliberately NOT
 * red/green (no alarm connotation) and theme-independent. Extracted so the
 * ramp + ink pairing can't drift between the health screens that render it.
 *
 * Connections:
 *   Imports → —
 *   Used by → app/(tabs)/health.tsx, app/health-form.tsx, app/health-log.tsx, app/health-detail.tsx
 *   Data    → none
 */
export const SEVERITY_COLORS = ['#C9D4F0', '#A9B8E8', '#8C9AE0', '#7C82D6', '#6E6BC8'];
export const SEV_INK_DARK = '#2A2A3A';
export const SEV_INK_LIGHT = '#FFFFFF';

export function severities() {
  return SEVERITY_COLORS.map((color, i) => ({ value: i + 1, color }));
}

/** Readable ink color for a severity badge/pill filled with its ramp color. */
export function severityInk(value: number): string {
  return value >= 3 ? SEV_INK_LIGHT : SEV_INK_DARK;
}
