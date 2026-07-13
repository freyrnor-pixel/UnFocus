/**
 * feedbackMail.ts — builds the mailto: URL for the in-app "Send Feedback" card
 *
 * Pure string-building only (no native calls), so it's unit-testable without
 * mocking Linking/Share. app/settings.tsx does the actual Linking.openURL /
 * Share.share side effects with the URL this returns.
 *
 * Connections:
 *   Imports → (none)
 *   Used by → app/settings.tsx (Send Feedback card)
 *   Data    → none — pure function
 */

export interface FeedbackDeviceInfo {
  appVersion: string;
  runtimeVersion: string;
  platform: string;
  osVersion: string | number;
}

export function buildFeedbackMailUrl(
  message: string,
  info: FeedbackDeviceInfo,
  to: string,
  subject: string,
): string {
  const footer = `\n\n---\n${info.appVersion} · runtime ${info.runtimeVersion} · ${info.platform} ${info.osVersion}`;
  const body = encodeURIComponent(message.trim() + footer);
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${body}`;
}
