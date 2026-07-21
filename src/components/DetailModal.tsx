  /**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MediaItem, Season, Episode, MediaType, TMDBReview } from '../types';
import { X, Star, Heart, Users, Bookmark, Check, ChevronDown, ChevronUp, Clock, Calendar, Film, Tv, Play, Ban, ExternalLink, Settings, Link, Flame, HardDrive, Smartphone, Laptop, Copy, Activity, Info, ChevronLeft, Search, Download, Globe, Wifi, Table, LayoutGrid, TrendingUp, MessageSquare, ThumbsUp, ThumbsDown, EyeOff, AlertTriangle, Cloud, RefreshCw, Loader2 } from 'lucide-react';
import { fetchShowSeasons, getImageUrl, fetchMediaDetails, fetchMediaVideos, fetchMediaReviews, fetchTraktId, fetchTraktComments, fetchEpisodeImdbId, fetchKurdcinemaSearch, fetchKurdcinemaComments, fetchImdbRating, fetchImdbReviews } from '../tmdb';
import { getPredefinedSeasons, getPredefinedEpisodeRating, getUpcomingEpisodesTimeline } from '../data';
import { AnimatePresence, motion } from 'motion/react';
import HlsVideoPlayer from './HlsVideoPlayer';
import { WebtorPlayer } from './WebtorPlayer';
import { EpisodeRatingsTableModal } from './EpisodeRatingsTableModal';

interface DetailModalProps {
  item: MediaItem;
  autoPlayConfig?: {
    server?: string;
    externalPlayer?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    streamUrl?: string;
  } | null;
  onClose: () => void;
  favorites: number[];
  watchedEpisodes: Record<number, Record<string, boolean>>;
  toggleWatchlist: (id: number, type: MediaType, fullItem?: MediaItem) => void;
  toggleFavorite: (id: number, type?: MediaType, fullItem?: MediaItem) => void;
  setRating: (id: number, type: MediaType, rating: number | null, fullItem?: MediaItem) => void;
  toggleMovieWatched: (movieId: number, fullItem?: MediaItem) => void;
  toggleEpisodeWatched: (showId: number, seasonNum: number, episodeNum: number, totalEpisodesInShow: number, fullItem?: MediaItem) => void;
  toggleShowCompleted: (showId: number, seasons: Season[], forceComplete?: boolean, fullItem?: MediaItem) => void;
  toggleSeasonCompleted: (
    showId: number,
    seasonNumber: number,
    episodes: Episode[],
    totalEpisodesInShow: number,
    forceComplete?: boolean,
    fullItem?: MediaItem
  ) => void;
  toggleStoppedWatching: (showId: number, fullItem?: MediaItem) => void;
  importMediaItem?: (item: MediaItem) => void;
  onPersonClick?: (personId: number) => void;
}



function getInitialReactions(commentId: string, likesCount: number, rating: number | null, content: string) {
  let hash = 0;
  for (let i = 0; i < commentId.length; i++) {
    hash = (hash << 5) - hash + commentId.charCodeAt(i);
    hash |= 0;
  }
  const stableRandom = (seed: number) => {
    const x = Math.sin(hash + seed) * 10000;
    return x - Math.floor(x);
  };

  const likes = likesCount || 0;
  const reactions: Record<string, number> = {
    '👍': 0,
    '❤️': 0,
    '😂': 0,
    '😮': 0,
    '😢': 0,
  };

  if (likes > 0) {
    const thumbShare = Math.round(likes * 0.6) || 1;
    reactions['👍'] = thumbShare;
    reactions['❤️'] = Math.max(0, likes - thumbShare);
  } else {
    // Generate a consistent, realistic baseline of likes/hearts for active comments
    reactions['👍'] = Math.floor(stableRandom(10) * 4);
    reactions['❤️'] = Math.floor(stableRandom(11) * 3);
  }

  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('funny') || lowerContent.includes('hilarious') || lowerContent.includes('lol') || lowerContent.includes('laugh') || stableRandom(1) < 0.25) {
    reactions['😂'] = Math.floor(stableRandom(2) * 5) + (lowerContent.includes('funny') ? 2 : 0);
  }
  if (lowerContent.includes('twist') || lowerContent.includes('shock') || lowerContent.includes('wow') || lowerContent.includes('crazy') || stableRandom(3) < 0.20) {
    reactions['😮'] = Math.floor(stableRandom(4) * 4) + (lowerContent.includes('twist') ? 2 : 0);
  }
  if (lowerContent.includes('sad') || lowerContent.includes('cry') || lowerContent.includes('tear') || lowerContent.includes('died') || lowerContent.includes('death') || stableRandom(5) < 0.15) {
    reactions['😢'] = Math.floor(stableRandom(6) * 4) + (lowerContent.includes('sad') ? 2 : 0);
  }

  if (rating && rating >= 8) {
    reactions['❤️'] += Math.floor(stableRandom(7) * 3) + 1;
  }

  return reactions;
}

const SERVERS = [
  { value: 'flussonic', label: 'Flussonic (MP4)' },
  { value: 'vsembed.ru', label: 'vsembed.ru (Default)' },
  { value: 'torrentio', label: 'Torrentio (P2P)' },
  { value: 'vidking.net', label: 'Vidking (API)' },
  { value: 'yastream', label: 'Yastream (Fast MP4)' },
  { value: 'vaplayer.ru', label: 'vaplayer.ru (API)' },
  { value: 'vidsrc-embed.ru', label: 'vidsrc-embed.ru' },
  { value: 'vidsrc.me', label: 'vidsrc.me' },
];

export function DetailModal({
  item,
  autoPlayConfig,
  onClose,
  favorites,
  watchedEpisodes,
  toggleWatchlist,
  toggleFavorite,
  setRating,
  toggleMovieWatched,
  toggleEpisodeWatched,
  toggleShowCompleted,
  toggleSeasonCompleted,
  toggleStoppedWatching,
  importMediaItem,
  onPersonClick,
}: DetailModalProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  const watchedMap = watchedEpisodes[item.id] || {};

  // Calculates precise remaining days, hours, and minutes until an episode airs
  const getDetailedCountdown = (airDateStr: string, airTimeStr?: string) => {
    const CURRENT_TIME = new Date();
    const targetStr = `${airDateStr}T${airTimeStr || '20:00'}:00-07:00`;
    const targetDate = new Date(targetStr);
    
    const diffMs = targetDate.getTime() - CURRENT_TIME.getTime();
    if (diffMs <= 0) {
      return null;
    }
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    
    return { days, hours, minutes };
  };

  const upcomingEpisodes = item.type === 'show' ? getUpcomingEpisodesTimeline([{ ...item, inWatchlist: true, completed: false }], watchedEpisodes) : [];
  const upcomingEp = upcomingEpisodes.length > 0 ? upcomingEpisodes[0] : null;
  const countdown = upcomingEp ? getDetailedCountdown(upcomingEp.airDate, upcomingEp.airTime) : null;

  // Find first unwatched episode to continue watching
  const getNextUnwatchedEpisode = () => {
    for (const season of seasons) {
      for (const episode of season.episodes) {
        const epKey = `S${season.seasonNumber}E${episode.episode}`;
        if (!watchedMap[epKey]) {
          return { seasonNum: season.seasonNumber, episodeNum: episode.episode, title: episode.title };
        }
      }
    }
    // If all watched or none found, return the first episode of the first season
    if (seasons.length > 0 && seasons[0].episodes.length > 0) {
      return { seasonNum: seasons[0].seasonNumber, episodeNum: seasons[0].episodes[0].episode, title: seasons[0].episodes[0].title };
    }
    return null;
  };
  const nextEpisode = item.type === 'show' ? getNextUnwatchedEpisode() : null;

  const [reviews, setReviews] = useState<TMDBReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);
  const [imdbReviews, setImdbReviews] = useState<TMDBReview[]>([]);
  const [loadingImdbReviews, setLoadingImdbReviews] = useState<boolean>(false);
  const [activeReviewTab, setActiveReviewTab] = useState<'written' | 'imdb' | 'kurdcinema'>('written');
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const [visibleReviewsLimit, setVisibleReviewsLimit] = useState<number>(8);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [traktId, setTraktId] = useState<string | number | null>(null);
  const [expandedEpisodeComments, setExpandedEpisodeComments] = useState<Record<string, boolean>>({});
  const [selectedEpisodeForComments, setSelectedEpisodeForComments] = useState<{
    seasonNum: number;
    episodeNum: number;
    title: string;
    overview: string;
  } | null>(null);
  const [episodeComments, setEpisodeComments] = useState<Record<string, TMDBReview[]>>({});
  const [loadingEpisodeComments, setLoadingEpisodeComments] = useState<Record<string, boolean>>({});
  const [activeEpisodeReviewTab, setActiveEpisodeReviewTab] = useState<'trakt' | 'imdb'>('trakt');

  // Kurdcinema States
  const [kurdcinemaSearchQuery, setKurdcinemaSearchQuery] = useState(item.title || '');
  const [kurdcinemaSearchResults, setKurdcinemaSearchResults] = useState<any[]>([]);
  const [kurdcinemaSelectedUrl, setKurdcinemaSelectedUrl] = useState<string | null>(null);
  const [kurdcinemaComments, setKurdcinemaComments] = useState<any | null>(null);
  const [isSearchingKurdcinema, setIsSearchingKurdcinema] = useState(false);
  const [isFetchingKurdcinemaComments, setIsFetchingKurdcinemaComments] = useState(false);

  // Auto-fetch Kurdcinema comments when tab is opened
  useEffect(() => {
    if (activeReviewTab === 'kurdcinema' && !kurdcinemaComments && !isSearchingKurdcinema && !isFetchingKurdcinemaComments && !kurdcinemaSelectedUrl && kurdcinemaSearchResults.length === 0) {
      setIsSearchingKurdcinema(true);
      const searchTitle = item.title || '';
      
      fetchKurdcinemaSearch(searchTitle, item.type === 'show' ? 'series' : 'movie').then(async res => {
        let finalResults = res || [];
        if (finalResults.length === 0 && searchTitle.includes(' ')) {
          // Try searching with just the first main word
          const firstWord = searchTitle.split(' ')[0];
          if (firstWord.length > 2) {
            finalResults = await fetchKurdcinemaSearch(firstWord, 'all');
          }
        }

        if (finalResults && finalResults.length > 0) {
          let bestMatch = finalResults[0];
          const queryTitle = searchTitle.toLowerCase().trim();
          for (const r of finalResults) {
            let rTitle = (r.title || '').toLowerCase();
            rTitle = rTitle.replace(/\(\d{4}\)/g, '').replace(/[‎‏‪-‮]/g, '').trim();
            if (rTitle === queryTitle) {
              bestMatch = r;
              break;
            }
          }
          setKurdcinemaSearchResults(finalResults);
          setKurdcinemaSelectedUrl(bestMatch.url || bestMatch.id);

          setIsSearchingKurdcinema(false);
          setIsFetchingKurdcinemaComments(true);
          fetchKurdcinemaComments(bestMatch.url || bestMatch.id, item.type === 'show' ? 'series' : 'movie').then(data => {
            setKurdcinemaComments(data);
            setIsFetchingKurdcinemaComments(false);
          });
        } else {
          setKurdcinemaSearchResults([]);
          setIsSearchingKurdcinema(false);
        }
      });
    }
  }, [activeReviewTab, item.title, item.type]);


  const [imdbInfo, setImdbInfo] = useState<{rating: number, votes: number} | null>(null);

  useEffect(() => {
    if (item.imdbId) {
      fetchImdbRating(item.imdbId).then(info => {
        if (info && info.rating) {
          setImdbInfo(info);
        }
      });
    } else if (item.rating) {
      setImdbInfo({ rating: item.rating, votes: 0 });
    }
  }, [item.imdbId, item.rating]);

  useEffect(() => {
    if (activeReviewTab === 'imdb' && imdbReviews.length === 0 && !loadingImdbReviews) {
      setLoadingImdbReviews(true);
      const targetImdbId = item.imdbId;
      if (targetImdbId) {
        fetchImdbReviews(targetImdbId).then(revs => {
          if (revs && revs.length > 0) {
            setImdbReviews(revs);
          }
          setLoadingImdbReviews(false);
        });
      } else {
        setLoadingImdbReviews(false);
      }
    }
  }, [activeReviewTab, item.imdbId, imdbReviews.length, loadingImdbReviews]);

  const [reviewsSortOrder, setReviewsSortOrder] = useState<'reactions' | 'newest'>('reactions');
  const [userSelectedReactions, setUserSelectedReactions] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('user_comment_emoji_reactions');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('user_comment_emoji_reactions', JSON.stringify(userSelectedReactions));
  }, [userSelectedReactions]);

  const getReactionScore = (review: TMDBReview) => {
    const likes = review.likes || 0;
    const replies = review.replies || 0;
    
    // Calculate custom base reactions
    const baseReactions = getInitialReactions(review.id, likes, review.rating, review.content);
    const baseReactionsSum = Object.values(baseReactions).reduce((sum, val) => sum + val, 0);

    // Sum is likes + replies * 1.5 + base reactions sum + user selected point
    let score = likes + replies * 1.5 + baseReactionsSum;
    if (userSelectedReactions[review.id]) {
      score += 2.0;
    }
    return score;
  };

  const handleEmojiClick = (commentId: string, emoji: string) => {
    setUserSelectedReactions(prev => {
      const current = prev[commentId];
      if (current === emoji) {
        const updated = { ...prev };
        delete updated[commentId];
        return updated;
      } else {
        return { ...prev, [commentId]: emoji };
      }
    });
  };

  const getCommentReactions = (commentId: string, likes: number, rating: number | null, content: string) => {
    const base = getInitialReactions(commentId, likes, rating, content);
    const userReact = userSelectedReactions[commentId];
    if (userReact) {
      base[userReact] = (base[userReact] || 0) + 1;
    }
    return base;
  };

  const sortedReviews = React.useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (reviewsSortOrder === 'reactions') {
        const scoreA = getReactionScore(a);
        const scoreB = getReactionScore(b);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reviews, reviewsSortOrder, userSelectedReactions]);

  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [activePlayerUrl, setActivePlayerUrl] = useState<string | null>(null);
  const [activeStreamTitle, setActiveStreamTitle] = useState<string>('');
  const lastRecordedUrlRef = useRef<string | null>(null);
  const [confirmedPlayInBrowser, setConfirmedPlayInBrowser] = useState<boolean>(false);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [autoPlayState, setAutoPlayState] = useState<{
    pendingExternalPlayer?: string;
    isAutoPlaying: boolean;
  } | null>(null);

  useEffect(() => {
    if (autoPlayConfig && !autoPlayState) {
      if (autoPlayConfig.server) {
        setActiveServer(autoPlayConfig.server);
      }
      setAutoPlayState({
        pendingExternalPlayer: autoPlayConfig.externalPlayer,
        isAutoPlaying: true
      });
      
      const serverToUse = autoPlayConfig.server || activeServer;
      
      if (autoPlayConfig.streamUrl) {
         setActivePlayerUrl(autoPlayConfig.streamUrl);
         // If it's an episode, we should also set the active episode so UI looks right
         if (item.type === 'show' && autoPlayConfig.seasonNumber !== undefined && autoPlayConfig.episodeNumber !== undefined) {
           setActivePlayingEpisode({ seasonNum: autoPlayConfig.seasonNumber, episodeNum: autoPlayConfig.episodeNumber });
         }
      } else if (item.type === 'movie') {
        handlePlayMovie(serverToUse);
      } else if (item.type === 'show' && autoPlayConfig.seasonNumber !== undefined && autoPlayConfig.episodeNumber !== undefined) {
        handlePlayEpisode(autoPlayConfig.seasonNumber, autoPlayConfig.episodeNumber, serverToUse);
      }
    }
  }, [autoPlayConfig]); // only run once when autoPlayConfig mounts/changes

  useEffect(() => {
    if (activePlayerUrl && autoPlayState?.isAutoPlaying) {
      const extPlayer = autoPlayState.pendingExternalPlayer;
      let urlStr = activePlayerUrl;
      // Strip http/https for some schemes if needed, but standard is fine
      // Some players want the full URL encoded, others just the stripped.
      const directUrl = activePlayerUrl;
      
      if (extPlayer === 'vlc') {
         window.location.href = `vlc://${directUrl}`;
      } else if (extPlayer === 'outplayer') {
         window.location.href = `outplayer://${directUrl}`; // Or strip scheme: directUrl.replace(/^https?:\/\//, '')
      } else if (extPlayer === 'infuse') {
         window.location.href = `infuse://x-callback-url/play?url=${encodeURIComponent(directUrl)}`;
      } else {
         setConfirmedPlayInBrowser(true);
      }
      
      setAutoPlayState(null); // done auto-playing
    }
  }, [activePlayerUrl, autoPlayState]);

  const [torrentStreams, setTorrentStreams] = useState<any[]>([]);
  const [torrServeIp, setTorrServeIp] = useState<string>(() => {
    return localStorage.getItem('tracker_torrserve_ip') || '';
  });
  const [activeServer, setActiveServer] = useState<string>(() => {
    return localStorage.getItem('tracker_selected_server') || 'vsembed.ru';
  });
  const [isTorrServeExpanded, setIsTorrServeExpanded] = useState<boolean>(false);
  const [torrentSearchQuery, setTorrentSearchQuery] = useState<string>('');
  const [torrentQualityFilter, setTorrentQualityFilter] = useState<'all' | '4k' | '1080p' | '720p' | 'cached'>('all');
  const [torrentEpisodeFilter, setTorrentEpisodeFilter] = useState<'all' | 'single' | 'packs'>('all');
  const [copiedStreamIdx, setCopiedStreamIdx] = useState<number | null>(null);
  const [showRatingsTable, setShowRatingsTable] = useState<boolean>(false);
  const [isEpisodesExpanded, setIsEpisodesExpanded] = useState<boolean>(true);
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState<boolean>(false);
  const [isPlayerServerDropdownOpen, setIsPlayerServerDropdownOpen] = useState<boolean>(false);

  // Native event capture to prevent iframes from stealing focus during scroll
  useEffect(() => {
    let timeout: any = null;
    const handleWheelCapture = () => {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        iframe.style.pointerEvents = 'none';
      });
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        iframes.forEach(iframe => {
          iframe.style.pointerEvents = 'auto';
        });
      }, 500);
    };

    // We must wait for the container to mount
    const attachListener = () => {
      const container = document.getElementById('detail-modal');
      if (container) {
        container.addEventListener('wheel', handleWheelCapture, { capture: true, passive: true });
        container.addEventListener('touchmove', handleWheelCapture, { capture: true, passive: true });
      }
    };
    
    // Slight delay to ensure DOM is ready
    setTimeout(attachListener, 100);

    return () => {
      const container = document.getElementById('detail-modal');
      if (container) {
        container.removeEventListener('wheel', handleWheelCapture, { capture: true });
        container.removeEventListener('touchmove', handleWheelCapture, { capture: true });
      }
      if (timeout) clearTimeout(timeout);
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        iframe.style.pointerEvents = 'auto';
      });
    };
  }, []);

  // Seedr Integration State & Functions
  interface SeedrStatusItem {
    status: 'ready' | 'downloading' | 'not_added' | 'error' | 'none';
    loading?: boolean;
    progress?: number;
    files?: Array<{ id: number; name: string; size: number; streamUrl?: string }>;
    message?: string;
    infoHash?: string;
    title?: string;
  }
  const [seedrStatusMap, setSeedrStatusMap] = useState<Record<number, SeedrStatusItem>>({});
  const [copiedSeedrFileId, setCopiedSeedrFileId] = useState<number | null>(null);

  const checkSeedrStatus = async (idx: number, infoHash: string, title: string) => {
    setSeedrStatusMap(prev => ({
      ...prev,
      [idx]: { 
        status: prev[idx]?.status || 'none', 
        loading: true, 
        infoHash, 
        title 
      }
    }));
    try {
      const response = await fetch(`/api/seedr/status?infoHash=${infoHash}&title=${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error("Failed response");
      const data = await response.json();
      setSeedrStatusMap(prev => ({
        ...prev,
        [idx]: {
          status: data.status,
          loading: false,
          progress: data.progress,
          files: data.files,
          message: data.message,
          infoHash,
          title
        }
      }));
    } catch (error) {
      console.error("Error checking Seedr status:", error);
      setSeedrStatusMap(prev => ({
        ...prev,
        [idx]: { 
          status: 'error', 
          loading: false, 
          message: 'Failed to fetch status from Seedr',
          infoHash,
          title
        }
      }));
    }
  };

  const addSeedrStream = async (idx: number, infoHash: string, title: string, fullMagnetUrl: string) => {
    setSeedrStatusMap(prev => ({
      ...prev,
      [idx]: { 
        status: prev[idx]?.status || 'none', 
        loading: true, 
        infoHash, 
        title 
      }
    }));
    try {
      const response = await fetch(`/api/seedr/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet: fullMagnetUrl, infoHash, title })
      });
      if (!response.ok) {
        let errMsg = "Failed to add";
        try {
          const errData = await response.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      setSeedrStatusMap(prev => ({
        ...prev,
        [idx]: {
          status: data.status,
          loading: false,
          progress: data.progress,
          files: data.files,
          message: data.message,
          infoHash,
          title
        }
      }));
      triggerToast("Magnet added to Seedr account! Old items cleared.");
    } catch (error: any) {
      console.error("Error adding Seedr stream:", error);
      setSeedrStatusMap(prev => ({
        ...prev,
        [idx]: { 
          status: 'error', 
          loading: false, 
          message: error.message || 'Failed to add stream',
          infoHash,
          title
        }
      }));
    }
  };

  // Build a stable polling key based on the infoHashes of actively downloading Seedr transfers
  const downloadingHashesKey = (Object.values(seedrStatusMap) as SeedrStatusItem[])
    .filter((val): val is SeedrStatusItem & { status: 'downloading'; infoHash: string } => 
      val !== undefined && val.status === 'downloading' && typeof val.infoHash === 'string'
    )
    .map(val => val.infoHash)
    .sort()
    .join(',');

  // Automatically poll Seedr status in the background for active downloads
  useEffect(() => {
    const downloadingEntries = (Object.entries(seedrStatusMap) as Array<[string, SeedrStatusItem]>)
      .filter((entry): entry is [string, SeedrStatusItem & { status: 'downloading'; infoHash: string; title: string }] => 
        entry[1] !== undefined && 
        entry[1].status === 'downloading' && 
        typeof entry[1].infoHash === 'string' &&
        typeof entry[1].title === 'string'
      )
      .map(([key, value]) => ({
        idx: parseInt(key, 10),
        infoHash: value.infoHash,
        title: value.title
      }));

    if (downloadingEntries.length === 0) return;

    const interval = setInterval(() => {
      downloadingEntries.forEach(async ({ idx, infoHash, title }) => {
        try {
          const response = await fetch(`/api/seedr/status?infoHash=${infoHash}&title=${encodeURIComponent(title)}`);
          if (!response.ok) throw new Error("Failed polling");
          const data = await response.json();
          
          setSeedrStatusMap(prev => {
            // Confirm the entry still exists and is still in downloading/fetching state
            if (!prev[idx] || prev[idx].status !== 'downloading') return prev;
            
            return {
              ...prev,
              [idx]: {
                ...prev[idx],
                status: data.status,
                progress: data.progress,
                files: data.files,
                message: data.message,
                loading: false
              }
            };
          });
        } catch (error) {
          console.error("Error auto-polling Seedr status:", error);
        }
      });
    }, 4000); // Check status every 4 seconds

    return () => clearInterval(interval);
  }, [downloadingHashesKey]);

  const [activePlayingEpisode, setActivePlayingEpisode] = useState<{ seasonNum: number; episodeNum: number } | null>(null);
  const [detectedKuSub, setDetectedKuSub] = useState<string | null>(null);
  const [detectedEnSub, setDetectedEnSub] = useState<string | null>(null);
  const [checkingSubs, setCheckingSubs] = useState<boolean>(false);
  const [flussonicScanning, setFlussonicScanning] = useState<boolean>(false);
  const [flussonicScanProgress, setFlussonicScanProgress] = useState<string>('');
  const [flussonicCheckedUrls, setFlussonicCheckedUrls] = useState<Array<{ url: string; label: string; status: 'checking' | 'ok' | 'failed' }>>([]);

  const recordWatchHistory = (externalPlayer: string = 'browser', specificUrl?: string) => {
    import('../lib/watchHistory').then(({ addToWatchHistory }) => {
      let epTitle;
      if (activePlayingEpisode && item.seasons) {
        const s = item.seasons.find(s => s.seasonNumber === activePlayingEpisode.seasonNum);
        if (s) {
          const ep = s.episodes.find(e => e.episode === activePlayingEpisode.episodeNum);
          if (ep) epTitle = ep.title;
        }
      }
      addToWatchHistory({
        mediaId: item.id,
        type: item.type,
        mediaItem: item,
        seasonNumber: activePlayingEpisode?.seasonNum,
        episodeNumber: activePlayingEpisode?.episodeNum,
        episodeTitle: epTitle,
        server: activeServer,
        externalPlayer: externalPlayer,
        streamUrl: specificUrl || activePlayerUrl,
      });
    });
  };

  // Auto-record watch history when any non-Flussonic player URL is loaded/started
  useEffect(() => {
    if (activePlayerUrl && activePlayerUrl !== 'torrentio-menu' && activePlayerUrl !== lastRecordedUrlRef.current) {
      const isFlussonic = activePlayerUrl.includes('Flussonic247') || 
                          activePlayerUrl.includes('Flussonic251') || 
                          activePlayerUrl.includes('130.193.165.194') || 
                          activePlayerUrl.includes('154.48.204.98') ||
                          activePlayerUrl.includes('130.193.166.118') ||
                          activePlayerUrl.includes('130.193.166.197') ||
                          activePlayerUrl.includes('/sss/');
      // Skip Torrentio and TorrServe direct streams as their click handlers already record history
      const isTorrentOrTorrServe = activePlayerUrl.includes('torrentio') || 
                                    activePlayerUrl.includes('127.0.0.1') || 
                                    activePlayerUrl.includes('localhost') || 
                                    activePlayerUrl.includes('torrserve');
      
      if (!isFlussonic && !isTorrentOrTorrServe) {
        lastRecordedUrlRef.current = activePlayerUrl;
        recordWatchHistory('browser', activePlayerUrl);
      }
    } else if (!activePlayerUrl) {
      lastRecordedUrlRef.current = null;
    }
  }, [activePlayerUrl, activePlayingEpisode]);

  // Perform background subtitle checking for Flussonic/sss streams
  useEffect(() => {
    if (!activePlayerUrl) {
      setDetectedKuSub(null);
      setDetectedEnSub(null);
      setCheckingSubs(false);
      return;
    }

    const isFlussonic = activePlayerUrl.includes('Flussonic247') || 
                        activePlayerUrl.includes('Flussonic251') || 
                        activePlayerUrl.includes('130.193.165.194') || 
                        activePlayerUrl.includes('154.48.204.98') ||
                        activePlayerUrl.includes('/sss/');

    if (!isFlussonic) {
      setDetectedKuSub(null);
      setDetectedEnSub(null);
      setCheckingSubs(false);
      return;
    }

    const checkSubs = async () => {
      setCheckingSubs(true);
      setDetectedKuSub(null);
      setDetectedEnSub(null);

      let kuCandidates: string[] = [];
      let enCandidates: string[] = [];

      if (item.type === 'movie') {
        const movieCands = getMovieSubCandidates(activePlayerUrl, item.title, item.releaseDate);
        kuCandidates = movieCands.Ku;
        enCandidates = movieCands.En;
      } else if (activePlayingEpisode) {
        const showCands = getShowSubCandidates(activePlayerUrl, item.title, activePlayingEpisode.seasonNum, activePlayingEpisode.episodeNum);
        kuCandidates = showCands.Ku;
        enCandidates = showCands.En;
      }

      const checkSubtitleAvailability = async (candidates: string[]): Promise<string | null> => {
        for (const url of candidates) {
          try {
            // Use our subtitle proxy to perform HEAD check (handles CORS completely!)
            const testUrl = `/api/proxy-subtitle?url=${encodeURIComponent(url)}`;
            const response = await fetch(testUrl, { method: 'HEAD' });
            if (response.ok) {
              return url; // Found the first working subtitle URL!
            }
          } catch (e) {
            console.warn("Failed to check candidate subtitle:", url, e);
          }
        }
        return null;
      };

      try {
        const [workingKu, workingEn] = await Promise.all([
          checkSubtitleAvailability(kuCandidates),
          checkSubtitleAvailability(enCandidates)
        ]);
        setDetectedKuSub(workingKu);
        setDetectedEnSub(workingEn);
      } catch (err) {
        console.error("Error checking subtitle availability:", err);
      } finally {
        setCheckingSubs(false);
      }
    };

    checkSubs();
  }, [activePlayerUrl, activePlayingEpisode, item.title, item.type, item.releaseDate]);

  useEffect(() => {
    setConfirmedPlayInBrowser(false);
  }, [activePlayerUrl]);

  const parseTorrentStream = (stream: any) => {
    const title = stream.title || '';
    const name = stream.name || '';
    
    // Extract seeds
    let seeds = 0;
    const seedsMatch = title.match(/👤\s*(\d+)/);
    if (seedsMatch) {
      seeds = parseInt(seedsMatch[1], 10);
    } else {
      const altSeedsMatch = title.match(/(?:seeds|seeders|👤):\s*(\d+)/i);
      if (altSeedsMatch) {
        seeds = parseInt(altSeedsMatch[1], 10);
      }
    }

    // Extract size in GB
    let sizeInGB = 0;
    const sizeMatch = title.match(/💾\s*([\d.]+)\s*(GB|MB|KB|TB)/i) || title.match(/([\d.]+)\s*(GB|MB|KB|TB)/i);
    if (sizeMatch) {
      const value = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      if (unit === 'GB') {
        sizeInGB = value;
      } else if (unit === 'MB') {
        sizeInGB = value / 1024;
      } else if (unit === 'TB') {
        sizeInGB = value * 1024;
      } else if (unit === 'KB') {
        sizeInGB = value / (1024 * 1024);
      }
    }

    // Extract Resolution
    let resolution = '1080P';
    if (name.includes('4K') || name.toLowerCase().includes('2160p') || title.toLowerCase().includes('4k') || title.toLowerCase().includes('2160p')) {
      resolution = '4K UHD';
    } else if (name.includes('1080p') || name.includes('1080P') || title.toLowerCase().includes('1080p')) {
      resolution = '1080P';
    } else if (name.includes('720p') || name.includes('720P') || title.toLowerCase().includes('720p')) {
      resolution = '720P';
    } else if (name.includes('480p') || name.includes('480P') || title.toLowerCase().includes('480p')) {
      resolution = '480P';
    } else if (title.toLowerCase().includes('3d')) {
      resolution = '3D';
    } else {
      const resMatch = name.match(/(\d{3,4}p)/i);
      if (resMatch) {
        resolution = resMatch[1].toUpperCase();
      }
    }

    // Extract Debrid cache status
    let isCached = false;
    let debridProvider = '';
    const cleanName = name.toUpperCase();
    if (cleanName.includes('[RD+]') || cleanName.includes('[RD]')) {
      isCached = true;
      debridProvider = 'RealDebrid';
    } else if (cleanName.includes('[AD]')) {
      isCached = true;
      debridProvider = 'AllDebrid';
    } else if (cleanName.includes('[PM]')) {
      isCached = true;
      debridProvider = 'Premiumize';
    }

    // Clean filename
    const titleLines = title.split('\n');
    let fileName = titleLines[0] || 'Unknown Stream File';
    if (fileName.includes('👤') || fileName.includes('💾')) {
      fileName = 'Stream Playback Link';
    }

    // Secondary tags
    const isHDR = /hdr|dv|dolby|vision/i.test(title);
    const isHEVC = /x265|hevc/i.test(title);
    const isMultiAudio = /multi|dual|ita|eng|fre|rus|ger/i.test(title);

    // Identify if single episode or season pack
    const lowerName = name.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const combinedText = lowerName + ' ' + lowerTitle;

    const hasEpisodeIndicator = /e\d+|ep\d+|episode\s*\d+|x\d+|s\d+e\d+/i.test(combinedText);
    const hasSeasonPackIndicator = /complete|season\s*\d+\s*pack|pack|s\d+\s*-\s*s\d+|s\d+\s*season|seasons/i.test(combinedText);

    let isSingleEpisode = false;
    let isSeasonPack = false;

    if (hasEpisodeIndicator && !hasSeasonPackIndicator) {
      isSingleEpisode = true;
    } else if (hasSeasonPackIndicator) {
      isSeasonPack = true;
    } else {
      if (sizeInGB > 0 && sizeInGB < 3.0) {
        isSingleEpisode = true;
      } else {
        isSeasonPack = true;
      }
    }

    return { 
      seeds, 
      sizeInGB, 
      resolution, 
      isCached, 
      debridProvider, 
      fileName, 
      isHDR, 
      isHEVC, 
      isMultiAudio,
      isSingleEpisode,
      isSeasonPack
    };
  };

  const formatFlussonicTitle = (title: string) => {
    const titleWithAnd = title.replace(/&/g, ' And ');
    return titleWithAnd.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
  };

  const getMovieSubCandidates = (streamUrl: string, title: string, releaseDate?: string) => {
    const formattedTitle = formatFlussonicTitle(title);
    const yearsToCheck = ["2025"];
    if (releaseDate) {
      const rYear = releaseDate.substring(0, 4);
      if (!yearsToCheck.includes(rYear)) yearsToCheck.push(rYear);
    }
    const streamYearMatch = streamUrl.match(/\/(\d{4})\//);
    if (streamYearMatch) {
      const sYear = streamYearMatch[1];
      if (!yearsToCheck.includes(sYear)) yearsToCheck.push(sYear);
    }
    const streamOtherMatch = streamUrl.includes('/OTHER/') || streamUrl.includes('/Other/');
    if (streamOtherMatch) {
      yearsToCheck.push("OTHER", "Other");
    }

    // Subtitle can be on the default 130.193.165.194 server or on the active stream's host/path base!
    const bases = ["http://130.193.165.194/Flussonic247"];
    try {
      const urlObj = new URL(streamUrl);
      const streamBase = `${urlObj.protocol}//${urlObj.host}`;
      if (urlObj.pathname.includes('/sss/')) {
        bases.push(`${streamBase}/sss`);
      } else if (urlObj.pathname.includes('/Flussonic251/')) {
        bases.push(`${streamBase}/Flussonic251`);
      } else if (urlObj.pathname.includes('/Flussonic247/')) {
        bases.push(`${streamBase}/Flussonic247`);
      }
    } catch (e) {}

    const uniqueBases = Array.from(new Set(bases));
    const candidates: Record<'Ku' | 'En', string[]> = { Ku: [], En: [] };
    
    uniqueBases.forEach(base => {
      const baseSubUrl = `${base}/EnglishMovies-Subtitle`;
      yearsToCheck.forEach(yr => {
        candidates.Ku.push(`${baseSubUrl}/Ku/${yr}/${formattedTitle}-Ku.srt`);
        candidates.En.push(`${baseSubUrl}/En/${yr}/${formattedTitle}-En.srt`);
      });
    });

    return candidates;
  };

  const getShowSubCandidates = (streamUrl: string, title: string, seasonNum: number, episodeNum: number) => {
    const formattedTitle = formatFlussonicTitle(title);
    const s = seasonNum.toString().padStart(2, '0');
    const e = episodeNum.toString().padStart(2, '0');

    // TV shows subtitle bases can be constructed from the working streamUrl
    const bases = ["http://154.48.204.98/Flussonic251", "http://130.193.166.118/sss"];
    try {
      const urlObj = new URL(streamUrl);
      const streamBase = `${urlObj.protocol}//${urlObj.host}`;
      if (urlObj.pathname.includes('/sss/')) {
        bases.unshift(`${streamBase}/sss`);
      } else if (urlObj.pathname.includes('/Flussonic251/')) {
        bases.unshift(`${streamBase}/Flussonic251`);
      } else if (urlObj.pathname.includes('/Flussonic247/')) {
        bases.unshift(`${streamBase}/Flussonic247`);
      }
    } catch (err) {}

    const uniqueBases = Array.from(new Set(bases));
    const candidates: Record<'Ku' | 'En', string[]> = { Ku: [], En: [] };
    
    uniqueBases.forEach(basePrefix => {
      candidates.Ku.push(`${basePrefix}/EnglishTvSeries-Subtitle/Ku/${formattedTitle}-Ku-S${s}E${e}.srt`);
      candidates.En.push(`${basePrefix}/EnglishTvSeries-Subtitle/En/${formattedTitle}-En-S${s}E${e}.srt`);
      
      // Check folder variation years / OTHER
      const releaseYear = item.releaseDate ? item.releaseDate.substring(0, 4) : '2024';
      const tvFolders = [releaseYear, "OTHER", "Other", "2025", "2024"];
      tvFolders.forEach(folder => {
        candidates.Ku.push(`${basePrefix}/EnglishTvSeries-Subtitle/Ku/${folder}/${formattedTitle}-Ku-S${s}E${e}.srt`);
        candidates.En.push(`${basePrefix}/EnglishTvSeries-Subtitle/En/${folder}/${formattedTitle}-En-S${s}E${e}.srt`);
      });
    });

    return candidates;
  };

  const scanFlussonicStream = async (
    mediaType: 'movie' | 'show',
    seasonNum?: number,
    episodeNum?: number
  ): Promise<string | null> => {
    setFlussonicScanning(true);
    setFlussonicScanProgress('Generating variation lists...');
    
    const formattedTitle = formatFlussonicTitle(item.title);
    const releaseYear = item.releaseDate ? item.releaseDate.substring(0, 4) : '2024';
    
    // 1. Define Candidate Combinations (Base + Folder)
    const yearInt = parseInt(releaseYear, 10) || 2024;
    let candidateCombos: Array<{ base: string; folder: string }> = [];

    if (mediaType === 'movie') {
      const primary2022 = { base: 'http://130.193.166.118/sss/EnglishMovies1', folder: releaseYear };
      const primary2001 = { base: 'http://130.193.165.194/Flussonic247/EnglishMovies1', folder: releaseYear };
      const primaryOld = { base: 'http://130.193.165.194/Flussonic247/EnglishMovies1', folder: 'OTHER' };

      if (yearInt >= 2022) {
        candidateCombos = [primary2022, primary2001, primaryOld];
      } else if (yearInt >= 2001 && yearInt <= 2021) {
        candidateCombos = [primary2001, primary2022, primaryOld];
      } else {
        candidateCombos = [primaryOld, primary2001, primary2022];
      }
    } else {
      const tvNasstore = [
        { base: 'http://130.193.166.197/nasstore/EnglishTvSeries1', folder: releaseYear },
        { base: 'http://130.193.166.197/nasstore/EnglishTvSeries1', folder: '' },
        { base: 'http://130.193.166.197/nasstore/EnglishTvSeries1', folder: 'OTHER' }
      ];
      const tvFlussonic = [
        { base: 'http://154.48.204.98/Flussonic251/EnglishTvSeries1', folder: releaseYear },
        { base: 'http://154.48.204.98/Flussonic251/EnglishTvSeries1', folder: '' },
        { base: 'http://154.48.204.98/Flussonic251/EnglishTvSeries1', folder: 'OTHER' }
      ];

      if (yearInt >= 2026) {
        candidateCombos = [...tvNasstore, ...tvFlussonic];
      } else {
        candidateCombos = [...tvFlussonic, ...tvNasstore];
      }
    }

    // 2. Define filename suffix variations
    let filenameSuffixes: string[] = [];
    if (mediaType === 'movie') {
      filenameSuffixes = [
        `${formattedTitle}-NoSub.mp4`,
        `${formattedTitle}.mp4`
      ];
    } else {
      const s = seasonNum ? seasonNum.toString().padStart(2, '0') : '01';
      const e = episodeNum ? episodeNum.toString().padStart(2, '0') : '01';
      filenameSuffixes = [
        `${formattedTitle}-S${s}E${e}.mp4`,
        `${formattedTitle}_S${s}E${e}.mp4`,
        `${formattedTitle}-S${seasonNum || 1}E${episodeNum || 1}.mp4`
      ];
    }

    // 3. Generate candidate URLs with beautiful labels
    const candidates: Array<{ url: string; label: string; status: 'checking' | 'ok' | 'failed' }> = [];
    
    candidateCombos.forEach((combo) => {
      let srvName = "Flussonic";
      if (combo.base.includes('/sss/')) srvName = "sss fallback";
      else if (combo.base.includes('Flussonic247')) srvName = "Flussonic247";
      else if (combo.base.includes('Flussonic251')) srvName = "Flussonic251";
      else if (combo.base.includes('nasstore')) srvName = "nasstore";
      
      const ipMatch = combo.base.match(/\d+\.\d+\.\d+\.\d+/);
      const ip = ipMatch ? ipMatch[0] : "Server";

      filenameSuffixes.forEach((suffix) => {
        const url = combo.folder ? `${combo.base}/${combo.folder}/${suffix}` : `${combo.base}/${suffix}`;
        const label = `${srvName} [${ip}] -> ${combo.folder || 'root'} -> ${suffix}`;
        
        if (!candidates.some(c => c.url === url)) {
          candidates.push({ url, label, status: 'checking' });
        }
      });
    });

    setFlussonicCheckedUrls(candidates);

    // 5. Scan the candidate URLs
    setFlussonicScanProgress(`Scanning ${candidates.length} variations one-by-one...`);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      setFlussonicScanProgress(`Checking: ${candidate.label}...`);
      
      try {
        let isSuccess = false;
        try {
          const testUrl = `/api/proxy-video?url=${encodeURIComponent(candidate.url)}`;
          const response = await fetch(testUrl, { method: 'HEAD' });
          if (response.ok) isSuccess = true;
        } catch (err) {}

        if (!isSuccess) {
          try {
            const directRes = await fetch(candidate.url, { method: 'HEAD', mode: 'no-cors' });
            if (directRes.type === 'opaque' || directRes.ok) {
              isSuccess = true;
            }
          } catch (err) {}
        }
        
        if (isSuccess) {
          setFlussonicCheckedUrls(prev => 
            prev.map((c, idx) => idx === i ? { ...c, status: 'ok' as const } : c)
          );
          setFlussonicScanProgress(`SUCCESS! Found working stream: ${candidate.label}`);
          setFlussonicScanning(false);
          return candidate.url;
        } else {
          setFlussonicCheckedUrls(prev => 
            prev.map((c, idx) => idx === i ? { ...c, status: 'failed' as const } : c)
          );
        }
      } catch (err) {
        setFlussonicCheckedUrls(prev => 
          prev.map((c, idx) => idx === i ? { ...c, status: 'failed' as const } : c)
        );
      }
    }

    setFlussonicScanProgress('No working Flussonic variations found.');
    setFlussonicScanning(false);
    return null;
  };

  const getVideoPlayerSrc = (url: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://")) {
      return `/api/proxy-video?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const getOpenInNewTabUrl = (url: string | null) => {
    if (!url) return "";
    return `${window.location.origin}${window.location.pathname}?videoUrl=${encodeURIComponent(url)}&title=${encodeURIComponent(activeStreamTitle)}&kuSub=${encodeURIComponent(detectedKuSub || '')}&enSub=${encodeURIComponent(detectedEnSub || '')}`;
  };

  const handleServerChange = (newServer: string) => {
    setActiveServer(newServer);
    localStorage.setItem('tracker_selected_server', newServer);
    
    if (newServer === 'flussonic' || activeServer === 'flussonic' || newServer === 'torrentio' || newServer === 'vidking.net' || activeServer === 'vidking.net') {
      setActivePlayerUrl(null);
      setTorrentStreams([]);
      return;
    }
    
    // If player is active, update its URL to use the new server domain
    if (activePlayerUrl) {
      try {
        const url = new URL(activePlayerUrl);
        url.host = newServer;
        setActivePlayerUrl(url.toString());
      } catch (err) {
        // Fallback string replace if URL parsing fails
        const updated = activePlayerUrl
          .replace('vidsrc-embed.ru', newServer)
          .replace('vsembed.ru', newServer)
          .replace('vidsrc.me', newServer)
          .replace('vaplayer.ru', newServer);
        setActivePlayerUrl(updated);
      }
    }
  };

  // Trigger Toast helper
  const triggerToast = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 2500);
  };

  // Helper to safely Base64-encode subtitle URLs for VLC M3U files to avoid query param relative-path bugs
  const encodeSubtitleUrl = (url: string) => {
    try {
      const base64 = window.btoa(unescape(encodeURIComponent(url)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      return base64;
    } catch (e) {
      console.error("Failed to encode subtitle URL", e);
      return "";
    }
  };

  // Helper to download a subtitle file locally
  const triggerLocalSubtitleDownload = async (subUrl: string, filename: string) => {
    try {
      const response = await fetch(`${window.location.origin}/api/proxy-subtitle.srt?url=${encodeURIComponent(subUrl)}`);
      if (!response.ok) throw new Error("Failed to fetch subtitle via proxy");
      const text = await response.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error(`Error downloading subtitle file ${filename}:`, error);
    }
  };

  // Download M3U playlist helper for VLC with subtitle integration
  const downloadM3uFile = async (streamUrl: string, streamTitle: string, kuSub?: string, enSub?: string) => {
    const cleanTitle = streamTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'stream';
    
    // Define clean local filenames for VLC PC to pair and load automatically
    const kuSubFilename = kuSub ? `${cleanTitle}.ku.srt` : undefined;
    const enSubFilename = enSub ? `${cleanTitle}.en.srt` : undefined;

    // Download the subtitle files themselves locally to the same Downloads folder
    const promises: Promise<any>[] = [];
    if (kuSub && kuSubFilename) {
      promises.push(triggerLocalSubtitleDownload(kuSub, kuSubFilename));
    }
    if (enSub && enSubFilename) {
      promises.push(triggerLocalSubtitleDownload(enSub, enSubFilename));
    }
    
    if (promises.length > 0) {
      try {
        await Promise.all(promises);
      } catch (err) {
        console.error("Some subtitle downloads failed, proceeding with M3U generation...", err);
      }
    }

    let content = `#EXTM3U\n`;
    
    // Construct secure HTTPS proxy subtitle URLs for iPad/mobile/IPTV apps that need internet-accessible URLs
    const kuSubProxy = kuSub ? `${window.location.origin}/api/proxy-subtitle/${encodeSubtitleUrl(kuSub)}/sub.srt` : undefined;
    const enSubProxy = enSub ? `${window.location.origin}/api/proxy-subtitle/${encodeSubtitleUrl(enSub)}/sub.srt` : undefined;

    // Build the #EXTINF metadata line with absolute HTTPS proxy URLs for iOS/iPad/mobile and IPTV players
    let extinfLine = `#EXTINF:-1`;
    if (kuSubProxy) {
      extinfLine += ` sub-file="${kuSubProxy}" sub-url="${kuSubProxy}" subtitle="${kuSubProxy}" subtitle-url="${kuSubProxy}" subtitle-file="${kuSubProxy}" subtitle-file-url="${kuSubProxy}" sub="${kuSubProxy}" sub-autodetect=1`;
    }
    if (enSubProxy) {
      extinfLine += ` sub-file-en="${enSubProxy}" sub-url-en="${enSubProxy}" subtitle-en="${enSubProxy}" subtitle-url-en="${enSubProxy}" subtitle-file-en="${enSubProxy}" sub-en="${enSubProxy}"`;
    }
    extinfLine += `,${streamTitle}\n`;
    content += extinfLine;
    
    // Also include #EXTVLCOPT options for VLC PC / desktop using local relative filenames
    // This loads both subtitles cleanly as separate tracks in VLC PC without duplicate/overlapping conflicts
    if (kuSubFilename && enSubFilename) {
      content += `#EXTVLCOPT:sub-file=${kuSubFilename}\n`;
      content += `#EXTVLCOPT:input-slave=${enSubFilename}\n`;
    } else if (kuSubFilename) {
      content += `#EXTVLCOPT:sub-file=${kuSubFilename}\n`;
    } else if (enSubFilename) {
      content += `#EXTVLCOPT:sub-file=${enSubFilename}\n`;
    }
    
    content += `${streamUrl}`;
    
    const blob = new Blob([content], { type: 'application/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadFlussonicM3u = (streamUrl: string, streamTitle: string) => {
    const cleanTitle = streamTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'stream';
    const content = [
      '#EXTM3U',
      `#EXTINF:-1,${streamTitle}`,
      '#EXTVLCOPT:http-user-agent=IOS$MyTV',
      '#EXTVLCOPT:http-header-fields=X-Playback-Session-Id: E12A8A10-EFEF-44AF-85EC-4455721EE7EF, Accept-Language: en-GB;q=0.9',
      streamUrl
    ].join('\n');

    const blob = new Blob([content], { type: 'application/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast("Flussonic M3U downloaded!");
    recordWatchHistory('vlc', streamUrl); // Or generic download
  };

  // Play in VLC on PC helper with subtitle integration
  const handlePlayInBrowser = () => {
    setConfirmedPlayInBrowser(true);
    recordWatchHistory('browser');
  };

  const playInVlcPC = async (streamUrl: string, streamTitle: string, kuSub?: string, enSub?: string) => {
    recordWatchHistory('vlc', streamUrl);
    // 1. Attempt to launch the vlc:// custom protocol link
    const vlcStandardUrl = `vlc://${streamUrl}`;
    const link = document.createElement('a');
    link.href = vlcStandardUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2. Download M3U file as a reliable fallback for Windows/Mac PC (now with subtitle tracking!)
    await downloadM3uFile(streamUrl, streamTitle, kuSub, enSub);
    triggerToast("Opening VLC & downloading playlist with subtitles to your Downloads folder...");
  };

  const playFlussonicInVlcIpad = (streamUrl: string, streamTitle: string) => {
    recordWatchHistory('vlc', streamUrl);
    // Use the optimized route and make the URL string terminate with .m3u so VLC's iOS parser handles it as a playlist
    const m3uUrl = `${window.location.origin}/api/flussonic/playlist.m3u?url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(streamTitle)}&vlc=.m3u`;
    
    // Preferred iOS deep link using vlc-x-callback scheme
    const vlcCallbackUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(m3uUrl)}`;
    // Traditional vlcs:// or vlc:// scheme fallback
    const vlcStandardUrl = m3uUrl.replace(/^https:\/\//, 'vlcs://').replace(/^http:\/\//, 'vlc://');

    window.location.href = vlcCallbackUrl;
    setTimeout(() => {
      window.location.href = vlcStandardUrl;
    }, 800);

    triggerToast("Launching VLC on iPad to play M3U...");
  };

  const fetchYastreamUrl = async (imdbId: string, type: 'movie' | 'show', season?: number, episode?: number) => {
    try {
      const baseUrl = "https://yastream.tamthai.de/eyJjYXRhbG9ncyI6WyJraXNza2guc2VyaWVzLktvcmVhbiIsIm9uZXRvdWNodHYuc2VyaWVzLktvcmVhbiIsImtpc3NraC5zZXJpZXMuU2VhcmNoIiwia2lzc2toLm1vdmllLlNlYXJjaCIsIm9uZXRvdWNodHYuc2VyaWVzLlNlYXJjaCIsImlkcmFtYS5zZXJpZXMuaURyYW1hIiwiaWRyYW1hLnNlcmllcy5TZWFyY2giXSwiY2F0YWxvZyI6WyJraXNza2giLCJvbmV0b3VjaHR2Il0sInN0cmVhbSI6WyJraXNza2giLCJvbmV0b3VjaHR2Il0sIm5zZnciOmZhbHNlLCJpbmZvIjpmYWxzZSwicG9zdGVyIjoicnBkYiIsIm1mcFVybCI6IiIsInRiS2V5IjoiIiwibWZwUGFzcyI6IiJ9";
      const path = type === 'movie' 
        ? `/stream/movie/${imdbId}.json`
        : `/stream/series/${imdbId}:${season}:${episode}.json`;
      
      const res = await fetch(`${baseUrl}${path}`);
      if (!res.ok) throw new Error("Yastream fetch failed");
      const data = await res.json();
      
      if (data && data.streams && data.streams.length > 0) {
        // Rank streams: 1. m3u8/m3u, 2. txt (HLS playlist), 3. mp4, 4. anything else
        const sortedStreams = [...data.streams].sort((a: any, b: any) => {
          const getScore = (url: string) => {
            if (!url) return 0;
            const u = url.toLowerCase();
            if (u.includes('.m3u8') || u.includes('.m3u')) return 4;
            if (u.includes('.txt')) return 3;
            if (u.includes('.mp4')) return 2;
            if (u.includes('/e/') || u.includes('/embed/')) return -1; // Embeds at bottom
            return 1;
          };
          return getScore(b.url) - getScore(a.url);
        });
        
        return sortedStreams[0].url;
      }
    } catch (e) {
      console.warn('Yastream error:', e);
    }
    return null;
  };

  const scrollToPlayerArea = () => {
    // We now scroll the outer modal overlay because we changed to outer-scroll approach
    const container = document.getElementById('detail-modal');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePlayMovie = async (serverOverride?: string) => {
    const serverToUse = serverOverride || activeServer;
    scrollToPlayerArea();
    const movieTitle = item.title || 'Movie';
    setActiveStreamTitle(movieTitle);
    setActivePlayingEpisode(null);

    if (serverToUse === 'flussonic') {
      setLoadingPlayer(true);
      try {
        const workingUrl = await scanFlussonicStream('movie');
        if (workingUrl) {
          setActivePlayerUrl(workingUrl);
          let displayYear = item.releaseDate ? item.releaseDate.substring(0, 4) : '';
          const yearMatch = workingUrl.match(/\/(\d{4}|OTHER|Other)\//i);
          if (yearMatch) {
            displayYear = yearMatch[1];
          }
          setActiveStreamTitle(`${movieTitle} (${displayYear || 'Flussonic'})`);
          triggerToast(`Found active stream: using ${displayYear || 'Flussonic'}`);
        } else {
          const formattedTitle = formatFlussonicTitle(item.title);
          const year = item.releaseDate ? item.releaseDate.substring(0, 4) : '2024';
          const yearInt = parseInt(year, 10);
          
          let defaultUrl = "";
          if (yearInt >= 2022) {
             defaultUrl = `http://130.193.166.118/sss/EnglishMovies1/${year}/${formattedTitle}-NoSub.mp4`;
          } else if (yearInt >= 2001 && yearInt <= 2021) {
             defaultUrl = `http://130.193.165.194/Flussonic247/EnglishMovies1/${year}/${formattedTitle}-NoSub.mp4`;
          } else {
             defaultUrl = `http://130.193.165.194/Flussonic247/EnglishMovies1/OTHER/${formattedTitle}-NoSub.mp4`;
          }

          setActivePlayerUrl(defaultUrl);
          setActiveStreamTitle(`${movieTitle} (${year})`);
          triggerToast("No working Flussonic variant detected. Using default stream.");
        }
      } catch (err) {
        console.error("Scanning failed", err);
      } finally {
        setLoadingPlayer(false);
      }
      return;
    }

    if (serverToUse === 'vidking.net') {
      setActivePlayerUrl(`https://www.vidking.net/embed/movie/${item.id}`);
      return;
    }
    
    let targetImdbId = item.imdbId;

    if (!targetImdbId) {
      setLoadingPlayer(true);
      try {
        const freshDetails = await fetchMediaDetails(item.id, item.type);
        if (freshDetails && freshDetails.imdbId) {
          if (importMediaItem) {
            importMediaItem(freshDetails);
          }
          targetImdbId = freshDetails.imdbId;
        } else {
          triggerToast("IMDb ID not found for this movie. Unable to load player.");
          setLoadingPlayer(false);
          return;
        }
      } catch (e) {
        console.warn('Failed to fetch movie details for player:', e);
        triggerToast("Error loading player. Please try again.");
        setLoadingPlayer(false);
        return;
      }
      setLoadingPlayer(false);
    }

    if (serverToUse === 'yastream') {
      setLoadingPlayer(true);
      const url = await fetchYastreamUrl(targetImdbId, 'movie');
      if (url) {
        setActivePlayerUrl(url);
      } else {
        triggerToast("No stream found on Yastream.");
      }
      setLoadingPlayer(false);
      return;
    }

    if (serverToUse === 'torrentio') {
      setLoadingPlayer(true);
      setTorrentStreams([]);
      try {
        const res = await fetch(`https://torrentio.strem.fun/stream/movie/${targetImdbId}.json`);
        if (!res.ok) throw new Error("Torrentio fetch failed");
        const data = await res.json();
        if (data && data.streams && data.streams.length > 0) {
          const sorted = [...data.streams].sort((a, b) => {
            const parsedA = parseTorrentStream(a);
            const parsedB = parseTorrentStream(b);
            const isBelow2_A = parsedA.sizeInGB < 2.0;
            const isBelow2_B = parsedB.sizeInGB < 2.0;
            if (isBelow2_A && !isBelow2_B) return -1;
            if (!isBelow2_A && isBelow2_B) return 1;
            return parsedB.seeds - parsedA.seeds;
          });
          setTorrentStreams(sorted);
          setActivePlayerUrl('torrentio-menu');
        } else {
          triggerToast("No streams found on Torrentio.");
        }
      } catch (e) {
        console.warn('Torrentio error:', e);
        triggerToast("Failed to fetch from Torrentio.");
      }
      setLoadingPlayer(false);
      return;
    }

    setActivePlayerUrl(`https://${serverToUse}/embed/movie/${targetImdbId}`);
  };

  const handlePlayEpisode = async (seasonNum: number, episodeNum: number, serverOverride?: string) => {
    const serverToUse = serverOverride || activeServer;
    scrollToPlayerArea();
    const showTitle = item.title || 'Show';
    const sStr = seasonNum.toString().padStart(2, '0');
    const eStr = episodeNum.toString().padStart(2, '0');
    const epTitle = `${showTitle} S${sStr}E${eStr}`;
    setActiveStreamTitle(epTitle);
    setActivePlayingEpisode({ seasonNum, episodeNum });

    if (activeServer === 'flussonic') {
      setLoadingPlayer(true);
      try {
        const workingUrl = await scanFlussonicStream('show', seasonNum, episodeNum);
        if (workingUrl) {
          setActivePlayerUrl(workingUrl);
          triggerToast("Found active TV show stream!");
        } else {
          const formattedTitle = formatFlussonicTitle(item.title);
          const s = seasonNum.toString().padStart(2, '0');
          const e = episodeNum.toString().padStart(2, '0');
          const releaseYearInt = item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : 2024;
          const defaultBase = releaseYearInt >= 2026 ? "http://130.193.166.197/nasstore/EnglishTvSeries1" : "http://154.48.204.98/Flussonic251/EnglishTvSeries1";
          const defaultUrl = `${defaultBase}/${item.releaseDate ? item.releaseDate.substring(0, 4) : '2024'}/${formattedTitle}-S${s}E${e}.mp4`;
          setActivePlayerUrl(defaultUrl);
          triggerToast("No working TV stream variant detected. Using default stream.");
        }
      } catch (err) {
        console.error("TV scanning failed", err);
      } finally {
        setLoadingPlayer(false);
      }
      
      const epKey = `S${seasonNum}E${episodeNum}`;
      if (!watchedMap[epKey]) {
        toggleEpisodeWatched(item.id, seasonNum, episodeNum, totalEpisodesInShow, item);
      }
      return;
    }

    if (activeServer === 'vidking.net') {
      setActivePlayerUrl(`https://www.vidking.net/embed/tv/${item.id}/${seasonNum}/${episodeNum}`);
      // Mark as watched
      const epKey = `S${seasonNum}E${episodeNum}`;
      if (!watchedMap[epKey]) {
        toggleEpisodeWatched(item.id, seasonNum, episodeNum, totalEpisodesInShow, item);
      }
      return;
    }

    let targetImdbId = item.imdbId;

    if (!targetImdbId) {
      setLoadingPlayer(true);
      try {
        const freshDetails = await fetchMediaDetails(item.id, item.type);
        if (freshDetails && freshDetails.imdbId) {
          if (importMediaItem) {
            importMediaItem(freshDetails);
          }
          targetImdbId = freshDetails.imdbId;
        } else {
          triggerToast("IMDb ID not found for this show. Unable to load player.");
          setLoadingPlayer(false);
          return;
        }
      } catch (e) {
        console.warn('Failed to fetch show details for player:', e);
        triggerToast("Error loading player. Please try again.");
        setLoadingPlayer(false);
        return;
      }
      setLoadingPlayer(false);
    }

    if (activeServer === 'yastream') {
      setLoadingPlayer(true);
      const url = await fetchYastreamUrl(targetImdbId, 'show', seasonNum, episodeNum);
      if (url) {
        setActivePlayerUrl(url);
        // Mark as watched
        const epKey = `S${seasonNum}E${episodeNum}`;
        if (!watchedMap[epKey]) {
          toggleEpisodeWatched(item.id, seasonNum, episodeNum, totalEpisodesInShow, item);
        }
      } else {
        triggerToast("No stream found on Yastream.");
      }
      setLoadingPlayer(false);
      return;
    }

    if (activeServer === 'torrentio') {
      setLoadingPlayer(true);
      setTorrentStreams([]);
      try {
        const res = await fetch(`https://torrentio.strem.fun/stream/series/${targetImdbId}:${seasonNum}:${episodeNum}.json`);
        if (!res.ok) throw new Error("Torrentio fetch failed");
        const data = await res.json();
        if (data && data.streams && data.streams.length > 0) {
          const sorted = [...data.streams].sort((a, b) => {
            const parsedA = parseTorrentStream(a);
            const parsedB = parseTorrentStream(b);
            const isBelow2_A = parsedA.sizeInGB < 2.0;
            const isBelow2_B = parsedB.sizeInGB < 2.0;
            if (isBelow2_A && !isBelow2_B) return -1;
            if (!isBelow2_A && isBelow2_B) return 1;
            return parsedB.seeds - parsedA.seeds;
          });
          setTorrentStreams(sorted);
          setActivePlayerUrl('torrentio-menu');
          // Mark as watched
          const epKey = `S${seasonNum}E${episodeNum}`;
          if (!watchedMap[epKey]) {
            toggleEpisodeWatched(item.id, seasonNum, episodeNum, totalEpisodesInShow, item);
          }
        } else {
          triggerToast("No streams found on Torrentio.");
        }
      } catch (e) {
        console.warn('Torrentio error:', e);
        triggerToast("Failed to fetch from Torrentio.");
      }
      setLoadingPlayer(false);
      return;
    }

    if (serverToUse === 'vaplayer.ru') {
      setActivePlayerUrl(`https://vaplayer.ru/embed/tv/${targetImdbId}/S${sStr}E${eStr}`);
      // Mark as watched
      const epKey = `S${seasonNum}E${episodeNum}`;
      if (!watchedMap[epKey]) {
        toggleEpisodeWatched(item.id, seasonNum, episodeNum, totalEpisodesInShow, item);
      }
      return;
    }

    setActivePlayerUrl(`https://${serverToUse}/embed/tv/${targetImdbId}/${seasonNum}-${episodeNum}`);
    // Mark as watched
    const epKey = `S${seasonNum}E${episodeNum}`;
    if (!watchedMap[epKey]) {
      toggleEpisodeWatched(item.id, seasonNum, episodeNum, totalEpisodesInShow, item);
    }
  };

  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);

  // Fetch YouTube video trailer key
  useEffect(() => {
    let active = true;
    const loadTrailerKey = async () => {
      setLoadingTrailer(true);
      setTrailerKey(null);
      setIsPlayingTrailer(false);
      try {
        const key = await fetchMediaVideos(item.id, item.type);
        if (active) {
          setTrailerKey(key);
        }
      } catch (err) {
        console.error('Failed to load trailer key:', err);
      } finally {
        if (active) {
          setLoadingTrailer(false);
        }
      }
    };
    loadTrailerKey();
    return () => {
      active = false;
    };
  }, [item.id, item.type]);

  // Removed body scroll lock to fix severe iOS/iPadOS touch scrolling bugs.
  // The modal is fixed inset-0 and covers the viewport, so background scrolling
  // is naturally hidden, and iOS Safari will no longer steal the touch events.
  useEffect(() => {
    // Clean up in case it was left locked by a previous render
    document.body.style.overflow = '';
  }, []);

  // Dynamically fetch and heal item details from TMDB to correct any local broken paths or descriptions
  useEffect(() => {
    let active = true;
    const healItemDetails = async () => {
      try {
        const freshDetails = await fetchMediaDetails(item.id, item.type);
        if (freshDetails && importMediaItem) {
          importMediaItem(freshDetails);
        }
        
        let targetImdbId = freshDetails?.imdbId || item.imdbId;
        if (targetImdbId) {
          try {
            const res = await fetch(`/api/imdb-rating?imdbId=${targetImdbId}`);
            if (res.ok) {
              const data = await res.json();
              if (active && data.rating) {
                setImdbInfo({ rating: data.rating, votes: data.votes });
              }
            }
          } catch (e) {
            console.warn('Failed to fetch IMDb rating:', e);
          }
        }
      } catch (e) {
        console.warn('Failed to heal item details from TMDB', e);
      }
    };
    healItemDetails();
    return () => {
      active = false;
    };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.type]);

  // Load reviews from TMDB & Trakt
  useEffect(() => {
    let active = true;
    const fetchReviews = async () => {
      setLoadingReviews(true);
      try {
        const tmdbFetched = await fetchMediaReviews(item.id, item.type);
        let mixedReviews = [...tmdbFetched];
        
        let tId = null;
        try {
          tId = await fetchTraktId(item.id, item.type);
          if (active) {
            setTraktId(tId);
          }
        } catch (e) {
          console.warn('Failed to fetch Trakt ID', e);
        }
        
        if (tId) {
          try {
            const traktFetched = await fetchTraktComments(tId, item.type);
            mixedReviews = [...mixedReviews, ...traktFetched];
          } catch (traktErr) {
            console.warn('Failed to fetch Trakt reviews:', traktErr);
          }
        }
        
        // Sort mixed reviews by date descending
        mixedReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        if (active) {
          setReviews(mixedReviews);
        }
      } catch (err) {
        console.warn('Failed to fetch reviews:', err);
      } finally {
        if (active) {
          setLoadingReviews(false);
        }
      }
    };
    fetchReviews();
    return () => {
      active = false;
    };
  }, [item.id, item.type]);

  useEffect(() => {
    let active = true;
    const loadImdbReviews = async () => {
      if (activeReviewTab !== 'imdb' || imdbReviews.length > 0) return;
      
      let targetImdbId = item.imdbId;
      if (!targetImdbId) {
        try {
          const freshDetails = await fetchMediaDetails(item.id, item.type);
          if (freshDetails && freshDetails.imdbId) {
            targetImdbId = freshDetails.imdbId;
          } else {
            return;
          }
        } catch (e) {
          console.warn('Failed to fetch details for IMDb reviews', e);
          return;
        }
      }

      setLoadingImdbReviews(true);
      try {
        const res = await fetch(`/api/imdb-reviews?imdbId=${targetImdbId}`);
        if (!res.ok) throw new Error("Failed to fetch IMDb reviews");
        const data = await res.json();
        
        if (active) {
          setImdbReviews(data.reviews || []);
        }
      } catch (err) {
        console.warn('Failed to load IMDb reviews:', err);
      } finally {
        if (active) {
          setLoadingImdbReviews(false);
        }
      }
    };
    loadImdbReviews();
    return () => {
      active = false;
    };
  }, [activeReviewTab, item.imdbId, imdbReviews.length]);


  const handleOpenEpisodeComments = async (seasonNum: number, episodeNum: number, epTitle: string, epOverview: string) => {
    const epKey = `S${seasonNum}E${episodeNum}`;
    setSelectedEpisodeForComments({
      seasonNum,
      episodeNum,
      title: epTitle,
      overview: epOverview
    });
    
    // If we haven't fetched comments for this episode yet, fetch them!
    if (!episodeComments[epKey]) {
      setLoadingEpisodeComments(prev => ({ ...prev, [epKey]: true }));
      try {
        let currentTraktId = traktId;
        if (!currentTraktId) {
          currentTraktId = await fetchTraktId(item.id, item.type);
          if (currentTraktId) {
            setTraktId(currentTraktId);
          }
        }
        
        let allComments: TMDBReview[] = [];

        // 1. Fetch Trakt Comments
        if (currentTraktId) {
          try {
            const traktComms = await fetchTraktComments(currentTraktId, item.type, { season: seasonNum, episode: episodeNum });
            allComments = [...allComments, ...traktComms];
          } catch (e) {
            console.warn('Failed to fetch trakt episode comments', e);
          }
        }

        // 2. Fetch IMDb Comments for Episode
        try {
          const episodeImdbId = await fetchEpisodeImdbId(item.id, seasonNum, episodeNum);
          if (episodeImdbId) {
            const res = await fetch(`/api/imdb-reviews?imdbId=${episodeImdbId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.reviews) {
                allComments = [...allComments, ...data.reviews];
              }
            }
          }
        } catch (e) {
          console.warn('Failed to fetch IMDb episode comments', e);
        }

        allComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setEpisodeComments(prev => ({ ...prev, [epKey]: allComments }));

      } catch (err) {
        console.warn(`Failed to fetch comments for episode ${epKey}:`, err);
        setEpisodeComments(prev => ({ ...prev, [epKey]: [] }));
      } finally {
        setLoadingEpisodeComments(prev => ({ ...prev, [epKey]: false }));
      }
    }
  };

  // Load Seasons and Episodes for TV Shows
  useEffect(() => {
    if (item.type !== 'show') return;

    const targetSeasonsCount = item.seasonsCount || 1;

    // Use cached seasons immediately if we have already fetched them to prevent flickering and infinite API requests
    if (item.seasons && item.seasons.length > 0) {
      // Check if any episode is missing a rating (undefined or 0), and heal it in-place
      const needsHealing = item.seasons.some(s => s.episodes.some(e => !e.voteAverage || e.voteAverage === 0));
      if (needsHealing) {
        const healedSeasons = item.seasons.map(s => ({
          ...s,
          episodes: s.episodes.map(e => ({
            ...e,
            voteAverage: e.voteAverage && e.voteAverage > 0
              ? e.voteAverage
              : getPredefinedEpisodeRating(item.id, s.seasonNumber, e.episode)
          }))
        }));
        setSeasons(healedSeasons);
        if (importMediaItem) {
          importMediaItem({ ...item, seasons: healedSeasons });
        }
        return;
      }
      setSeasons(item.seasons);
      return;
    }

    const loadSeasons = async () => {
      setLoadingSeasons(true);
      try {
        // Try fetching from TMDB first for the richest experience
        let currentSeasonsCount = item.seasonsCount;
        if (!currentSeasonsCount) {
          try {
            const details = await fetchMediaDetails(item.id, 'show');
            currentSeasonsCount = details.seasonsCount;
            if (importMediaItem) {
              importMediaItem(details); // update state with full details
            }
          } catch (e) {
            console.warn('Failed to fetch media details for seasons count', e);
          }
        }
        const fetchedSeasons = await fetchShowSeasons(item.id, currentSeasonsCount || 1);
        if (fetchedSeasons && fetchedSeasons.length > 0) {
          const healedSeasons = fetchedSeasons.map(s => ({
            ...s,
            episodes: s.episodes.map(e => ({
              ...e,
              voteAverage: e.voteAverage && e.voteAverage > 0
                ? e.voteAverage
                : getPredefinedEpisodeRating(item.id, s.seasonNumber, e.episode)
            }))
          }));
          setSeasons(healedSeasons);
          if (importMediaItem) {
            importMediaItem({ ...item, seasons: healedSeasons });
          }
          return;
        }
        
        // Fallback to local predefined seasons if TMDB is empty
        const localSeasons = getPredefinedSeasons(item.id);
        if (localSeasons && localSeasons.length > 0) {
          const healedSeasons = localSeasons.map(s => ({
            ...s,
            episodes: s.episodes.map(e => ({
              ...e,
              voteAverage: e.voteAverage && e.voteAverage > 0
                ? e.voteAverage
                : getPredefinedEpisodeRating(item.id, s.seasonNumber, e.episode)
            }))
          }));
          setSeasons(healedSeasons);
          if (importMediaItem) {
            importMediaItem({ ...item, seasons: healedSeasons });
          }
          return;
        }
      } catch (error) {
        console.error('Failed to load seasons from TMDB, using fallback', error);
        
        // Fallback to local predefined seasons
        const localSeasons = getPredefinedSeasons(item.id);
        if (localSeasons && localSeasons.length > 0) {
          const healedSeasons = localSeasons.map(s => ({
            ...s,
            episodes: s.episodes.map(e => ({
              ...e,
              voteAverage: e.voteAverage && e.voteAverage > 0
                ? e.voteAverage
                : getPredefinedEpisodeRating(item.id, s.seasonNumber, e.episode)
            }))
          }));
          setSeasons(healedSeasons);
          if (importMediaItem) {
            importMediaItem({ ...item, seasons: healedSeasons });
          }
        } else {
          // General fallback mock seasons generator
          const fallback: Season[] = [];
          for (let s = 1; s <= (item.seasonsCount || 2); s++) {
            const episodes: Episode[] = [];
            for (let e = 1; e <= 8; e++) {
              episodes.push({
                id: item.id * 1000 + s * 100 + e,
                season: s,
                episode: e,
                title: `Episode ${e}`,
                airDate: `2026-06-${10 + e}`,
                overview: `Plot summary for season ${s} episode ${e}.`,
                watched: false,
                voteAverage: Number((7.0 + ((item.id + s * 3 + e * 7) % 25) / 10).toFixed(1)),
              });
            }
            fallback.push({
              id: item.id * 1000 + s,
              seasonNumber: s,
              name: `Season ${s}`,
              episodes,
            });
          }
          setSeasons(fallback);
          if (importMediaItem) {
            importMediaItem({ ...item, seasons: fallback });
          }
        }
      } finally {
        setLoadingSeasons(false);
      }
    };

    loadSeasons();
  }, [item.id, item.type, item.seasonsCount, item.seasons, importMediaItem]);

  // Compute total episodes for TV Shows dynamically
  const totalEpisodesInShow = seasons.reduce((acc, s) => acc + s.episodes.length, 0);

  const currentDateStr = new Date().toISOString().split('T')[0];
  let releasedEpisodesCount = seasons.reduce((acc, s) => {
    return acc + s.episodes.filter(ep => !ep.airDate || ep.airDate <= currentDateStr).length;
  }, 0);
  if (releasedEpisodesCount === 0 && totalEpisodesInShow > 0) {
    releasedEpisodesCount = totalEpisodesInShow;
  }

  // Check how many are watched
  const watchedCount = Object.keys(watchedMap).length;
  
  // Rating hover and selection states
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const isFlussonicStream = activePlayerUrl && (
    activePlayerUrl.includes('Flussonic') || 
    activePlayerUrl.includes('130.193') || 
    activePlayerUrl.includes('154.48') || 
    activePlayerUrl.includes('/sss/')
  );
  const showFlussonicDiagnostics = flussonicScanning || isFlussonicStream;

  const handleRatingClick = (stars: number) => {
    const nextRating = item.userRating === stars ? null : stars;
    setRating(item.id, item.type, nextRating, item);
    triggerToast(nextRating ? `Rated ${nextRating} Stars` : 'Rating Cleared');
  };

  // Auto-scroll to player area when active player URL, loading state, or episode changes
  useEffect(() => {
    if (activePlayerUrl || loadingPlayer || activePlayingEpisode) {
      scrollToPlayerArea();
    }
  }, [activePlayerUrl, loadingPlayer, activePlayingEpisode]);

  return (
    <div 
      id="detail-modal"
      onClick={onClose}
      className="fixed inset-0 bg-black/95 sm:bg-black/75 sm:backdrop-blur-sm z-50 flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden p-0 sm:p-6 no-scrollbar overscroll-none"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-[#0A0A0A] border border-amber-500 text-amber-500 text-sm font-semibold rounded-xl shadow-2xl shadow-black flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{showToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container optimized for tablet/desktop and mobile screens */}
      <div 
        id="detail-modal-scroll-container"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full min-h-[100dvh] sm:min-h-0 sm:h-auto max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl bg-[#050505] flex flex-col border-x border-white/5 sm:border sm:border-white/10 sm:rounded-2xl sm:shadow-2xl mx-auto sm:my-auto"
      >
        
        {/* HERO BANNER COVER HEADER */}
        <div className={`relative w-full shrink-0 bg-black transition-all duration-300 ${
          activePlayerUrl 
            ? (confirmedPlayInBrowser || activePlayerUrl === 'torrentio-menu'
                ? 'h-[240px] sm:h-[350px] md:h-[450px] lg:h-[500px]' 
                : 'h-auto min-h-[500px] lg:min-h-[600px]')
            : 'h-72 md:h-96'
        }`}>
          {activePlayerUrl ? (
            <div className={`${
              confirmedPlayInBrowser || activePlayerUrl === 'torrentio-menu'
                ? 'absolute inset-0 w-full h-full'
                : 'relative w-full h-full min-h-[500px] lg:min-h-[600px] flex flex-col'
            } bg-black z-10 animate-fade-in`}>
              {activePlayerUrl === 'torrentio-menu' ? (
                <div className="w-full h-full flex flex-col bg-zinc-950 overflow-hidden relative">
                  
                  {/* BEAUTIFUL COMPACT STICKY HEADER */}
                  <div className="shrink-0 bg-zinc-900/90 backdrop-blur-md border-b border-white/10 py-3 px-4 sm:px-6 flex items-center justify-between z-30">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActivePlayerUrl(null)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="Back to Details"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          Torrentio Streams
                        </h3>
                        <p className="text-[10px] sm:text-xs text-zinc-400 font-medium line-clamp-1">
                          {activeStreamTitle || (item.title || 'Movie/Show')}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setActivePlayerUrl(null)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Back to Info
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar space-y-4">
                    
                    {/* ENHANCED EXPANDABLE TORRSERVE CONFIG CARD */}
                    <div className="bg-zinc-900/60 border border-white/5 rounded-xl overflow-hidden transition-all duration-300">
                      <button
                        onClick={() => setIsTorrServeExpanded(!isTorrServeExpanded)}
                        className="w-full px-4 py-3 bg-zinc-900/80 hover:bg-zinc-900 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg border ${torrServeIp ? 'bg-amber-500/10 border-amber-500/25 text-amber-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white uppercase tracking-wider">
                              Android TorrServe Local Playback
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {torrServeIp ? `Connected IP: ${torrServeIp}` : 'Configure local streaming client (optional)'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {torrServeIp && (
                            <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-extrabold uppercase rounded border border-emerald-500/25">
                              Ready
                            </span>
                          )}
                          <div className={`text-zinc-400 transition-transform duration-300 ${isTorrServeExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isTorrServeExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="border-t border-white/5"
                          >
                            <div className="p-4 bg-zinc-950/40 space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                                  Android TorrServe Server Address
                                </label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                                      <Wifi className="w-4 h-4" />
                                    </div>
                                    <input 
                                      type="text" 
                                      value={torrServeIp}
                                      onChange={(e) => {
                                        setTorrServeIp(e.target.value);
                                        localStorage.setItem('tracker_torrserve_ip', e.target.value);
                                      }}
                                      placeholder="e.g. 192.168.1.100:8090"
                                      className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none placeholder:text-zinc-600"
                                    />
                                  </div>
                                  {torrServeIp && (
                                    <a 
                                      href={`http://${torrServeIp.includes(':') ? torrServeIp : torrServeIp + ':8090'}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-500 hover:text-amber-400 border border-white/10 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                                    >
                                      <Globe className="w-3 h-3" />
                                      <span>Test</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-zinc-400 leading-normal">
                                Start the <strong>TorrServe Matrix</strong> app on your Android device/TV and enter its local IP address here. Keep both devices connected to the same Wi-Fi network for instant casting.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* LIVE SEARCH AND QUALITY FILTER BAR */}
                    <div className="flex flex-col gap-2.5 pb-1">
                      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                        {/* Search Bar */}
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                            <Search className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="text"
                            value={torrentSearchQuery}
                            onChange={(e) => setTorrentSearchQuery(e.target.value)}
                            placeholder="Search streams (e.g. 1080p, HEVC, size, group)..."
                            className="w-full bg-zinc-900/80 border border-white/5 rounded-lg pl-9 pr-8 py-2 text-xs text-white focus:border-amber-500/40 focus:outline-none placeholder:text-zinc-500"
                          />
                          {torrentSearchQuery && (
                            <button
                              onClick={() => setTorrentSearchQuery('')}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Filter Badges */}
                        <div className="flex flex-wrap gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                          {[
                            { key: 'all', label: 'All Streams' },
                            { key: '4k', label: '4K UHD' },
                            { key: '1080p', label: '1080P' },
                            { key: '720p', label: '720P' },
                            { key: 'cached', label: 'RD+ Cached' },
                          ].map((filter) => {
                            const isSelected = torrentQualityFilter === filter.key;
                            return (
                              <button
                                key={filter.key}
                                onClick={() => setTorrentQualityFilter(filter.key as any)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                                  isSelected
                                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10 scale-105'
                                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/5'
                                }`}
                              >
                                {filter.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Series-specific Filter Buttons */}
                      {item.type === 'show' && (
                        <div className="flex flex-wrap gap-1.5 overflow-x-auto no-scrollbar py-1 border-t border-white/5 mt-1.5 pt-2">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider self-center mr-1.5">Show Pack Filter:</span>
                          {[
                            { key: 'all', label: 'All Torrents' },
                            { key: 'single', label: 'Single Episode Only (Recommended for Seedr)' },
                            { key: 'packs', label: 'Season Packs Only' },
                          ].map((filter) => {
                            const isSelected = torrentEpisodeFilter === filter.key;
                            return (
                              <button
                                key={filter.key}
                                onClick={() => setTorrentEpisodeFilter(filter.key as any)}
                                className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border ${
                                  isSelected
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/5 scale-[1.02]'
                                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-white/5'
                                }`}
                              >
                                {filter.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* TORRENT STREAM ITEMS GRID */}
                    <div className="space-y-3 pb-12">
                      {(() => {
                        const filtered = torrentStreams.filter(stream => {
                          const parsed = parseTorrentStream(stream);
                          
                          // Quality filter
                          if (torrentQualityFilter === '4k') {
                            if (parsed.resolution !== '4K UHD') return false;
                          } else if (torrentQualityFilter === '1080p') {
                            if (parsed.resolution !== '1080P') return false;
                          } else if (torrentQualityFilter === '720p') {
                            if (parsed.resolution !== '720P') return false;
                          } else if (torrentQualityFilter === 'cached') {
                            if (!parsed.isCached) return false;
                          }

                          // Series episode vs pack filter
                          if (item.type === 'show') {
                            if (torrentEpisodeFilter === 'single') {
                              if (!parsed.isSingleEpisode) return false;
                            } else if (torrentEpisodeFilter === 'packs') {
                              if (!parsed.isSeasonPack) return false;
                            }
                          }

                          // Search query filter
                          if (torrentSearchQuery.trim()) {
                            const query = torrentSearchQuery.toLowerCase();
                            const matchesName = (stream.name || '').toLowerCase().includes(query);
                            const matchesTitle = (stream.title || '').toLowerCase().includes(query);
                            const matchesFile = parsed.fileName.toLowerCase().includes(query);
                            if (!matchesName && !matchesTitle && !matchesFile) return false;
                          }

                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-12 text-center bg-zinc-900/30 border border-dashed border-white/10 rounded-xl space-y-2">
                              <Ban className="w-8 h-8 text-zinc-600 mx-auto" />
                              <p className="text-xs font-semibold text-zinc-400">No matching streams found</p>
                              <p className="text-[10px] text-zinc-500">Try clearing your search query or filters.</p>
                            </div>
                          );
                        }

                        return filtered.map((stream, idx) => {
                          const parsed = parseTorrentStream(stream);
                          
                          const trackers = [
                            'udp://tracker.opentrackr.org:1337/announce',
                            'udp://open.demonii.com:1337/announce',
                            'udp://open.stealth.si:80/announce',
                            'udp://tracker.torrent.eu.org:451/announce',
                            'udp://tracker.moeking.me:6969/announce',
                            'udp://exodus.desync.com:6969/announce',
                            'udp://tracker.cyberia.is:6969/announce'
                          ].map(t => `&tr=${encodeURIComponent(t)}`).join('');
                          
                          // Also append any sources from Torrentio if available, max 20 to avoid URL size limits
                          let torrentioSources = '';
                          if (stream.sources && Array.isArray(stream.sources)) {
                             // Limit to 20 sources to prevent 413 Payload Too Large from Seedr
                             torrentioSources = stream.sources.slice(0, 20).map((s: string) => `&tr=${encodeURIComponent(s)}`).join('');
                          }
                          
                          const magnetUrl = `magnet:?xt=urn:btih:${stream.infoHash}${trackers}${torrentioSources}`;
                          const webtorUrl = `https://webtor.io/show?magnet=${encodeURIComponent(magnetUrl)}`;
                          
                          let ip = torrServeIp.trim();
                          if (ip && !ip.includes(':')) {
                            ip += ':8090';
                          }
                          
                          let filename = 'video.mkv';
                          if (stream.behaviorHints && stream.behaviorHints.filename) {
                            filename = stream.behaviorHints.filename;
                          } else if (stream.title) {
                            filename = stream.title.split('\n')[0].replace(/[^a-zA-Z0-9 .\-_]/g, '').trim() + '.mkv';
                          }
                          
                          const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
                          const torrServeStreamUrl = `http://${ip}/stream/${encodeURIComponent(filename)}?link=${stream.infoHash}&index=${fileIdx}&play`;
                          const outplayerUrl = `outplayer://${torrServeStreamUrl}`;

                          return (
                            <div 
                              key={idx} 
                              className="group bg-zinc-900 hover:bg-zinc-900/85 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200 flex flex-col gap-4 relative overflow-hidden"
                            >
                              {/* Glowing Accent for Cached Streams */}
                              {parsed.isCached && (
                                <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-600" />
                              )}

                              {/* Top row layout (replaces previous flat flex row) */}
                              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">
                                <div className="w-full lg:w-3/5 space-y-1.5">
                                  {/* Badges top row */}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {/* Quality resolution badge */}
                                    <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded tracking-wider border ${
                                      parsed.resolution === '4K UHD' 
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 shadow-sm shadow-amber-500/5' 
                                        : parsed.resolution === '1080P' 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                                        : 'bg-zinc-800 text-zinc-300 border-zinc-700/50'
                                    }`}>
                                      {parsed.resolution}
                                    </span>

                                    {/* Debrid Cached badge */}
                                    {parsed.isCached ? (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider rounded border border-emerald-500/25">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                        {parsed.debridProvider || 'Cached'}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-zinc-800/80 text-zinc-400 text-[9px] font-bold uppercase rounded border border-zinc-700/30">
                                        P2P Torrent
                                      </span>
                                    )}

                                    {/* Show Torrent Type Badge */}
                                    {item.type === 'show' && (
                                      parsed.isSingleEpisode ? (
                                        <span className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 text-[8px] font-extrabold uppercase rounded border border-sky-500/25">
                                          Single Episode
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 bg-fuchsia-500/10 text-fuchsia-400 text-[8px] font-extrabold uppercase rounded border border-fuchsia-500/25">
                                          Season Pack
                                        </span>
                                      )
                                    )}

                                    {/* Other parsed format pills */}
                                    {parsed.isHDR && (
                                      <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-extrabold uppercase rounded border border-indigo-500/25">
                                        HDR
                                      </span>
                                    )}
                                    {parsed.isHEVC && (
                                      <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[8px] font-extrabold uppercase rounded border border-purple-500/25">
                                        H.265
                                      </span>
                                    )}
                                    {parsed.isMultiAudio && (
                                      <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[8px] font-bold uppercase rounded">
                                        Multi-Audio
                                      </span>
                                    )}
                                  </div>

                                  {/* Filename display */}
                                  <div className="text-xs sm:text-sm font-bold text-white leading-snug break-words tracking-tight group-hover:text-amber-500 transition-colors">
                                    {parsed.fileName}
                                  </div>

                                  {/* Stats row */}
                                  <div className="flex flex-wrap items-center gap-3">
                                    {/* Seeders */}
                                    <div className="flex items-center gap-1 text-[10px] text-amber-500 font-extrabold" title={`${parsed.seeds} Active Seeders`}>
                                      <Flame className="w-3.5 h-3.5 fill-amber-500/20" />
                                      <span>{parsed.seeds} seeds</span>
                                    </div>

                                    {/* File Size */}
                                    {parsed.sizeInGB > 0 && (
                                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-bold">
                                        <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                                        <span>{parsed.sizeInGB.toFixed(2)} GB</span>
                                      </div>
                                    )}

                                    {/* Subtitle / Source info */}
                                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
                                      <Info className="w-3 h-3 text-zinc-600" />
                                      <span className="truncate max-w-[150px] sm:max-w-[200px]">
                                        {stream.name ? stream.name.replace(/\n/g, ' • ') : 'Stream info'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions layout */}
                                <div className="flex flex-row flex-wrap items-center gap-2 w-full lg:w-auto shrink-0 justify-end">
                                  {/* Seeder Cloud service button */}
                                  <button
                                    onClick={() => {
                                      const isCurrentlyExpanded = !!seedrStatusMap[idx];
                                      if (!isCurrentlyExpanded) {
                                        checkSeedrStatus(idx, stream.infoHash, parsed.fileName);
                                      } else {
                                        setSeedrStatusMap(prev => {
                                          const copy = { ...prev };
                                          delete copy[idx];
                                          return copy;
                                        });
                                      }
                                    }}
                                    className={`flex-1 sm:flex-none text-center px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all border flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-95 ${
                                      seedrStatusMap[idx]
                                        ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-md shadow-amber-500/10'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/5'
                                    }`}
                                    title="Manage and stream from Seedr cloud"
                                  >
                                    <Cloud className="w-3 h-3 text-current" />
                                    <span>Seedr</span>
                                  </button>

                                  {ip && (
                                    <>
                                      {/* Play PC */}
                                      <button
                                        onClick={() => playInVlcPC(torrServeStreamUrl, `${item.title || 'Torrent'} - ${stream.name || 'Stream'}`)}
                                        className="flex-1 sm:flex-none text-center px-3 py-2 bg-orange-700 hover:bg-orange-600 text-white text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all shadow-md shadow-orange-700/10 cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.03] active:scale-95"
                                        title="Play directly in VLC on PC / Android"
                                      >
                                        <Play className="w-3 h-3 fill-white" />
                                        <span>VLC (PC)</span>
                                      </button>

                                      {/* Play iPad */}
                                      <a
                                        onClick={() => recordWatchHistory('outplayer', torrServeStreamUrl)} href={outplayerUrl}
                                        className="flex-1 sm:flex-none text-center px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all border border-white/5 flex items-center justify-center gap-1"
                                        title="Play in Outplayer on iPad / iOS"
                                      >
                                        <Smartphone className="w-3 h-3 text-zinc-400" />
                                        <span>iPad</span>
                                      </a>

                                      {/* Copy URL */}
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(torrServeStreamUrl);
                                          setCopiedStreamIdx(idx);
                                          setTimeout(() => setCopiedStreamIdx(null), 2000);
                                          triggerToast("Stream URL copied! Paste it in your favorite media player.");
                                        }}
                                        className="flex-1 sm:flex-none text-center px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-all border border-white/5 flex items-center justify-center gap-1"
                                        title="Copy direct streaming link"
                                      >
                                        {copiedStreamIdx === idx ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-400" />
                                            <span className="text-emerald-400">Copied!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3 text-zinc-400" />
                                            <span>Copy</span>
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}

                                  {/* WebTor Playback */}
                                  <button
                                    onClick={() => {
                                      recordWatchHistory('browser', webtorUrl);
                                      setActivePlayerUrl(`webtor://${encodeURIComponent(magnetUrl)}`);
                                      setConfirmedPlayInBrowser(true);
                                      setLoadingPlayer(false);
                                      setTimeout(() => {
                                        scrollToPlayerArea();
                                      }, 100);
                                    }}
                                    className="flex-1 sm:flex-none text-center px-3 py-2 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    title="Play directly inside this app using the integrated Webtor player"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Play in App</span>
                                  </button>

                                  <a
                                    href={webtorUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 sm:flex-none text-center px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-all border border-white/5 flex items-center justify-center gap-1"
                                    title="Play in a new tab via WebTor cloud player"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>WebPlayer</span>
                                  </a>

                                  {/* Magnet link */}
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(magnetUrl);
                                      triggerToast("Magnet link copied to clipboard!");
                                    }}
                                    className="flex-1 sm:flex-none text-center px-3 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/20 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    title="Copy raw magnet link to clipboard"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Magnet</span>
                                  </button>
                                </div>
                              </div>

                              {/* SEEDR EXPANDED PANEL */}
                              {seedrStatusMap[idx] && (
                                <div className="w-full mt-2 pt-4 border-t border-white/5 bg-zinc-950/40 rounded-lg p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold">
                                      <Cloud className="w-4 h-4 text-amber-500 animate-pulse" />
                                      <span>Seedr Cloud Streaming</span>
                                    </div>
                                    <button 
                                      onClick={() => checkSeedrStatus(idx, stream.infoHash, parsed.fileName)}
                                      className="p-1 hover:bg-zinc-800 rounded transition cursor-pointer"
                                      title="Refresh Status"
                                      disabled={seedrStatusMap[idx].loading}
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 hover:text-white ${seedrStatusMap[idx].loading ? 'animate-spin' : ''}`} />
                                    </button>
                                  </div>

                                  {seedrStatusMap[idx].loading ? (
                                    <div className="flex items-center justify-center py-4 gap-2 text-xs text-zinc-400">
                                      <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                                      <span>Checking Seedr account status...</span>
                                    </div>
                                  ) : seedrStatusMap[idx].status === 'not_added' ? (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-lg border border-dashed border-white/5">
                                      <div className="text-xs text-zinc-400 flex-1 pr-2">
                                        <p className="font-medium text-zinc-300">Not cached in Seedr</p>
                                        <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                                          {item.type === 'show' && parsed.isSeasonPack ? (
                                            <span className="text-amber-400 font-semibold block bg-amber-500/5 border border-amber-500/10 p-2 rounded-md mt-1">
                                              ⚠️ Warning: This is a Season Pack ({parsed.sizeInGB.toFixed(2)} GB). Seedr must transfer the entire pack (all episodes), which will likely exceed free account limits (2GB). We recommend filtering for a "Single Episode Only" torrent below!
                                            </span>
                                          ) : (
                                            "Click to transfer this torrent to Seedr. Old files will be deleted to free up space."
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => addSeedrStream(idx, stream.infoHash, parsed.fileName, `magnet:?xt=urn:btih:${stream.infoHash}`)}
                                        className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer shrink-0"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Send to Seedr</span>
                                      </button>
                                    </div>
                                  ) : seedrStatusMap[idx].status === 'downloading' ? (
                                    <div className="space-y-2 bg-zinc-900/40 p-3 rounded-lg border border-dashed border-white/5">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                          Seedr fetching/downloading...
                                        </span>
                                        <span className="text-zinc-400 font-bold">{seedrStatusMap[idx].progress || 0}%</span>
                                      </div>
                                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-300" 
                                          style={{ width: `${seedrStatusMap[idx].progress || 0}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <p className="text-[10px] text-zinc-500">Seedr is caching the stream. Check back in a few moments!</p>
                                        <button 
                                          onClick={() => checkSeedrStatus(idx, stream.infoHash, parsed.fileName)}
                                          className="text-[10px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                                        >
                                          <RefreshCw className="w-2.5 h-2.5" />
                                          Check progress
                                        </button>
                                      </div>
                                    </div>
                                  ) : seedrStatusMap[idx].status === 'ready' && seedrStatusMap[idx].files && seedrStatusMap[idx].files!.length > 0 ? (
                                    <div className="space-y-2.5">
                                      <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Ready to stream:</span>
                                      </p>
                                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                        {seedrStatusMap[idx].files!.map((file, fileIdx) => {
                                          // Outplayer accepts direct URL or schema: outplayer://[URL without http(s)]
                                          const directUrl = file.streamUrl || '';
                                          const outplayerLink = `outplayer://${directUrl.replace(/^https?:\/\//, '')}`;
                                          const vlcLink = `vlc://${directUrl.replace(/^https?:\/\//, '')}`;
                                          const infuseLink = `infuse://x-callback-url/play?url=${encodeURIComponent(directUrl)}`;

                                          return (
                                            <div key={fileIdx} className="bg-zinc-900/80 p-3 rounded-lg border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                              <div className="space-y-1 max-w-[280px] sm:max-w-[350px]">
                                                <p className="text-xs font-semibold text-white truncate" title={file.name}>{file.name}</p>
                                                <p className="text-[10px] text-zinc-500">{(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
                                              </div>
                                              
                                              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto shrink-0 justify-end">
                                                {/* Play inside App */}
                                                <button
                                                  onClick={() => {
                                                    recordWatchHistory('browser', directUrl);
                                                    setActivePlayerUrl(directUrl);
                                                    setConfirmedPlayInBrowser(true);
                                                    setLoadingPlayer(false);
                                                    setTimeout(() => {
                                                      scrollToPlayerArea();
                                                    }, 100);
                                                  }}
                                                  className="flex-1 sm:flex-none text-center px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                  title="Play directly inside this app"
                                                >
                                                  <Play className="w-2.5 h-2.5 fill-black text-black" />
                                                  <span>Play in App</span>
                                                </button>

                                                {/* VLC Link */}
                                                <a
                                                  href={vlcLink}
                                                  onClick={() => recordWatchHistory('vlc', directUrl)}
                                                  className="flex-1 sm:flex-none text-center px-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1"
                                                  title="Open in VLC on iPad / iOS"
                                                >
                                                  <span>VLC</span>
                                                </a>

                                                {/* Outplayer Link */}
                                                <a
                                                  href={outplayerLink}
                                                  onClick={() => recordWatchHistory('outplayer', directUrl)}
                                                  className="flex-1 sm:flex-none text-center px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1"
                                                  title="Open in Outplayer on iPad / iOS"
                                                >
                                                  <Smartphone className="w-3 h-3 text-zinc-400" />
                                                  <span>Outplayer</span>
                                                </a>

                                                {/* Infuse Link */}
                                                <a
                                                  href={infuseLink}
                                                  onClick={() => recordWatchHistory('infuse', directUrl)}
                                                  className="flex-1 sm:flex-none text-center px-2.5 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1"
                                                  title="Open in Infuse on iPad / iOS"
                                                >
                                                  <span>Infuse</span>
                                                </a>

                                                {/* Copy link */}
                                                <button
                                                  onClick={() => {
                                                    navigator.clipboard.writeText(directUrl);
                                                    setCopiedSeedrFileId(file.id);
                                                    setTimeout(() => setCopiedSeedrFileId(null), 2000);
                                                    triggerToast("Seedr stream link copied!");
                                                  }}
                                                  className="flex-1 sm:flex-none text-center px-2.5 py-1.5 bg-zinc-850 hover:bg-zinc-750 text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                >
                                                  {copiedSeedrFileId === file.id ? (
                                                    <>
                                                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                                                      <span className="text-emerald-400">Copied!</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy className="w-2.5 h-2.5 text-zinc-400" />
                                                      <span>Copy Link</span>
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : seedrStatusMap[idx].status === 'error' ? (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-900/20 p-3 rounded-lg border border-dashed border-red-500/30">
                                      <div className="text-xs text-red-400">
                                        <p className="font-medium">Error adding stream</p>
                                        <p className="text-[10px] text-red-500/80 mt-0.5">{seedrStatusMap[idx].message || "Failed to communicate with Seedr."}</p>
                                      </div>
                                      <button
                                        onClick={() => addSeedrStream(idx, stream.infoHash, parsed.fileName, `magnet:?xt=urn:btih:${stream.infoHash}`)}
                                        className="w-full sm:w-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>Retry</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-zinc-500 py-3 text-center bg-zinc-900/20 rounded border border-dashed border-white/5">
                                      No video files found in this Seedr directory.
                                    </div>
                                  )}
                                </div>
                              )}

                            </div>
                          );
                        });
                      })()}
                    </div>

                  </div>
                </div>
              ) : !confirmedPlayInBrowser ? (
                <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-zinc-950/95 p-4 sm:p-6 md:p-8 text-center animate-fade-in relative z-10 overflow-y-auto no-scrollbar">
                  <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col transition-all duration-300">
                    
                    <div className="flex flex-col items-center text-center mb-6 border-b border-white/5 pb-4 w-full">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-3 border border-amber-500/20">
                        <Play className="w-5 h-5 fill-amber-500 text-amber-500" />
                      </div>
                      
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {activeStreamTitle || item.title}
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
                        {activePlayerUrl && isFlussonicStream ? (
                          <span className="flex items-center justify-center gap-1.5 text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Flussonic High-Speed Stream Verified
                          </span>
                        ) : "Preparing your stream link..."}
                      </p>
                    </div>

                    {flussonicScanning ? (
                      <div className="w-full py-6 flex flex-col items-center justify-center gap-4 animate-fade-in">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full" />
                          <div className="absolute inset-0 border-4 border-t-amber-500 rounded-full animate-spin" />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-xs font-bold text-amber-500 uppercase tracking-widest animate-pulse">
                            Scanning Server Channels
                          </span>
                          <span className="text-[10px] text-zinc-500 max-w-[250px] truncate">
                            {flussonicScanProgress}
                          </span>
                        </div>
                        
                        {/* Progress Meter Bar */}
                        <div className="w-full max-w-[200px] bg-zinc-950 rounded-full h-1 overflow-hidden mt-1">
                          <div 
                            className="bg-amber-500 h-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(
                                100, 
                                Math.max(5, (flussonicCheckedUrls.filter(u => u.status !== 'checking').length / (flussonicCheckedUrls.length || 1)) * 100)
                              )}%` 
                            }}
                          />
                        </div>
                        
                        {/* Compact candidate scroll log for diagnostics */}
                        <details className="w-full mt-2 group">
                          <summary className="list-none flex items-center justify-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-500 uppercase tracking-wider cursor-pointer select-none">
                            <span>Scan Details</span>
                            <span className="transition-transform group-open:rotate-180">▼</span>
                          </summary>
                          <div className="mt-2 text-left bg-zinc-950 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto no-scrollbar space-y-1 text-[8px] font-mono">
                            {flussonicCheckedUrls.map((candidate, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                <span className="text-zinc-500 truncate max-w-[70%]" title={candidate.url}>
                                  {candidate.label}
                                </span>
                                {candidate.status === 'checking' && (
                                  <span className="text-zinc-600 animate-pulse">waiting</span>
                                )}
                                {candidate.status === 'ok' && (
                                  <span className="text-emerald-500 font-bold shrink-0">FOUND</span>
                                )}
                                {candidate.status === 'failed' && (
                                  <span className="text-zinc-700 shrink-0">404</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 w-full">
                        {/* External Players for direct streams */}
                        {(() => {
                          const urlLower = (activePlayerUrl || '').toLowerCase();
                          const isDirect = urlLower.endsWith('.mp4') || 
                                           urlLower.includes('.mp4?') ||
                                           urlLower.includes('.m3u8') ||
                                           urlLower.includes('.txt') ||
                                           (activeServer === 'yastream' && !urlLower.includes('/e/') && !urlLower.includes('/embed/'));
                                           
                          if (activeServer === 'flussonic') {
                            return (
                              <div className="flex flex-col gap-4 w-full">
                                <div className="flex flex-col gap-2 w-full text-left">
                                  <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Launch External Player</span>
                                  <div className="flex gap-2 w-full">
                                    <button
                                      onClick={() => downloadFlussonicM3u(activePlayerUrl!, activeStreamTitle)}
                                      className="flex-1 py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95"
                                      title="Download M3U for PC"
                                    >
                                      <Download className="w-4 h-4" />
                                      <span>M3U (PC)</span>
                                    </button>
                                    <button
                                      onClick={() => playFlussonicInVlcIpad(activePlayerUrl!, activeStreamTitle)}
                                      className="flex-1 py-3 px-3 bg-orange-600 hover:bg-orange-500 text-white border border-orange-500/30 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95"
                                      title="Play stream in VLC on iPad"
                                    >
                                      <Play className="w-4 h-4 fill-white" />
                                      <span>VLC (iPad)</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          if (isDirect) {
                            return (
                              <div className="flex flex-col gap-4 w-full">
                                <div className="flex flex-col gap-2 w-full text-left">
                                  <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Launch External Player</span>
                                  <div className="flex gap-2 w-full">
                                      <>
                                        <button
                                          onClick={() => playInVlcPC(activePlayerUrl!, activeStreamTitle, detectedKuSub || undefined, detectedEnSub || undefined)}
                                          className="flex-1 py-3 px-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600/30 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                                          title="Download M3U with Subtitles for PC"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                          <span>M3U (PC)</span>
                                        </button>
                                        <div className="flex-1 relative">
                                          <select
                                            onChange={(e) => {
                                              const player = e.target.value;
                                              if (player === 'outplayer') {
                                                window.location.href = `outplayer://${activePlayerUrl}`;
                                                recordWatchHistory('outplayer');
                                              } else if (player === 'vlc') {
                                                window.location.href = `vlc://${activePlayerUrl}`;
                                                recordWatchHistory('vlc');
                                              } else if (player === 'infuse') {
                                                window.location.href = `infuse://x-callback-url/play?url=${encodeURIComponent(activePlayerUrl!)}`;
                                                recordWatchHistory('infuse');
                                              }
                                              e.target.value = '';
                                            }}
                                            className="w-full h-full py-3 px-1 bg-orange-600 hover:bg-orange-500 text-white border border-orange-500/30 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer outline-none appearance-none text-center shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                                            defaultValue=""
                                          >
                                            <option value="" disabled hidden>iPad Player ▼</option>
                                            <option value="vlc">VLC</option>
                                            <option value="outplayer">Outplayer</option>
                                            <option value="infuse">Infuse</option>
                                          </select>
                                        </div>
                                      </>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 w-full text-left">
                                  <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Utility Options</span>
                                  <div className="flex gap-2 w-full">
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(activePlayerUrl!);
                                        triggerToast("Direct stream link copied!");
                                      }}
                                      className="flex-1 py-2.5 px-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                                    >
                                      Copy URL
                                    </button>
                                    <a
                                      onClick={() => recordWatchHistory('browser', activePlayerUrl)} 
                                      href={getOpenInNewTabUrl(activePlayerUrl)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 py-2.5 px-3 bg-zinc-850 hover:bg-zinc-800 text-amber-500 rounded-xl text-xs font-bold border border-white/5 transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
                                    >
                                      <ExternalLink className="w-3 h-3 text-amber-500" />
                                      <span>Open in Tab</span>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex flex-col gap-2 w-full pt-1">
                                <a
                                  href={activePlayerUrl!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-2.5 px-4 bg-zinc-850 hover:bg-zinc-800 border border-white/10 text-amber-500 hover:text-amber-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Open Player in New Tab</span>
                                </a>
                                <p className="text-[10px] text-zinc-500 mt-1">
                                  Note: This server uses an interactive web player. VLC streaming is only supported on direct stream servers (Yastream, Torrentio).
                                </p>
                              </div>
                            );
                          }
                        })()}

                        {/* Subtitles Download section */}
                        {(activeServer === 'flussonic' || detectedKuSub || detectedEnSub) && (
                          <div className="flex flex-col gap-2 w-full border-t border-white/5 pt-3 text-left">
                            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Subtitles Detected</span>
                            
                            {checkingSubs ? (
                              <div className="flex items-center gap-2 py-2 justify-center bg-zinc-950/40 rounded-xl border border-white/5">
                                <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                <span className="text-[10px] text-zinc-500">Querying subtitle tracks...</span>
                              </div>
                            ) : !detectedKuSub && !detectedEnSub ? (
                              <div className="py-2 text-center bg-zinc-950/40 rounded-xl border border-white/5 text-[10px] text-zinc-500 font-semibold">
                                No soft subtitle tracks found
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2 bg-zinc-950/40 p-2.5 rounded-xl border border-white/5">
                                {detectedKuSub && (
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      Kurdish Subtitle (Ku)
                                    </span>
                                    <button
                                      onClick={() => {
                                        const cleanTitle = activeStreamTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'stream';
                                        triggerLocalSubtitleDownload(detectedKuSub, `${cleanTitle}.ku.srt`);
                                        triggerToast("Kurdish Subtitle downloaded!");
                                      }}
                                      className="py-1 px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[9px] rounded-lg transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                                      title="Download Kurdish Subtitle"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Download SRT</span>
                                    </button>
                                  </div>
                                )}
                                
                                {detectedEnSub && (
                                  <div className="flex items-center justify-between text-[11px] border-t border-white/5 pt-1.5 mt-1.5 last:border-0 last:pt-0 last:mt-0">
                                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      English Subtitle (En)
                                    </span>
                                    <button
                                      onClick={() => {
                                        const cleanTitle = activeStreamTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'stream';
                                        triggerLocalSubtitleDownload(detectedEnSub, `${cleanTitle}.en.srt`);
                                        triggerToast("English Subtitle downloaded!");
                                      }}
                                      className="py-1 px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[9px] rounded-lg transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                                      title="Download English Subtitle"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Download SRT</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Collapsed Diagnostics Details */}
                        {activePlayerUrl && isFlussonicStream && (
                          <div className="w-full border-t border-white/5 pt-3">
                            <details className="group">
                              <summary className="list-none flex items-center justify-between text-[10px] text-zinc-500 hover:text-zinc-400 font-bold uppercase tracking-wider cursor-pointer select-none">
                                <span>Technical Diagnostics</span>
                                <span className="transition-transform group-open:rotate-180">▼</span>
                              </summary>
                              <div className="mt-2 text-left bg-zinc-950 p-3 rounded-xl border border-white/5 text-[10px] font-mono flex flex-col gap-2">
                                <p className="text-zinc-500 leading-normal">
                                  Stream location verified:
                                </p>
                                <div className="p-1.5 bg-zinc-900 rounded border border-white/5 text-emerald-400 select-all truncate" title={activePlayerUrl}>
                                  {activePlayerUrl}
                                </div>
                                <div className="flex justify-end mt-1">
                                  <button
                                    onClick={async () => {
                                      if (item.type === 'movie') {
                                        await handlePlayMovie();
                                      } else if (activePlayingEpisode) {
                                        await handlePlayEpisode(activePlayingEpisode.seasonNum, activePlayingEpisode.episodeNum);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded text-[9px] font-black text-amber-500 hover:text-amber-400 cursor-pointer transition-all uppercase tracking-wide"
                                  >
                                    Re-Scan Server
                                  </button>
                                </div>
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setActivePlayerUrl(null)}
                      className="w-full py-2.5 px-4 mt-4 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all border border-white/5 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : activeServer === 'flussonic' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center mb-4 shadow-xl">
                    <Play className="w-8 h-8 text-amber-500 ml-1" />
                  </div>
                  <h3 className="text-white font-bold mb-2 text-lg">External Playback Required</h3>
                  <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">
                    Flussonic streams must be played in VLC. Please select your platform below:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <button
                      onClick={() => playFlussonicInVlcIpad(activePlayerUrl!, activeStreamTitle)}
                      className="py-3 px-5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                      <Play className="w-5 h-5 fill-white" />
                      VLC (iPad)
                    </button>
                    <button
                      onClick={() => downloadFlussonicM3u(activePlayerUrl!, activeStreamTitle)}
                      className="py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                      <Download className="w-5 h-5" />
                      Download M3U (PC)
                    </button>
                  </div>
                </div>
              ) : activePlayerUrl.startsWith('webtor://') ? (
                <WebtorPlayer
                  magnetUrl={decodeURIComponent(activePlayerUrl.substring(9))}
                  className="w-full h-full"
                />
              ) : (() => {
                const urlLower = activePlayerUrl.toLowerCase();
                const isDirect = urlLower.endsWith('.mp4') || 
                                 urlLower.includes('.mp4?') ||
                                 urlLower.includes('.m3u8') ||
                                 urlLower.includes('.txt') ||
                                 (activeServer === 'yastream' && !urlLower.includes('/e/') && !urlLower.includes('/embed/'));
                return isDirect;
              })() ? (
                <HlsVideoPlayer
                  src={getVideoPlayerSrc(activePlayerUrl)}
                  kuSub={detectedKuSub || undefined}
                  enSub={detectedEnSub || undefined}
                  onPlayerError={() => {
                    triggerToast("Playback error on this stream.");
                  }}
                  title={`${item.title} Player`}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  controlsList="nodownload"
                />
              ) : (
                <iframe
                  src={activePlayerUrl}
                  title={`${item.title} Player`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              )}
              
              {/* Server selector on the top left of player */}
              <div className="absolute top-5 left-5 flex items-center gap-1.5 z-30 bg-black/85 border border-white/15 px-2.5 py-1.5 rounded-xl shadow-lg">
                <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">
                  Server:
                </span>
                <div className="relative">
                  <button
                    onClick={() => setIsPlayerServerDropdownOpen(!isPlayerServerDropdownOpen)}
                    className="bg-transparent border-0 text-amber-500 text-xs font-bold focus:outline-none cursor-pointer flex items-center gap-1 select-none touch-manipulation"
                  >
                    <span>{SERVERS.find(s => s.value === activeServer)?.label.split(' ')[0] || activeServer}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isPlayerServerDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isPlayerServerDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsPlayerServerDropdownOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-2 w-48 bg-zinc-950 border border-white/10 rounded-lg shadow-xl z-50 divide-y divide-white/5 max-h-60 overflow-y-auto no-scrollbar"
                        >
                          {SERVERS.map((srv) => (
                            <button
                              key={srv.value}
                              onClick={() => {
                                handleServerChange(srv.value);
                                setIsPlayerServerDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer select-none ${
                                activeServer === srv.value
                                  ? 'bg-amber-500/10 text-amber-500 font-bold'
                                  : 'text-zinc-300 hover:bg-zinc-900/60 hover:text-white'
                              }`}
                            >
                              {srv.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Player Top-Right Controls */}
              <div className="absolute top-5 right-5 flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 z-20 max-w-[85%] sm:max-w-[70%]">
                {activePlayerUrl !== 'torrentio-menu' && confirmedPlayInBrowser && (
                  <>
                    {(() => {
                      const urlLower = activePlayerUrl.toLowerCase();
                      const isDirect = urlLower.endsWith('.mp4') || 
                                       urlLower.includes('.mp4?') ||
                                       urlLower.includes('.m3u8') ||
                                       urlLower.includes('.txt') ||
                                       (activeServer === 'yastream' && !urlLower.includes('/e/') && !urlLower.includes('/embed/'));
                      
                      if (isDirect) {
                        const outplayerUrl = `outplayer://${activePlayerUrl}`;
                        const vlcStandardUrl = `vlc://${activePlayerUrl}`;
                        
                        return (
                          <>
                            {/* Play in VLC (iPad/iOS) */}
                            <a
                              onClick={() => recordWatchHistory('outplayer')} href={outplayerUrl}
                              className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white border border-orange-500/30 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                              title="Play stream in Outplayer on iPad / iOS"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                              <span>Outplayer (iPad)</span>
                            </a>

                            {/* Play in VLC (PC/Android) */}
                            <button
                              onClick={() => playInVlcPC(activePlayerUrl, activeStreamTitle, detectedKuSub || undefined, detectedEnSub || undefined)}
                              className="px-2.5 py-1.5 bg-orange-700 hover:bg-orange-600 text-white border border-orange-600/30 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                              title="Play stream in VLC on PC / Android"
                            >
                              <span>VLC (PC)</span>
                            </button>

                            {/* Copy Stream URL */}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(activePlayerUrl);
                                triggerToast("Direct stream link copied to clipboard!");
                              }}
                              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                              title="Copy direct video URL to clipboard"
                            >
                              <span>Copy Link</span>
                            </button>
                          </>
                        );
                      }
                      return null;
                    })()}

                    {activeServer !== 'flussonic' && (
                      <a
                        onClick={() => recordWatchHistory('browser')} href={getOpenInNewTabUrl(activePlayerUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95 ${
                          isEmbedded 
                            ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 border border-amber-400/50 animate-pulse" 
                            : "bg-black/85 hover:bg-zinc-800 text-amber-500 hover:text-amber-400 border border-white/10 hover:border-amber-500/30"
                        }`}
                        title="Open this direct link in a new browser window/tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in New Tab</span>
                      </a>
                    )}
                  </>
                )}

                <button
                  id="btn-close-player"
                  onClick={() => setActivePlayerUrl(null)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white border border-red-500 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-600/35 hover:scale-105 active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Player</span>
                </button>
              </div>

              {/* Sandbox Limitation Helper Tip */}
              {activePlayerUrl !== 'torrentio-menu' && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 bg-black/90 border border-zinc-800 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 max-w-[90%] md:max-w-md pointer-events-none backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <p className="text-[10px] text-zinc-300 font-semibold leading-normal text-center select-none">
                    {isEmbedded ? (
                      <>
                        <span className="text-amber-400 font-bold">Preview Sandbox Blocked?</span> Some servers like <strong className="text-white">vaplayer.ru</strong> block sandboxed frames. Please click the glowing <strong className="text-amber-400">"Open in New Tab"</strong> button at the top right to play!
                      </>
                    ) : (
                      "Tip: If the stream is blocked here, open the Tracker App itself in a new browser tab. It will play perfectly inside the app there!"
                    )}
                  </p>
                </div>
              )}
            </div>
          ) : isPlayingTrailer && trailerKey ? (
            <div className="absolute inset-0 w-full h-full bg-black z-10">
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&modestbranding=1&rel=0`}
                title={`${item.title} Trailer`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <button
                id="btn-close-trailer"
                onClick={() => setIsPlayingTrailer(false)}
                className="absolute top-5 right-5 px-3 py-1.5 bg-black/80 hover:bg-zinc-800 text-white border border-white/15 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer z-20"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Trailer</span>
              </button>
            </div>
          ) : (
            <>
              <img
                src={item.backdropPath || item.posterPath || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop'}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              {/* Top Overlay gradients for better back button visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/40 to-black/60" />

               {/* Huge and beautiful countdown overlay at the top of the trailer poster */}
              {upcomingEp && countdown && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center select-none z-10 text-center w-full max-w-lg px-4 animate-pulse pointer-events-auto">
                  <div className="bg-zinc-950/85 border border-amber-500/20 rounded-2xl px-6 py-3.5 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.15)] flex flex-col items-center">
                    <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-[0.2em] text-amber-500 flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      S{upcomingEp.seasonNumber}:E{upcomingEp.episodeNumber} - "{upcomingEp.episodeTitle}" Airing In
                    </span>
                    <div className="flex items-baseline gap-2.5 md:gap-4 font-mono">
                      {countdown.days > 0 && (
                        <div className="flex items-baseline">
                          <span className="text-3xl md:text-4xl font-black text-zinc-100 tracking-tighter">
                            {String(countdown.days).padStart(2, '0')}
                          </span>
                          <span className="text-xs font-bold text-amber-500/90 ml-0.5 font-sans">d</span>
                        </div>
                      )}
                      {countdown.days > 0 && <span className="text-xl font-light text-zinc-500 font-mono">:</span>}
                      <div className="flex items-baseline">
                        <span className="text-3xl md:text-4xl font-black text-zinc-100 tracking-tighter">
                          {String(countdown.hours).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-bold text-amber-500/90 ml-0.5 font-sans">h</span>
                      </div>
                      <span className="text-xl font-light text-zinc-500 font-mono">:</span>
                      <div className="flex items-baseline">
                        <span className="text-3xl md:text-4xl font-black text-zinc-100 tracking-tighter">
                          {String(countdown.minutes).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-bold text-amber-500/90 ml-0.5 font-sans">m</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Close / Back button */}
              <button
                id="modal-close-button"
                onClick={onClose}
                className="absolute top-5 left-5 p-2 bg-black/55 backdrop-blur-md text-white border border-white/5 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer z-30"
              >
                <X className="w-5 h-5" />
              </button>

              {trailerKey && (
                <button
                  id="banner-play-trailer-btn"
                  onClick={() => setIsPlayingTrailer(true)}
                  className={`absolute inset-0 flex flex-col items-center justify-center group cursor-pointer z-10 ${upcomingEp && countdown ? 'pt-28 md:pt-36' : ''}`}
                >
                  <div className="w-16 h-16 rounded-full bg-amber-500/95 text-black flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 group-hover:bg-amber-400 transition-all duration-300">
                    <Play className="w-8 h-8 fill-current translate-x-0.5" />
                  </div>
                  <span className="mt-3 px-3 py-1.5 bg-black/75 backdrop-blur-md border border-white/15 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-200 group-hover:text-white transition-all shadow-md">
                    Play Trailer
                  </span>
                </button>
              )}

              {/* Core metadata alignment at bottom of hero */}
              <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4 md:gap-6">
                <img
                  src={item.posterPath || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop'}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-24 md:w-32 rounded-lg shadow-xl border border-white/5 shrink-0"
                />
                <div className="flex-grow pb-1">
                  <span className="px-2 py-0.5 bg-amber-500 text-black font-black rounded text-[10px] uppercase tracking-wider">
                    {item.type === 'show' ? 'TV Show' : 'Movie'}
                  </span>
                  <h1 className="font-display font-bold text-xl md:text-3xl text-white mt-1.5 leading-tight line-clamp-2">
                    {item.title}
                  </h1>
                  <div className="flex items-center gap-2.5 mt-2 text-xs text-zinc-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      {item.releaseDate ? new Date(item.releaseDate).getFullYear() : 'TBA'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      {item.runtime}m
                    </span>
                    {item.rating > 0 && (
                      <span className="flex items-center gap-1 text-amber-500 font-bold" title="TMDB Rating">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {item.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* DETAILED CONTENT SCROLLER */}
        <div className="p-5 sm:p-8 flex-grow space-y-6">
          <div className="flex flex-col gap-6 sm:gap-8">
            
            {/* MAIN COLUMN (Actions, Genres, Rating, Synopsis) */}
            <div className="w-full space-y-6">
              {/* INTERACTIVE FLOATING ACTIONS */}
              <div className={`grid ${item.type === 'show' ? 'grid-cols-4' : 'grid-cols-3'} gap-2 bg-zinc-900/40 border border-white/5 p-2 rounded-xl backdrop-blur-sm shadow-md`}>
                
                {/* Action 1: Watchlist Toggle */}
                <button
                  id="action-toggle-watchlist"
                  onClick={() => {
                    toggleWatchlist(item.id, item.type, item);
                    triggerToast(!item.inWatchlist ? 'Added to Watch Next' : 'Removed from Watchlist');
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-lg transition-all cursor-pointer ${
                    item.inWatchlist
                      ? 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/10'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  <Bookmark className={`w-5 h-5 mb-1 ${item.inWatchlist ? 'fill-current' : ''}`} />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Watchlist</span>
                </button>

                {/* Action 2: Favorite Toggle */}
                <button
                  id="action-toggle-favorite"
                  onClick={() => {
                    toggleFavorite(item.id, item.type, item);
                    triggerToast(!favorites.includes(item.id) ? 'Added to Favorites' : 'Removed from Favorites');
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-lg transition-all cursor-pointer ${
                    favorites.includes(item.id)
                      ? 'bg-rose-600 text-white font-extrabold shadow-lg shadow-rose-600/10'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  <Heart className={`w-5 h-5 mb-1 ${favorites.includes(item.id) ? 'fill-current' : ''}`} />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Favorite</span>
                </button>

                {/* Action 3: Complete Toggle (Mark Watched) */}
                <button
                  id="action-toggle-complete"
                  onClick={() => {
                    if (item.type === 'movie') {
                      toggleMovieWatched(item.id, item);
                      triggerToast(!item.completed ? 'Marked Movie as Watched' : 'Movie Watched status reset');
                    } else {
                      // Complete TV Show marks all episodes watched
                      toggleShowCompleted(item.id, seasons, undefined, item);
                      triggerToast(!item.completed ? 'Marked TV Show as Completed' : 'TV Show episodes reset');
                    }
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-lg transition-all cursor-pointer ${
                    item.completed
                      ? 'bg-emerald-600 text-white font-extrabold shadow-lg shadow-emerald-600/10'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  <Check className="w-5 h-5 mb-1" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Completed</span>
                </button>

                {/* Action 4: Stopped Watching (Shows only) */}
                {item.type === 'show' && (
                  <button
                    id="action-toggle-stopped"
                    onClick={() => {
                      toggleStoppedWatching(item.id, item);
                      triggerToast(!item.stoppedWatching ? 'Stopped Watching' : 'Resumed Watching');
                    }}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-lg transition-all cursor-pointer ${
                      item.stoppedWatching
                        ? 'bg-red-600 text-white font-extrabold shadow-lg shadow-red-600/10'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                    }`}
                  >
                    <Ban className="w-5 h-5 mb-1" />
                    <span className="text-[10px] uppercase tracking-wider font-semibold">Stopped</span>
                  </button>
                )}
              </div>

              {/* ACTIONS & INFO BAR */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* IMDB RATING BOX */}
                {imdbInfo && imdbInfo.rating > 0 && (
                  <div className="bg-[#F5C518]/10 border border-[#F5C518]/20 rounded-xl p-4 flex items-center justify-center gap-3 shrink-0 shadow-inner">
                    <span className="text-sm font-black text-black bg-[#F5C518] px-2 py-0.5 rounded tracking-tighter">IMDb</span>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-5 h-5 text-[#F5C518] fill-current" />
                      <span className="text-lg font-bold text-[#F5C518]">{imdbInfo.rating}</span>
                      <span className="text-xs text-[#F5C518]/60 font-bold mt-1">/10</span>
                    </div>
                    <span className="text-sm text-zinc-400 font-mono font-medium ml-1">
                      {imdbInfo.votes > 1000 ? `${(imdbInfo.votes / 1000).toFixed(1)}k` : imdbInfo.votes}
                    </span>
                  </div>
                )}

                {/* STREAMING SOURCE SELECTOR */}
                <div className="flex-1 bg-zinc-900/30 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-inner relative">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-amber-500 animate-spin-slow" />
                    <span className="text-xs font-extrabold text-zinc-300 uppercase tracking-wider">Streaming Source</span>
                  </div>
                  
                  <div className="relative w-full sm:w-64">
                    <button
                      id="server-dropdown-btn"
                      onClick={() => setIsServerDropdownOpen(!isServerDropdownOpen)}
                      className="w-full bg-zinc-950 border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 text-xs text-amber-500 font-extrabold flex items-center justify-between cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/30 select-none touch-manipulation"
                    >
                      <span>{SERVERS.find(s => s.value === activeServer)?.label || activeServer}</span>
                      <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform duration-200 ${isServerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {isServerDropdownOpen && (
                        <>
                          {/* Invisible backdrop to close on click outside */}
                          <div 
                            className="fixed inset-0 z-35" 
                            onClick={() => setIsServerDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 left-0 mt-1.5 max-h-60 overflow-y-auto bg-zinc-950 border border-white/10 rounded-lg shadow-xl z-40 no-scrollbar divide-y divide-white/5"
                          >
                            {SERVERS.map((srv) => (
                              <button
                                key={srv.value}
                                onClick={() => {
                                  handleServerChange(srv.value);
                                  setIsServerDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer select-none ${
                                  activeServer === srv.value
                                    ? 'bg-amber-500/10 text-amber-500 font-bold'
                                    : 'text-zinc-300 hover:bg-zinc-900/60 hover:text-white'
                                }`}
                              >
                                {srv.label}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* WATCH NOW EMBED TRIGGER */}
              {item.type === 'movie' ? (
                <button
                  id="action-watch-movie"
                  disabled={loadingPlayer}
                  onClick={() => handlePlayMovie()}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 text-xs uppercase tracking-wider disabled:opacity-50 select-none touch-manipulation"
                >
                  {loadingPlayer ? (
                    <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-4.5 h-4.5 fill-current pointer-events-none" />
                  )}
                  <span>{loadingPlayer ? 'Loading Player...' : 'Watch Movie Now'}</span>
                </button>
              ) : (
                nextEpisode && (
                  <button
                    id="action-watch-show"
                    disabled={loadingPlayer}
                    onClick={() => handlePlayEpisode(nextEpisode.seasonNum, nextEpisode.episodeNum)}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 text-xs uppercase tracking-wider disabled:opacity-50 select-none touch-manipulation"
                  >
                    {loadingPlayer ? (
                      <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4.5 h-4.5 fill-current pointer-events-none" />
                    )}
                    <span>{loadingPlayer ? 'Loading Player...' : `Watch S${nextEpisode.seasonNum}:E${nextEpisode.episodeNum} Now`}</span>
                  </button>
                )
              )}

              {/* GENRE PILLED BADGES */}
              <div className="flex flex-wrap gap-1.5">
                {item.genres.map((genre, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-zinc-900/60 border border-white/5 rounded-full text-xs text-zinc-300 font-medium hover:border-amber-500 hover:text-amber-500 transition-colors cursor-pointer"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              {/* INTERACTIVE STAR RATING SYSTEM */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                  {item.userRating ? 'Your Personal Rating' : 'Rate This Title'}
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((stars) => {
                    const isSelected = (hoverRating !== null ? hoverRating : (item.userRating || 0)) >= stars;
                    return (
                      <button
                        key={stars}
                        id={`rating-star-${stars}`}
                        onClick={() => handleRatingClick(stars)}
                        onMouseEnter={() => setHoverRating(stars)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-0.5 cursor-pointer hover:scale-125 transition-transform duration-100 focus:outline-none"
                        title={`${stars}/10`}
                      >
                        <Star
                          className={`w-5.5 h-5.5 stroke-amber-500 transition-all ${
                            isSelected 
                              ? 'fill-amber-500 text-amber-500' 
                              : 'text-zinc-700 hover:text-amber-500/50'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                {(hoverRating !== null || item.userRating) && (
                  <span className="text-xs font-bold text-amber-500 animate-fade-in font-mono">
                    {hoverRating !== null ? hoverRating : item.userRating}/10 - {
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 10 ? 'Masterpiece!' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 9 ? 'Superb!' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 8 ? 'Excellent!' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 7 ? 'Good!' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 6 ? 'Fine' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 5 ? 'Average' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 4 ? 'Disappointing' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 3 ? 'Bad' :
                      (hoverRating !== null ? hoverRating : (item.userRating || 0)) === 2 ? 'Very Bad' : 'Horrible!'
                    }
                  </span>
                )}
              </div>

              {/* PLOT SUMMARY DESCRIPTION */}
              <div className="space-y-2">
                <h2 className="font-display font-semibold text-zinc-200 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                  <Film className="w-4 h-4 text-amber-500" />
                  Synopsis
                </h2>
                <p className="text-zinc-300 text-sm leading-relaxed font-light select-text light-mode-readable-text">
                  {item.overview}
                </p>
              </div>

              {/* DIRECTORS / CREATORS LIST */}
              {item.directors && item.directors.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <h2 className="font-display font-semibold text-zinc-200 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    Directors / Creators
                  </h2>
                  <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar snap-x">
                    {item.directors.map(person => (
                      <button
                        key={person.id}
                        onClick={() => onPersonClick?.(person.id)}
                        className="flex flex-col items-center w-[80px] shrink-0 snap-start group text-left outline-none cursor-pointer"
                      >
                        <div className="w-[70px] h-[70px] rounded-full overflow-hidden bg-zinc-900 border border-white/5 shadow-md flex items-center justify-center mb-2 group-hover:border-emerald-500/50 transition-all duration-300 relative">
                          {person.profilePath ? (
                            <img src={person.profilePath} alt={person.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <span className="text-zinc-600 text-xs font-bold uppercase">{person.name.substring(0, 2)}</span>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                            <ExternalLink className="w-4 h-4 text-emerald-400" />
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-center text-zinc-200 truncate w-full group-hover:text-emerald-400 transition-colors">{person.name}</span>
                        <span className="text-[9px] text-zinc-500 text-center truncate w-full">Director / Creator</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CAST LIST */}
              {item.cast && item.cast.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <h2 className="font-display font-semibold text-zinc-200 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                    <Users className="w-4 h-4 text-amber-500" />
                    Cast
                  </h2>
                  <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar snap-x">
                    {item.cast.map(person => (
                      <button
                        key={person.id}
                        onClick={() => onPersonClick?.(person.id)}
                        className="flex flex-col items-center w-[80px] shrink-0 snap-start group text-left outline-none cursor-pointer"
                      >
                        <div className="w-[70px] h-[70px] rounded-full overflow-hidden bg-zinc-900 border border-white/5 shadow-md flex items-center justify-center mb-2 group-hover:border-amber-500/50 transition-all duration-300 relative">
                          {person.profilePath ? (
                            <img src={person.profilePath} alt={person.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <span className="text-zinc-600 text-xs font-bold uppercase">{person.name.substring(0, 2)}</span>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                            <ExternalLink className="w-4 h-4 text-amber-400" />
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-center text-zinc-200 truncate w-full group-hover:text-amber-400 transition-colors">{person.name}</span>
                        <span className="text-[10px] text-zinc-500 text-center truncate w-full" title={person.character}>{person.character}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* EPISODE TRACKER - FOR TV SHOWS ONLY */}
            {item.type === 'show' && (
              <div className="w-full space-y-4 pt-6 mt-6 border-t border-white/5">
                <div 
                  className="flex justify-between items-center border-b border-white/5 pb-2 cursor-pointer group select-none"
                  onClick={() => setIsEpisodesExpanded(!isEpisodesExpanded)}
                >
                  <h2 className="font-display font-semibold text-zinc-200 text-sm uppercase tracking-wider flex items-center gap-2 group-hover:text-amber-500 transition-colors">
                    <Tv className="w-4 h-4 text-amber-500" />
                    Episodes ({watchedCount} / {releasedEpisodesCount})
                  </h2>
                  <div className="flex items-center gap-4">
                    {seasons.length > 0 && (
                      <button
                        id="mark-season-completed-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const activeSeasonObj = seasons.find(s => s.seasonNumber === activeSeason);
                          if (activeSeasonObj) {
                            const seasonEpsKeys = activeSeasonObj.episodes.map(ep => `S${activeSeason}E${ep.episode}`);
                            const allSeasonEpsWatched = seasonEpsKeys.every(key => !!watchedMap[key]);
                            
                            toggleSeasonCompleted(
                              item.id,
                              activeSeason,
                              activeSeasonObj.episodes,
                              totalEpisodesInShow,
                              !allSeasonEpsWatched,
                              item
                            );
                            triggerToast(!allSeasonEpsWatched ? `Season ${activeSeason} marked watched` : `Season ${activeSeason} reset`);
                          }
                        }}
                        className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/80 px-2 py-1 rounded-md"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{(() => {
                          const activeSeasonObj = seasons.find(s => s.seasonNumber === activeSeason);
                          if (activeSeasonObj) {
                            const seasonEpsKeys = activeSeasonObj.episodes.map(ep => `S${activeSeason}E${ep.episode}`);
                            const allSeasonEpsWatched = seasonEpsKeys.every(key => !!watchedMap[key]);
                            return allSeasonEpsWatched ? 'Reset Season' : 'Mark Season';
                          }
                          return 'Mark Season';
                        })()}</span>
                      </button>
                    )}
                    {isEpisodesExpanded ? (
                      <ChevronUp className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    )}
                  </div>
                </div>

                {isEpisodesExpanded && (
                  loadingSeasons ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500 font-medium">Loading episodes...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    
                    {/* Episode Ratings Table Button */}
                    <button
                      onClick={() => setShowRatingsTable(true)}
                      className="w-full flex items-center justify-between p-3 bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/5 hover:border-amber-500/35 rounded-xl transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 group-hover:scale-105 transition-all">
                          <Table className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="block text-xs font-bold text-white uppercase tracking-wider group-hover:text-amber-500 transition-colors">
                            Episode Ratings Table
                          </span>
                          <span className="block text-[10px] text-zinc-500">
                            Color-coded series quality visualizer
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-amber-500 transition-all text-xs font-bold">
                        <span>View Matrix</span>
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                      </div>
                    </button>

                    {/* Season selector Tabs */}
                    {seasons.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {seasons.map((season) => (
                          <button
                            key={season.seasonNumber}
                            id={`season-tab-${season.seasonNumber}`}
                            onClick={() => setActiveSeason(season.seasonNumber)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                              activeSeason === season.seasonNumber
                                ? 'bg-amber-500 text-black font-bold'
                                : 'bg-[#0A0A0A]/80 border border-white/5 text-zinc-400 hover:text-zinc-100'
                            }`}
                          >
                            Season {season.seasonNumber}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active Season Episodes list */}
                    {seasons.map((season) => {
                      if (season.seasonNumber !== activeSeason) return null;
                      return (
                        <div key={season.id} className="flex flex-col gap-3 pb-4 animate-fade-in">
                          {season.episodes.length === 0 ? (
                            <div className="text-center py-6 text-xs text-zinc-500 w-full">
                              No episodes released for this season yet.
                            </div>
                          ) : (
                            season.episodes.map((episode) => {
                              const epKey = `S${season.seasonNumber}E${episode.episode}`;
                              const isWatched = !!watchedMap[epKey];

                              return (
                                <div key={episode.id} className="flex flex-col sm:flex-row w-full bg-zinc-900/5 p-1 border border-transparent hover:border-white/5 hover:bg-zinc-900/15 rounded-2xl transition-all duration-300">
                                  <div className="flex flex-col sm:flex-row gap-3 w-full p-2 items-center">
                                    {/* Watched toggle card (left side on desktop, top on mobile) */}
                                    <div
                                      id={`episode-item-${season.seasonNumber}-${episode.episode}`}
                                      onClick={() => toggleEpisodeWatched(item.id, season.seasonNumber, episode.episode, totalEpisodesInShow, item)}
                                      className={`flex-grow flex items-start gap-3 p-3 w-full rounded-xl border transition-all cursor-pointer select-none text-left ${
                                        isWatched
                                          ? 'bg-[#0A0A0A]/40 border-emerald-500/20 text-zinc-400'
                                          : 'bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/80 text-zinc-100'
                                      }`}
                                    >
                                      {/* Watched status Checkmark box */}
                                      <div
                                        id={`episode-checkbox-${season.seasonNumber}-${episode.episode}`}
                                        className={`p-1.5 rounded-lg border transition-all shrink-0 mt-0.5 ${
                                          isWatched
                                            ? 'bg-emerald-600 border-emerald-500 text-white'
                                            : 'bg-zinc-950 border-white/10 text-zinc-600'
                                        }`}
                                      >
                                        <Check className={`w-3.5 h-3.5 transition-transform ${isWatched ? 'scale-100' : 'scale-0'}`} />
                                      </div>

                                      {/* Episode text detail */}
                                      <div className="flex-grow space-y-1">
                                        <div className="flex justify-between items-baseline gap-2">
                                          <h4 className={`text-sm font-semibold leading-tight ${isWatched ? 'text-zinc-400 line-through' : 'text-[#F5F5F5]'}`}>
                                            E{episode.episode}. {episode.title}
                                          </h4>
                                          <span className="text-[10px] text-zinc-500 shrink-0">
                                            {episode.airDate ? episode.airDate : 'TBA'}
                                          </span>
                                        </div>
                                        <p className="text-[12px] text-zinc-400 leading-relaxed pt-1 light-mode-readable-text-sm">
                                          {episode.overview}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Action Buttons Row */}
                                    <div className="flex sm:flex-col gap-2 w-full sm:w-14 shrink-0 mt-2 sm:mt-0">
                                      {/* Comments Episode Button */}
                                      <button
                                        id={`comments-episode-${season.seasonNumber}-${episode.episode}`}
                                        onClick={() => handleOpenEpisodeComments(season.seasonNumber, episode.episode, episode.title, episode.overview)}
                                        className={`flex-1 sm:w-14 h-12 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer border select-none touch-manipulation active:scale-95 ${
                                          selectedEpisodeForComments?.seasonNum === season.seasonNumber && selectedEpisodeForComments?.episodeNum === episode.episode
                                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                                            : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-white/10'
                                        }`}
                                        title="Show Episode Comments (Trakt)"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                        <span className="text-xs font-semibold sm:hidden">Comments</span>
                                      </button>

                                      {/* Play Episode Button */}
                                      <button
                                        id={`play-episode-${season.seasonNumber}-${episode.episode}`}
                                        onClick={() => handlePlayEpisode(season.seasonNumber, episode.episode)}
                                        className="flex-1 sm:w-14 h-12 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/25 border border-amber-400/20 select-none touch-manipulation"
                                        title={`Play S${season.seasonNumber}:E${episode.episode}`}
                                      >
                                        <Play className="w-5 h-5 fill-current ml-0.5 pointer-events-none" />
                                        <span className="text-xs font-semibold sm:hidden">Play</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
              </div>
            )}

          </div>

          {/* COMMUNITY REVIEWS SECTION */}
          <div className="border-t border-white/5 pt-8 mt-6">
            {/* Tab Selectors */}
            <div className="flex border-b border-white/5 mb-6 gap-2 sm:gap-4 overflow-x-auto">
              <button
                onClick={() => setActiveReviewTab('written')}
                className={`pb-3 px-1 text-xs sm:text-sm font-bold tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap select-none ${
                  activeReviewTab === 'written'
                    ? 'border-b-2 border-amber-500 text-amber-500 font-black'
                    : 'text-zinc-400 hover:text-zinc-200 border-b-2 border-transparent'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Audience Reviews ({reviews.length})</span>
              </button>
              <button
                onClick={() => setActiveReviewTab('imdb')}
                className={`pb-3 px-1 text-xs sm:text-sm font-bold tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap select-none ${
                  activeReviewTab === 'imdb'
                    ? 'border-b-2 border-yellow-500 text-yellow-500 font-black'
                    : 'text-zinc-400 hover:text-zinc-200 border-b-2 border-transparent'
                }`}
              >
                <Star className="w-4 h-4 text-yellow-500" />
                <span>IMDb Reviews</span>
              </button>

              <button
                onClick={() => setActiveReviewTab('kurdcinema')}
                className={`pb-3 px-1 text-xs sm:text-sm font-bold tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap select-none ${
                  activeReviewTab === 'kurdcinema'
                    ? 'border-b-2 border-emerald-500 text-emerald-500 font-black'
                    : 'text-zinc-400 hover:text-zinc-200 border-b-2 border-transparent'
                }`}
              >
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>Kurdcinema</span>
              </button>
            </div>

            {activeReviewTab === 'written' ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 animate-pulse">
                      <MessageSquare className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-zinc-100 text-sm sm:text-base uppercase tracking-wider">
                        Audience Reviews
                      </h3>
                      <p className="text-[10px] text-zinc-500">
                        Discussions from TMDb & Trakt.tv
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Sorting Controls */}
                    <div className="flex bg-zinc-950/60 p-0.5 rounded-lg border border-white/5 text-[10px] font-bold font-sans">
                      <button
                        onClick={() => setReviewsSortOrder('reactions')}
                        className={`px-2.5 py-1 rounded transition-all cursor-pointer select-none ${
                          reviewsSortOrder === 'reactions'
                            ? 'bg-amber-500 text-zinc-950 shadow-md font-extrabold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        🔥 POPULAR
                      </button>
                      <button
                        onClick={() => setReviewsSortOrder('newest')}
                        className={`px-2.5 py-1 rounded transition-all cursor-pointer select-none ${
                          reviewsSortOrder === 'newest'
                            ? 'bg-amber-500 text-zinc-950 shadow-md font-extrabold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        ⏰ NEWEST
                      </button>
                    </div>

                    <span className="px-2.5 py-1 bg-zinc-900/60 border border-white/5 rounded-full text-xs text-amber-500 font-extrabold font-mono">
                      {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                    </span>
                  </div>
                </div>

                {loadingReviews ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 bg-zinc-900/10 border border-white/5 rounded-2xl">
                    <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500 font-medium">Fetching audience thoughts...</span>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-center bg-zinc-900/10 border border-white/5 rounded-2xl p-6">
                    <MessageSquare className="w-8 h-8 text-zinc-700 mb-1" />
                    <p className="text-sm font-semibold text-zinc-400">No community reviews yet</p>
                    <p className="text-xs text-zinc-600 max-w-sm">
                      No discussions found on TMDb or Trakt.tv.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedReviews.slice(0, visibleReviewsLimit).map((review) => {
                      const isExpanded = !!expandedReviews[review.id];
                      const shouldTruncate = review.content.length > 280;
                      const displayContent = shouldTruncate && !isExpanded
                        ? review.content.slice(0, 280) + '...'
                        : review.content;

                      const ratingStyles = review.rating ? (
                        review.rating >= 8.5
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : review.rating >= 7.0
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          : review.rating >= 5.0
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      ) : null;

                      return (
                        <div 
                          key={review.id} 
                          className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-white/5 hover:border-white/10 p-5 rounded-2xl transition-all duration-300 flex flex-col md:flex-row gap-4 group"
                        >
                          {/* Left: Author Profile */}
                          <div className="flex md:flex-col items-start md:items-center gap-3 shrink-0 md:w-36 text-left md:text-center">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center text-amber-500 font-black text-sm shrink-0">
                              {review.avatarPath ? (
                                <img 
                                  src={review.avatarPath} 
                                  alt={review.author} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                review.author.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs font-black text-zinc-200 group-hover:text-amber-500 transition-colors truncate max-w-[120px] md:max-w-full light-mode-readable-text-sm">
                                {review.author}
                              </span>
                              <span className="block text-[10px] text-zinc-500 font-mono truncate max-w-[120px] md:max-w-full">
                                @{review.username}
                              </span>
                            </div>
                          </div>

                          {/* Right: Content Card */}
                          <div className="flex-grow space-y-2 text-left">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                {review.rating !== null && (
                                  <div className={`px-2 py-0.5 border rounded-lg text-[10px] font-black font-mono ${ratingStyles}`}>
                                    RATING: {review.rating.toFixed(1)}/10
                                  </div>
                                )}
                                
                                {/* Source label badge */}
                                {review.source === 'trakt' ? (
                                  <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-extrabold tracking-wider font-sans">
                                    TRAKT.TV
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded text-[9px] font-extrabold tracking-wider font-sans">
                                    TMDB
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 font-medium">
                                {new Date(review.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>

                            {/* Spoiler warning overlay or real content */}
                            {review.spoiler && !revealedSpoilers[review.id] ? (
                              <div className="relative overflow-hidden rounded-xl border border-rose-500/10 bg-rose-500/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-rose-400">
                                  <EyeOff className="w-4 h-4 shrink-0" />
                                  <div className="text-left">
                                    <p className="text-xs font-bold leading-tight">Spoiler Warning</p>
                                    <p className="text-[10px] text-rose-400/70">This review contains show plot spoilers. Click to reveal.</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setRevealedSpoilers(prev => ({ ...prev, [review.id]: true }))}
                                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-[10px] font-bold text-rose-300 transition-colors cursor-pointer select-none active:scale-95"
                                >
                                  Reveal Review
                                </button>
                              </div>
                            ) : (
                              <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none font-normal light-mode-readable-text">
                                {displayContent}
                              </div>
                            )}

                            {/* Reactions and Actions Bar with full emoji reactions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5 mt-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Base Likes & Replies */}
                                {review.likes !== undefined && review.likes > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Original Likes">
                                    <ThumbsUp className="w-3.5 h-3.5 text-amber-500" />
                                    <span>{review.likes}</span>
                                  </div>
                                )}

                                {review.replies !== undefined && review.replies > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Original Replies">
                                    <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                                    <span>{review.replies}</span>
                                  </div>
                                )}

                                {/* Interactive Emoji Reactions */}
                                <div className="flex items-center gap-1 bg-zinc-950/20 p-0.5 rounded-lg border border-white/5">
                                  {['👍', '❤️', '😂', '😮', '😢'].map((emoji) => {
                                    const reactCounts = getCommentReactions(review.id, review.likes || 0, review.rating, review.content);
                                    const count = reactCounts[emoji] || 0;
                                    const isSelected = userSelectedReactions[review.id] === emoji;
                                    
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => handleEmojiClick(review.id, emoji)}
                                        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[13px] transition-all cursor-pointer select-none active:scale-90 ${
                                          isSelected
                                            ? 'bg-amber-500/20 border border-amber-500/35 font-extrabold text-amber-400 scale-105'
                                            : 'hover:bg-white/5 border border-transparent text-zinc-400 hover:text-zinc-200'
                                        }`}
                                      >
                                        <span>{emoji}</span>
                                        {count > 0 && <span className="font-mono text-[10px] font-bold">{count}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Read Full / Show Less */}
                              {shouldTruncate && (
                                <button
                                  onClick={() => setExpandedReviews(prev => ({ ...prev, [review.id]: !prev[review.id] }))}
                                  className="text-[10px] font-bold text-amber-500 hover:text-amber-400 cursor-pointer flex items-center gap-1 transition-colors select-none self-end sm:self-auto"
                                >
                                  <span>{isExpanded ? 'Show Less' : 'Read Full Comment'}</span>
                                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {reviews.length > visibleReviewsLimit && (
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={() => setVisibleReviewsLimit(prev => prev + 12)}
                          className="px-6 py-2.5 bg-zinc-900/60 hover:bg-zinc-800/85 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer flex items-center gap-2 shadow-lg hover:shadow-amber-500/5 select-none active:scale-[0.98]"
                        >
                          <span>Show More Reviews ({reviews.length - visibleReviewsLimit} remaining)</span>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : activeReviewTab === 'imdb' ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 animate-pulse">
                      <Star className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-zinc-100 text-sm sm:text-base uppercase tracking-wider">
                        IMDb Reviews
                      </h3>
                      <p className="text-[10px] text-zinc-500">
                        Top critical reviews from IMDb
                      </p>
                    </div>
                  </div>
                </div>

                {loadingImdbReviews ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 bg-zinc-900/10 border border-white/5 rounded-2xl">
                    <div className="w-8 h-8 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500 font-medium">Loading IMDb reviews...</span>
                  </div>
                ) : !imdbReviews || imdbReviews.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-center bg-zinc-900/10 border border-white/5 rounded-2xl p-6">
                    <Star className="w-8 h-8 text-zinc-700 mb-1" />
                    <p className="text-sm font-semibold text-zinc-400">No IMDb reviews found</p>
                    <p className="text-xs text-zinc-600 max-w-sm">
                      We couldn't locate reviews for this title at the moment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {imdbReviews.map((review, rIdx) => {
                      const isExpanded = expandedReviews[review.id];
                      const shouldTruncate = review.content.length > 300;
                      const displayContent = shouldTruncate && !isExpanded 
                        ? review.content.slice(0, 300) + '...'
                        : review.content;

                      const authorInitial = review.author ? review.author.charAt(0).toUpperCase() : 'U';

                      return (
                        <div 
                          key={review.id || rIdx} 
                          className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-white/5 hover:border-white/10 p-5 rounded-2xl transition-all duration-300 flex flex-col md:flex-row gap-4 group"
                        >
                          <div className="flex md:flex-col items-start md:items-center gap-3 shrink-0 md:w-36 text-left md:text-center">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center text-yellow-500 font-black text-sm shrink-0">
                              {authorInitial}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs font-black text-zinc-200 group-hover:text-yellow-400 transition-colors truncate max-w-[120px] md:max-w-full">
                                {review.author}
                              </span>
                            </div>
                          </div>

                          <div className="flex-grow space-y-2 text-left">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-[9px] font-extrabold tracking-wider font-sans">
                                  IMDb
                                </span>
                                {review.rating && (
                                  <div className="flex items-center gap-1 text-[10px] font-black font-mono text-zinc-300">
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                    <span>{review.rating}/10</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 font-medium">
                                {new Date(review.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>

                            {review.summary && (
                              <h4 className="text-sm font-bold text-zinc-100">{review.summary}</h4>
                            )}

                            <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none font-normal light-mode-readable-text">
                              {displayContent}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5 mt-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {review.likes !== undefined && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Helpful Votes">
                                    <ThumbsUp className="w-3.5 h-3.5 text-yellow-500" />
                                    <span>{review.likes} helpful</span>
                                  </div>
                                )}
                                {review.downVotes !== undefined && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Not Helpful Votes">
                                    <ThumbsDown className="w-3.5 h-3.5 text-zinc-500" />
                                    <span>{review.downVotes} not helpful</span>
                                  </div>
                                )}
                              </div>
                              {shouldTruncate && (
                                <button
                                  onClick={() => setExpandedReviews(prev => ({ ...prev, [review.id]: !prev[review.id] }))}
                                  className="text-[10px] font-bold text-yellow-500 hover:text-yellow-400 cursor-pointer flex items-center gap-1 transition-colors select-none self-end sm:self-auto"
                                >
                                  <span>{isExpanded ? 'Show Less' : 'Read Full Comment'}</span>
                                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeReviewTab === 'kurdcinema' ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 animate-pulse">
                      <MessageSquare className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-zinc-100 text-sm sm:text-base uppercase tracking-wider">
                        Kurdcinema Reviews
                      </h3>
                      <p className="text-[10px] text-zinc-500">
                        Comments and discussions from Kurdcinema
                      </p>
                    </div>
                  </div>
                </div>

                {!kurdcinemaSelectedUrl ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={kurdcinemaSearchQuery}
                        onChange={(e) => setKurdcinemaSearchQuery(e.target.value)}
                        placeholder="Search movie/series..."
                        className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setIsSearchingKurdcinema(true);
                            fetchKurdcinemaSearch(kurdcinemaSearchQuery, item.type === 'show' ? 'series' : 'movie').then(res => {
                              setKurdcinemaSearchResults(res || []);
                              setIsSearchingKurdcinema(false);
                            });
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          setIsSearchingKurdcinema(true);
                          fetchKurdcinemaSearch(kurdcinemaSearchQuery, item.type === 'show' ? 'series' : 'movie').then(res => {
                            setKurdcinemaSearchResults(res || []);
                            setIsSearchingKurdcinema(false);
                          });
                        }}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      >
                        {isSearchingKurdcinema ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                      </button>
                    </div>
                    
                    {kurdcinemaSearchResults.length > 0 && (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                        {kurdcinemaSearchResults.map((res: any, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setKurdcinemaSelectedUrl(res.url || res.id);
                              setIsFetchingKurdcinemaComments(true);
                              fetchKurdcinemaComments(res.url || res.id, item.type === 'show' ? 'series' : 'movie').then(data => {
                                setKurdcinemaComments(data);
                                setIsFetchingKurdcinemaComments(false);
                              });
                            }}
                            className="w-full text-left bg-zinc-900/30 hover:bg-zinc-800/50 border border-white/5 hover:border-emerald-500/30 rounded-xl p-3 transition-all flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-zinc-200 text-sm">{res.title}</div>
                              <div className="text-xs text-zinc-500">{res.typeLabel || 'Unknown'}</div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-emerald-500 rotate-180" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button 
                      onClick={() => {
                        setKurdcinemaSelectedUrl(null);
                        setKurdcinemaComments(null);
                      }}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3 h-3" /> Back to search
                    </button>

                    {isFetchingKurdcinemaComments ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3 bg-zinc-900/10 border border-white/5 rounded-2xl">
                        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        <span className="text-sm text-zinc-400 font-medium animate-pulse">Fetching comments...</span>
                      </div>
                    ) : kurdcinemaComments ? (
                      <div className="space-y-4">
                        <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-xl p-4 mb-4 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-zinc-200">{kurdcinemaComments.title}</div>
                            <div className="text-xs text-zinc-400">Rating: {kurdcinemaComments.average_rating} • {kurdcinemaComments.total_reviews_label}</div>
                          </div>
                        </div>
                        {kurdcinemaComments.comments && kurdcinemaComments.comments.length > 0 ? (
                          kurdcinemaComments.comments.map((cmt: any, idx: number) => (
                            <div key={idx} className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4 text-sm relative">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-white/10 shrink-0">
                                    {cmt.user_photo ? (
                                      <img src={cmt.user_photo} alt={cmt.user_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-emerald-500 font-bold text-sm">{(cmt.user_name || '?').charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-zinc-200">{cmt.user_name || 'Anonymous'}</span>
                                      {cmt.user_badge && (
                                        <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">
                                          {cmt.user_badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-medium flex items-center gap-2">
                                      {cmt.date}
                                      {cmt.rating && (
                                        <span className="text-yellow-500 flex items-center gap-0.5">
                                          <Star className="w-3 h-3 fill-current" /> {cmt.rating}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <p className={`text-zinc-300 leading-relaxed text-[13px] ${cmt.is_spoiler ? 'blur-sm hover:blur-none transition-all cursor-pointer' : ''}`}>
                                {cmt.text}
                              </p>
                              {cmt.replies && cmt.replies.length > 0 && (
                                <div className="mt-4 pl-4 border-l-2 border-white/5 space-y-3">
                                  {cmt.replies.map((reply: any, ridx: number) => (
                                    <div key={ridx} className="flex gap-3">
                                      <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                                        {reply.user_photo ? (
                                          <img src={reply.user_photo} alt={reply.user_name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-emerald-500 text-[10px] font-bold">
                                            {(reply.user_name || '?').charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="flex items-baseline gap-2">
                                          <span className="font-bold text-zinc-300 text-xs">{reply.user_name}</span>
                                          <span className="text-[9px] text-zinc-500">{reply.date}</span>
                                        </div>
                                        <p className={`text-zinc-400 text-xs mt-1 ${reply.is_spoiler ? 'blur-sm hover:blur-none transition-all cursor-pointer' : ''}`}>
                                          {reply.text}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center bg-zinc-900/10 border border-white/5 rounded-2xl p-6">
                            <MessageSquare className="w-8 h-8 text-zinc-700 mb-1" />
                            <p className="text-sm font-semibold text-zinc-400">No Kurdcinema comments found for this title</p>
                            <button
                              onClick={() => {
                                setKurdcinemaSelectedUrl(null);
                                setKurdcinemaComments(null);
                              }}
                              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer mt-2"
                            >
                              Search Kurdcinema Manually
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 flex flex-col items-center justify-center gap-3 text-center bg-zinc-900/10 border border-white/5 rounded-2xl p-6">
                        <MessageSquare className="w-8 h-8 text-zinc-700 mb-1" />
                        <p className="text-sm font-semibold text-zinc-400">Unable to load Kurdcinema comments automatically</p>
                        <button
                          onClick={() => {
                            setKurdcinemaSelectedUrl(null);
                            setKurdcinemaComments(null);
                          }}
                          className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer mt-2"
                        >
                          Search Kurdcinema Manually
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* EPISODE RATINGS TABLE OVERLAY */}
      <AnimatePresence>
        {showRatingsTable && (
          <EpisodeRatingsTableModal
            item={item}
            seasons={seasons}
            watchedMap={watchedMap}
            onClose={() => setShowRatingsTable(false)}
            toggleEpisodeWatched={toggleEpisodeWatched}
            totalEpisodesInShow={totalEpisodesInShow}
            handlePlayEpisode={handlePlayEpisode}
          />
        )}
      </AnimatePresence>

      {/* EPISODE COMMENTS MODAL (WINDOW) */}
      {createPortal(
        <AnimatePresence>
          {selectedEpisodeForComments && (() => {
            const epKey = `S${selectedEpisodeForComments.seasonNum}E${selectedEpisodeForComments.episodeNum}`;
          const comments = episodeComments[epKey] || [];
          const isLoading = loadingEpisodeComments[epKey];

          // Filter by active tab
          const activeComments = comments.filter(c => c.source === activeEpisodeReviewTab);

          // Sort local comments
          const sortedEpisodeComments = [...activeComments].sort((a, b) => {
            if (reviewsSortOrder === 'reactions') {
              const scoreA = getReactionScore(a);
              const scoreB = getReactionScore(b);
              if (scoreB !== scoreA) return scoreB - scoreA;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md"
              onClick={() => setSelectedEpisodeForComments(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                transition={{ type: 'spring', duration: 0.4 }}
                className="bg-[#0B0B0C] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-black/80 relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-zinc-900/10">
                  <div className="space-y-1 text-left">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                      Season {selectedEpisodeForComments.seasonNum}, Episode {selectedEpisodeForComments.episodeNum}
                    </span>
                    <h3 className="text-lg font-display font-bold text-zinc-100 leading-tight">
                      {selectedEpisodeForComments.title || 'Untitled Episode'}
                    </h3>
                    {selectedEpisodeForComments.overview && (
                      <p className="text-xs text-zinc-400 font-light line-clamp-2 max-w-xl light-mode-readable-text-sm">
                        {selectedEpisodeForComments.overview}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedEpisodeForComments(null)}
                    className="p-2 bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 hover:border-white/10 rounded-xl text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer active:scale-95"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub-header controls */}
                <div className="px-5 py-3 border-b border-white/5 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5 text-[10px] font-bold">
                      <button
                        onClick={() => setActiveEpisodeReviewTab('trakt')}
                        className={`px-3 py-1.5 rounded transition-all cursor-pointer select-none ${
                          activeEpisodeReviewTab === 'trakt'
                            ? 'bg-amber-500 text-zinc-950 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        }`}
                      >
                        TRAKT
                      </button>
                      <button
                        onClick={() => setActiveEpisodeReviewTab('imdb')}
                        className={`px-3 py-1.5 rounded transition-all cursor-pointer select-none ${
                          activeEpisodeReviewTab === 'imdb'
                            ? 'bg-yellow-500 text-zinc-950 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        }`}
                      >
                        IMDb
                      </button>

                    </div>
                  </div>

                  {activeComments.length > 1 && (
                    <div className="flex bg-zinc-950/80 p-0.5 rounded-lg border border-white/5 text-[9px] font-bold">
                      <button
                        onClick={() => setReviewsSortOrder('reactions')}
                        className={`px-2 py-1 rounded transition-all cursor-pointer select-none ${
                          reviewsSortOrder === 'reactions'
                            ? 'bg-amber-500 text-zinc-950 font-extrabold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        🔥 POPULAR
                      </button>
                      <button
                        onClick={() => setReviewsSortOrder('newest')}
                        className={`px-2 py-1 rounded transition-all cursor-pointer select-none ${
                          reviewsSortOrder === 'newest'
                            ? 'bg-amber-500 text-zinc-950 font-extrabold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        ⏰ NEWEST
                      </button>
                    </div>
                  )}
                </div>

                {/* Comment Body List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[250px] no-scrollbar">
                  {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B0B0C]/80 z-10">
                      <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                      <span className="text-sm text-zinc-400 font-medium animate-pulse">Fetching episode comments...</span>
                    </div>
                  ) : activeComments.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <div className="w-12 h-12 bg-zinc-900/50 rounded-full flex items-center justify-center mx-auto text-zinc-500">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-zinc-300">No episode discussions found</p>
                        <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">Be the first to start a conversation for this episode!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-left">
                      {sortedEpisodeComments.map((cmt) => (
                        <div key={cmt.id} className="bg-zinc-900/30 border border-white/5 rounded-xl p-4 space-y-3 text-xs transition-all hover:bg-zinc-900/40 hover:border-white/10">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 overflow-hidden flex items-center justify-center text-amber-500 font-black text-xs">
                                {cmt.avatarPath ? (
                                  <img
                                    src={cmt.avatarPath}
                                    alt={cmt.author}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  cmt.author.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-zinc-200 block text-xs">{cmt.author}</span>
                                {cmt.username && (
                                  <span className="text-[10px] text-zinc-500 block font-mono">@{cmt.username}</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {cmt.source === 'imdb' ? (
                                <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-[9px] font-extrabold tracking-wider font-sans">
                                  IMDb
                                </span>
                              ) : cmt.source === 'trakt' ? (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-extrabold tracking-wider font-sans">
                                  TRAKT.TV
                                </span>
                              ) : null}
                              {cmt.rating && (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded text-[10px] font-black font-mono">
                                  {cmt.rating}/10
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(cmt.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                          
                          {cmt.spoiler && !revealedSpoilers[cmt.id] ? (
                            <div className="relative overflow-hidden rounded-lg border border-rose-500/10 bg-rose-500/5 p-4 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-rose-400">
                                <EyeOff className="w-4 h-4 shrink-0" />
                                <div className="text-left">
                                  <p className="text-xs font-bold">Spoiler Warning</p>
                                  <p className="text-[10px] text-rose-400/70">This review contains plot details.</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setRevealedSpoilers(prev => ({ ...prev, [cmt.id]: true }))}
                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-xs font-bold text-rose-300 transition-all cursor-pointer select-none active:scale-95"
                              >
                                Reveal
                              </button>
                            </div>
                          ) : (
                            <p className="text-zinc-200 font-normal leading-relaxed whitespace-pre-wrap text-sm light-mode-readable-text">
                              {cmt.content}
                            </p>
                          )}

                          {/* Reactions bar with full emoji interactions */}
                          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-white/5">
                            {cmt.source === 'imdb' ? (
                              <>
                                {cmt.likes !== undefined && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Helpful Votes">
                                    <ThumbsUp className="w-3.5 h-3.5 text-yellow-500" />
                                    <span>{cmt.likes} helpful</span>
                                  </div>
                                )}
                                {cmt.downVotes !== undefined && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Not Helpful Votes">
                                    <ThumbsDown className="w-3.5 h-3.5 text-zinc-500" />
                                    <span>{cmt.downVotes} not helpful</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {cmt.likes !== undefined && cmt.likes > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Original Likes">
                                    <ThumbsUp className="w-3.5 h-3.5 text-amber-500" />
                                    <span>{cmt.likes}</span>
                                  </div>
                                )}

                                {cmt.replies !== undefined && cmt.replies > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/40 px-2 py-1 rounded-lg border border-white/5" title="Original Replies">
                                    <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                                    <span>{cmt.replies}</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-1 bg-zinc-950/30 p-0.5 rounded-lg border border-white/5">
                                  {['👍', '❤️', '😂', '😮', '😢'].map((emoji) => {
                                    const base = getCommentReactions(cmt.id, cmt.likes || 0, cmt.rating, cmt.content);
                                    const count = base[emoji] || 0;
                                    const isSelected = userSelectedReactions[cmt.id] === emoji;

                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => handleEmojiClick(cmt.id, emoji)}
                                        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[13px] transition-all cursor-pointer select-none active:scale-90 ${
                                          isSelected
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/35 scale-105 font-bold shadow-md'
                                            : 'hover:bg-white/5 border border-transparent text-zinc-400 hover:text-zinc-200'
                                        }`}
                                      >
                                        <span>{emoji}</span>
                                        {count > 0 && <span className="font-mono text-[10px] font-bold">{count}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-zinc-950/40 flex items-center justify-end">
                  <button
                    onClick={() => setSelectedEpisodeForComments(null)}
                    className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer select-none active:scale-95 shadow-lg"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
