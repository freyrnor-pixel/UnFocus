/**
 * feedbackMail.test.ts — Tests for lib/feedbackMail.ts (mailto: URL builder).
 *
 * Verifies:
 * (a) basic URL shape (mailto:, to, subject, body all present)
 * (b) special characters (newlines, &, ?) in the message are percent-encoded
 * (c) the device-info footer is always appended
 */
import { buildFeedbackMailUrl, FeedbackDeviceInfo } from '@/lib/feedbackMail';

const INFO: FeedbackDeviceInfo = {
  appVersion: '1.3.0',
  runtimeVersion: '1.3.0',
  platform: 'ios',
  osVersion: '17.0',
};

describe('buildFeedbackMailUrl', () => {
  it('(a) builds a mailto URL with to, subject, and body', () => {
    const url = buildFeedbackMailUrl('Hello there', INFO, 'test@example.com', 'UnFocus feedback');
    expect(url).toMatch(/^mailto:test@example\.com\?subject=.+&body=.+$/);
    expect(url).toContain(encodeURIComponent('UnFocus feedback'));
  });

  it('(b) percent-encodes newlines, &, and ? in the message', () => {
    const url = buildFeedbackMailUrl('Line one\nLine two & more? things', INFO, 'a@b.com', 'Subj');
    expect(url).not.toContain('\n');
    expect(url).toContain('%0A');
    expect(url).toContain('%26');
    expect(url).toContain('%3F');
  });

  it('(c) always appends the app/runtime/platform footer', () => {
    const url = buildFeedbackMailUrl('  trimmed message  ', INFO, 'a@b.com', 'Subj');
    const decodedBody = decodeURIComponent(url.split('body=')[1]);
    expect(decodedBody).toBe('trimmed message\n\n---\n1.3.0 · runtime 1.3.0 · ios 17.0');
  });
});
