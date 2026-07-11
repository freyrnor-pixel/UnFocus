/**
 * WidgetViews.tsx — the three Android home-screen widget layouts + a name→JSX resolver.
 *
 * Pure presentational layouts built with react-native-android-widget primitives
 * (FlexWidget/TextWidget). They take an already-localised WidgetSnapshot slice and a
 * palette, so they never touch stores, i18n, or the settings theme — the app bakes
 * every string and the light/dark colours are chosen by the caller via renderWidgetByName.
 *
 * Connections:
 *   Imports → react-native-android-widget (FlexWidget, TextWidget), lib/widgets/snapshot (types)
 *   Used by → lib/widgets/handler.tsx (headless render), lib/widgets/sync.ts (in-app requestWidgetUpdate)
 *   Data    → none (pure)
 *
 * Edit notes:
 *   - WIDGET_NAMES must stay in lockstep with the `name` fields in app.json's
 *     react-native-android-widget `widgets` array and with the requestWidgetUpdate calls
 *     in lib/widgets/sync.ts — a mismatch means the widget silently never updates.
 *   - Tapping any widget opens the app (clickAction 'OPEN_APP'); deep-linking to a specific
 *     screen can be added later via 'OPEN_URI' + the `unfocus://` scheme once routes are confirmed.
 *   - Colours must be `#RRGGBB` literals (the lib's ColorProp type) — that's why palette
 *     values and the snapshot accents are typed/cast to Hex here. Keep layouts shallow
 *     (Flex + Text) — no app components, no StyleSheet — they render to native RemoteViews.
 *   - Do NOT put Unicode symbol glyphs (☑/☐/•/…) in a TextWidget: rendering them to the
 *     RemoteViews bitmap can fail and blank the WHOLE widget (the Tasks widget rendered
 *     fully transparent only once it had items). Use a FlexWidget shape (a filled dot for
 *     done, a bordered ring for not-done) instead — the same primitive the Shopping list uses.
 */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';

export const WIDGET_NAMES = ['Shopping', 'Tasks', 'Overview'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

type Hex = `#${string}`;
const hex = (c: string) => c as Hex;

type Palette = {
  bg: Hex;
  card: Hex;
  text: Hex;
  muted: Hex;
  line: Hex;
};

const LIGHT: Palette = { bg: '#FFFFFF', card: '#F1F5F9', text: '#0F1B2E', muted: '#64748B', line: '#E2E8F0' };
const DARK: Palette = { bg: '#0F1B2E', card: '#18243E', text: '#DDE9FB', muted: '#7A9FC6', line: '#2A4264' };

const FRAME = {
  height: 'match_parent' as const,
  width: 'match_parent' as const,
  flexDirection: 'column' as const,
  padding: 14,
  borderRadius: 20,
};

function Header({ title, subtitle, accent, p }: { title: string; subtitle: string; accent: Hex; p: Palette }) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent, marginRight: 8 }} />
        <TextWidget text={title} style={{ fontSize: 15, fontWeight: '700', color: p.text }} />
      </FlexWidget>
      <TextWidget text={subtitle} style={{ fontSize: 12, fontWeight: '500', color: accent }} />
    </FlexWidget>
  );
}

function Empty({ text, p }: { text: string; p: Palette }) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}
    >
      <TextWidget text={text} style={{ fontSize: 13, color: p.muted }} />
    </FlexWidget>
  );
}

function More({ text, p }: { text: string; p: Palette }) {
  if (!text) return null;
  return <TextWidget text={text} style={{ fontSize: 12, color: p.muted, marginTop: 6 }} />;
}

// ── Shopping ─────────────────────────────────────────────────────────────────
function ShoppingWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.shopping;
  const accent = hex(s.accent);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...FRAME, backgroundColor: p.bg }}>
      <Header title={s.title} subtitle={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 10 }}>
          {s.items.map((name, i) => (
            <FlexWidget
              key={`${i}-${name}`}
              style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}
            >
              <FlexWidget style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginRight: 8 }} />
              <TextWidget text={name} maxLines={1} truncate="END" style={{ fontSize: 13, color: p.text }} />
            </FlexWidget>
          ))}
          <More text={s.more} p={p} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────────
function TasksWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.tasks;
  const accent = hex(s.accent);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...FRAME, backgroundColor: p.bg }}>
      <Header title={s.title} subtitle={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 10 }}>
          {s.items.map((task, i) => (
            <FlexWidget
              key={`${i}-${task.title}`}
              style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}
            >
              <FlexWidget
                style={
                  task.done
                    ? { width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: accent }
                    : { width: 10, height: 10, borderRadius: 5, marginRight: 8, borderWidth: 2, borderColor: p.muted }
                }
              />
              <TextWidget
                text={task.title}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 13, color: task.done ? p.muted : p.text }}
              />
            </FlexWidget>
          ))}
          <More text={s.more} p={p} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// ── Overview ("Notifications" widget — mirrors the persistent daily-overview notification) ──
function OverviewWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.overview;
  const accent = hex(s.accent);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...FRAME, backgroundColor: p.bg }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent, marginRight: 8 }} />
        <TextWidget text={s.title} style={{ fontSize: 15, fontWeight: '700', color: p.text }} />
      </FlexWidget>
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 10 }}>
          {s.lines.map((line, i) => (
            <TextWidget
              key={`${i}-${line}`}
              text={line}
              maxLines={2}
              truncate="END"
              style={{ fontSize: 13, color: i === 0 ? p.text : p.muted, paddingVertical: 2 }}
            />
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function viewForName(name: string, snap: WidgetSnapshot, p: Palette) {
  switch (name) {
    case 'Shopping':
      return <ShoppingWidget snap={snap} p={p} />;
    case 'Tasks':
      return <TasksWidget snap={snap} p={p} />;
    case 'Overview':
    default:
      return <OverviewWidget snap={snap} p={p} />;
  }
}

/**
 * Resolve a widget name to a light/dark-aware WidgetRepresentation. Both the headless
 * task handler and the in-app requestWidgetUpdate path go through here, so all three
 * widgets stay visually identical no matter which context rendered them.
 */
export function renderWidgetByName(name: string, snap: WidgetSnapshot) {
  return {
    light: viewForName(name, snap, LIGHT),
    dark: viewForName(name, snap, DARK),
  };
}
