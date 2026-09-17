# Open decisions — things waiting on the maintainer

**What this file is for.** A question only the maintainer can answer, parked where they will
actually see it, instead of in a paragraph of `AGENTS.md`.

**Why it exists.** On 2026-08-29 the report was *"visual condensing of cards seems like it has
not landed."* It had partly landed. What had not landed was the part that needed a ruling — the
mockup's ~12px rhythm against the app's deliberate 4/8/16/24/32/48 spacing scale — and that
ruling was never requested. It was written down instead, in `AGENTS.md`, as:

> ⚠️ **NOT done in that pass**: `SCREEN_GAP` (16) and `Card`'s padding. The mockup's numbers
> translate to ~12 at this width, which is not a rung on the deliberate … scale … That is a
> design-system decision (add a rung, or don't), **not a defect.**

That note is correct and it was invisible. The maintainer re-reported the symptom two days
later, a session was spent proving the code was on `main` and the OTA had published, and the
answer was in a doc nobody had reason to re-read. **A decision recorded in prose is a decision
that will be re-derived, not made.**

## The rules

1. **Deferring work is fine. Deferring it silently is not.** If a pass stops because it needs a
   ruling, the ruling goes here in the same PR that stops.
2. **State the options with their measured costs**, not "we should decide about spacing". The
   maintainer should be able to answer from this file alone.
3. **Name what it blocks**, so the cost of not answering is visible.
4. **Delete the row when it is answered**, and put the answer where the code lives.
5. A row here is **not** a TODO, a nice-to-have, or a bug. Those go in the code or a PR. This is
   only for *"an agent cannot legitimately choose this."*

---

## Open

### ANSWERED 2026-09-15 — option A, and two of the row's own facts were wrong

Asked and answered the same day, so the question is kept only for the corrections it earned.

**Shipped:** `LONG_LIST_CAP = 50` (`constants/theme.ts`) with `lib/longList.ts`, applied to To-do's
**"Mer"** and **"Ferdig"** sections. Over 50 rows the section draws the first 50 and a `"N flere"`
row; tapping it shows everything; folding the section away resets it. Under 50 — every ordinary
user — nothing changes and the control never renders.

**Correction 1: `calGroups` was never unbounded.** This row listed it among the five uncapped
sites. It is bounded by `calDates`: seven entries in week mode, at most ~31 in month mode. It
needed nothing.

**Correction 2: "Når som helst" is deliberately left uncapped, and that is not an oversight.**
It is a DRAG list (`DraggableTaskRow` + `useDragReorder`). A drag order naming a row the cap has
not rendered is a reorder that cannot complete, so capping it would trade a cost that appears
after two years for a bug that appears at row 51. `lib/longList.ts`'s header carries this warning
so the next reader does not "finish the job".

So the real answer to the original question was **two sections, not five** — and the two are
exactly the ones with no drag, already behind a fold, that grow without limit
(`RETENTION_DAYS = 365` keeps completed tasks for a year, and open/recurring/undated ones
forever).

**Not chosen, and why.** (B) virtualising inside `scrollable={false}`: correct at any size, but
#684 reverted `removeClippedSubviews` for breaking expand/collapse, and this is the same
mechanism on a main tab. (C) pruning harder: deletes user data on a rule the user did not set.

⚠️ **Unverified on device.** No harness here can see this: the cap only engages past 50 rows and
`npm run visual` seeds a handful. What the harnesses DO confirm is that nothing else moved.


### The swipe "hump": patch ViewPager2's own touch slop, or accept the feel?

**Asked 2026-09-09**, after the third failed attempt at the same report.

The report has been the same three times: *"Rythmic lag when Swiping between Screens. Never
varies, always the same lag"*, then *"the lag just feels like it's caught on a hump"*, and after
the 1.7.1 build, *"Same lag when Swiping."*

**Three diagnoses, three no-changes.** Each was reasonable, each shipped, none moved it:

| PR | Diagnosis | Result |
|---|---|---|
| #682 | Home's cards re-rendering each other; Android over-drawing | no change (and its `removeClippedSubviews` half caused a separate bug, reverted in #684) |
| #686 | the background parallax's per-frame JS↔native round trip | no change — correctly deleted anyway, it bought 14px of drift for two bridge crossings a frame |
| #687 | `NestedScrollableHost`'s capture threshold (`.5f` → `1f` → `1.4f`) | no change, **and it broke vertical scrolling on Home** — reverted to `1f` in this PR |

**What #687 established, which is the useful part.** `NestedScrollableHost` disallows intercept
on `ACTION_DOWN`, but ViewPager2's inner `RecyclerView` has already seen that DOWN and recorded
its own initial touch point. When the host later releases the gesture, RecyclerView begins
intercepting from *its* ~8dp slop, measured from that same DOWN. So the finger travels
`max(hostSlop, 8dp)` before the page moves no matter what factor the patch writes — which is
exactly why lowering it from `1f` to `1.4f` changed nothing, and why `.5f → 1f` in July probably
changed nothing either. **The dead zone at the start of a swipe is RecyclerView's slop, and the
patch cannot reach it from where it is written.**

**The decision.** The only lever left in JS-reachable territory is a native patch that reduces
that inner RecyclerView's touch slop directly — the standard `ViewPager2` reflection
(`recyclerView` field `mTouchSlop`, halved). That is:

- **a native change**, so it reaches nobody without a new build (no OTA);
- **unverifiable in this repo** — no harness here can see a frame of a swipe (`HARNESS.md`);
- **on the same knob that just broke vertical scrolling**. Halving the pager's slop makes the
  pager win more of the ambiguous diagonal drags, which is the mechanism behind *"unable to
  scroll vertically in home"*, arrived at from the other end.

So the options are (a) ship the reflection patch in the next build and test both swiping AND
vertical scrolling on device, accepting one more round trip if it repeats the 1.7.1 regression;
(b) leave the swipe as it is — it is AOSP's default pager feel, which is what every other
ViewPager2 app has; (c) something else entirely, if the "hump" is not the start-of-swipe dead
zone at all — a fresh, specific description (does the page move under the finger immediately and
then stutter, or does it not move at all until it jumps?) would redirect this.

**Blocks:** nothing shipping. It blocks a fourth guess, which is what the three rows above say
is not worth making — see `CLAUDE.md`'s A3 rule.

---

### ANSWERED 2026-09-15 — option (c). It was not the touch slop.

The fresh description this entry asked for arrived: *"a slight **tug** when swiping between
screens. Same tug every time at the same time."* That is the first branch of the question above —
the page moves under the finger and then catches — so the start-of-swipe dead zone is **not** what
was being reported, and (a) is not the next move.

What it was: `components/ScreenBackground.tsx`'s screen-hue crossfade. Every tab has a distinct
hue, so it fires on every swipe; it writes the new hue into an `OrbLayer`'s `color` **prop**, and
that prop mints the `<RadialGradient>` `<Defs>` of a full-screen `<Svg>` — invalidating the canvas
and, because the layer is `renderToHardwareTextureAndroid`, forcing an offscreen texture
re-raster. `activeRoute` changes only at the swipe boundary (by design —
`app/(tabs)/_layout.tsx`), so all of that landed on one deterministic frame: the first frame of
the settle. Hence "the same tug, every time, at the same time".

Confirmed on device *before* the fix, which is what makes this an answer rather than a fourth
guess: with **"Reduce visual effects" ON** — the switch that unmounts the whole orb block — the
tug is gone.

Fixed by deferring the buffer write and the tween to `InteractionManager.runAfterInteractions`,
so the work lands after the settle rather than on it.

**What stays open:** nothing here. The three earlier diagnoses were each aimed at *per-frame* cost
(over-draw, the parallax bridge, the capture threshold) and this was a *one-frame burst*, which is
why none of them moved it and why the patch's own note is right that lowering the slop could never
have. Option (b) — accept AOSP's dead zone before motion starts — remains the standing answer for
the thing this entry was originally about, and it has not been re-reported.

---

### Swipe lag, the residual: is `offscreenPageLimit` worth a JS patch to react-native-tab-view?

**Asked 2026-09-16**, after the report came back split in two: *"Still some small lag when
Swiping, and especially when Swiping beyond the last screen (when cards drag like a rubber
band)."*

**The second half is answered and shipped, and it is not a guess.** "Cards drag like a rubber
band" names the Android 12+ (API 31) *stretch* `EdgeEffect`. It is not the old glow: the container's
entire content is captured into an offscreen `RenderNode` and distorted by a `RuntimeShader` on
every frame of the over-drag. In a `ViewPager2` that container is the inner `RecyclerView`, so the
thing being captured and warped is a whole tab page — every card and every shadow on it. The cost
is per-frame and it exists *only* at the two ends of the pager, which is exactly the shape of
"especially ... beyond the last screen". Fixed with `overScrollMode="never"` on the `TopTabs`
navigator (`app/(tabs)/_layout.tsx`) — a plain JS prop over native code already in the binary, so
it ships over OTA, unlike `patches/react-native-pager-view+8.0.1.patch`. It removes the rubber
band entirely; the end of the pager becomes a firm stop, which is what iOS already does here
(`overdrag` defaults to `false` and this app never sets it).

**The first half — "some small lag" on an ordinary swipe — is what this entry is about, and it is
deliberately not guessed at.** The ledger above is four rounds long (over-draw, the parallax
bridge, the capture threshold, then the `ScreenBackground` hue tween that finally was the "tug"),
and `CLAUDE.md`'s A3 rule says the next move is a question, not a fifth diagnosis.

**What was ruled out this pass, so nobody re-walks it:**

| suspect | verdict |
|---|---|
| a JS listener on the pager's `position`/`offset` | **none left.** `onPageScroll` is an `Animated.event` with `useNativeDriver: true`; the parallax listener that used to read it was deleted in #686. The only `addListener` in `PagerViewAdapter` is `offset`'s in `onPageScrollStateChanged`, and it removes itself inside its first callback. |
| the navigator re-rendering all five screens on every settle | **no.** `setActiveRouteName` does re-run `useDescriptors` (which memoizes nothing), but `@react-navigation/core`'s `SceneView` wraps each screen in `StaticContainer`, whose props (`name`/`render`/`navigation`/`route`) all come from `useNavigationCache`/`useRouteCache` and are stable. The screen trees do not re-render. |
| a JS-driven loop competing for frames | **no.** `ParticleBackground`'s is `useNativeDriver: true`; `GlowPulse`/`NewSinceGlow` are Reanimated (UI thread). |

**The one lever identified and NOT pulled.** `ViewPagerAdapter.onBindViewHolder` calls
`holder.setIsRecyclable(false)`, so a page that scrolls outside ViewPager2's offscreen window is
not pooled — its holder is discarded and a fresh one is created and re-bound the next time you
swipe toward it. With the default `OFFSCREEN_PAGE_LIMIT_DEFAULT` and five tabs, that is a
`createViewHolder` + `addView` of a full page at the start of most swipes. `offscreenPageLimit={2}`
would keep all five attached permanently — the same trade `lazy: false` already makes, and for the
same reason.

Two things stop it being shipped blind. **(1)** `react-native-tab-view`'s `TabView` forwards a
fixed list to the pager and `offscreenPageLimit` is not on it (`overScrollMode` is — that is why
the fix above needed no patch). So this needs a `patch-package` patch to a JS dependency: OTA-able,
but a standing maintenance cost on every upgrade. **(2)** The expected win may be small: RN
Android's `ReactViewGroup.onMeasure`/`onLayout` do not traverse children (RN does its own layout),
so re-attaching a page is a view add plus an invalidate, not a measure pass over its whole tree.

**What would answer it without another guess:** whether the residual lag is *at the start* of a
swipe (a hitch as the page begins to move — that is the attach cost above, and the patch is worth
it) or *throughout* the slide (evenly rough while two pages are on screen — that is draw cost for
two full pages and no pager prop will touch it; the lever there is what a page draws at rest).

**Blocks:** nothing shipping. It blocks a JS patch to a dependency.

---

### ANSWERED 2026-09-16 — the patch was worth it. It is the attach, not the draw.

The question above asked *start of the swipe* or *throughout the slide*. The answer came back
shaped differently and is stronger than either: *"Seems to lag a bit depending on which screen I
am Swiping to. Shopping is most laggy, Health and habits work fine. Tapping between them in bottom
nav works well."*

Two independent discriminators in one sentence, and together they leave one mechanism standing:

- **It scales with the DESTINATION's tree.** That rules out every per-frame cost that is the same
  in both directions — which is all three of the 2026-09-09 diagnoses. "Never varies, always the
  same lag" was a different bug; this one varies by where you are going.
- **A TAP to the same screen is fine.** `animationEnabled: false` sends a BottomNav tap through
  `setPageWithoutAnimation` — an instant snap. The incoming page is attached there too, so the
  attach cost is paid on both paths. The difference is that a tap has nothing animating for a long
  frame to stutter against. Only a swipe puts that frame inside a 60fps follow-finger slide.

That is `offscreenPageLimit`, exactly as the entry above described it and declined to ship blind.
ViewPager2's `OFFSCREEN_PAGE_LIMIT_DEFAULT` lays out only the page you are looking at, and
`ViewPagerAdapter.onBindViewHolder` calls `holder.setIsRecyclable(false)`, so a page that leaves
that window is not pooled — its holder is discarded and a fresh `onCreateViewHolder` +
`onBindViewHolder` + `container.addView(child)` runs on the first frame of the next drag toward
it, with that page's display list recorded from scratch behind it.

**The measurement, and it corrects this entry's own guess.** The web preview counts each mounted
scene's subtree (all five are resident under `lazy: false`). On an empty profile, at rest:

| scene | Shop | To-do | Home | Habits | Health |
|---|---|---|---|---|---|
| nodes, all cards closed | 105 | 119 | **190** | 60 | 71 |
| nodes, Catalogue opened | **271** | 119 | 190 | 60 | 71 |

At rest Shop is the *second smallest*, which is not what the report says — every card rests closed
(`lib/cardDefaults.ts`). Opening **one** card takes it 105 → 271, past Home, on a profile with no
user data at all; with real weekly lists, monthly lists and an archive it grows on axes no other
tab has. Habits (60) and Health (71) are the two smallest scenes and the two reported fine. So the
ranking in the report is a ranking of tree size, once you account for which cards are open.

**Shipped:** `offscreenPageLimit={SITE_ITEMS.length - 1}` on the `TopTabs` navigator, plus
`patches/react-native-tab-view+4.3.1.patch` — four added lines making `TabView` forward the prop it
otherwise drops one hop before the native view. JS, so it ships over OTA.

**The options weighed, since the maintainer asked for the trade-offs:**

| | option | effect | cost |
|---|---|---|---|
| **1 ✅** | `offscreenPageLimit` — keep all five pages attached | removes the attach + first display-list record from the drag entirely | a 4-line patch on a JS dependency to carry across upgrades; all five pages laid out at start-up instead of one |
| 2 | shrink what Shop mounts (close/unmount the embedded Catalogue surface at rest) | permanent, and speeds up scrolling Shop too | a **visible product change** — the maintainer loses Catalogue at a glance on Shop. Needs a yes, so it is not in this PR |
| 3 | virtualise Shop's lists | correct at any size | #684 reverted `removeClippedSubviews` for breaking expand/collapse, and this is the same mechanism on a main tab |
| 4 | `lazy: true` (+ `lazyPreloadDistance`) | smaller boot | **ruled out twice already** — the 2026-08-28 regression (*"things load after Swiping"*) and the 2026-07-13 touch-delivery bug. Do not reach for it |
| 5 | accept it | — | the report is a report |

(1) wins on the one axis that separates it: it is the only option that changes *nothing the user
can see* and reverts in one line. Its start-up cost is the same trade `lazy: false` already makes
and for the reason this file has stated twice — a launch happens once, behind a splash; a swipe
happens constantly, in front of you. (2) is the follow-up if (1) is not enough, and it is the
maintainer's call, not an agent's.

**The guard.** `<TopTabs offscreenPageLimit={n}>` typechecks with no patch applied and silently
does nothing — this repo's documented dead-config class. `patch-package` fails loudly if the patch
stops applying, but not if an upgrade restructures `TabView` around it, so
`lib/__tests__/pagerOffscreen.test.ts` asserts the forwarding is present in the dependency Metro
loads, checks both `src/` and `lib/module/` (the package ships an `exports` map with a `source`
condition), and pins that the limit is derived from `SITE_ITEMS.length` rather than written as
`4`. It was probed with a planted defect — deleting the forwarding line fails it.

⚠️ **`unverified` on device.** The web pager is `PanResponderAdapter`; `offscreenPageLimit` is a
ViewPager2 concept and no harness here can see it. The node counts above are evidence that Shop is
the heavy destination, not that this fixes the hitch.

**What stays open:** option (2), pending a yes, if the swipe is still uneven toward Shop.

---

### Swipe lag, round 6: does "Reduce visual effects" ON make swiping smooth?

**Asked 2026-09-16**, the same day the entry above shipped, because it did not move it and
`CLAUDE.md`'s A3 rule says the next move is a question rather than a sixth diagnosis.

The report: *"Fortsatt tregt. Hjem er også tregt."* Home is new; the earlier ranking was Shop
worst, Habits and Health fine.

**#719 was DELIVERED, and that is what makes this useful rather than another dead end.** Before
writing anything here, the Android bundle was exported and its Hermes string table checked:
`offscreenPageLimit` is present, alongside `overScrollMode`, `swipeEnabled` and `animationEnabled`
— the props that demonstrably work. The last APK (run 22, 2026-09-11, `ec19991`) was built at
`runtimeVersion` 1.7.3 and `app.json` still says 1.7.3, so the OTA channel reaches that install.
So the prop shipped, arrived, and changed nothing. **The attach at drag start is excluded by
experiment, not by argument.** That is the first thing this line has ruled out with a measurement
rather than a guess.

**What the exclusions now leave.** Every per-frame mechanism tried has been a JS or gesture one:

| PR | mechanism | result |
|---|---|---|
| #682 | Android over-draw (`removeClippedSubviews`) | no change |
| #686 | per-frame JS↔native bridge (parallax listener) | no change |
| #687 | gesture capture threshold | no change, + broke vertical scroll |
| #71x | settle-frame SVG re-raster (screen-hue crossfade) | **fixed the "tug"** — a different symptom |
| #718 | Android 12+ stretch EdgeEffect at the ends | addressed the rubber band |
| #719 | page attach + first display-list record | no change, **delivery verified** |

What has never been tried is the one per-frame cost that is neither JS nor gesture, and it is
already named in this repo by the component that owns it. `components/Surface.tsx:399`:

> "Reduce visual effects" … takes this component's **one remaining per-frame GPU cost, the
> two-pass `boxShadow`** …

and at `:658`, on why `reduceEffects` drops it rather than thinning it: *"a boxShadow's cost is
the blur, so two passes of three is still two blurs per card per frame."*

**And it ranks with the report.** The web preview's per-scene count (empty profile, all five
scenes resident under `lazy: false`) measured shadow-casting elements alongside nodes:

