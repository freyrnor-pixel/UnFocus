/**
 * designLabEdit.ts — every write the design lab's playground makes, as a pure function.
 *
 * One shape throughout: `(bag, …args) => bag`. The screen holds a draft `LabOverrides`, calls
 * one of these, and commits whatever comes back — so the screen owns *when* to write and this
 * module owns *what* the write is. That split is what keeps `app/design-lab/index.tsx` from
 * becoming another thousand-line file, and it is what makes the playground testable at all:
 * the gestures that drive these are unreachable in the web preview, but "add a card to this
 * screen" is arithmetic on a value.
 *
 * **A no-op returns the SAME bag reference.** Every operation here can be asked for something
 * impossible — an id that no longer exists, a cap already reached, a kind that cannot take the
 * slot it was dropped on. None of them throw and none of them half-apply; they hand back the
 * bag they were given. That makes "the button did nothing" an assertion a test can make, and
 * it lets the screen skip a guard clause before every call.
 *
 * Connections:
 *   Imports → lib/designLab (the model, the caps, SLOTS_FOR_KIND, CARD_SKELETONS, clampPlace),
 *             lib/designLabPlace (normalizePlacements, placePart)
 *   Used by → app/design-lab/index.tsx, lib/__tests__/designLabEdit.test.ts
 *   Data    → none. Pure functions; the caller persists the result.
 *
 * Edit notes:
 *   - **Dependency-free**, like the two modules it imports — `lib/__tests__/designLab.test.ts`'s
 *     import-graph scan covers this file. No store, no lib/db, no notifications.
 *   - **Minted ids are deterministic given what already exists**, never random and never
 *     timestamped, so a test can assert them and two runs of the same edits agree.
 *   - **`duplicateCard` mints fresh PART ids as well as a fresh card id.** Sharing them would
 *     make the export's `moved`-vs-`added` tracking read one card's edits onto another's — the
 *     subtlest way to make a report lie, and the reason that function is not three lines.
 */
import {
  CARD_SKELETONS,
  MAX_CARDS_PER_SCREEN,
  MAX_CARD_TITLE,
  MAX_PARTS_PER_CARD,
  MAX_PART_LABEL,
  MAX_SCREENS,
  MAX_SCREEN_TITLE,
  SLOTS_FOR_KIND,
  cardKnob,
  isPlaceableSlot,
  type CardId,
  type CardOrigin,
  type CardPart,
  type LabOverrides,
  type PartKind,
  type PartPlace,
  type PartSlot,
  type PlaygroundCard,
  type PlaygroundCardId,
  type ScreenId,
  type ScreenSpec,
} from '@/lib/designLab';
import { normalizePlacements, placePart, type BodyCell } from '@/lib/designLabPlace';

/** Which card an operation is about. */
export type CardRef = { screenId: ScreenId; cardId: PlaygroundCardId };

// ── Minting ──────────────────────────────────────────────────────────────────

