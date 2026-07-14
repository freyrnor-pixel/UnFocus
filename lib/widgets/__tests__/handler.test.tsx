/**
 * handler.test.tsx — dispatch logic for the headless widget task handler.
 *
 * Focuses on the snapshot-source choice per widget action (the "widgets don't update until
 * the app is opened" fix): WIDGET_UPDATE (the OS periodic tick, app usually dead) must rebuild
 * from live SQLite via buildHeadlessSnapshot() so it reflects current data, while WIDGET_ADDED
 * / WIDGET_RESIZED prefer the more-precise app-built cache. All collaborators are mocked so the
 * test stays headless.
 */
jest.mock('@/lib/widgets/snapshot', () => ({
  __esModule: true,
  readWidgetSnapshot: jest.fn(),
  saveWidgetSnapshot: jest.fn(),
}));
jest.mock('@/lib/widgets/headlessSnapshot', () => ({
  __esModule: true,
  buildHeadlessSnapshot: jest.fn(),
}));
jest.mock('@/lib/widgets/WidgetViews', () => ({
  __esModule: true,
  renderWidgetByName: jest.fn((name: string, snap: unknown) => ({ name, snap })),
}));
jest.mock('@/lib/widgets/widgetActions', () => ({
  __esModule: true,
  toggleTaskDone: jest.fn(),
  cycleShoppingItem: jest.fn(),
  toggleNoteChecked: jest.fn(),
  toggleHabitDone: jest.fn(),
}));

import { widgetTaskHandler } from '@/lib/widgets/handler';
import { readWidgetSnapshot } from '@/lib/widgets/snapshot';
import { buildHeadlessSnapshot } from '@/lib/widgets/headlessSnapshot';
import { renderWidgetByName } from '@/lib/widgets/WidgetViews';

const mockRead = readWidgetSnapshot as jest.Mock;
const mockHeadless = buildHeadlessSnapshot as jest.Mock;
const mockRender = renderWidgetByName as jest.Mock;

// Distinct object identities so we can tell which source the handler rendered.
const CACHED = { updatedAt: 1, marker: 'cached' } as any;
const HEADLESS = { updatedAt: 2, marker: 'headless' } as any;

function run(widgetAction: string, renderWidget = jest.fn()) {
  return widgetTaskHandler({
    widgetAction,
    widgetInfo: { widgetName: 'Tasks' },
    renderWidget,
  } as any).then(() => renderWidget);
}

beforeEach(() => jest.clearAllMocks());

describe('widgetTaskHandler snapshot source per action', () => {
  it('WIDGET_UPDATE rebuilds from live DB even when a cache exists', async () => {
    mockRead.mockReturnValue(CACHED);
    mockHeadless.mockReturnValue(HEADLESS);

    const renderWidget = await run('WIDGET_UPDATE');

    expect(mockHeadless).toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalledWith('Tasks', HEADLESS);
    expect(renderWidget).toHaveBeenCalledWith({ name: 'Tasks', snap: HEADLESS });
  });

  it('WIDGET_UPDATE falls back to the cache when the live rebuild fails', async () => {
    mockRead.mockReturnValue(CACHED);
    mockHeadless.mockReturnValue(null);

    const renderWidget = await run('WIDGET_UPDATE');

    expect(mockRender).toHaveBeenCalledWith('Tasks', CACHED);
    expect(renderWidget).toHaveBeenCalledWith({ name: 'Tasks', snap: CACHED });
  });

  it.each(['WIDGET_ADDED', 'WIDGET_RESIZED'])(
    '%s prefers the app-built cache over a live rebuild',
    async (action) => {
      mockRead.mockReturnValue(CACHED);
      mockHeadless.mockReturnValue(HEADLESS);

      const renderWidget = await run(action);

      expect(mockRender).toHaveBeenCalledWith('Tasks', CACHED);
      expect(renderWidget).toHaveBeenCalledWith({ name: 'Tasks', snap: CACHED });
    }
  );

  it('WIDGET_ADDED builds from live DB when no cache exists (cold-install first plant)', async () => {
    mockRead.mockReturnValue(null);
    mockHeadless.mockReturnValue(HEADLESS);

    const renderWidget = await run('WIDGET_ADDED');

    expect(mockRender).toHaveBeenCalledWith('Tasks', HEADLESS);
    expect(renderWidget).toHaveBeenCalledWith({ name: 'Tasks', snap: HEADLESS });
  });
});
