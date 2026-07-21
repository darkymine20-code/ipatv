/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaItem, Season, Episode, MediaType, TMDBReview } from './types';
import { searchKurdcinema, scrapeComments } from './lib/kurdcinemaService';

const DEFAULT_TMDB_API_KEY = '92cb9e28d9c7c9028682a433e85ea5d9';
const DEFAULT_TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5MmNiOWUyOGQ5YzdjOTAyODY4MmE0MzNlODVlYTVkOSIsIm5iZiI6MTc4Mjk3Njk2My40NDMsInN1YiI6IjZhNDYxMWMzYjk3OTA4ZTA3ZWRmNjJjYSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bjOVp4j5DZb2ajmtjOnoajOscDjIs0aAMwXxKKDql8c';
const BASE_URL = 'https://api.themoviedb.org/3';

export function getTmdbApiKey() {
  return localStorage.getItem('CUSTOM_TMDB_API_KEY') || DEFAULT_TMDB_API_KEY;
}

export function getTmdbAccessToken() {
  return localStorage.getItem('CUSTOM_TMDB_ACCESS_TOKEN') || DEFAULT_TMDB_ACCESS_TOKEN;
}

export function getTraktClientId() {
  return localStorage.getItem('CUSTOM_TRAKT_CLIENT_ID') || (import.meta as any).env?.VITE_TRAKT_CLIENT_ID || 'e52812225595b18eeae7720d8ec9322eca18708e1ae1935d0007990be9ae5388';
}

// Helper to construct TMDB image URLs
export function getImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w500'): string {
  if (!path) return 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop'; // fallback
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// Fetch helper with headers
async function tmdbFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const queryParams = new URLSearchParams({ ...params, api_key: getTmdbApiKey() });
  const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TMDB API request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`Error fetching from TMDB endpoint ${endpoint}:`, error);
    throw error;
  }
}

// Map genre IDs to names (hardcoded common mapping as a fallback/efficiency)
export const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

// Convert raw TMDB media item to our clean MediaItem structure
export function transformMedia(raw: any, type: MediaType): MediaItem {
  const genres = raw.genres 
    ? raw.genres.map((g: any) => g.name)
    : (raw.genre_ids ? raw.genre_ids.map((id: number) => GENRE_MAP[id] || 'Other').filter((v: string) => v !== 'Other') : ['Drama']);

  let directorsList: { id: number; name: string; profilePath: string | null }[] | undefined = undefined;
  if (raw.credits && raw.credits.crew) {
    const rawDirs = raw.credits.crew.filter((member: any) => member.job === 'Director');
    if (rawDirs.length > 0) {
      directorsList = rawDirs.slice(0, 5).map((d: any) => ({
        id: d.id,
        name: d.name,
        profilePath: d.profile_path ? getImageUrl(d.profile_path, 'w185') : null
      }));
    }
  }
  if (type === 'show' && raw.created_by && Array.isArray(raw.created_by) && raw.created_by.length > 0) {
    if (!directorsList) directorsList = [];
    raw.created_by.forEach((c: any) => {
      if (!directorsList!.some(d => d.id === c.id)) {
        directorsList!.push({
          id: c.id,
          name: c.name,
          profilePath: c.profile_path ? getImageUrl(c.profile_path, 'w185') : null
        });
      }
    });
  }

  return {
    id: raw.id,
    type,
    title: raw.title || raw.name || 'Untitled',
    posterPath: raw.poster_path ? getImageUrl(raw.poster_path, 'w500') : '',
    backdropPath: raw.backdrop_path ? getImageUrl(raw.backdrop_path, 'original') : '',
    overview: raw.overview || 'No description available.',
    releaseDate: raw.release_date || raw.first_air_date || '',
    genres: genres.length > 0 ? genres : ['Drama'],
    rating: Number((raw.vote_average || 0).toFixed(1)),
    runtime: raw.runtime || (raw.episode_run_time && raw.episode_run_time[0]) || 0,
    seasonsCount: raw.number_of_seasons,
    episodesCount: raw.number_of_episodes,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
    imdbId: raw.imdb_id || (raw.external_ids && raw.external_ids.imdb_id) || undefined,
    cast: raw.credits && raw.credits.cast ? raw.credits.cast.slice(0, 15).map((c) => ({ id: c.id, name: c.name, character: c.character, profilePath: c.profile_path ? getImageUrl(c.profile_path, 'w185') : null })) : undefined,
    directors: directorsList,
  };
}

