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
 *
 * Edit notes:
 *   - The footer carries the build COMMIT (`constants/buildInfo.ts`) as well as the version,
 *     and `FeedbackDeviceInfo.commit` is required so tsc names every construction site. Every
 *     build for weeks reads "1.7.0 · runtime 1.7.0"; the commit is the only field here that
 *     tells two OTAs apart, which is the whole point of the footer.
 */

export interface FeedbackDeviceInfo {
  appVersion: string;
  runtimeVersion: string;
  platform: string;
  osVersion: string | number;
  /**
   * Short commit the running JS was built from (`constants/buildInfo.ts`'s `shortCommit()`),
   * or `'development'` on an unstamped local build.
   *
   * ⚠️ **Required, not optional, on purpose.** A feedback mail whose footer says only
   * `1.7.0 · runtime 1.7.0` cannot be acted on — every version of the app for weeks says
   * exactly that, and the OTA id shown in Settings maps to no commit. Making it required
   * means tsc names every construction site if a third one is ever added.
   */
  commit: string;
}

export function buildFeedbackMailUrl(
  message: string,
  info: FeedbackDeviceInfo,
  to: string,
  subject: string,
): string {
  const footer = `\n\n---\n${info.appVersion} · runtime ${info.runtimeVersion} · ${info.commit} · ${info.platform} ${info.osVersion}`;
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
