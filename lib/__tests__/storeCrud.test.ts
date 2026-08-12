/**
 * storeCrud.test.ts — the guarded by-id row triple (lib/storeCrud.ts).
 *
 * Two things are being pinned here, and only one of them is arithmetic.
 *
 * The first is the **guard**: an id the store doesn't hold must produce no SQL and no new
 * array. Ten stores hand-rolled that check and two of them (useHealthStore,
 * useMedicineStore) never had it — see __tests__/storeUpdateGuard.test.ts for the
 * store-level half of this. A `null` return is what tells a caller to bail before its side
 * effects, so "returns null" and "wrote nothing" are asserted together every time.
 *
 * The second is the **call shape**, which is a type-level property a runtime test can't see
 * on its own: `T` must be inferred from `rows` alone. Both `FieldMap<T>` and `Partial<T>`
 * are homomorphic, so without the module's `NoInfer`s TypeScript infers `T` backwards out
 * of a `Partial<Omit<Row, 'id'>>` patch, fails the `{ id: string }` constraint, and quietly
 * resolves every call site to the bare constraint. It compiles at the helper and breaks at
 * every caller. The `Expect`/`Equal` assertions below fail `tsc` if that regresses, which is
 * the only way this file can catch it — a `NoInfer` is invisible at runtime.
 *
 * Headless: '@/lib/db' is mocked, and lib/dataAccess's updateRow runs through it, so the
 * exact SQL and parameters each helper produces are observable.
 */
import { FieldMap } from '@/lib/dataAccess';
import { deleteById, replaceById, updateById, withoutId } from '@/lib/storeCrud';
import db from '@/lib/db';

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

const runSync = db.runSync as jest.Mock;

type Widget = {
  id: string;
  title: string;
  count: number;
  done: boolean;
  /** Optional, so a patch can carry an explicit `undefined` for it. */
  note?: string;
};

const WIDGET_COLUMNS: FieldMap<Widget> = {
  title: { col: 'title' },
  count: { col: 'count' },
  done: { col: 'done', to: (v) => (v ? 1 : 0) },
  note: { col: 'note', to: (v) => v ?? null },
};

function widget(id: string, over: Partial<Widget> = {}): Widget {
  return { id, title: 'w-' + id, count: 0, done: false, ...over };
}

const rows = (): Widget[] => [widget('a'), widget('b', { count: 5 }), widget('c')];

beforeEach(() => runSync.mockClear());

describe('updateById', () => {
  it('writes only the patched columns, and returns the merged row', () => {
    const next = updateById('widgets', WIDGET_COLUMNS, rows(), 'b', { count: 6, done: true });

    expect(next).toEqual({ id: 'b', title: 'w-b', count: 6, done: true });
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(runSync).toHaveBeenCalledWith('UPDATE widgets SET count = ?, done = ? WHERE id = ?', [6, 1, 'b']);
  });

  it('is a complete no-op for an id the collection does not hold', () => {
    expect(updateById('widgets', WIDGET_COLUMNS, rows(), 'zz', { count: 6 })).toBeNull();
    expect(runSync).not.toHaveBeenCalled();
  });

  it('is a no-op on an empty collection — an unloaded store writes nothing', () => {
    // The documented trade: a store whose load() hasn't run can't tell "not present" from
    // "not loaded", and answers "not present" rather than writing blind.
    // (The annotation is the one cost of inferring `T` from `rows` alone — a bare `[]`
    // infers `never`. Store call sites always pass `get().rows`, so it never bites there.)
    const empty: Widget[] = [];
    expect(updateById('widgets', WIDGET_COLUMNS, empty, 'a', { count: 1 })).toBeNull();
    expect(runSync).not.toHaveBeenCalled();
  });

  it('leaves the source collection untouched', () => {
    const before = rows();
    updateById('widgets', WIDGET_COLUMNS, before, 'b', { count: 99 });
    expect(before.map((r) => r.count)).toEqual([0, 5, 0]);
  });

  it('writes and merges whatever the function form returns, so the two cannot disagree', () => {
    const seen: Widget[] = [];
    const next = updateById('widgets', WIDGET_COLUMNS, rows(), 'b', (row) => {
      seen.push(row);
      // The shape useTaskStore needs: a second column derived from the row being patched.
      return { count: row.count + 1, title: `${row.title} (${row.count + 1})` };
    });

    expect(seen).toEqual([widget('b', { count: 5 })]);
    expect(next).toEqual({ id: 'b', title: 'w-b (6)', count: 6, done: false });
    expect(runSync).toHaveBeenCalledWith('UPDATE widgets SET count = ?, title = ? WHERE id = ?', [6, 'w-b (6)', 'b']);
  });

  it('never calls the function form for an unknown id', () => {
    const patch = jest.fn(() => ({ count: 1 }));
    expect(updateById('widgets', WIDGET_COLUMNS, rows(), 'zz', patch)).toBeNull();
    expect(patch).not.toHaveBeenCalled();
  });

  it('treats an explicit undefined as a clear, in memory and in the write', () => {
    // useShoppingStore.unmarkPurchased relies on this: `{ purchasedAt: undefined }` has to
    // clear the field rather than be skipped as "no key".
    const next = updateById('widgets', WIDGET_COLUMNS, [widget('a', { note: 'hi' })], 'a', { note: undefined });
    expect(next).toEqual({ id: 'a', title: 'w-a', count: 0, done: false, note: undefined });
    expect(runSync).toHaveBeenCalledWith('UPDATE widgets SET note = ? WHERE id = ?', [null, 'a']);
  });

  it('runs no statement for an empty patch, but still reports the row as found', () => {
    // updateRow's own contract — nothing to SET. The row exists, so the caller should
    // still re-render and fire its side effects.
    expect(updateById('widgets', WIDGET_COLUMNS, rows(), 'a', {})).toEqual(widget('a'));
    expect(runSync).not.toHaveBeenCalled();
  });

  it('skips patch keys the FieldMap does not name', () => {
    // useMealStore leans on this: a Dish carries `ingredients`, which is a different table.
    const next = updateById('widgets', { title: { col: 'title' } } as FieldMap<Widget>, rows(), 'a', {
      title: 'renamed',
      count: 42,
    });
    expect(next).toEqual({ id: 'a', title: 'renamed', count: 42, done: false });
    expect(runSync).toHaveBeenCalledWith('UPDATE widgets SET title = ? WHERE id = ?', ['renamed', 'a']);
  });
});