/** The first `prefix-n` not already taken. Deterministic, so a test can name the result. */
function mint(prefix: string, taken: Set<string>): string {
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

export function mintScreenId(existing: readonly ScreenSpec[]): ScreenId {
  return mint('screen', new Set(existing.map((s) => s.id)));
}

export function mintCardId(screen: ScreenSpec): PlaygroundCardId {
  return mint('card', new Set(screen.cards.map((c) => c.id)));
}

export function mintPartId(parts: readonly CardPart[], kind: PartKind): string {
  return mint(kind, new Set(parts.map((p) => p.id)));
}

// ── Walking the bag ──────────────────────────────────────────────────────────

/** `bag` with one screen replaced by `fn`'s answer, or `bag` itself when nothing changed. */
function mapScreen(
  bag: LabOverrides,
  screenId: ScreenId,
  fn: (screen: ScreenSpec) => ScreenSpec | null,
): LabOverrides {
  const index = bag.playground.screens.findIndex((s) => s.id === screenId);
  if (index < 0) return bag;
  const next = fn(bag.playground.screens[index]);
  if (!next || next === bag.playground.screens[index]) return bag;
  const screens = bag.playground.screens.slice();
  screens[index] = next;
  return { ...bag, playground: { ...bag.playground, screens } };
}

/** The same, one level down. */
function mapCard(
  bag: LabOverrides,
  at: CardRef,
  fn: (card: PlaygroundCard) => PlaygroundCard | null,
): LabOverrides {
  return mapScreen(bag, at.screenId, (screen) => {
    const index = screen.cards.findIndex((c) => c.id === at.cardId);
    if (index < 0) return null;
    const next = fn(screen.cards[index]);
    if (!next || next === screen.cards[index]) return null;
    const cards = screen.cards.slice();
    cards[index] = next;
    return { ...screen, cards };
  });
}

/** The card an operation names, or `null`. */
export function findCard(bag: LabOverrides, at: CardRef): PlaygroundCard | null {
  const screen = bag.playground.screens.find((s) => s.id === at.screenId);
  return screen?.cards.find((c) => c.id === at.cardId) ?? null;
}

/** The screen standing in for a real one, if it has been made yet. */
export function findScreenFor(bag: LabOverrides, screen: string): ScreenSpec | null {
  return bag.playground.screens.find((s) => s.screen === screen) ?? null;
}

// ── Screens ──────────────────────────────────────────────────────────────────

/** A new blank screen standing in for `screen` (a lib/screenColor key). No-op at the cap. */
export function addScreen(bag: LabOverrides, screen: string): { next: LabOverrides; screenId: ScreenId | null } {
  const screens = bag.playground.screens;
  if (screens.length >= MAX_SCREENS) return { next: bag, screenId: null };
  const id = mintScreenId(screens);
  const made: ScreenSpec = { id, screen, title: '', cards: [], note: '' };
  return {
    next: { ...bag, playground: { ...bag.playground, screens: [...screens, made] } },
    screenId: id,
  };
}

export function removeScreen(bag: LabOverrides, id: ScreenId): LabOverrides {
  const screens = bag.playground.screens.filter((s) => s.id !== id);
  if (screens.length === bag.playground.screens.length) return bag;
  return { ...bag, playground: { ...bag.playground, screens } };
}

export function renameScreen(bag: LabOverrides, id: ScreenId, title: string): LabOverrides {
  return mapScreen(bag, id, (screen) => ({ ...screen, title: title.slice(0, MAX_SCREEN_TITLE) }));
}

export function noteScreen(bag: LabOverrides, id: ScreenId, note: string): LabOverrides {
  return mapScreen(bag, id, (screen) => ({ ...screen, note }));
}

/** Screens in the given order. Ids not named keep their relative places at the end. */
export function reorderScreens(bag: LabOverrides, orderedIds: ScreenId[]): LabOverrides {
  const byId = new Map(bag.playground.screens.map((s) => [s.id, s]));
  const named = orderedIds.map((id) => byId.get(id)).filter((s): s is ScreenSpec => !!s);
  const rest = bag.playground.screens.filter((s) => !orderedIds.includes(s.id));
  const screens = [...named, ...rest];
  if (screens.length !== bag.playground.screens.length) return bag;
  return { ...bag, playground: { ...bag.playground, screens } };
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** The parts a card starts with: a skeleton's, a real card's, or none. */
function startingParts(origin: CardOrigin): CardPart[] {
  const skeleton = CARD_SKELETONS.find((s) => s.origin === origin);
  if (skeleton) return skeleton.parts.map((p) => ({ ...p }));
  const knob = cardKnob(origin as CardId);
  return knob ? knob.defaultParts.map((p) => ({ ...p })) : [];
}

export function addCard(
  bag: LabOverrides,
  screenId: ScreenId,
  origin: CardOrigin,
): { next: LabOverrides; cardId: PlaygroundCardId | null } {
  const screen = bag.playground.screens.find((s) => s.id === screenId);
  if (!screen || screen.cards.length >= MAX_CARDS_PER_SCREEN) return { next: bag, cardId: null };
  const id = mintCardId(screen);
  const made: PlaygroundCard = { id, origin, title: '', parts: startingParts(origin), note: '' };
  return {
    next: mapScreen(bag, screenId, (s) => ({ ...s, cards: [...s.cards, made] })),
    cardId: id,
  };
}

export function removeCard(bag: LabOverrides, at: CardRef): LabOverrides {
  return mapScreen(bag, at.screenId, (screen) => {
    const cards = screen.cards.filter((c) => c.id !== at.cardId);
    return cards.length === screen.cards.length ? null : { ...screen, cards };
  });
}

/**
 * A copy of the card, straight after it on the same screen.
 *
 * Every PART gets a fresh id too. Sharing them would let the export match one card's part
 * against the other's when it computes `moved` versus `added` — the copy would read as an edit
 * of the original rather than as a second card.
 */
export function duplicateCard(bag: LabOverrides, at: CardRef): { next: LabOverrides; cardId: PlaygroundCardId | null } {
  const screen = bag.playground.screens.find((s) => s.id === at.screenId);
  const source = screen?.cards.find((c) => c.id === at.cardId);
  if (!screen || !source || screen.cards.length >= MAX_CARDS_PER_SCREEN) return { next: bag, cardId: null };

  const id = mintCardId(screen);
  const parts: CardPart[] = [];
  for (const part of source.parts) parts.push({ ...part, id: mintPartId(parts, part.kind) });
  const copy: PlaygroundCard = { ...source, id, parts };

  const index = screen.cards.findIndex((c) => c.id === at.cardId);
  const cards = screen.cards.slice();
  cards.splice(index + 1, 0, copy);
  return { next: mapScreen(bag, at.screenId, (s) => ({ ...s, cards })), cardId: id };
}

export function reorderCards(bag: LabOverrides, screenId: ScreenId, orderedIds: PlaygroundCardId[]): LabOverrides {
  return mapScreen(bag, screenId, (screen) => {
    const byId = new Map(screen.cards.map((c) => [c.id, c]));
    const named = orderedIds.map((id) => byId.get(id)).filter((c): c is PlaygroundCard => !!c);
    const rest = screen.cards.filter((c) => !orderedIds.includes(c.id));
    const cards = [...named, ...rest];
    return cards.length === screen.cards.length ? { ...screen, cards } : null;
  });
}

export function updateCard(
  bag: LabOverrides,
  at: CardRef,
  patch: Partial<Pick<PlaygroundCard, 'title' | 'note' | 'origin'>>,
): LabOverrides {
  return mapCard(bag, at, (card) => ({
    ...card,
    ...patch,
    title: patch.title !== undefined ? patch.title.slice(0, MAX_CARD_TITLE) : card.title,
  }));
}

// ── Parts ────────────────────────────────────────────────────────────────────

/**
 * A new part on the card, at `slot` if it is legal for that kind and its default slot if not.
 *
 * Returns the minted id so the screen can select what it just made — adding something you
 * then have to hunt for is the shape of the flow this rebuild exists to remove.
 */
export function addPart(
  bag: LabOverrides,
  at: CardRef,
  kind: PartKind,
  slot?: PartSlot,
  place?: PartPlace,
): { next: LabOverrides; partId: string | null } {
  const card = findCard(bag, at);
  if (!card || card.parts.length >= MAX_PARTS_PER_CARD) return { next: bag, partId: null };

  const legal = SLOTS_FOR_KIND[kind];
  const target = slot && legal.includes(slot) ? slot : legal[0];
  if (!target) return { next: bag, partId: null };

  const id = mintPartId(card.parts, kind);
  const made: CardPart = { id, kind, slot: target, label: '', color: '', size: 'sm', weight: 'regular' };
  if (place && isPlaceableSlot(target)) made.place = place;

  return {
    next: mapCard(bag, at, (c) => ({ ...c, parts: normalizePlacements([...c.parts, made]) })),
    partId: id,
  };
}

/** The part replaced wholesale. An illegal kind/slot pair is refused rather than half-applied. */
export function updatePart(bag: LabOverrides, at: CardRef, part: CardPart): LabOverrides {
  if (!SLOTS_FOR_KIND[part.kind]?.includes(part.slot)) return bag;
  const trimmed: CardPart = { ...part, label: part.label.slice(0, MAX_PART_LABEL) };
  // A place only means anything in the card's own space; carrying a stale one into a row slot
  // would leave two disagreeing answers about where the part sits.
  if (!isPlaceableSlot(trimmed.slot)) delete trimmed.place;
  return mapCard(bag, at, (card) => {
    const index = card.parts.findIndex((p) => p.id === part.id);
    if (index < 0) return null;
    const parts = card.parts.slice();
    parts[index] = trimmed;
    return { ...card, parts: normalizePlacements(parts) };
  });
}

export function removePart(bag: LabOverrides, at: CardRef, partId: string): LabOverrides {
  return mapCard(bag, at, (card) => {
    const parts = card.parts.filter((p) => p.id !== partId);
    return parts.length === card.parts.length ? null : { ...card, parts: normalizePlacements(parts) };
  });
}

/** Move a part to another position in the row's anatomy. Refused when the kind cannot take it. */
export function movePartToSlot(bag: LabOverrides, at: CardRef, partId: string, slot: PartSlot): LabOverrides {
  const card = findCard(bag, at);
  const part = card?.parts.find((p) => p.id === partId);
  if (!part || !SLOTS_FOR_KIND[part.kind].includes(slot)) return bag;
  const next: CardPart = { ...part, slot };
  if (!isPlaceableSlot(slot)) delete next.place;
  return updatePart(bag, at, next);
}

/** Move a part to a grid cell in the card's own space. */
export function movePartToCell(bag: LabOverrides, at: CardRef, partId: string, cell: BodyCell): LabOverrides {
  const card = findCard(bag, at);
  const part = card?.parts.find((p) => p.id === partId);
  if (!card || !part) return bag;
  if (!isPlaceableSlot(part.slot)) return bag;
  const parts = placePart(card.parts, partId, cell);
  if (parts === card.parts) return bag;
  return mapCard(bag, at, (c) => ({ ...c, parts }));
}
