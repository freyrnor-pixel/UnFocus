/**
 * handler.tsx — headless widget task handler for react-native-android-widget.
 *
 * Registered at the app entry (index.ts). Android invokes it — possibly with the app
 * process dead — whenever a widget is added, updated, resized, or the OS refresh
 * period elapses. It reads the pre-built, pre-localised snapshot from SQLite and hands
 * the matching widget JSX to renderWidget. It intentionally does NO data derivation and
 * imports NO stores/i18n, so it stays cheap and safe to run in a bare JS context.
 *
 * Connections:
 *   Imports → react-native-android-widget (types), lib/widgets/snapshot (readWidgetSnapshot),
 *             lib/widgets/WidgetViews (renderWidgetByName)
 *   Used by → index.ts (registerWidgetTaskHandler, Android only)
 *   Data    → reads the widget_snapshot SQLite row
 *
 * Edit notes:
 *   - If the snapshot is missing (first launch before the app ever wrote one), we render a
 *     minimal empty snapshot so the widget shows a placeholder instead of a blank/broken box.
 *   - WIDGET_CLICK is handled natively via each view's clickAction ('OPEN_APP'); we only need
 *     to (re-)render on the add/update/resize actions.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { readWidgetSnapshot, type WidgetSnapshot } from './snapshot';
import { renderWidgetByName } from './WidgetViews';

function placeholder(): WidgetSnapshot {
  const base = { title: 'UnFocus', subtitle: '', items: [], more: '', empty: '—', accent: '#F4A261', hasContent: false };
  return {
    updatedAt: Date.now(),
    shopping: { ...base },
    tasks: { ...base, items: [] },
    overview: { title: 'UnFocus', lines: [], empty: '—', accent: '#F4A261', hasContent: false },
  };
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo, renderWidget } = props;
  if (
    widgetAction !== 'WIDGET_ADDED' &&
    widgetAction !== 'WIDGET_UPDATE' &&
    widgetAction !== 'WIDGET_RESIZED'
  ) {
    return;
  }
  const snapshot = readWidgetSnapshot() ?? placeholder();
  renderWidget(renderWidgetByName(widgetInfo.widgetName, snapshot));
}
