/**
 * scanTarget.test.ts — the scoped-scan classification.
 *
 * This is the ONLY automated coverage the scoped scan can have. `app/scan.web.tsx` is an OCR
 * placeholder, `scripts/preview.mjs` deliberately doesn't walk Scan, and the real screen needs
 * a camera — so the web preview cannot reach a single line of this feature. Keeping the
 * decision-making in a pure module is what makes any of it checkable; the screen is then only
 * wiring.
 */
import {
  matchScanToList,
  parseScanTarget,
  shouldRaisePrice,
  targetWritesToList,
} from '@/lib/scanTarget';

describe('parseScanTarget', () => {
  test('reads the three real targets', () => {
    expect(parseScanTarget('weekly')).toBe('weekly');
    expect(parseScanTarget('monthly')).toBe('monthly');
    expect(parseScanTarget('catalogue')).toBe('catalogue');
  });

  test('falls back to weekly for absent or unknown values', () => {
    // 'weekly' is what an untargeted scan did before this param existed, so an old deep link
    // behaves as it always has instead of erroring.
    expect(parseScanTarget(undefined)).toBe('weekly');
    expect(parseScanTarget('')).toBe('weekly');
    expect(parseScanTarget('nonsense')).toBe('weekly');
  });
});

describe('targetWritesToList', () => {
  test('catalogue is the one target that touches no shopping list', () => {
    expect(targetWritesToList('weekly')).toBe(true);
    expect(targetWritesToList('monthly')).toBe(true);
    expect(targetWritesToList('catalogue')).toBe(false);
  });
});

describe('matchScanToList', () => {
  const list = [
    { id: 'a', name: 'Melk', price: 22 },
    { id: 'b', name: 'Brød', price: 29 },
    { id: 'c', name: 'Egg', price: 45 },
  ];

  test('a scanned line already on the list confirms that row instead of adding a second', () => {
    const [milk] = matchScanToList([{ name: 'Melk', price: 24 }], list);
    expect(milk.matchedId).toBe('a');
    // The whole point of the feature: this is the row you already had, not a new one.
    expect(milk.newPrice).toBe(24);
  });

  test('a line with no counterpart is an addition', () => {
    const [smør] = matchScanToList([{ name: 'Smør', price: 60 }], list);
    expect(smør.matchedId).toBeNull();
    expect(smør.newPrice).toBeNull();
  });

  test('corrects a matched price in EITHER direction', () => {
    // Unlike the catalogue's raise-only rule: this is what the thing cost on the list you were
    // actually shopping from, so a lower price is a correction, not an offer to ignore.
    expect(matchScanToList([{ name: 'Brød', price: 19 }], list)[0].newPrice).toBe(19);
    expect(matchScanToList([{ name: 'Brød', price: 39 }], list)[0].newPrice).toBe(39);
  });

  test('leaves the price alone when it is unchanged or unknown', () => {
    expect(matchScanToList([{ name: 'Egg', price: 45 }], list)[0].newPrice).toBeNull();
    expect(matchScanToList([{ name: 'Egg', price: 0 }], list)[0].newPrice).toBeNull();
  });

  test('two scanned lines cannot both claim one list row', () => {
    // Buying two of something is two receipt lines and ONE row on the list. If both matched,
    // the second would silently vanish into a row that is already ticked off.
    const out = matchScanToList(
      [
        { name: 'Melk', price: 24 },
        { name: 'Melk', price: 24 },
      ],
      list
    );
    expect(out[0].matchedId).toBe('a');
    expect(out[1].matchedId).toBeNull();
  });

  test('is order-preserving and non-mutating', () => {
    const scanned = [
      { name: 'Smør', price: 60 },
      { name: 'Melk', price: 22 },
    ];
    const before = JSON.stringify({ scanned, list });
    const out = matchScanToList(scanned, list);
    expect(out.map((m) => m.item.name)).toEqual(['Smør', 'Melk']);
    expect(JSON.stringify({ scanned, list })).toBe(before);
  });

  test('an empty list makes every line an addition', () => {
    const out = matchScanToList([{ name: 'Melk', price: 22 }], []);
    expect(out[0].matchedId).toBeNull();
  });
});

describe('shouldRaisePrice', () => {
  test('only ever raises a catalogue price', () => {
    // Predates the scoped scan and is deliberate: a receipt shows what something cost once,
    // and an offer price shouldn't overwrite a known regular price. "Add/update" for the
    // catalogue target means new names + higher prices; lowering is a separate decision.
    expect(shouldRaisePrice(30, 22)).toBe(true);
    expect(shouldRaisePrice(19, 22)).toBe(false);
    expect(shouldRaisePrice(22, 22)).toBe(false);
  });
});
