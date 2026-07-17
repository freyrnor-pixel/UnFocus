/**
 * catalogStore.test.ts — unit tests for the JS logic in store/useCatalogStore.ts
 * (suggest / recordPurchases / resetItemPrice).
 *
 * Every method keeps the in-memory `items` list in lock-step with its SQLite
 * writes, so mocking '@/lib/db' to no-op the writes lets the real ranking /
 * price-learning logic run and be asserted on state. We seed `items` directly
 * with setState rather than through load() (which would run the seed + a DB read).
 */
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));

import db from '@/lib/db';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';

function item(overrides: Partial<StoreItem>): StoreItem {
  return { id: 'i1', name: 'Item', category: 'other', store: '', price: 0, ...overrides };
}

afterEach(() => useCatalogStore.setState({ items: [] }));

describe('load', () => {
  it('stores items in Norwegian-collated order (æ < ø < å, after z)', () => {
    // load() sorts in JS with localeCompare('no') so CatalogueTab can render `items`
    // directly with no per-mount sort. A plain byte/codepoint sort would order these
    // Å(C5) < Æ(C6) < Ø(D8); Norwegian collation must instead give Æ < Ø < Å (å last).
    (db.getAllSync as jest.Mock).mockReturnValueOnce([
      { id: '1', name: 'Øl', category: 'other', store: '', price: 0 },
      { id: '2', name: 'Banan', category: 'other', store: '', price: 0 },
      { id: '3', name: 'Ært', category: 'other', store: '', price: 0 },
      { id: '4', name: 'Apple', category: 'other', store: '', price: 0 },
      { id: '5', name: 'Ål', category: 'other', store: '', price: 0 },
    ]);

    useCatalogStore.getState().load();

    expect(useCatalogStore.getState().items.map((i) => i.name)).toEqual([
      'Apple',
      'Banan',
      'Ært',
      'Øl',
      'Ål',
    ]);
  });
});

describe('suggest', () => {
  beforeEach(() => {
    useCatalogStore.setState({
      items: [
        item({ id: '1', name: 'Milk' }),
        item({ id: '2', name: 'Almond milk' }),
        item({ id: '3', name: 'Bread' }),
        item({ id: '4', name: 'Milk' }), // duplicate name (case-insensitive)
      ],
    });
  });

  it('returns [] for a blank query', () => {
    expect(useCatalogStore.getState().suggest('   ')).toEqual([]);
  });

  it('ranks prefix matches before substring matches', () => {
    const names = useCatalogStore
      .getState()
      .suggest('milk')
      .map((i) => i.name);
    // "Milk" starts with the query → ranks above "Almond milk" (substring only).
    expect(names[0]).toBe('Milk');
    expect(names).toContain('Almond milk');
    expect(names).not.toContain('Bread');
  });

  it('de-duplicates by case-insensitive name', () => {
    expect(
      useCatalogStore
        .getState()
        .suggest('milk')
        .filter((i) => i.name === 'Milk')
    ).toHaveLength(1);
  });

  it('honours the limit', () => {
    expect(useCatalogStore.getState().suggest('i', 2).length).toBeLessThanOrEqual(2);
  });
});

describe('recordPurchases price learning', () => {
  it('raises the catalog price but never lowers it', () => {
    useCatalogStore.setState({ items: [item({ id: '1', name: 'Milk', price: 20, store: 'A' })] });

    // Lower price on a later receipt must NOT overwrite the known price.
    useCatalogStore
      .getState()
      .recordPurchases([{ name: 'Milk', price: 15, store: 'B', wasOnList: false }]);
    let milk = useCatalogStore.getState().items.find((i) => i.name === 'Milk')!;
    expect(milk.price).toBe(20);
    expect(milk.store).toBe('B'); // store still updates unconditionally

    // A higher price does raise it.
    useCatalogStore
      .getState()
      .recordPurchases([{ name: 'Milk', price: 25, store: 'C', wasOnList: false }]);
    milk = useCatalogStore.getState().items.find((i) => i.name === 'Milk')!;
    expect(milk.price).toBe(25);
  });

  it('updates category unconditionally on an existing item', () => {
    useCatalogStore.setState({ items: [item({ id: '1', name: 'Milk', category: 'dairy' })] });
    useCatalogStore
      .getState()
      .recordPurchases([
        { name: 'Milk', price: 0, store: '', category: 'drinks', wasOnList: false },
      ]);
    expect(useCatalogStore.getState().items.find((i) => i.name === 'Milk')!.category).toBe(
      'drinks'
    );
  });

  it('adds a brand-new item for an unknown name', () => {
    useCatalogStore.setState({ items: [] });
    useCatalogStore
      .getState()
      .recordPurchases([
        { name: 'Bread', price: 30, store: 'A', category: 'bakery', wasOnList: true },
      ]);
    const bread = useCatalogStore.getState().items.find((i) => i.name === 'Bread');
    expect(bread).toMatchObject({ name: 'Bread', price: 30, store: 'A', category: 'bakery' });
  });

  it('ignores blank names and empty input', () => {
    useCatalogStore.setState({ items: [] });
    useCatalogStore
      .getState()
      .recordPurchases([{ name: '  ', price: 5, store: '', wasOnList: false }]);
    useCatalogStore.getState().recordPurchases([]);
    expect(useCatalogStore.getState().items).toHaveLength(0);
  });
});

describe('resetItemPrice', () => {
  it('overwrites the price of an existing item (OCR correction)', () => {
    useCatalogStore.setState({ items: [item({ id: '1', name: 'Milk', price: 99 })] });
    useCatalogStore.getState().resetItemPrice('1', 12);
    expect(useCatalogStore.getState().items.find((i) => i.id === '1')!.price).toBe(12);
  });

  it('is a no-op for an unknown id', () => {
    useCatalogStore.setState({ items: [item({ id: '1', price: 5 })] });
    useCatalogStore.getState().resetItemPrice('nope', 12);
    expect(useCatalogStore.getState().items[0].price).toBe(5);
  });
});
