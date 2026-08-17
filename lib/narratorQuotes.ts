/**
 * narratorQuotes.ts — the anti-shame narrator's lines, by domain (2026-08-19).
 *
 * What an empty surface says once the placeholder is gone. `Ingen oppgaver` / `Tom liste`
 * states a fact the user can already see and, on a bad day, reads as a verdict on it — so
 * every one of those is replaced by a line from here (components/NarratorQuote.tsx renders
 * them; that file owns the presentation and this one owns the words).
 *
 * Connections:
 *   Imports → lib/i18n (the `Lang` union only — no dictionary, no `useT`)
 *   Used by → components/NarratorQuote.tsx (the only consumer; every screen goes through it)
 *   Data    → none. Pure data + two pure selectors, like lib/goalStarters.ts and
 *             lib/habitStarters.ts. No store, no DB, no notifications.
 *
 * Edit notes:
 *   - **This is the app's SECOND first-person voice, and the first one that is a system.**
 *     `t.dayLog.empty` was the one exception VOICE.md recorded, under an explicit "one line,
 *     there is not a second" limit. This reverses that limit on maintainer instruction — see
 *     VOICE.md, which now records both halves. It does NOT reverse the rest of rule 22: every
 *     *instruction* and *label* in the app stays second person. The narrator only ever speaks
 *     where there is nothing to instruct.
 *   - **It is bound by rule 23 (no guilt, no urgency, no judgment) more tightly than the rest
 *     of the app, not less.** A joke about the user's memory told by an app is a verdict; the
 *     same joke told about the narrator's own is company. So the register is: the narrator
 *     admits things, the user is never told what they did. Two consequences worth stating
 *     because they are easy to lose in a rewrite —
 *       · Nothing here counts, compares, or notices a gap. No "still nothing here", no "day
 *         three", no line that reads differently on an emptier screen than a fuller one. The
 *         narrator cannot tell how long you have been looking at this.
 *       · Nothing here asks for anything. A quote is not a nudge with a joke on it; if a line
 *         can be reworded as "you should…", it is the wrong line.
 *     `lib/__tests__/narratorQuotes.test.ts` scans this file against copyTone's banned list
 *     and asserts both of those structurally.
 *   - **The forgetting stems are the one carve-out, and it is narrow.** `glem*` / `forgot` /
 *     `gleym*` are banned outright in lib/i18n.ts, because there they can only ever be aimed
 *     at the user. Two of this file's required lines are *about* forgetting — the narrator
 *     admitting it takes its own medicine unreliably, and the point that a task you did but
 *     never logged still got done. Both are the anti-shame content itself, so banning the word
 *     would ban the idea. The test allows the stem ONLY in the exact quote ids listed in its
 *     `FORGETTING_IS_THE_POINT` set: a ratchet, entries removable, never addable.
 *   - **Norwegian is the authored voice; EN and IS are renderings of it.** That is the repo's
 *     standing rule (VOICE.md) and it matters more here than anywhere, because the jokes are
 *     Norwegian jokes — "vibe-living", the lost ghost in the shop. Where a rendering cannot
 *     carry the joke it carries the POINT instead; a literal translation that is not funny in
 *     the target language is worse than a different line that is.
 *     This is deliberately NOT the "seed data stays Norwegian in every language" convention
 *     (lib/catalogSeed.ts): a grocery name is content the user reads past, and this is the app
 *     talking. Shipping an English user a Norwegian punchline is not a quirk, it is a bug.
 *   - **Every category needs at least MIN_QUOTES_PER_CATEGORY lines**, asserted by test. The
 *     cycle button walks the list in order and wraps, so a category of one is a button that
 *     visibly does nothing, and a category of two is a toggle.
 *   - Adding a line: write the Norwegian first, then EN, then IS, keeping the arrays the same
 *     LENGTH and the same ORDER — `quoteAt()` indexes by position, so a line and its
 *     translations must sit at the same index or the cycle shows a different joke per
 *     language. The test pins both.
 */
import type { Lang } from '@/lib/i18n';

/**
 * Which surface is empty. Deliberately its own small union rather than reusing
 * `LayoutSurface` (lib/cardLayout.ts) or `CardId` (lib/collapsedCards.ts): those name every
 * list-bearing surface in the app, and most of them will never be empty in a way worth
 * narrating. `general` is the fallback for a surface with no voice of its own — and for the
 * two categories the brief groups together, since a line about rest belongs to both Habits
 * and to nowhere in particular.
 */
