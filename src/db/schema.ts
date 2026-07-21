import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const userProfiles = pgTable('user_profiles', {
  id: text('id').primaryKey(), // local UUID
  createdAt: timestamp('created_at').defaultNow(),
});

export const mediaItems = pgTable('media_items', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  mediaId: integer('media_id').notNull(), // TMDB ID
  type: text('type').notNull(), // 'show' | 'movie'
  title: text('title').notNull(),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  overview: text('overview'),
  releaseDate: text('release_date'),
  genres: jsonb('genres'),
  rating: text('rating'),
  runtime: integer('runtime'),
  seasonsCount: integer('seasons_count'),
  episodesCount: integer('episodes_count'),
  inWatchlist: boolean('in_watchlist').default(false),
  isFavorite: boolean('is_favorite').default(false),
  userRating: integer('user_rating'),
  completed: boolean('completed').default(false),
  stoppedWatching: boolean('stopped_watching').default(false),
  lastWatchedAt: timestamp('last_watched_at'),
  seasons: jsonb('seasons'),
  imdbId: text('imdb_id'),
  cast: jsonb('cast'),
  directors: jsonb('directors'),
});

export const watchedEpisodes = pgTable('watched_episodes', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  showId: integer('show_id').notNull(),
  episodeKey: text('episode_key').notNull(),
  watchedAt: timestamp('watched_at').defaultNow(),
});
