/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MediaItem, Season, Episode, MediaType, UserStats } from './types';
import { INITIAL_SHOWS, INITIAL_MOVIES, getPredefinedSeasons, getUpcomingEpisodesTimeline, UpcomingEpisode, getPredefinedEpisodeRating } from './data';
import { fetchMediaDetails, fetchShowSeasons } from './tmdb';
import { getDeviceId } from './lib/auth';
import { fetchNeonState, saveNeonState } from './lib/neonClient';

export function getDefaultState(): SavedState {
  return {
    shows: [],
    movies: [],
    watchedEpisodes: {},
    favorites: [],
    updatedAt: 0,
  };
}

export function getReleasedEpisodesCount(show: MediaItem): number {
  const currentDateStr = new Date().toISOString().split('T')[0];
  
  if (!show.seasons || show.seasons.length === 0) {
    return show.episodesCount || 8;
  }
  
  let count = 0;
  let hasAnyEpisodes = false;
  show.seasons.forEach(season => {
    if (season.episodes && season.episodes.length > 0) {
      hasAnyEpisodes = true;
      season.episodes.forEach(ep => {
        if (!ep.airDate || ep.airDate <= currentDateStr) {
          count++;
        }
      });
    }
  });

  if (hasAnyEpisodes) {
    return count;
  }
  return show.episodesCount || 8;
}

interface SavedState {
  shows: MediaItem[];
  movies: MediaItem[];
  // Map of showId -> Record of episodeId (S{season}E{episode}) -> boolean (watched)
  watchedEpisodes: Record<number, Record<string, boolean>>;
  favorites: number[]; // media item IDs
  updatedAt?: number;
}


const STORAGE_KEY = 'tv_tracker_local_state';


let isInitialLoad = true;

export function getInitialState(): SavedState {
  return getDefaultState();
}

export function pruneInactiveState(prev: SavedState): SavedState {
  const activeShows = (prev.shows || []).filter(s => {
    const hasWatchedEpisodes = prev.watchedEpisodes && prev.watchedEpisodes[s.id] && Object.keys(prev.watchedEpisodes[s.id]).length > 0;
    const isFavorite = (prev.favorites || []).includes(s.id) || s.isFavorite;
    return s.inWatchlist || isFavorite || s.userRating != null || s.completed || s.stoppedWatching || hasWatchedEpisodes;
  });

  const activeMovies = (prev.movies || []).filter(m => {
    const isFavorite = (prev.favorites || []).includes(m.id) || m.isFavorite;
    return m.inWatchlist || isFavorite || m.userRating != null || m.completed;
  });

  // Ensure favorites array only contains active items
  const activeFavorites = (prev.favorites || []).filter(id => {
    const show = activeShows.find(s => s.id === id);
    if (show) return true;
    const movie = activeMovies.find(m => m.id === id);
    if (movie) return true;
    return false;
  });

  return {
    ...prev,
    shows: activeShows,
    movies: activeMovies,
    favorites: activeFavorites
  };
}

