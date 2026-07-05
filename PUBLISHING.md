# PUBLISHING.md — how a change actually reaches users

> TL;DR: **A change is only live once it is merged to `main`.** Pushing a
> `claude/**` branch publishes **nothing**. This is the single most common
> "why isn't my fix showing up?" mistake — check this file first.

## Why

The OTA update workflow `.github/workflows/update.yml` is configured to run
**only on push to `main`** (`on: push: branches: [main]`). This is deliberate:
letting every `claude/**` session branch publish to the one shared EAS `preview`
channel once caused an incident where an older tree clobbered a newer OTA. So:

- Push to a `claude/**` branch → **no OTA**, users see nothing.
- Merge/push to `main` → workflow runs `eas update --branch preview` targeting
  `runtimeVersion` in `app.json` → users get it on next launch (~1–2 min).

## The publish flow (JS / UI / logic changes — the normal case)

1. Commit your work on the designated `claude/**` branch and push it.
2. Open a PR from that branch into `main`.
3. **Merge the PR into `main`.** The merge is a push to `main`, which triggers
   `update.yml`.
4. Confirm the run succeeded: GitHub → Actions → "OTA Update" → the run for your
   merge commit should be green. (`eas update` on the `preview` branch.)
5. On the device, fully close and reopen the app — the OTA applies on next launch.

That's it. No version bump, no rebuild, for pure JS/style/logic/asset changes.

## Runtime must match

An OTA only reaches installs whose **runtime == `app.json` `runtimeVersion`**
(currently `1.1.0`). If a tester's build is on a different runtime, the update
won't apply even after merging. Don't bump `runtimeVersion` unless a matching
native build exists (see AGENTS.md "Runtime version").

## When OTA is NOT enough (needs a native build)

Adding a native package, changing `app.json` plugins/permissions, or `eas.json`
build config requires a new APK/AAB — OTA can't ship native code. These are
human-gated: land the config on `main` and hand off to the maintainer. See
AGENTS.md "New APK build" / "Runtime version".

## Diagnosing "I can't see the update"

Run through this in order:

1. **Is the commit on `main`?** `git log origin/main --oneline | head` — if your
   commit isn't there, it was never published. Merge the branch to `main`.
2. **Did the OTA workflow run and pass?** GitHub → Actions → "OTA Update" for the
   `main` commit. Red = publish failed (read the logs); absent = nothing pushed
   to `main`.
3. **Runtime match?** Device build runtime must equal `app.json` `runtimeVersion`.
4. **Did the app relaunch?** OTA applies on next cold start, not mid-session.
5. **Native change?** If the diff touches native surface, OTA won't carry it — a
   new build is required.

## For agent sessions (Claude Code)

- Finishing code on a branch is **not** "done" when the user wants it live —
  driving it to `main` (open PR + merge) is part of the task unless the user asks
  to hold.
- If asked to publish/merge to `main`: that is a production OTA to all preview
  users. Confirm intent, then open the PR and merge it, and verify the OTA run
  goes green.
