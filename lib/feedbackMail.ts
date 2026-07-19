/**
 * feedbackMail.ts — builds the mailto: URL for the in-app "Send Feedback" card
 *
 * Pure string-building only (no native calls), so it's unit-testable without
 * mocking Linking/Share. app/settings.tsx does the actual Linking.openURL /
 * Share.share side effects with the URL this returns.
 *
 * Connections:
 *   Imports → (none)
 *   Used by → app/settings.tsx (Send Feedback card), components/ScreenHeader.tsx
 *             (debug-mode "email all notes" button, via buildDebugNotesMailUrl)
 *   Data    → none — pure functions
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

/**
 * Formats all debug feedback notes into a single plain-text message. Shared by the
 * email builder below and the header's Share-sheet fallback so both send identical
 * bodies. Each note becomes `<label> (<screen>)` then its text, blank-line separated.
 */
export function formatDebugNotesMessage(
  notes: { anchorLabel: string; screen: string; note: string }[],
  heading: string,
): string {
  const lines = [heading, ''];
  for (const n of notes) lines.push(`${n.anchorLabel} (${n.screen})`, n.note, '');
  return lines.join('\n').trim();
}

/**
 * Builds the mailto: URL that emails every debug note. Reuses buildFeedbackMailUrl so
 * the app/runtime/platform footer is appended exactly like the Send Feedback card.
 */
export function buildDebugNotesMailUrl(
  notes: { anchorLabel: string; screen: string; note: string }[],
  info: FeedbackDeviceInfo,
  to: string,
  subject: string,
  heading: string,
): string {
  return buildFeedbackMailUrl(formatDebugNotesMessage(notes, heading), info, to, subject);
}
