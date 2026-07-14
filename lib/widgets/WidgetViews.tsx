/**
 * WidgetViews.tsx — the Android home-screen widget layouts + a name→JSX resolver.
 *
 * The live set is Shopping / Tasks / Notes / Habits / Health (WIDGET_NAMES); the retired
 * Overview layout is kept only for installs whose native build predates Habits/Health.
 * Pure presentational layouts built with react-native-android-widget primitives
 * (FlexWidget/TextWidget/ListWidget). They take an already-localised WidgetSnapshot slice
 * and a palette, so they never touch stores, i18n, or the settings theme — the app bakes
 * every string and the light/dark colours are chosen by the caller via renderWidgetByName.
 *
 * Interactivity: Tasks/Shopping/Notes/Habits rows live inside a scrollable ListWidget and
 * each carries its own clickAction so a tap writes back through the headless handler
 * (lib/widgets/handler.tsx → lib/widgets/widgetActions.ts):
 *   - Tasks   row → 'TOGGLE_TASK'      (mark done / not-done)
 *   - Shopping row → 'CYCLE_SHOP_ITEM' (list → cart → purchased)
 *   - Notes   row → 'TOGGLE_NOTE'      (check off; it then leaves the active list)
 *   - Habits  row → 'TOGGLE_HABIT'     (mark today met / not-met)
 * Health is read-only (its rows carry no clickAction — empty taps fall through to the
 * card's OPEN_APP). The Notes header's mic + "open" buttons use 'OPEN_URI' into the app
 * (speech recognition can only run in-app), and every frame falls back to OPEN_APP /
 * OPEN_URI for empty taps.
 *
 * Connections:
 *   Imports → react-native-android-widget (FlexWidget, TextWidget, ListWidget), lib/widgets/snapshot (types)
 *   Used by → lib/widgets/handler.tsx (headless render), lib/widgets/sync.ts (in-app requestWidgetUpdate)
 *   Data    → none (pure)
 *
 * Edit notes:
 *   - WIDGET_NAMES must stay in lockstep with the `name` fields in app.json's
 *     react-native-android-widget `widgets` array and with the requestWidgetUpdate calls
 *     in lib/widgets/sync.ts — a mismatch means the widget silently never updates.
 *   - Per-row clickAction inside a ListWidget IS supported (RNWidgetCollectionService sets a
 *     fill-in intent per item). Keep OPEN_URI/OPEN_APP buttons OUTSIDE the ListWidget (in the
 *     header/frame) — those "special" actions route through the non-collection click path.
 *   - Colours must be `#RRGGBB` literals (the lib's ColorProp type) — that's why palette
 *     values and the snapshot accents are typed/cast to Hex here. Keep layouts shallow
 *     (Flex + Text) — no app components, no StyleSheet — they render to native RemoteViews.
 *   - Do NOT put Unicode symbol glyphs (☑/☐/•/…) in a TextWidget: rendering them to the
 *     RemoteViews bitmap can fail and blank the WHOLE widget. Use a FlexWidget shape (a filled
 *     dot for done/in-cart, a bordered ring for not-done/in-list) instead.
 */
import React from 'react';
import { FlexWidget, TextWidget, ListWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';

// The live set (drives the app-side requestWidgetUpdate fan-out + app.json). 'Overview' was
// retired in favour of dedicated Habits + Health widgets; its render case is kept below for
// installs whose native build still has the old Overview receiver until they update.
export const WIDGET_NAMES = ['Shopping', 'Tasks', 'Notes', 'Habits', 'Health'] as const;
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

// Hand-mirrored from constants/colors.ts's bg/surface/text/textMuted/border (2026-07-14
// Claude Design palette refresh) — widgets can't call useAppTheme() at runtime.
const LIGHT: Palette = { bg: '#F7F8FA', card: '#FFFFFF', text: '#161B26', muted: '#5B6472', line: '#E2E5EA' };
const DARK: Palette = { bg: '#0B0E14', card: '#1A2030', text: '#E7EAF0', muted: '#8891A0', line: '#2E3446' };

const FRAME = {
  height: 'match_parent' as const,
  width: 'match_parent' as const,
  flexDirection: 'column' as const,
  padding: 14,
  borderRadius: 20,
};

const ROW = {
  width: 'match_parent' as const,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingVertical: 6,
  paddingHorizontal: 2,
};

/** Filled marker (done / in-cart). */
function Dot({ color }: { color: Hex }) {
  return <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: color }} />;
}
/** Hollow marker (not-done / in-list / note). */
function Ring({ color }: { color: Hex }) {
  return (
    <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, borderWidth: 2, borderColor: color }} />
  );
}

function Header({ title, subtitle, accent, p }: { title: string; subtitle: string; accent: Hex; p: Palette }) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent, marginRight: 8 }} />
        <TextWidget text={title} style={{ fontSize: 15, fontWeight: '700', color: p.text }} />
      </FlexWidget>
      {subtitle ? <TextWidget text={subtitle} style={{ fontSize: 12, fontWeight: '500', color: accent }} /> : null}
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

/** Scrollable list container + a "+N more" footer, sharing the column layout of every widget.
 *  ListWidget has no flex prop (it maps to a native ListView), so it fills a flex:1 wrapper
 *  via height:'match_parent', leaving the footer its own row below. */
