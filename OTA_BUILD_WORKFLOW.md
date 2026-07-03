# OTA Updates & APK Build Workflow

**READ THIS FIRST** before any APK build or version bump. This prevents runtime mismatches and broken OTA updates.

## Key Concepts

### `version` vs `runtimeVersion` in app.json

| Field | Purpose | When to bump |
|---|---|---|
| `version` | User-facing version (e.g., 1.1.0) | Every app release, any time |
| `runtimeVersion` | OTA target runtime; MUST match a deployed EAS build | Only AFTER a new EAS build exists with that runtime |

### OTA Update Mechanism

- OTA updates publish to EAS `preview` channel targeting `runtimeVersion`
- A device only receives an OTA if its installed build matches `runtimeVersion`
- **If runtimeVersion ≠ any deployed build:** devices cannot receive OTA, are stuck on their current version

**Example:** If app.json says `runtimeVersion: 1.1.0` but no build with runtime 1.1.0 exists in EAS Preview, devices won't get updates.

---

## Correct Workflow

### Scenario 1: Code Changes Only (most common)
**No native package/plugin/permission changes, no app.json modifications**

1. Make code changes on `claude/*` branch
2. Push to main (triggers OTA update workflow automatically)
3. OTA publishes to `preview` channel targeting current `runtimeVersion`
4. Done — users get updates on next app launch

**Don't touch app.json.** Don't bump versions. The OTA workflow handles it.

---

### Scenario 2: Non-Native app.json Changes
**Version bump, string changes, theme changes, etc. — but no plugins/permissions/native**

1. Update `version` to the new user-facing version (e.g., 1.1.0)
2. **Leave `runtimeVersion` unchanged** — it still targets the current deployed build
3. Push to main
4. OTA publishes the new code to the existing runtime
5. Done

Example commit:
```
Bump version to 1.1.0

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### Scenario 3: Native Changes (plugins, permissions, packages)
**These require a new APK/AAB build**

#### Step 1: Prepare config, don't bump runtimeVersion yet
1. Make the native change (add package, update plugin, add permission, etc.)
2. Update `version` if needed
3. **Keep `runtimeVersion` unchanged** — current preview build keeps receiving OTA
4. Commit and push to main with message:
   ```
   Add <native feature>, prepare for new build

   [Description of native change]
   
   Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
   ```

#### Step 2: Build via EAS Build (maintainer-run, not agent)
- **Do NOT trigger GitHub Actions debug build** — that won't register with EAS
- Maintainer runs: `eas build --platform android --profile preview`
- This builds a new preview APK with a new runtime value (assigned by EAS)
- Users download and install this APK

#### Step 3: After new build exists, bump runtimeVersion
- Check the build's runtime value (shown in EAS console or build details)
- Update `app.json`: `runtimeVersion: "<new-value>"` to match the build
- Usually also bump `version`: `"1.2.0"` → `"1.3.0"`
- Commit and push to main:
   ```
   Bump runtimeVersion to match new EAS build <build-id>

   New preview build available; OTA updates now target this runtime.

   Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
   ```
- After this commit, OTA workflow publishes updates to the new runtime
- Users with the new APK installed receive them automatically

---

## Common Mistakes (Don't Do These)

| ❌ Mistake | 💥 Result | ✅ Fix |
|---|---|---|
| Bump `runtimeVersion` before building | Users on old builds can't get updates | Keep `runtimeVersion` unchanged until build exists |
| Use GitHub Actions debug APK for production testing | Can't receive OTA updates | Use EAS Build for preview/production |
| Push native changes without coordinating a build | Code won't run; native plugin missing | Ensure EAS build completes before OTA publishes |
| Change `runtimeVersion` without a corresponding build | Devices orphaned, no updates flow | Match `runtimeVersion` to an actual deployed build |

---

## Current State (as of 2026-07-03)

- **EAS Preview runtime:** `1.0.0` (APK build deployed)
- **Current app.json:** `version: 1.1.0`, `runtimeVersion: 1.0.0`
- **OTA channel:** `preview` on Expo
- **Meaning:** v1.1.0 code is available via OTA to devices on runtime 1.0.0

When native changes are needed:
1. Make the change, keep `runtimeVersion: 1.0.0`
2. Maintainer builds new APK (gets new runtime, e.g., `1.1.0`)
3. Bump `runtimeVersion: 1.1.0` after build exists
4. OTA updates flow to new runtime

---

## For Claude: Pre-Flight Checklist

Before any build or version bump:

- [ ] Is this a code-only change? → Just push to main, done
- [ ] Bumping `version`? → Update in app.json, leave `runtimeVersion` alone, push to main
- [ ] Adding a native package/plugin/permission?
  - [ ] Make the change
  - [ ] **Do NOT bump `runtimeVersion`**
  - [ ] Commit and push to main
  - [ ] **Hand off to maintainer for EAS Build**
  - [ ] Wait for build to complete and get its runtime value
  - [ ] THEN bump `runtimeVersion` to match
  - [ ] Commit and push that separately
  - [ ] Done — OTA will flow to new runtime

**When in doubt:** Check AGENTS.md § "Runtime version" first. If still unsure, ask the user.
