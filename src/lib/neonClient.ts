import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_Y9ugKNSJIF7s@ep-solitary-frog-adtwfcgf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

let isTablesInitialized = false;

export async function ensureTablesExist() {
  if (isTablesInitialized) return;
  try {
    await Promise.all([
      sql`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id TEXT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `,
      sql`
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
          cast_data JSONB,
          directors JSONB
        );
      `,
      sql`
        CREATE TABLE IF NOT EXISTS watched_episodes (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          show_id INTEGER NOT NULL,
          episode_key TEXT NOT NULL,
          watched_at TIMESTAMP DEFAULT NOW()
        );
      `
    ]);

    isTablesInitialized = true;
  } catch (err) {
    console.warn('[NeonClient] Table setup note:', err);
  }
}

export async function fetchNeonState(userId: string) {
  // Ensure tables exist and register user_profile ID immediately
  await ensureTablesExist();
  
  // Register user profile ID in Neon immediately
  try {
    await sql`INSERT INTO user_profiles (id) VALUES (${userId}) ON CONFLICT DO NOTHING;`;
  } catch (e) {}

  // Fetch media items and watched episodes concurrently for speed
  const [items, watchedRows] = await Promise.all([
    sql`SELECT * FROM media_items WHERE user_id = ${userId}`,
    sql`SELECT * FROM watched_episodes WHERE user_id = ${userId}`
  ]);

  const shows: any[] = [];
  const movies: any[] = [];
  const favorites: number[] = [];

  (items || []).forEach((row: any) => {
    const item: any = {
      id: row.media_id,
      type: row.type,
      title: row.title,
      posterPath: row.poster_path,
      backdropPath: row.backdrop_path,
      overview: row.overview,
      releaseDate: row.release_date,
      genres: row.genres,
      rating: row.rating ? parseFloat(row.rating) : undefined,
      runtime: row.runtime,
      seasonsCount: row.seasons_count,
      episodesCount: row.episodes_count,
      inWatchlist: row.in_watchlist,
      isFavorite: row.is_favorite,
      userRating: row.user_rating,
      completed: row.completed,
      stoppedWatching: row.stopped_watching,
      lastWatchedAt: row.last_watched_at ? new Date(row.last_watched_at).getTime() : undefined,
      seasons: row.seasons,
      imdbId: row.imdb_id,
      cast: row.cast_data,
      directors: row.directors,
    };

    if (row.type === 'show') {
      shows.push(item);
    } else {
      movies.push(item);
    }

    if (row.is_favorite && !favorites.includes(row.media_id)) {
      favorites.push(row.media_id);
    }
  });

  const watchedEpisodes: Record<number, Record<string, boolean>> = {};
  (watchedRows || []).forEach((row: any) => {
    const showId = row.show_id;
    const epKey = row.episode_key;
    if (!watchedEpisodes[showId]) {
      watchedEpisodes[showId] = {};
    }
    watchedEpisodes[showId][epKey] = true;
  });

  return {
    shows,
    movies,
    watchedEpisodes,
    favorites,
  };
}

export async function saveNeonState(userId: string, data: {
  shows: any[];
  movies: any[];
  watchedEpisodes: Record<number, Record<string, boolean>>;
  favorites: number[];
}, isExplicitReset = false) {
  await ensureTablesExist();

  // Always register user profile ID in Neon database
  try {
    await sql`INSERT INTO user_profiles (id) VALUES (${userId}) ON CONFLICT DO NOTHING;`;
  } catch (e) {}

  const allItems = [
    ...(data.shows || []).map(s => ({ ...s, type: 'show' })),
    ...(data.movies || []).map(m => ({ ...m, type: 'movie' })),
  ];

  const watched = data.watchedEpisodes || {};
  let totalWatchedCount = 0;
  Object.keys(watched).forEach(id => {
    if (watched[Number(id)]) {
      totalWatchedCount += Object.keys(watched[Number(id)]).length;
    }
  });

  // Strict wipe protection: NEVER delete existing database entries if incoming payload is empty unless explicit reset
  if (allItems.length === 0 && totalWatchedCount === 0) {
    if (!isExplicitReset) {
      console.warn('[NeonClient] Blocked clearing database for empty state payload.');
      return;
    } else {
      await Promise.all([
        sql`DELETE FROM media_items WHERE user_id = ${userId}`,
        sql`DELETE FROM watched_episodes WHERE user_id = ${userId}`
      ]);
      return;
    }
  }

  // Delete old records for this user before saving updated state
  await Promise.all([
    sql`DELETE FROM media_items WHERE user_id = ${userId}`,
    sql`DELETE FROM watched_episodes WHERE user_id = ${userId}`
  ]);

  // Batch insert all media items concurrently
  const itemInserts = allItems.map(item => {
    const isFav = (data.favorites || []).includes(item.id) || item.isFavorite || false;
    return sql`
      INSERT INTO media_items (
        user_id, media_id, type, title, poster_path, backdrop_path,
        overview, release_date, genres, rating, runtime,
        seasons_count, episodes_count, in_watchlist, is_favorite,
        user_rating, completed, stopped_watching, last_watched_at,
        seasons, imdb_id, cast_data, directors
      ) VALUES (
        ${userId}, ${item.id}, ${item.type}, ${item.title || 'Untitled'}, ${item.posterPath || null}, ${item.backdropPath || null},
        ${item.overview || null}, ${item.releaseDate || null}, ${JSON.stringify(item.genres || null)}, ${item.rating?.toString() || null}, ${item.runtime || null},
        ${item.seasonsCount || null}, ${item.episodesCount || null}, ${item.inWatchlist || false}, ${isFav},
        ${item.userRating || null}, ${item.completed || false}, ${item.stoppedWatching || false}, ${item.lastWatchedAt ? new Date(item.lastWatchedAt).toISOString() : null},
        ${JSON.stringify(item.seasons || null)}, ${item.imdbId || null}, ${JSON.stringify(item.cast || null)}, ${JSON.stringify(item.directors || null)}
      )
    `;
  });

  // Batch insert all watched episodes concurrently
  const watchedInserts: any[] = [];
  for (const showIdStr of Object.keys(watched)) {
    const showId = Number(showIdStr);
    if (isNaN(showId) || showId <= 0) continue;
    const eps = watched[showId];
    if (eps && typeof eps === 'object') {
      for (const epKey of Object.keys(eps)) {
        if (eps[epKey]) {
          watchedInserts.push(sql`
            INSERT INTO watched_episodes (user_id, show_id, episode_key)
            VALUES (${userId}, ${showId}, ${epKey})
          `);
        }
      }
    }
  }

  // Execute all inserts concurrently in parallel
  await Promise.all([...itemInserts, ...watchedInserts]);
}
