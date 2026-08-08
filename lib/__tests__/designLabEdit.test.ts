/**
 * designLabEdit.test.ts — every write the design lab's playground makes.
 *
 * Two properties are being protected, and the second is the unusual one:
 *
 *   1. **The operations do what they say**, including the fiddly ones — a duplicate is a
 *      second card rather than an edit of the first, a removal closes the hole it left.
 *   2. **A no-op returns the SAME bag reference.** These are driven by gestures the web
 *      preview cannot activate at all, so "the button did nothing" has to be assertable here
 *      or it is assertable nowhere. Every impossible request below is checked by identity,
 *      not by deep equality — a fresh but equal object would still re-render the screen and
 *      would still hide a half-applied write.
 */
import {
  CARD_SKELETONS,
  EMPTY_OVERRIDES,
  MAX_CARDS_PER_SCREEN,
  MAX_PARTS_PER_CARD,
  MAX_SCREENS,
  PART_KINDS,
  cardKnob,
  type LabOverrides,
} from '@/lib/designLab';
import {
  addCard,
  addPart,
  addScreen,
  duplicateCard,
  findCard,
  findScreenFor,
  mintCardId,
  mintPartId,
  mintScreenId,
  movePartToCell,
  movePartToSlot,
  removeCard,
  removePart,
  removeScreen,
  renameScreen,
  reorderCards,
  reorderScreens,
  updateCard,
  updatePart,
} from '@/lib/designLabEdit';

/** A bag with one screen, one blank card, nothing on it. */
function oneCard(): { bag: LabOverrides; at: { screenId: string; cardId: string } } {
  const seeded = addScreen(EMPTY_OVERRIDES, 'plans');
  const screenId = seeded.screenId as string;
  const made = addCard(seeded.next, screenId, 'blank');
  return { bag: made.next, at: { screenId, cardId: made.cardId as string } };
}

describe('minting ids', () => {
  it('is deterministic given what already exists', () => {
    expect(mintScreenId([])).toBe('screen-1');
    expect(mintCardId({ id: 's', screen: '', title: '', note: '', cards: [] })).toBe('card-1');
    expect(mintPartId([], 'slider')).toBe('slider-1');
  });

  it('never collides with an id already in use', () => {
    const parts = [
      { id: 'slider-1', kind: 'slider' as const, slot: 'body' as const, label: '', color: '', size: 'sm' as const, weight: 'regular' as const },
      { id: 'slider-2', kind: 'slider' as const, slot: 'body' as const, label: '', color: '', size: 'sm' as const, weight: 'regular' as const },
    ];
    expect(mintPartId(parts, 'slider')).toBe('slider-3');
  });
});

describe('screens', () => {
  it('makes a blank screen standing in for a real one', () => {
    const { next, screenId } = addScreen(EMPTY_OVERRIDES, 'habits');
    expect(screenId).toBe('screen-1');
    expect(next.playground.screens[0]).toEqual({ id: 'screen-1', screen: 'habits', title: '', cards: [], note: '' });
  });

  it('refuses past the cap, and says so by handing back the same bag', () => {
    let bag = EMPTY_OVERRIDES;
    for (let i = 0; i < MAX_SCREENS; i += 1) bag = addScreen(bag, 'plans').next;
    const capped = addScreen(bag, 'plans');
    expect(capped.next).toBe(bag);
    expect(capped.screenId).toBeNull();
  });

  it('removes, renames and reorders', () => {
    const a = addScreen(EMPTY_OVERRIDES, 'plans');
    const b = addScreen(a.next, 'habits');
    expect(renameScreen(b.next, 'screen-1', 'Morning').playground.screens[0].title).toBe('Morning');
    expect(reorderScreens(b.next, ['screen-2', 'screen-1']).playground.screens.map((s) => s.id))
      .toEqual(['screen-2', 'screen-1']);
    expect(removeScreen(b.next, 'screen-1').playground.screens.map((s) => s.id)).toEqual(['screen-2']);
  });

  it('does nothing for a screen that is not there', () => {
    const { bag } = oneCard();
    expect(removeScreen(bag, 'nope')).toBe(bag);
    expect(renameScreen(bag, 'nope', 'x')).toBe(bag);
  });

  it('finds the screen standing in for a real one, so a nav tap can seed lazily', () => {
    const { bag } = oneCard();
    expect(findScreenFor(bag, 'plans')?.id).toBe('screen-1');
    expect(findScreenFor(bag, 'health')).toBeNull();
  });
});

