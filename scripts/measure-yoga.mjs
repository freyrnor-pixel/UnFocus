#!/usr/bin/env node
/**
 * measure-yoga.mjs — the app's layout audit run in the REAL layout engine.
 *
 * WHY THIS EXISTS. Every other harness in this repo renders react-native-web in Chromium, so
 * every one of them measures **browser flexbox**. The app ships **Yoga**. The two agree most of
 * the time, and the whole point of this file is the times they do not — because a bug that
 * survives to a device report is, by selection, one the browser could not reproduce. The repo
 * has paid for that three times over and written it down each time:
 *
 *   · `HARNESS.md:272`  — "A browser has no pixel grid to round on, so this harness cannot
 *     generate the input the bug needs. Its clean runs were honest and the app was still moving."
 *   · `HEADER_CLIP_DEBUG.md` — seven font fixes against a LAYOUT bug. What found it was a
 *     throwaway real-Yoga simulation: `flex:1` on a Text inside a column wrapper computes a
 *     **0dp** frame and the measure function is **never called**, while "browser flexbox
 *     resolves flex-basis:0 children of auto-height containers from their content contribution —
 *     web could never reproduce this **by construction**". That script was never committed.
 *   · `components/EnergyMeter.tsx:869-892` — `flexBasis:'100%'` on a grid cell dropped into a
 *     COLUMN becomes a percentage of the parent's HEIGHT. "react-native-web resolves that to
 *     content and draws it correctly, which is why every harness here has always shown this card
 *     intact." The device showed the label sliced by the card's own bottom edge.
 *
 * This file is that simulation, kept. It needs no browser, no server and no baseline: it is the
 * same Yoga (`yoga-layout`, the engine compiled to WASM) fed the same styles, so it is fast
 * enough to run on every push.
 *
 * Usage:
 *   npm run yoga            — run every check
 *   npm run yoga -- --json  — machine-readable findings
 *
 * Exits 1 on any finding, and ALSO exits 1 if its own self-probe fails to detect a deliberately
 * planted defect (see `selfProbe`). A harness nobody probed is a harness nobody should believe;
 * `jitter` earned its trust that way (`HARNESS.md:252`) and this one does the same.
 *
 * The three checks, in the order they run:
 *   0  self-probe        — plant fix #8's defect, confirm this file SEES it
 *   1  zero-height       — a modelled subtree computing a 0dp node (the fix #8 class)
 *   2  pixel-grid        — content whose HEIGHT changes when only its POSITION does
 *
 * ⚠️ **What it cannot do.** It lays out a MODEL of a subtree, transcribed by hand from the
 * component and cited `file:line` in `yoga-subtrees.mjs`. A model can go stale — if you change one of
 * the cited styles, change the model in the same edit, exactly as the file-header
 * `Connections:` blocks work. It is deliberately a small set of high-risk subtrees rather than
 * the whole app: the value is in the ENGINE, not in the coverage, and a broad transcription
 * would rot faster than it caught anything. Widening coverage means adding a subtree that has
 * earned it — one a device report actually named.
 */
import { loadYoga, SUBTREES } from './yoga-subtrees.mjs';

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');

/** Android densities that ship in volume — the same list as `lib/__tests__/layoutGrid.test.ts`. */
const DENSITIES = [1, 1.5, 2, 2.625, 2.75, 3, 3.5];

/**
 * Sub-dp offsets to slide a subtree by.
 *
 * ⚠️ These must NOT be whole physical pixels at any density in the list, which is the trap the
 * jest sweep documents: a sweep of integer offsets passes at 1, 2 and 3 by measuring nothing.
 * The fractional densities (2.625, 2.75) are where the noise lives.
 */
const OFFSETS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.9];