| scene | Shop | To-do | Home | Habits | Health |
|---|---|---|---|---|---|
| nodes, cards closed | 105 | 119 | 190 | 60 | 71 |
| **shadowed elements** | **10** | 7 | **9** | **3** | **5** |
| reported | worst | — | slow | fine | fine |

The two screens reported slow carry 9–10 shadowed elements; the two reported fine carry 3–5. A
pager slide is exactly when every card on **two** pages is composited while moving, and a tap —
reported fine throughout — is one frame of that.

**This is not being shipped as guess six.** The Settings entry above reached its answer by asking
the maintainer to flip one switch the app already has, and the same switch settles this one, from
the opposite end: it was already confirmed on 2026-09-15 that **Reduce effects ON clears the
Settings navigation lag**. If it also clears the swipe, the shadow is convicted and the fix is
bounded — `reduceEffects` gates orbs, particles and this, and the pager's orbs and particles are
ONE hoisted instance shared by all five tabs (`app/(tabs)/_layout.tsx`), already exonerated for a
per-screen ranking by #715.

**The question, and it costs ten seconds:** with **Settings → Accessibility → Reduce effects ON**,
is swiping between tabs smooth?

- **Yes** → it is the per-card shadow. The bounded fix is to stop paying the blur while the pager
  is moving (drop to a cheaper shadow tier, or none, between `swipeStart` and `swipeEnd` —
  react-navigation already emits both) rather than making anyone live with the switch on.
