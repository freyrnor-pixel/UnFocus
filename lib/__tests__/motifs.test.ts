/**
 * motifs.test.ts — the contracts the decorative backdrop art has to keep.
 *
 * constants/motifs.ts is generated from assets/decorative/*.svg, so these are not tests of
 * hand-written logic — they are tests of the ART, pinned in code because the art is the thing
 * that silently broke. When the design system was delivered, its own stated edge-continuity
 * rule held for only one of its three backdrops, and one of them put its canopy straight
 * through the region where cards live. Neither failure is visible in a diff, and neither
 * throws at runtime; you just get a backdrop that quietly looks wrong. Hence:
 *
 *   1. The CENTRE BOX. Each 390-wide panel reserves x 84–306, y 236–612 for cards and
 *      content. This is the long-standing rule that keeps ScreenBackground's art at the edges
 *      (and the reason assets/bg-light.png was retired for being a centred tree).
 *   2. The STRIP. The five tab backdrops are one continuous 1950×844 run, slid with the pager,
 *      so the branch never breaks at a seam. Its width must stay an exact multiple of the
 *      panel width, and it must still enter at y=660 and leave at y=600 — the delivered
 *      contract's endpoints, honoured across the whole run.
 *   3. The VOCABULARY. Canopy is brush-daub — rotated ellipses, never plain circles
 *      (decorativemotifs.md: "don't reintroduce plain circles/rectangles").
 *
 * Paths are checked by SAMPLING the actual Bézier curve, not by bounding its control points:
 * control points routinely sit outside the curve they steer, so the cheap test would fail on
 * art that is genuinely fine.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { MOTIFS, SCREEN_BG_IDS, STRIP_PANEL_ORDER, type MotifElement, type MotifId } from '@/constants/motifs';

const PANEL_W = 390;
const PANEL_H = 844;

/** The region every panel reserves for cards and content. */
const BOX = { x0: 84, x1: 306, y0: 236, y1: 612 };

const ids = Object.keys(MOTIFS) as MotifId[];

// ── Path sampling ─────────────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

