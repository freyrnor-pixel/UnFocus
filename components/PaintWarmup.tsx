/**
 * PaintWarmup.tsx — draw the app's expensive paints once, while the splash still covers them.
 *
 * **The report this answers, and why it is a warm-up rather than another optimisation.** Across
 * seven rounds the swipe lag went from *"never varies, always the same lag"* to, after #722,
 * *"Går seg til, men lagger de første gangene, spesielt til og fra hjem og shop."* Reported twice
 * in that shape. A cost that improves with repetition and then stays gone is not per-frame work —
 * swipe twenty would cost what swipe one cost. It is **a cache that starts cold**, and the two
 * pages it hurts most are the two that draw the most (Home 190 nodes / 9 shadow-casting elements,
 * Shop up to 271 / 10; Habits 60 / 3 and Health 71 / 5 were never reported).
 *
 * Two different cold caches produce exactly that symptom, and nothing in this repo can tell them
 * apart — no harness here sees a frame of a swipe (`HARNESS.md`). So this warms **both**:
 *
 *   1. **Skia's program cache.** `getLayeredShadow` is a TWO-pass blurred shadow whose radii scale
 *      per tier (`k` = 1 raised / 1.6 floating / 2.2 chrome), so each tier is a distinct paint,
 *      compiled on first use and cached after. `getGlassPane` adds a `linear-gradient` shader and
 *      two inset shadows. A page outside the pager's clip is never DRAWN — `offscreenPageLimit`
 *      (#719) attaches all five, but attachment is not a draw — so none of it warms until the
 *      first swipe toward that page puts it on screen.
 *   2. **Android's layer texture pool.** #722 promotes a page to a hardware texture for the length
 *      of each drag. The layer is freed at `swipeEnd`, so every swipe allocates one — but the first
 *      full-screen allocations grow the pool, and later ones recycle from it. That is the same
 *      "first few times, then free" curve, caused by the fix rather than by the app.
 *
 * Drawing this component once, full-screen and promoted to a texture, pays both at launch: the
 * blur and gradient programs compile, the glyph atlas takes the app's font, and the pool grows to
 * hold a full-screen layer. All behind the splash, where nobody is waiting on a frame.
 *
 * **Why it is invisible, by construction and not by luck.** It mounts as the FIRST child of the
 * tabs layout's fixed backdrop group, so `ScreenBackground`'s opaque field paints straight over it
 * on the same frame; and it carries `opacity: WARM_ALPHA`, low enough to be imperceptible if it
 * were ever exposed but non-zero because **Android skips drawing a view at alpha 0**, which would
 * make the whole component a no-op. It also unmounts itself after `WARM_FRAMES`, so it costs a
 * mount and two frames and then nothing — `null` for the rest of the session.
 *
 * ⚠️ **Every value here is IMPORTED from `constants/theme.ts`, never transcribed.** A warm-up that
 * compiles a *different* blur radius than the cards use warms nothing and would look correct
 * forever. This is the same "extract, never copy" rule `scripts/build-widget-previews.mjs` carries,
 * and for the same reason — it drifted there once already.
 *
 * ⚠️ **Honest about what it cannot prove.** `renderToHardwareTextureAndroid` is a no-op everywhere
 * a harness can run, and Skia's program cache is invisible to all of them, so whether this removes
 * the first-swipe cost needs the device.
 *   What IS verified, in the web preview and not by reading the source: held mounted (`WARM_FRAMES`
 * raised for the probe), it renders **one container at opacity 0.01 — drawn, not skipped — holding
 * three tiers, each with a blurred non-inset drop shadow on the outer view and the gradient plus
 * the inset pass on the inner one.** That is the exact shape `Surface` draws. Left at 2 frames it
 * is absent moments later, i.e. it retires. `lib/__tests__/paintWarmup.test.ts` then pins the part
 * that would rot silently — that the tiers and values AGREE with `Surface`'s, evaluated through the
 * same helpers rather than compared as text.
 *
 * Connections:
 *   Imports → react-native, constants/theme (getLayeredShadow, getGlassPane, Radius, Fonts),
 *             lib/useAppTheme (the live theme — the warmed paints must be THIS theme's)
 *   Used by → app/(tabs)/_layout.tsx (once, first child of the fixed backdrop group)
 *   Data    → none
 */
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Fonts, getGlassPane, getLayeredShadow, Radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