- **No** → the whole backdrop-and-shadow bundle is exonerated for swiping, and what is left is the
  page tree itself. That is option (2) from the entry above — reduce what Shop and Home mount at
  rest — which is a visible product change and needs a separate yes.

**One housekeeping call attached to this.** #719 shipped a `patch-package` patch on
`react-native-tab-view` for a change with no observed benefit, which is a standing upgrade cost.
It is not harmful and reverts in one line, so it is left in place for now rather than churned out
and back in; say the word if you would rather carry no patch until something earns it.

**Blocks:** the sixth attempt. Nothing else.

---

### MEASURED 2026-09-16 — it is not what mounts and loads, and the harness can prove that one

The maintainer's read on the question above: *"Det må jo være hvor mye som mounter og laster
inn."* It is the natural reading and it is the one thing on this line the web preview can settle
outright, because mount and render cost is **JS work** — the one layer this harness measures
faithfully. Four windows, from a `PerformanceObserver` on `longtask` installed via
`addInitScript` before the bundle runs:

| window | long tasks | total | longest |
|---|---|---|---|
| boot + onboarding | 3 | 570 ms | 317 ms |
| **mounting the whole five-screen tab group + tour** | 2 | **151 ms** | 86 ms |
| **6 s idle, nothing touched** | **0** | **0 ms** | — |
| **each BottomNav tab tap** (all five, twice for Shop and Home) | **0** | **0 ms** | — |

Read in order, those say: the five screens are built **once**, for ~151 ms, behind the splash.
After that the JS thread is **completely quiet at rest** — nothing re-renders, no store thrash, no
loop. And **a tab change costs no measurable JS at all**, on any tab, including the two reported
slow.

**So there is nothing left to mount or load at swipe time.** `lazy: false` mounts all five up
front, and `@react-navigation/core`'s `StaticContainer` stops the navigator's own re-renders from
reaching the screen trees (`useDescriptors` memoizes nothing, but its `name`/`render`/`navigation`/
`route` props all come from `useNavigationCache`/`useRouteCache` and are stable).

**And the maintainer's own observation closes it without the numbers.** *Tapping between them in
bottom nav works well.* A tap and a swipe land on the same page, mount the same subtree, run the
same focus effects and read the same stores. Whatever work a tab change does, **a tap does all of
it too.** So the difference between a fine tap and a laggy swipe cannot live in mounting or
loading. It can only live in what happens *during the drag* — which is per-frame native
compositing of two pages at once, and is the one thing no harness here can see.

⚠️ **The honest limits of the table.** `longtask` only fires at >=50 ms, so a tab change could
cost 20 ms and read as 0; and this is react-native-web on an empty profile, not Fabric on the
maintainer's data. Neither limit touches the argument, because both apply equally to the tap and
to the swipe, and the tap is fine.

**Where that leaves it — unchanged from the entry above, now by elimination rather than by
argument.** The remaining per-frame cost is `components/Surface.tsx`'s two-pass `boxShadow`, which
that file calls *"this component's one remaining per-frame GPU cost"*, and whose count tracks the
reported ranking (Shop 10, Home 9 — slow; Habits 3, Health 5 — fine). **Reduce effects ON** is
still the ten-second discriminator, and it is now the only open question on this line.

**The trial, if the maintainer would rather something were attempted than asked.** Promote each
pager page to a hardware texture for the duration of the drag only — react-navigation emits
`swipeStart`/`swipeEnd`, and `renderToHardwareTextureAndroid` is already how this repo keeps the
backdrop layers cheap. A rasterised page slides as a texture blit, shadows included, with no
change to how anything looks at rest. It is not free of risk: the layer promotion itself lands on
the first frame of the drag, which is where a hitch would be least welcome, and it is still a
guess about the mechanism rather than a measurement of it. That is why it is offered rather than
shipped.