describe('deleteById', () => {
  it('deletes the row and hands it back', () => {
    expect(deleteById('widgets', rows(), 'b')).toEqual(widget('b', { count: 5 }));
    expect(runSync).toHaveBeenCalledWith('DELETE FROM widgets WHERE id = ?', ['b']);
  });

  it('is a complete no-op for an id the collection does not hold', () => {
    expect(deleteById('widgets', rows(), 'zz')).toBeNull();
    expect(runSync).not.toHaveBeenCalled();
  });
});

describe('replaceById / withoutId', () => {
  it('replaces one row in place and keeps every other row identical by reference', () => {
    const before = rows();
    const next = { ...before[1], count: 9 };
    const after = replaceById(before, next);

    expect(after.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(after[1]).toBe(next);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(after).not.toBe(before);
  });

  it('leaves the collection alone when the row is not in it', () => {
    const before = rows();
    expect(replaceById(before, widget('zz'))).toEqual(before);
  });

  it('withoutId drops exactly the named row', () => {
    expect(withoutId(rows(), 'b').map((r) => r.id)).toEqual(['a', 'c']);
    expect(withoutId(rows(), 'zz').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

// ── Type-level: `T` comes from `rows`, never from the map or the patch ──────────────────
// These are compile-time assertions. They cost nothing at runtime and fail `tsc --noEmit`
// if either `NoInfer` is removed, which is the only signal that regression gives.
/* eslint-disable @typescript-eslint/no-unused-vars -- the `_`-prefixed aliases below ARE the
   assertion: each one only exists so `tsc` has to evaluate it. Nothing consumes them. */
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

/** The shape every store passes: a patch that has had `id` removed from it. */
const storePatch: Partial<Omit<Widget, 'id'>> = {};

type _InferredFromRows = Expect<Equal<ReturnType<typeof inferred>, Widget | null>>;
const inferred = () => updateById('widgets', WIDGET_COLUMNS, rows(), 'a', storePatch);

type _FunctionFormToo = Expect<Equal<ReturnType<typeof inferredFn>, Widget | null>>;
const inferredFn = () => updateById('widgets', WIDGET_COLUMNS, rows(), 'a', (row) => ({ count: row.count + 1 }));

type _DeleteInfers = Expect<Equal<ReturnType<typeof inferredDelete>, Widget | null>>;
const inferredDelete = () => deleteById('widgets', rows(), 'a');

it('keeps the row type at the call site (compile-time)', () => {
  // The assertions above are the real test; this keeps Jest from reporting an empty file
  // and proves the inferred calls actually run.
  expect(inferred()).toEqual(widget('a'));
  expect(inferredFn()).toEqual(widget('a', { count: 1 }));
  expect(inferredDelete()).toEqual(widget('a'));
});
