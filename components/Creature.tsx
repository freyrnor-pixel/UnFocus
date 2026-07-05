/**
 * Creature.tsx — code-drawn companion creature (Decision 039)
 *
 * One SVG component renders all five companion types (cat/dog/bird/fox/bunny) in
 * all five moods (idle/happy/eating/excited/resting). Only the fur colour and the
 * ear shape change between types; moods reshape the face (eyes, cheeks, mouth)
 * rather than swapping to a different picture — so the creature reads as one
 * continuous living character. The idle "blink" loop runs here (self-contained);
 * the breathe / hop / tilt transforms are driven by the parent (Pet.tsx) wrapping
 * this in an Animated.View.
 *
 * Connections:
 *   Imports → constants/petData (part colours), constants/theme (mix)
 *   Used by → components/Pet.tsx, app/onboarding/step6.tsx (inline pet preview)
 *   Data    → none — pure presentational SVG
 *
 * Edit notes:
 *   - Drawn in a 66×86 viewBox. Content is authored in "creature space" (body box
 *     0..66 wide, 0..60 tall, bottom-anchored) and shifted down by PAD_TOP=26 via
 *     one static translate <G>, so ears that sit above the body (negative y) land
 *     in positive SVG space. Keep new coordinates in creature space.
 *   - Gradient/clip ids are prefixed with a per-instance useId() so two mounted
 *     creatures (home + onboarding preview) never collide on SVG def ids.
 *   - Blink is an Animated <G scaleY> about the eye line; it only runs in the idle
 *     mood (other moods set the eyes to static arcs/wide shapes). Reduced motion
 *     pins it open.
 */
import React, { useEffect, useId } from 'react';
import Svg, {
  Defs,
  ClipPath,
  RadialGradient,
  LinearGradient,
  Stop,
  Path,
  Ellipse,
  Circle,
  Polygon,
  Line,
  Rect,
  G,
} from 'react-native-svg';
import Reanimated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { mix } from '@/constants/theme';
import { CREATURE_COLORS, PetState } from '@/constants/petData';
import type { PetType } from '@/store/useSettingsStore';

const AnimatedG = Reanimated.createAnimatedComponent(G);

// Top padding = the tallest ear overhang (bunny ears reach creature-y −24), so the
// viewBox hugs the art and the creature fits the 102px habitat without clipping.
const PAD_TOP = 24;
const VB_W = 66;
const VB_H = 60 + PAD_TOP; // 84

// Eye line (creature space)
const EYE_L = { cx: 23.8, cy: 26.6 };
const EYE_R = { cx: 42.2, cy: 26.6 };

// Body blob outlines per type (creature space). See header for the corner-radius math.
const BODY_STANDARD =
  'M 33 6 A 30 27 0 0 1 63 33 L 63 35.16 A 27.6 24.84 0 0 1 35.4 60 ' +
  'L 30.6 60 A 27.6 24.84 0 0 1 3 35.16 L 3 33 A 30 27 0 0 1 33 6 Z';
const BODY_BIRD =
  'M 33 4 A 30 28 0 0 1 63 32 L 63 33.12 A 28.8 26.88 0 0 1 34.2 60 ' +
  'L 31.8 60 A 28.8 26.88 0 0 1 3 33.12 L 3 32 A 30 28 0 0 1 33 4 Z';

type Props = {
  type: PetType;
  mood: PetState;
  fur: string;
  scale?: number;
  reducedMotion?: boolean;
};

