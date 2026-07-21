/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MediaType = 'show' | 'movie';

export interface Episode {
  id: number;
  season: number;
  episode: number;
  title: string;
  airDate: string;
  overview: string;
  watched: boolean;
  voteAverage?: number;
}

export interface Season {
  id: number;
  seasonNumber: number;
  name: string;
  episodes: Episode[];
}

export interface MediaItem {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string;
  backdropPath: string;
  overview: string;
  releaseDate: string;
  genres: string[];
  rating: number; // TMDB rating (e.g. 7.8)
  runtime: number; // in minutes
  seasonsCount?: number;
  episodesCount?: number;
  
  // User state
  inWatchlist: boolean;
  isFavorite: boolean;
  userRating: number | null;
  completed: boolean; // Movies: watched; TV shows: all episodes watched
  stoppedWatching?: boolean; // TV shows: user stopped watching
  lastWatchedAt?: string | null; // ISO Date String
  completedAt?: string | null;
  favoritedAt?: string | null;
  stoppedWatchingAt?: string | null;
  seasons?: Season[];
  imdbId?: string;
  tmdbId?: number;
  trailerUrl?: string | null;
  status?: string;
  cast?: CastMember[];
  directors?: DirectorMember[];
}

export interface DirectorMember {
  id: number;
  name: string;
  profilePath: string | null;
}

export interface WatchHistoryItem {
  id: string; // unique ID like 'movie-123' or 'show-123-S1E2'
  mediaId: number;
  type: MediaType;
  mediaItem: MediaItem;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  watchedAt: string; // ISO String
}

export interface UserStats {
  episodesWatched: number;
  showsWatched: number;
  hoursSpent: number;
  moviesWatched: number;
}

export interface TMDBReview {
  id: string;
  author: string;
  username?: string;
  avatarPath?: string | null;
  rating?: number | null;
  content: string;
  createdAt: string;
  url?: string;
  source?: 'tmdb' | 'trakt';
  likes?: number;
  downVotes?: number;
  replies?: number;
  spoiler?: boolean;
}


export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}
