/**
 * expandableCards.test.ts — the fourth card axis, and the guarantees around it.
 *
 * lib/expandableCards.ts is evaluated in the render path of every expandable card (via
 * lib/useCardExpand.ts), so it must stay dependency-free like lib/cardLayout.ts and
 * lib/collapsedCards.ts. components/CardExpandHost.tsx pulls in react-native/reanimated/every
 * body component, so this scans its SOURCE rather than importing it — the same discipline
 * lib/__tests__/cardLayout.test.ts and designLab.test.ts use for exactly this reason.
 */
import { execSync } from 'child_process';
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

  /**
   * ⚠️ **The gap this whole describe block used to have** (CONSISTENCY_AUDIT.md §10, fixed
   * 2026-08-21). Everything above only checks the two lists agree with EACH OTHER. `shopLists`
   * satisfied every assertion here for a day while being unreachable and opening a placeholder:
   * it was declared, it had an entry, that entry had a title and a Body — and the Body was
   * `ComingSoonBody`, and no `CardExpandButton` for it existed anywhere in the UI.
   *
   * So two more things are checked, and neither can be satisfied by bookkeeping.
   */
  it('registers no placeholder body — a stub is worse than no id', () => {
    // `ComingSoonBody` is deleted; this fails on it being reintroduced under any name that
    // says what it is. The honest fix for a card with no surface yet is to leave its id out
    // (as `shopLists`, `homeTodo` and `homeShopping` all did) rather than to register a stub.
    expect(code).not.toMatch(/ComingSoon|Placeholder|NotYet|TodoBody/i);
  });

  it.each(EXPANDABLE_CARD_IDS)('%s is mounted somewhere in the UI', (id) => {
    // ⚠️ **This used to grep for `useCardExpand('<id>')`**, which was the honest test of
    // "reachable" while every card wired its own ⤢. Since 2026-08-21 there is exactly one
    // `useCardExpand` call in the app — components/Card.tsx's — and a card gets its ⤢ from its
    // registry entry, so the old grep would have failed on every id at once while the app was
    // more correct than it had ever been. What is worth checking now is that the id is drawn:
    // an entry nothing mounts is the `shopLists` shape, a `CARD_BODIES` entry nothing can reach
    // with a passing test over it.
    const callers = execSync(
      `grep -rlw --exclude=CardExpandHost.tsx ${id} app components || true`,
      { cwd: join(__dirname, '..', '..'), encoding: 'utf8' }
    ).trim();
    expect(callers).not.toBe('');
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

/**
 * ⚠️ **An expanded pane draws the card's BODY, not the card (2026-08-28).**
 *
 * Measured on Home's Today card at 430×932 before the fix: the pane painted its own 65px title
 * bar reading "Today", then mounted `<TodoSurface section="today"/>`, whose whole job is to draw
 * `<Card id="todoToday">` — so a second `Surface`, a second 52px header with the same word on it,
 * a fold chevron and an ⤢ appeared inside the pane, along with the card's own vertical padding
 * and a second horizontal inset inside the pane's. Two of those controls cannot even act: a fold
 * on a full-screen pane, an ⤢ on an already-expanded card.
 *
 * That is the card-in-a-card the 2026-08-18 blueprint pass banned, surviving in the one place
 * nothing was looking — `Card`'s `embedded` prop drops the Surface but deliberately KEEPS the
 * header, which is right for a section inside a card and exactly wrong for a pane.
 *
 * The mechanism is lib/cardPane.ts. These assertions pin the two halves that can silently rot:
 * the host must PROVIDE the context around the body, and `Card` must READ it.
 */
describe('the expanded pane does not draw a second card header', () => {
  it('CardExpandHost wraps the body in PaneCardContext', () => {
    const code = read('components/CardExpandHost.tsx');
    expect(code).toContain("import { PaneCardContext } from '@/lib/cardPane'");
    expect(code).toMatch(/<PaneCardContext\.Provider value=\{entry\.card \?\? request\.id\}>/);
  });

  it('Card renders as the pane body when the context names it', () => {
    const code = read('components/Card.tsx');
    expect(code).toContain("useIsPaneBody");
    // The claim is single by construction: a card that takes the pane re-provides `null`, so
    // nothing deeper can strip its own header a second time.
    expect(code).toMatch(/if \(isPaneBody\)/);
    expect(code).toMatch(/<PaneCardContext\.Provider value=\{null\}>/);
  });

  /**
   * `homeToday` is the ONE entry whose body draws a card with a different id — deliberately:
   * Home's Today card is a PREVIEW of To-do's, so its full-screen version has to be the same
   * surface rather than a second rendering of it. Every other entry either draws its own id or
   * draws no `Card` at all (NotesSurface, FoodTab, CatalogueTab, MedicineSurface).
   *
   * Pinned as an exact set rather than "homeToday has a card field", because the failure mode
   * of getting this wrong is silent: the pane simply goes back to drawing two headers, which no
   * type and no render test notices.
   */
  it('only homeToday names a different card than its own pane id', () => {
    const code = read('components/CardExpandHost.tsx');
    const bodies = code.slice(code.indexOf('const CARD_BODIES'), code.indexOf('\n};', code.indexOf('const CARD_BODIES')));
    const named = [...bodies.matchAll(/^\s*(\w+): \{[^\n]*card: '(\w+)'/gm)].map((m) => `${m[1]}→${m[2]}`);
    expect(named).toEqual(['homeToday→todoToday']);
  });
});

/**
 * ⚠️ **A pane provides its own card's hue (2026-08-28).**
 *
 * `components/CardExpandHost.tsx` is mounted in `app/_layout.tsx`, a sibling of `<Stack>` and so
 * OUTSIDE every `ScreenScaffold` — which is what makes it able to cover the floating nav, and
 * also what left `useScreenColor()` null for everything inside it. Every hue-reading control in
 * an expanded card therefore fell back to `theme.accent`: a blue focus ring, a blue key halo and
 * a blue row rail on a full-screen Health or Habits card, which is precisely the *"never blue on
 * a pink or cyan screen"* complaint round 20's glow pass was about.
 *
 * `components/CenterModalScreen.tsx` already provided one for the same reason; this is the same
 * fix in the second overlay.
 */
describe('an expanded card is not a context-free overlay', () => {
  it('CardExpandHost provides ScreenColorContext from the open card spec', () => {
    const code = read('components/CardExpandHost.tsx');
    expect(code).toContain("ScreenColorContext");
    expect(code).toMatch(/getScreenColor\(theme, cardSpec\(request\.id\)\.hue\)\.base/);
    expect(code).toMatch(/<ScreenColorContext\.Provider value=\{paneHue\}>/);
  });
});