export default function Creature({ type, mood, fur, scale = 1, reducedMotion = false }: Props) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `${uid}-${name}`;

  // Fur-derived tones (see the handoff colour-mix specs).
  const lightCenter = mix(fur, '#FFFFFF', 0.38);
  const bellyCenter = mix(fur, '#FFFFFF', 0.78);
  const bodyShadow  = mix(fur, '#000000', 0.22);
  const innerEar    = mix(fur, CREATURE_COLORS.innerEar, 0.55);
  const dogEar      = mix(fur, '#000000', 0.08);
  const muzzlePale  = mix('#FFFFFF', fur, 0.18);

  const bodyPath = type === 'bird' ? BODY_BIRD : BODY_STANDARD;
  const hasMuzzle = type === 'fox' || type === 'bunny';

  // ── Blink (idle only) ──────────────────────────────────────────────────────
  const blink = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(blink);
    if (mood !== 'idle' || reducedMotion) {
      blink.value = 1;
      return;
    }
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4900 }),
        withTiming(0.08, { duration: 90 }),
        withTiming(1, { duration: 130 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(blink);
  }, [mood, reducedMotion, blink]);

  const blinkProps = useAnimatedProps(() => ({ scaleY: blink.value }));

  const cheekOpacity = mood === 'happy' ? CREATURE_COLORS.cheekHappyOpacity : CREATURE_COLORS.cheekOpacity;

  return (
    <Svg width={VB_W * scale} height={VB_H * scale} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <ClipPath id={id('bodyClip')}>
          <Path d={bodyPath} />
        </ClipPath>
        <RadialGradient id={id('body')} cx="50%" cy="34%" rx="58%" ry="52%">
          <Stop offset="0%" stopColor={lightCenter} />
          <Stop offset="70%" stopColor={fur} />
        </RadialGradient>
        <LinearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <Stop offset="42%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="55%" stopColor={bodyShadow} stopOpacity="0" />
          <Stop offset="100%" stopColor={bodyShadow} stopOpacity="0.5" />
        </LinearGradient>
        <RadialGradient id={id('belly')} cx="50%" cy="40%" rx="60%" ry="62%">
          <Stop offset="0%" stopColor={bellyCenter} stopOpacity="0.9" />
          <Stop offset="74%" stopColor={bellyCenter} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={id('muzzle')} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={muzzlePale} stopOpacity="0.95" />
          <Stop offset="78%" stopColor={muzzlePale} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={id('cheek')} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={CREATURE_COLORS.cheek} stopOpacity={cheekOpacity} />
          <Stop offset="100%" stopColor={CREATURE_COLORS.cheek} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <G transform={`translate(0 ${PAD_TOP})`}>
        {/* Ears — behind the body */}
        {renderEars(type, fur, innerEar, dogEar)}

        {/* Body + volume shading */}
        <Path d={bodyPath} fill={`url(#${id('body')})`} />
        <G clipPath={`url(#${id('bodyClip')})`}>
          <Rect x={3} y={4} width={60} height={56} fill={`url(#${id('rim')})`} />
          <Ellipse cx={33} cy={45} rx={17} ry={15} fill={`url(#${id('belly')})`} />
          <Rect x={3} y={4} width={60} height={56} fill={`url(#${id('shade')})`} />
        </G>

        {/* Pale muzzle patch (fox + bunny) */}
        {hasMuzzle && <Ellipse cx={33} cy={42.2} rx={15} ry={13} fill={`url(#${id('muzzle')})`} />}

        {/* Cheeks */}
        {mood === 'eating' ? (
          <>
            <Ellipse cx={16.06} cy={34.7} rx={5.5} ry={3.5} fill={`url(#${id('cheek')})`} />
            <Ellipse cx={49.94} cy={34.7} rx={7.5} ry={5.5} fill={`url(#${id('cheek')})`} />
          </>
        ) : (
          <>
            <Ellipse cx={16.06} cy={34.7} rx={5.5} ry={3.5} fill={`url(#${id('cheek')})`} />
            <Ellipse cx={49.94} cy={34.7} rx={5.5} ry={3.5} fill={`url(#${id('cheek')})`} />
          </>
        )}

        {/* Nose / beak */}
        {type === 'bird' ? (
          <Polygon points="29,27.6 37,27.6 33,33.6" fill={CREATURE_COLORS.beak} />
        ) : (
          <>
            <Ellipse cx={33} cy={30.8} rx={3} ry={2} fill={CREATURE_COLORS.nose} />
            <Line x1={33} y1={32.8} x2={33} y2={37.8} stroke={bodyShadow} strokeWidth={1.3} strokeLinecap="round" />
          </>
        )}

        {/* Mouth (eating) */}
        {mood === 'eating' && <Ellipse cx={33} cy={44.9} rx={6} ry={5.5} fill={CREATURE_COLORS.mouth} />}

        {/* Eyes — reshape per mood */}
        {renderEyes(mood, blinkProps)}
      </G>
    </Svg>
  );
}

