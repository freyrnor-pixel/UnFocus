// metro.config.js — adds .wasm as a resolvable asset extension so
// expo-sqlite's web backend (wa-sqlite/WASM) bundles for `expo export --platform web`.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
