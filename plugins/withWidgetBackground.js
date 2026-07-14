/**
 * withWidgetBackground.js — Expo config plugin: give the Android widgets an opaque,
 * theme-aware, rounded native background.
 *
 * WHY: react-native-android-widget paints the widget's background colour INSIDE the
 * JS-rendered bitmap and its native RemoteViews layout (res/layout/rn_widget.xml) is fully
 * transparent (root FrameLayout + both ImageViews = @android:color/transparent, drawn
 * scaleType="matrix" = unscaled). So any moment the current bitmap doesn't exactly cover the
 * widget bounds — the initial plant (before the first bitmap arrives) and a resize (the old,
 * smaller bitmap isn't stretched) — the launcher wallpaper shows straight through. There is no
 * native background to fall back to.
 *
 * WHAT: after prebuild, this drops an opaque rounded background drawable (day + night variants)
 * into the app module and overrides the library's rn_widget.xml with a faithful copy that sets
 * android:background="@drawable/rn_widget_bg" on the root FrameLayout. App-module resources win
 * over a library dependency's same-named resource at merge time, so exposed/initial areas now
 * paint the correct opaque colour instead of transparent.
 *
 * MAINTENANCE:
 *   - The rn_widget.xml copy below MUST keep every view id the library's native code references
 *     (@android:id/background, rn_widget_image_light, rn_widget_image_dark,
 *     rn_widget_clickable_container, rn_widget_collection_container). Re-verify it against
 *     node_modules/react-native-android-widget/android/src/main/res/layout/rn_widget.xml on ANY
 *     react-native-android-widget upgrade (the dep is pinned ~0.20.3 in package.json for this
 *     reason). If the library's layout ids/structure change, update the copy to match.
 *   - Colours mirror LIGHT/DARK `bg` in lib/widgets/WidgetViews.tsx; the 20dp corner radius
 *     mirrors FRAME.borderRadius there. Keep them in sync if the bitmap's frame changes.
 *   - This is native surface — it only takes effect after a new build (maintainer-gated), never
 *     via OTA.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Solid, rounded background. Light (#FFFFFF) and night (#0F1B2E) mirror WidgetViews.tsx.
const bgDrawable = (color) => `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="${color}" />
    <corners android:radius="20dp" />
</shape>
`;

// Faithful copy of react-native-android-widget's rn_widget.xml with ONE change:
// android:background on the root FrameLayout. All view ids are preserved verbatim.
const layout = `<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@android:id/background"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/rn_widget_bg">

    <ImageView
        android:id="@+id/rn_widget_image_light"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="@android:color/transparent"
        android:scaleType="matrix"
        android:visibility="visible" />

    <ImageView
        android:id="@+id/rn_widget_image_dark"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="@android:color/transparent"
        android:scaleType="matrix"
        android:visibility="gone" />

    <FrameLayout
        android:id="@+id/rn_widget_clickable_container"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

    <FrameLayout
        android:id="@+id/rn_widget_collection_container"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</FrameLayout>
`;

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

const withWidgetBackground = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      writeFile(path.join(res, 'drawable', 'rn_widget_bg.xml'), bgDrawable('#FFFFFF'));
      writeFile(path.join(res, 'drawable-night', 'rn_widget_bg.xml'), bgDrawable('#0F1B2E'));
      writeFile(path.join(res, 'layout', 'rn_widget.xml'), layout);
      return cfg;
    },
  ]);

module.exports = withWidgetBackground;
