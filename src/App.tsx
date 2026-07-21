/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from './useAppState';
import { getDeviceId, setDeviceId } from './lib/auth';
import { Navbar, TabType } from './components/Navbar';
import { MediaCard } from './components/MediaCard';
import { DetailModal } from './components/DetailModal';
import { PasscodeScreen } from './components/PasscodeScreen';
import { SitePasswordGate } from './components/SitePasswordGate';
import HlsVideoPlayer from './components/HlsVideoPlayer';
import { ImdbImportWizard } from './components/ImdbImportWizard';
import { PersonCreditsModal } from './components/PersonCreditsModal';
import { MediaItem, MediaType } from './types';
import { fetchTrending, fetchDiscover, fetchPopular, searchMedia, GENRE_MAP, fetchTraktList, fetchMediaRecommendations } from './tmdb';
import { AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  Flame,
  Filter,
  Calendar,
  Tv,
  Film,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Bookmark,
  Heart,
  TrendingUp,
  Inbox,
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  LogOut,
  LogIn,
  User,
  Lock,
  Mail,
  RefreshCw,
  AlertTriangle,
  Download,
  Upload,
  Key,
  Sun,
  Moon,
  EyeOff,
  ArrowUpRight,
  Database,
} from 'lucide-react';

function formatHoursSpent(totalHours: number): string {
  if (totalHours <= 0) return "0h";
  
  const years = Math.floor(totalHours / (24 * 365));
  let remainingHours = totalHours % (24 * 365);
  
  const months = Math.floor(remainingHours / (24 * 30));
  remainingHours = remainingHours % (24 * 30);
  
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || parts.length === 0) parts.push(`${hours}h`);
  
  return parts.join(' ');
}