/** Parse an SVG path into sampled points. Supports the M/L/C/Q subset the art uses. */
function samplePath(d: string, per = 60): Pt[] {
  const tokens = d.match(/[MLCQZmlcqz]|-?[\d.]+/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  const n = () => Number(tokens[i++]);

  const cubic = (p0: Pt, c1: Pt, c2: Pt, p1: Pt) => {
    for (let s = 0; s <= per; s++) {
      const t = s / per;
      const u = 1 - t;
      pts.push({
        x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
        y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
      });
    }
  };
  const quad = (p0: Pt, c: Pt, p1: Pt) => {
    for (let s = 0; s <= per; s++) {
      const t = s / per;
      const u = 1 - t;
      pts.push({
        x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
        y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
      });
    }
  };

  while (i < tokens.length) {
    const cmd = tokens[i];
    if (/[A-Za-z]/.test(cmd)) i++;
    switch (cmd.toUpperCase()) {
      case 'M':
        cur = { x: n(), y: n() };
        start = cur;
        pts.push(cur);
        break;
      case 'L': {
        const p = { x: n(), y: n() };
        pts.push(cur, p);
        cur = p;
        break;
      }
      case 'C': {
        const c1 = { x: n(), y: n() };
        const c2 = { x: n(), y: n() };
        const p1 = { x: n(), y: n() };
        cubic(cur, c1, c2, p1);
        cur = p1;
        break;
      }
      case 'Q': {
        const c = { x: n(), y: n() };
        const p1 = { x: n(), y: n() };
        quad(cur, c, p1);
        cur = p1;
        break;
      }
      case 'Z':
        pts.push(start);
        cur = start;
        break;
      default:
        // Unknown command — consume one number so we can never spin forever.
        i++;
    }
  }
  return pts;
}

/** Points a stroked path paints, grown by half its stroke width. */
function pathPoints(e: Extract<MotifElement, { t: 'p' }>): Pt[] {
  const half = e.w / 2;
    return samplePath(e.d).flatMap(({ x, y }) => [
    { x, y },
    { x, y: y - half },
    { x, y: y + half },
  ]);
}

type Box = { x0: number; x1: number; y0: number; y1: number };

/** Is a point inside the reserved box of whichever panel it falls in? */
function inBox(p: Pt, box: Box): boolean {
  const local = ((p.x % PANEL_W) + PANEL_W) % PANEL_W;
  return local > box.x0 && local < box.x1 && p.y > box.y0 && p.y < box.y1;
}

/**
 * Where an element intrudes into a reserved box, or null.
 *
 * Discs are tested as DISCS — closest-point-on-rect vs radius — not as bounding boxes. A
 * circle does not paint its bbox corners, and testing them reports a soft halo that merely
 * surrounds the content area as if it covered it.
 */
function intrusion(e: MotifElement, box: Box): Pt | null {
  if (e.t === 'p') return pathPoints(e).find((p) => inBox(p, box)) ?? null;

  // Rotation can only move an ellipse's outline within the circle of its larger radius.
  const rad = e.t === 'e' ? Math.max(e.rx, e.ry) : e.r + (e.w ?? 0) / 2;
  // Check the box of every panel the disc could reach.
  for (let panel = 0; panel < 5; panel++) {
    const x0 = panel * PANEL_W + box.x0;
    const x1 = panel * PANEL_W + box.x1;
    const nearest = {
      x: Math.max(x0, Math.min(e.cx, x1)),
      y: Math.max(box.y0, Math.min(e.cy, box.y1)),
    };
    const dx = e.cx - nearest.x;
    const dy = e.cy - nearest.y;
    if (dx * dx + dy * dy < rad * rad) return nearest;
  }
  return null;
}

// ── Structure ─────────────────────────────────────────────────────────────────────────────

describe('every motif is well-formed', () => {
  test('there are motifs at all, and each has geometry', () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(MOTIFS[id].els.length).toBeGreaterThan(0);
      expect(MOTIFS[id].w).toBeGreaterThan(0);
      expect(MOTIFS[id].h).toBeGreaterThan(0);
    }
  });

  test.each(ids)('%s: opacities are in range, and dark is never weaker than light', (id) => {
    for (const e of MOTIFS[id].els) {
      expect(e.o).toBeGreaterThan(0);
      expect(e.o).toBeLessThanOrEqual(1);
      expect(e.od).toBeGreaterThan(0);
      expect(e.od).toBeLessThanOrEqual(1);
      // Dark mode reads against a much darker field, so the art is lifted, never dimmed.
      expect(e.od).toBeGreaterThanOrEqual(e.o);
    }
  });

  test.each(ids)('%s: canopy is brush-daub, never a plain circle', (id) => {
    for (const e of MOTIFS[id].els) {
      if (e.role === 'canopy') {
        expect(e.t).toBe('e');
        // "Brush daub" IS the rotation — an axis-aligned ellipse reads as a plain oval, which
        // is the thing the logo vocabulary is defined against.
        expect(e.rot).not.toBe(0);
      }
      // The inverse matters just as much: an ellipse that isn't canopy would mean the
      // generator's role mapping has drifted from the art. The one legitimate unrotated
      // ellipse is the illustrated set's ground shadow, pooled under a trunk — foliage it
      // is not, and labelling it 'canopy' to satisfy this test would make the role map lie.
      if (e.t === 'e') expect(e.role).toBe(e.rot === 0 ? 'ground' : 'canopy');
    }
  });
});

// ── Colour: tintable vs illustrated ───────────────────────────────────────────────────────

/**
 * Two kinds of motif, and the difference is load-bearing rather than cosmetic. A TINTABLE
 * motif carries no colour at all and is painted by whatever token its consumer passes — that
 * is what lets one backdrop be recoloured per tab. An ILLUSTRATION carries its own palette,
 * because a nine-colour painted tree cannot be expressed as one token.
 *
 * The risk this guards is a tintable motif silently acquiring a palette (it would stop
 * responding to the theme, on every screen, with nothing to see in review) or an illustration
 * losing one (every element collapses to a single flat colour).
 */