// Search items
export async function searchMedia(query: string, page: number = 1): Promise<{ results: MediaItem[], totalPages: number }> {
  try {
    const data = await tmdbFetch('/search/multi', { query, page: String(page) });
    const results = data.results
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item: any) => transformMedia(item, item.media_type === 'tv' ? 'show' : 'movie'));
    return { results, totalPages: data.total_pages || 1 };
  } catch (error) {
    return { results: [], totalPages: 1 };
  }
}

// Fetch trending content for the carousel
export async function fetchTrending(
  type: 'all' | 'movie' | 'tv' = 'all',
  timeWindow: 'day' | 'week' = 'week'
): Promise<MediaItem[]> {
  try {
    const data = await tmdbFetch(`/trending/${type}/${timeWindow}`);
    if (data && data.results && data.results.length > 0) {
      return data.results
        .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || type !== 'all')
        .slice(0, 10)
        .map((item: any) => {
          const itemType = item.media_type || (type === 'all' ? 'movie' : type);
          const appType: MediaType = itemType === 'tv' ? 'show' : 'movie';
          return transformMedia(item, appType);
        });
    }
    throw new Error('No trending data from TMDB');
  } catch (error) {
    console.warn(`Trending fetch failed for type ${type} (${timeWindow}), using local fallback:`, error);
    try {
      const { INITIAL_SHOWS, INITIAL_MOVIES } = await import('./data');
      if (type === 'movie') {
        return INITIAL_MOVIES.slice(0, 10);
      } else if (type === 'tv') {
        return INITIAL_SHOWS.slice(0, 10);
      } else {
        // Interleave shows and movies
        const blended: MediaItem[] = [];
        for (let i = 0; i < 5; i++) {
          if (INITIAL_SHOWS[i]) blended.push(INITIAL_SHOWS[i]);
          if (INITIAL_MOVIES[i]) blended.push(INITIAL_MOVIES[i]);
        }
        return blended;
      }
    } catch (importError) {
      console.warn('Failed to load local trending fallbacks:', importError);
      return [];
    }
  }
}

// Fetch detailed item with full information (including seasons)
export async function fetchMediaDetails(id: number, type: MediaType): Promise<MediaItem> {
  const tmdbType = type === 'show' ? 'tv' : 'movie';
  const data = await tmdbFetch(`/${tmdbType}/${id}`, { append_to_response: 'external_ids,credits' });
  return transformMedia(data, type);
}

// Fetch seasons of a show
export async function fetchShowSeasons(showId: number, seasonsCount: number): Promise<Season[]> {
  const seasonsToFetch = Math.min(seasonsCount || 1, 12); // Limit to 12 seasons to prevent abuse, covering 99% of shows
  
  const promises = Array.from({ length: seasonsToFetch }, (_, i) => {
    const seasonNumber = i + 1;
    return tmdbFetch(`/tv/${showId}/season/${seasonNumber}`)
      .then((data) => {
        const episodes: Episode[] = (data.episodes || []).map((ep: any) => ({
          id: ep.id,
          season: ep.season_number,
          episode: ep.episode_number,
          title: ep.name || `Episode ${ep.episode_number}`,
          airDate: ep.air_date || '',
          overview: ep.overview || 'No description available.',
          watched: false,
          voteAverage: ep.vote_average !== undefined ? Number(ep.vote_average.toFixed(1)) : 0,
        }));
        
        return {
          id: data.id,
          seasonNumber,
          name: data.name || `Season ${seasonNumber}`,
          episodes,
        };
      })
      .catch((e) => {
        console.warn(`Could not fetch season ${seasonNumber} for show ${showId}`, e);
        return null;
      });
  });

  const results = await Promise.all(promises);
  const seasons = results.filter((s): s is Season => s !== null);

  // If no seasons fetched, create mock seasons so the UI works
  if (seasons.length === 0) {
    for (let s = 1; s <= seasonsToFetch; s++) {
      const episodes: Episode[] = [];
      for (let e = 1; e <= 10; e++) {
        episodes.push({
          id: showId * 1000 + s * 100 + e,
          season: s,
          episode: e,
          title: `Episode ${e} Name`,
          airDate: `2026-06-${10 + e}`,
          overview: `An exciting episode ${e} of season ${s}.`,
          watched: false,
          voteAverage: Number((7.0 + ((showId + s * 3 + e * 7) % 25) / 10).toFixed(1)),
        });
      }
      seasons.push({
        id: showId * 1000 + s,
        seasonNumber: s,
        name: `Season ${s}`,
        episodes,
      });
    }
  }

  return seasons;
}