export type NarratorCategory = 'todo' | 'shopping' | 'health' | 'habits' | 'general';

/** Every category, for tests and for anything that wants to iterate them. */
export const NARRATOR_CATEGORIES: readonly NarratorCategory[] = [
  'todo',
  'shopping',
  'health',
  'habits',
  'general',
] as const;

/**
 * The floor on how many lines a category carries. Three, not two: the cycle button wraps, so
 * two lines make it a toggle and one makes it inert — and an empty state is the surface a
 * user sees most often early on, which is exactly when a repeat reads as the app having one
 * joke.
 */
export const MIN_QUOTES_PER_CATEGORY = 3;

/**
 * The lines, per language, per category.
 *
 * Norwegian is the original. Read `no` when editing; the other two follow it.
 */
const QUOTES: Record<Lang, Record<NarratorCategory, readonly string[]>> = {
  no: {
    // Small steps. The joke the whole app is built on: the same instinct that makes you
    // describe a task to a machine in tiny pieces works on the task itself.
    todo: [
      'Å prompte en AI til å skrive kode er vibe-coding; å dele «Vaske opp» inn i «Åpne springen» er vibe-living.',
      'Et gjøremål som føles for stort er som regel to gjøremål som står for tett.',
      'Del det opp til det blir litt latterlig. Det er da det begynner å funke.',
      'Første steget kan gjerne være «finne fram tingen». Det teller.',
      // Deliberately NOT phrased as "nothing here is urgent": rule 23's Norwegian stem scan
      // bans `haster` outright, and a line that has to say the banned word to deny it is one
      // reword away from being a better line anyway.
      'Ingenting her krever noe av deg. Det ligger bare og venter.',
    ],
    // Meal planning as the thing the app exists to not do twice. Templates as the way out of
    // wandering the shop.
    shopping: [
      'Middagsplanlegging er så kjedelig at jeg heller vibe-codet en app enn å gjøre det to ganger.',
      'Lagre lista én gang, så slipper du å vandre rundt i butikken som et bortkommet spøkelse.',
      'En fast liste er ikke kjedelig. Den er tolv beslutninger du allerede har tatt.',
      'Du trenger ikke vite hva du skal ha til torsdag. Du trenger bare vite hva som er tomt.',
    ],
    // The narrator admits things; the user is never told what they did. See the header.
    health: [
      'Tok du medisinen, eller tenkte du bare veldig hardt på å ta den? (Ingen dom — min egen står fortsatt på benken.)',
      'Å ikke logge noe du faktisk gjorde, endrer ingenting. Det ble jo gjort.',
      'En tom logg er ikke en tom uke. Det er bare en tom logg.',
      'Kroppen fører ikke regnskap. Det gjør ikke denne lista heller.',
    ],
    // Rest is a choice. The tool is a tool.
    habits: [
      'UnFocus er et verktøy, ikke en soningsvakt.',
      'Hvile er et aktivt valg, ikke et frafall.',
      'En vane du tar opp igjen er den samme vanen. Den husker ikke pausen.',
      'Ingen streker som ryker her. Det er ikke den slags app.',
    ],
    general: [
      'UnFocus er et verktøy, ikke en soningsvakt.',
      'Hvile er et aktivt valg, ikke et frafall.',
      'Tomt er en helt gyldig tilstand.',
      'Ingenting her fører regnskap over deg.',
      'Du skylder ikke denne skjermen noe.',
    ],
  },
  en: {
    todo: [
      'Prompting an AI to write code is vibe-coding; splitting "Do the dishes" into "Turn on the tap" is vibe-living.',
      'A task that feels too big is usually two tasks standing too close together.',
      'Break it down until it feels slightly ridiculous. That is when it starts working.',
      'The first step is allowed to be "go and find the thing". It counts.',
      'Nothing here is asking anything of you. It is just sitting there.',
    ],
    shopping: [
      'Meal planning is so boring I vibe-coded an app rather than do it twice.',
      'Save the list once, and you never have to wander the shop like a lost ghost again.',
      'A saved list is not boring. It is twelve decisions you already made.',
      'You do not need to know what Thursday looks like. You need to know what ran out.',
    ],
    health: [
      'Did you take your meds, or think really hard about taking them? (No judgment — mine are still on the counter.)',
      'Not logging something you actually did changes nothing. It still got done.',
      'An empty log is not an empty week. It is an empty log.',
      'Your body keeps no ledger. Neither does this list.',
    ],
    habits: [
      'UnFocus is a tool, not a parole officer.',
      'Rest is an active choice, not a failure.',
      'A habit you pick up again is the same habit. It does not remember the gap.',
      'No streaks to break here. This is not that kind of app.',
    ],
    general: [
      'UnFocus is a tool, not a parole officer.',
      'Rest is an active choice, not a failure.',
      'Empty is a perfectly valid state.',
      'Nothing here keeps score on you.',
      'You owe this screen nothing.',
    ],
  },
  is: {
    todo: [
      'Að biðja gervigreind um að skrifa kóða er vibe-coding; að skipta „Vaska upp“ í „Skrúfa frá krananum“ er vibe-living.',
      'Verkefni sem virðist of stórt er yfirleitt tvö verkefni sem standa of þétt.',
      'Skiptu því niður þar til það verður örlítið kjánalegt. Þá fer það að virka.',
      'Fyrsta skrefið má alveg vera „finna hlutinn“. Það telur.',
      'Ekkert hér krefst neins af þér. Það bara bíður.',
    ],
    shopping: [
      'Matseðlagerð er svo leiðinleg að ég vibe-codaði frekar app en að gera hana tvisvar.',
      'Vistaðu listann einu sinni og þú þarft aldrei aftur að reika um búðina eins og villtur draugur.',
      'Vistaður listi er ekki leiðinlegur. Hann er tólf ákvarðanir sem þú tókst þegar.',
      'Þú þarft ekki að vita hvernig fimmtudagurinn lítur út. Þú þarft að vita hvað kláraðist.',
    ],
    health: [
      'Tókstu lyfin, eða hugsaðirðu bara mjög fast um að taka þau? (Enginn dómur — mín standa enn á borðinu.)',
      'Að skrá ekki eitthvað sem þú gerðir breytir engu. Það var samt gert.',
      'Tóm skrá er ekki tóm vika. Hún er bara tóm skrá.',
      'Líkaminn heldur ekkert bókhald. Þessi listi gerir það ekki heldur.',
    ],
    habits: [
      'UnFocus er verkfæri, ekki fangavörður.',
      'Hvíld er virkt val, ekki uppgjöf.',
      'Venja sem þú tekur upp aftur er sama venjan. Hún man ekki hléið.',
      'Engar keðjur til að slíta hér. Þetta er ekki þannig app.',
    ],
    general: [
      'UnFocus er verkfæri, ekki fangavörður.',
      'Hvíld er virkt val, ekki uppgjöf.',
      'Tómt er fullgilt ástand.',
      'Ekkert hér heldur stigatöflu yfir þér.',
      'Þú skuldar þessum skjá ekki neitt.',
    ],
  },
};

