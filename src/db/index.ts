import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

let pool: any = null;
let db: any = null;
let usePostgres = false;
let lastDbError: string | null = null;

export function getUsePostgres() {
  return usePostgres;
}

export function getDbError() {
  return lastDbError;
}

export async function initDb() {
  lastDbError = null;
  if (!connectionString) {
    console.warn('[Database] DATABASE_URL is not set. Falling back to local JSON database.');
    lastDbError = 'DATABASE_URL is not defined in environment variables.';
    usePostgres = false;
    return false;
  }

  let cleanedConnectionString = connectionString.trim();
  // Strip any wrapping single or double quotes
  if (cleanedConnectionString.startsWith('"') && cleanedConnectionString.endsWith('"')) {
    cleanedConnectionString = cleanedConnectionString.slice(1, -1);
  } else if (cleanedConnectionString.startsWith("'") && cleanedConnectionString.endsWith("'")) {
    cleanedConnectionString = cleanedConnectionString.slice(1, -1);
  }

  const isUrlFormat = cleanedConnectionString.startsWith('postgres://') || cleanedConnectionString.startsWith('postgresql://');
  if (!isUrlFormat) {
    const errorMsg = `DATABASE_URL is missing the "postgresql://" or "postgres://" prefix. Current value starts with: "${cleanedConnectionString.substring(0, 15)}..."`;
    console.warn(`[Database] Warning: ${errorMsg}`);
    lastDbError = errorMsg;
    usePostgres = false;
    return false;
  }

  try {
    const isLocalhost = cleanedConnectionString.includes('localhost') || cleanedConnectionString.includes('127.0.0.1') || cleanedConnectionString.includes('::1');
    const needsSsl = !isLocalhost || cleanedConnectionString.includes('sslmode=') || cleanedConnectionString.includes('ssl=');

    pool = new Pool({
      connectionString: cleanedConnectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000, // 10s timeout
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    
    // Auto-bootstrap schemas if they do not exist
    console.log('[Database] Connection verified. Bootstrapping schemas if needed...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS media_items (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        poster_path TEXT,
        backdrop_path TEXT,
        overview TEXT,
        release_date TEXT,
        genres JSONB,
        rating TEXT,
        runtime INTEGER,
        seasons_count INTEGER,
        episodes_count INTEGER,
        in_watchlist BOOLEAN DEFAULT FALSE,
        is_favorite BOOLEAN DEFAULT FALSE,
        user_rating INTEGER,
        completed BOOLEAN DEFAULT FALSE,
        stopped_watching BOOLEAN DEFAULT FALSE,
        last_watched_at TIMESTAMP,
        seasons JSONB,
        imdb_id TEXT,
        "cast" JSONB,
        directors JSONB
      );
    `);

    // Ensure columns exist for existing databases with a quick lock timeout to prevent blocking on lock contention
    try {
      await client.query(`SET lock_timeout = '3000';`);
      await client.query(`
        ALTER TABLE media_items ADD COLUMN IF NOT EXISTS "cast" JSONB;
        ALTER TABLE media_items ADD COLUMN IF NOT EXISTS directors JSONB;
      `);
    } catch (e: any) {
      console.warn('[Database] Failed to alter table media_items. It might be locked or columns may already exist. Error:', e?.message || e);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS watched_episodes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        show_id INTEGER NOT NULL,
        episode_key TEXT NOT NULL,
        watched_at TIMESTAMP DEFAULT NOW()
      );
    `);

    client.release();

    db = drizzle(pool, { schema });
    usePostgres = true;
    console.log('[Database] PostgreSQL / Supabase initialized successfully and schemas are ready.');
    return true;
  } catch (error: any) {
    lastDbError = error?.message || String(error);
    console.warn('[Database] Failed to connect to PostgreSQL/Supabase database. Error:', lastDbError);
    console.warn('[Database] Falling back to local JSON database.');
    usePostgres = false;
    if (pool) {
      try {
        await pool.end();
      } catch (e) {}
      pool = null;
    }
    return false;
  }
}

// Fallback chainable mock/dummy for compile safety if db is referenced when usePostgres is false
const createChainable = (): any => {
  const p = new Proxy(function() {}, {
    get: (target, prop) => {
      if (prop === 'then') return (resolve: any) => resolve([]);
      if (prop === 'transaction') return async (cb: any) => cb(p);
      return p;
    },
    apply: () => p
  });
  return p;
};

export function getDb() {
  return usePostgres && db ? db : createChainable();
}

export { db };

