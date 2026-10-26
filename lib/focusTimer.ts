/**
 * focusTimer.ts — the countdown's whole state machine, pure (2026-10-26).
 *
 * Borrowed from Super Productivity's focus mode (src/app/features/focus-mode/
 * focus-mode-strategies.ts), cut down to its CountdownStrategy: one session, no auto-started
 * next round, no Pomodoro cycle counting. A countdown that runs itself into a second one is
 * a task manager deciding for you; this one stops and says it's done.
 *
 * State is timestamps, never a ticking counter, so a backgrounded app (or a JS thread that
 * slept) reads the right time the moment it looks again — the screen only re-renders.
 *
 * Connections:
 *   Imports → none (pure)
 *   Used by → app/timer.tsx, lib/__tests__/focusTimer.test.ts
 *   Data    → none
 */

/** Offered lengths in minutes. A task's own duration is offered alongside when it has one. */
export const TIMER_PRESETS = [5, 10, 15, 25] as const;

export type TimerState =
  | { phase: 'idle' }
  | { phase: 'running'; endsAt: number; durationMs: number }
  | { phase: 'paused'; remainingMs: number; durationMs: number }
  | { phase: 'done'; durationMs: number };

export const IDLE: TimerState = { phase: 'idle' };

export function start(minutes: number, now: number): TimerState {
  const durationMs = Math.max(1, Math.round(minutes)) * 60_000;
  return { phase: 'running', endsAt: now + durationMs, durationMs };
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.phase !== 'running') return s;
  return { phase: 'paused', remainingMs: Math.max(0, s.endsAt - now), durationMs: s.durationMs };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.phase !== 'paused') return s;
  return { phase: 'running', endsAt: now + s.remainingMs, durationMs: s.durationMs };
}

/** What's left, in ms. A running timer past its end reads 0 (see `settle`). */
export function remainingMs(s: TimerState, now: number): number {
  if (s.phase === 'running') return Math.max(0, s.endsAt - now);
  if (s.phase === 'paused') return s.remainingMs;
  return 0;
}

/** Fraction elapsed, 0…1, for the progress bar. */
export function progress(s: TimerState, now: number): number {
  if (s.phase === 'idle') return 0;
  if (s.phase === 'done') return 1;
  return 1 - remainingMs(s, now) / s.durationMs;
}

/** A running timer whose end has passed becomes `done`; anything else is returned as is. */
export function settle(s: TimerState, now: number): TimerState {
  return s.phase === 'running' && now >= s.endsAt ? { phase: 'done', durationMs: s.durationMs } : s;
}

/** mm:ss, rounding UP so the display reads 0:00 only at the end. */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Preset list for a task: its own duration first when it has one that isn't already offered. */
export function presetsFor(taskMinutes: number | null | undefined): number[] {
  const base: number[] = [...TIMER_PRESETS];
  const own = taskMinutes && taskMinutes > 0 ? Math.round(taskMinutes) : null;
  return own && !base.includes(own) ? [own, ...base] : base;
}