/**
 * Every line for one category, in the active language. Falls back to `general` for a category
 * that somehow has no lines — never to an empty array, so a caller can always index safely.
 */
export function narratorQuotes(category: NarratorCategory, lang: Lang): readonly string[] {
  const table = QUOTES[lang] ?? QUOTES.no;
  const lines = table[category];
  return lines && lines.length > 0 ? lines : table.general;
}

/**
 * The line at `index`, wrapping. This is the whole cycle mechanic: the component holds a
 * counter that only ever goes up, and the modulo here turns it into a loop — so "next" can
 * never run out, and nothing has to know the list's length at the call site.
 *
 * A non-finite or negative index resolves to the first line rather than throwing; this
 * renders on an empty screen, and a crash there is a far worse outcome than a repeated joke.
 */
export function quoteAt(category: NarratorCategory, lang: Lang, index: number): string {
  const lines = narratorQuotes(category, lang);
  if (!Number.isFinite(index)) return lines[0];
  const i = Math.trunc(index) % lines.length;
  return lines[i < 0 ? i + lines.length : i];
}

/**
 * A starting index for a fresh mount. Random so two empty cards on one screen (Home shows
 * several at once) do not open on the same line — not persisted, because a quote the user has
 * already read is not a state worth storing, and because a line that follows you between
 * launches starts to read as a message aimed at you.
 */
export function randomQuoteIndex(category: NarratorCategory, lang: Lang): number {
  return Math.floor(Math.random() * narratorQuotes(category, lang).length);
}