describe('cards', () => {
  it('starts a blank card with nothing on it', () => {
    const { bag, at } = oneCard();
    expect(findCard(bag, at)!.parts).toEqual([]);
    expect(findCard(bag, at)!.origin).toBe('blank');
  });

  it('starts a skeleton with the skeleton’s parts', () => {
    const seeded = addScreen(EMPTY_OVERRIDES, 'plans');
    const made = addCard(seeded.next, seeded.screenId as string, 'row');
    const skeleton = CARD_SKELETONS.find((s) => s.origin === 'row')!;
    expect(findCard(made.next, { screenId: seeded.screenId as string, cardId: made.cardId as string })!.parts)
      .toEqual(skeleton.parts);
  });

  // The 11 real cards are demoted, not deleted — starting from one is what keeps the lab's
  // original question ("the to-do card, but…") answerable inside the playground.
  it('starts a real card from the card the app actually ships', () => {
    const seeded = addScreen(EMPTY_OVERRIDES, 'plans');
    const made = addCard(seeded.next, seeded.screenId as string, 'todo');
    const card = findCard(made.next, { screenId: seeded.screenId as string, cardId: made.cardId as string })!;
    expect(card.parts).toEqual(cardKnob('todo')!.defaultParts);
  });

  it('refuses past the cap and for a screen that is not there', () => {
    const { bag, at } = oneCard();
    let filled = bag;
    for (let i = 1; i < MAX_CARDS_PER_SCREEN; i += 1) filled = addCard(filled, at.screenId, 'blank').next;
    expect(addCard(filled, at.screenId, 'blank').next).toBe(filled);
    expect(addCard(bag, 'nope', 'blank').next).toBe(bag);
  });

  it('removes a card and leaves the rest alone', () => {
    const { bag, at } = oneCard();
    const two = addCard(bag, at.screenId, 'row');
    const out = removeCard(two.next, at);
    expect(out.playground.screens[0].cards.map((c) => c.id)).toEqual([two.cardId]);
    expect(removeCard(bag, { ...at, cardId: 'nope' })).toBe(bag);
  });

  it('reorders and renames', () => {
    const { bag, at } = oneCard();
    const two = addCard(bag, at.screenId, 'row');
    expect(reorderCards(two.next, at.screenId, [two.cardId as string, at.cardId]).playground.screens[0].cards.map((c) => c.id))
      .toEqual([two.cardId, at.cardId]);
    expect(findCard(updateCard(bag, at, { title: 'Today' }), at)!.title).toBe('Today');
  });
});

describe('duplicateCard', () => {
  it('puts the copy straight after the original', () => {
    const { bag, at } = oneCard();
    const other = addCard(bag, at.screenId, 'row');
    const out = duplicateCard(other.next, at);
    expect(out.next.playground.screens[0].cards.map((c) => c.id)).toEqual([at.cardId, out.cardId, other.cardId]);
  });

  // The subtle one. Sharing part ids would let the export match one card's parts against the
  // other's when it works out `moved` versus `added` — the copy would read as an EDIT of the
  // original rather than as a second card, which is a report that lies.
  it('mints fresh part ids, so the copy is not read as an edit of the original', () => {
    const seeded = addScreen(EMPTY_OVERRIDES, 'plans');
    const made = addCard(seeded.next, seeded.screenId as string, 'todo');
    const at = { screenId: seeded.screenId as string, cardId: made.cardId as string };
    const out = duplicateCard(made.next, at);
    const original = findCard(out.next, at)!;
    const copy = findCard(out.next, { ...at, cardId: out.cardId as string })!;

    expect(copy.parts).toHaveLength(original.parts.length);
    const shared = copy.parts.map((p) => p.id).filter((id) => original.parts.some((p) => p.id === id));
    expect(shared).toEqual([]);
    // Everything except the id is carried over — it is a copy, not a new card.
    expect(copy.parts.map((p) => p.kind)).toEqual(original.parts.map((p) => p.kind));
    expect(copy.parts.map((p) => p.slot)).toEqual(original.parts.map((p) => p.slot));
  });

  it('refuses past the cap and for a card that is not there', () => {
    const { bag, at } = oneCard();
    let filled = bag;
    for (let i = 1; i < MAX_CARDS_PER_SCREEN; i += 1) filled = addCard(filled, at.screenId, 'blank').next;
    expect(duplicateCard(filled, at).next).toBe(filled);
    expect(duplicateCard(bag, { ...at, cardId: 'nope' }).next).toBe(bag);
  });
});