/**
 * Non-zero on purpose. Android's renderer skips a view at `alpha == 0` entirely, which would make
 * this component compile nothing — the exact silently-dead-code class `CLAUDE.md` A2 records. This
 * is low enough to be imperceptible and high enough to be drawn.
 */
const WARM_ALPHA = 0.01;

/** Frames to stay mounted. Two is enough for one draw pass plus the layer promotion. */
const WARM_FRAMES = 2;

/**
 * The tiers still drawn as a BLURRED `boxShadow`, and therefore still worth compiling early.
 *
 * ⚠️ **`raised` came off this list on 2026-09-17 and must not come back unprompted.** That was
 * the CARD tier, and `Surface` no longer draws a `boxShadow` at all — it uses `elevation`, which
 * the framework draws from the view's outline with a cached shadow and nothing to compile. What
 * remains on the blurred path is `ScreenHeader`'s chrome lift and `CardExpandHost`'s expanded
 * pane. Warming `raised` here would compile a paint the app never draws, which is a warm-up that
 * looks right and warms nothing — so `lib/__tests__/paintWarmup.test.ts` checks this list against
 * the REMAINING callers, and fails if `Surface` starts asking for a layered shadow again.
 */
const WARM_TIERS = ['floating', 'chrome'] as const;

export default function PaintWarmup() {
  const theme = useAppTheme();
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Counted in FRAMES, not milliseconds: one frame to draw the paints, one for the layer
    // promotion to land, then out of the tree for good. A timer would be an arbitrary number
    // racing a variable frame rate; frames are the unit the thing being warmed is measured in.
    let raf = 0;
    let left = WARM_FRAMES;
    const tick = () => {
      left -= 1;
      if (left <= 0) setDone(true);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (done) return null;

  // The card pane, built from the live theme's own stops — see the header's extract-never-copy note.
  const pane = getGlassPane(theme.glassTop, theme.glassBottom, theme.glassRim, theme.glassWell);

  return (
    <View
      pointerEvents="none"
      // Full-screen so the layer Android allocates here is the size a real page needs, which is
      // what grows the texture pool. `renderToHardwareTextureAndroid` is what forces the
      // promotion; it is already a no-op off Android, so no platform check (see HomeHeroBackground).
      renderToHardwareTextureAndroid
      style={[StyleSheet.absoluteFill, { opacity: WARM_ALPHA }]}
    >
      {WARM_TIERS.map((tier, i) => (
        // Two nested views, because `Surface` itself splits them: the blurred DROP shadow sits on
        // the outer shadow-casting view and the pane's two inset hairlines on the inner mask
        // (`Surface.tsx:677` and `:834`). Merging them here would compile a paint the app never
        // draws, which is a warm-up that looks right and warms nothing.
        <View
          key={tier}
          style={{
            position: 'absolute',
            left: 8,
            top: 8 + i * 72,
            right: 8,
            height: 64,
            borderRadius: Radius.lg,
            // The two blurred passes whose programs this exists to compile.
            boxShadow: getLayeredShadow(theme.shadow, tier),
          }}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: Radius.lg,
                backgroundColor: theme.surface,
                // The inset rim and well, as their own pass — same shape as Surface's mask.
                boxShadow: pane.insets,
              },
              // The gradient shader, under the key Surface uses on this platform. Spelled the
              // same way rather than hardcoded: RN 0.85 takes `experimental_backgroundImage`,
              // react-native-web takes `backgroundImage`, and warming the wrong one warms nothing.
              { [Platform.OS === 'web' ? 'backgroundImage' : 'experimental_backgroundImage']: pane.image },
            ]}
          >
            {/* One glyph run per weight the app ships, so the atlas takes them here rather than on
                the first swipe. A few characters is enough — the atlas is keyed by glyph. */}
            <Text style={{ fontFamily: Fonts.regular, color: theme.text }}>Aa0</Text>
            <Text style={{ fontFamily: Fonts.semibold, color: theme.text }}>Aa0</Text>
            <Text style={{ fontFamily: Fonts.bold, color: theme.textMuted }}>Aa0</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
