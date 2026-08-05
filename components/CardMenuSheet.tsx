/**
 * CardMenuSheet.tsx — the per-card "⋮" settings sheet, scoped to ONE card.
 *
 * The design project (`UnFocus_Design_System_1.mht`, component `surfaces/CardMenuSheet`) names
 * this as *"the one component in this project with no direct counterpart in the app… a real,
 * un-filled gap rather than a stale spec"* — and it was the one component the sixteen
 * `DESIGN_COMPARISON/` task files never covered, so none of PRs #486–#491 built it. Its brief:
 * *"Cards get a '⋮' in their header instead of a nested settings sub-page. It opens
 * CardMenuSheet, scoped to that one card: toggles, chevron rows to pickers, show/hide,
 * add/remove, delete, plus an optional 'Rediger kort' row that hands off to drag-handle
 * reorder mode."*
 *
 * Two exports, deliberately in one file: `CardMenuButton` (the ⋮ itself, which owns the
 * open/closed state) and the sheet it opens. A card header therefore mounts ONE node and
 * threads no visibility state of its own — the point of the sheet is that a card's settings
 * cost the card nothing but a menu description.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet (the shared sheet shell — real exit animation,
 *             Decision 044b), components/PressableScale, components/Surface, constants/theme,
 *             lib/haptics, lib/i18n, lib/useAppTheme
 *   Used by → components/HomeNotesCard.tsx, components/HomeHabitsCard.tsx,
 *             components/HomeShoppingCard.tsx, components/PlanTaskCard.tsx (each renders a
 *             CardMenuButton in its header when Home passes it a `cardMenu`). The menus
 *             themselves are BUILT in app/(tabs)/index.tsx — see below.
 *   Data    → none. This component writes nothing: every row is a label plus an `onPress` the
 *             caller owns, exactly like components/SendToSheet.tsx. Whoever builds the option
 *             list owns the write.
 *
 * Edit notes:
 *   - **The menu is built by whoever owns the state it changes, not by the card.** Home's four
 *     cards can't hide themselves or start reorder mode — `settings.homeCardOrder` and the
 *     `cardsEditMode` flag both live in app/(tabs)/index.tsx — so Home builds the `CardMenu`
 *     and passes it down as one optional prop. A card that is handed no `cardMenu` (the To-do
 *     tab's own PlanTaskCard mount) simply draws no ⋮. Don't invert this and give the cards
 *     store access to build their own rows.
 *   - **Row vocabulary is fixed on purpose**: label + icon, an optional right-hand `value` (a
 *     toggle's on/off, a picker's current choice), an optional `chevron` (this row opens
 *     something), an optional one-line `hint`, `danger`, `disabled`. There is deliberately NO
 *     "render whatever you like" escape hatch — the moment one exists the sheet stops being a
 *     shared shape and becomes four bespoke sheets sharing a shell. A control that doesn't fit
 *     the vocabulary (a multi-select chip row, a stepper) belongs behind a `chevron` row in its
 *     own sheet, which is why components/ListSettingsSheet.tsx is NOT built on this — see the
 *     note at the end of this block.
 *   - **`onEditLayout` is the documented hand-off, not a second reorder implementation.** It
 *     renders the trailing "Rediger kort" row and should switch on the reorder mode that
 *     already exists (components/HomeCardManager.tsx's `editMode`), never start a drag of its
 *     own. It is optional — only a card that lives in a reorderable stack shows the row.
 *   - **No "delete" row on Home, by design.** The brief lists delete among the row shapes and
 *     `danger` implements it, but a Home card is HIDDEN (dropped from `settings.homeCardOrder`)
 *     and never deleted: its screen, its rows and its reminders are all untouched. Calling that
 *     "delete" would be the one thing in this sheet that lies about what it does.
 *   - Applies immediately on tap, like every other sheet in the app (LayoutPickerSheet's own
 *     note). The trailing button is a dismiss, not a commit. A row that opens something else
 *     should close this sheet first — two stacked sheets both dim the screen.
 *   - **Why components/ListSettingsSheet.tsx was left alone.** It is the closest existing
 *     ad-hoc instance of this shape (WeekListCard's `ellipsis-vertical` kebab opens it) and the
 *     design project's claim that the repo "has the shape ad-hoc in a couple of places but no
 *     shared component" is fair. But only its first control is a menu row: the second is a
 *     four-chip multi-select for which weeks a list repeats on, which this vocabulary can't
 *     express. Converting it would mean either adding the escape hatch above, or pushing the
 *     week chips behind a chevron row into a third sheet — turning a zero-tap control into a
 *     two-tap one. Neither is worth it for one caller, so it stays as it is; if a second
 *     list-settings surface ever appears, revisit it then.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { Fonts, FontSize, HitSlop, MIN_TAP_TARGET, Radius, Spacing, rgba } from '@/constants/theme';
import { selection, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

/** One row of a card's menu. See the "Row vocabulary is fixed" edit note before adding a field. */
export type CardMenuOption = {
  /** Stable list key. */
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Right-hand value — a toggle's on/off, a picker's current choice. */
  value?: string;
  /** Trailing chevron: this row opens something rather than applying in place. */
  chevron?: boolean;
  /** Destructive tint. Nothing on Home uses it — a Home card is hidden, never deleted. */
  danger?: boolean;
  /** One line under the label, for a row whose consequence isn't obvious from four words. */
  hint?: string;
  /** Greyed and inert, but still listed — a row that vanishes is a row the user can't learn. */
  disabled?: boolean;
  onPress: () => void;
};

