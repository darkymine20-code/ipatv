import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Play, Check, Award, TrendingUp, Info, Calendar, Clock, Sparkles, Table } from 'lucide-react';
import { MediaItem, Season, Episode } from '../types';

interface EpisodeRatingsTableModalProps {
  item: MediaItem;
  seasons: Season[];
  watchedMap: Record<string, boolean>;
  onClose: () => void;
  toggleEpisodeWatched: (showId: number, seasonNum: number, episodeNum: number, totalEpisodesInShow: number, fullItem?: MediaItem) => void;
  totalEpisodesInShow: number;
  handlePlayEpisode: (seasonNum: number, episodeNum: number) => void;
}

export function EpisodeRatingsTableModal({
  item,
  seasons,
  watchedMap,
  onClose,
  toggleEpisodeWatched,
  totalEpisodesInShow,
  handlePlayEpisode,
}: EpisodeRatingsTableModalProps) {
  // Extract all episodes as a flat list
  const allEpisodes = useMemo(() => {
    const list: Episode[] = [];
    seasons.forEach((s) => {
      s.episodes.forEach((e) => {
        list.push(e);
      });
    });
    return list;
  }, [seasons]);

  // Find next unwatched episode or default to first episode
  const defaultSelectedEpisode = useMemo(() => {
    const nextUnwatched = allEpisodes.find((ep) => {
      const epKey = `S${ep.season}E${ep.episode}`;
      return !watchedMap[epKey];
    });
    return nextUnwatched || allEpisodes[0] || null;
  }, [allEpisodes, watchedMap]);

  // Track currently selected/hovered episode for the detailed preview panel
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(defaultSelectedEpisode);

  // If selected episode becomes null (e.g., list updated), sync back to default
  React.useEffect(() => {
    if (!selectedEpisode && defaultSelectedEpisode) {
      setSelectedEpisode(defaultSelectedEpisode);
    }
  }, [defaultSelectedEpisode, selectedEpisode]);

  // Calculate statistics
  const stats = useMemo(() => {
    const rated = allEpisodes.filter((ep) => ep.voteAverage && ep.voteAverage > 0);
    if (rated.length === 0) {
      return {
        averageRating: 0,
        highestRated: null,
        lowestRated: null,
      };
    }

    const sum = rated.reduce((acc, ep) => acc + (ep.voteAverage || 0), 0);
    const averageRating = Number((sum / rated.length).toFixed(2));

    const sortedByRatingDesc = [...rated].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
    const highestRated = sortedByRatingDesc[0];
    const lowestRated = sortedByRatingDesc[sortedByRatingDesc.length - 1];

    return {
      averageRating,
      highestRated,
      lowestRated,
    };
  }, [allEpisodes]);

  // Find the maximum number of episodes in any season to construct table columns
  const maxEpisodesCount = useMemo(() => {
    return seasons.reduce((max, s) => Math.max(max, s.episodes.length), 0);
  }, [seasons]);

  const getRatingColor = (rating: number | undefined) => {
    if (!rating || rating === 0) return {
      bg: 'bg-violet-500 text-violet-950 hover:bg-violet-400',
      text: 'text-violet-400',
      border: 'border-violet-600/30 shadow-md shadow-violet-500/10',
      label: 'N/A',
      accent: 'border-violet-500',
      textSec: 'text-violet-950/70',
      badge: 'bg-violet-500/10 text-violet-400 border-violet-500/30'
    };
    if (rating >= 8.5) return {
      bg: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400',
      text: 'text-emerald-400',
      border: 'border-emerald-600/30 shadow-md shadow-emerald-500/10',
      label: 'Outstanding',
      accent: 'border-emerald-500',
      textSec: 'text-emerald-950/70',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    };
    if (rating >= 7.5) return {
      bg: 'bg-cyan-400 text-cyan-950 hover:bg-cyan-300',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30 shadow-md shadow-cyan-400/10',
      label: 'Great',
      accent: 'border-cyan-400',
      textSec: 'text-cyan-950/70',
      badge: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30'
    };
    if (rating >= 6.5) return {
      bg: 'bg-amber-400 text-amber-950 hover:bg-amber-300',
      text: 'text-amber-400',
      border: 'border-amber-500/30 shadow-md shadow-amber-400/10',
      label: 'Good',
      accent: 'border-amber-400',
      textSec: 'text-amber-950/70',
      badge: 'bg-amber-400/10 text-amber-400 border-amber-400/30'
    };
    return {
      bg: 'bg-rose-500 text-rose-950 hover:bg-rose-400',
      text: 'text-rose-400',
      border: 'border-rose-600/30 shadow-md shadow-rose-500/10',
      label: 'Mixed',
      accent: 'border-rose-500',
      textSec: 'text-rose-950/70',
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    };
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 md:p-10 select-none overflow-y-auto">
      {/* Decorative Blur Ambient */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/2 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Modal Window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-5xl bg-[#09090A] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-hidden"
      >
        
        {/* Header Block */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0 bg-gradient-to-r from-zinc-950 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-base sm:text-lg text-white leading-tight uppercase tracking-wider">
                {item.title} — Episode Ratings
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Color-coded episode ratings visualization. Click any cell to explore, toggle status, or play.
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full border border-white/5 transition-all cursor-pointer"
            title="Close Visualizer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner Content Scroller */}
        <div className="flex-grow overflow-y-auto p-5 space-y-6 no-scrollbar">
          
          {/* Statistics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Stat 1: Average Rating */}
            <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <Star className="w-5 h-5 fill-current" />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Series Avg Rating</span>
                <span className="block text-xl font-display font-black text-[#F5F5F5]">
                  {stats.averageRating > 0 ? `${stats.averageRating} / 10` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Stat 2: Highest Rated Episode */}
            {stats.highestRated ? (
              <div 
                onClick={() => setSelectedEpisode(stats.highestRated)}
                className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex items-center gap-4 hover:border-emerald-500/30 transition-all cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-all">
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                    Highest Rated Episode
                  </span>
                  <span className="block text-xs font-black text-[#F5F5F5] truncate group-hover:text-emerald-400 transition-colors">
                    S{stats.highestRated.season}:E{stats.highestRated.episode} — {stats.highestRated.title}
                  </span>
                  <span className="block text-[11px] font-bold text-emerald-400">
                    ★ {stats.highestRated.voteAverage} / 10
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Highest Rated</span>
                  <span className="block text-xs font-semibold text-zinc-400">No ratings loaded</span>
                </div>
              </div>
            )}

            {/* Stat 3: Total Progress */}
            <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Watched Progress</span>
                <span className="block text-xl font-display font-black text-[#F5F5F5]">
                  {Object.keys(watchedMap).length} / {totalEpisodesInShow}
                </span>
                {/* Micro progress bar */}
                <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-1 border border-white/5">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalEpisodesInShow > 0 ? (Object.keys(watchedMap).length / totalEpisodesInShow) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* TABLE MATRIX CONTAINER */}
          <div className="border border-white/5 rounded-xl bg-zinc-950/50 p-4 space-y-4">
            
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                Visual Ratings Matrix
              </span>
              
              {/* Color legend formatted like periodic table blocks */}
              <div className="flex flex-wrap gap-3.5 items-center text-[10px] font-extrabold">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-emerald-500 text-emerald-950 flex items-center justify-center text-[8.5px] font-black shadow-sm">9.0</span>
                  <span className="text-zinc-400">≥ 8.5 Outstanding</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-cyan-400 text-cyan-950 flex items-center justify-center text-[8.5px] font-black shadow-sm">8.0</span>
                  <span className="text-zinc-400">7.5 - 8.4 Great</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-amber-400 text-amber-950 flex items-center justify-center text-[8.5px] font-black shadow-sm">7.0</span>
                  <span className="text-zinc-400">6.5 - 7.4 Good</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-rose-500 text-rose-950 flex items-center justify-center text-[8.5px] font-black shadow-sm text-center">6.0</span>
                  <span className="text-zinc-400">&lt; 6.5 Mixed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-violet-500 text-violet-950 flex items-center justify-center text-[8.5px] font-black shadow-sm">-</span>
                  <span className="text-zinc-400">N/A</span>
                </div>
              </div>
            </div>

            {/* Scrollable Matrix Table itself */}
            <div className="overflow-x-auto border border-white/5 rounded-xl bg-[#070708] premium-scrollbar pb-2">
              <table 
                className="w-full border-collapse text-center"
                style={{ minWidth: `${96 + maxEpisodesCount * 64}px` }}
              >
                <thead>
                  <tr className="border-b border-white/5 bg-zinc-900/30">
                    <th className="py-3.5 px-4 text-xs font-black text-zinc-300 uppercase tracking-widest text-left w-24 border-r border-white/5">
                      Season
                    </th>
                    {Array.from({ length: maxEpisodesCount }, (_, i) => (
                      <th key={i} className="py-3.5 px-1 text-xs font-black text-zinc-400 uppercase tracking-wider w-14">
                        E{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((season) => (
                    <tr key={season.seasonNumber} className="border-b border-white/5 hover:bg-white/1 flex-row">
                      {/* Row Header */}
                      <td className="py-3.5 px-4 text-xs font-black text-white text-left border-r border-white/5 bg-zinc-900/10">
                        Season {season.seasonNumber}
                      </td>
                      
                      {/* Cell list representing episodes */}
                      {Array.from({ length: maxEpisodesCount }, (_, epIdx) => {
                        const episodeNum = epIdx + 1;
                        const ep = season.episodes.find((e) => e.episode === episodeNum);
                        
                        if (!ep) {
                          // Disabled cell for non-existing episodes
                          return (
                            <td key={epIdx} className="p-0.5 opacity-10">
                              <div className="w-14 h-14 mx-auto rounded-md border border-dashed border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-700">
                                -
                              </div>
                            </td>
                          );
                        }

                        const ratingColors = getRatingColor(ep.voteAverage);
                        const epKey = `S${season.seasonNumber}E${ep.episode}`;
                        const isWatched = !!watchedMap[epKey];
                        const isSelected = selectedEpisode?.id === ep.id;

                        return (
                          <td key={epIdx} className="p-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedEpisode(ep)}
                              onDoubleClick={() => handlePlayEpisode(season.seasonNumber, ep.episode)}
                              className={`w-14 h-14 mx-auto rounded-md flex flex-col justify-between items-center p-1.5 relative transition-all duration-150 cursor-pointer ${ratingColors.bg} ${ratingColors.border} ${
                                isSelected 
                                  ? 'ring-2 ring-white scale-105 z-10 shadow-xl shadow-amber-500/10' 
                                  : 'hover:scale-105 hover:z-10'
                              }`}
                              title={`S${season.seasonNumber}E${ep.episode}: ${ep.title} (${ep.voteAverage || 'No rating'})`}
                            >
                              {/* Chemistry style Top row: Episode number as atomic number (left) and checkmark (right) */}
                              <div className="w-full flex justify-between items-center text-[8.5px] font-black uppercase leading-none">
                                <span className={ratingColors.textSec}>
                                  {ep.episode}
                                </span>
                                {isWatched ? (
                                  <span className="text-[9px] font-black leading-none text-current/80">
                                    ✔
                                  </span>
                                ) : (
                                  <span className="opacity-0">.</span>
                                )}
                              </div>
                              
                              {/* Chemistry style Center: Big Element Symbol = Rating */}
                              <span className="text-[13px] sm:text-[14px] font-black leading-none tracking-tighter mt-0.5">
                                {ep.voteAverage && ep.voteAverage > 0 ? ep.voteAverage.toFixed(1) : '—'}
                              </span>
                              
                              {/* Chemistry style Bottom: Chemical abbreviation (Ep for Episode) */}
                              <span className={`text-[7px] font-extrabold uppercase leading-none tracking-wider ${ratingColors.textSec}`}>
                                Ep
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-zinc-500 font-semibold text-center italic mt-1 leading-normal">
              💡 Tip: Hover or tap any cell to view detailed plot synopsis. Double-click any cell to launch that stream instantly!
            </p>
          </div>

          {/* ACTIVE SELECTED EPISODE DETAILS / CONTROL PREVIEW PANEL */}
          <div className="border border-white/5 rounded-xl bg-zinc-900/20 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 opacity-60" />
            
            <AnimatePresence mode="wait">
              {selectedEpisode ? (
                <motion.div
                  key={selectedEpisode.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="p-5"
                >
                  <div className="flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                    
                    {/* Left text block */}
                    <div className="space-y-2 flex-1 min-w-0">
                      
                      {/* Meta header labels */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 bg-zinc-850 text-[#F5F5F5] border border-white/5 rounded text-[10px] font-black uppercase tracking-wider shrink-0">
                          Season {selectedEpisode.season} • Episode {selectedEpisode.episode}
                        </span>
                        
                        {selectedEpisode.voteAverage && selectedEpisode.voteAverage > 0 ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 border ${getRatingColor(selectedEpisode.voteAverage).border} ${getRatingColor(selectedEpisode.voteAverage).text}`}>
                            Rating: ★ {selectedEpisode.voteAverage.toFixed(1)}
                          </span>
                        ) : null}

                        {selectedEpisode.airDate && (
                          <span className="text-[10px] text-zinc-500 font-bold shrink-0 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {selectedEpisode.airDate}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="font-display font-black text-white text-base sm:text-lg leading-tight truncate">
                        {selectedEpisode.title}
                      </h4>

                      {/* Overview */}
                      <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed line-clamp-3">
                        {selectedEpisode.overview || 'No description available.'}
                      </p>
                    </div>

                    {/* Right interactive CTA panel */}
                    <div className="flex flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0 self-stretch justify-end">
                      
                      {/* Toggle watched */}
                      <button
                        onClick={() => {
                          toggleEpisodeWatched(
                            item.id,
                            selectedEpisode.season,
                            selectedEpisode.episode,
                            totalEpisodesInShow,
                            item
                          );
                        }}
                        className={`flex-1 md:flex-initial py-2.5 px-4 border rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          watchedMap[`S${selectedEpisode.season}E${selectedEpisode.episode}`]
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-zinc-950 border-white/5 hover:border-white/15 text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        <Check className={`w-4 h-4 text-emerald-400 transition-all ${watchedMap[`S${selectedEpisode.season}E${selectedEpisode.episode}`] ? 'scale-100' : 'scale-75 opacity-50'}`} />
                        <span>
                          {watchedMap[`S${selectedEpisode.season}E${selectedEpisode.episode}`] ? 'Watched' : 'Mark Watched'}
                        </span>
                      </button>

                      {/* Play Stream now */}
                      <button
                        onClick={() => {
                          handlePlayEpisode(selectedEpisode.season, selectedEpisode.episode);
                          onClose(); // Auto-close visualizer table so user sees the active video player instantly
                        }}
                        className="flex-1 md:flex-initial py-2.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10 cursor-pointer active:scale-97"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                        <span>Play Stream</span>
                      </button>

                    </div>

                  </div>
                </motion.div>
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500 font-semibold italic">
                  Select any cell in the grid above to view details and controls.
                </div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </motion.div>
    </div>
  );
}
