/**
 * sqlite.ts — Opens the shared `unfocus.db` SQLite handle.
 *
 * Split out of lib/db.ts so a `.web` sibling can swap the backing engine for
 * web preview builds without touching schema/migration code.
 *
 * Connections:
 *   Imports → expo-sqlite
 *   Used by → lib/db.ts
 *   Data    → owns the raw `unfocus.db` handle (schema lives in lib/db.ts)
 */
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('unfocus.db');
