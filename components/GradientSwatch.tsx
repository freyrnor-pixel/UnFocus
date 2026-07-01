/**
 * GradientSwatch.tsx — radial/conic gradient swatches using native SVG rendering.
 *
 * RadialSwatch renders a light-center → saturated-edge radial gradient as a true
 * SVG circle with RadialGradient. ConicSwatch renders a color-wheel sweep gradient
 * as SVG conic (if supported cleanly) or falls back to concentric wedges with a TODO.
 *
 * Connections:
 *   Imports → constants/theme, react-native-svg
 *   Used by → app/settings.tsx (colour-theme swatches + custom hue picker)
 *   Data    → none (pure rendering, colors passed in as props)
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { mix } from '@/constants/theme';

type RadialProps = {
  color: string;
  size: number;
};

/** Light-center → saturated-edge radial gradient using SVG RadialGradient. */
export function RadialSwatch({ color, size }: RadialProps) {
  const gradientId = `radial-${color.replace('#', '')}`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient
          id={gradientId}
          cx="50%"
          cy="50%"
          rx="50%"
          ry="50%"
        >
          <Stop offset="0%" stopColor={mix(color, '#FFFFFF', 0.75)} />
          <Stop offset="33%" stopColor={mix(color, '#FFFFFF', 0.5)} />
          <Stop offset="66%" stopColor={mix(color, '#FFFFFF', 0.25)} />
          <Stop offset="100%" stopColor={color} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

type ConicProps = {
  size: number;
  /** Color stops sampled around the wheel, evenly spaced (e.g. 12-24 hue steps). */
  colors: string[];
};

/**
 * Conic/rainbow-wheel gradient using SVG wedges.
 * TODO: Decision 006 defers custom hue — conic gradient support deferred to Decision 007+.
 * Current implementation uses thin wedge Views rotated around center (same as before).
 */
export function ConicSwatch({ size, colors }: ConicProps) {
  const n = colors.length;
  const wedgeWidth = (Math.PI * size) / n + 1;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {colors.map((c, i) => {
        const angle = (360 / n) * i;
        return (
          <View
            key={i}
            style={[
              {
                position: 'absolute',
                width: wedgeWidth,
                height: size / 2,
                backgroundColor: c,
                left: size / 2 - wedgeWidth / 2,
                top: 0,
                transform: [{ translateY: size / 2 }, { rotate: `${angle}deg` }, { translateY: -size / 2 }],
              },
            ]}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: (size * 0.35) / 2,
          top: size * 0.325,
          left: size * 0.325,
          backgroundColor: '#FFFFFF',
          opacity: 0.15,
        }}
      />
    </View>
  );
}