function ScrollBody({ more, p, children }: { more: string; p: Palette; children: React.ReactNode }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'column', marginTop: 8 }}>
      <FlexWidget style={{ width: 'match_parent', flex: 1 }}>
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>{children}</ListWidget>
      </FlexWidget>
      <More text={more} p={p} />
    </FlexWidget>
  );
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
        <ScrollBody more={s.more} p={p}>
          {s.items.map((item, i) => {
            const inCart = item.state === 'cart';
            return (
              <FlexWidget key={`${i}-${item.id}`} clickAction="CYCLE_SHOP_ITEM" clickActionData={{ id: item.id }} style={ROW}>
                {inCart ? <Dot color={accent} /> : <Ring color={accent} />}
                <TextWidget
                  text={item.name}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: 13, color: inCart ? p.muted : p.text }}
                />
              </FlexWidget>
            );
          })}
        </ScrollBody>
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
        <ScrollBody more={s.more} p={p}>
          {s.items.map((task, i) => (
            <FlexWidget key={`${i}-${task.id}`} clickAction="TOGGLE_TASK" clickActionData={{ id: task.id }} style={ROW}>
              {task.done ? <Dot color={accent} /> : <Ring color={p.muted} />}
              <TextWidget
                text={task.title}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 13, color: task.done ? p.muted : p.text }}
              />
            </FlexWidget>
          ))}
        </ScrollBody>
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

// ── Notes ────────────────────────────────────────────────────────────────────
function NotesWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.notes;
  const accent = hex(s.accent);
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'unfocus:///notes' }} style={{ ...FRAME, backgroundColor: p.bg }}>
      <FlexWidget
        style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent, marginRight: 8 }} />
          <TextWidget text={s.title} style={{ fontSize: 15, fontWeight: '700', color: p.text }} />
        </FlexWidget>
        {/* Mic button → opens Notes and auto-starts recording (speech runs in-app only). */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'unfocus:///notes?capture=voice' }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: accent,
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', marginRight: 6 }} />
          <TextWidget text={s.voiceLabel} style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }} />
        </FlexWidget>
      </FlexWidget>
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {s.items.map((note, i) => (
            <FlexWidget key={`${i}-${note.id}`} clickAction="TOGGLE_NOTE" clickActionData={{ id: note.id }} style={ROW}>
              <Ring color={accent} />
              <TextWidget text={note.header || '—'} maxLines={1} truncate="END" style={{ fontSize: 13, color: p.text }} />
            </FlexWidget>
          ))}
        </ScrollBody>
      )}
    </FlexWidget>
  );
}

// ── Habits ───────────────────────────────────────────────────────────────────
function HabitsWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.habits;
  const accent = hex(s.accent);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...FRAME, backgroundColor: p.bg }}>
      <Header title={s.title} subtitle={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {s.items.map((habit, i) => (
            <FlexWidget key={`${i}-${habit.id}`} clickAction="TOGGLE_HABIT" clickActionData={{ id: habit.id }} style={ROW}>
              {habit.done ? <Dot color={accent} /> : <Ring color={p.muted} />}
              <TextWidget
                text={habit.title}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 13, color: habit.done ? p.muted : p.text }}
              />
            </FlexWidget>
          ))}
        </ScrollBody>
      )}
    </FlexWidget>
  );
}

// ── Health (read-only) ───────────────────────────────────────────────────────
/** Severity 1–5 as a compact scale of filled dots (accent) over hollow rings (line). */
function SeverityScale({ severity, accent, p }: { severity: number; accent: Hex; p: Palette }) {
  const filled = Math.max(0, Math.min(5, severity));
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <FlexWidget
          key={i}
          style={
            i < filled
              ? { width: 7, height: 7, borderRadius: 4, marginLeft: 3, backgroundColor: accent }
              : { width: 7, height: 7, borderRadius: 4, marginLeft: 3, borderWidth: 1, borderColor: p.line }
          }
        />
      ))}
    </FlexWidget>
  );
}

function HealthWidget({ snap, p }: { snap: WidgetSnapshot; p: Palette }) {
  const s = snap.health;
  const accent = hex(s.accent);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...FRAME, backgroundColor: p.bg }}>
      <Header title={s.title} subtitle={s.subtitle} accent={accent} p={p} />
      {!s.hasContent ? (
        <Empty text={s.empty} p={p} />
      ) : (
        <ScrollBody more={s.more} p={p}>
          {s.items.map((entry, i) => (
            // Read-only: no per-row clickAction (empty taps fall through to the card's OPEN_APP).
            <FlexWidget key={`${i}-${entry.id}`} style={{ ...ROW, justifyContent: 'space-between' }}>
              <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {entry.ongoing ? <Dot color={accent} /> : <Ring color={p.muted} />}
                <TextWidget
                  text={entry.label}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: 13, color: p.text }}
                />
              </FlexWidget>
              <SeverityScale severity={entry.severity} accent={accent} p={p} />
            </FlexWidget>
          ))}
        </ScrollBody>
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
    case 'Notes':
      return <NotesWidget snap={snap} p={p} />;
    case 'Habits':
      return <HabitsWidget snap={snap} p={p} />;
    case 'Health':
      return <HealthWidget snap={snap} p={p} />;
    case 'Overview':
    default:
      // Retired widget — retained for installs still running the pre-Habits/Health native build.
      return <OverviewWidget snap={snap} p={p} />;
  }
}

/**
 * Resolve a widget name to a light/dark-aware WidgetRepresentation. Both the headless
 * task handler and the in-app requestWidgetUpdate path go through here, so all four
 * widgets stay visually identical no matter which context rendered them.
 */
export function renderWidgetByName(name: string, snap: WidgetSnapshot) {
  return {
    light: viewForName(name, snap, LIGHT),
    dark: viewForName(name, snap, DARK),
  };
}
