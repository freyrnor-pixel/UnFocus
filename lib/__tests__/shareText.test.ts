/**
 * shareText.test.ts — unit tests for lib/shareText.ts (plain-text checklist formatter).
 *
 * Pure functions, no mocks. Covers the checked/unchecked glyph, label
 * formatting, and optional list-name header for both item kinds.
 */
import { formatShoppingChecklist, formatTaskChecklist } from '@/lib/shareText';

describe('formatShoppingChecklist', () => {
  it('renders an unchecked item with a ☐ glyph and amount/unit/name label', () => {
    const result = formatShoppingChecklist([{ name: 'Milk', amount: '2', unit: 'l', checked: false }]);
    expect(result).toBe('☐ 2 l Milk');
  });

  it('renders a checked item with a ☑ glyph', () => {
    const result = formatShoppingChecklist([{ name: 'Bread', amount: '', unit: '', checked: true }]);
    expect(result).toBe('☑ Bread');
  });

  it('prefixes a list name as a header line when provided', () => {
    const result = formatShoppingChecklist(
      [{ name: 'Milk', amount: '2', unit: 'l', checked: false }],
      'Weekly'
    );
    expect(result).toBe('Weekly\n☐ 2 l Milk');
  });

  it('joins multiple items with newlines, one per line', () => {
    const result = formatShoppingChecklist([
      { name: 'Milk', amount: '2', unit: 'l', checked: false },
      { name: 'Eggs', amount: '12', unit: '', checked: true },
    ]);
    expect(result).toBe('☐ 2 l Milk\n☑ 12 Eggs');
  });
});

describe('formatTaskChecklist', () => {
  it('renders an undone task with a ☐ glyph, title, and formatted date', () => {
    const result = formatTaskChecklist([{ title: 'Book dentist', date: '2026-07-28', done: false }], 'en');
    expect(result).toBe('☐ Book dentist (2026-07-28)');
  });

  it('renders a done task with a ☑ glyph', () => {
    const result = formatTaskChecklist([{ title: 'Pay rent', date: '2026-07-01', done: true }], 'en');
    expect(result).toBe('☑ Pay rent (2026-07-01)');
  });

  it('formats the date per the Norwegian display convention', () => {
    const result = formatTaskChecklist([{ title: 'Ring legen', date: '2026-07-28', done: false }], 'no');
    expect(result).toBe('☐ Ring legen (28.07.2026)');
  });

  it('prefixes a list name as a header line when provided', () => {
    const result = formatTaskChecklist(
      [{ title: 'Book dentist', date: '2026-07-28', done: false }],
      'en',
      'Today'
    );
    expect(result).toBe('Today\n☐ Book dentist (2026-07-28)');
  });
});