export function useAppState(isSiteLocked = false) {
  const deviceIdRef = useRef<string>(getDeviceId());
  const [state, setRawState] = useState<SavedState>(getDefaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [dbStatus, setDbStatus] = useState<{ usePostgres: boolean; hasDbUrl: boolean; dbError?: string | null } | null>(null);
  const isLoadedRef = useRef(false);
  const loadFailedRef = useRef(false);
  const hasChangesRef = useRef(false);
  const fetchingRef = useRef<Set<string>>(new Set());

  // Safety refs for data loss prevention
  const initialLoadedCountRef = useRef({ shows: 0, movies: 0, watchedEpisodes: 0 });
  const isResettingRef = useRef(false);

  useEffect(() => {
    if (isSiteLocked) return;

    const loadState = async () => {
      try {
        const deviceId = deviceIdRef.current;

        // Try direct Neon Serverless DB fetch over HTTPS first
        try {
          const data = await fetchNeonState(deviceId);
          const loadedShows = data.shows || [];
          const loadedMovies = data.movies || [];
          const loadedWatched = data.watchedEpisodes || {};

          initialLoadedCountRef.current = {
            shows: loadedShows.length,
            movies: loadedMovies.length,
            watchedEpisodes: Object.keys(loadedWatched).length
          };

          setRawState({
            shows: Array.from(new Map(loadedShows.map((s: any) => [s.id, s])).values()),
            movies: Array.from(new Map(loadedMovies.map((m: any) => [m.id, m])).values()),
            watchedEpisodes: loadedWatched,
            favorites: data.favorites || [],
            updatedAt: Date.now()
          });

          setDbStatus({ usePostgres: true, hasDbUrl: true, dbError: null });
          loadFailedRef.current = false;
          isLoadedRef.current = true;
          hasChangesRef.current = false;
          setLoadFailed(false);
          setIsLoaded(true);
          return;
        } catch (neonErr) {
          console.warn('[NeonClient] Direct fetch failed, trying /api/state fallback:', neonErr);
        }

        // Fallback to /api/state if running behind express server
        const res = await fetch(`/api/state?t=${Date.now()}`, {
          headers: {
            'Authorization': 'Bearer ' + deviceId
          }
        });
        if (res.ok) {
          const data = await res.json();
          const loadedShows = data.shows || [];
          const loadedMovies = data.movies || [];
          const loadedWatched = data.watchedEpisodes || {};

          initialLoadedCountRef.current = {
            shows: loadedShows.length,
            movies: loadedMovies.length,
            watchedEpisodes: Object.keys(loadedWatched).length
          };

          setRawState({
            shows: Array.from(new Map(loadedShows.map((s: any) => [s.id, s])).values()),
            movies: Array.from(new Map(loadedMovies.map((m: any) => [m.id, m])).values()),
            watchedEpisodes: loadedWatched,
            favorites: data.favorites || [],
            updatedAt: Date.now()
          });
          if (data.dbStatus) {
            setDbStatus(data.dbStatus);
          }
          loadFailedRef.current = false;
          isLoadedRef.current = true;
          hasChangesRef.current = false;
          setLoadFailed(false);
          setIsLoaded(true);
        } else {
          // Fallback to local storage
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setRawState(JSON.parse(stored));
          }
          isLoadedRef.current = true;
          setLoadFailed(false);
          setIsLoaded(true);
        }
      } catch (e) {
        console.warn('Failed to load state from cloud:', e);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            setRawState(JSON.parse(stored));
          } catch (err) {}
        }
        isLoadedRef.current = true;
        setLoadFailed(false);
        setIsLoaded(true);
      }
    };
    loadState();
  }, [isSiteLocked, refetchTrigger]);

  const retryLoad = useCallback(() => {
    setIsLoaded(false);
    setLoadFailed(false);
    loadFailedRef.current = false;
    isLoadedRef.current = false;
    setRefetchTrigger(prev => prev + 1);
  }, []);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const saveState = useCallback(async (currentState: SavedState, isUnloading = false) => {
    if (!isLoadedRef.current || loadFailedRef.current || !hasChangesRef.current) {
      return;
    }

    const pruned = pruneInactiveState(currentState);

    // Save to local storage immediately as offline protection
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch (e) {}

    const currentShowsCount = pruned.shows.length;
    const currentMoviesCount = pruned.movies.length;
    const currentWatchedCount = Object.keys(pruned.watchedEpisodes || {}).length;
    
    if (!isResettingRef.current && (
      (initialLoadedCountRef.current.shows > 0 && currentShowsCount === 0) ||
      (initialLoadedCountRef.current.watchedEpisodes > 0 && currentWatchedCount === 0)
    )) {
      console.warn('[saveState] Blocked saving empty/wiped state to avoid overwriting existing cloud data!');
      return;
    }

    const isReset = isResettingRef.current;
    if (isReset) {
      isResettingRef.current = false;
      initialLoadedCountRef.current = { shows: 0, movies: 0, watchedEpisodes: 0 };
    }

    try {
      const deviceId = deviceIdRef.current;
      hasChangesRef.current = false;

      // Save directly to Neon over HTTPS
      try {
        await saveNeonState(deviceId, pruned);
        return;
      } catch (neonSaveErr) {
        console.warn('[NeonClient] Direct save failed, trying /api/state fallback:', neonSaveErr);
      }
      
      const strippedShows = pruned.shows.map(({ seasons, ...s }) => s);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + deviceId
      };

      if (isReset) {
        headers['x-force-reset'] = 'true';
      }

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shows: strippedShows,
          movies: pruned.movies,
          watchedEpisodes: pruned.watchedEpisodes,
          favorites: pruned.favorites
        })
      };

      if (isUnloading) {
        fetchOptions.keepalive = true;
      }

      const res = await fetch('/api/state', fetchOptions);
      if (!res.ok) {
        console.warn('Failed to save state to cloud:', res.statusText);
        hasChangesRef.current = true;
      }
    } catch (e) {
      console.warn('Failed to save state to cloud:', e);
      hasChangesRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || loadFailedRef.current) return;
    
    const timeoutId = setTimeout(() => {
      saveState(state, false);
    }, 300); // 300ms responsive debounce
    
    return () => clearTimeout(timeoutId);
  }, [state, isLoaded, saveState]);

  useEffect(() => {
    if (!isLoaded || loadFailedRef.current) return;

    const handleBeforeUnload = () => {
      saveState(stateRef.current, true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveState(stateRef.current, true); // Flush on unmount
    };
  }, [isLoaded, saveState]);

  const setState = (
    value: SavedState | ((prev: SavedState) => SavedState)
  ) => {
    hasChangesRef.current = true;
    setRawState(prev => {
      const resolved = typeof value === 'function' ? value(prev) : value;
      return {
        ...resolved,
        updatedAt: Date.now()
      };
    });
  };

  const exportState = () => {
    try {
      const pruned = pruneInactiveState(state);
      const dataStr = JSON.stringify(pruned, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `tv_movie_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.download = filename;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Failed to export state:', e);
    }
  };

  const importState = (importedData: any) => {
    if (!importedData || typeof importedData !== 'object') {
      return;
    }
    setState({
      shows: importedData.shows,
      movies: importedData.movies,
      watchedEpisodes: importedData.watchedEpisodes,
      favorites: importedData.favorites,
    });
  };

  // Background pre-fetch details (including cast/directors) for all active shows and movies that are missing them
  useEffect(() => {
    if (!isLoaded) return;
    
    const activeShows = state.shows.filter(s => !s.cast || !s.directors);
    activeShows.forEach(async (show) => {
      const fetchKey = `${show.id}-cast-directors-tv`;
      if (fetchingRef.current.has(fetchKey)) return;
      fetchingRef.current.add(fetchKey);

      try {
        const freshDetails = await fetchMediaDetails(show.id, 'show');
        if (freshDetails) {
          setState(prev => ({
            ...prev,
            shows: prev.shows.map(s => s.id === show.id ? { 
              ...s, 
              cast: freshDetails.cast || s.cast,
              directors: freshDetails.directors || s.directors,
              seasonsCount: freshDetails.seasonsCount || s.seasonsCount,
              episodesCount: freshDetails.episodesCount || s.episodesCount
            } : s)
          }));
        }
      } catch (e) {
        console.warn(`Failed to background-heal details for show ${show.id}`, e);
      } finally {
        fetchingRef.current.delete(fetchKey);
      }
    });

    const activeMovies = state.movies.filter(m => !m.cast || !m.directors);
    activeMovies.forEach(async (movie) => {
      const fetchKey = `${movie.id}-cast-directors-movie`;
      if (fetchingRef.current.has(fetchKey)) return;
      fetchingRef.current.add(fetchKey);

      try {
        const freshDetails = await fetchMediaDetails(movie.id, 'movie');
        if (freshDetails) {
          setState(prev => ({
            ...prev,
            movies: prev.movies.map(m => m.id === movie.id ? { 
              ...m, 
              cast: freshDetails.cast || m.cast,
              directors: freshDetails.directors || m.directors
            } : m)
          }));
        }
      } catch (e) {
        console.warn(`Failed to background-heal details for movie ${movie.id}`, e);
      } finally {
        fetchingRef.current.delete(fetchKey);
      }
    });
  }, [isLoaded, state.shows.map(s => `${s.id}-${!!s.cast}-${!!s.directors}`).join(','), state.movies.map(m => `${m.id}-${!!m.cast}-${!!m.directors}`).join(',')]);

  // Background pre-fetch seasons for watchlist shows to ensure upcoming timeline is 100% accurate
  useEffect(() => {
    const watchlistShows = state.shows.filter(s => s.inWatchlist && !s.completed);
    
    watchlistShows.forEach(async (show) => {
      let currentSeasonsCount = show.seasonsCount;
      
      // If seasonsCount is not set, heal full details first from TMDB to get the real seasons count
      if (!currentSeasonsCount) {
        const fetchKey = `${show.id}-details`;
        if (fetchingRef.current.has(fetchKey)) return;
        fetchingRef.current.add(fetchKey);

        try {
          const freshDetails = await fetchMediaDetails(show.id, 'show');
          if (freshDetails && freshDetails.seasonsCount) {
            currentSeasonsCount = freshDetails.seasonsCount;
            // Update the seasonsCount in state
            setState(prev => ({
              ...prev,
              shows: prev.shows.map(s => s.id === show.id ? { 
                ...s, 
                seasonsCount: freshDetails.seasonsCount,
                episodesCount: freshDetails.episodesCount || s.episodesCount
              } : s)
            }));
          }
        } catch (e) {
          console.warn(`Failed to background-heal details for show ${show.id}`, e);
        } finally {
          fetchingRef.current.delete(fetchKey);
        }
      }

      const targetCount = currentSeasonsCount || 1;

      // If we don't have seasons loaded yet, or we have fewer seasons than total seasonsCount, fetch them!
      if (!show.seasons || show.seasons.length < targetCount) {
        const fetchKey = `${show.id}-seasons-${targetCount}`;
        if (fetchingRef.current.has(fetchKey)) return;
        fetchingRef.current.add(fetchKey);

        try {
          const fetchedSeasons = await fetchShowSeasons(show.id, targetCount);
          if (fetchedSeasons && fetchedSeasons.length > 0) {
            const healedSeasons = fetchedSeasons.map(s => ({
              ...s,
              episodes: s.episodes.map(e => ({
                ...e,
                voteAverage: e.voteAverage && e.voteAverage > 0
                  ? e.voteAverage
                  : getPredefinedEpisodeRating(show.id, s.seasonNumber, e.episode)
              }))
            }));
            setState(prev => ({
              ...prev,
              shows: prev.shows.map(s => s.id === show.id ? { ...s, seasons: healedSeasons } : s)
            }));
          }
        } catch (err) {
          console.warn(`Failed to background-fetch seasons for show ${show.id}`, err);
        } finally {
          fetchingRef.current.delete(fetchKey);
        }
      }
    });
  }, [state.shows.map(s => `${s.id}-${s.inWatchlist}-${s.completed}-${s.seasons?.length || 0}-${s.seasonsCount || 0}`).join(',')]);

  // Actions
  const toggleWatchlist = (id: number, type: MediaType, fullItem?: MediaItem) => {
    setState(prev => {
      if (type === 'show') {
        const exists = prev.shows.some(s => s.id === id);
        let updatedShows;
        if (exists) {
          updatedShows = prev.shows.map(s => {
            if (s.id === id) {
              const newInWatchlist = !s.inWatchlist;
              let newStoppedWatching = s.stoppedWatching;
              
              if (!newInWatchlist) {
                // Removed from watchlist manually
                const hasWatchedEpisodes = prev.watchedEpisodes && prev.watchedEpisodes[id] && Object.keys(prev.watchedEpisodes[id]).length > 0;
                if (hasWatchedEpisodes) {
                  newStoppedWatching = true;
                } else {
                  newStoppedWatching = false;
                }
              } else {
                // Added to watchlist manually
                newStoppedWatching = false;
              }
              
              return {
                ...s,
                inWatchlist: newInWatchlist,
                stoppedWatching: newStoppedWatching,
              };
            }
            return s;
          });
        } else if (fullItem) {
          updatedShows = [...prev.shows, { ...fullItem, inWatchlist: true, stoppedWatching: false }];
        } else {
          updatedShows = prev.shows;
        }
        return { ...prev, shows: updatedShows };
      } else {
        const exists = prev.movies.some(m => m.id === id);
        let updatedMovies;
        if (exists) {
          updatedMovies = prev.movies.map(m => {
            if (m.id === id) {
              const nextInWatchlist = !m.inWatchlist;
              return {
                ...m,
                inWatchlist: nextInWatchlist,
                completed: nextInWatchlist ? false : m.completed,
                completedAt: nextInWatchlist ? null : m.completedAt,
              };
            }
            return m;
          });
        } else if (fullItem) {
          updatedMovies = [...prev.movies, { ...fullItem, inWatchlist: true, completed: false, completedAt: null }];
        } else {
          updatedMovies = prev.movies;
        }
        return { ...prev, movies: updatedMovies };
      }
    });
  };

  const toggleFavorite = (id: number, type?: MediaType, fullItem?: MediaItem) => {
    setState(prev => {
      const isFav = prev.favorites.includes(id);
      const updatedFavorites = isFav
        ? prev.favorites.filter(favId => favId !== id)
        : [...prev.favorites, id];
      
      let updatedShows = prev.shows;
      let updatedMovies = prev.movies;

      const itemType = type || (prev.shows.some(s => s.id === id) ? 'show' : 'movie');
      const nowStr = new Date().toISOString();

      if (itemType === 'show') {
        const exists = prev.shows.some(s => s.id === id);
        if (exists) {
          updatedShows = prev.shows.map(s => s.id === id ? { ...s, isFavorite: !isFav, favoritedAt: !isFav ? nowStr : null } : s);
        } else if (fullItem) {
          updatedShows = [...prev.shows, { ...fullItem, isFavorite: !isFav, favoritedAt: !isFav ? nowStr : null }];
        }
      } else {
        const exists = prev.movies.some(m => m.id === id);
        if (exists) {
          updatedMovies = prev.movies.map(m => m.id === id ? { ...m, isFavorite: !isFav, favoritedAt: !isFav ? nowStr : null } : m);
        } else if (fullItem) {
          updatedMovies = [...prev.movies, { ...fullItem, isFavorite: !isFav, favoritedAt: !isFav ? nowStr : null }];
        }
      }

      return {
        ...prev,
        favorites: updatedFavorites,
        shows: updatedShows,
        movies: updatedMovies,
      };
    });
  };

  const setRating = (id: number, type: MediaType, rating: number | null, fullItem?: MediaItem) => {
    setState(prev => {
      if (type === 'show') {
        const exists = prev.shows.some(s => s.id === id);
        let updatedShows;
        if (exists) {
          updatedShows = prev.shows.map(s => s.id === id ? { ...s, userRating: rating } : s);
        } else if (fullItem) {
          updatedShows = [...prev.shows, { ...fullItem, userRating: rating }];
        } else {
          updatedShows = prev.shows;
        }
        return {
          ...prev,
          shows: updatedShows,
        };
      } else {
        const exists = prev.movies.some(m => m.id === id);
        let updatedMovies;
        if (exists) {
          updatedMovies = prev.movies.map(m => m.id === id ? { ...m, userRating: rating } : m);
        } else if (fullItem) {
          updatedMovies = [...prev.movies, { ...fullItem, userRating: rating }];
        } else {
          updatedMovies = prev.movies;
        }
        return {
          ...prev,
          movies: updatedMovies,
        };
      }
    });
  };

  const toggleMovieWatched = (movieId: number, fullItem?: MediaItem) => {
    setState(prev => {
      const exists = prev.movies.some(m => m.id === movieId);
      let updatedMovies;
      if (exists) {
        updatedMovies = prev.movies.map(m => {
          if (m.id === movieId) {
            const nextCompleted = !m.completed;
            return {
              ...m,
              completed: nextCompleted,
              inWatchlist: nextCompleted ? false : m.inWatchlist,
              completedAt: nextCompleted ? new Date().toISOString() : null,
            };
          }
          return m;
        });
      } else if (fullItem) {
        updatedMovies = [...prev.movies, {
          ...fullItem,
          completed: true,
          inWatchlist: false,
          completedAt: new Date().toISOString()
        }];
      } else {
        updatedMovies = prev.movies;
      }
      return { ...prev, movies: updatedMovies };
    });
  };

  const toggleEpisodeWatched = (showId: number, seasonNum: number, episodeNum: number, totalEpisodesInShow: number, fullItem?: MediaItem) => {
    setState(prev => {
      const epKey = `S${seasonNum}E${episodeNum}`;
      const showEps = { ...(prev.watchedEpisodes[showId] || {}) };
      
      const wasWatched = !!showEps[epKey];
      if (wasWatched) {
        delete showEps[epKey];
      } else {
        showEps[epKey] = true;
      }

      const updatedWatchedEpisodes = {
        ...prev.watchedEpisodes,
        [showId]: showEps,
      };

      // Recalculate completed status for the show
      // We will count how many episodes are watched
      const watchedCount = Object.keys(showEps).length;
      const isCompleted = watchedCount >= totalEpisodesInShow && totalEpisodesInShow > 0;

      const exists = prev.shows.some(s => s.id === showId);
      let updatedShows;

      if (exists) {
        updatedShows = prev.shows.map(s => {
          if (s.id === showId) {
            let makeWatchlist = s.inWatchlist;
            let makeStopped = s.stoppedWatching;

            if (watchedCount === 0) {
              makeWatchlist = false;
              makeStopped = false;
            } else if (!wasWatched) {
              makeWatchlist = true;
              makeStopped = false;
            }

            return {
              ...s,
              inWatchlist: makeWatchlist,
              stoppedWatching: makeStopped,
              completed: isCompleted,
              lastWatchedAt: !wasWatched ? new Date().toISOString() : s.lastWatchedAt,
              completedAt: isCompleted ? (s.completedAt || new Date().toISOString()) : null,
            };
          }
          return s;
        });
      } else if (fullItem) {
        const makeWatchlist = watchedCount > 0;
        updatedShows = [...prev.shows, {
          ...fullItem,
          inWatchlist: makeWatchlist,
          stoppedWatching: false,
          completed: isCompleted,
          lastWatchedAt: new Date().toISOString(),
          completedAt: isCompleted ? new Date().toISOString() : null,
        }];
      } else {
        updatedShows = prev.shows;
      }

      return {
        ...prev,
        watchedEpisodes: updatedWatchedEpisodes,
        shows: updatedShows,
      };
    });
  };

  // Mark all episodes of a TV show as watched (Completed toggle action)
  const toggleShowCompleted = (showId: number, seasons: Season[], forceComplete?: boolean, fullItem?: MediaItem) => {
    setState(prev => {
      const show = prev.shows.find(s => s.id === showId);
      const shouldComplete = forceComplete !== undefined ? forceComplete : !(show?.completed);
      
      const showEps = { ...(prev.watchedEpisodes[showId] || {}) };
      
      if (shouldComplete) {
        // Mark all episodes of all seasons as watched
        seasons.forEach(season => {
          season.episodes.forEach(episode => {
            const epKey = `S${season.seasonNumber}E${episode.episode}`;
            showEps[epKey] = true;
          });
        });
      } else {
        // Clear all episodes
        seasons.forEach(season => {
          season.episodes.forEach(episode => {
            const epKey = `S${season.seasonNumber}E${episode.episode}`;
            delete showEps[epKey];
          });
        });
      }

      const updatedWatchedEpisodes = {
        ...prev.watchedEpisodes,
        [showId]: showEps,
      };

      const exists = prev.shows.some(s => s.id === showId);
      let updatedShows;

      if (exists) {
        updatedShows = prev.shows.map(s => {
          if (s.id === showId) {
            const makeWatchlist = shouldComplete;
            const makeStopped = false;
            return {
              ...s,
              inWatchlist: makeWatchlist,
              stoppedWatching: makeStopped,
              completed: shouldComplete,
              lastWatchedAt: shouldComplete ? new Date().toISOString() : null,
              completedAt: shouldComplete ? new Date().toISOString() : null,
            };
          }
          return s;
        });
      } else if (fullItem) {
        updatedShows = [...prev.shows, {
          ...fullItem,
          inWatchlist: shouldComplete,
          stoppedWatching: false,
          completed: shouldComplete,
          lastWatchedAt: shouldComplete ? new Date().toISOString() : null,
          completedAt: shouldComplete ? new Date().toISOString() : null,
        }];
      } else {
        updatedShows = prev.shows;
      }

      return {
        ...prev,
        watchedEpisodes: updatedWatchedEpisodes,
        shows: updatedShows,
      };
    });
  };

  // Mark all episodes of a single TV season as watched or unwatched
  const toggleSeasonCompleted = (
    showId: number,
    seasonNumber: number,
    episodes: Episode[],
    totalEpisodesInShow: number,
    forceComplete?: boolean,
    fullItem?: MediaItem
  ) => {
    setState(prev => {
      const showEps = { ...(prev.watchedEpisodes[showId] || {}) };
      
      const seasonEpsKeys = episodes.map(ep => `S${seasonNumber}E${ep.episode}`);
      const allSeasonEpsWatched = seasonEpsKeys.every(key => !!showEps[key]);
      const shouldComplete = forceComplete !== undefined ? forceComplete : !allSeasonEpsWatched;

      episodes.forEach(episode => {
        const epKey = `S${seasonNumber}E${episode.episode}`;
        if (shouldComplete) {
          showEps[epKey] = true;
        } else {
          delete showEps[epKey];
        }
      });

      const updatedWatchedEpisodes = {
        ...prev.watchedEpisodes,
        [showId]: showEps,
      };

      // Recalculate completed status for the entire show
      const watchedCount = Object.keys(showEps).length;
      const isCompleted = watchedCount >= totalEpisodesInShow && totalEpisodesInShow > 0;

      const exists = prev.shows.some(s => s.id === showId);
      let updatedShows;

      if (exists) {
        updatedShows = prev.shows.map(s => {
          if (s.id === showId) {
            let makeWatchlist = s.inWatchlist;
            let makeStopped = s.stoppedWatching;

            if (watchedCount === 0) {
              makeWatchlist = false;
              makeStopped = false;
            } else if (shouldComplete) {
              makeWatchlist = true;
              makeStopped = false;
            }

            return {
              ...s,
              inWatchlist: makeWatchlist,
              stoppedWatching: makeStopped,
              completed: isCompleted,
              lastWatchedAt: shouldComplete && !allSeasonEpsWatched ? new Date().toISOString() : s.lastWatchedAt,
              completedAt: isCompleted ? (s.completedAt || new Date().toISOString()) : null,
            };
          }
          return s;
        });
      } else if (fullItem) {
        const makeWatchlist = watchedCount > 0;
        updatedShows = [...prev.shows, {
          ...fullItem,
          inWatchlist: makeWatchlist,
          stoppedWatching: false,
          completed: isCompleted,
          lastWatchedAt: shouldComplete ? new Date().toISOString() : null,
          completedAt: isCompleted ? new Date().toISOString() : null,
        }];
      } else {
        updatedShows = prev.shows;
      }

      return {
        ...prev,
        watchedEpisodes: updatedWatchedEpisodes,
        shows: updatedShows,
      };
    });
  };

  const toggleStoppedWatching = (showId: number, fullItem?: MediaItem) => {
    setState(prev => {
      const exists = prev.shows.some(s => s.id === showId);
      let updatedShows;
      if (exists) {
        updatedShows = prev.shows.map(s => {
          if (s.id === showId) {
            const newStopped = !s.stoppedWatching;
            return {
              ...s,
              stoppedWatching: newStopped,
              inWatchlist: !newStopped,
              stoppedWatchingAt: newStopped ? new Date().toISOString() : null,
            };
          }
          return s;
        });
      } else if (fullItem) {
        updatedShows = [...prev.shows, {
          ...fullItem,
          stoppedWatching: true,
          inWatchlist: false,
          stoppedWatchingAt: new Date().toISOString(),
        }];
      } else {
        updatedShows = prev.shows;
      }
      return { ...prev, shows: updatedShows };
    });
  };

  // Reset all user progress to zero (clear watchlist, completed, stopped, ratings, watched history, favorites)
  const resetAllProgress = () => {
    isResettingRef.current = true;
    setState({
      shows: state.shows.map(s => ({
        ...s,
        inWatchlist: false,
        completed: false,
        stoppedWatching: false,
        userRating: null,
        isFavorite: false,
        lastWatchedAt: undefined
      })),
      movies: state.movies.map(m => ({
        ...m,
        inWatchlist: false,
        completed: false,
        userRating: null,
        isFavorite: false,
        lastWatchedAt: undefined
      })),
      watchedEpisodes: {},
      favorites: [],
    });
  };

  // Add a newly searched item from TMDB to our local tracked shows/movies
  const importMediaItem = (item: MediaItem) => {
    setState(prev => {
      if (item.type === 'show') {
        const exists = prev.shows.some(s => s.id === item.id);
        if (exists) {
          return {
            ...prev,
            shows: prev.shows.map(s => s.id === item.id ? {
              ...s,
              posterPath: item.posterPath || s.posterPath,
              backdropPath: item.backdropPath || s.backdropPath,
              overview: item.overview || s.overview,
              genres: item.genres && item.genres.length > 0 && item.genres[0] !== 'Drama' ? item.genres : s.genres,
              rating: item.rating || s.rating,
              runtime: item.runtime || s.runtime,
              seasonsCount: item.seasonsCount || s.seasonsCount,
              episodesCount: item.episodesCount || s.episodesCount,
              seasons: item.seasons !== undefined ? item.seasons : s.seasons,
              imdbId: item.imdbId || s.imdbId,
              cast: item.cast !== undefined ? item.cast : s.cast,
            } : s)
          };
        }
        return { ...prev, shows: [...prev.shows, item] };
      } else {
        const exists = prev.movies.some(m => m.id === item.id);
        if (exists) {
          return {
            ...prev,
            movies: prev.movies.map(m => m.id === item.id ? {
              ...m,
              posterPath: item.posterPath || m.posterPath,
              backdropPath: item.backdropPath || m.backdropPath,
              overview: item.overview || m.overview,
              genres: item.genres && item.genres.length > 0 ? item.genres : m.genres,
              rating: item.rating || m.rating,
              runtime: item.runtime || m.runtime,
              imdbId: item.imdbId || m.imdbId,
              cast: item.cast !== undefined ? item.cast : m.cast,
            } : m)
          };
        }
        return { ...prev, movies: [...prev.movies, item] };
      }
    });
  };

  // Bulk import multiple items matching from IMDb CSV
  const importMultipleMediaItems = (
    itemsToImport: {
      item: MediaItem;
      rating: number | null;
      makeFavorite: boolean;
      completed: boolean;
    }[]
  ) => {
    setState(prev => {
      let updatedShows = [...prev.shows];
      let updatedMovies = [...prev.movies];
      let updatedFavorites = [...prev.favorites];

      itemsToImport.forEach(({ item, rating, makeFavorite, completed }) => {
        const enrichedItem = {
          ...item,
          userRating: rating,
          inWatchlist: true,
          completed: completed,
          lastWatchedAt: completed ? new Date().toISOString() : null,
          completedAt: completed ? new Date().toISOString() : null,
          favoritedAt: makeFavorite ? new Date().toISOString() : null,
        };

        if (item.type === 'show') {
          const idx = updatedShows.findIndex(s => s.id === item.id);
          if (idx >= 0) {
            updatedShows[idx] = {
              ...updatedShows[idx],
              ...enrichedItem,
              userRating: rating !== null ? rating : updatedShows[idx].userRating,
              completed: completed,
            };
          } else {
            updatedShows.push(enrichedItem);
          }
        } else {
          const idx = updatedMovies.findIndex(m => m.id === item.id);
          if (idx >= 0) {
            updatedMovies[idx] = {
              ...updatedMovies[idx],
              ...enrichedItem,
              userRating: rating !== null ? rating : updatedMovies[idx].userRating,
              completed: completed,
            };
          } else {
            updatedMovies.push(enrichedItem);
          }
        }

        if (makeFavorite && !updatedFavorites.includes(item.id)) {
          updatedFavorites.push(item.id);
        }
      });

      return {
        ...prev,
        shows: updatedShows,
        movies: updatedMovies,
        favorites: updatedFavorites,
        updatedAt: Date.now(),
      };
    });
  };


  // Compute calculated values based on current time (July 9, 2026)
  const computedData = useMemo(() => {
    const CURRENT_TIME = new Date();
    
    // 1. Enrich Shows and Movies with favorite state
    const enrichedShows = state.shows.map(show => ({
      ...show,
      isFavorite: state.favorites.includes(show.id),
    }));

    const enrichedMovies = state.movies.map(movie => ({
      ...movie,
      isFavorite: state.favorites.includes(movie.id),
    }));

    // Helper to count watched episodes
    const getWatchedEpisodeCount = (showId: number) => {
      return Object.keys(state.watchedEpisodes[showId] || {}).length;
    };

    // TV SHOW WATCHLIST SECTIONS
    // - Watch Next: followed, started (watched >= 1 ep), but there are more remaining to watch, watched < total, and watched within last 30 days
    // - Have Not Watched for a While: followed, started (watched >= 1 ep), watched < total, but lastWatchedAt is > 30 days ago (or null but we predefined it as old)
    // - Have Not Started: followed, 0 episodes watched.
    // - Waiting: watched all currently released episodes, but there are unreleased/upcoming episodes left.
    const watchlistTVShows = enrichedShows.filter(s => s.inWatchlist && !s.completed && !s.stoppedWatching);
    
    const tvWatchNext: MediaItem[] = [];
    const tvLongTimeNoWatch: MediaItem[] = [];
    const tvNotStarted: MediaItem[] = [];
    const tvWaiting: MediaItem[] = [];

    watchlistTVShows.forEach(show => {
      const watchedCount = getWatchedEpisodeCount(show.id);
      const releasedCount = getReleasedEpisodesCount(show);
      
      let totalCount = show.episodesCount || 8;
      if (show.seasons && show.seasons.length > 0) {
        let sum = 0;
        show.seasons.forEach(season => {
          if (season.episodes && season.episodes.length > 0) {
            sum += season.episodes.length;
          }
        });
        if (sum > 0) {
          totalCount = sum;
        }
      }

      if (watchedCount === 0) {
        tvNotStarted.push(show);
      } else if (watchedCount >= releasedCount && releasedCount < totalCount) {
        // Watched all available episodes, but more are coming in the future
        tvWaiting.push(show);
      } else {
        // Check if there are newly released episodes since the user last watched
        let hasNewEpisodes = false;
        const currentDateStr = new Date().toISOString().split('T')[0];
        
        if (show.seasons && show.seasons.length > 0) {
          show.seasons.forEach(season => {
            season.episodes.forEach(ep => {
              const isReleased = !ep.airDate || ep.airDate <= currentDateStr;
              if (isReleased) {
                const epKey = `S${season.seasonNumber}E${ep.episode}`;
                const isWatched = !!(state.watchedEpisodes[show.id]?.[epKey]);
                if (!isWatched) {
                  if (show.lastWatchedAt) {
                    const airDateObj = ep.airDate ? new Date(ep.airDate) : null;
                    const lastWatchedObj = new Date(show.lastWatchedAt);
                    if (airDateObj && airDateObj.getTime() > lastWatchedObj.getTime()) {
                      hasNewEpisodes = true;
                    }
                  } else {
                    hasNewEpisodes = true;
                  }
                }
              }
            });
          });
        }

        // Check if lastWatchedAt is > 30 days ago
        let isOld = false;
        if (show.lastWatchedAt) {
          const lastWatchDate = new Date(show.lastWatchedAt);
          const diffDays = (CURRENT_TIME.getTime() - lastWatchDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 30) {
            isOld = true;
          }
        }

        // Jump back to Watch Next automatically if new episodes come out and become available
        if (hasNewEpisodes) {
          isOld = false;
        }
        
        if (isOld) {
          tvLongTimeNoWatch.push(show);
        } else {
          tvWatchNext.push(show);
        }
      }
    });

    // TV Upcoming chronologically
    const watchlistOnlyShows = enrichedShows.filter(show => show.inWatchlist);
    const upcomingTVTimeline = getUpcomingEpisodesTimeline(watchlistOnlyShows, state.watchedEpisodes);

    // MOVIES TABS
    // - Watchlist: Added and already released (releaseDate <= 2026-07-09) and not completed
    // - Upcoming: Added and not yet released (releaseDate > 2026-07-09)
    const movieWatchlist: MediaItem[] = [];
    const movieUpcoming: MediaItem[] = [];

    enrichedMovies.forEach(movie => {
      if (!movie.inWatchlist) return;
      
      const releaseDate = new Date(movie.releaseDate);
      const isReleased = movie.releaseDate ? releaseDate.getTime() <= CURRENT_TIME.getTime() : true;

      if (isReleased) {
        if (!movie.completed) {
          movieWatchlist.push(movie);
        }
      } else {
        movieUpcoming.push(movie);
      }
    });

    // Sort Movie watchlist by title, movie upcoming by release date
    movieUpcoming.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

    // STATS COUNTER
    // - total episodes watched
    // - total hours spent: episodes watched * typical runtime (mins) / 60 + movies completed * runtime / 60
    // - total movies watched
    let totalEpisodesWatched = 0;
    let tvHours = 0;
    
    // Count all watched episodes across ALL shows in our tracked database
    Object.keys(state.watchedEpisodes).forEach(showIdStr => {
      const showId = Number(showIdStr);
      const epsWatched = Object.keys(state.watchedEpisodes[showId] || {}).length;
      totalEpisodesWatched += epsWatched;
      
      const show = enrichedShows.find(s => s.id === showId);
      const runtime = (show && show.runtime > 0) ? show.runtime : 45;
      tvHours += (epsWatched * runtime) / 60;
    });

    const completedMovies = enrichedMovies
      .filter(m => m.completed)
      .sort((a, b) => {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return timeB - timeA;
      });
    const moviesWatchedCount = completedMovies.length;
    let movieHours = 0;
    completedMovies.forEach(m => {
      movieHours += (m.runtime > 0 ? m.runtime : 120) / 60;
    });

    const showsWatchedCount = Object.keys(state.watchedEpisodes).filter(
      showIdStr => Object.keys(state.watchedEpisodes[Number(showIdStr)] || {}).length > 0
    ).length;

    const stats: UserStats = {
      episodesWatched: totalEpisodesWatched,
      showsWatched: showsWatchedCount,
      hoursSpent: Math.round(tvHours + movieHours),
      moviesWatched: moviesWatchedCount,
    };

    // PROFILE FOUR DISTINCT LISTS (default sort: most recent at top)
    const completedTVShows = enrichedShows
      .filter(s => s.completed)
      .sort((a, b) => {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : (a.lastWatchedAt ? new Date(a.lastWatchedAt).getTime() : 0);
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : (b.lastWatchedAt ? new Date(b.lastWatchedAt).getTime() : 0);
        return timeB - timeA;
      });

    const favoriteTVShows = enrichedShows
      .filter(s => s.isFavorite)
      .sort((a, b) => {
        const timeA = a.favoritedAt ? new Date(a.favoritedAt).getTime() : 0;
        const timeB = b.favoritedAt ? new Date(b.favoritedAt).getTime() : 0;
        return timeB - timeA;
      });

    const favoriteMovies = enrichedMovies
      .filter(m => m.isFavorite)
      .sort((a, b) => {
        const timeA = a.favoritedAt ? new Date(a.favoritedAt).getTime() : 0;
        const timeB = b.favoritedAt ? new Date(b.favoritedAt).getTime() : 0;
        return timeB - timeA;
      });

    const stoppedWatchingTVShows = enrichedShows
      .filter(s => s.stoppedWatching)
      .sort((a, b) => {
        const timeA = a.stoppedWatchingAt ? new Date(a.stoppedWatchingAt).getTime() : 0;
        const timeB = b.stoppedWatchingAt ? new Date(b.stoppedWatchingAt).getTime() : 0;
        return timeB - timeA;
      });

    return {
      shows: enrichedShows,
      movies: enrichedMovies,
      tvWatchNext,
      tvLongTimeNoWatch,
      tvNotStarted,
      tvWaiting,
      upcomingTVTimeline,
      movieWatchlist,
      movieUpcoming,
      stats,
      completedTVShows,
      completedMovies,
      favoriteTVShows,
      favoriteMovies,
      stoppedWatchingTVShows,
    };
  }, [state]);

  return {
    isLoaded,
    loadFailed,
    retryLoad,
    dbStatus,
    shows: computedData.shows,
    movies: computedData.movies,
    watchedEpisodes: state.watchedEpisodes,
    favorites: state.favorites,
    
    // Watchlist columns
    tvWatchNext: computedData.tvWatchNext,
    tvLongTimeNoWatch: computedData.tvLongTimeNoWatch,
    tvNotStarted: computedData.tvNotStarted,
    tvWaiting: computedData.tvWaiting,
    upcomingTVTimeline: computedData.upcomingTVTimeline,
    getReleasedEpisodesCount,
    
    movieWatchlist: computedData.movieWatchlist,
    movieUpcoming: computedData.movieUpcoming,
    
    // Stats & Profile
    stats: computedData.stats,
    completedTVShows: computedData.completedTVShows,
    completedMovies: computedData.completedMovies,
    favoriteTVShows: computedData.favoriteTVShows,
    favoriteMovies: computedData.favoriteMovies,
    stoppedWatchingTVShows: computedData.stoppedWatchingTVShows,
    

    

    // Exports
    exportState,
    importState,

    // Actions
    toggleWatchlist,
    toggleFavorite,
    setRating,
    toggleMovieWatched,
    toggleEpisodeWatched,
    toggleShowCompleted,
    toggleSeasonCompleted,
    toggleStoppedWatching,
    importMediaItem,
    importMultipleMediaItems,
    resetAllProgress,
  };
}