**Blocks:** the sixth attempt, still. What it no longer blocks is the mount hypothesis — that one
is answered.

---

### ANSWERED 2026-09-17 — Reduce effects ON makes swiping smooth. It is per-card GPU paint.

*"Du hadde rett, av en eller annen grunn funker det å redusere visuelle effekter."* Six rounds,
and the thing that identified it was a switch the app already shipped.

**What that convicts, and what it does not.** `reduceEffects` gates exactly three things:
`ParticleBackground`'s field, `ScreenBackground`'s orb canvas, and `Surface.tsx`'s pane + two-pass
`boxShadow`. The first two are ONE hoisted instance shared by all five tabs
(`app/(tabs)/_layout.tsx`), fixed behind the pager and not sliding with it — so they cannot produce
a per-screen ranking, and #715 already exonerated them for one. The two that ARE per card are the
pane and the shadow, and those scale with the page exactly as the report did: Shop and Home slow
(10 and 9 shadow-casting elements), Habits and Health fine (3 and 5).

So the cost is **per-frame GPU paint of card surfaces while two pages are on screen at once** —
the only mechanism class left after #719 excluded the attach and #721 excluded mount/render, both
by measurement.

**Shipped:** `lib/usePagerSwipeRaster.ts` → `renderToHardwareTextureAndroid` on each pager page's
outer SafeAreaView, true only between `swipeStart` and `swipeEnd`. Android bakes the subtree into
a texture once and the slide becomes a blit, blurs and gradients included. It is the same technique
this repo already uses for `ScreenBackground`, `HomeHeroBackground` and `ParticleBackground`.

**Why the drag and not permanently.** A hardware layer re-rasterises when its content changes, so
a permanent one would turn every checkbox tick on Home into a full-page re-raster — trading a cost
that only happens while swiping for one that happens on every interaction. Between `swipeStart` and
`swipeEnd` nothing in the page changes, which is exactly when a texture is free.

**Why this and not the obvious alternative.** Dropping the pane and shadow during the drag would
also work and needs no native texture — but it changes card *fill* and depth mid-swipe, a visible
pop on every gesture, and it would re-commit shadow nodes across ~60 cards on the drag's first
frame (`Surface.tsx:624` documents that cost). Rastering changes nothing about how anything looks,
at rest or in motion.

**Two traps avoided, both recorded because each would have shipped a silent no-op.**
- The listener must be a **screen's** navigation object, not the navigator's. The tab bar's
  `navigation` spreads its `addListener` from the PARENT navigator (`useNavigationHelpers` takes
  `emit` from this emitter but `addListener` from `parentNavigationHelpers`), so subscribing there
  registers on the Stack and never hears the pager's untargeted `emit`. That is why the hook lives
  in the scaffold each tab screen renders rather than once in the layout.
- **No `Platform.OS === 'android'` guard.** `renderToHardwareTextureAndroid` is already a no-op off
  Android, and a platform check would have made the flag dead on the one harness that can watch it
  move.

**Verified in motion, not on paper.** `lib/__tests__/pagerSwipeRaster.test.ts` evaluates the hook's
truth table over both `enabled` values and both events (7 tests, probed: forcing the hook to return
a constant fails two of them). The web preview drove a **real drag** against a temporary marker
attribute: **0 pages rastering at rest → 5 while the finger was down → 0 after release.**

⚠️ **The performance claim itself stays `unverified`.** `renderToHardwareTextureAndroid` is a no-op
everywhere a harness can run, so nothing here can see whether the swipe actually got smoother. The
wiring is proven; the effect needs the device.

**What stays open if this does not land.** The per-card paint is then still too expensive on that
device and the fix has to make it cheaper rather than mask it during one gesture. The split is one
more ten-second test: **Reduce effects OFF + "Lit card surfaces" (`glassSurfaces`) OFF** — that
switch drops the pane and keeps the shadow. Smooth → it is the pane's gradient and inset rim;
still rough → it is the shadow's two blur passes. Either answer names a bounded, permanent change,
and both are visible ones that need a yes.

---

### ANSWERED 2026-09-17 — #722 landed. What is left is a cold cache, not a per-frame cost.

*"Nå lagger det bare de første par gangene, men etter noen sveip går det fint."*

**That sentence is the diagnosis, and it is a different KIND of cost than everything before it.**
A per-frame cost does not improve with repetition — swipe twenty would cost what swipe one cost.
One that disappears after a few swipes and stays gone is a **cache that starts cold**. So #722 did
its job: the steady per-frame GPU paint is handled, and what it uncovered underneath is a
one-time-per-page **first-draw warm-up** that was always there, masked by the larger cost.

**What is actually warming.** A page laid out outside the pager's clip is never drawn — with
`offscreenPageLimit` (#719) all five are *attached*, but attachment is not a draw. The first time a
page enters the clip, Android must, for that page:

1. **compile the blur paints.** `getLayeredShadow` is a **two-pass** blurred shadow, with radii
   scaled per tier (`k` = 1 raised / 1.6 floating / 2.2 chrome) — so each tier × theme is a
   distinct Skia paint, and each is compiled on first use and cached after. `constants/theme.ts`
   already spells out the standing cost: *"a blur is a per-frame GPU pass per card, and this app
   draws a lot of cards."* First draw adds compilation on top of that pass.
2. **populate the glyph atlas** with that page's text and icon-font glyphs.
3. **record its display list** for the first time.

All three are per-process and cached afterwards, which is exactly "the first couple of times, then
fine". Android also persists GPU program caches to disk per app, so the blur half of it should get
less noticeable across launches rather than more.

**Why this is close to the floor for this content, stated plainly.** The app draws ~10
blurred card shadows on Shop and 9 on Home. The first time those pages are drawn, that work
happens somewhere. It cannot be deleted, only moved or made smaller.

**The options, with what each actually costs:**

| | option | effect | cost |
|---|---|---|---|
| **A ✅** | accept it | nothing to build; it warms in two swipes and self-heals per launch | the first couple of swipes after a cold start stay soft |
| B | make the first draw smaller | permanent, and helps scrolling and Settings too | a **visible** change — either the pane's gradient and rim, or a shadow tier's depth. Needs a yes, and needs the split test first: **Reduce effects OFF + "Lit card surfaces" OFF** (that switch drops the pane, keeps the shadow) |
| C | pre-warm the blur paints behind the splash | invisible; moves the compile to where nobody is watching | ~20 lines and a permanently odd hidden component, and it warms only the PAINTS — not the glyph atlas or the display lists, so it may be a partial fix or a no-op. Unmeasurable here |
| D | pre-warm by paging through all five tabs at launch | warms everything properly | a visible flicker unless hidden under `LaunchReveal`, and it fires five screens' focus effects (Shop's monthly-reset sheet among them). Not worth the blast radius |

**Recommended: A.** Six rounds in, the symptom has gone from "every swipe, always the same" to "the
first two after a cold start", and the remaining cost is inherent to how much the two heaviest
pages draw. B is the only option that genuinely removes it, and it is a design decision rather than
a perf fix — so it should be made deliberately, if at all, and not as round seven.

**Blocks:** nothing. B is available whenever the maintainer wants it, and the split test that aims
it is ten seconds.

---

### ANSWERED 2026-09-17 — "not what loads, but when and how". It was four screens in one commit.

*"Tror ikke det nødvendigvis er hva som lastes inn, men når og hvordan."* That redirect found it,
and it found a hole in this file's own measurement.

**The hole.** #721's idle probe looked at a 6-second window taken **after** the guided-tour walk —
roughly eight seconds after the tabs appeared — and reported 0ms. True, and useless: everything
interesting had already happened. Re-measured in the window it skipped, with a `longtask` observer
AND a rAF frame-gap monitor, from the instant the tab group mounts:

