/**
 * UnFocus — Colour Schemes
 * Five schemes × light/dark, each with a coordinated nine-colour bubble-wheel
 * palette built as an analogous harmony.
 *
 * Usage:
 *   import { SCHEMES } from '@/constants/colors';
 *   const palette = SCHEMES[userScheme];          // e.g. SCHEMES['default']
 *   const colors  = isDark ? palette.dark : palette.light;
 */

export type SchemeName = 'default' | 'tech' | 'nature' | 'fluffy' | 'gothic';

export interface ColorPalette {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  bgApp: string;
  surfaceCard: string;
  surfaceSunken: string;
  surfaceChip: string;
  surfaceOverlay: string;

  // ── Brand ────────────────────────────────────────────────────────────────
  primary: string;
  primarySoft: string;
  onPrimary: string;
  secondary: string;
  secondarySoft: string;
  accentDeep: string;

  // ── Text ─────────────────────────────────────────────────────────────────
  textBody: string;
  textMuted: string;
  textInverted: string;

  // ── Borders ──────────────────────────────────────────────────────────────
  borderCard: string;
  borderInput: string;
  borderDivider: string;

  // ── Status ───────────────────────────────────────────────────────────────
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  neutral: string;

  // ── Hint surface ─────────────────────────────────────────────────────────
  hintBg: string;
  hintBorder: string;
  hintAccent: string;

  // ── Bubble-wheel feature palette (nine accents) ───────────────────────────
  featureTask: string;
  featureScan: string;
  featureHabits: string;
  featureHealth: string;
  featureMeals: string;
  featureShop: string;
  featureShared: string;
  featureFocus: string;
  featureCapture: string;
  bubbleInk: string;       // single icon/label colour for the whole wheel

  // ── Shadows (colour component only; use with elevation tokens) ───────────
  shadowColor: string;
}

type SchemeVariants = { light: ColorPalette; dark: ColorPalette };

// ── Default — watercolour blue, arc 205°→262° ─────────────────────────────
const defaultLight: ColorPalette = {
  bgApp: '#F2F8FE',
  surfaceCard: '#FCFDFF',
  surfaceSunken: '#E8F2FE',
  surfaceChip: '#DCEEFC',
  surfaceOverlay: 'rgba(0,0,0,0.5)',
  primary: '#2563EB',
  primarySoft: '#BFDBFE',
  onPrimary: '#FFFFFF',
  secondary: '#10B981',
  secondarySoft: '#A7F3D0',
  accentDeep: '#1E3A8A',
  textBody: '#0F1C2E',
  textMuted: '#6B7280',
  textInverted: '#FFFFFF',
  borderCard: '#E5E7EB',
  borderInput: '#D1D5DB',
  borderDivider: '#DCEEFC',
  success: '#16A34A',
  successSoft: '#DBEAFE',
  warning: '#EAB308',
  warningSoft: '#FEFCE8',
  error: '#DC2626',
  errorSoft: '#FEE2E2',
  neutral: '#9CA3AF',
  hintBg: '#E9EFFD',
  hintBorder: '#B3C8F8',
  hintAccent: '#2563EB',
  featureTask: '#2572AA',
  featureScan: '#2A6EC0',
  featureHabits: '#3468D3',
  featureHealth: '#4865D7',
  featureMeals: '#5761DA',
  featureShop: '#635DDB',
  featureShared: '#7059DA',
  featureFocus: '#7C53D9',
  featureCapture: '#894DD8',
  bubbleInk: '#FFFFFF',
  shadowColor: 'rgba(30,41,59,0.12)',
};

const defaultDark: ColorPalette = {
  bgApp: '#070B16',
  surfaceCard: '#32353E',
  surfaceSunken: '#1B1F29',
  surfaceChip: '#474951',
  surfaceOverlay: 'rgba(0,0,0,0.7)',
  primary: '#4EA8FC',
  primarySoft: '#1C3A66',
  onPrimary: '#07101F',
  secondary: '#34D399',
  secondarySoft: '#0D2A1A',
  accentDeep: '#8FC7FF',
  textBody: '#E6F1FE',
  textMuted: '#8FB8DE',
  textInverted: '#07101F',
  borderCard: '#4EA8FC',
  borderInput: '#3A4A5E',
  borderDivider: '#474951',
  success: '#34D399',
  successSoft: '#0D2A1A',
  warning: '#FCD34D',
  warningSoft: '#1A1400',
  error: '#FC8181',
  errorSoft: '#2A0A0A',
  neutral: '#52708C',
  hintBg: '#122236',
  hintBorder: '#244766',
  hintAccent: '#6CB8FD',
  featureTask: '#2572AA',
  featureScan: '#2A6EC0',
  featureHabits: '#3468D3',
  featureHealth: '#4865D7',
  featureMeals: '#5761DA',
  featureShop: '#635DDB',
  featureShared: '#7059DA',
  featureFocus: '#7C53D9',
  featureCapture: '#894DD8',
  bubbleInk: '#FFFFFF',
  shadowColor: 'rgba(0,0,0,0.6)',
};