// Discover/Explore infinite scroll simulation helper with custom sorting and year filter
export async function fetchDiscover(
  type: MediaType,
  page: number = 1,
  genreId?: string,
  sortBy: 'popularity' | 'rating' | 'year' = 'popularity',
  year?: string
): Promise<MediaItem[]> {
  try {
    const params: Record<string, string> = {
      page: String(page),
    };
    
    if (sortBy === 'rating') {
      params.sort_by = 'vote_average.desc';
      params['vote_count.gte'] = '200'; // filter out obscure entries with 10 stars and 1 vote
    } else if (sortBy === 'year') {
      params.sort_by = type === 'show' ? 'first_air_date.desc' : 'primary_release_date.desc';
    } else {
      params.sort_by = 'popularity.desc';
    }

    if (genreId) {
      params.with_genres = genreId;
    }

    if (year) {
      if (type === 'show') {
        params.first_air_date_year = year;
      } else {
        params.primary_release_year = year;
      }
    }

    const tmdbType = type === 'show' ? 'tv' : 'movie';
    const data = await tmdbFetch(`/discover/${tmdbType}`, params);
    if (data && data.results && data.results.length > 0) {
      return data.results.map((item: any) => transformMedia(item, type));
    }
    throw new Error('No results from TMDB discover');
  } catch (error) {
    console.warn(`Discover failed for ${type} (genre: ${genreId}, sortBy: ${sortBy}, year: ${year}), using local fallback:`, error);
    try {
      const { INITIAL_SHOWS, INITIAL_MOVIES } = await import('./data');
      const items = type === 'show' ? INITIAL_SHOWS : INITIAL_MOVIES;
      
      let filtered = items;
      if (genreId) {
        // Map genre ID to readable name for filtering
        const genreNameMap: Record<string, string[]> = {
          '18': ['Drama'],
          '10765': ['Sci-Fi & Fantasy', 'Sci-Fi'],
          '10759': ['Action & Adventure', 'Action'],
          '28': ['Action'],
          '878': ['Sci-Fi', 'Science Fiction'],
          '35': ['Comedy'],
          '16': ['Animation'],
          '9648': ['Mystery'],
          '53': ['Thriller'],
          '10749': ['Romance'],
          '27': ['Horror'],
          '12': ['Adventure'],
          '14': ['Fantasy'],
          '10751': ['Family'],
          '99': ['Documentary'],
          '36': ['History'],
          '80': ['Crime'],
          '10764': ['Reality'],
          '10763': ['News'],
          '10767': ['Talk']
        };
        
        const targetNames = genreNameMap[genreId] || [];
        filtered = items.filter(item => 
          item.genres.some(g => targetNames.some(tn => g.toLowerCase().includes(tn.toLowerCase())))
        );
      }
      
      let sortedItems = [...(filtered.length > 0 ? filtered : items)];
      
      if (year) {
        sortedItems = sortedItems.filter(item => {
          if (!item.releaseDate) return false;
          const itemYear = new Date(item.releaseDate).getFullYear().toString();
          return itemYear === year;
        });
      }

      if (sortBy === 'rating') {
        sortedItems.sort((a, b) => b.rating - a.rating);
      } else if (sortBy === 'year') {
        sortedItems.sort((a, b) => {
          const yearA = a.releaseDate ? new Date(a.releaseDate).getFullYear() : 0;
          const yearB = b.releaseDate ? new Date(b.releaseDate).getFullYear() : 0;
          return yearB - yearA;
        });
      } else {
        // Popularity: keep original local order
      }
      
      return sortedItems;
    } catch (importError) {
      console.warn('Failed to load local fallbacks:', importError);
      return [];
    }
  }
}