| window after the tabs appear | long tasks | total | worst |
|---|---|---|---|
| 0–1s | 2 | **156 ms** | 91 ms at +45 ms, **65 ms at +151 ms** |
| 1–8s | 0 | 0 ms | — |

Two spikes, not one. The first is the tab-group mount. **The second, ~150ms later, is
`react-native-tab-view`'s `SceneView`**: with `lazy: false` every non-focused scene schedules its
own `setTimeout(() => setIsLoading(false), 0)`, so all four fire in the same timer batch and React
commits **every off-screen screen tree in one render.** That is "when and how" exactly — not what
loads, but four screens' worth of it landing on a single frame.

**Confirmed by experiment before being fixed**, which is what makes this an answer rather than a
ninth guess: staggering that timer by distance from the focused page removed the 65ms task from the
long-task list entirely, leaving only the mount. Re-run end to end:

| | long tasks, 0–1s | total | worst frame gap |
|---|---|---|---|
| before | 2 | 156 ms | 83 ms |
| after | **1** | **89 ms** | 67 ms |

**Shipped:** `patches/react-native-tab-view+4.3.1.patch` gains the stagger
(`Math.abs(navigationState.index - index) * 24`), distance-ordered so the adjacent pages — the ones
a first swipe reaches — still render first. Every page is still on screen within ~50ms of launch,
behind the splash. **This is NOT `lazy: true`**, which is separately documented as a regression
("things load after Swiping", 2026-08-28) because a page there does not render until visited.
`lib/__tests__/pagerOffscreen.test.ts` guards it, including asserting the upstream `, 0)` form is
ABSENT so an upgrade that restores it fails rather than passing on a leftover line.

**Also shipped, and it did NOT move the number — recorded as such.** Tier B's nine deferred boot
steps were one `runAfterInteractions` callback; `lib/deferredBoot.ts` now gives each its own frame.
The hypothesis was that this block landed on the first swipes (`runAfterInteractions` waits for
`Animated` handles, and a native ViewPager2 swipe creates none, so it does not wait for a swipe).
Measured: chunking it changed the spike not at all — 65ms before, 65ms after. **It is kept anyway,
for a reason that is not performance:** the old block had no try/catch, so a throw in any one load
silently skipped everything after it, the notification-category registrations and the widget
refresh included. Each step is guarded now.

⚠️ **Empty profile, and that is the live caveat.** The 65ms commit is four EMPTY screen trees; on
the maintainer's data it is larger and lands later, which is the direction that makes it matter
more, not less. And this is react-native-web, so the numbers are JS-thread work only — the native
draw cost stays invisible here (`HARNESS.md`).

**What stays open:** whether this is what the device was feeling. If the first swipes are still
soft, the remaining first-draw cost is the two heaviest pages' own drawing, which only drawing
less can reach — option (B) above, a visible change, aimed by the ten-second split test
(**Reduce effects OFF + "Lit card surfaces" OFF**).







---

### Settings navigation lag: which half of the trip is slow, and is the backdrop expendable?

**Asked 2026-09-15**, after the second no-change on the same report.

The report: *"Going in and out of settings still lag."* Two passes have now shipped against it,
both diagnosing something real and neither moving the symptom — the same shape as the swing the
swipe "hump" entry above records, and `CLAUDE.md`'s A3 rule says a third guess is not the next
move.

| PR | Diagnosis | Result |
|---|---|---|
| #708 | Settings mounted two full-screen `<Svg>` canvases painting nothing (`hasRouteHue` gate) | no change |
| #711 | `app/settings.tsx` took a bare `useSettingsStore()`, so every write re-rendered the largest file in the repo | no change |