describe('parts', () => {
  it('adds at the kind’s default position and hands back the id, so it can be selected', () => {
    const { bag, at } = oneCard();
    const { next, partId } = addPart(bag, at, 'slider');
    expect(partId).toBe('slider-1');
    expect(findCard(next, at)!.parts[0].slot).toBe('body');
  });

  // `SLOTS_FOR_KIND.button` starts at `trailing`, so taking the registry's first legal slot
  // made "add a button" grow a ROW on a blank card and hang the button off the end of it.
  // The card's own space is what "put a thing on this card" means — and as it happens every
  // kind can take it, so nothing tapped off the shelf ever lands somewhere surprising.
  it('lands every kind in the card’s own space', () => {
    const { bag, at } = oneCard();
    for (const kind of PART_KINDS) {
      const { next } = addPart(bag, at, kind);
      expect(findCard(next, at)!.parts[0].slot).toBe('body');
    }
  });

  it('honours a slot the kind allows and ignores one it does not', () => {
    const { bag, at } = oneCard();
    expect(findCard(addPart(bag, at, 'checkbox', 'leading').next, at)!.parts[0].slot).toBe('leading');
    // A slider cannot go on the one-line meta row, so it lands where it CAN go instead.
    expect(findCard(addPart(bag, at, 'slider', 'meta').next, at)!.parts[0].slot).toBe('body');
  });

  it('refuses past the part cap', () => {
    const { bag, at } = oneCard();
    let filled = bag;
    for (let i = 0; i < MAX_PARTS_PER_CARD; i += 1) filled = addPart(filled, at, 'text').next;
    expect(findCard(filled, at)!.parts).toHaveLength(MAX_PARTS_PER_CARD);
    expect(addPart(filled, at, 'text').next).toBe(filled);
  });

  it('removes a part, and does nothing for one that is not there', () => {
    const { bag, at } = oneCard();
    const added = addPart(bag, at, 'slider');
    expect(findCard(removePart(added.next, at, 'slider-1'), at)!.parts).toEqual([]);
    expect(removePart(added.next, at, 'nope')).toBe(added.next);
  });

  it('refuses an update that would put a kind in a slot it cannot take', () => {
    const { bag, at } = oneCard();
    const added = addPart(bag, at, 'slider');
    const part = findCard(added.next, at)!.parts[0];
    expect(updatePart(added.next, at, { ...part, slot: 'meta' })).toBe(added.next);
  });

  it('moves between row positions, and refuses an illegal one', () => {
    const { bag, at } = oneCard();
    const added = addPart(bag, at, 'checkbox', 'check');
    expect(findCard(movePartToSlot(added.next, at, 'checkbox-1', 'leading'), at)!.parts[0].slot).toBe('leading');
    expect(movePartToSlot(added.next, at, 'checkbox-1', 'meta')).toBe(added.next);
  });

  // A place only means anything in the card's own space. Carrying a stale one into a row slot
  // would leave two disagreeing answers about where the part sits.
  it('drops a place when a part leaves the card’s own space', () => {
    const { bag, at } = oneCard();
    const added = addPart(bag, at, 'checkbox', 'body', { row: 0, col: 0, span: 2 });
    expect(findCard(added.next, at)!.parts[0].place).toBeDefined();
    const moved = movePartToSlot(added.next, at, 'checkbox-1', 'check');
    expect(findCard(moved, at)!.parts[0].place).toBeUndefined();
  });

  it('places a part on the body grid, and refuses one that is not in the body', () => {
    const { bag, at } = oneCard();
    const added = addPart(bag, at, 'button', 'body');
    const placed = movePartToCell(added.next, at, 'button-1', { row: 0, col: 0, insert: true });
    expect(findCard(placed, at)!.parts[0].place).toEqual({ row: 0, col: 0, span: 4 });

    const inRow = addPart(bag, at, 'checkbox', 'check');
    expect(movePartToCell(inRow.next, at, 'checkbox-1', { row: 0, col: 0, insert: true })).toBe(inRow.next);
  });
});
