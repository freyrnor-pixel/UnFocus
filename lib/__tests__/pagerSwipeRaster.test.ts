/**
 * pagerSwipeRaster.test.ts — the swipe flag's TRUTH TABLE, not its source text.
 *
 * `usePagerSwipeRaster` exists to be `true` for the duration of a pager drag and `false` the rest
 * of the time. Everything about it is a boolean, and this repo has shipped a whole release where a
 * boolean had quietly gone constant while three source-text assertions passed (`CLAUDE.md` A2:
 * `Surface.tsx`'s `glassOn` was `false` for every surface in the app and the `BlurView` it gated
 * was unreachable). The rule that came out of that is the one this file follows — **when a change
 * is a boolean, assert its truth table, not that the code exists.**
 *
 * So this renders the real hook and drives the real listener contract:
 *   · `enabled: false` → never subscribes, never true (a pushed screen must not listen for an
 *     event its navigator does not emit);
 *   · `enabled: true` → subscribes to BOTH events, goes true on `swipeStart`, false on `swipeEnd`;
 *   · unmount → both subscriptions released.
 *
 * ⚠️ **The one thing this cannot check is the one thing that matters most**, and it is not a gap
 * this test can close: whether rastering the page actually makes the swipe smooth on the device.
 * `renderToHardwareTextureAndroid` is a no-op everywhere a harness can run. The wiring was still
 * verified in motion rather than on paper — the web preview drove a real drag with a temporary
 * marker attribute on the scaffold and saw 0 pages rastering at rest, 5 while the finger was down,
 * 0 again after release.
 */
import * as React from 'react';
import { act, create } from 'react-test-renderer';

/** The fake navigation object, standing in for a tab screen's own (see the hook's doc for why a
 *  screen's and not the navigator's). Records every subscription so the test can assert the
 *  contract rather than trusting it. */
type Listener = () => void;
const mockListeners: Record<string, Listener[]> = {};
const mockRemoved: string[] = [];

const mockAddListener = jest.fn((type: string, cb: Listener) => {
  mockListeners[type] = mockListeners[type] ?? [];
  mockListeners[type].push(cb);
  return () => {
    mockRemoved.push(type);
    mockListeners[type] = mockListeners[type].filter((l) => l !== cb);
  };
});

jest.mock('expo-router', () => ({
  useNavigation: () => ({ addListener: mockAddListener }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const usePagerSwipeRaster = require('../usePagerSwipeRaster').default as (e: boolean) => boolean;

/** Renders the hook and exposes its latest value. */
function mount(enabled: boolean) {
  const seen: boolean[] = [];
  function Probe() {
    seen.push(usePagerSwipeRaster(enabled));
    return null;
  }
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(React.createElement(Probe));
  });
  return {
    latest: () => seen[seen.length - 1],
    // Fire the event the pager would fire, through the listener the hook actually registered.
    fire: (type: string) => act(() => { (mockListeners[type] ?? []).forEach((l) => l()); }),
    unmount: () => act(() => { tree!.unmount(); }),
  };
}

beforeEach(() => {
  for (const k of Object.keys(mockListeners)) delete mockListeners[k];
  mockRemoved.length = 0;
  mockAddListener.mockClear();
});

describe('usePagerSwipeRaster — off unless a pager page is being dragged', () => {
  it('never subscribes when disabled, and stays false', () => {
    const h = mount(false);
    expect(mockAddListener).not.toHaveBeenCalled();
    expect(h.latest()).toBe(false);
    // Even if something else in the tree emitted, there is nothing listening.
    h.fire('swipeStart');
    expect(h.latest()).toBe(false);
  });

  it('subscribes to both swipe events when enabled', () => {
    mount(true);
    const types = mockAddListener.mock.calls.map((c) => c[0]).sort();
    expect(types).toEqual(['swipeEnd', 'swipeStart']);
  });

  it('rests false before any drag', () => {
    expect(mount(true).latest()).toBe(false);
  });

  it('goes true for the drag and false again when it ends', () => {
    const h = mount(true);
    h.fire('swipeStart');
    expect(h.latest()).toBe(true);
    h.fire('swipeEnd');
    expect(h.latest()).toBe(false);
  });

  it('survives a second drag — the flag is not one-shot', () => {
    const h = mount(true);
    h.fire('swipeStart');
    h.fire('swipeEnd');
    h.fire('swipeStart');
    expect(h.latest()).toBe(true);
    h.fire('swipeEnd');
    expect(h.latest()).toBe(false);
  });

  it('ends false even if swipeEnd arrives without a swipeStart', () => {
    // ViewPager2 can settle without a drag (a programmatic jump), and a page left rastered
    // forever would re-raster on every content change — the exact cost the drag scope avoids.
    const h = mount(true);
    h.fire('swipeEnd');
    expect(h.latest()).toBe(false);
  });

  it('releases both subscriptions on unmount', () => {
    const h = mount(true);
    h.unmount();
    expect(mockRemoved.sort()).toEqual(['swipeEnd', 'swipeStart']);
    expect(mockListeners.swipeStart ?? []).toHaveLength(0);
    expect(mockListeners.swipeEnd ?? []).toHaveLength(0);
  });
});