/**
 * Fetch popular movies or TV shows
 */
export async function fetchPopular(type: MediaType, page: number = 1): Promise<MediaItem[]> {
  const tmdbType = type === 'show' ? 'tv' : 'movie';
  try {
    const data = await tmdbFetch(`/${tmdbType}/popular`, { page: String(page) });
    if (data && data.results && data.results.length > 0) {
      return data.results.map((item: any) => transformMedia(item, type));
    }
    throw new Error('No results from TMDB popular');
  } catch (error) {
    console.warn(`Popular fetch failed for ${type}, using local fallback:`, error);
    try {
      const { INITIAL_SHOWS, INITIAL_MOVIES } = await import('./data');
      return type === 'show' ? INITIAL_SHOWS.slice(0, 10) : INITIAL_MOVIES.slice(0, 10);
    } catch (importError) {
      console.warn('Failed to load local popular fallback:', importError);
      return [];
    }
  }
}

// Popular predefined show/movie ID to YouTube trailer key map for absolute reliability
const FALLBACK_TRAILERS: Record<number, string> = {
  66732: 'b9EkMc79ZSU',  // Stranger Things
  1396: 'HhesaDFGs2M',   // Breaking Bad
  119051: 'Di310WS8zLk', // Wednesday
  85552: 'UR8F537b1pI',  // Euphoria
  106379: 'V-mugKDQImg', // Fallout
  693134: 'Way9Dexny3w', // Dune: Part Two
  823464: 'shW9i6k8Mc0', // Godzilla x Kong
  1022789: 'L3pk_TBkihU',// Inside Out 2
  653346: 'yqX7H18m2Ew', // Kingdom of the Planet of the Apes
  519182: 'qEVUtrk8_B4', // Despicable Me 4
};

/**
 * Fetch YouTube video trailer key for a given movie/show ID
 */
export async function fetchMediaVideos(id: number, type: MediaType): Promise<string | null> {
  const tmdbType = type === 'show' ? 'tv' : 'movie';
  try {
    const data = await tmdbFetch(`/${tmdbType}/${id}/videos`);
    const videos = data.results || [];
    
    // 1. Look for official YouTube trailer
    const officialTrailer = videos.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official === true
    );
    if (officialTrailer) return officialTrailer.key;

    // 2. Look for any YouTube trailer
    const trailer = videos.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
    );
    if (trailer) return trailer.key;

    // 3. Look for YouTube teaser/clip
    const teaser = videos.find(
      (v: any) => v.site === 'YouTube' && (v.type === 'Teaser' || v.type === 'Clip')
    );
    if (teaser) return teaser.key;

    // 4. Fall back to popular hardcoded values if available
    if (FALLBACK_TRAILERS[id]) {
      return FALLBACK_TRAILERS[id];
    }

    return null;
  } catch (error) {
    console.warn(`Failed to fetch videos for ${type} ${id}, trying hardcoded fallback:`, error);
    return FALLBACK_TRAILERS[id] || null;
  }
}

/**
 * Fetch TMDB user reviews/comments for a movie or TV show
 */