/** What a card needs to draw its ⋮: the rows, plus the optional reorder hand-off. */
export type CardMenu = {
  options: CardMenuOption[];
  /** Renders the trailing "Rediger kort" row; omit for a card that isn't in a reorderable stack. */
  onEditLayout?: () => void;
};

type SheetProps = CardMenu & {
  open: boolean;
  onClose: () => void;
  /** The card this menu belongs to — its own title, so the sheet says what it is scoped to. */
  cardTitle: string;
};

export default function CardMenuSheet({ open, onClose, cardTitle, options, onEditLayout }: SheetProps) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  function pick(option: CardMenuOption) {
    if (option.disabled) return;
    selection();
    option.onPress();
  }

  return (
    <AnimatedBottomSheet visible={open} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {cardTitle}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t.home.cardMenu.subtitle}</Text>

        {options.map((option) => {
          const ink = option.danger ? theme.bad : theme.text;
          const glyph = option.danger ? theme.bad : theme.accent;
          return (
            <PressableScale
              key={option.key}
              style={[
                styles.option,
                {
                  borderColor: option.danger ? rgba(theme.bad, 0.4) : theme.border,
                  backgroundColor: option.danger ? theme.badSoft : theme.surfaceMuted,
                },
                option.disabled && styles.optionDisabled,
              ]}
              onPress={() => pick(option)}
              disabled={option.disabled}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!option.disabled }}
              accessibilityLabel={option.value ? `${option.label}: ${option.value}` : option.label}
              accessibilityHint={option.hint}
            >
              <Ionicons name={option.icon} size={20} color={option.disabled ? theme.textMuted : glyph} />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: option.disabled ? theme.textMuted : ink }]}>
                  {option.label}
                </Text>
                {option.hint ? (
                  <Text style={[styles.optionHint, { color: theme.textMuted }]}>{option.hint}</Text>
                ) : null}
              </View>
              {option.value ? (
                <Text style={[styles.optionValue, { color: theme.textMuted }]} numberOfLines={1}>
                  {option.value}
                </Text>
              ) : null}
              {option.chevron ? (
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              ) : null}
            </PressableScale>
          );
        })}

        {/* The hand-off row: it starts the reorder mode components/HomeCardManager.tsx already
            owns, rather than a second drag path. Separated by a rule so it reads as "and now
            leave this card" rather than as a fifth thing about this card. */}
        {onEditLayout ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <PressableScale
              style={[styles.option, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
              onPress={() => {
                selection();
                onEditLayout();
              }}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={t.home.manageCards.edit}
              accessibilityHint={t.home.cardMenu.arrangeHint}
            >
              <Ionicons name="swap-vertical-outline" size={20} color={theme.accent} />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{t.home.manageCards.edit}</Text>
                <Text style={[styles.optionHint, { color: theme.textMuted }]}>
                  {t.home.cardMenu.arrangeHint}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </PressableScale>
          </>
        ) : null}

        <PressableScale
          style={[styles.doneBtn, { backgroundColor: theme.accent }]}
          onPress={onClose}
          scaleTo={0.95}
        >
          <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.home.cardMenu.close}</Text>
        </PressableScale>
      </Surface>
    </AnimatedBottomSheet>
  );
}

/**
 * The ⋮ itself. Owns the sheet's open state so a card header is one node and no `useState`.
 *
 * A bare glyph rather than a components/IconButton keycap: it sits in a header that already
 * carries a 32px identity badge, a count pill and (on Notes) a mic button, and a fifth plated
 * control there is exactly the horizontal pressure `npm run wraps`'s clipped-controls mode
 * exists to catch. `HitSlop.base` lifts the 28px box to target without costing layout width.
 */
export function CardMenuButton({ cardTitle, options, onEditLayout }: CardMenu & { cardTitle: string }) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PressableScale
        style={styles.kebab}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        hitSlop={HitSlop.base}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={t.home.cardMenu.open(cardTitle)}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} />
      </PressableScale>
      <CardMenuSheet
        open={open}
        onClose={() => setOpen(false)}
        cardTitle={cardTitle}
        options={options}
        onEditLayout={onEditLayout}
      />
    </>
  );
}

const baseStyles = StyleSheet.create({
  // Geometry copied from components/LayoutPickerSheet.tsx on purpose — the app's bottom sheets
  // are one shape, and SendToSheet/EnergyPauseSheet/EnergyConfigSheet already share it.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  subtitle: { fontSize: FontSize.xs, fontFamily: Fonts.regular, marginTop: -Spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
  },
  optionDisabled: { opacity: 0.5 },
  // flex + minWidth: 0 so a long Norwegian label yields to the value/chevron instead of
  // shoving them off the row — the shape AGENTS.md's wrap-audit notes call for.
  optionText: { flex: 1, minWidth: 0, gap: 2 },
  optionLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  optionHint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  optionValue: { flexShrink: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  doneBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  kebab: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
