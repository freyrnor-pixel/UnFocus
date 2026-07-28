/**
 * shareText.ts — plain-text checklist formatter for the native Share sheet.
 *
 * Renders a selection of shopping items or tasks as a ☐/☑ checklist string,
 * for texting/emailing to someone who may not have UnFocus installed — the
 * "send as SMS" counterpart to lib/share.ts's QR wire format. One-way only:
 * there is no parser for the reverse direction, and nothing here writes to a
 * store — see app/share-modal.tsx for where the result is handed to
 * react-native's Share.share().
 *
 * Connections:
 *   Imports → lib/date (formatDisplayDate)
 *   Used by → app/share-modal.tsx
 *   Data    → none (pure formatting of caller-supplied data)
 *
 * Edit notes:
 *   - Plain text only — no markdown — most SMS/MMS clients strip it anyway.
 *   - Unlike lib/share.ts's QR payload, there's no compact single-letter-key
 *     format or size ceiling to design around; text messages don't have the
 *     same practical length pressure as a QR code's module grid.
 */
import { formatDisplayDate } from '@/lib/date';
import type { Lang } from '@/lib/i18n';

export type ChecklistShoppingItem = { name: string; amount: string; unit: string; checked: boolean };
export type ChecklistTaskItem = { title: string; date: string; done: boolean };

function checklistLine(checked: boolean, label: string): string {
  return `${checked ? '☑' : '☐'} ${label}`;
}

export function formatShoppingChecklist(items: ChecklistShoppingItem[], listName?: string): string {
  const lines = items.map((i) => checklistLine(i.checked, `${i.amount} ${i.unit} ${i.name}`.replace(/\s+/g, ' ').trim()));
  return [listName ?? '', ...lines].filter(Boolean).join('\n');
}

export function formatTaskChecklist(items: ChecklistTaskItem[], lang: Lang, listName?: string): string {
  const lines = items.map((task) => checklistLine(task.done, `${task.title} (${formatDisplayDate(task.date, lang)})`));
  return [listName ?? '', ...lines].filter(Boolean).join('\n');
}