// ── Tech — cyan→indigo, arc 172°→250° ────────────────────────────────────
const techLight: ColorPalette = {
  bgApp: '#F0F5FC',
  surfaceCard: '#FCFEFF',
  surfaceSunken: '#E8F1FB',
  surfaceChip: '#D8E8F5',
  surfaceOverlay: 'rgba(0,0,0,0.5)',
  primary: '#0EA5E9',
  primarySoft: '#BAE6FD',
  onPrimary: '#FFFFFF',
  secondary: '#06B6D4',
  secondarySoft: '#CFFAFE',
  accentDeep: '#0369A1',
  textBody: '#0C1A28',
  textMuted: '#4A6070',
  textInverted: '#FFFFFF',
  borderCard: '#C0D8F0',
  borderInput: '#A8C8E8',
  borderDivider: '#D8E8F5',
  success: '#06B6D4',
  successSoft: '#CFFAFE',
  warning: '#EAB308',
  warningSoft: '#FEFCE8',
  error: '#F43F5E',
  errorSoft: '#FFE4E6',
  neutral: '#8AAAC0',
  hintBg: '#E7F6FE',
  hintBorder: '#AEE0FB',
  hintAccent: '#0EA5E9',
  featureTask: '#1B7781',
  featureScan: '#1E7591',
  featureHabits: '#2272A5',
  featureHealth: '#276CBD',
  featureMeals: '#3266D5',
  featureShop: '#4961DA',
  featureShared: '#595DDD',
  featureFocus: '#6858DD',
  featureCapture: '#7652DB',
  bubbleInk: '#FFFFFF',
  shadowColor: 'rgba(12,26,40,0.12)',
};

// ── Nature — amber→green→teal, arc 38°→152° ──────────────────────────────
const natureLight: ColorPalette = {
  bgApp: '#F2FAF4',
  surfaceCard: '#FCFFFD',
  surfaceSunken: '#E8F5EC',
  surfaceChip: '#D8EEE0',
  surfaceOverlay: 'rgba(0,0,0,0.5)',
  primary: '#16A34A',
  primarySoft: '#BBF7D0',
  onPrimary: '#FFFFFF',
  secondary: '#15803D',
  secondarySoft: '#DCFCE7',
  accentDeep: '#3F6212',
  textBody: '#0D3018',
  textMuted: '#4A7A58',
  textInverted: '#FFFFFF',
  borderCard: '#C0E8CC',
  borderInput: '#A8D8B8',
  borderDivider: '#D8EEE0',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#EAB308',
  warningSoft: '#FEFCE8',
  error: '#DC2626',
  errorSoft: '#FEE2E2',
  neutral: '#8CB89A',
  hintBg: '#E8F8EC',
  hintBorder: '#C2EDCE',
  hintAccent: '#16A34A',
  featureTask: '#83682A',
  featureScan: '#746E25',
  featureHabits: '#677224',
  featureHealth: '#577625',
  featureMeals: '#477826',
  featureShop: '#357A27',
  featureShared: '#277B2B',
  featureFocus: '#277B3E',
  featureCapture: '#277A51',
  bubbleInk: '#FFFFFF',
  shadowColor: 'rgba(13,48,24,0.12)',
};