export default function App() {
  const [isSiteLocked, setIsSiteLocked] = useState<boolean>(() => {
    return localStorage.getItem('site_unlocked') !== 'true';
  });

  const state = useAppState(isSiteLocked);

  const updateGlobalSecurity = (newCode: string | null) => {
    try {
      if (newCode) {
        localStorage.setItem('tv_tracker_master_passcode', newCode);
        localStorage.setItem('tv_tracker_master_passcode_verified', newCode);
      } else {
        localStorage.removeItem('tv_tracker_master_passcode');
        localStorage.removeItem('tv_tracker_master_passcode_verified');
      }
      setGlobalPasscode(newCode);
    } catch (err) {
      console.error('Error saving global security lock:', err);
    }
  };


  // Cloud Sync & Data states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExportFile = () => {
    try {
      state.exportState();
    } catch (err: any) {
      console.error('Failed to export state:', err);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportSuccess(false);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.shows) || !Array.isArray(parsed.movies)) {
          throw new Error('Invalid backup file structure.');
        }
        state.importState(parsed);
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 4000);
      } catch (err: any) {
        console.error('Import error:', err);
        setImportError(err.message || 'Failed to parse JSON backup file.');
        setTimeout(() => setImportError(null), 5000);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read backup file.');
      setTimeout(() => setImportError(null), 5000);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  
  // Global Master Website Lock states (Firestore synchronized)
  const [globalPasscode, setGlobalPasscode] = useState<string | null>(null);
  const [isGlobalLockEnabled, setIsGlobalLockEnabled] = useState<boolean>(false);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState<boolean>(true);
  const [showPasscodeModal, setShowPasscodeModal] = useState<boolean>(false);
  const [passcodeModalMode, setPasscodeModalMode] = useState<'setup' | 'disable' | 'change'>('setup');







  const [customTmdbKey, setCustomTmdbKey] = useState(localStorage.getItem('CUSTOM_TMDB_API_KEY') || '');
  const [customTraktKey, setCustomTraktKey] = useState(localStorage.getItem('CUSTOM_TRAKT_CLIENT_ID') || '');
  const [apiKeysSavedMessage, setApiKeysSavedMessage] = useState(false);

  const handleSaveApiKeys = () => {
    if (customTmdbKey.trim()) {
      localStorage.setItem('CUSTOM_TMDB_API_KEY', customTmdbKey.trim());
    } else {
      localStorage.removeItem('CUSTOM_TMDB_API_KEY');
    }

    if (customTraktKey.trim()) {
      localStorage.setItem('CUSTOM_TRAKT_CLIENT_ID', customTraktKey.trim());
    } else {
      localStorage.removeItem('CUSTOM_TRAKT_CLIENT_ID');
    }
    
    setApiKeysSavedMessage(true);
    setTimeout(() => {
      setApiKeysSavedMessage(false);
      window.location.reload();
    }, 1500);
  };

  const isAppLocked = !isLoadingSecurity && isGlobalLockEnabled && !!globalPasscode && 
    localStorage.getItem('tv_tracker_master_passcode_verified') !== globalPasscode;
  
  const [activeTab, setActiveTab] = useState<TabType>('tv');
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [isImdbImportOpen, setIsImdbImportOpen] = useState<boolean>(false);
  const [autoPlayConfig, setAutoPlayConfig] = useState<{
    server?: string;
    externalPlayer?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    streamUrl?: string;
  } | null>(null);

  // Sub-tab states
  const [tvSubTab, setTvSubTab] = useState<'watchlist' | 'upcoming'>('watchlist');
  const [movieSubTab, setMovieSubTab] = useState<'watchlist' | 'upcoming'>('watchlist');

  // Collapsible accordion states for TV watchlist
  const [watchNextOpen, setWatchNextOpen] = useState(true);
  const [longTimeOpen, setLongTimeOpen] = useState(true);
  const [waitingOpen, setWaitingOpen] = useState(true);
  const [notStartedOpen, setNotStartedOpen] = useState(true);

  // Explore Tab specific states
  const [watchHistory, setWatchHistory] = useState<any[]>([]);

  useEffect(() => {
    import('./lib/watchHistory').then(({ getWatchHistory }) => {
      setWatchHistory(getWatchHistory());
    });
    
    const handleUpdate = () => {
      import('./lib/watchHistory').then(({ getWatchHistory }) => {
        setWatchHistory(getWatchHistory());
      });
    };
    window.addEventListener('watchHistoryUpdated', handleUpdate);
    return () => window.removeEventListener('watchHistoryUpdated', handleUpdate);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Trending daily vs weekly
  const [trendingDaily, setTrendingDaily] = useState<MediaItem[]>([]);
  const [trendingWeekly, setTrendingWeekly] = useState<MediaItem[]>([]);
  const [trendingTimeframe, setTrendingTimeframe] = useState<'day' | 'week'>('week');

  // Popular section
  const [popularItems, setPopularItems] = useState<MediaItem[]>([]);
  const [popularType, setPopularType] = useState<MediaType>('show');
  const [loadingPopular, setLoadingPopular] = useState(false);

  // Discover/Browse with sorting
  const [discoverType, setDiscoverType] = useState<MediaType>('show'); // 'show' or 'movie'
  const [discoverItems, setDiscoverItems] = useState<MediaItem[]>([]);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'year'>('popularity');
  const [loadingDiscover, setLoadingDiscover] = useState(false);

  // Explore sub-tab
  const [exploreSubTab, setExploreSubTab] = useState<'discover' | 'trakt'>('discover');

  // Personalized Recommendations state
  const [rawRecommendations, setRawRecommendations] = useState<MediaItem[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);
  const [recommendationRefreshCounter, setRecommendationRefreshCounter] = useState<number>(0);
  const [dismissedRecs, setDismissedRecs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dismissed_recommendations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDismissRecommendation = (type: MediaType, id: number) => {
    const key = `${type}-${id}`;
    const updated = [...dismissedRecs, key];
    setDismissedRecs(updated);
    localStorage.setItem('dismissed_recommendations', JSON.stringify(updated));
  };

  // Derive filtered recommendations stably
  const recommendations = useMemo(() => {
    // Filter out dismissed recommendations
    let filtered = rawRecommendations.filter(item => !dismissedRecs.includes(`${item.type}-${item.id}`));
    
    // Filter out items that are already watched or in watchlist
    const watchedOrWatchlistIds = new Set<string>();
    state.shows.forEach(s => {
      if (s.completed || s.inWatchlist) {
        watchedOrWatchlistIds.add(`show-${s.id}`);
      }
    });
    state.movies.forEach(m => {
      if (m.completed || m.inWatchlist) {
        watchedOrWatchlistIds.add(`movie-${m.id}`);
      }
    });
    
    filtered = filtered.filter(item => !watchedOrWatchlistIds.has(`${item.type}-${item.id}`));
    
    return filtered.slice(0, 15);
  }, [rawRecommendations, dismissedRecs, state.shows, state.movies]);

  // Trakt specific states
  const [traktMediaType, setTraktMediaType] = useState<MediaType>('movie');
  const [traktListType, setTraktListType] = useState<'trending' | 'boxoffice' | 'popular' | 'favorited' | 'played' | 'watched' | 'anticipated'>('trending');
  const [traktItems, setTraktItems] = useState<MediaItem[]>([]);
  const [loadingTrakt, setLoadingTrakt] = useState(false);
  const [traktPage, setTraktPage] = useState(1);
  const [traktYear, setTraktYear] = useState<string>('');
  const [traktGenre, setTraktGenre] = useState<string | null>(null);
  const [traktHideWatched, setTraktHideWatched] = useState(false);

  // Profile Tab specific states

  const [profileListTab, setProfileListTab] = useState<'creator_cast' | 'completed_tv' | 'completed_movies' | 'fav_tv' | 'fav_movies' | 'stopped_watching'>('creator_cast');
  const [statsRoleType, setStatsRoleType] = useState<'actor' | 'director'>('actor');
  const [showAllActors, setShowAllActors] = useState(false);
  const [showAllDirectors, setShowAllDirectors] = useState(false);
  
  // Progressive display limits to prevent slow render times with large datasets
  const [visibleCompletedTV, setVisibleCompletedTV] = useState(12);
  const [visibleCompletedMovies, setVisibleCompletedMovies] = useState(12);
  const [visibleFavTV, setVisibleFavTV] = useState(12);
  const [visibleFavMovies, setVisibleFavMovies] = useState(12);
  const [visibleStoppedWatching, setVisibleStoppedWatching] = useState(12);
  const [visibleActors, setVisibleActors] = useState(5);
  const [visibleDirectors, setVisibleDirectors] = useState(5);

  // Profile filter & sorting states
  const [profileGenre, setProfileGenre] = useState<string>('All');
  const [profileRating, setProfileRating] = useState<number>(0);
  const [profileYear, setProfileYear] = useState<string>('All');
  const [profileSort, setProfileSort] = useState<'date_added' | 'rating' | 'release_date' | 'title'>('date_added');

  // Reset limits and filters when tabs are changed for fresh/fast page rendering
  useEffect(() => {
    setVisibleCompletedTV(12);
    setVisibleCompletedMovies(12);
    setVisibleFavTV(12);
    setVisibleFavMovies(12);
    setVisibleStoppedWatching(12);
    setVisibleActors(5);
    setVisibleDirectors(5);
    setProfileGenre('All');
    setProfileRating(0);
    setProfileYear('All');
    setProfileSort('date_added');
  }, [profileListTab]);
  const [syncIdInput, setSyncIdInput] = useState('');
  const [loadingSyncInput, setLoadingSyncInput] = useState('');
  const [showLoadingSyncEdit, setShowLoadingSyncEdit] = useState(false);
  const [isEditingSyncId, setIsEditingSyncId] = useState(false);
  const [revealHoursSpent, setRevealHoursSpent] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  const castAndCrewStats = useMemo(() => {
    const actors: Record<number, { id: number; name: string; profilePath: string | null; count: number; items: MediaItem[] }> = {};
    const directors: Record<number, { id: number; name: string; profilePath: string | null; count: number; items: MediaItem[] }> = {};

    // 1. Process all watched movies
    state.movies.forEach(movie => {
      if (!movie.completed) return;

      if (movie.cast && Array.isArray(movie.cast)) {
        movie.cast.forEach(actor => {
          if (!actors[actor.id]) {
            actors[actor.id] = {
              id: actor.id,
              name: actor.name,
              profilePath: actor.profilePath,
              count: 0,
              items: []
            };
          }
          if (!actors[actor.id].items.some(item => item.id === movie.id && item.type === 'movie')) {
            actors[actor.id].count++;
            actors[actor.id].items.push(movie);
          }
        });
      }

      if (movie.directors && Array.isArray(movie.directors)) {
        movie.directors.forEach(dir => {
          if (!directors[dir.id]) {
            directors[dir.id] = {
              id: dir.id,
              name: dir.name,
              profilePath: dir.profilePath,
              count: 0,
              items: []
            };
          }
          if (!directors[dir.id].items.some(item => item.id === movie.id && item.type === 'movie')) {
            directors[dir.id].count++;
            directors[dir.id].items.push(movie);
          }
        });
      }
    });

    // 2. Process all watched shows
    state.shows.forEach(show => {
      const watchedEpisodes = state.watchedEpisodes[show.id];
      const hasEpisodes = watchedEpisodes && Object.keys(watchedEpisodes).length > 0;
      const isWatched = show.completed || hasEpisodes;

      if (!isWatched) return;

      if (show.cast && Array.isArray(show.cast)) {
        show.cast.forEach(actor => {
          if (!actors[actor.id]) {
            actors[actor.id] = {
              id: actor.id,
              name: actor.name,
              profilePath: actor.profilePath,
              count: 0,
              items: []
            };
          }
          if (!actors[actor.id].items.some(item => item.id === show.id && item.type === 'show')) {
            actors[actor.id].count++;
            actors[actor.id].items.push(show);
          }
        });
      }

      if (show.directors && Array.isArray(show.directors)) {
        show.directors.forEach(dir => {
          if (!directors[dir.id]) {
            directors[dir.id] = {
              id: dir.id,
              name: dir.name,
              profilePath: dir.profilePath,
              count: 0,
              items: []
            };
          }
          if (!directors[dir.id].items.some(item => item.id === show.id && item.type === 'show')) {
            directors[dir.id].count++;
            directors[dir.id].items.push(show);
          }
        });
      }
    });

    // 3. Filter lists to only those with count >= 3, and sort by count descending
    const filteredActors = Object.values(actors)
      .filter(actor => actor.count >= 3)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const filteredDirectors = Object.values(directors)
      .filter(dir => dir.count >= 3)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      actors: filteredActors,
      directors: filteredDirectors
    };
  }, [state.shows, state.movies, state.watchedEpisodes]);

  // Dynamically filter and sort whichever list is active in the Profile tab
  const activeListItems = useMemo(() => {
    if (profileListTab === 'completed_tv') return state.completedTVShows;
    if (profileListTab === 'completed_movies') return state.completedMovies;
    if (profileListTab === 'fav_tv') return state.favoriteTVShows;
    if (profileListTab === 'fav_movies') return state.favoriteMovies;
    if (profileListTab === 'stopped_watching') return state.stoppedWatchingTVShows;
    return [];
  }, [profileListTab, state]);

  // Dynamically extract genres from active list items
  const availableGenres = useMemo(() => {
    const genresSet = new Set<string>();
    activeListItems.forEach(item => {
      if (item.genres) {
        item.genres.forEach(g => genresSet.add(g));
      }
    });
    return ['All', ...Array.from(genresSet).sort()];
  }, [activeListItems]);

  // Dynamically extract release years from active list items
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    activeListItems.forEach(item => {
      if (item.releaseDate) {
        const year = item.releaseDate.split('-')[0];
        if (year && year.length === 4) {
          yearsSet.add(year);
        }
      }
    });
    return ['All', ...Array.from(yearsSet).sort((a, b) => b.localeCompare(a))];
  }, [activeListItems]);

  const filteredProfileItems = useMemo(() => {
    let result = [...activeListItems];

    // 1. Genre filter
    if (profileGenre !== 'All') {
      result = result.filter(item => 
        item.genres && item.genres.some(g => g.toLowerCase() === profileGenre.toLowerCase())
      );
    }

    // 2. Rating filter
    if (profileRating > 0) {
      result = result.filter(item => {
        const ratingVal = item.userRating !== null && item.userRating !== undefined ? item.userRating : item.rating;
        return ratingVal && Math.floor(ratingVal) === profileRating;
      });
    }

    // 3. Release Year filter
    if (profileYear !== 'All') {
      result = result.filter(item => {
        if (!item.releaseDate) return false;
        const year = item.releaseDate.split('-')[0];
        return year === profileYear;
      });
    }

    // 4. Sorting
    if (profileSort === 'rating') {
      result.sort((a, b) => {
        const ratingA = a.userRating !== null && a.userRating !== undefined ? a.userRating : (a.rating || 0);
        const ratingB = b.userRating !== null && b.userRating !== undefined ? b.userRating : (b.rating || 0);
        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }
        return a.title.localeCompare(b.title);
      });
    } else if (profileSort === 'release_date') {
      result.sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateB - dateA;
      });
    } else if (profileSort === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [activeListItems, profileGenre, profileRating, profileYear, profileSort]);

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('theme-light');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('theme-light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);


  // Dynamic genres list based on active discover type (TV show vs Movie) using real TMDB genre IDs
  const genresList = React.useMemo(() => {
    if (discoverType === 'show') {
      return [
        { id: null, name: 'All' },
        { id: '18', name: 'Drama' },
        { id: '10765', name: 'Sci-Fi' },
        { id: '10759', name: 'Action' },
        { id: '35', name: 'Comedy' },
        { id: '16', name: 'Animation' },
        { id: '9648', name: 'Mystery' },
        { id: '80', name: 'Crime' },
        { id: '99', name: 'Documentary' },
        { id: '10764', name: 'Reality' },
        { id: '10751', name: 'Family' },
      ];
    } else {
      return [
        { id: null, name: 'All' },
        { id: '18', name: 'Drama' },
        { id: '878', name: 'Sci-Fi' },
        { id: '28', name: 'Action' },
        { id: '35', name: 'Comedy' },
        { id: '16', name: 'Animation' },
        { id: '9648', name: 'Mystery' },
        { id: '53', name: 'Thriller' },
        { id: '10749', name: 'Romance' },
        { id: '27', name: 'Horror' },
        { id: '12', name: 'Adventure' },
        { id: '14', name: 'Fantasy' },
        { id: '80', name: 'Crime' },
        { id: '99', name: 'Documentary' },
        { id: '10751', name: 'Family' },
      ];
    }
  }, [discoverType]);

  // Fetch initial Explore data (Trending, Discover, and Popular) on mount
  useEffect(() => {
    const loadExploreData = async () => {
      try {
        const [dailyData, weeklyData] = await Promise.all([
          fetchTrending('all', 'day'),
          fetchTrending('all', 'week')
        ]);
        setTrendingDaily(dailyData);
        setTrendingWeekly(weeklyData);

        const discoverData = await fetchDiscover('show', 1, undefined, sortBy, selectedYear || undefined);
        const uniqueDiscoverData = Array.from(new Map(discoverData.map(item => [item.id, item])).values());
        setDiscoverItems(uniqueDiscoverData);

        const popularData = await fetchPopular('show', 1);
        setPopularItems(popularData);
      } catch (error) {
        console.error('Error fetching initial explore data:', error);
      }
    };
    loadExploreData();
  }, []);

  // Fetch Personalized Recommendations based on user history, ratings, and favorites
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllRecommendations = async () => {
      // Find local seeds
      const highRatedShows = state.shows.filter(s => s.userRating !== null && s.userRating >= 7);
      const highRatedMovies = state.movies.filter(m => m.userRating !== null && m.userRating >= 7);
      const favShows = state.shows.filter(s => state.favorites.includes(s.id));
      const favMovies = state.movies.filter(m => state.favorites.includes(m.id));
      
      const historySeeds = watchHistory.map(h => h.mediaItem).filter(Boolean);
      
      // Combine seeds
      const allLocalSeeds: MediaItem[] = [
        ...favShows,
        ...favMovies,
        ...highRatedShows,
        ...highRatedMovies,
        ...historySeeds
      ];
      
      // De-duplicate seeds by type and ID
      const uniqueSeedsMap = new Map<string, MediaItem>();
      allLocalSeeds.forEach(item => {
        uniqueSeedsMap.set(`${item.type}-${item.id}`, item);
      });
      
      let seedsToQuery = Array.from(uniqueSeedsMap.values());
      
      // Shuffle/rotate query seeds if user has triggered a refresh, so they discover items from different seeds
      if (seedsToQuery.length > 4) {
        seedsToQuery = [...seedsToQuery].sort(() => Math.random() - 0.5);
      }
      seedsToQuery = seedsToQuery.slice(0, 4);
      
      setLoadingRecommendations(true);
      try {
        let results: MediaItem[] = [];
        
        if (seedsToQuery.length > 0) {
          // Fetch real recommendations for each seed
          const promises = seedsToQuery.map(seed => 
            fetchMediaRecommendations(seed.id, seed.type)
          );
          const responses = await Promise.all(promises);
          responses.forEach(resList => {
            if (Array.isArray(resList)) {
              results.push(...resList);
            }
          });
        }
        
        // If we don't have enough results or no seeds at all, fetch popular/trending fallbacks
        if (results.length < 5) {
          const fallbacks = trendingWeekly.length > 0 ? trendingWeekly : popularItems;
          if (fallbacks.length > 0) {
            const fallbackSeeds = fallbacks.slice(0, 2);
            const fallbackPromises = fallbackSeeds.map(seed => 
              fetchMediaRecommendations(seed.id, seed.type)
            );
            const fallbackResponses = await Promise.all(fallbackPromises);
            fallbackResponses.forEach(resList => {
              if (Array.isArray(resList)) {
                results.push(...resList);
              }
            });
            results.push(...fallbacks);
          }
        }
        
        if (!isMounted) return;
        
        // De-duplicate results
        const uniqueResultsMap = new Map<string, MediaItem>();
        results.forEach(item => {
          if (item && item.id) {
            uniqueResultsMap.set(`${item.type}-${item.id}`, item);
          }
        });
        
        let finalRecs = Array.from(uniqueResultsMap.values());
        
        // Shuffle the results to keep recommendations dynamic and organic, stable in state until next refresh
        finalRecs = [...finalRecs].sort(() => Math.random() - 0.5);
        
        setRawRecommendations(finalRecs);
      } catch (err) {
        console.warn('Failed to generate personalized recommendations:', err);
      } finally {
        if (isMounted) setLoadingRecommendations(false);
      }
    };
    
    if (trendingWeekly.length > 0 || popularItems.length > 0) {
      fetchAllRecommendations();
    }
    
    return () => {
      isMounted = false;
    };
  }, [trendingWeekly, popularItems, recommendationRefreshCounter]);

  // Handle Discover Type Selection (TV Series vs Movies)
  const handleDiscoverTypeSelect = async (type: MediaType) => {
    setDiscoverType(type);
    setSelectedGenre(null);
    setSelectedYear('');
    setDiscoverPage(1);
    setLoadingDiscover(true);
    try {
      const data = await fetchDiscover(type, 1, undefined, sortBy, undefined);
      const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
      setDiscoverItems(uniqueData);
    } catch (e) {
      console.error('Failed to change discover type:', e);
    } finally {
      setLoadingDiscover(false);
    }
  };

  // Handle Genre selection in Explore tab
  const handleGenreSelect = async (genreId: string | null) => {
    setSelectedGenre(genreId);
    setDiscoverPage(1);
    setLoadingDiscover(true);
    try {
      const data = await fetchDiscover(discoverType, 1, genreId || undefined, sortBy, selectedYear || undefined);
      const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
      setDiscoverItems(uniqueData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiscover(false);
    }
  };

  // Handle Sort Selection in Explore tab
  const handleSortSelect = async (sortVal: 'popularity' | 'rating' | 'year') => {
    setSortBy(sortVal);
    setDiscoverPage(1);
    setLoadingDiscover(true);
    try {
      const data = await fetchDiscover(discoverType, 1, selectedGenre || undefined, sortVal, selectedYear || undefined);
      const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
      setDiscoverItems(uniqueData);
    } catch (e) {
      console.error('Failed to sort discover items:', e);
    } finally {
      setLoadingDiscover(false);
    }
  };

  // Handle Year Selection in Explore tab
  const handleYearSelect = async (year: string) => {
    const yearVal = year === 'All' ? '' : year;
    setSelectedYear(yearVal);
    setDiscoverPage(1);
    setLoadingDiscover(true);
    try {
      const data = await fetchDiscover(discoverType, 1, selectedGenre || undefined, sortBy, yearVal || undefined);
      const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
      setDiscoverItems(uniqueData);
    } catch (e) {
      console.error('Failed to filter discover items by year:', e);
    } finally {
      setLoadingDiscover(false);
    }
  };

  // Handle Popular Type Selection in Explore tab
  const handlePopularTypeSelect = async (type: MediaType) => {
    setPopularType(type);
    setLoadingPopular(true);
    try {
      const data = await fetchPopular(type, 1);
      setPopularItems(data);
    } catch (e) {
      console.error('Failed to change popular type:', e);
    } finally {
      setLoadingPopular(false);
    }
  };

  // Simulate infinite scroll by loading more discover items
  const handleLoadMoreDiscover = async () => {
    const nextPage = discoverPage + 1;
    setLoadingDiscover(true);
    try {
      const data = await fetchDiscover(discoverType, nextPage, selectedGenre || undefined, sortBy, selectedYear || undefined);
      setDiscoverItems(prev => {
        const unique = new Map();
        prev.forEach(item => unique.set(item.id, item));
        data.forEach(item => unique.set(item.id, item));
        return Array.from(unique.values());
      });
      setDiscoverPage(nextPage);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiscover(false);
    }
  };

  const loadTraktData = async (resetPage = false) => {
    setLoadingTrakt(true);
    const pageToFetch = resetPage ? 1 : traktPage + 1;
    try {
      const data = await fetchTraktList(traktMediaType, traktListType, pageToFetch, 20, traktYear || undefined, traktGenre || undefined);
      if (resetPage) {
        setTraktItems(data);
        setTraktPage(1);
      } else {
        setTraktItems(prev => {
          const unique = new Map();
          prev.forEach(item => unique.set(item.id, item));
          data.forEach(item => unique.set(item.id, item));
          return Array.from(unique.values());
        });
        setTraktPage(pageToFetch);
      }
    } catch (e) {
      console.error('Failed to load trakt data:', e);
    } finally {
      setLoadingTrakt(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'explore' && exploreSubTab === 'trakt') {
      loadTraktData(true);
    }
  }, [exploreSubTab, traktMediaType, traktListType, traktYear, traktGenre]);

  // Real-time search handler with standard debounce simulation
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const { results } = await searchMedia(searchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error(error);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  // Helper to sync the modal's selected item if state changes underneath
  const currentModalItem = selectedMediaItem
    ? selectedMediaItem.type === 'show'
      ? state.shows.find(s => s.id === selectedMediaItem.id) || selectedMediaItem
      : state.movies.find(m => m.id === selectedMediaItem.id) || selectedMediaItem
    : null;

  // Calculates countdown days for TV upcoming releases relative to current local time
  const getHumanCountdown = (airDateStr: string): string => {
    const CURRENT_TIME = new Date();
    const airDate = new Date(airDateStr);
    
    const d1 = Date.UTC(CURRENT_TIME.getFullYear(), CURRENT_TIME.getMonth(), CURRENT_TIME.getDate());
    const d2 = Date.UTC(airDate.getFullYear(), airDate.getMonth(), airDate.getDate());
    
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  };

  // Calculates precise remaining days, hours, and minutes until an episode airs
  const getDetailedCountdown = (airDateStr: string, airTimeStr?: string) => {
    const CURRENT_TIME = new Date();
    const targetStr = `${airDateStr}T${airTimeStr || '20:00'}:00-07:00`;
    const targetDate = new Date(targetStr);
    
    const diffMs = targetDate.getTime() - CURRENT_TIME.getTime();
    if (diffMs <= 0) {
      return { totalHours: 0, days: 0, hours: 0, minutes: 0, isPast: true };
    }
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    
    return { totalHours, days, hours, minutes, isPast: false };
  };

  // Intercept and display full-screen player if videoUrl parameter is present in the address bar (for Open in New Tab)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const videoUrlParam = searchParams ? searchParams.get('videoUrl') : null;
  const titleParam = searchParams ? searchParams.get('title') || 'Video Player' : 'Video Player';
  const kuSubParam = searchParams ? searchParams.get('kuSub') : null;
  const enSubParam = searchParams ? searchParams.get('enSub') : null;

  if (videoUrlParam) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col justify-center items-center font-sans">
        {/* Minimal header overlay */}
        <div className="absolute top-5 left-5 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5">
          <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center">
            <Tv className="w-3.5 h-3.5 text-zinc-950" />
          </div>
          <span className="font-display font-bold text-xs text-[#F5F5F5]">{titleParam}</span>
        </div>
        <div className="absolute top-5 right-5 z-20">
          <button
            onClick={() => {
              window.location.href = window.location.origin + window.location.pathname;
            }}
            className="px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-lg border border-white/10 transition-colors cursor-pointer"
          >
            Back to App
          </button>
        </div>
        <div className="w-full h-full flex items-center justify-center bg-black">
          <HlsVideoPlayer
            src={videoUrlParam.startsWith("http://") && !videoUrlParam.includes("localhost") ? `/api/proxy-video?url=${encodeURIComponent(videoUrlParam)}` : videoUrlParam}
            kuSub={kuSubParam || undefined}
            enSub={enSubParam || undefined}
            title={titleParam}
            className="w-full h-full object-contain"
            controls
            autoPlay
            controlsList="nodownload"
          />
        </div>
      </div>
    );
  }

  // Global Site Password Gate
  if (isSiteLocked) {
    return (
      <SitePasswordGate
        onUnlock={() => setIsSiteLocked(false)}
      />
    );
  }

  // Full-screen loading screen while cloud database state is restoring
  if (!state.isLoaded) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#F5F5F5] flex flex-col items-center justify-center font-sans antialiased select-none">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center px-6">
          <div className="relative">
            {state.loadFailed ? (
              <div className="relative w-16 h-16 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-center justify-center shadow-2xl shadow-red-500/10">
                <CloudOff className="w-8 h-8 text-red-400" />
              </div>
            ) : (
              <>
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30 animate-pulse">
                  <Tv className="w-8 h-8 text-zinc-950" />
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="font-display font-extrabold text-2xl tracking-tight bg-gradient-to-b from-[#F5F5F5] to-zinc-400 bg-clip-text text-transparent">
              TV Time
            </h1>
            {state.loadFailed ? (
              <p className="text-xs font-medium text-red-400">
                Failed to sync with cloud. Check your connection.
              </p>
            ) : (
              <p className="text-xs font-medium text-zinc-500 animate-pulse">
                Restoring your personal cloud library...
              </p>
            )}
          </div>

          {state.loadFailed ? (
            <button
              onClick={state.retryLoad}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 hover:border-white/20 hover:bg-zinc-800 text-xs font-bold text-zinc-200 rounded-full transition-all cursor-pointer shadow-lg active:scale-95 animate-fade-in"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-once" />
              Retry Sync
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/40 border border-white/5 rounded-full animate-fade-in">
              <div className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Syncing...</span>
            </div>
          )}

          {/* Quick-switch / Manage Profile ID block */}
          <div className="w-full border-t border-white/5 pt-5 mt-2 flex flex-col items-center">
            {showLoadingSyncEdit ? (
              <div className="w-full space-y-3 animate-fade-in text-left">
                <p className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
                  Set Cloud Sync Device ID
                </p>
                <div className="flex gap-2 w-full">
                  <input
                    type="text"
                    value={loadingSyncInput}
                    onChange={(e) => setLoadingSyncInput(e.target.value)}
                    placeholder="Enter Device ID (e.g. MyMostRecent)"
                    className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    onClick={() => {
                      if (loadingSyncInput.trim()) {
                        setDeviceId(loadingSyncInput.trim());
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Load
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => {
                      setDeviceId('MyMostRecent');
                      window.location.reload();
                    }}
                    className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    Quick Load: MyMostRecent
                  </button>
                  <button
                    onClick={() => setShowLoadingSyncEdit(false)}
                    className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-[10px] text-zinc-500">
                  Current ID: <span className="font-mono text-zinc-400">{getDeviceId()}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLoadingSyncInput(getDeviceId());
                      setShowLoadingSyncEdit(true);
                    }}
                    className="text-[10px] font-bold text-amber-500/80 hover:text-amber-400 transition-colors cursor-pointer underline underline-offset-4"
                  >
                    Switch Sync ID / Load Profile
                  </button>
                  <span className="text-[10px] text-zinc-700">|</span>
                  <button
                    onClick={() => {
                      setDeviceId('MyMostRecent');
                      window.location.reload();
                    }}
                    className="text-[10px] font-bold text-zinc-400 hover:text-[#F5F5F5] transition-colors cursor-pointer"
                  >
                    Use "MyMostRecent"
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full-screen passcode unlock screen blocker on startup
  if (isAppLocked) {
    return (
      <PasscodeScreen
        mode="unlock"
        correctPasscode={globalPasscode}
        onSuccess={() => {
          if (globalPasscode) {
            localStorage.setItem('tv_tracker_master_passcode_verified', globalPasscode);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F5] flex justify-center pb-24 font-sans select-none antialiased">
      {/* Centered viewport wrapper optimized for responsive layouts across all devices */}
      <div className="w-full max-w-md md:max-w-4xl lg:max-w-[92%] xl:max-w-7xl 2xl:max-w-[1400px] bg-[#050505] min-h-screen shadow-2xl flex flex-col relative border-x border-white/5 overflow-x-hidden transition-all duration-300">
        
        {/* APP GLOBAL TOP BAR */}
        <header className="sticky top-0 bg-[#0A0A0A]/85 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-5 z-40">
          <div className="flex items-center gap-2">


            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Tv className="w-4.5 h-4.5 text-zinc-950" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-[#F5F5F5] to-zinc-400 bg-clip-text text-transparent">
              TV Time
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (getDeviceId() !== 'MyMostRecent') {
                  setDeviceId('MyMostRecent');
                  window.location.reload();
                } else {
                  setActiveTab('profile');
                  // Smooth scroll to the profile sync box
                  setTimeout(() => {
                    const el = document.getElementById('sync-id-input-field');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 200);
                }
              }}
              title={getDeviceId() === 'MyMostRecent' ? "Active Profile: MyMostRecent (Click to view profile)" : "Switch to MyMostRecent Profile"}
              className={`px-2.5 py-1.5 border rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                getDeviceId() === 'MyMostRecent'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                  : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/5'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync:</span>
              <span className="font-mono">{getDeviceId().slice(0, 12)}{getDeviceId().length > 12 ? '...' : ''}</span>
            </button>
            
            <span className="px-2.5 py-1.5 bg-zinc-900/60 border border-white/5 rounded-lg text-[10px] font-semibold text-zinc-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>July 2026</span>
            </span>
          </div>
        </header>

        {/* ==============================================
            MAIN TABS CONTENT SWITCHER
            ============================================== */}
        <main className="flex-grow p-4">              {/* 1. TV SHOWS TAB */}
          {activeTab === 'tv' && (
            <div className="space-y-4 animate-fade-in">
              {/* SUB TABS FOR TV */}
              <div className="flex bg-zinc-900/50 border border-white/5 p-1 rounded-xl">
                <button
                  id="tv-subtab-watchlist"
                  onClick={() => setTvSubTab('watchlist')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    tvSubTab === 'watchlist'
                      ? 'bg-zinc-850 text-amber-500 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  My Watchlist
                </button>
                <button
                  id="tv-subtab-upcoming"
                  onClick={() => setTvSubTab('upcoming')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    tvSubTab === 'upcoming'
                      ? 'bg-zinc-850 text-amber-500 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  Upcoming Timeline
                </button>
              </div>

              {/* WATCHLIST SUB TAB */}
              {tvSubTab === 'watchlist' && (
                <div className="space-y-3.5">
                  
                  {/* SECTION 1: WATCH NEXT (Accordion) */}
                  <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                    <button
                      id="accordion-watch-next"
                      onClick={() => setWatchNextOpen(!watchNextOpen)}
                      className="w-full flex items-center justify-between p-4 text-left border-b border-white/5 focus:outline-none cursor-pointer hover:bg-white/[0.01] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 bg-amber-500 rounded-full shadow-lg shadow-amber-500/30" />
                        <h2 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                          Watch Next ({state.tvWatchNext.length})
                        </h2>
                      </div>
                      {watchNextOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </button>
                    
                    {watchNextOpen && (
                      <div className="p-4 bg-[#050505]/40">
                        {state.tvWatchNext.length === 0 ? (
                          <div className="text-center py-6 text-xs text-zinc-500 flex flex-col items-center gap-1.5">
                            <Inbox className="w-6 h-6 text-zinc-600 stroke-[1.5]" />
                            <span>No shows started with remaining episodes.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {state.tvWatchNext.map(show => {
                              const watched = Object.keys(state.watchedEpisodes[show.id] || {}).length;
                              const releasedCount = state.getReleasedEpisodesCount(show);
                              const upcomingEp = state.upcomingTVTimeline?.find(ep => ep.showId === show.id);
                              return (
                                <MediaCard
                                  key={show.id}
                                  item={show}
                                  onToggleWatchlist={(e) => {
                                    e.stopPropagation();
                                    state.toggleWatchlist(show.id, show.type, show);
                                  }}
                                  onClick={() => setSelectedMediaItem(show)}
                                  watchedEpisodesCount={watched}
                                  totalEpisodesCount={releasedCount}
                                  upcomingEpisode={upcomingEp ? {
                                    seasonNumber: upcomingEp.seasonNumber,
                                    episodeNumber: upcomingEp.episodeNumber,
                                    airDate: upcomingEp.airDate,
                                    airTime: upcomingEp.airTime
                                  } : null}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: HAVE NOT WATCHED FOR A WHILE (Accordion) */}
                  <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                    <button
                      id="accordion-long-time"
                      onClick={() => setLongTimeOpen(!longTimeOpen)}
                      className="w-full flex items-center justify-between p-4 text-left border-b border-white/5 focus:outline-none cursor-pointer hover:bg-white/[0.01] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 bg-amber-600 rounded-full shadow-lg shadow-amber-600/30" />
                        <h2 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                          Inactive Over 30 Days ({state.tvLongTimeNoWatch.length})
                        </h2>
                      </div>
                      {longTimeOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </button>

                    {longTimeOpen && (
                      <div className="p-4 bg-[#050505]/40">
                        {state.tvLongTimeNoWatch.length === 0 ? (
                          <div className="text-center py-6 text-xs text-zinc-500 flex flex-col items-center gap-1.5">
                            <Check className="w-5 h-5 text-zinc-600" />
                            <span>All started shows have recent activity!</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {state.tvLongTimeNoWatch.map(show => {
                              const watched = Object.keys(state.watchedEpisodes[show.id] || {}).length;
                              const releasedCount = state.getReleasedEpisodesCount(show);
                              const upcomingEp = state.upcomingTVTimeline?.find(ep => ep.showId === show.id);
                              return (
                                <MediaCard
                                  key={show.id}
                                  item={show}
                                  onToggleWatchlist={(e) => {
                                    e.stopPropagation();
                                    state.toggleWatchlist(show.id, show.type, show);
                                  }}
                                  onClick={() => setSelectedMediaItem(show)}
                                  watchedEpisodesCount={watched}
                                  totalEpisodesCount={releasedCount}
                                  upcomingEpisode={upcomingEp ? {
                                    seasonNumber: upcomingEp.seasonNumber,
                                    episodeNumber: upcomingEp.episodeNumber,
                                    airDate: upcomingEp.airDate,
                                    airTime: upcomingEp.airTime
                                  } : null}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2.5: WAITING FOR NEW EPISODES (Accordion) */}
                  <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                    <button
                      id="accordion-waiting"
                      onClick={() => setWaitingOpen(!waitingOpen)}
                      className="w-full flex items-center justify-between p-4 text-left border-b border-white/5 focus:outline-none cursor-pointer hover:bg-white/[0.01] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/30" />
                        <h2 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                          Waiting for New Episodes ({state.tvWaiting?.length || 0})
                        </h2>
                      </div>
                      {waitingOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </button>

                    {waitingOpen && (
                      <div className="p-4 bg-[#050505]/40">
                        {!state.tvWaiting || state.tvWaiting.length === 0 ? (
                          <div className="text-center py-6 text-xs text-zinc-500 flex flex-col items-center gap-1.5">
                            <Clock className="w-5 h-5 text-zinc-600" />
                            <span>No shows waiting for new episodes.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {state.tvWaiting.map(show => {
                              const watched = Object.keys(state.watchedEpisodes[show.id] || {}).length;
                              const releasedCount = state.getReleasedEpisodesCount(show);
                              const upcomingEp = state.upcomingTVTimeline?.find(ep => ep.showId === show.id);
                              return (
                                <MediaCard
                                  key={show.id}
                                  item={show}
                                  onToggleWatchlist={(e) => {
                                    e.stopPropagation();
                                    state.toggleWatchlist(show.id, show.type, show);
                                  }}
                                  onClick={() => setSelectedMediaItem(show)}
                                  watchedEpisodesCount={watched}
                                  totalEpisodesCount={releasedCount}
                                  upcomingEpisode={upcomingEp ? {
                                    seasonNumber: upcomingEp.seasonNumber,
                                    episodeNumber: upcomingEp.episodeNumber,
                                    airDate: upcomingEp.airDate,
                                    airTime: upcomingEp.airTime
                                  } : null}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: HAVE NOT STARTED (Accordion) */}
                  <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                    <button
                      id="accordion-not-started"
                      onClick={() => setNotStartedOpen(!notStartedOpen)}
                      className="w-full flex items-center justify-between p-4 text-left border-b border-white/5 focus:outline-none cursor-pointer hover:bg-white/[0.01] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 bg-zinc-600 rounded-full" />
                        <h2 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                          Have Not Started ({state.tvNotStarted.length})
                        </h2>
                      </div>
                      {notStartedOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </button>

                    {notStartedOpen && (
                      <div className="p-4 bg-[#050505]/40">
                        {state.tvNotStarted.length === 0 ? (
                          <div className="text-center py-6 text-xs text-zinc-500 flex flex-col items-center gap-1.5">
                            <PlusIcon className="w-6 h-6 text-zinc-600" />
                            <span>No unstarted shows tracked.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {state.tvNotStarted.map(show => {
                              const releasedCount = state.getReleasedEpisodesCount(show);
                              const upcomingEp = state.upcomingTVTimeline?.find(ep => ep.showId === show.id);
                              return (
                                <MediaCard
                                  key={show.id}
                                  item={show}
                                  onToggleWatchlist={(e) => {
                                    e.stopPropagation();
                                    state.toggleWatchlist(show.id, show.type, show);
                                  }}
                                  onClick={() => setSelectedMediaItem(show)}
                                  watchedEpisodesCount={0}
                                  totalEpisodesCount={releasedCount}
                                  upcomingEpisode={upcomingEp ? {
                                    seasonNumber: upcomingEp.seasonNumber,
                                    episodeNumber: upcomingEp.episodeNumber,
                                    airDate: upcomingEp.airDate,
                                    airTime: upcomingEp.airTime
                                  } : null}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TV UPCOMING TIMELINE */}
              {tvSubTab === 'upcoming' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pl-1">
                    Chronological Release Calendar
                  </h3>

                  {state.upcomingTVTimeline.length === 0 ? (
                    <div className="bg-zinc-900/10 border border-white/5 p-8 rounded-2xl text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                      <Calendar className="w-8 h-8 text-zinc-700 stroke-[1.5]" />
                      <span>No upcoming releases found for tracked shows. Add shows like Stranger Things or Wednesday to see countdowns!</span>
                    </div>
                  ) : (
                    <div className="relative border-l border-white/5 pl-4 ml-3 space-y-5 py-2">
                      {state.upcomingTVTimeline.map((item, index) => {
                        const countdown = getHumanCountdown(item.airDate);
                        const isSoon = countdown === 'Today' || countdown === 'Tomorrow';
                        
                        return (
                          <div key={item.episodeId} className="relative group select-none">
                            {/* Point Indicator on timeline */}
                            <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-zinc-950 transition-all ${
                              isSoon ? 'bg-amber-500 ring-4 ring-amber-500/20' : 'bg-zinc-850'
                            }`} />

                            <div className="bg-zinc-900/40 hover:bg-[#0A0A0A]/80 border border-white/5 hover:border-white/10 p-3.5 rounded-xl flex gap-3.5 transition-all">
                              <img
                                src={item.showPoster}
                                alt={item.showTitle}
                                referrerPolicy="no-referrer"
                                className="w-14 rounded-lg object-cover shadow-md shrink-0 cursor-pointer"
                                onClick={() => {
                                  const sItem = state.shows.find(s => s.id === item.showId);
                                  if (sItem) setSelectedMediaItem(sItem);
                                }}
                              />
                              <div className="flex-grow space-y-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  isSoon ? 'bg-amber-500 text-black font-black' : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                  {countdown}
                                </span>
                                
                                <h4
                                  onClick={() => {
                                    const sItem = state.shows.find(s => s.id === item.showId);
                                    if (sItem) setSelectedMediaItem(sItem);
                                  }}
                                  className="font-display font-bold text-sm text-[#F5F5F5] hover:text-amber-500 transition-colors cursor-pointer"
                                >
                                  {item.showTitle}
                                </h4>

                                <p className="text-xs text-zinc-400 font-medium leading-none">
                                  Season {item.seasonNumber}, Ep {item.episodeNumber}
                                </p>
                                <p className="text-[11px] text-zinc-500 line-clamp-1 italic">
                                  &ldquo;{item.episodeTitle}&rdquo;
                                </p>

                                <div className="text-[10px] text-zinc-500 flex items-center gap-1 pt-1 font-mono">
                                  <Clock className="w-3 h-3 text-zinc-600" />
                                  <span>{item.airDate} • {item.airTime}</span>
                                </div>

                                {/* Precise live-style ticking countdown relative to Jul 9, 2026 */}
                                {!getDetailedCountdown(item.airDate, item.airTime).isPast && (
                                  <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mr-1">Countdown:</span>
                                    <div className="flex items-center gap-1 font-mono select-none">
                                      {getDetailedCountdown(item.airDate, item.airTime).days > 0 && (
                                        <div className="flex items-center">
                                          <span className="bg-zinc-950 px-1.5 py-0.5 border border-white/5 rounded text-[10px] font-black text-amber-500">
                                            {String(getDetailedCountdown(item.airDate, item.airTime).days).padStart(2, '0')}
                                          </span>
                                          <span className="text-[9px] text-zinc-500 px-0.5">d</span>
                                        </div>
                                      )}
                                      <div className="flex items-center">
                                        <span className="bg-zinc-950 px-1.5 py-0.5 border border-white/5 rounded text-[10px] font-black text-amber-500">
                                          {String(getDetailedCountdown(item.airDate, item.airTime).hours).padStart(2, '0')}
                                        </span>
                                        <span className="text-[9px] text-zinc-500 px-0.5">h</span>
                                      </div>
                                      <div className="flex items-center">
                                        <span className="bg-zinc-950 px-1.5 py-0.5 border border-white/5 rounded text-[10px] font-black text-amber-500">
                                          {String(getDetailedCountdown(item.airDate, item.airTime).minutes).padStart(2, '0')}
                                        </span>
                                        <span className="text-[9px] text-zinc-500 px-0.5">m</span>
                                      </div>
                                    </div>
                                    <span className="text-[9px] text-amber-500/80 font-bold uppercase animate-pulse ml-1">
                                      remaining
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. MOVIES TAB */}
          {activeTab === 'movies' && (
            <div className="space-y-4 animate-fade-in">
              {/* SUB TABS FOR MOVIES */}
              <div className="flex bg-zinc-900/50 border border-white/5 p-1 rounded-xl">
                <button
                  id="movies-subtab-released"
                  onClick={() => setMovieSubTab('watchlist')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    movieSubTab === 'watchlist'
                      ? 'bg-zinc-850 text-amber-500 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  Released Watchlist ({state.movieWatchlist.length})
                </button>
                <button
                  id="movies-subtab-upcoming"
                  onClick={() => setMovieSubTab('upcoming')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    movieSubTab === 'upcoming'
                      ? 'bg-zinc-850 text-amber-500 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  Upcoming Releases ({state.movieUpcoming.length})
                </button>
              </div>

               {/* MOVIE WATCHLIST */}
              {movieSubTab === 'watchlist' && (
                <div className="space-y-3">

                  {state.movieWatchlist.length === 0 ? (
                    <div className="bg-zinc-900/10 border border-white/5 p-10 rounded-2xl text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                      <Film className="w-8 h-8 text-zinc-700 stroke-[1.5]" />
                      <span>Your movie watchlist is empty. Go to the Explore tab and search movies to add them!</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                      {state.movieWatchlist.map(movie => (
                        <MediaCard
                                  key={movie.id}
                                  item={movie}
                                  onToggleWatchlist={(e) => {
                                    e.stopPropagation();
                                    state.toggleWatchlist(movie.id, movie.type, movie);
                                  }}
                          onClick={() => setSelectedMediaItem(movie)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MOVIE UPCOMING */}
              {movieSubTab === 'upcoming' && (
                <div className="space-y-3">
                  {state.movieUpcoming.length === 0 ? (
                    <div className="bg-zinc-900/10 border border-white/5 p-10 rounded-2xl text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                      <Calendar className="w-8 h-8 text-zinc-700 stroke-[1.5]" />
                      <span>No unreleased upcoming movies added. Try adding Spider-Man: Beyond the Spider-Verse or Avatar: Fire and Ash!</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                      {state.movieUpcoming.map(movie => (
                        <div key={movie.id} className="relative group select-none">
                          <MediaCard
                            item={movie}
                            onClick={() => setSelectedMediaItem(movie)}
                            onToggleWatchlist={(e) => {
                              e.stopPropagation();
                              state.toggleWatchlist(movie.id, movie.type, movie);
                            }}
                          />
                          {/* Future Release airdate Overlay tag */}
                          <div className="absolute bottom-16 left-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-md border border-white/5 rounded-lg text-center z-10">
                            <p className="text-[9px] uppercase tracking-wider font-extrabold text-amber-500 leading-none">
                              {getHumanCountdown(movie.releaseDate)}
                            </p>
                            <p className="text-[8px] text-zinc-400 font-mono mt-0.5">
                              {movie.releaseDate}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. EXPLORE TAB */}
          {activeTab === 'explore' && (
            <div className="space-y-4.5 animate-fade-in">
              
              <div className="flex bg-zinc-900/50 border border-white/5 p-1 rounded-xl">
                <button
                  onClick={() => setExploreSubTab('discover')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    exploreSubTab === 'discover'
                      ? 'bg-zinc-850 text-amber-500 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  Discover & Search
                </button>
                <button
                  onClick={() => setExploreSubTab('trakt')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    exploreSubTab === 'trakt'
                      ? 'bg-zinc-850 text-amber-500 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  Trakt Lists
                </button>
              </div>

              {exploreSubTab === 'discover' ? (
                <>
                  {/* REAL-TIME SEARCH BAR */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                    <input
                      id="search-media-input"
                      type="text"
                      placeholder="Search popular movies and TV shows..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-zinc-900/40 border border-white/5 hover:border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 pl-11 pr-10 py-3 rounded-xl text-sm font-medium placeholder-zinc-500 outline-none transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 text-xs font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>

              {/* SEARCH RESULTS VIEW */}
              {searchTerm.trim() ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-400 text-xs pl-1 font-medium">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                    <span>Search results for &ldquo;{searchTerm}&rdquo;</span>
                  </div>

                  {searching ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      <span className="text-xs text-zinc-500">Searching TMDB network...</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-16 text-center text-xs text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl flex flex-col items-center gap-2">
                      <AlertCircle className="w-7 h-7 text-zinc-700" />
                      <span>No items found. Double check typing, or check TMDB connection.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                      {searchResults.map(item => {
                        // Find local version if already tracked to preserve state
                        const localItem = item.type === 'show'
                          ? state.shows.find(s => s.id === item.id)
                          : state.movies.find(m => m.id === item.id);
                        
                        return (
                          <MediaCard
                            key={`${item.type}-${item.id}`}
                            item={localItem || item}
                            onClick={() => {
                              // Ensure item is tracked in app state so modifications persist
                              if (!localItem) state.importMediaItem(item);
                              setSelectedMediaItem(localItem || item);
                            }}
                            onToggleWatchlist={(e) => {
                              e.stopPropagation();
                              state.toggleWatchlist(item.id, item.type, localItem || item);
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* EXPLORE HOME VIEW */
                <div className="space-y-5">

                  {/* PERSONALIZED RECOMMENDATIONS SECTION */}
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pl-1 pr-1 gap-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4.5 h-4.5 text-amber-500 fill-amber-500/25 animate-pulse" />
                        <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider flex items-center gap-2">
                          Recommended For You
                        </h3>
                        <button
                          onClick={() => setRecommendationRefreshCounter(prev => prev + 1)}
                          disabled={loadingRecommendations}
                          className="p-1 text-zinc-400 hover:text-amber-500 hover:bg-white/5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Refresh / Update recommendations list"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingRecommendations ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      
                      <div className="text-[10px] text-zinc-400 font-medium">
                        {state.favorites.length > 0 || state.shows.some(s => s.userRating !== null) || state.movies.some(m => m.userRating !== null) || watchHistory.length > 0 ? (
                          <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold">
                            ✨ Tailored to Your Taste
                          </span>
                        ) : (
                          <span className="text-zinc-500 italic bg-zinc-900/40 px-2 py-0.5 rounded-full border border-white/5">
                            Rate & favorite titles for custom picks
                          </span>
                        )}
                      </div>
                    </div>

                    {loadingRecommendations ? (
                      <div className="py-12 bg-zinc-900/20 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                        <span className="text-[10px] text-zinc-500 font-mono">Generating recommendations...</span>
                      </div>
                    ) : recommendations.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x">
                        {recommendations.map(item => {
                          const localItem = item.type === 'show'
                            ? state.shows.find(s => s.id === item.id)
                            : state.movies.find(m => m.id === item.id);

                          return (
                            <div className="w-36 md:w-44 lg:w-52 shrink-0 snap-start relative group" key={`recommendation-${item.id}`}>
                              <MediaCard
                                item={localItem || item}
                                onClick={() => {
                                  if (!localItem) state.importMediaItem(item);
                                  setSelectedMediaItem(localItem || item);
                                }}
                                onToggleWatchlist={(e) => {
                                  e.stopPropagation();
                                  state.toggleWatchlist(item.id, item.type, localItem || item);
                                }}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismissRecommendation(item.type, item.id);
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-black/85 hover:bg-red-500 hover:text-white border border-white/10 rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer z-10"
                                title="Not interested / Hide this recommendation"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl">
                        No custom recommendations found.
                      </div>
                    )}
                  </div>

                  {/* WATCH HISTORY SECTION */}
                  {watchHistory && watchHistory.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pl-1 pr-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4.5 h-4.5 text-amber-500 fill-amber-500/25" />
                          <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                            Watch History
                          </h3>
                        </div>
                      </div>

                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x">
                        {watchHistory.map((item, idx) => {
                          const localItem = item.mediaItem;
                          const dateObj = new Date(item.watchedAt);
                          const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

                          return (
                            <div className="w-36 md:w-44 lg:w-52 shrink-0 snap-start relative group" key={`history-${item.id}-${idx}`}>
                              <MediaCard
                                item={localItem}
                                onClick={() => {
                                  if (!state.shows.find(s => s.id === localItem.id) && !state.movies.find(m => m.id === localItem.id)) {
                                    state.importMediaItem(localItem);
                                  }
                                  setAutoPlayConfig({
                                    server: item.server,
                                    externalPlayer: item.externalPlayer,
                                    seasonNumber: item.seasonNumber,
                                    episodeNumber: item.episodeNumber,
                                    streamUrl: item.streamUrl
                                  });
                                  setSelectedMediaItem(localItem);
                                }}
                                onToggleWatchlist={(e) => {
                                  e.stopPropagation();
                                  state.toggleWatchlist(localItem.id, localItem.type, localItem);
                                }}
                              />
                              <div className="absolute top-2 left-2 right-2 bg-black/80 backdrop-blur-md rounded px-2 py-1 flex flex-col pointer-events-none">
                                <span className="text-[9px] text-amber-500 font-bold uppercase truncate">
                                  {item.type === 'show' ? `S${item.seasonNumber} E${item.episodeNumber}` : 'Movie'}
                                </span>
                                <span className="text-[8px] text-zinc-300 font-mono">
                                  Watched: {dateStr}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* TRENDING SECTION WITH TIME CONTROL */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between pl-1 pr-1">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4.5 h-4.5 text-amber-500 fill-amber-500/25" />
                        <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                          Trending Content
                        </h3>
                      </div>
                      
                      {/* Segmented control for Daily vs Weekly */}
                      <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-white/5">
                        <button
                          onClick={() => setTrendingTimeframe('day')}
                          className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                            trendingTimeframe === 'day'
                              ? 'bg-amber-500 text-zinc-950 shadow-sm font-extrabold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Daily
                        </button>
                        <button
                          onClick={() => setTrendingTimeframe('week')}
                          className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                            trendingTimeframe === 'week'
                              ? 'bg-amber-500 text-zinc-950 shadow-sm font-extrabold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Weekly
                        </button>
                      </div>
                    </div>

                    {/* Horizontally scrollable row */}
                    {(trendingTimeframe === 'day' ? trendingDaily : trendingWeekly).length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x">
                        {(trendingTimeframe === 'day' ? trendingDaily : trendingWeekly).map(item => {
                          const localItem = item.type === 'show'
                            ? state.shows.find(s => s.id === item.id)
                            : state.movies.find(m => m.id === item.id);

                          return (
                            <div className="w-36 md:w-44 lg:w-52 shrink-0 snap-start" key={`trending-${item.id}`}>
                              <MediaCard
                                item={localItem || item}
                                onClick={() => {
                                  if (!localItem) state.importMediaItem(item);
                                  setSelectedMediaItem(localItem || item);
                                }}
                                onToggleWatchlist={(e) => {
                                  e.stopPropagation();
                                  state.toggleWatchlist(item.id, item.type, localItem || item);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl">
                        No trending items found.
                      </div>
                    )}
                  </div>

                  {/* POPULAR CONTENT SECTION */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between pl-1 pr-1">
                      <div className="flex items-center gap-2">
                        <Award className="w-4.5 h-4.5 text-amber-500 fill-amber-500/25" />
                        <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                          Popular Content
                        </h3>
                      </div>
                      
                      {/* Segmented control for TV Shows vs Movies */}
                      <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-white/5">
                        <button
                          onClick={() => handlePopularTypeSelect('show')}
                          className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                            popularType === 'show'
                              ? 'bg-amber-500 text-zinc-950 shadow-sm font-extrabold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          TV Shows
                        </button>
                        <button
                          onClick={() => handlePopularTypeSelect('movie')}
                          className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                            popularType === 'movie'
                              ? 'bg-amber-500 text-zinc-950 shadow-sm font-extrabold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Movies
                        </button>
                      </div>
                    </div>

                    {loadingPopular ? (
                      <div className="py-12 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      </div>
                    ) : popularItems.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x">
                        {popularItems.map(item => {
                          const localItem = item.type === 'show'
                            ? state.shows.find(s => s.id === item.id)
                            : state.movies.find(m => m.id === item.id);

                          return (
                            <div className="w-36 md:w-44 lg:w-52 shrink-0 snap-start" key={`popular-${item.id}`}>
                              <MediaCard
                                item={localItem || item}
                                onClick={() => {
                                  if (!localItem) state.importMediaItem(item);
                                  setSelectedMediaItem(localItem || item);
                                }}
                                onToggleWatchlist={(e) => {
                                  e.stopPropagation();
                                  state.toggleWatchlist(item.id, item.type, localItem || item);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl">
                        No popular items loaded.
                      </div>
                    )}
                  </div>

                  {/* DISCOVER TYPE SELECTOR (TV Series vs Movies) */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between pl-1">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-amber-500" />
                        <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                          Browse & Discover
                        </h3>
                      </div>
                    </div>

                    <div className="flex bg-zinc-900/50 border border-white/5 p-1 rounded-xl">
                      <button
                        id="discover-type-show"
                        onClick={() => handleDiscoverTypeSelect('show')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          discoverType === 'show'
                            ? 'bg-zinc-850 text-amber-500 shadow-sm font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        TV Shows
                      </button>
                      <button
                        id="discover-type-movie"
                        onClick={() => handleDiscoverTypeSelect('movie')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          discoverType === 'movie'
                            ? 'bg-zinc-850 text-amber-500 shadow-sm font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Movies
                      </button>
                    </div>

                    {/* SORT BY CONTROL */}
                    <div className="space-y-1.5 pl-1 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                          Sort By:
                        </span>
                        <span className="text-[10px] font-mono text-amber-500 font-semibold uppercase">
                          {sortBy === 'popularity' ? 'Popularity' : sortBy === 'rating' ? 'Rating' : 'Release Date'}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleSortSelect('popularity')}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                            sortBy === 'popularity'
                              ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm'
                              : 'bg-zinc-900/40 hover:bg-zinc-850 text-zinc-400 border-white/5 hover:border-white/10'
                          }`}
                        >
                          Popularity
                        </button>
                        <button
                          onClick={() => handleSortSelect('rating')}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                            sortBy === 'rating'
                              ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm'
                              : 'bg-zinc-900/40 hover:bg-zinc-850 text-zinc-400 border-white/5 hover:border-white/10'
                          }`}
                        >
                          Top Rated
                        </button>
                        <button
                          onClick={() => handleSortSelect('year')}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                            sortBy === 'year'
                              ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm'
                              : 'bg-zinc-900/40 hover:bg-zinc-850 text-zinc-400 border-white/5 hover:border-white/10'
                          }`}
                        >
                          Release Year
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* PILL GENRE FILTERS */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pl-1">
                      <Filter className="w-4 h-4 text-amber-500" />
                      <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                        Categories & Filters
                      </h3>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {genresList.map((g) => (
                        <button
                          key={g.name}
                          id={`genre-pill-${g.name.replace(/\s+/g, '-').toLowerCase()}`}
                          onClick={() => handleGenreSelect(g.id)}
                          className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all border cursor-pointer ${
                            selectedGenre === g.id
                              ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-md shadow-amber-500/10'
                              : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 border-white/5 hover:border-white/10'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* YEAR FILTERS */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pl-1">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                        Release Year
                      </h3>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {['All', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2010', '2005', '2000'].map((year) => {
                        const isSelected = selectedYear === (year === 'All' ? '' : year);
                        return (
                          <button
                            key={year}
                            id={`year-pill-${year}`}
                            onClick={() => handleYearSelect(year)}
                            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-md shadow-amber-500/10'
                                : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 border-white/5 hover:border-white/10'
                            }`}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DISCOVER ENDLESS SCROLL LIST SIMULATION */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 pl-1">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                        {discoverType === 'show' ? 'Discover TV Series' : 'Discover Movies'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                      {discoverItems.map(item => {
                        const localItem = item.type === 'show'
                          ? state.shows.find(s => s.id === item.id)
                          : state.movies.find(m => m.id === item.id);

                        return (
                          <MediaCard
                            key={`discover-${item.id}`}
                            item={localItem || item}
                            onToggleWatchlist={(e) => {
                              e.stopPropagation();
                              state.toggleWatchlist(item.id, item.type, localItem || item);
                            }}
                            onClick={() => {
                              if (!localItem) state.importMediaItem(item);
                              setSelectedMediaItem(localItem || item);
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Infinite Scroll trigger button */}
                    <div className="pt-2 flex justify-center">
                      <button
                        id="load-more-discover-button"
                        onClick={handleLoadMoreDiscover}
                        disabled={loadingDiscover}
                        className="px-6 py-2.5 bg-[#0A0A0A]/40 hover:bg-zinc-900 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-300 hover:text-white rounded-xl transition-colors w-full cursor-pointer flex justify-center items-center gap-2"
                      >
                        {loadingDiscover ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                            <span>Loading next page...</span>
                          </>
                        ) : (
                          <span>Load More {discoverType === 'show' ? 'Series' : 'Movies'}</span>
                        )}
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </>
          ) : (
            <div className="space-y-5">
              {/* TRAKT CONTROLS */}
              <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl p-4 shadow-md space-y-4">
                
                <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-white/5">
                  <button
                    onClick={() => setTraktMediaType('show')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      traktMediaType === 'show' ? 'bg-amber-500 text-zinc-950 shadow-sm font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    TV Shows
                  </button>
                  <button
                    onClick={() => setTraktMediaType('movie')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      traktMediaType === 'movie' ? 'bg-amber-500 text-zinc-950 shadow-sm font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Movies
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {((['trending', 'popular', 'anticipated', 'played', 'watched', 'favorited'] as string[]).concat(traktMediaType === 'movie' ? ['boxoffice'] : []) as typeof traktListType[]).map(listType => (
                    <button
                      key={listType}
                      onClick={() => setTraktListType(listType)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-all border cursor-pointer capitalize ${
                        traktListType === listType
                          ? 'bg-zinc-800 text-amber-500 border-amber-500/30'
                          : 'bg-zinc-900/40 text-zinc-500 border-white/5 hover:text-zinc-300'
                      }`}
                    >
                      {listType}
                    </button>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Year</span>
                    <select 
                      value={traktYear} 
                      onChange={(e) => setTraktYear(e.target.value)}
                      className="bg-zinc-900 border border-white/10 rounded-md text-xs text-zinc-300 p-1 outline-none focus:border-amber-500"
                    >
                      <option value="">All</option>
                      {Array.from({length: 30}, (_, i) => new Date().getFullYear() + 2 - i).map(y => (
                        <option key={y} value={y.toString()}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Genre</span>
                    <select 
                      value={traktGenre || ''} 
                      onChange={(e) => setTraktGenre(e.target.value || null)}
                      className="bg-zinc-900 border border-white/10 rounded-md text-xs text-zinc-300 p-1 outline-none focus:border-amber-500"
                    >
                      <option value="">All</option>
                      <option value="action">Action</option>
                      <option value="animation">Animation</option>
                      <option value="comedy">Comedy</option>
                      <option value="documentary">Documentary</option>
                      <option value="drama">Drama</option>
                      <option value="fantasy">Fantasy</option>
                      <option value="horror">Horror</option>
                      <option value="mystery">Mystery</option>
                      <option value="romance">Romance</option>
                      <option value="science-fiction">Sci-Fi</option>
                      <option value="thriller">Thriller</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-white/5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Hide Watched</span>
                    <button
                      onClick={() => setTraktHideWatched(!traktHideWatched)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        traktHideWatched ? 'bg-amber-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          traktHideWatched ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* TRAKT GRID */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 pl-1">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider capitalize">
                    Trakt {traktListType}
                  </h3>
                </div>

                {loadingTrakt && traktPage === 1 ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500">Fetching Trakt lists...</span>
                  </div>
                ) : (() => {
                  const filteredItems = traktItems.filter(item => {
                    if (!traktHideWatched) return true;
                    const localItem = item.type === 'show'
                      ? state.shows.find(s => s.id === item.id)
                      : state.movies.find(m => m.id === item.id);
                    if (!localItem) return true;
                    if (item.type === 'movie') {
                      return !localItem.completed;
                    } else {
                      const watchedEpisodes = state.watchedEpisodes[item.id];
                      const hasEpisodes = watchedEpisodes && Object.keys(watchedEpisodes).length > 0;
                      return !(localItem.completed || hasEpisodes);
                    }
                  });

                  if (traktItems.length === 0) {
                    return (
                      <div className="py-16 text-center text-xs text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl flex flex-col items-center gap-2">
                        <AlertCircle className="w-7 h-7 text-zinc-700" />
                        <span>No items found for the selected Trakt list and filters.</span>
                      </div>
                    );
                  }

                  if (filteredItems.length === 0) {
                    return (
                      <div className="py-16 text-center text-xs text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl flex flex-col items-center gap-2">
                        <AlertCircle className="w-7 h-7 text-zinc-700" />
                        <span>All items are hidden because they are marked as watched.</span>
                      </div>
                    );
                  }

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                        {filteredItems.map(item => {
                          const localItem = item.type === 'show'
                            ? state.shows.find(s => s.id === item.id)
                            : state.movies.find(m => m.id === item.id);

                          return (
                            <MediaCard
                              key={`trakt-${item.id}`}
                              item={localItem || item}
                              onToggleWatchlist={(e) => {
                                e.stopPropagation();
                                state.toggleWatchlist(item.id, item.type, localItem || item);
                              }}
                              onClick={() => {
                                if (!localItem) state.importMediaItem(item);
                                setSelectedMediaItem(localItem || item);
                              }}
                            />
                          );
                        })}
                      </div>

                      <div className="pt-2 flex justify-center">
                        <button
                          onClick={() => loadTraktData(false)}
                          disabled={loadingTrakt}
                          className="px-6 py-2.5 bg-[#0A0A0A]/40 hover:bg-zinc-900 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-300 hover:text-white rounded-xl transition-colors w-full cursor-pointer flex justify-center items-center gap-2"
                        >
                          {loadingTrakt ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                              <span>Loading next page...</span>
                            </>
                          ) : (
                            <span>Load More Trakt Items</span>
                          )}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-fade-in select-none">
              
              {/* USER STATS PROFILE SUMMARY */}
              <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl p-4.5 flex flex-col items-center justify-center relative overflow-hidden shadow-md">
                
                {/* Background decorative halo */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl" />

                {/* Theme Toggle Button */}
                <button 
                  onClick={() => setIsLightMode(!isLightMode)}
                  className="absolute top-4 right-4 z-20 p-2 bg-[#050505]/80 hover:bg-zinc-800/80 border border-white/5 rounded-full transition-all text-zinc-400 hover:text-amber-500 shadow-lg"
                  aria-label="Toggle Theme"
                >
                  {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>

                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-amber-500 border border-white/5 shadow-xl flex items-center justify-center shrink-0 z-10 animate-pulse">
                  <span className="text-xl font-black text-zinc-950 font-display uppercase">U</span>
                </div>
                <h3 className="font-display font-bold text-sm text-[#F5F5F5] mt-2.5 z-10">
                  Active TV Time Member
                </h3>
                <p className="text-[10px] font-medium text-zinc-500 font-mono z-10">
                  ESTABLISHED JULY 2026
                </p>

                {state.dbStatus && (
                  <div className="mt-3.5 px-3 py-2.5 rounded-xl border w-full max-w-sm z-10 text-left space-y-1.5 bg-zinc-950/80 border-white/5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        state.dbStatus.usePostgres ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                      }`} />
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-zinc-400" />
                        Storage: {state.dbStatus.usePostgres ? 'Durable Postgres Cloud' : 'Ephemeral Local JSON'}
                      </span>
                    </div>

                    {!state.dbStatus.usePostgres && (
                      <div className="space-y-1 text-zinc-400 text-[10px] leading-relaxed">
                        {!state.dbStatus.hasDbUrl ? (
                          <p className="text-amber-400 font-semibold">
                            ⚠️ Warning: <code>DATABASE_URL</code> is not configured. Cloud Run container disks are stateless and clear automatically. Any tracked shows/movies will be lost on container restart.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-red-400 font-semibold">
                              ❌ Error: <code>DATABASE_URL</code> was found but failed to connect!
                            </p>
                            {state.dbStatus.dbError && (
                              <div className="bg-red-950/40 border border-red-900/30 p-1.5 rounded text-red-300 font-mono text-[9px] whitespace-pre-wrap select-text leading-tight max-h-[100px] overflow-y-auto">
                                {state.dbStatus.dbError}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-zinc-500">
                          To save your data permanently, set the <code className="text-zinc-300 font-mono">DATABASE_URL</code> environment variable in your Google Cloud Run service variables (pointing to your Supabase, Neon, or Cloud SQL instance).
                        </p>
                      </div>
                    )}
                    
                    {state.dbStatus.usePostgres && (
                      <p className="text-[9px] text-emerald-400 font-medium leading-relaxed">
                        ✓ Connected to PostgreSQL. Your watchlist and history are securely saved in the cloud.
                      </p>
                    )}
                  </div>
                )}

                {/* Dynamic Counter panels */}
                <div className="grid grid-cols-3 gap-2.5 w-full mt-4.5 z-10">
                  <div className="bg-[#050505]/70 border border-white/5 p-2.5 rounded-xl text-center">
                    <span className="block font-display font-extrabold text-lg text-amber-500 leading-none">
                      {state.stats.showsWatched}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide mt-1 block">
                      TV Shows
                    </span>
                  </div>

                  <button
                    onClick={() => setRevealHoursSpent(!revealHoursSpent)}
                    className="bg-[#050505]/70 hover:bg-[#0f0f0f]/80 transition-all border border-white/5 p-2.5 rounded-xl text-center cursor-pointer flex flex-col justify-center items-center select-none min-h-[58px]"
                  >
                    {revealHoursSpent ? (
                      <span className="block font-display font-bold text-xs text-amber-500 leading-tight">
                        {formatHoursSpent(state.stats.hoursSpent)}
                      </span>
                    ) : (
                      <span className="block font-display font-bold text-xs text-zinc-500 hover:text-amber-500 leading-none py-0.5">
                        Reveal
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide mt-1 block">
                      Time Spent
                    </span>
                  </button>

                  <div className="bg-[#050505]/70 border border-white/5 p-2.5 rounded-xl text-center">
                    <span className="block font-display font-extrabold text-lg text-amber-500 leading-none">
                      {state.stats.moviesWatched}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide mt-1 block">
                      Movies
                    </span>
                  </div>
                </div>
              </div>

              {/* SWITCHER FOR SIX DISTINCT LISTS */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                  
                  {/* Option 1: Creator & Cast Staff */}
                  <button
                    id="profile-btn-creator-cast"
                    onClick={() => setProfileListTab('creator_cast')}
                    className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      profileListTab === 'creator_cast'
                        ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Creator & Cast
                  </button>

                  {/* Option 2: Completed TV Shows */}
                  <button
                    id="profile-btn-completed-tv"
                    onClick={() => setProfileListTab('completed_tv')}
                    className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      profileListTab === 'completed_tv'
                        ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Completed TV
                  </button>

                  {/* Option 3: Completed Movies */}
                  <button
                    id="profile-btn-completed-movies"
                    onClick={() => setProfileListTab('completed_movies')}
                    className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      profileListTab === 'completed_movies'
                        ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Completed Movies
                  </button>

                  {/* Option 4: Favorite TV */}
                  <button
                    id="profile-btn-fav-tv"
                    onClick={() => setProfileListTab('fav_tv')}
                    className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      profileListTab === 'fav_tv'
                        ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Favorite TV
                  </button>

                  {/* Option 5: Favorite Movies */}
                  <button
                    id="profile-btn-fav-movies"
                    onClick={() => setProfileListTab('fav_movies')}
                    className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      profileListTab === 'fav_movies'
                        ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Favorite Movies
                  </button>

                  {/* Option 6: Stopped Watching */}
                  <button
                    id="profile-btn-stopped"
                    onClick={() => setProfileListTab('stopped_watching')}
                    className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      profileListTab === 'stopped_watching'
                        ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Stopped Watching
                  </button>
                </div>

                {/* PROFILE FILTERS BAR */}
                {profileListTab !== 'creator_cast' && activeListItems.length > 0 && (
                  <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl p-4 gap-4 flex flex-col md:flex-row md:items-end justify-between animate-fade-in">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                      {/* Genre dropdown */}
                      <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                          <Filter className="w-3 h-3 text-amber-500" />
                          Genre
                        </span>
                        <select
                          value={profileGenre}
                          onChange={(e) => setProfileGenre(e.target.value)}
                          className="bg-zinc-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-zinc-200 outline-none focus:border-amber-500/40 transition-colors cursor-pointer w-full"
                        >
                          {availableGenres.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      {/* Rating dropdown */}
                      <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1 flex-row">
                          <Award className="w-3 h-3 text-amber-500" />
                          Rating
                        </span>
                        <select
                          value={profileRating}
                          onChange={(e) => setProfileRating(Number(e.target.value))}
                          className="bg-zinc-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-zinc-200 outline-none focus:border-amber-500/40 transition-colors cursor-pointer w-full"
                        >
                          <option value="0">All Ratings</option>
                          <option value="10">★ 10 Masterpiece</option>
                          <option value="9">★ 9 Superb</option>
                          <option value="8">★ 8 Excellent</option>
                          <option value="7">★ 7 Good</option>
                          <option value="6">★ 6 Fine</option>
                          <option value="5">★ 5 Average</option>
                          <option value="4">★ 4 Disappointing</option>
                          <option value="3">★ 3 Bad</option>
                          <option value="2">★ 2 Very Bad</option>
                          <option value="1">★ 1 Horrible</option>
                        </select>
                      </div>

                      {/* Release Year dropdown */}
                      <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-500" />
                          Release Year
                        </span>
                        <select
                          value={profileYear}
                          onChange={(e) => setProfileYear(e.target.value)}
                          className="bg-zinc-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-zinc-200 outline-none focus:border-amber-500/40 transition-colors cursor-pointer w-full"
                        >
                          {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Sorting dropdown */}
                    <div className="flex flex-col gap-1.5 md:w-[180px]">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Sort Order
                      </span>
                      <select
                        value={profileSort}
                        onChange={(e) => setProfileSort(e.target.value as any)}
                        className="bg-zinc-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-zinc-200 outline-none focus:border-amber-500/40 transition-colors cursor-pointer w-full font-semibold"
                      >
                        <option value="date_added">Date Added (Newest)</option>
                        <option value="rating">Rating (Highest)</option>
                        <option value="release_date">Release Date (Newest)</option>
                        <option value="title">Title (A-Z)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* RENDER DYNAMIC LIST SELECTED */}
                <div>
                  
                  {/* 0. Creator & Cast Staff Statistics */}
                  {profileListTab === 'creator_cast' && (
                    <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl p-5 space-y-5 shadow-md select-none animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                        <div className="space-y-1">
                          <h3 className="font-display font-black text-sm text-[#F5F5F5] uppercase tracking-wider flex items-center gap-2">
                            <Award className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                            Creator & Cast Stats
                          </h3>
                          <p className="text-[10px] text-zinc-500 font-medium">
                            Actors and directors you have watched at least 3 movies/shows from, ordered by total seen.
                          </p>
                        </div>

                        {/* Selector Pills */}
                        <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5 shrink-0 self-start sm:self-center">
                          <button
                            onClick={() => {
                              setStatsRoleType('actor');
                              setShowAllActors(false);
                            }}
                            className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                              statsRoleType === 'actor'
                                ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <User className="w-3.5 h-3.5" />
                            Actors
                          </button>
                          <button
                            onClick={() => {
                              setStatsRoleType('director');
                              setShowAllDirectors(false);
                            }}
                            className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                              statsRoleType === 'director'
                                ? 'bg-zinc-850 text-amber-500 font-extrabold shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <Film className="w-3.5 h-3.5" />
                            Directors
                          </button>
                        </div>
                      </div>

                      {/* Stat Cards Container */}
                      <div className="space-y-4">
                        {statsRoleType === 'actor' ? (
                          castAndCrewStats.actors.length === 0 ? (
                            <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20">
                              No actors found with 3+ watched titles. Watch more movies or episodes to populate your list!
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {(castAndCrewStats.actors.slice(0, visibleActors)).map((person, idx) => (
                                <div key={person.id} className="bg-[#050505]/60 border border-white/5 p-4 rounded-xl space-y-3 hover:border-white/10 transition-all">
                                  {/* Person Header */}
                                  <div className="flex items-center justify-between gap-3">
                                    <button 
                                      onClick={() => setSelectedPersonId(person.id)}
                                      className="flex items-center gap-3 group text-left cursor-pointer outline-none"
                                    >
                                      <div className="relative shrink-0">
                                        <img 
                                          src={person.profilePath || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'} 
                                          alt={person.name} 
                                          className="w-12 h-12 rounded-full object-cover border border-white/10 group-hover:border-amber-500/50 transition-colors"
                                          referrerPolicy="no-referrer"
                                        />
                                        <span className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full border border-zinc-950 flex items-center justify-center text-[10px] font-black text-zinc-950">
                                          {idx + 1}
                                        </span>
                                      </div>
                                      <div>
                                        <h4 className="font-display font-extrabold text-sm text-zinc-100 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                                          <span>{person.name}</span>
                                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </h4>
                                        <p className="text-[10px] text-zinc-500 font-medium">Cast Member • Click for full filmography</p>
                                      </div>
                                    </button>
                                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono font-extrabold rounded-lg shrink-0">
                                      {person.count} {person.count === 1 ? 'Title' : 'Titles'} Watched
                                    </span>
                                  </div>

                                  {/* Horizontally scrolling list of watched items */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Watched Titles</span>
                                    <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                                      {person.items.map(item => (
                                        <button
                                          key={item.id + '-' + item.type}
                                          onClick={() => setSelectedMediaItem(item)}
                                          className="flex items-center gap-2.5 p-1.5 bg-[#0A0A0A]/80 hover:bg-zinc-900 border border-white/5 hover:border-white/10 rounded-lg text-left shrink-0 transition-all cursor-pointer group"
                                          style={{ width: '210px' }}
                                        >
                                          <img
                                            src={item.posterPath || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=200&auto=format&fit=crop'}
                                            alt={item.title}
                                            className="w-9 h-13 rounded object-cover border border-white/5 group-hover:scale-105 transition-transform"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div className="min-w-0 pr-1">
                                            <h5 className="font-semibold text-xs text-zinc-200 truncate group-hover:text-amber-500 transition-colors">{item.title}</h5>
                                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-zinc-850 text-zinc-400 border border-white/5">
                                              {item.type === 'show' ? <Tv className="w-2.5 h-2.5 text-[#22C55E]" /> : <Film className="w-2.5 h-2.5 text-[#3B82F6]" />}
                                              {item.type === 'show' ? 'Series' : 'Movie'}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {castAndCrewStats.actors.length > 5 && (
                                <div className="flex justify-center gap-3 pt-2">
                                  {visibleActors < castAndCrewStats.actors.length && (
                                    <button
                                      onClick={() => setVisibleActors(prev => prev + 5)}
                                      className="px-5 py-2.5 bg-[#050505]/60 hover:bg-[#050505] border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                      Show More (+5)
                                    </button>
                                  )}
                                  {visibleActors > 5 && (
                                    <button
                                      onClick={() => setVisibleActors(5)}
                                      className="px-5 py-2.5 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-300 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                      Show Less
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          castAndCrewStats.directors.length === 0 ? (
                            <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20">
                              No directors found with 3+ watched titles. Watch more movies or episodes to populate your list!
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {(castAndCrewStats.directors.slice(0, visibleDirectors)).map((person, idx) => (
                                <div key={person.id} className="bg-[#050505]/60 border border-white/5 p-4 rounded-xl space-y-3 hover:border-white/10 transition-all">
                                  {/* Person Header */}
                                  <div className="flex items-center justify-between gap-3">
                                    <button 
                                      onClick={() => setSelectedPersonId(person.id)}
                                      className="flex items-center gap-3 group text-left cursor-pointer outline-none"
                                    >
                                      <div className="relative shrink-0">
                                        <img 
                                          src={person.profilePath || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'} 
                                          alt={person.name} 
                                          className="w-12 h-12 rounded-full object-cover border border-white/10 group-hover:border-emerald-500/50 transition-colors"
                                          referrerPolicy="no-referrer"
                                        />
                                        <span className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full border border-zinc-950 flex items-center justify-center text-[10px] font-black text-zinc-950">
                                          {idx + 1}
                                        </span>
                                      </div>
                                      <div>
                                        <h4 className="font-display font-extrabold text-sm text-zinc-100 group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                                          <span>{person.name}</span>
                                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </h4>
                                        <p className="text-[10px] text-zinc-500 font-medium">Director / Creator • Click for full filmography</p>
                                      </div>
                                    </button>
                                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono font-extrabold rounded-lg shrink-0">
                                      {person.count} {person.count === 1 ? 'Title' : 'Titles'} Watched
                                    </span>
                                  </div>

                                  {/* Horizontally scrolling list of watched items */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Watched Titles</span>
                                    <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                                      {person.items.map(item => (
                                        <button
                                          key={item.id + '-' + item.type}
                                          onClick={() => setSelectedMediaItem(item)}
                                          className="flex items-center gap-2.5 p-1.5 bg-[#0A0A0A]/80 hover:bg-zinc-900 border border-white/5 hover:border-white/10 rounded-lg text-left shrink-0 transition-all cursor-pointer group"
                                          style={{ width: '210px' }}
                                        >
                                          <img
                                            src={item.posterPath || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=200&auto=format&fit=crop'}
                                            alt={item.title}
                                            className="w-9 h-13 rounded object-cover border border-white/5 group-hover:scale-105 transition-transform"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div className="min-w-0 pr-1">
                                            <h5 className="font-semibold text-xs text-zinc-200 truncate group-hover:text-amber-500 transition-colors">{item.title}</h5>
                                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-zinc-850 text-zinc-400 border border-white/5">
                                              {item.type === 'show' ? <Tv className="w-2.5 h-2.5 text-[#22C55E]" /> : <Film className="w-2.5 h-2.5 text-[#3B82F6]" />}
                                              {item.type === 'show' ? 'Series' : 'Movie'}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {castAndCrewStats.directors.length > 5 && (
                                <div className="flex justify-center gap-3 pt-2">
                                  {visibleDirectors < castAndCrewStats.directors.length && (
                                    <button
                                      onClick={() => setVisibleDirectors(prev => prev + 5)}
                                      className="px-5 py-2.5 bg-[#050505]/60 hover:bg-[#050505] border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                      Show More (+5)
                                    </button>
                                  )}
                                  {visibleDirectors > 5 && (
                                    <button
                                      onClick={() => setVisibleDirectors(5)}
                                      className="px-5 py-2.5 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-300 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                      Show Less
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* 1. Completed TV Shows */}
                  {profileListTab === 'completed_tv' && (
                    <div className="space-y-3 animate-fade-in">
                      {state.completedTVShows.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20">
                          No completed TV shows yet. Mark all episodes of a series as watched!
                        </div>
                      ) : filteredProfileItems.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20 space-y-3">
                          <p>No completed TV shows match your filters.</p>
                          <button
                            onClick={() => {
                              setProfileGenre('All');
                              setProfileRating(0);
                              setProfileYear('All');
                              setProfileSort('date_added');
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-450 rounded-xl text-xs font-bold text-black transition-all cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                            <span>Showing {filteredProfileItems.length} of {state.completedTVShows.length} shows</span>
                            {(profileGenre !== 'All' || profileRating > 0 || profileYear !== 'All' || profileSort !== 'date_added') && (
                              <button 
                                onClick={() => {
                                  setProfileGenre('All');
                                  setProfileRating(0);
                                  setProfileYear('All');
                                  setProfileSort('date_added');
                                }}
                                className="text-amber-500 hover:underline cursor-pointer"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {filteredProfileItems.slice(0, visibleCompletedTV).map(show => {
                              const watched = Object.keys(state.watchedEpisodes[show.id] || {}).length;
                              return (
                                <MediaCard
                                    key={show.id}
                                    item={show}
                                    onToggleWatchlist={(e) => {
                                      e.stopPropagation();
                                      state.toggleWatchlist(show.id, show.type, show);
                                    }}
                                  onClick={() => setSelectedMediaItem(show)}
                                  watchedEpisodesCount={watched}
                                  totalEpisodesCount={show.episodesCount || 8}
                                />
                              );
                            })}
                          </div>
                          {filteredProfileItems.length > visibleCompletedTV && (
                            <div className="flex justify-center pt-2">
                              <button
                                onClick={() => setVisibleCompletedTV(prev => prev + 12)}
                                className="px-5 py-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                Show More (+12)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Completed Movies */}
                  {profileListTab === 'completed_movies' && (
                    <div className="space-y-3 animate-fade-in">
                      {state.completedMovies.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20">
                          No completed movies yet. Toggle the checkmark inside movie details to finish them!
                        </div>
                      ) : filteredProfileItems.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20 space-y-3">
                          <p>No completed movies match your filters.</p>
                          <button
                            onClick={() => {
                              setProfileGenre('All');
                              setProfileRating(0);
                              setProfileYear('All');
                              setProfileSort('date_added');
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-450 rounded-xl text-xs font-bold text-black transition-all cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                            <span>Showing {filteredProfileItems.length} of {state.completedMovies.length} movies</span>
                            {(profileGenre !== 'All' || profileRating > 0 || profileYear !== 'All' || profileSort !== 'date_added') && (
                              <button 
                                onClick={() => {
                                  setProfileGenre('All');
                                  setProfileRating(0);
                                  setProfileYear('All');
                                  setProfileSort('date_added');
                                }}
                                className="text-amber-500 hover:underline cursor-pointer"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {filteredProfileItems.slice(0, visibleCompletedMovies).map(movie => (
                              <MediaCard
                                    key={movie.id}
                                    item={movie}
                                    onToggleWatchlist={(e) => {
                                      e.stopPropagation();
                                      state.toggleWatchlist(movie.id, movie.type, movie);
                                    }}
                                onClick={() => setSelectedMediaItem(movie)}
                              />
                            ))}
                          </div>
                          {filteredProfileItems.length > visibleCompletedMovies && (
                            <div className="flex justify-center pt-2">
                              <button
                                onClick={() => setVisibleCompletedMovies(prev => prev + 12)}
                                className="px-5 py-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                Show More (+12)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Favorite TV Shows */}
                  {profileListTab === 'fav_tv' && (
                    <div className="space-y-3 animate-fade-in">
                      {state.favoriteTVShows.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20">
                          No favorite TV shows. Add some from their detailed overlay panel!
                        </div>
                      ) : filteredProfileItems.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20 space-y-3">
                          <p>No favorite TV shows match your filters.</p>
                          <button
                            onClick={() => {
                              setProfileGenre('All');
                              setProfileRating(0);
                              setProfileYear('All');
                              setProfileSort('date_added');
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-450 rounded-xl text-xs font-bold text-black transition-all cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                            <span>Showing {filteredProfileItems.length} of {state.favoriteTVShows.length} shows</span>
                            {(profileGenre !== 'All' || profileRating > 0 || profileYear !== 'All' || profileSort !== 'date_added') && (
                              <button 
                                onClick={() => {
                                  setProfileGenre('All');
                                  setProfileRating(0);
                                  setProfileYear('All');
                                  setProfileSort('date_added');
                                }}
                                className="text-amber-500 hover:underline cursor-pointer"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {filteredProfileItems.slice(0, visibleFavTV).map(show => {
                              const watched = Object.keys(state.watchedEpisodes[show.id] || {}).length;
                              return (
                                <MediaCard
                                    key={show.id}
                                    item={show}
                                    onToggleWatchlist={(e) => {
                                      e.stopPropagation();
                                      state.toggleWatchlist(show.id, show.type, show);
                                    }}
                                  onClick={() => setSelectedMediaItem(show)}
                                  watchedEpisodesCount={watched}
                                  totalEpisodesCount={show.episodesCount || 8}
                                />
                              );
                            })}
                          </div>
                          {filteredProfileItems.length > visibleFavTV && (
                            <div className="flex justify-center pt-2">
                              <button
                                onClick={() => setVisibleFavTV(prev => prev + 12)}
                                className="px-5 py-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                Show More (+12)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Favorite Movies */}
                  {profileListTab === 'fav_movies' && (
                    <div className="space-y-3 animate-fade-in">
                      {state.favoriteMovies.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20">
                          No favorite movies. Star them by hitting the Heart icon in movie details!
                        </div>
                      ) : filteredProfileItems.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20 space-y-3">
                          <p>No favorite movies match your filters.</p>
                          <button
                            onClick={() => {
                              setProfileGenre('All');
                              setProfileRating(0);
                              setProfileYear('All');
                              setProfileSort('date_added');
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-450 rounded-xl text-xs font-bold text-black transition-all cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                            <span>Showing {filteredProfileItems.length} of {state.favoriteMovies.length} movies</span>
                            {(profileGenre !== 'All' || profileRating > 0 || profileYear !== 'All' || profileSort !== 'date_added') && (
                              <button 
                                onClick={() => {
                                  setProfileGenre('All');
                                  setProfileRating(0);
                                  setProfileYear('All');
                                  setProfileSort('date_added');
                                }}
                                className="text-amber-500 hover:underline cursor-pointer"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {filteredProfileItems.slice(0, visibleFavMovies).map(movie => (
                              <MediaCard
                                    key={movie.id}
                                    item={movie}
                                    onToggleWatchlist={(e) => {
                                      e.stopPropagation();
                                      state.toggleWatchlist(movie.id, movie.type, movie);
                                    }}
                                onClick={() => setSelectedMediaItem(movie)}
                              />
                            ))}
                          </div>
                          {filteredProfileItems.length > visibleFavMovies && (
                            <div className="flex justify-center pt-2">
                              <button
                                onClick={() => setVisibleFavMovies(prev => prev + 12)}
                                className="px-5 py-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                Show More (+12)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. Stopped Watching TV Shows */}
                  {profileListTab === 'stopped_watching' && (
                    <div className="space-y-3 animate-fade-in">
                      {state.stoppedWatchingTVShows.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20">
                          No stopped watching TV shows. Set a show's status to Stopped from details to list it here!
                        </div>
                      ) : filteredProfileItems.length === 0 ? (
                        <div className="py-12 border border-white/5 border-dashed rounded-xl text-center text-xs text-zinc-500 bg-[#0A0A0A]/20 space-y-3">
                          <p>No stopped watching TV shows match your filters.</p>
                          <button
                            onClick={() => {
                              setProfileGenre('All');
                              setProfileRating(0);
                              setProfileYear('All');
                              setProfileSort('date_added');
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-450 rounded-xl text-xs font-bold text-black transition-all cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                            <span>Showing {filteredProfileItems.length} of {state.stoppedWatchingTVShows.length} shows</span>
                            {(profileGenre !== 'All' || profileRating > 0 || profileYear !== 'All' || profileSort !== 'date_added') && (
                              <button 
                                onClick={() => {
                                  setProfileGenre('All');
                                  setProfileRating(0);
                                  setProfileYear('All');
                                  setProfileSort('date_added');
                                }}
                                className="text-amber-500 hover:underline cursor-pointer"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
                            {filteredProfileItems.slice(0, visibleStoppedWatching).map(show => {
                              const watched = Object.keys(state.watchedEpisodes[show.id] || {}).length;
                              return (
                                <MediaCard
                                    key={show.id}
                                    item={show}
                                    onToggleWatchlist={(e) => {
                                      e.stopPropagation();
                                      state.toggleWatchlist(show.id, show.type, show);
                                    }}
                                  onClick={() => setSelectedMediaItem(show)}
                                  watchedEpisodesCount={watched}
                                  totalEpisodesCount={show.episodesCount || 8}
                                />
                              );
                            })}
                          </div>
                          {filteredProfileItems.length > visibleStoppedWatching && (
                            <div className="flex justify-center pt-2">
                              <button
                                onClick={() => setVisibleStoppedWatching(prev => prev + 12)}
                                className="px-5 py-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                Show More (+12)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* PRIVACY & PASSCODE LOCK SECTION */}
              <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl p-5 space-y-4 shadow-md mt-6 select-none">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <Lock className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                      Master Website Privacy Lock
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Restrict website access globally. Anyone visiting this URL will be prompted for this passcode.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-zinc-950/60 rounded-xl border border-white/5">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Website Access Protection
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {isGlobalLockEnabled && globalPasscode 
                        ? "Active — Entire website is password-protected globally" 
                        : "Inactive — Website is public and open to anyone with the URL"}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isGlobalLockEnabled && globalPasscode ? (
                      <>
                        <button
                          onClick={() => {
                            setPasscodeModalMode('change');
                            setShowPasscodeModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer"
                        >
                          Change Passcode
                        </button>
                        <button
                          onClick={() => {
                            setPasscodeModalMode('disable');
                            setShowPasscodeModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-500/15 hover:border-red-500/30 text-xs font-bold text-red-400 rounded-lg transition-all cursor-pointer"
                        >
                          Disable Lock
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setPasscodeModalMode('setup');
                          setShowPasscodeModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-md shadow-amber-500/15"
                      >
                        Enable Lock
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* API CONFIGURATION SECTION */}
              <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl p-5 space-y-4 shadow-md mt-6 select-none">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <Key className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                      API Configuration
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Optionally provide your own TMDb and Trakt API keys. Leave blank to use default keys.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-200 block">TMDb API Key (v3 auth)</label>
                    <input
                      type="text"
                      value={customTmdbKey}
                      onChange={(e) => setCustomTmdbKey(e.target.value)}
                      placeholder="e.g. 92cb9e28d..."
                      className="w-full bg-zinc-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-200 block">Trakt Client ID</label>
                    <input
                      type="text"
                      value={customTraktKey}
                      onChange={(e) => setCustomTraktKey(e.target.value)}
                      placeholder="e.g. e52812225..."
                      className="w-full bg-zinc-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveApiKeys}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <span>Save API Keys</span>
                    </button>
                    {apiKeysSavedMessage && (
                      <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1 animate-fade-in">
                        <Check className="w-3.5 h-3.5" /> Saved! Reloading...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* DATA BACKUP & RESTORE SECTION */}
              <div className="bg-[#0A0A0A]/40 border border-white/5 rounded-2xl p-5 space-y-4 shadow-md mt-6 select-none">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <Download className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#F5F5F5] uppercase tracking-wider">
                      Backup & Restore
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Export your local watchlist, custom ratings, and watch history, or restore them from a previous backup file.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Export */}
                  <div className="p-4 bg-zinc-950/60 rounded-xl border border-white/5 flex flex-col justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Export Data Backup
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">
                        Download your current database (shows, movies, episodes watched, and favorites) as a portable JSON file.
                      </span>
                    </div>
                    <button
                      onClick={handleExportFile}
                      className="w-full px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Data (.json)</span>
                    </button>
                  </div>

                  {/* Import */}
                  <div className="p-4 bg-zinc-950/60 rounded-xl border border-white/5 flex flex-col justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Import Data Backup
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">
                        Restore your progress from a previously downloaded JSON backup file. This will replace your current watchlist and stats.
                      </span>
                    </div>
                    <label className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Data (.json)</span>
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImportFile}
                      />
                    </label>
                  </div>

                  {/* IMDb Import */}
                  <div className="p-4 bg-zinc-950/60 rounded-xl border border-white/5 flex flex-col justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        IMDb Ratings Import
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">
                        Upload your exported IMDb ratings CSV file to automatically import watched titles, ratings, and favorites.
                      </span>
                    </div>
                    <button
                      onClick={() => setIsImdbImportOpen(true)}
                      className="w-full px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-500" />
                      <span>Import IMDb CSV (.csv)</span>
                    </button>
                  </div>
                </div>

                {importSuccess && (
                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/15 rounded-lg flex items-center gap-2 text-[10px] text-emerald-400 animate-fade-in">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Watchlist, ratings, and stats have been imported successfully!</span>
                  </div>
                )}

                {importError && (
                  <div className="p-2.5 bg-red-950/30 border border-red-500/15 rounded-lg flex items-center gap-2 text-[10px] text-red-400 animate-fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
              </div>


              {/* CLOUD SYNC SECTION */}
              <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 sm:p-6 mb-8 flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500/20 via-cyan-500/5 to-transparent"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-cyan-400" />
                      Cloud Sync Device ID
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1 max-w-[400px]">
                      Your data is automatically synced to the cloud using this unique device ID. 
                      You can use this ID on another device to restore your data.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mt-2">
                  <div id="sync-id-input-field" className="flex-1 bg-zinc-950/80 border border-white/10 rounded-xl px-4 py-3 flex items-center font-mono text-sm text-cyan-200">
                    {isEditingSyncId ? (
                      <input 
                        type="text" 
                        value={syncIdInput}
                        onChange={(e) => setSyncIdInput(e.target.value)}
                        placeholder="Enter Device ID"
                        className="bg-transparent border-none outline-none w-full text-cyan-200"
                        autoFocus
                      />
                    ) : (
                      getDeviceId()
                    )}
                  </div>
                  
                  {isEditingSyncId ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (syncIdInput.trim()) {
                            setDeviceId(syncIdInput.trim());
                            window.location.reload();
                          }
                        }}
                        className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-4 py-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        Apply & Reload
                      </button>
                      <button 
                        onClick={() => setIsEditingSyncId(false)}
                        className="bg-white/5 hover:bg-white/10 text-zinc-300 px-4 py-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setSyncIdInput(getDeviceId());
                        setIsEditingSyncId(true);
                      }}
                      className="bg-white/5 hover:bg-white/10 text-zinc-300 px-4 py-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      Change ID
                    </button>
                  )}
                </div>
              </div>

              {/* DANGER ZONE / RESET SECTION */}

              <div className="bg-red-950/10 border border-red-500/10 rounded-2xl p-5 space-y-4 shadow-md mt-6 select-none">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-red-500/10 animate-pulse">
                    <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-red-400 uppercase tracking-wider">
                      Danger Zone
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Irreversible actions. Be absolutely certain before proceeding.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-red-950/5 rounded-xl border border-red-500/10 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Reset All Progress & Stats
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5 max-w-sm">
                        This will reset your watched episodes count, watched movies, custom ratings, and favorites back to zero.
                      </span>
                    </div>

                    {!showResetConfirm ? (
                      <button
                        id="danger-zone-reset-button"
                        onClick={() => setShowResetConfirm(true)}
                        className="px-3.5 py-1.5 bg-red-950/40 hover:bg-red-900/50 border border-red-500/20 hover:border-red-500/40 text-xs font-bold text-red-400 rounded-lg transition-all cursor-pointer shadow-sm shrink-0"
                      >
                        Reset Everything to Zero
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            state.resetAllProgress();
                            setShowResetConfirm(false);
                            setResetSuccessMessage(true);
                            setTimeout(() => setResetSuccessMessage(false), 3000);
                          }}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-zinc-950 text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-md shadow-red-500/20"
                        >
                          Confirm Reset
                        </button>
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {resetSuccessMessage && (
                    <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/15 rounded-lg flex items-center gap-2 text-[10px] text-emerald-400 animate-fade-in">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>All statistics, ratings, favorites, and watch history have been successfully reset to zero!</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </main>

        {/* BOTTOM NAVIGATION BAR */}
        <Navbar activeTab={activeTab} onChangeTab={setActiveTab} />

        {/* DETAILED OVERLAY MODAL */}
        <AnimatePresence>
          {currentModalItem && (
            <DetailModal
              item={currentModalItem}
              autoPlayConfig={autoPlayConfig}
              onClose={() => {
                setSelectedMediaItem(null);
                setAutoPlayConfig(null);
              }}
              favorites={state.favorites}
              watchedEpisodes={state.watchedEpisodes}
              toggleWatchlist={state.toggleWatchlist}
              toggleFavorite={state.toggleFavorite}
              setRating={state.setRating}
              toggleMovieWatched={state.toggleMovieWatched}
              toggleEpisodeWatched={state.toggleEpisodeWatched}
              toggleShowCompleted={state.toggleShowCompleted}
              toggleSeasonCompleted={state.toggleSeasonCompleted}
              toggleStoppedWatching={state.toggleStoppedWatching}
              importMediaItem={state.importMediaItem}
              onPersonClick={(id) => setSelectedPersonId(id)}
            />
          )}
        </AnimatePresence>

        
        {/* PASSCODE CONTROL MODAL */}
        {showPasscodeModal && (
          <PasscodeScreen
            mode={passcodeModalMode}
            correctPasscode={globalPasscode}
            onSuccess={(newCode) => {
              if (passcodeModalMode === 'setup' || passcodeModalMode === 'change') {
                updateGlobalSecurity(newCode || null);
              } else if (passcodeModalMode === 'disable') {
                updateGlobalSecurity(null);
              }
              setShowPasscodeModal(false);
            }}
            onCancel={() => setShowPasscodeModal(false)}
          />
        )}

        {/* IMDB CSV IMPORT WIZARD */}
        <ImdbImportWizard
          isOpen={isImdbImportOpen}
          onClose={() => setIsImdbImportOpen(false)}
          importMultipleMediaItems={state.importMultipleMediaItems}
        />

        {/* PERSON FILMOGRAPHY / CREDITS MODAL */}
        <AnimatePresence>
          {selectedPersonId !== null && (
            <PersonCreditsModal
              personId={selectedPersonId}
              onClose={() => setSelectedPersonId(null)}
              onSelectMedia={(item) => {
                // Determine if we already have this item imported
                const localItem = item.type === 'show'
                  ? state.shows.find(s => s.id === item.id)
                  : state.movies.find(m => m.id === item.id);

                if (!localItem) {
                  // Import the item locally so we have full metadata access
                  state.importMediaItem(item);
                }

                // Show details modal for this item
                setSelectedMediaItem(localItem || item);
                // Close the person filmography profile modal
                setSelectedPersonId(null);
              }}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// Custom simple fallback SVG wrapper components to support pristine execution
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
