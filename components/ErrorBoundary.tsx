/**
 * ErrorBoundary.tsx — catches a render-time crash in its child tree and shows a
 * recoverable fallback instead of taking the whole app down with it.
 *
 * Added 2026-07-26 after a user report: opening the Catalogue screen crashed the
 * app outright on Android, every time, with no error visible anywhere (no crash
 * reporting SDK is wired into this app — see docs/archive/AGENTS_HISTORY.md's "Known gotchas"). An
 * uncaught exception thrown during React's render phase is the one failure mode
 * that matches "freezes, then the app closes" on a completely ordinary-sized
 * dataset — that's React Native's default fatal-JS-exception handler, which this
 * component now intercepts for the Catalogue screen (see app/catalogue.tsx).
 *
 * This is deliberately NOT a fix for the underlying crash — nobody has yet seen
 * the actual thrown error, since production builds don't surface one. It exists
 * so (1) the screen degrades to a recoverable card instead of killing the app,
 * and (2) the caught error's message + component stack render on screen, so the
 * next time this fires on a real device, whatever's wrong is finally visible
 * instead of invisible.
 *
 * Connections:
 *   Imports → lib/i18n, lib/useAppTheme, components/PressableScale
 *   Used by → app/catalogue.tsx (wraps CatalogueTab)
 *   Data    → none
 *
 * Edit notes:
 *   - Only catches errors thrown during render/lifecycle of its children (React's
 *     error-boundary contract) — NOT errors in async callbacks, event handlers, or
 *     a genuine native-side crash outside the JS thread. If the real bug turns out
 *     to be one of those, this boundary won't catch it and the crash will still
 *     need a device-side log to diagnose.
 *   - `onReset` re-mounts the children by bumping a key, so "Try again" doesn't
 *     require leaving the screen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PressableScale from '@/components/PressableScale';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { Fonts, FontSize, glassKey, Radius, Spacing } from '@/constants/theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string | null };

class ErrorBoundaryClass extends React.Component<Props & { theme: ReturnType<typeof useAppTheme>; isDark: boolean; t: ReturnType<typeof useT> }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Best-effort visibility only — no crash-reporting SDK is wired into this app yet.
    console.error('ErrorBoundary caught:', error, info.componentStack);
    this.setState({ info: info.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const { theme, isDark, t } = this.props;
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>{t.errorBoundaryTitle}</Text>
        <Text style={[styles.message, { color: theme.textMuted }]} selectable>
          {error.message}
          {info ? `\n${info}` : ''}
        </Text>
        <PressableScale
          style={[styles.retryBtn, glassKey(theme.accent, isDark)]}
          onPress={() => this.setState({ error: null, info: null })}
          accessibilityRole="button"
          accessibilityLabel={t.errorBoundaryRetry}
        >
          <Text style={[styles.retryText, { color: theme.text }]}>{t.errorBoundaryRetry}</Text>
        </PressableScale>
      </View>
    );
  }
}

/** Function-component wrapper so callers don't need to thread theme/t through props themselves. */
export default function ErrorBoundary({ children }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  return (
    <ErrorBoundaryClass theme={theme} isDark={isDark} t={t}>
      {children}
    </ErrorBoundaryClass>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, textAlign: 'center' },
  message: { fontSize: FontSize.xs, textAlign: 'left', maxHeight: 260 },
  retryBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.md },
  retryText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
