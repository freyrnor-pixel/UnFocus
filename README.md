# UnFocus

An everyday life-management app for people who don't want to spend energy keeping
track of things. Plans, shopping, habits and health live in one place, and an
energy system keeps what you take on in step with what you actually have left.
Everything stays on your phone — there is no account, no backend and no sync to
anyone else's server. Norwegian-first but fully bilingual (EN/NO), for Android
and iOS.

> ⚠️ **This is an experimental build, and a work in progress.**
> UnFocus is in active development with a small group of testers. Features may
> change, move, or arrive half-finished, and some will be rebuilt entirely. Your
> data stays on your device throughout, but expect rough edges.

## Key features

- **Home** — a simple preview of the day: quick actions and an overview, not a wall
  of everything at once.
- **To-do list** — today's plans, held for you, organized by day and week so you
  don't have to keep them in your head.
- **Shopping & inventory** — lists that reset themselves on your schedule, a record
  of what's already in your cupboards, receipt scanning, and recipes whose
  ingredients push straight onto the list.
- **Habits** — structure for your days, one day at a time.
- **Health** — log symptoms and occurrences, and see the trends over time.
- **Energy system** — a daily or weekly energy budget. Tasks and habits draw from it
  or restore it, so plans stay tied to what you can actually manage.

## Design principles

These are build criteria, not marketing. New features are expected to stay inside
them.

- **Made for ADHD, autism, anxiety and depression.** Low friction, low noise, and no
  assumption that the user has spare executive function to lend the app.
- **Easy to use.** Few steps, nothing hidden behind gestures you have to discover,
  sensible defaults instead of a setup wizard. Explanations live in context, behind
  the ⓘ button on every screen.
- **No punishment, small rewards.** Nothing scolds you, nothing is lost by missing a
  day, and there are no streaks to break. Progress is cumulative — small things add
  up, and they stay added up.
- **The energy system is a mental-health feature.** It exists to make plans and
  habits realistic and to give a reason to do less on a bad day, not to gamify
  productivity.

## Tech

React Native / Expo SDK 56, TypeScript, Expo Router, Zustand over SQLite. Local-only
— no backend, no account. Optional LAN sync between your own paired devices.

Contributors and coding agents: read **[AGENTS.md](AGENTS.md)** first — it covers the
architecture, the build/OTA workflow, and the invariants that must not be broken.
Testing strategy is in **[TESTING.md](TESTING.md)**; publishing in
**[PUBLISHING.md](PUBLISHING.md)**.
