import { MediaItem, MediaType } from '../types';

export interface WatchHistoryItem {
  id: string; // unique ID for the history entry
  mediaId: number;
  type: MediaType;
  mediaItem: MediaItem;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  watchedAt: string; // ISO String
  server?: string;
  externalPlayer?: string;
  streamUrl?: string;
}

const STORAGE_KEY = 'tv_tracker_watch_history';

export function getWatchHistory(): WatchHistoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data) as WatchHistoryItem[];
    if (!Array.isArray(parsed)) return [];

    // Sanitize any existing large items in localStorage so we don't keep carrying huge payloads
    let modified = false;
    const sanitized = parsed.map(item => {
      if (item && item.mediaItem && (item.mediaItem.seasons || item.mediaItem.cast)) {
        modified = true;
        return {
          ...item,
          mediaItem: {
            ...item.mediaItem,
            seasons: undefined,
            cast: undefined,
          }
        };
      }
      return item;
    });

    if (modified) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      } catch (e) {
        console.warn('Failed to update sanitized watch history in localStorage:', e);
      }
    }

    return sanitized;
  } catch (e) {
    return [];
  }
}

export function addToWatchHistory(item: Omit<WatchHistoryItem, 'id' | 'watchedAt'>) {
  try {
    const history = getWatchHistory();
    const id = item.type === 'show' ? `show-${item.mediaId}-S${item.seasonNumber}E${item.episodeNumber}` : `movie-${item.mediaId}`;
    
    // Create a sanitized copy of the mediaItem, omitting large arrays like seasons, cast, etc.
    const sanitizedMediaItem: MediaItem = {
      id: item.mediaItem.id,
      type: item.mediaItem.type,
      title: item.mediaItem.title,
      posterPath: item.mediaItem.posterPath,
      backdropPath: item.mediaItem.backdropPath,
      overview: item.mediaItem.overview,
      releaseDate: item.mediaItem.releaseDate,
      genres: item.mediaItem.genres,
      rating: item.mediaItem.rating,
      runtime: item.mediaItem.runtime,
      seasonsCount: item.mediaItem.seasonsCount,
      episodesCount: item.mediaItem.episodesCount,
      inWatchlist: item.mediaItem.inWatchlist,
      isFavorite: item.mediaItem.isFavorite,
      userRating: item.mediaItem.userRating,
      completed: item.mediaItem.completed,
      stoppedWatching: item.mediaItem.stoppedWatching,
      lastWatchedAt: item.mediaItem.lastWatchedAt,
    };

    const newItem: WatchHistoryItem = {
      ...item,
      mediaItem: sanitizedMediaItem,
      id,
      watchedAt: new Date().toISOString(),
    };

    // Remove existing entry if it's the same episode/movie to put it at the top
    const filtered = history.filter(h => h.id !== id);
    filtered.unshift(newItem); // Add to beginning

    // Keep only last 10
    const limited = filtered.slice(0, 10);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
    } catch (quotaError) {
      console.warn('Quota exceeded while saving watch history, attempting aggressive size reduction:', quotaError);
      // Fallback: slice further or save fewer items
      const extraLimited = limited.slice(0, 5);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(extraLimited));
      } catch (innerError) {
        console.error('Failed to save watch history even with reduced size:', innerError);
      }
    }
    
    // Dispatch an event so other components can update
    window.dispatchEvent(new Event('watchHistoryUpdated'));
  } catch (e) {
    console.error('Failed to save watch history:', e);
  }
}
