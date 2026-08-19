/**
 * expandableCards.test.ts — the fourth card axis, and the guarantees around it.
 *
 * lib/expandableCards.ts is evaluated in the render path of every expandable card (via
 * lib/useCardExpand.ts), so it must stay dependency-free like lib/cardLayout.ts and
 * lib/collapsedCards.ts. components/CardExpandHost.tsx pulls in react-native/reanimated/every
 * body component, so this scans its SOURCE rather than importing it — the same discipline
 * lib/__tests__/cardLayout.test.ts and designLab.test.ts use for exactly this reason.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { EXPANDABLE_CARD_IDS, isExpandableCardId } from '@/lib/expandableCards';

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

describe('EXPANDABLE_CARD_IDS — the union itself', () => {
  it('has no duplicates', () => {
    expect(new Set(EXPANDABLE_CARD_IDS).size).toBe(EXPANDABLE_CARD_IDS.length);
  });

  it('isExpandableCardId agrees with the list', () => {
    for (const id of EXPANDABLE_CARD_IDS) expect(isExpandableCardId(id)).toBe(true);
    expect(isExpandableCardId('notACard')).toBe(false);
    expect(isExpandableCardId('')).toBe(false);
  });
});

describe('lib/expandableCards.ts stays dependency-free', () => {
  // Mirrors lib/__tests__/cardLayout.test.ts's FORBIDDEN list — this module is read on every
  // card render, so it must not be able to reach a store, the DB, the notification layer or
  // the sync layer.
  const FORBIDDEN = [
    'lib/notifications',
    'expo-notifications',
    'lib/reminders',
    'lib/medicineNotifications',
    'lib/db',
    'lib/liveSync',
    'lib/syncService',
    'store/use',
    'react-native',
  ];

  it('reaches no store, DB, notification, or sync module', () => {
    const source = read('lib/expandableCards.ts');
    const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '');
    for (const forbidden of FORBIDDEN) {
      expect(code).not.toContain(forbidden);
    }
  });
});

describe('components/CardExpandHost.tsx registry — every id has a body and vice versa', () => {
  const source = read('components/CardExpandHost.tsx');
  // Strip comments so prose mentioning an id (e.g. this very sentence, if it were in that
  // file) can't produce a false match.
  const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const registryMatch = code.match(/const CARD_BODIES:[^=]*=\s*\{([\s\S]*?)\n\};/);

  it('the registry block exists and is well-formed', () => {
    expect(registryMatch).not.toBeNull();
  });

  const registryBody = registryMatch?.[1] ?? '';
  const registryKeys = [...registryBody.matchAll(/^\s*([a-zA-Z]+):\s*\{/gm)].map((m) => m[1]);

  it('has exactly one entry per EXPANDABLE_CARD_IDS id, and no others', () => {
    expect(new Set(registryKeys)).toEqual(new Set(EXPANDABLE_CARD_IDS));
    expect(registryKeys).toHaveLength(EXPANDABLE_CARD_IDS.length);
  });

  it.each(EXPANDABLE_CARD_IDS)('%s has a title(t) and a Body', (id) => {
    // Slice from this id's key up to the NEXT top-level key (or the end of the block) —
    // tolerant of the last entry having no trailing comma/newline before `};`.
    const startMatch = registryBody.match(new RegExp(`\\b${id}:\\s*\\{`));
    expect(startMatch).not.toBeNull();
    const start = startMatch!.index! + startMatch![0].length;
    const rest = registryBody.slice(start);
    const nextKey = rest.search(/\n\s*[a-zA-Z]+:\s*\{/);
    const entry = nextKey === -1 ? rest : rest.slice(0, nextKey);
    expect(entry).toMatch(/title:/);
    expect(entry).toMatch(/Body:/);
  });
});

describe('expansion is not persisted', () => {
  // No settings write, no SQLite column, no sync, no AI-setup whitelist entry — see
  // lib/expandableCards.ts's own edit notes for why. Checked the same way — a source scan —
  // rather than by exercising a live store, since there is deliberately no store to exercise.
  it('lib/expandableCards.ts, useCardExpand.ts and CardExpandHost.tsx never call updateSettings', () => {
    for (const file of ['lib/expandableCards.ts', 'lib/useCardExpand.ts', 'components/CardExpandHost.tsx']) {
      const code = read(file).replace(/\/\*\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/updateSettings|useSettingsStore/);
    }
  });

  it('no expandable-card id appears in the SyncTable', () => {
    const sync = read('lib/liveSync.ts');
    for (const id of EXPANDABLE_CARD_IDS) expect(sync).not.toContain(`'${id}'`);
  });

  it('no expandable-card id appears in the AI-setup settings whitelist', () => {
    const whitelist = read('lib/aiSetupApply.ts');
    for (const id of EXPANDABLE_CARD_IDS) expect(whitelist).not.toContain(`'${id}'`);
  });
});

describe('the window-coordinate rect math', () => {
  // The exact bug that shipped in the guided tour (components/TourSpotlight.tsx, fixed
  // 2026-08-14): the target's rect and the overlay's own origin must be measured the SAME way
  // and subtracted, or every hole/growth lands one status bar too high on Android. Pinned here
  // so it cannot come back a second time in this second mechanism.
  it('useCardExpand measures the card with measureInWindow', () => {
    const code = read('lib/useCardExpand.ts');
    expect(code).toContain('measureInWindow');
  });

  it('CardExpandHost measures its own overlay origin with measureInWindow too', () => {
    const code = read('components/CardExpandHost.tsx');
    const occurrences = code.match(/measureInWindow/g) ?? [];
    // At least two call sites: the overlay's own origin, and it must not be the same one as
    // useCardExpand's (which lives in a different file) — so two is the floor, not a coincidence.
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
    expect(code).toContain('overlayRef');
    expect(code).not.toMatch(/overlayRef\.current\?\.\s*measure\s*\(/);
  });

  it('neither file reaches for the plain measure() this trade already rejected', () => {
    for (const file of ['lib/useCardExpand.ts', 'components/CardExpandHost.tsx']) {
      const code = read(file).replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      // A bare `.measure(` (not `.measureInWindow(`) call is the regression this guards.
      expect(code).not.toMatch(/[^\w]measure\s*\(/);
    }
  });
});
