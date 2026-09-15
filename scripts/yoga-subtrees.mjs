#!/usr/bin/env node
/**
 * yoga-subtrees.mjs — the hand-transcribed subtree models `scripts/measure-yoga.mjs` lays out.
 *
 * ⚠️ **These are MODELS, and a model can go stale.** Every node cites the `file:line` whose style
 * it mirrors. If you change one of those styles, change the model in the same edit — the same
 * contract as the `Connections:` blocks in every file header. A model that has drifted is worse
 * than no model, because it reports clean about a tree the app no longer has.
 *
 * ⚠️ **Why hand-transcribed at all, rather than extracted.** Extracting the real tree needs the
 * app running, which means react-native-web, which is the engine this harness exists to get away
 * from. The alternative — resolving `StyleSheet.create` objects statically through the whole JSX
 * tree — is `scripts/audit-flex-parent.mjs`'s job, and it can only see ONE class without
 * laying anything out. So: mechanical breadth there, real-engine depth here, on a deliberately
 * small set of subtrees that have each already produced a device bug.
 *
 * Connections:
 *   Imports → yoga-layout (the real engine, compiled to WASM)
 *   Used by → scripts/measure-yoga.mjs
 *   Data    → none
 */

/**
 * `yoga-layout` is an ESM module with a top-level await, so it cannot be `require`d and must be
 * imported by path from this repo's node_modules when the caller is outside the package root.
 */
export async function loadYoga() {
  const mod = await import('yoga-layout');
  return mod.default ?? mod;
}

/** Spacing rungs, mirroring `constants/theme.ts:188-204`. */
const Spacing = { xs: 4, sm: 8, smd: 12, md: 16, lg: 24, xl: 32, xxl: 48 };

/**
 * Builds a Yoga config at a given density.
 *
 * `setPointScaleFactor` IS the pixel grid — it is what makes this harness able to generate the
 * input `npm run jitter` cannot (`HARNESS.md:262`, "a browser has no pixel grid to round on").
 */
function configAt(Y, density) {
  const config = Y.Config.create();
  config.setPointScaleFactor(density);
  return config;
}

/**
 * A tiny declarative node builder, so a model reads like the JSX it mirrors.
 *
 * `text: {w, h}` attaches a measure function — the thing that is NOT called when a frame
 * resolves to flex-basis:0, which is precisely the fix #8 signature.
 */
function build(Y, config, spec, ctx) {
  const node = Y.Node.create(config);
  const s = spec.style ?? {};

  if (s.flexDirection === 'row') node.setFlexDirection(Y.FLEX_DIRECTION_ROW);
  if (s.alignItems === 'center') node.setAlignItems(Y.ALIGN_CENTER);
  if (s.alignSelf === 'stretch') node.setAlignSelf(Y.ALIGN_STRETCH);
  if (s.alignSelf === 'flex-start') node.setAlignSelf(Y.ALIGN_FLEX_START);
  if (s.flexWrap === 'wrap') node.setFlexWrap(Y.WRAP_WRAP);
  if (s.overflow === 'hidden') node.setOverflow(Y.OVERFLOW_HIDDEN);
  if (s.flex !== undefined) node.setFlex(s.flex);
  if (s.flexGrow !== undefined) node.setFlexGrow(s.flexGrow);
  if (s.flexShrink !== undefined) node.setFlexShrink(s.flexShrink);
  if (s.flexBasis !== undefined) node.setFlexBasis(s.flexBasis);
  if (s.width !== undefined) node.setWidth(s.width);
  if (s.height !== undefined) node.setHeight(s.height);
  if (s.minWidth !== undefined) node.setMinWidth(s.minWidth);
  if (s.gap !== undefined) node.setGap(Y.GUTTER_ALL, s.gap);
  if (s.padding !== undefined) node.setPadding(Y.EDGE_ALL, s.padding);
  if (s.paddingTop !== undefined) node.setPadding(Y.EDGE_TOP, s.paddingTop);
  if (s.paddingVertical !== undefined) node.setPadding(Y.EDGE_VERTICAL, s.paddingVertical);
  if (s.paddingHorizontal !== undefined) node.setPadding(Y.EDGE_HORIZONTAL, s.paddingHorizontal);

  if (spec.text) {
    node.setMeasureFunc(() => {
      ctx.measureCalls++;
      return { width: spec.text.w, height: spec.text.h };
    });
  }

  (spec.children ?? []).forEach((child, i) => node.insertChild(build(Y, config, child, ctx), i));

  if (spec.name) ctx.registry.push({ name: spec.name, node, hasContent: !!spec.text || !!spec.children?.length });
  return node;
}

