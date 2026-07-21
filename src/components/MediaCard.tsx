/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MediaItem } from '../types';
import { Star, Heart, Bookmark, CheckCircle2 } from 'lucide-react';

interface MediaCardProps {
  key?: React.Key;
  item: MediaItem;
  onClick: () => void;
  onToggleWatchlist?: (e: React.MouseEvent) => void;
  watchedEpisodesCount?: number;
  totalEpisodesCount?: number;
  upcomingEpisode?: {
    seasonNumber: number;
    episodeNumber: number;
    airDate: string;
    airTime: string;
  } | null;
}

export function MediaCard({ 
  item, 
  onClick, 
  onToggleWatchlist, 
  watchedEpisodesCount = 0, 
  totalEpisodesCount = 0,
  upcomingEpisode = null
}: MediaCardProps) {
  const hasProgress = item.type === 'show' && totalEpisodesCount > 0;
  const progressPercent = hasProgress ? Math.min(100, Math.round((watchedEpisodesCount / totalEpisodesCount) * 100)) : 0;

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

  const countdown = upcomingEpisode ? getDetailedCountdown(upcomingEpisode.airDate, upcomingEpisode.airTime) : null;

  return (
    <div
      id={`media-card-${item.type}-${item.id}`}
      onClick={onClick}
      className="group relative flex flex-col bg-zinc-900/40 rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 hover:bg-zinc-900/90 hover:shadow-2xl hover:shadow-black/60 transition-all duration-300 cursor-pointer select-none"
    >
      {/* Image container */}
      <div className="relative aspect-[2/3] w-full bg-[#050505] overflow-hidden">
        <img
          src={item.posterPath || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop'}
          alt={item.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* Gradients and shadows */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

        {/* Action icons status overlays */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          {item.isFavorite && (
            <span className="p-1.5 bg-rose-600/90 text-white rounded-lg backdrop-blur-md shadow-md animate-fade-in">
              <Heart className="w-3.5 h-3.5 fill-current" />
            </span>
          )}
          {onToggleWatchlist ? (
            <button
              onClick={onToggleWatchlist}
              className={`p-1.5 rounded-lg backdrop-blur-md shadow-md transition-all ${item.inWatchlist ? 'bg-amber-500/90 text-zinc-950 hover:bg-amber-400' : 'bg-black/60 text-zinc-300 hover:bg-black/80 hover:text-white border border-white/10'}`}
              title={item.inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
            >
              <Bookmark className={`w-3.5 h-3.5 ${item.inWatchlist ? 'fill-current' : ''}`} />
            </button>
          ) : (
            item.inWatchlist && (
              <span className="p-1.5 bg-amber-500/90 text-zinc-950 rounded-lg backdrop-blur-md shadow-md">
                <Bookmark className="w-3.5 h-3.5 fill-current" />
              </span>
            )
          )}
          {item.completed && (
            <span className="p-1.5 bg-emerald-600/90 text-white rounded-lg backdrop-blur-md shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Floating rating overlay */}
        {(item.userRating !== null && item.userRating !== undefined) ? (
          <div className={`absolute left-2 flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-zinc-950 font-bold rounded-md text-[11px] transition-all z-10 ${countdown ? 'bottom-11' : 'bottom-2'}`}>
            <Star className="w-3 h-3 fill-zinc-950 text-zinc-950" />
            <span>{item.userRating}</span>
          </div>
        ) : (item.rating > 0 && (
          <div className={`absolute left-2 flex items-center gap-1 px-2 py-0.5 bg-black/75 backdrop-blur-md border border-white/5 rounded-md text-[11px] font-medium text-amber-500 transition-all z-10 ${countdown ? 'bottom-11' : 'bottom-2'}`}>
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span>{item.rating}</span>
          </div>
        ))}

        {/* Floating countdown overlay */}
        {countdown && (
          <div className="absolute inset-x-0 bottom-0 bg-[#070707]/95 border-t border-amber-500/30 backdrop-blur-md p-2 flex flex-col gap-0.5 select-none z-20 shadow-lg">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[8px] font-extrabold uppercase text-amber-500 tracking-wider">
                S{upcomingEpisode?.seasonNumber}:E{upcomingEpisode?.episodeNumber} Countdown
              </span>
            </div>
            <div className="flex items-baseline gap-1 font-mono text-zinc-100">
              {countdown.days > 0 && (
                <>
                  <span className="text-xs font-black text-amber-400">{countdown.days}</span>
                  <span className="text-[9px] text-zinc-500 font-sans mr-0.5">d</span>
                </>
              )}
              <span className="text-xs font-black text-amber-400">{String(countdown.hours).padStart(2, '0')}</span>
              <span className="text-[9px] text-zinc-500 font-sans mr-0.5">h</span>
              <span className="text-xs font-black text-amber-400">{String(countdown.minutes).padStart(2, '0')}</span>
              <span className="text-[9px] text-zinc-500 font-sans">m</span>
            </div>
          </div>
        )}

        {/* Type badge (Show / Movie) */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/75 backdrop-blur-md border border-white/5 rounded text-[10px] font-bold tracking-wider uppercase text-zinc-400">
          {item.type === 'show' ? 'TV' : 'Movie'}
        </div>
      </div>

      {/* Media Details */}
      <div className="flex flex-col flex-grow p-3 select-none bg-zinc-900/25">
        <h3 className="font-display font-bold text-sm text-[#F5F5F5] group-hover:text-amber-500 transition-colors line-clamp-1 leading-tight">
          {item.title}
        </h3>
        
        <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-500">
          <span>{item.releaseDate ? new Date(item.releaseDate).getFullYear() : 'TBA'}</span>
          
        </div>

        {/* Custom Watch Progress for TV shows in Watchlist */}
        {hasProgress && item.inWatchlist && (
          <div className="mt-2.5 space-y-1 w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between text-[10px] font-medium text-zinc-500">
              <span>Progress</span>
              <span className="text-amber-500">{watchedEpisodesCount} / {totalEpisodesCount} eps</span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* For completed items, show a subtle marker */}
        {item.completed && !hasProgress && (
          <div className="mt-2 text-[10px] text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Watched</span>
          </div>
        )}
      </div>
    </div>
  );
}