export async function fetchMediaReviews(id: number, type: MediaType): Promise<TMDBReview[]> {
  const tmdbType = type === 'show' ? 'tv' : 'movie';
  try {
    const data = await tmdbFetch(`/${tmdbType}/${id}/reviews`);
    const results = data.results || [];
    return results.map((r: any) => ({
      id: r.id,
      author: r.author || 'Anonymous',
      username: r.author_details?.username || r.author || 'Anonymous',
      avatarPath: r.author_details?.avatar_path 
        ? (r.author_details.avatar_path.startsWith('http') 
            ? r.author_details.avatar_path 
            : getImageUrl(r.author_details.avatar_path, 'w342'))
        : null,
      rating: r.author_details?.rating || null,
      content: r.content || '',
      createdAt: r.created_at || new Date().toISOString(),
      url: r.url || undefined,
      source: 'tmdb',
    }));
  } catch (error) {
    console.warn(`Failed to fetch reviews for ${type} ${id}:`, error);
    return [];
  }
}

/**
 * Fetch Trakt ID using TMDb ID and type
 */
export async function fetchEpisodeImdbId(showId: number, seasonNumber: number, episodeNumber: number): Promise<string | null> {
  try {
    const data = await tmdbFetch(`/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}/external_ids`);
    return data.imdb_id || null;
  } catch (err) {
    console.warn(`Failed to fetch external IDs for S${seasonNumber}E${episodeNumber}:`, err);
    return null;
  }
}

export async function fetchTraktId(tmdbId: number, type: MediaType): Promise<string | number | null> {
  const clientID = getTraktClientId();
  const traktType = type === 'show' ? 'show' : 'movie';
  try {
    const res = await fetch(`https://api.trakt.tv/search/tmdb/${tmdbId}?type=${traktType}`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientID
      }
    });
    if (!res.ok) {
      console.warn(`Trakt ID lookup failed for TMDb ID ${tmdbId}: Status ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data && data.length > 0) {
      const item = data[0];
      if (item && item[traktType] && item[traktType].ids) {
        return item[traktType].ids.trakt || item[traktType].ids.slug || null;
      }
    }
    return null;
  } catch (err) {
    console.warn(`Error looking up Trakt ID for ${type} ${tmdbId}:`, err);
    return null;
  }
}

/**
 * Fetch Trakt.tv comments for movies, shows, or individual episodes
 */
export async function fetchTraktComments(
  traktId: string | number,
  type: MediaType,
  episodeInfo?: { season: number; episode: number }
): Promise<TMDBReview[]> {
  const clientID = getTraktClientId();
  
  let url = `https://api.trakt.tv/${type === 'show' ? 'shows' : 'movies'}/${traktId}/comments?limit=250&extended=full`;
  if (type === 'show' && episodeInfo) {
    url = `https://api.trakt.tv/shows/${traktId}/seasons/${episodeInfo.season}/episodes/${episodeInfo.episode}/comments?limit=250&extended=full`;
  }
  
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientID
      }
    });
    if (!res.ok) {
      console.warn(`Trakt comments fetch failed for Trakt ID ${traktId}: Status ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    return data.map((item: any) => {
      // Extensive fallbacks to extract the actual comment text
      let commentText = '';
      if (typeof item.comment === 'string') {
        commentText = item.comment;
      } else if (item.comment && typeof item.comment.comment === 'string') {
        commentText = item.comment.comment;
      } else if (item.comment && typeof item.comment.text === 'string') {
        commentText = item.comment.text;
      } else if (typeof item.text === 'string') {
        commentText = item.text;
      } else if (item.body && typeof item.body === 'string') {
        commentText = item.body;
      } else if (item.comment && typeof item.comment.body === 'string') {
        commentText = item.comment.body;
      }

      const commentId = item.id || item.comment?.id || Math.random();
      const spoiler = item.spoiler !== undefined ? item.spoiler : (item.comment?.spoiler || false);
      const likes = item.likes !== undefined ? item.likes : (item.comment?.likes || 0);
      const replies = item.replies !== undefined ? item.replies : (item.comment?.replies || 0);
      
      const userObj = item.user || item.comment?.user || {};
      const userRating = item.user_rating || item.comment?.user_rating || null;
      const createdAt = item.created_at || item.comment?.created_at || new Date().toISOString();
      const idStr = String(commentId);
      
      return {
        id: `trakt-${idStr}`,
        author: userObj.name || userObj.username || 'Anonymous',
        username: userObj.username || 'Anonymous',
        avatarPath: userObj.images?.avatar?.full || null,
        rating: userRating ? userRating : null,
        content: commentText,
        createdAt: createdAt,
        url: idStr ? `https://trakt.tv/comments/${idStr}` : undefined,
        source: 'trakt',
        likes: likes,
        replies: replies,
        spoiler: spoiler
      };
    });
  } catch (err) {
    console.warn(`Error fetching Trakt comments for Trakt ID ${traktId}:`, err);
    return [];
  }
}

