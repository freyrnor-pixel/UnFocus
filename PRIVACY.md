# Privacy Policy — UnFocus

> ⚠️ **DRAFT — needs your review and a public URL before the Play Console listing.**
> Google Play requires a privacy policy reachable at a public link (GitHub Pages, a
> Netlify page, or the repo's raw file all qualify). This draft was written against
> what the code actually does — every claim below was verified in the source, not
> assumed — but it is not legal advice, and you should read it as the person who is
> accountable for it. Update the "Last updated" line and the contact address.

**Last updated:** 2026-08-15

## The short version

UnFocus stores everything on your device and sends none of it anywhere. There is no
account, no server, no analytics, and no advertising. Nobody — including the developer
— can see what you put into this app.

## What UnFocus stores

Everything you enter lives in a single SQLite database file (`unfocus.db`) in the app's
private storage on your device:

- Tasks, plans, steps, goals and notes
- Habits and their daily logs
- Health entries — symptoms, severity, ongoing episodes and any notes you attach
- Medicines, doses and the times you took them
- Shopping lists, purchases, prices and receipt scans
- App settings and appearance preferences

**Health and medicine entries are the most sensitive data in the app.** They are treated
exactly like everything else: stored locally, never transmitted, and never included in
the app's AI setup guide export, which refuses that data by design.

## What UnFocus sends over the internet

**Nothing you enter.** The app makes no calls to any analytics, advertising, crash
reporting, or backend service. There is no such service to call.

The only internet traffic the app generates is to Expo's update service
(`u.expo.dev`), which checks whether a newer version of the app's code is available
and downloads it. That request carries the app's version and platform. It carries none
of your data.

## Device permissions, and why each one exists

Every permission is used only for the feature it names, only while you are using it,
and the data stays on the device:

| Permission | Used for |
|---|---|
| Microphone | Voice notes — transcribed on your device |
| Camera / Photos | Scanning receipts — text recognition runs on your device |
| Location | Location-based reminders — a one-time position, no tracking, no history |
| Calendar | Reading events so they show on your day timeline; writing a task you choose to add |
| Contacts | Attaching a name and phone number to a task, when you pick one |
| Alarms & reminders | Delivering reminders at the time you set them |
| Local network | Syncing directly with another device you have paired, over your own Wi-Fi |

You can decline any of these. The app works without them; only the matching feature
stops working.

## Syncing between your own devices

If you pair two devices, they exchange data **directly over your local Wi-Fi network**.
The data never passes through a server and never leaves your network. Pairing is
something you set up deliberately; it is off until you do.

## Sharing your own data

The app can export your data — backups, receipts, the AI setup guide — through your
device's normal share sheet. Where that data then goes is your choice and is governed
by whichever app you send it to. The AI setup guide deliberately excludes health-log
data and medicines.

## Children

UnFocus is not directed at children. It has a family mode for organising a household's
tasks, but this only creates labels on your own device; it collects nothing about
anyone.

## Data retention and deletion

Dated history older than 365 days is trimmed automatically. You can delete any entry at
any time, and Settings offers a full reset. **Uninstalling the app deletes everything**
— there is no copy anywhere else to request the deletion of.

## Changes to this policy

If this policy changes, the updated version will be published at this address with a
new "Last updated" date.

## Contact

Questions about this policy: **freyr.hlynsson@outlook.com**