/** Lays a spec out and reports every named node's computed height. */
function layout(Y, { density, offset = 0, root }) {
  const config = configAt(Y, density);
  const ctx = { measureCalls: 0, registry: [] };

  // The whole point of `offset`: slide the subtree by a fraction of a dp and see whether its
  // content re-measures a different HEIGHT. On Android that shift is what an animating ancestor
  // does every frame, and it is why unchanged content reports a new height (`#700`).
  const outer = Y.Node.create(config);
  outer.setWidth(root.style?.width ?? 390);
  const spacer = Y.Node.create(config);
  spacer.setHeight(offset);
  outer.insertChild(spacer, 0);
  outer.insertChild(build(Y, config, root, ctx), 1);
  outer.calculateLayout(undefined, undefined, Y.DIRECTION_LTR);

  const nodes = ctx.registry.map((r) => ({
    name: r.name,
    hasContent: r.hasContent,
    height: r.node.getComputedHeight(),
  }));
  outer.freeRecursive();
  return { nodes, measureCalls: ctx.measureCalls };
}

export const SUBTREES = {
  /**
   * `ScreenHeader`'s band, as `HEADER_CLIP_DEBUG.md` fix #8 modelled it.
   *
   * headerBlock(definite height) → outer(flex:1) → mask(flexGrow:1, alignSelf:stretch,
   * overflow:hidden) → row(row, center, padV 8, padH 16, gap 16) → titleWrap(flex:1) → Text
   *
   * The definite-height ancestor is load-bearing and the reason a shallower model shows nothing:
   * without it, flex-basis:0 resolves from the content contribution and the defect disappears.
   * Mirrors `components/ScreenScaffold.tsx:1075-1081` (headerBlock) and
   * `components/ScreenHeader.tsx:650` (the removed `flex:1`, kept as this harness's probe).
   */
  headerBlock: {
    source: 'components/ScreenHeader.tsx:650 + components/ScreenScaffold.tsx:1075',
    build(Y, { density, offset, plantFix8Defect }) {
      return layout(Y, {
        density,
        offset,
        root: {
          name: 'headerBlock',
          style: { width: 390, height: 56 + 24, paddingTop: 24 },
          children: [
            {
              name: 'outer',
              style: { flex: 1 },
              children: [
                {
                  name: 'mask',
                  style: { flexGrow: 1, alignSelf: 'stretch', overflow: 'hidden' },
                  children: [
                    {
                      name: 'row',
                      style: {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: Spacing.sm,
                        paddingHorizontal: Spacing.md,
                        gap: Spacing.md,
                      },
                      children: [
                        {
                          name: 'titleWrap',
                          style: { flex: 1 },
                          children: [
                            {
                              name: 'title',
                              // The defect under probe: `flex:1` on the Text itself. Harmless
                              // while the Text was a direct child of the ROW (main axis = width);
                              // inside the COLUMN titleWrap it means flexBasis:0 on the HEIGHT.
                              style: plantFix8Defect ? { flex: 1 } : {},
                              text: { w: 120, h: 41 },
                            },
                          ],
                        },
                        { name: 'controls', style: { width: 120, height: 24 } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    },
  },

  /**
   * Home's Energy BUDGET card — the "not set" tutorial state, `home-energy-budget`'s screen.
   *
   * This subtree has produced two separate device bugs of the same family and both are
   * documented in the component: `tutorialPips` exists because `pipRow`'s `flex:1` collapses to
   * zero height as a direct child of this column (`components/EnergyMeter.tsx:840-847`), and
   * `qaLine` exists because `QuickAddOptionRow`'s `wide` basis is `'100%'` — a WIDTH percentage
   * that becomes a percentage of the card's indefinite HEIGHT without a row parent
   * (`:869-892`). Both fixes are in the model, so this asserts they STAY fixed.
   *
   * Mirrors `components/EnergyMeter.tsx:1030-1037,1067-1068,1110` and
   * `components/QuickAddOptionRow.tsx:162-163`.
   */
  energyBudgetCard: {
    source: 'components/EnergyMeter.tsx:830-900',
    // Opts into checkBasisTrap — this subtree is the one that has produced the class twice.
    probeBounded: true,
    rootName: 'budgetCard',
    build(Y, { density, offset, boundedHeight, plantBasisDefect }) {
      return layout(Y, {
        density,
        offset,
        root: {
          name: 'budgetCard',
          // `budgetCard: { padding: Spacing.md, gap: Spacing.sm }` — a plain COLUMN.
          // `boundedHeight` is the basis-trap probe, not a style the app sets: see
          // `checkBasisTrap` in measure-yoga.mjs for why a definite height has to be TRIED.
          style: { width: 358, padding: Spacing.md, gap: Spacing.sm, ...(boundedHeight ? { height: boundedHeight } : null) },
          children: [
            { name: 'rail', style: { height: 28 }, children: [] },
            {
              // `tutorialPips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }`
              name: 'tutorialPips',
              style: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
              children: Array.from({ length: 10 }, (_, i) => ({
                name: `pip${i}`,
                style: { width: 16, height: 16 },
              })),
            },
            {
              // `legendRow: { flexDirection: 'row', alignItems: 'center', gap: md, flexWrap }`
              name: 'legendRow',
              style: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
              children: [0, 1, 2].map((i) => ({
                name: `legendItem${i}`,
                style: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
                children: [
                  { name: `legendIcon${i}`, style: { width: 12, height: 12 } },
                  { name: `legendText${i}`, style: { flexShrink: 1 }, text: { w: 60, h: 14 } },
                ],
              })),
            },
            {
              // `qaLine: { flexDirection: 'row' }` — the row container the cell's basis assumes.
              name: 'qaLine',
              style: { flexDirection: 'row' },
              children: [
                {
                  // ⚠️ **TWO nodes, not one, and the difference is a live bug (2026-09-15).**
                  // The first model here collapsed `PressableScale` and the cell into a single
                  // node carrying `wide` once. The real tree applies `wide` TWICE —
                  // `QuickAddOptionRow.tsx:104` on the cell and `:143` on the Pressable that
                  // wraps it — so the model asserted a fix against a tree the app does not have.
                  // Exactly the staleness this file's header warns about, found the first time
                  // the harness was pointed at a real question.
                  //   `PressableScale` sets no `flexDirection`, so it is a COLUMN: the inner
                  // `flexBasis: '100%'` is a percentage of ITS height, not a width.
                  name: 'quickAddPressable',
                  style: { flexGrow: 1, flexShrink: 1, flexBasis: '100%', minWidth: 0 },
                  children: [
                    {
                      name: 'quickAddCell',
                      // ⚠️ **NO growth keys here, and that is the fix, not an omission.**
                      // `QuickAddOptionRow.tsx` spread `wide`/`half` onto BOTH this cell and the
                      // Pressable wrapping it until 2026-09-15. `PressableScale` is a column, so
                      // the inner `flexBasis:'100%'` was a percentage of its HEIGHT — latent
                      // until an ancestor had a definite height, and then it absorbed the card.
                      // If a future edit puts them back, `checkBasisTrap` fires. It was verified
                      // firing on the doubled tree before the fix landed (164dp at a 196dp card).
                      style: {
                        // `plantBasisDefect` re-spreads the growth keys the way the shipped code
                        // did before 2026-09-15, so `checkBasisTrap` can prove it still detects.
                        ...(plantBasisDefect ? { flexGrow: 1, flexShrink: 1, flexBasis: '100%', minWidth: 0 } : null),
                        justifyContent: 'center',
                        paddingHorizontal: Spacing.sm,
                        paddingVertical: Spacing.xs,
                        gap: 2,
                      },
                      children: [
                        { name: 'quickAddLabelLine', style: { flexDirection: 'row' }, children: [{ name: 'quickAddLabel', text: { w: 120, h: 15 } }] },
                        { name: 'quickAddValueLine', style: { flexDirection: 'row' }, children: [{ name: 'quickAddValue', text: { w: 140, h: 18 } }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    },
  },
};