export async function fetchTraktList(
  mediaType: MediaType,
  listType: 'trending' | 'boxoffice' | 'popular' | 'favorited' | 'played' | 'watched' | 'anticipated',
  page: number = 1,
  limit: number = 20,
  year?: string,
  genre?: string
): Promise<MediaItem[]> {
  const traktType = mediaType === 'show' ? 'shows' : 'movies';
  
  if (listType === 'boxoffice' && mediaType === 'show') {
    return []; // No boxoffice for TV shows
  }

  let url = `https://api.trakt.tv/${traktType}/${listType}?page=${page}&limit=${limit}&extended=full`;
  
  if (year) url += `&years=${year}`;
  if (genre) url += `&genres=${genre}`;
  
  const clientID = getTraktClientId();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientID
      }
    });

    if (!response.ok) {
      throw new Error(`Trakt API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.map((item: any) => {
      const raw = item[mediaType] || item; // item.show, item.movie, or just item
      return transformTraktMedia(raw, mediaType);
    });
  } catch (error) {
    console.warn(`Error fetching Trakt ${listType} for ${mediaType}:`, error);
    return [];
  }
}

export function transformTraktMedia(raw: any, type: MediaType): MediaItem {
  return {
    id: raw.ids?.tmdb || raw.ids?.trakt, // Use tmdb id as primary if available, fallback to trakt id
    type,
    title: raw.title || 'Untitled',
    posterPath: raw.images?.poster?.[0] ? `https://${raw.images.poster[0]}` : '',
    backdropPath: raw.images?.fanart?.[0] ? `https://${raw.images.fanart[0]}` : '',
    overview: raw.overview || 'No description available.',
    rating: raw.rating ? Number((raw.rating).toFixed(1)) : 0,
    releaseDate: raw.released || raw.first_aired || '',
    genres: raw.genres || [],
    trailerUrl: raw.trailer || null,
    tmdbId: raw.ids?.tmdb,
    imdbId: raw.ids?.imdb,
    runtime: raw.runtime || 0,
    status: raw.status || 'Unknown',
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  };
}

/**
 * Find or search for a media item by IMDb ID or Title and Type.
 * Extremely robust helper for imports.
 */
export async function findOrSearchMediaItem(
  title: string,
  type: MediaType,
  imdbId?: string
): Promise<MediaItem | null> {
  // 1. Try finding by IMDb ID if available
  if (imdbId && imdbId.startsWith('tt')) {
    try {
      const data = await tmdbFetch(`/find/${imdbId}`, { external_source: 'imdb_id' });
      if (type === 'movie' && data.movie_results && data.movie_results.length > 0) {
        return transformMedia(data.movie_results[0], 'movie');
      }
      if (type === 'show' && data.tv_results && data.tv_results.length > 0) {
        return transformMedia(data.tv_results[0], 'show');
      }
      // If type mismatch but we found a result, trust the TMDB type
      if (data.movie_results && data.movie_results.length > 0) {
        return transformMedia(data.movie_results[0], 'movie');
      }
      if (data.tv_results && data.tv_results.length > 0) {
        return transformMedia(data.tv_results[0], 'show');
      }
    } catch (err) {
      console.warn(`Find by IMDb ID ${imdbId} failed, falling back to search`, err);
    }
  }

  // 2. Search by Title
  try {
    const tmdbType = type === 'show' ? 'tv' : 'movie';
    const data = await tmdbFetch(`/search/${tmdbType}`, { query: title });
    if (data.results && data.results.length > 0) {
      // Find exact or closest match
      const matched = data.results.find((r: any) => {
        const rTitle = r.title || r.name || '';
        return rTitle.toLowerCase() === title.toLowerCase();
      }) || data.results[0];
      
      return transformMedia(matched, type);
    }
  } catch (err) {
    console.warn(`Search failed for ${title} (${type})`, err);
  }

  return null;
}