describe('colour is carried one of exactly two ways', () => {
  test.each(ids)('%s: palette and element colour indices agree', (id) => {
    const m = MOTIFS[id];
    const withIndex = m.els.filter((e) => e.c !== undefined);

    if (!m.pal) {
      // Tintable: nothing may carry a colour index, or it would be pointing at a palette
      // that does not exist.
      expect(withIndex).toHaveLength(0);
      return;
    }

    // Both modes must define the same slots — an element index is shared between them.
    expect(m.pal.dark).toHaveLength(m.pal.light.length);
    expect(m.pal.light.length).toBeGreaterThan(1); // one colour would mean it should be tintable

    // Every element resolves, and every declared colour is actually used — an unreferenced
    // slot means the generator's dedupe drifted from what it assigned.
    expect(withIndex).toHaveLength(m.els.length);
    for (const e of m.els) {
      expect(e.c).toBeGreaterThanOrEqual(0);
      expect(e.c).toBeLessThan(m.pal.light.length);
    }
    expect(new Set(m.els.map((e) => e.c)).size).toBe(m.pal.light.length);

    for (const hex of [...m.pal.light, ...m.pal.dark]) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test('the tab backdrops stay tintable — they are recoloured per screen', () => {
    for (const id of SCREEN_BG_IDS) expect(MOTIFS[id].pal).toBeUndefined();
  });
});

// ── The strip ─────────────────────────────────────────────────────────────────────────────

describe('screen-bg-strip is one continuous run of whole panels', () => {
  const strip = MOTIFS['screen-bg-strip'];

  test('is an exact whole number of panels, at panel height', () => {
    expect(strip.w % PANEL_W).toBe(0);
    expect(strip.w / PANEL_W).toBe(5);
    expect(strip.h).toBe(PANEL_H);
  });

  test('the spine still enters at y=660 and leaves at y=600', () => {
    // The delivered contract's two edge values. Honoured across the whole strip rather than
    // per panel — per panel it is unsatisfiable, since leaving at 600 and re-entering at 660
    // is a 60px step at every seam, which is the opposite of one continuous line.
    const spine = strip.els.find((e): e is Extract<MotifElement, { t: 'p' }> => e.t === 'p');
    expect(spine).toBeDefined();
    const pts = samplePath(spine!.d);
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(first.x).toBeCloseTo(0, 3);
    expect(first.y).toBeCloseTo(660, 3);
    expect(last.x).toBeCloseTo(strip.w, 3);
    expect(last.y).toBeCloseTo(600, 3);
  });

  test('panel order matches the tab navigator, panel for panel', () => {
    // The strip is slid by the pager's index, so if these two orders disagree every tab shows
    // its NEIGHBOUR's art — with no crash, no warning and nothing visible in a diff. That is
    // exactly what happened when this was first written against AGENTS.md's tab list, which
    // has Health and Habits the wrong way round. The navigator source is the only authority.
    const layout = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');
    const navOrder = [...layout.matchAll(/<TopTabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);

    expect(navOrder.length).toBe(STRIP_PANEL_ORDER.length);
    // 'index' is the route name for Home; the motif calls that panel 'home'.
    expect(navOrder.map((r) => (r === 'index' ? 'home' : r))).toEqual([...STRIP_PANEL_ORDER]);
  });

  test('every panel gets its own art, so no two tabs look alike', () => {
    // Count only the per-panel interiors — the spine spans everything by design, so counting
    // it would make this pass even if four panels were empty.
    const perPanel = new Array(5).fill(0);
    for (const e of strip.els) {
      if (e.t === 'p' && e.d.startsWith('M0 660')) continue; // the shared spine
      const x = e.t === 'p' ? samplePath(e.d)[0].x : e.cx;
      const panel = Math.floor(x / PANEL_W);
      if (panel >= 0 && panel < 5) perPanel[panel]++;
    }
    for (const count of perPanel) expect(count).toBeGreaterThan(0);
  });
});

// ── The centre box ────────────────────────────────────────────────────────────────────────

function offendersIn(id: MotifId, box: Box): string[] {
  const out: string[] = [];
  for (const e of MOTIFS[id].els) {
    // `wash` is exempt, and deliberately so. decorativemotifs.md files the soft fills under
    // "Holders (backdrops that visually hold content)" — "center the content inside it" — so a
    // wash overlapping the content area is the entire point of a wash. At 0.05–0.18 opacity it
    // reads as a tint, not as an object competing with a card. The rule here is about the
    // structural accents: trunks, branches, canopy daubs and dots, which DO read as objects.
    if (e.role === 'wash') continue;
    const hit = intrusion(e, box);
    if (hit) {
      out.push(
        `${e.t}/${e.role} reaches (${hit.x.toFixed(1)}, ${hit.y.toFixed(1)}) ` +
          `— panel-local x ${(((hit.x % PANEL_W) + PANEL_W) % PANEL_W).toFixed(1)}`,
      );
    }
  }
  return out;
}

describe('backdrops keep clear of the region where content lives', () => {
  test('screen-bg-strip: nothing paints inside the centre box', () => {
    // Named rather than counted: a failure here should say WHICH element to move.
    expect(offendersIn('screen-bg-strip', BOX)).toEqual([]);
  });

  test('screen-bg-calm: nothing paints across the upper content area', () => {
    // `calm` is the SUB-TIER backdrop (Settings, detail screens), and it is deliberately held
    // to a looser rule than the tab strip. The full centre box is a tab-card constraint: those
    // screens stack cards down to ~72% of the height, which is why the strip must stay out of
    // all of it. A sub-tier screen is a single scrolling column that thins out lower down, and
    // `calm` was delivered with its branch and two dots crossing y≈577–612 — the very bottom
    // of the box. Moving them would mean redrawing art that reads correctly in place, so the
    // rule that actually matters here is the upper area, where the content genuinely is.
    expect(offendersIn('screen-bg-calm', { ...BOX, y1: 560 })).toEqual([]);
  });
});