// ── Fluffy pink — rose↔coral, arc 318°→18° ───────────────────────────────
const fluffyLight: ColorPalette = {
  bgApp: '#FFF5F9',
  surfaceCard: '#FFFDFE',
  surfaceSunken: '#FDE7F1',
  surfaceChip: '#FBE2EE',
  surfaceOverlay: 'rgba(0,0,0,0.5)',
  primary: '#EC4899',
  primarySoft: '#FBCFE8',
  onPrimary: '#FFFFFF',
  secondary: '#2DD4BF',
  secondarySoft: '#CCFBF1',
  accentDeep: '#9D174D',
  textBody: '#4A1530',
  textMuted: '#9B5E7C',
  textInverted: '#FFFFFF',
  borderCard: '#F8D3E4',
  borderInput: '#F0B8D0',
  borderDivider: '#FBE2EE',
  success: '#2DD4BF',
  successSoft: '#CCFBF1',
  warning: '#EAB308',
  warningSoft: '#FEFCE8',
  error: '#E11D48',
  errorSoft: '#FFE4E6',
  neutral: '#E0A8C4',
  hintBg: '#FDEAF3',
  hintBorder: '#F8C6DF',
  hintAccent: '#EC4899',
  featureTask: '#E896CA',
  featureScan: '#E896C1',
  featureHabits: '#E897B8',
  featureHealth: '#E999B0',
  featureMeals: '#E999A8',
  featureShop: '#E99AA0',
  featureShared: '#E89C98',
  featureFocus: '#E69D8F',
  featureCapture: '#E49F86',
  bubbleInk: '#15233B',   // dark ink — Fluffy uses dark text for contrast
  shadowColor: 'rgba(74,21,48,0.13)',
};

// ── Gothic — indigo→violet→magenta, arc 252°→322° ────────────────────────
const gothicLight: ColorPalette = {
  bgApp: '#F5F0FF',
  surfaceCard: '#FEFDFF',
  surfaceSunken: '#F0EAFF',
  surfaceChip: '#EAE5F8',
  surfaceOverlay: 'rgba(0,0,0,0.5)',
  primary: '#7C3AED',
  primarySoft: '#EDE9FE',
  onPrimary: '#FFFFFF',
  secondary: '#8B5CF6',
  secondarySoft: '#F5F3FF',
  accentDeep: '#5B21B6',
  textBody: '#200E40',
  textMuted: '#6B5A8A',
  textInverted: '#FFFFFF',
  borderCard: '#DDD6FE',
  borderInput: '#C4B5FD',
  borderDivider: '#EAE5F8',
  success: '#8B5CF6',
  successSoft: '#F5F3FF',
  warning: '#EAB308',
  warningSoft: '#FEFCE8',
  error: '#E11D48',
  errorSoft: '#FFE4E6',
  neutral: '#A890C8',
  hintBg: '#F1ECFE',
  hintBorder: '#D2C4FB',
  hintAccent: '#7C3AED',
  featureTask: '#6956CC',
  featureScan: '#7750CB',
  featureHabits: '#8549C9',
  featureHealth: '#9340C6',
  featureMeals: '#9E39BE',
  featureShop: '#A835B2',
  featureShared: '#AC34A4',
  featureFocus: '#B03596',
  featureCapture: '#B43685',
  bubbleInk: '#FFFFFF',
  shadowColor: 'rgba(32,14,64,0.12)',
};

export const SCHEMES: Record<SchemeName, SchemeVariants> = {
  default: { light: defaultLight, dark: defaultDark },
  tech:    { light: techLight,    dark: { ...defaultDark, primary: '#38BDF8', primarySoft: '#0C2A40', accentDeep: '#7DD3FC' } },
  nature:  { light: natureLight,  dark: { ...defaultDark, primary: '#4ADE80', primarySoft: '#0A2010', accentDeep: '#BEF264' } },
  fluffy:  { light: fluffyLight,  dark: { ...defaultDark, primary: '#F472B6', primarySoft: '#3A0A20', accentDeep: '#F9A8D4', bubbleInk: '#F0E6FF' } },
  gothic:  { light: gothicLight,  dark: { ...defaultDark, primary: '#A78BFA', primarySoft: '#200E40', accentDeep: '#C4B5FD' } },
};

/**
 * Gradient helpers — call with colors from the active palette.
 * React Native doesn't support CSS gradients natively; use expo-linear-gradient
 * and pass these colour pairs.
 */
export function gradientHero(c: ColorPalette): [string, string] {
  return [c.primary, c.accentDeep];
}
export function gradientSoft(c: ColorPalette): [string, string] {
  return [c.primarySoft, c.secondarySoft];
}
export function gradientWave(c: ColorPalette): [string, string, string, string] {
  return [c.featureTask, c.featureHealth, c.featureShared, c.featureCapture];
}
