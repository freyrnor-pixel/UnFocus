/**
 * commitOnce.test.ts — the tier-3 "More" hand-off writes exactly one entity per press.
 *
 * The bug this pins is a duplicate-entity bug, and it is invisible until a user finds two
 * identical tasks in their list: `components/AddRow.tsx`'s `onMore` calls `setExpanded(false)`,
 * which blurs the TextInput, and on a blur path that also fires `onSubmitEditing` the composer's
 * commit runs a second time inside the same press. The composer cannot defend itself by reading
 * its own draft — the `setValue('')` every commit ends with has not flushed within that frame,
 * so the second call still sees the typed title.
 *
 * `createCommitOnce` is the guard, factored out of the hook precisely so it can be exercised
 * here: this repo has no hook-rendering library (no react-test-renderer, no testing-library), so
 * `useCommitOnce` itself is untestable in node and is a three-line ref wrapper for that reason.
 */
import { createCommitOnce } from '../commitOnce';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('createCommitOnce — single-flight', () => {
  it('creates once and hands the created entity off', () => {
    const run = createCommitOnce();
    const create = jest.fn(() => ({ id: 't1' }));
    const handOff = jest.fn();

    run(create, handOff);

    expect(create).toHaveBeenCalledTimes(1);
    expect(handOff).toHaveBeenCalledTimes(1);
    expect(handOff).toHaveBeenCalledWith({ id: 't1' });
  });

  it('drops a second call in the same turn — the blur-fires-onSubmitEditing double', () => {
    const run = createCommitOnce();
    const create = jest.fn(() => ({ id: 't1' }));
    const handOff = jest.fn();

    // Exactly what one press looks like when the composer commits twice: More, then the
    // submit the blur triggers, both before the event loop turns over.
    run(create, handOff);
    run(create, handOff);
    run(create, handOff);

    expect(create).toHaveBeenCalledTimes(1);
    expect(handOff).toHaveBeenCalledTimes(1);
  });

  it('re-opens on the next turn, so a genuine second add still works', () => {
    const run = createCommitOnce();
    const create = jest.fn(() => ({ id: 't1' }));
    const handOff = jest.fn();

    run(create, handOff);
    jest.runAllTimers();
    run(create, handOff);

    expect(create).toHaveBeenCalledTimes(2);
    expect(handOff).toHaveBeenCalledTimes(2);
  });

  it('is inert when create writes nothing — no hand-off, no navigation', () => {
    const run = createCommitOnce();
    // An empty line: the composer's commit returns undefined rather than writing a blank row.
    const create = jest.fn(() => undefined);
    const handOff = jest.fn();

    run(create, handOff);

    expect(create).toHaveBeenCalledTimes(1);
    expect(handOff).not.toHaveBeenCalled();
  });

  it('keeps one composer’s guard independent of another’s', () => {
    const whenever = createCommitOnce();
    const today = createCommitOnce();
    const handOff = jest.fn();

    whenever(() => ({ id: 'a' }), handOff);
    today(() => ({ id: 'b' }), handOff);

    expect(handOff).toHaveBeenCalledTimes(2);
    expect(handOff.mock.calls.map((c) => c[0].id)).toEqual(['a', 'b']);
  });
});