/**
 * Fetch recommendations for a specific movie or TV show from TMDB.
 */
export async function fetchMediaRecommendations(
  id: number,
  type: MediaType
): Promise<MediaItem[]> {
  try {
    const tmdbType = type === 'show' ? 'tv' : 'movie';
    const data = await tmdbFetch(`/${tmdbType}/${id}/recommendations`);
    if (data && data.results && data.results.length > 0) {
      return data.results
        .slice(0, 10)
        .map((item: any) => transformMedia(item, type));
    }
  } catch (err) {
    console.warn(`Failed to fetch recommendations for TMDB ID ${id} (${type})`, err);
  }
  return [];
}




export async function fetchKurdcinemaSearch(query: string, type: 'movie' | 'series' | 'all' = 'all'): Promise<any[]> {
  try {
    const response = await fetch(`/api/kurdcinema/search?q=${encodeURIComponent(query)}&type=${type}`);
    if (response.ok) return await response.json();
  } catch (err) {}

  try {
    const results = await searchKurdcinema(query, type);
    return results || [];
  } catch (err) {
    console.error('Failed client-side kurdcinema search', err);
    return [];
  }
}

export async function fetchKurdcinemaComments(url: string, type: 'movie' | 'series' = 'movie'): Promise<any> {
  try {
    const response = await fetch(`/api/kurdcinema/comments?url=${encodeURIComponent(url)}&type=${type}`);
    if (response.ok) return await response.json();
  } catch (err) {}

  try {
    const data = await scrapeComments(url, type);
    return data;
  } catch (err) {
    console.error('Failed client-side kurdcinema comments', err);
    return null;
  }
}