**What this pass measured, and it points away from both.** Driving the web preview through
five settings round trips with the screen stubbed at four levels (`scripts` were temporary, not
committed — the probe swapped `SettingsScreen`'s return):

| variant | what it rendered | in | out |
|---|---|---|---|
| `full` | the real screen | ~100ms | ~24ms |
| `scaffold` | `ScreenScaffold` + one `<Text>` | ~73ms | ~22ms |
| `empty` | one `<View>`, all 45 hooks still running | ~76ms | ~22ms |
| `bare` | one `<Text>`, **every hook skipped** | ~70ms | ~19ms |

So on that harness the screen's own content is ~30ms of ~100ms, its hooks are ~6ms, and **~70%
is there for a route that renders a single text node**. Shrinking Settings further — the lever
both shipped passes pulled — has little left to give. For scale, going *back* remounts Home's
659 DOM nodes in ~22ms, while Settings' General tab is 44 elements.

⚠️ **The harness cannot settle this, and the reason is structural, not incidental.**
`expo-router` ships `Stack.web.js` (the `_web-modal` stack) and `Stack.js` (`StackClient` →
native-stack via `react-native-screens`). The web preview measures a **different navigator
implementation** than the device runs, so the ~70ms above is evidence that Settings' content is
not the driver — and is *not* evidence about what that 70ms is made of on Android. This is a
blind class in `CLAUDE.md` A2 terms, and it is why this entry asks rather than ships.

**One lever is already ruled out — do not spend a PR on it.** `freezeOnBlur` is the standard fix
for "the screens under a push keep working", and it cannot help here. `app/(tabs)/_layout.tsx`
runs `lazy: false`, so all five tab screens are permanently mounted and live behind Settings, and
nothing in the app sets `freezeOnBlur` (react-native-screens' global `ENABLE_FREEZE` is `false`).
But the vendored native-stack computes:

```js
const shouldFreeze = isFabric()
    ? !isPreloaded && !isFocused && !isBelowFocused && !isModalOnIos
    : !isPreloaded && !isFocused && !isModalOnIos;
```

`isFabric()` is `'nativeFabricUIManager' in global`, true on SDK 56 / RN 0.85 (New Architecture
only). The tabs group sits **directly below** Settings, so `isBelowFocused` excludes it from
freezing whatever the option says. Setting `freezeOnBlur: true` would be a no-op for this report.

**The question, and it is the one that redirected the swipe entry.** "In and out" is two
different trips with two different costs, and the table above says they are not symmetric:

- **(a) Going IN is slow** — the gear is tapped and the slide starts late or the screen lands
  blank/stuttering. That is mount cost on the JS thread, and the next place to look is what a
  sub-tier push mounts *besides* the list: `ScreenScaffold`'s `ownBackground` path gives Settings
  its own `ScreenBackground` (in dark: a flat `View` plus one texture-cached `OrbCanvas`) and its
  own `ParticleBackground` — a **second** five-dot field spinning up while the pager's hoisted one
  keeps animating underneath, all behind opaque cards that hide it.
- **(b) Going OUT is slow** — back is tapped and the tabs take a beat to come back. Settings is
  not on screen for that, so its size is irrelevant and the cost is in the tabs group re-waking.
- **(c) Both equally**, which would point at the transition itself rather than either screen.

**What would answer it without another guess:** which of (a)/(b)/(c), and whether the lag
survives **Settings → Accessibility → Reduce effects ON**. That toggle already strips the orb
canvases and the particle field (`components/ScreenBackground.tsx`'s `reduceEffects` gate,
`components/ParticleBackground.tsx`'s). If the lag goes away with it on, the backdrop is the
cost and the fix is bounded; if it does not, the backdrop is exonerated and (b)/(c) is where the
next pass goes.

**And the ruling an agent cannot make.** If it *is* the backdrop: `ScreenScaffold` already has a
`plainBackground` prop, built as a "Settings request", currently passed by **no screen**. It
drops both decorative layers for a flat white/black fill — and also squares the header chrome
(`floatChrome = !plainBackground`). That is a visible redesign of the screen, not a perf tweak, so
it needs a yes. The middle option is to keep the look and mount the decorative layers *after* the
push settles, which trades the lag for the backdrop fading in a beat late.

**Blocks:** nothing any more — answered the same day, below.

---

### ANSWERED 2026-09-15 — "both equally", and Reduce effects clears it.

Both questions came back in one go: the lag is **the same in both directions**, and it
**disappears with Accessibility → Reduce effects ON**.

That is the bounded case. "Both equally" is what the backdrop hypothesis predicts and the
alternatives do not: a sub-tier push BUILDS the orb canvas and the particle field, and a pop
TEARS THEM DOWN, so the work is symmetric by construction. A cost living only in Settings' own
tree would be heavy going in and nearly free coming out — the harness table above measures
exactly that asymmetry (~100ms in, ~24ms out) for the render, and the report says the felt lag
is not shaped like it.

**Shipped:** `decorative={false}` on Settings' `ScreenScaffold` (a new prop, default true). It
drops L1's orb canvas and L2's particle field and changes nothing else — page colour, floating
chrome, cards and shadows are untouched. Deliberately **not** `plainBackground`, which would
also flatten the fill and square the header; that redesign is still unasked-for and still
un-needed.

Measured on the web preview, same build, Settings route: `svg` 5 → 4 and SVG child nodes 52 → 38
(one full-screen canvas of radial-gradient shaders and its three ellipses), 487 → 465 DOM nodes
(the five particle views). Home is byte-identical at 659/4/38 — the five pager tabs share one
long-lived instance and were never the problem.

`npm run visual` is **26/26 unchanged in BOTH themes with no baseline re-blessed** — which here
is a *blind* result, not a passing one, and is recorded as such: the removed layers sit behind
opaque cards, and `CLAUDE.md` A2's "dark-on-dark and 1-level light shifts" class is exactly this.
The DOM counts above are the evidence that the change landed; the gate is not.

**Still open, and it is the reason this entry is not deleted.** `reduceEffects` gates THREE
things, not one — these orbs, these particles, and `components/Surface.tsx`'s two-pass
`boxShadow` on every card. The device answer implicates the **bundle**. If the lag survives this
PR, the remaining suspect is the Fabric shadow re-commit across ~60 cards that `Surface.tsx`'s
own header already documents, and the next pass goes there rather than further into the
backdrop. **Do not re-try `freezeOnBlur`** — the entry above proves it is a no-op on Fabric.

---

### The Budget card's Uke/Måned period

**Asked 2026-09-07**, while building v3's Budsjett card (shipped the same day, monthly-only).

v3 says *"Beløp per uke eller måned, brukeren velger. Lønningsdag setter nullstillingen."* The
card ships with everything else that line asks for — the amount, the payday, and the two per-day
figures side by side in the same unit — but **not the period toggle**, because the period is
monthly all the way down the data model, not a display option:

- `settings.monthlyResetDate` is a day-OF-MONTH payday (1–28), which has no weekly equivalent;
- each Monthly list carries one `budgetNok` measured against that cycle;
- `lib/budget.ts`'s `computeSpendPace` derives its period length from payday-to-payday.

**Measured cost.** A weekly option is a new stored field plus a `lib/db.ts` migration, a second
reset boundary in the automatic payday reset, and a `computeSpendPace` that takes a period rather
than assuming a month. It is not a segment.

**Why it is not half-built.** A Uke/Måned segment that redrew the same monthly numbers under a
"Uke" label would be a control that lies — and this repo bans stub surfaces outright
(`lib/cardRegistry.ts`'s `'none'` note, and the deleted `ComingSoonBody`).

| | |
|---|---|
| **A** | Leave it monthly. The card is honest and complete for a monthly household budget. |
| **B** | Build the weekly period properly: new field, migration, both reset boundaries. |

**Blocks:** nothing — the card ships useful either way.


### v3 mockup: is this a visual pass, or an information-architecture change?

**Asked 2026-09-06.** The brief was *"update visual to match v3 here, with v2 Energy"*, with
`UnFocus_Screens_v3.html` and `Corrected_Screens_v2_1.html` attached.

The **card system** in v3 — glass on an accent-washed backdrop, one connected row surface with an
accent rail, a two-control header (chevron then ⤢), peek lines in words instead of a bare `0` —
is essentially what the app already draws. `docs/audit/DESIGN_GAP_2026-09-06.md` reached the same
conclusion against round 19/20 and listed what was left. Three of its open items are exactly the
places v3 still differs, so that part is unambiguous and is being built:

- **gap 6** — Shop's per-week empty state offers two competing actions; v3 wants one line, one button.
- **gap 7** — Shop's fresh-install empty state has no action button and sits above the card rather than as its body.
- **gap 8** — group rows draw `SectionRail`'s icon-badge + ALL-CAPS + hairline; v3 draws a boxed dot + label + count + chevron.
- plus **v2's Energibudsjett card**, which is a different model from the shipped one and is named explicitly in the brief.

**What needs a ruling is that v3 also moves features between tabs, and removes some.** None of
this is a styling choice, and an agent cannot legitimately choose it:

| tab | shipped today | v3 draws | change implied |
|---|---|---|---|
| Hjem | Notater · I dag · **Handleliste** | Notater · I dag · **Vaner** | swap the shopping preview for a habits preview |
| Handle | Handlelister · **Mat** · Katalog | Handlelister · Katalog *(Varer/Retter tabs)* · **Budsjett** | fold Mat into Katalog as a tab; **build a new Budsjett card** |
| Gjøremål | I dag · **Kalender** · Når som helst · **Gjentakende** | Når som helst · I dag · **Planlegger** | **drop Kalender and Gjentakende**; build a new Planlegger |
| Helse | **Denne uken** · Helseplager · Medisin | Helseplager · Medisin | **drop Denne uken** |

v3 also re-models the shopping list itself: one list with three sections a row moves between on
tap (**I lista → I kurven → Kjøpt**), which is not how `WeekListCard` works today.

**Measured cost.** The additive half (Budsjett, Planlegger, Katalog tabs) is new surfaces and new
registry entries — large, but it breaks nothing. The subtractive half is different in kind:
`todoCalendar`, `todoRecurring`, `healthWeek` and `shopDishes` are **shipped cards with user data
behind them** and `fold: 'persisted'` storage keys. Removing a card does not remove its rows, and
a user who has recurring tasks or a week of health logs would lose the only surface that shows
them.

**Options**

| | what gets built | risk |
|---|---|---|
| **A** | Visual only — gaps 6/7/8 + the v2 Energibudsjett card. Tabs and cards stay as they are. | None to data. Screens will not match v3's card *lists*. |
| **B** | A + the additive half: build Budsjett, Planlegger and Katalog's Varer/Retter tabs, keep every existing card. | Larger, but nothing is removed. Some tabs carry more cards than v3 draws. |
| **C** | Full v3 — B, plus dropping Kalender, Gjentakende, Denne uken and Mat, plus the three-section shopping model. | Removes surfaces that are the only way to reach existing user data. Needs a per-card answer on what happens to that data. |

**Blocks:** everything past the visual pass.

> **ANSWERED 2026-09-06 — option C, full v3.** Maintainer, in the same breath: *"Make sure
> backdrop and glass looks like V2, and it seems that Energy has not been fixed based on the
> screenshots."*
>
> Two corrections that ruling carries, both accepted:
> 1. **The v2 Energibudsjett card was never built.** PR #673 only changed the CTA's `variant`
>    from `primary` to `secondary` (removing its halo). The card itself is still the shipped
>    pip-row + "Set the day's energy" starter, not v2's filled/outline flash budget with its
>    brukt / igjen / gitt tilbake legend and I dag / Uke segment. Calling the energy item
>    "done" after #673 was wrong; it is open and in scope here.
> 2. **The backdrop and the glass are in scope too.** v2 draws three radial accent washes per
>    tab behind the stack, which is what gives the card material something to blur — the mockup's
>    own note is *"Glass had nothing to blur… cards sat on flat near-black, so blur produced
>    uniform grey slabs."* That has to match v2, not just the card shapes.
>
> The subtractive half of C still needs a per-card answer on existing user data before anything
> is deleted; that is now its own row below rather than a reason to hold the rest.
>
> **ANSWERED 2026-09-07 — nothing is deleted; the surfaces are ABSORBED.** Maintainer:
> *"Food/Dishes is a tab with Catalogue now in its own card. Calendar, Recurring and this week
> is part of planning card."*
>
> That dissolves the data question rather than answering it, which is the better outcome: no
> card is removed, so no rows are orphaned and no migration is needed. Each surface moves down
> one level in the same boundary move `shopMonthly` already made on 2026-08-26 — *"turned into a
> SECTION drawn inside `shopLists`… it held no user data of its own to justify [being a card]"*.
>
> | shipped card | becomes |
> |---|---|
> | `shopDishes` (Mat / Food) | the **Retter** tab of `shopCatalogue`, beside **Varer** — v3's *"Katalog = ett kort, to faner"* |
> | `todoCalendar` (Kalender) | a section of the new **Planlegger** card |
> | `todoRecurring` (Gjentakende) | a section of the same Planlegger card |
> | To-do's *this week* | a section of the same Planlegger card |
>
> ⚠️ **Each of these keys is a STORAGE KEY** (`fold: 'persisted'` → `settings.collapsedCards`),
> so retiring one re-opens that surface for anyone who had folded it — `lib/cardRegistry.ts`'s
> own edit note, and the reason the four To-do keys were renamed with a `lib/db.ts` migration in
> 2026-08-21. Same treatment applies here.
>
> **Still unanswered:** Helse's *"Denne uken"* (`healthWeek`). v3's Helse draws only Helseplager
> and Medisin, and the ruling above names Calendar, Recurring and "this week" together as
> planning — which reads as To-do's week rather than Health's. `healthWeek` is therefore left
> exactly as it is until asked about; it is the one card in the subtractive list with no stated
> destination, and guessing one would put a week of health logs behind a surface nobody chose.

---

---

### The orphaned "Glass surfaces" setting: retire the field, or give it a new job?

**Asked 2026-09-15**, when #706 removed the card's lit/shaded edge and left the switch with
nothing visible to change. `components/Surface.tsx` cites this entry; it did not exist until now,
which is itself the kind of dangling reference `#699` cleaned up.

The row is already gone from Settings — the maintainer's call, and the right one: a toggle that
changes nothing a user can see is the defect `__tests__/glassMaterial.test.ts` exists to catch,
and `components/AddFAB.tsx` records the last time this same setting went quietly inert app-wide.

What is NOT decided is the field. `settings.glassSurfaces` still exists, still defaults `true`,
still has its DB column, and nothing reads it. Under the never-drop rule (`lib/db.ts`,
`store/useSettingsStore.ts`) the column must stay whatever happens — a retired setting keeps its
column so an old backup stays readable. The open question is only whether the FIELD is:

  (a) left inert and documented as retired — cheapest, and honest as long as the "no dead reads"
      guard stays pointed at it, but it is one more thing a future reader has to be told is dead;
  (b) given a new job — the obvious candidate is the `getGlow()` halos, which currently survive
      BOTH `glassSurfaces` and `reduceEffects` while the Settings copy for the latter claims
      otherwise (`lib/i18n.ts`, "Turns off card shadows…"). That would make the switch real again
      AND fix a live over-promise, at the cost of it meaning something different from its name;
  (c) formally deprecated in the store's type with a `@deprecated` tag, the way `childProfiles`
      already is — no behaviour change, but the next reader is told without having to grep.

**Blocks:** nothing. Every pane is opaque and nothing reads the field, so the app behaves
identically under all three. It blocks only the question of how long a dead field sits there
unlabelled.

---

### ANSWERED 2026-09-15 — (c), the `@deprecated` tag.

Not (a): "left inert and documented" is what it already was, and the documentation lived in this
file rather than at the declaration, which is the wrong place for it — a reader meets the field
in `store/useSettingsStore.ts`, not here.

Not (b): giving it the `getGlow()` halos would make the switch real again, but it would mean
bringing the ROW back with a different meaning than its name, days after the maintainer retired
it. The halos surviving `reduceEffects` while its copy claims otherwise is a real bug and is
still open — it is just not this field's job to fix, and pinning it here would have hidden it.

So (c): `glassSurfaces` and `opaqueCards` both carry `@deprecated INERT since 2026-09-15` at the
declaration, the way `childProfiles` already did, with the three-pass history of how they were
retired and the never-drop rule spelled out. The columns stay. Nothing reads them, and
`glassMaterial.test.ts` fails if anything starts.

#### SUPERSEDED for `glassSurfaces` the same day — it is (b) after all, with its own name back

The frosted-glass brief landed hours later and made the pane a RAMP with a specular rim
(`constants/theme.ts`'s `getGlassPane`), so the switch has something visible to change again —
it paints the pane flat. That is (b), "given a new job", except that the job is the one the
switch already had: **reduce transparency**, restated in terms of the material the app actually
draws. The objection recorded above against (b) was specifically that the `getGlow()` candidate
would have meant *"bringing the ROW back with a different meaning than its name"*; this does not,
which is the whole reason it clears a bar that one did not.

So: the row is back in Settings, the field reads again, and `glassMaterial.test.ts`'s guard is
inverted rather than deleted — it now extracts the four-term `paneOn` predicate and evaluates its
truth table, because a boolean that has gone constant is this file's own recurring defect and a
source-text scan cannot see one.

⚠️ **`opaqueCards` stays retired, inert and `@deprecated`.** It was the card-only half of
`glassSurfaces`, and two overlapping switches over the same property is what made the 2026-08-15
pair confusing enough to need retiring in the first place. The answer above still stands for it.

⚠️ **The `getGlow()` over-promise is still open and still nobody's job.** The halos survive both
switches while `reduceEffects`' copy claims otherwise (`lib/i18n.ts`, "Turns off card shadows…").
Recorded here so reviving `glassSurfaces` does not look like it was fixed.

## Answered

### Does Home's energy card stay a capacity budget, or become a daily Lav/Middels/Høy level?
**Asked:** 2026-09-06 · **Answered:** 2026-09-06 · **Blocked:** the maintainer's Home-screen
device sign-off, and any further "make Home match the round-20 mockup" work.

The maintainer sent a Home screenshot saying it doesn't look like the design they sent.
Enumerated against `DESIGN_COMPARISON/20-corrected-screens.html`'s Home entry (its `fixes:`
array, line ~124), almost everything already matches or was deliberately superseded — except
this one, which is also the most visually prominent thing on the screen.

The mockup's own words: *"**Energy** was a lone glowing pill floating outside any card — now a
slim card with three chips, glow only on the chosen one."*

What actually ships (`components/EnergyMeter.tsx:695-748`): on a fresh install, a `StarterCard`
with a decorative row of 10 empty pips and one large primary button, "Sett dagens energi", which
opens `EnergyConfigSheet`. Once configured it becomes a `current / capacity` pip strip.

**These are two different mental models, not two renderings of one.** The shipped feature is a
numeric energy *budget* you spend against (`store/useEnergyStore.ts`, `lib/energy.ts`, ~10
maintainer revisions 2026-07-20 → 2026-08-17). The mockup draws a daily energy *level*
check-in. No Lav/Middels/Høy control exists anywhere in the repo, at any commit.

Measured record search: `PROGRESS_LOG.md`, `20-IMPLEMENTATION.md`, `DESIGN_RULES_AUDIT.md`,
`DECISIONS_OPEN.md` and `docs/archive/AGENTS_HISTORY.md` contain **no** record of this being
shipped, declined or reversed. Notably `20-IMPLEMENTATION.md` — the doc that turned these
mockups into phases 0-6 and itemises every other fix by name — never mentions Energy at all.
Against that, `DESIGN_RULES_AUDIT.md:340-358` records a *different* Energy-mockup divergence
being explicitly declined in August, so this project does normally write such rejections down.
Read either way, the round-20 silence is ambiguous — hence this row.

| option | cost |
|---|---|
| A. Build the daily Lav/Middels/Høy level picker as drawn | **L.** A new concept alongside the existing budget: new store field, new i18n, new UI, and a ruling on how it interacts with `energyDeltaForDay` and the pips. `EnergyMeter.tsx`'s header carries ~2000 words of accumulated rationale that would need rewriting. Risks two competing energy concepts in one app. |
| B. Keep the budget; record the mockup's energy card as superseded | **XS, docs only.** Nothing visual changes. The screenshot keeps looking as it does. Honest if the budget system is the intended design. |
| C. Keep the budget, fix the actual complaint: put the CTA *inside* a slim card instead of a lone glowing pill | **S.** Addresses the mockup's stated problem ("floating outside any card") without adopting its mechanism. Touches `EnergyMeter.tsx`'s empty state only; the budget model is untouched. |

Not a bug and not a cleanup task — A and B produce materially different apps, and C is a third
thing that resembles the mockup without being it. An agent cannot legitimately choose this.

**Answer: C.** The maintainer kept the capacity/budget model and had the CTA moved inside a slim
card. The mockup's Lav/Middels/Høy level picker is **not** being built — the complaint it was
answering was that the button floated outside any card, and that is what gets fixed. Do not
re-propose the level picker; the budget model is the intended design, and `EnergyMeter.tsx`'s
header rationale stands. Implemented 2026-09-06, `unverified` pending a device pass.

### Does the 💡 hint line show on a card with content, or on an empty one?
**Asked:** 2026-09-06 · **Answered:** 2026-09-06 (same turn) · **Blocked:** wiring the hint on
Home's three cards, which had never been wired at all — the unshipped half of round 20 phase 4.

`components/CardHintLine.tsx` shipped with the rule "draws only on a card that HAS content", and
all four call sites gate on a non-empty length (`TodoSurface.tsx:1349,1464`,
`HabitsSurface.tsx:797`, `HealthSurface.tsx:498`). The round-20 mockup agrees — its Home `I dag`
card draws the hint together with three rows.

**Answer: the opposite — the hint shows when the card is EMPTY.** Maintainer's ruling, in their
words: *"Hint er kun når et kort er tomt."* The reasoning is the ADHD-friendly one and is why it
outranks the mockup here: a hint like *"Del det opp til det blir litt latterlig"* is help for
someone staring at an empty list, not decoration over rows they already have.

⚠️ **This deliberately contradicts `DESIGN_COMPARISON/20-corrected-screens.html`.** A later
maintainer ruling outranks a mockup. Applied consistently app-wide — every call site flipped,
not just Home's — because a hint that means "you have nothing here" on one tab and "here is a
tip about your rows" on another is the inconsistency this project keeps paying for. Do not
"correct" it back toward the mockup.

### Do runs of tasks and notes read as one connected list, or as separate cards?
**Asked:** 2026-09-06 · **Answered:** 2026-09-06 · **Blocked:** Phase 1 S1.1–S1.3, and the scope
of every row-convergence session after it.

Measured 2026-09-06 (`docs/audit/ROW_ENUMERATION.md`): 10 row-drawing surfaces exist. 4 use the
shared recipe `lib/rowList.ts`. 6 don't, and they are six DIFFERENT shapes, not six copies of one.

The Plans day view was deliberately changed on 2026-08-28 because four tasks read as four cards.
The To-do tab still draws exactly that: each task is its own card with an 8px gap
(`TodoSurface.tsx:1726`). Notes does the same (`NotesSurface.tsx:172`). So the app currently
answers this question two different ways.

| option | cost |
|---|---|
| A. Converge tasks + notes to connected rows | Matches the 2026-08-28 ruling. Visible change on two main tabs. `TaskCard` and `NoteRow` each lose their own card shell. Multiple sessions. |
| B. Leave them as cards; narrow the invariant to say connected rows is one pattern among several, not a universal target | Nothing changes visually. The invariant stops overclaiming. The 6 stay uncovered permanently, by decision rather than by neglect. |
| C. Converge only `ShoppingRow`, `MonthlyTableRow`, `MedicineSurface` — the three already trying to be rows — and exclude the card-shaped ones explicitly | Middle. Fixes real drift without restyling two main tabs. |

Not a bug and not a cleanup task — the three options produce three different-looking apps.

**Answer: C.** `ShoppingRow`, `MonthlyTableRow`, and `MedicineSurface` are lists of same-kind
items with no per-item identity worth a card shell — closer in spirit to what `PadSheet` /
`HabitsSurface` / `PlanTaskCard` already converged than to a card. `TaskCard` and `NoteRow` are
different: each is a distinct, individually-actionable item on a tab whose 2026-08-28 ruling
(Plans day view) does not by itself extend to Todo/Notes — pulling those into rows would be a
visible redesign of two main tabs that nobody has asked for and that this decision alone
shouldn't authorize. `SettingRow` stays out on its own terms (grouped-list convention, not a
connected list — `ROW_ENUMERATION.md` Part 1 agrees this one arguably *shouldn't* converge).

Follow-through: `MonthlyTableRow` and `MedicineSurface` currently have no box at all (flush rows,
per `ROW_ENUMERATION.md`), so converging them is new surface, not an import — each is its own
session, sized and scoped the way S1.0 was for `ShoppingRow`. `INVARIANTS.md`'s row-recipe entry
should be narrowed to name these three as the target set, with `TaskCard`/`NoteRow`/`SettingRow`
recorded as deliberately out of scope rather than left looking like an oversight.

**Amendment, 2026-09-06.** `ShoppingRow` is removed from this decision's scope. It is already a
connected row list and is therefore governed by `DESIGN_RULES.md` rule 5 regardless of how A/B/C
resolved — bringing it into conformance is not a convergence choice this decision authorises, it
is conformance to a rule that already binds it. That work is session S1.0 and does not depend on
this answer. The decision's live scope is `MonthlyTableRow` and `MedicineSurface` only (sessions
S1.2 and S1.3).

### Should the pixel gate run in CI, and what would we pay for it?
**Asked:** 2026-08-29 · **Answered:** 2026-08-30 · **It was a bug, not a trade.**

The premise was wrong. This was filed as a cost question — pin the toolchain, bless from CI,
raise the tolerance, or containerise the capture — because all 21 baselines came back "changed"
by a uniform 0.1-1.05% on the runner and that looked like an environment difference nobody could
close cheaply.

It was a **dependency range**. `@playwright/test` sat on `^1.61.1`, so the library had drifted
to a version whose launch defaults render text differently from the one that blessed the
baselines, while this environment's pre-installed Chromium stayed at the 1194 build that
Playwright **1.56** pins. CI installed what the library asked for; local used what the machine
had; neither was wrong and they disagreed.

⚠️ **The browser BINARY was not the variable** — `chromium.executablePath()` resolves to the same
`chromium-1194` on either library version, and launching it reports the same `141.0.7390.37`.
Re-blessing was still needed when the library moved. So the thing to pin is the LIBRARY, and the
hardcoded browser path this repo used to carry in seven scripts actively hid the problem by
making the local run look stable while CI diverged.

Fixed by pinning to `~1.56.0` and deleting the revision from the code entirely (every harness now
lets Playwright resolve the browser it pins). `lib/__tests__/visualGate.test.ts` keeps the range
on `~`, keeps a revision out of the scripts, and asserts CI still runs the gate. None of the four
costed options was paid.

### Card density: the mockup's 12px against a 6-rung spacing scale
**Asked:** 2026-08-29 · **Answered:** 2026-08-29 · **Blocked:** round 20 phase 1, and every
"the app feels less dense than the mockup" report since.

The mockup (`DESIGN_COMPARISON/20-MEASUREMENTS.md` §1) wants a 12px card gap and 12px of
breathing room against the app's `SCREEN_GAP` 16 and `CHROME_REST_GAP` 8. 12 is not a rung on
the `Spacing` scale, so taking it means widening the scale.

| option | cost |
|---|---|
| Add a 12 rung and use it | The scale goes 6 rungs → 7. Closest to the mockup. |
| Tighten within the scale (16 → 8) | Scale stays pure; a bigger trim than asked for, likely too tight. |
| Leave it | The gap between mockup and app stays, and gets re-reported. |

**Answer: add the 12 rung** — *"12px, but also focus on where and how things are placed as well.
Just decreasing pure space is not the entire thing."*

So the follow-through is not only the gap: the same measured table has the bottom nav at 72
against the mockup's 54, the header at 67 against 60, and `Radius.md` at 16 against 20 — and
round 19's phase 8 (Manage cards generalised beyond Home) is still unbuilt, which is the
"where things are placed" half.