const findings = [];
function finding(check, where, detail) {
  findings.push({ check, where, detail });
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Check 0 — the self-probe
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Re-plants `HEADER_CLIP_DEBUG.md` fix #8's defect and asserts this file reports it.
 *
 * The numbers below are not invented for this test — they are the table in that document,
 * measured on the real tree in 2026-07-16:
 *
 *            | Text frame | row  | measureFunc called?
 *   flex:1   |   **0dp**  | 40dp |  **NO — never**
 *   without  |    41dp    | 57dp |  yes
 *
 * If the "with" case ever stops computing 0dp here, this harness has lost the ability to see the
 * class it was built for and must not be trusted to say "clean". That is a harness failure, not
 * an app failure, and it is reported as such.
 */
async function selfProbe(Y) {
  const withDefect = SUBTREES.headerBlock.build(Y, { density: 2.75, plantFix8Defect: true });
  const without = SUBTREES.headerBlock.build(Y, { density: 2.75, plantFix8Defect: false });

  const defectSeen = withDefect.nodes.some((n) => n.height === 0) && withDefect.measureCalls === 0;
  const healthy = without.nodes.every((n) => n.height > 0) && without.measureCalls > 0;

  if (!defectSeen) {
    finding(
      'self-probe',
      'scripts/measure-yoga.mjs',
      'HARNESS BLIND: fix #8\'s defect (flex:1 on a Text inside a column wrapper) was planted and ' +
        'this file did NOT compute a 0dp frame. Either yoga-layout changed its resolution of ' +
        'flex-basis:0 under a definite-height ancestor, or the modelled subtree no longer has one. ' +
        'Until this probe detects again, a clean run from this harness means nothing.',
    );
  }
  if (!healthy) {
    finding(
      'self-probe',
      'scripts/measure-yoga.mjs',
      'HARNESS BROKEN: the CONTROL case (no defect) did not lay out either, so the model is wrong ' +
        'rather than the app. A probe that fails both ways detects nothing.',
    );
  }

  // ── Check 2's own sensitivity ───────────────────────────────────────────────────────────────
  // A "clean" pixel-grid run is only worth something if the check can fail at the scale that
  // matters. So re-run one subtree against the slack `lib/layoutGrid.ts` carried until
  // 2026-09-14 — an absolute 1e-6, derived in float64 while Yoga stores float32 — and require it
  // to flag. That is the exact regression this harness was built to catch; if it stops flagging,
  // check 2 has gone decorative and a clean run means nothing.
  const gridSensitive = (() => {
    const density = 2.625;
    const byNode = new Map();
    for (const offset of OFFSETS) {
      for (const node of SUBTREES.energyBudgetCard.build(Y, { density, offset }).nodes) {
        if (!byNode.has(node.name)) byNode.set(node.name, []);
        byNode.get(node.name).push(node.height);
      }
    }
    const staleAllowance = 1 / density + 1e-6;
    return [...byNode.values()].some((hs) => Math.max(...hs) - Math.min(...hs) > staleAllowance);
  })();

  if (!gridSensitive) {
    finding(
      'self-probe',
      'scripts/measure-yoga.mjs',
      'HARNESS BLIND: the pixel-grid check no longer flags the pre-2026-09-14 FLOAT_SLACK (an ' +
        'absolute 1e-6). That slack rejected one quantum of genuine rounding at densities 2.625, ' +
        '2.75, 3 and 3.5 and kept the #700 loop armed. If this subtree can no longer demonstrate ' +
        'it, check 2 is not sensitive at the scale it exists for.',
    );
  }

  // ── Check 3's own sensitivity ───────────────────────────────────────────────────────────────
  // Same discipline: re-spread the growth keys onto the inner cell the way QuickAddOptionRow did
  // before 2026-09-15 and require the basis-trap check to notice. A latent-bug detector that
  // cannot see the bug it was written for is worse than none, because it reports clean.
  const basisSensitive = (() => {
    const a = SUBTREES.energyBudgetCard.build(Y, { density: 2.75, boundedHeight: 196, plantBasisDefect: true });
    const b = SUBTREES.energyBudgetCard.build(Y, { density: 2.75, boundedHeight: 320, plantBasisDefect: true });
    const byName = new Map(a.nodes.map((n) => [n.name, n.height]));
    return b.nodes.some((n) => {
      const other = byName.get(n.name);
      return other !== undefined && n.name !== 'budgetCard' && Math.abs(n.height - other) > 1;
    });
  })();

  if (!basisSensitive) {
    finding(
      'self-probe',
      'scripts/measure-yoga.mjs',
      'HARNESS BLIND: the basis-trap check no longer flags a percentage basis on the main axis. ' +
        'That is the class that cost PRs #695 and #696 and that react-native-web cannot reproduce ' +
        'by construction. If planting it produces no finding, check 3 is decorative.',
    );
  }

  return { defectSeen, healthy, gridSensitive, basisSensitive };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Check 1 — zero-height nodes
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * A node that computes to 0dp while having content is the fix #8 / EnergyMeter class: Android
 * paints the glyphs from a zero-height frame and the nearest `overflow:'hidden'` ancestor slices
 * them in a straight line. It is invisible on web, where the same node measures its content.
 */
function checkZeroHeight(Y) {
  for (const [name, spec] of Object.entries(SUBTREES)) {
    for (const density of DENSITIES) {
      const out = spec.build(Y, { density, plantFix8Defect: false });
      for (const node of out.nodes) {
        if (node.hasContent && node.height === 0) {
          finding(
            'zero-height',
            `${spec.source} (model: ${name}.${node.name})`,
            `computes 0dp at density ${density} while carrying content. On Android this frame ` +
              `paints sliced by the nearest overflow:'hidden' ancestor; on web it measures its ` +
              `content and looks correct. See HEADER_CLIP_DEBUG.md fix #8.`,
          );
        }
      }
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Check 2 — the pixel grid
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Yoga rounds every layout edge to the physical pixel grid (`config.setPointScaleFactor`), so a
 * node's reported HEIGHT is a function of where it SITS, not only of what is inside it. Round the
 * top edge one way and the bottom the other and unchanged content measures up to one quantum
 * taller than it did last frame.
 *
 * That is not a bug on its own — it is the platform, and `lib/layoutGrid.ts`'s `sameLayout()`
 * exists to absorb exactly one quantum of it. What IS a bug is a subtree whose height moves by
 * MORE than one quantum when only its position changes, because no amount of dedupe downstream
 * can tell that apart from a real content change, and an `onLayout`→animate site will then chase
 * it forever. That is the #700 loop, and this is the input a browser cannot generate.
 */
function checkPixelGrid(Y) {
  for (const [name, spec] of Object.entries(SUBTREES)) {
    for (const density of DENSITIES) {
      const quantum = 1 / density;
      const byNode = new Map();
      for (const offset of OFFSETS) {
        const out = spec.build(Y, { density, offset, plantFix8Defect: false });
        for (const node of out.nodes) {
          if (!byNode.has(node.name)) byNode.set(node.name, []);
          byNode.get(node.name).push({ offset, height: node.height });
        }
      }
      for (const [nodeName, samples] of byNode) {
        const heights = samples.map((s) => s.height);
        const lo = Math.min(...heights);
        const hi = Math.max(...heights);
        const spread = hi - lo;
        // This is `sameLayout(lo, hi)` from lib/layoutGrid.ts, evaluated here rather than
        // imported — that module imports react-native, which a plain node script cannot load.
        // `lib/__tests__/layoutGrid.test.ts` pins FLOAT32_EPSILON so the mirror cannot drift
        // silently. Running the app's OWN predicate over the real engine's output is what found
        // the slack to be three orders of magnitude too tight on 2026-09-14; keep it that way
        // rather than inventing a threshold for this harness.
        const allowed = quantum + 16384 * 1.1920929e-7;
        if (spread > allowed) {
          const shown = samples.map((s) => `${s.offset}→${s.height.toFixed(4)}`).join('  ');
          finding(
            'pixel-grid',
            `${spec.source} (model: ${name}.${nodeName})`,
            `height varies by ${spread.toFixed(4)}dp with POSITION alone at density ${density} ` +
              `(one quantum is ${quantum.toFixed(4)}dp). sameLayout() cannot absorb this, so an ` +
              `onLayout→animate site downstream will chase it. Samples: ${shown}`,
          );
        }
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
 * Check 3 — the percentage-basis trap
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * A node whose height is a percentage of an ancestor rather than of its own content.
 *
 * ⚠️ **This class has already cost this repo two PRs, and it is invisible to every other
 * harness by construction.** `components/QuickAddOptionRow.tsx` gives a grid cell
 * `flexBasis: '100%'` — a WIDTH percentage, because the grid it was written for is a ROW.
 * Dropped into a COLUMN the same number is read against the parent's HEIGHT.
 * `components/EnergyMeter.tsx:869-892` records the device result ("Sett dagens energi" sliced by
 * the card's own bottom edge) and notes the reason nothing caught it: *"react-native-web resolves
 * that to content and draws it correctly, which is why every harness here has always shown this
 * card intact."*
 *
 * **The trap is LATENT until an ancestor has a definite height**, which is why a plain layout of
 * the shipped tree shows nothing and why this check has to TRY one. Measured here: with the card
 * unbounded the row is 45.5dp either way; bound the card to 196dp — exactly PR #695's
 * `height: 196` — and the row inflates to 164dp, absorbing the card and pushing its siblings out.
 * That is #696's report ("the row stretched tall with its own text hanging past its border, the
 * card's content spilling below the card"), which was blamed on the height pin and reverted. The
 * pin was the trigger; this is the bug.
 *
 * `components/Collapsible.tsx:338` commits a numeric `height`, so every card body that folds is
 * such an ancestor. A latent trap in this app is one fold away from live.
 *
 * The test: lay the subtree out at two different definite ancestor heights. Any node whose own
 * height MOVES with the ancestor's is sized by the ancestor, not by its content.
 */
function checkBasisTrap(Y) {
  for (const [name, spec] of Object.entries(SUBTREES)) {
    if (!spec.probeBounded) continue;
    const density = 2.75;
    const a = spec.build(Y, { density, boundedHeight: 196 });
    const b = spec.build(Y, { density, boundedHeight: 320 });
    const byName = new Map(a.nodes.map((n) => [n.name, n.height]));
    for (const node of b.nodes) {
      const other = byName.get(node.name);
      if (other === undefined || node.name === spec.rootName) continue;
      if (Math.abs(node.height - other) > 1) {
        finding(
          'basis-trap',
          `${spec.source} (model: ${name}.${node.name})`,
          `height tracks its ANCESTOR's, not its own content: ${other.toFixed(1)}dp at a 196dp ` +
            `card and ${node.height.toFixed(1)}dp at a 320dp one. A percentage basis on the main ` +
            `axis (flexBasis:'100%' in a column) does this, and it is invisible on ` +
            `react-native-web, which resolves it from content. See EnergyMeter.tsx:869-892.`,
        );
      }
    }
  }
}

async function main() {
  const Y = await loadYoga();

  const probe = await selfProbe(Y);
  // Only run the real checks if the instrument demonstrably works. Reporting "clean" from a blind
  // harness is the single failure mode this repo keeps paying for.
  if (probe.defectSeen && probe.healthy && probe.gridSensitive && probe.basisSensitive) {
    checkZeroHeight(Y);
    checkPixelGrid(Y);
    checkBasisTrap(Y);
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ findings, probe }, null, 2));
  } else {
    console.log(`\n=== yoga audit — ${DENSITIES.length} densities × ${OFFSETS.length} offsets ===\n`);
    console.log(
      probe.defectSeen && probe.healthy && probe.gridSensitive && probe.basisSensitive
        ? '  self-probe ✓  fix #8 defect seen; control normal; grid + basis checks sensitive\n'
        : '  self-probe ✗  THIS HARNESS IS NOT MEASURING WHAT IT CLAIMS — see findings\n',
    );
    if (findings.length === 0) {
      console.log('  clean ✓  no 0dp frames, no position-dependent heights, no ancestor-sized nodes\n');
      console.log('  ⚠️  Clean here means the MODELLED subtrees are sound in the real engine. It');
      console.log('      says nothing about subtrees not modelled — see this file\'s header.\n');
    } else {
      for (const f of findings) {
        console.log(`  [${f.check}] ${f.where}`);
        console.log(`      ${f.detail}\n`);
      }
      console.log(`  ${findings.length} finding(s)\n`);
    }
  }
  process.exit(findings.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