export async function fetchImdbRating(imdbId: string): Promise<{ rating: number | null; votes: number }> {
  if (!imdbId || typeof imdbId !== 'string') {
    return { rating: null, votes: 0 };
  }

  // 1. Try real IMDb GraphQL endpoint
  try {
    const payload = {
      query: `query GetTitleRating($id: ID!) {
        title(id: $id) {
          ratingsSummary {
            aggregateRating
            voteCount
          }
        }
      }`,
      operationName: "GetTitleRating",
      variables: { id: imdbId }
    };

    const res = await fetch('https://caching.graphql.imdb.com/', {
      method: 'POST',
      headers: {
        'accept': 'application/graphql+json, application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      const summary = data?.data?.title?.ratingsSummary;
      if (summary && summary.aggregateRating) {
        return {
          rating: Math.round(summary.aggregateRating * 10) / 10,
          votes: summary.voteCount || 0
        };
      }
    }
  } catch (err) {}

  // 2. Try OMDb API fallback for real IMDb rating & vote count
  try {
    const omdbRes = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
    if (omdbRes.ok) {
      const omdbData = await omdbRes.json();
      if (omdbData && omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
        const rating = parseFloat(omdbData.imdbRating);
        const votes = omdbData.imdbVotes ? parseInt(omdbData.imdbVotes.replace(/,/g, ''), 10) : 0;
        return { rating: isNaN(rating) ? null : rating, votes: isNaN(votes) ? 0 : votes };
      }
    }
  } catch (err) {}

  return { rating: null, votes: 0 };
}

export async function fetchImdbReviews(imdbId: string): Promise<any[]> {
  if (!imdbId || typeof imdbId !== 'string') return [];

  // 1. Try real IMDb GraphQL reviews query
  try {
    const payload = {
      query: `query TitleReviews($const: ID!) {
        title(id: $const) {
          reviews(first: 15) {
            edges {
              node {
                id
                author {
                  nickName
                }
                authorRating
                submissionDate
                summary {
                  originalText
                }
                text {
                  originalText
                }
                interestingVotes {
                  up
                  down
                }
              }
            }
          }
        }
      }`,
      operationName: "TitleReviews",
      variables: { const: imdbId }
    };

    const res = await fetch('https://caching.graphql.imdb.com/', {
      method: 'POST',
      headers: {
        'accept': 'application/graphql+json, application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      const edges = data?.data?.title?.reviews?.edges;
      if (edges && Array.isArray(edges) && edges.length > 0) {
        return edges.map((e: any) => {
          const node = e.node || {};
          return {
            id: node.id || Math.random().toString(),
            author: node.author?.nickName || 'IMDb Reviewer',
            authorDetails: {
              username: node.author?.nickName || 'IMDb User',
              rating: node.authorRating || null,
              avatarPath: null,
            },
            content: node.text?.originalText || node.summary?.originalText || '',
            createdAt: node.submissionDate || new Date().toISOString(),
            likes: node.interestingVotes?.up || 0,
          };
        });
      }
    }
  } catch (err) {}

  // 2. Fallback to TMDB reviews
  try {
    const data = await tmdbFetch(`/find/${imdbId}`, { external_source: 'imdb_id' });
    const item = data.movie_results?.[0] || data.tv_results?.[0];
    if (item) {
      const tmdbType = data.movie_results?.[0] ? 'movie' : 'tv';
      const reviewsData = await tmdbFetch(`/${tmdbType}/${item.id}/reviews`);
      if (reviewsData && reviewsData.results) {
        return reviewsData.results.map((r: any) => ({
          id: r.id,
          author: r.author,
          authorDetails: {
            username: r.author_details?.username,
            rating: r.author_details?.rating,
            avatarPath: r.author_details?.avatar_path,
          },
          content: r.content,
          createdAt: r.created_at,
        }));
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Fetch a person's biography, details, and all of their movie and TV show credits (cast & crew).
 */
export async function fetchPersonCredits(personId: number): Promise<{
  person: {
    id: number;
    name: string;
    biography: string;
    profilePath: string | null;
    knownForDepartment: string;
    birthday: string | null;
    placeOfBirth: string | null;
  };
  credits: MediaItem[];
}> {
  const personData = await tmdbFetch(`/person/${personId}`);
  const creditsData = await tmdbFetch(`/person/${personId}/combined_credits`);
  
  const person = {
    id: personData.id,
    name: personData.name || 'Unknown Person',
    biography: personData.biography || 'No biography available.',
    profilePath: personData.profile_path ? getImageUrl(personData.profile_path, 'w342') : null,
    knownForDepartment: personData.known_for_department || '',
    birthday: personData.birthday || null,
    placeOfBirth: personData.place_of_birth || null,
  };

  // Combine cast and crew credits (crew is important for directors)
  const rawCredits = [
    ...(creditsData.cast || []).map((item: any) => ({ ...item, creditType: 'cast' })),
    ...(creditsData.crew || []).map((item: any) => ({ ...item, creditType: 'crew' }))
  ];

  // De-duplicate credits by media_type and id
  const seen = new Set<string>();
  const uniqueCredits: any[] = [];
  for (const item of rawCredits) {
    const key = `${item.media_type}-${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCredits.push(item);
    } else {
      const existingIdx = uniqueCredits.findIndex(x => `${x.media_type}-${x.id}` === key);
      if (existingIdx !== -1 && item.job === 'Director') {
        uniqueCredits[existingIdx] = item; // Prioritize Director job for crew credit
      }
    }
  }

  // Sort unique credits by popularity descending
  uniqueCredits.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Limit to top 50 most popular and transform
  const credits = uniqueCredits
    .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
    .slice(0, 50)
    .map((item: any) => transformMedia(item, item.media_type === 'tv' ? 'show' : 'movie'));

  return { person, credits };
}