// ─── Eyes ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderEyes(mood: PetState, blinkProps: any) {
  if (mood === 'happy') {
    return (
      <>
        <Path d={arc(EYE_L.cx, EYE_L.cy, true)} stroke={CREATURE_COLORS.eye} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <Path d={arc(EYE_R.cx, EYE_R.cy, true)} stroke={CREATURE_COLORS.eye} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (mood === 'resting') {
    return (
      <>
        <Path d={arc(EYE_L.cx, EYE_L.cy, false)} stroke={CREATURE_COLORS.eye} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <Path d={arc(EYE_R.cx, EYE_R.cy, false)} stroke={CREATURE_COLORS.eye} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      </>
    );
  }
  const wide = mood === 'excited';
  const rx = wide ? 5 : 4;
  const ry = wide ? 6 : 5;
  const hlR = wide ? 2.1 : 1.4;
  const eyeShapes = (
    <>
      <Ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx={rx} ry={ry} fill={CREATURE_COLORS.eye} />
      <Ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx={rx} ry={ry} fill={CREATURE_COLORS.eye} />
      <Circle cx={EYE_L.cx + 1.7} cy={EYE_L.cy - 1.9} r={hlR} fill="#FFFFFF" />
      <Circle cx={EYE_R.cx + 1.7} cy={EYE_R.cy - 1.9} r={hlR} fill="#FFFFFF" />
    </>
  );
  // Only the idle eyes blink; excited eyes are held wide.
  if (wide) return eyeShapes;
  return (
    <AnimatedG animatedProps={blinkProps} originX={33} originY={EYE_L.cy}>
      {eyeShapes}
    </AnimatedG>
  );
}

/** Quadratic arc for happy (⌒) / resting (‿) eyes. */
function arc(cx: number, cy: number, up: boolean): string {
  if (up) return `M ${cx - 4} ${cy + 1} Q ${cx} ${cy - 5} ${cx + 4} ${cy + 1}`;
  return `M ${cx - 4} ${cy - 1} Q ${cx} ${cy + 5} ${cx + 4} ${cy - 1}`;
}

// ─── Ears (type-specific, drawn behind the body) ────────────────────────────────

function renderEars(type: PetType, fur: string, innerEar: string, dogEar: string) {
  switch (type) {
    case 'cat':
      return (
        <>
          <G transform="rotate(-8 15 9)">
            <Polygon points="15,-4 24.24,22 5.76,22" fill={fur} />
            <Polygon points="15,2.76 18.696,18.36 11.304,18.36" fill={innerEar} />
          </G>
          <G transform="rotate(8 51 9)">
            <Polygon points="51,-4 60.24,22 41.76,22" fill={fur} />
            <Polygon points="51,2.76 54.696,18.36 47.304,18.36" fill={innerEar} />
          </G>
        </>
      );
    case 'fox':
      return (
        <>
          <G transform="rotate(-12 13 7)">
            <Polygon points="13,-8 23.08,22 2.92,22" fill={fur} />
            <Polygon points="13,-0.2 17.032,17.8 8.968,17.8" fill={innerEar} />
          </G>
          <G transform="rotate(12 53 7)">
            <Polygon points="53,-8 63.08,22 42.92,22" fill={fur} />
            <Polygon points="53,-0.2 57.032,17.8 48.968,17.8" fill={innerEar} />
          </G>
        </>
      );
    case 'dog':
      return (
        <>
          <G transform="rotate(12 5 21)">
            <Ellipse cx={5} cy={21} rx={10} ry={17} fill={dogEar} />
          </G>
          <G transform="rotate(-12 61 21)">
            <Ellipse cx={61} cy={21} rx={10} ry={17} fill={dogEar} />
          </G>
        </>
      );
    case 'bunny':
      return (
        <>
          <G transform="rotate(-9 21.5 -5)">
            <Ellipse cx={21.5} cy={-5} rx={7.5} ry={19} fill={fur} />
            <Ellipse cx={21.5} cy={-3.86} rx={3.3} ry={13.3} fill={innerEar} />
          </G>
          <G transform="rotate(9 44.5 -5)">
            <Ellipse cx={44.5} cy={-5} rx={7.5} ry={19} fill={fur} />
            <Ellipse cx={44.5} cy={-3.86} rx={3.3} ry={13.3} fill={innerEar} />
          </G>
        </>
      );
    case 'bird':
      // No ears — three small head tufts instead.
      return (
        <>
          <Rect x={31} y={-9} width={4} height={13} rx={2} fill={fur} transform="rotate(-16 33 4)" />
          <Rect x={31} y={-11} width={4} height={15} rx={2} fill={fur} />
          <Rect x={31} y={-9} width={4} height={13} rx={2} fill={fur} transform="rotate(16 33 4)" />
        </>
      );
    default:
      return null;
  }
}
