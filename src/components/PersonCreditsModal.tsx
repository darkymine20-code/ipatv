import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Film, Tv, Calendar, MapPin, Loader2, Award, ArrowUpRight } from 'lucide-react';
import { MediaItem } from '../types';
import { fetchPersonCredits } from '../tmdb';
import { motion, AnimatePresence } from 'motion/react';

interface PersonCreditsModalProps {
  personId: number;
  onClose: () => void;
  onSelectMedia: (item: MediaItem) => void;
}

export function PersonCreditsModal({ personId, onClose, onSelectMedia }: PersonCreditsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<any>(null);
  const [credits, setCredits] = useState<MediaItem[]>([]);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    
    fetchPersonCredits(personId)
      .then(data => {
        if (!active) return;
        setPerson(data.person);
        setCredits(data.credits);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        console.error('Failed to load person credits:', err);
        setError('Failed to fetch person details from TMDB.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [personId]);

  // Trap scroll and handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="relative w-full max-w-5xl h-[85vh] md:h-[80vh] bg-zinc-950 border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 z-10"
      >
        {/* Top Header Controls */}
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={onClose}
            className="p-2 bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 hover:border-white/20 rounded-full text-zinc-400 hover:text-white transition-all cursor-pointer shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-zinc-400 font-medium animate-pulse text-sm font-mono uppercase tracking-wider">Retrieving TMDB Profile...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center">
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl mb-2">
              <X className="w-8 h-8" />
            </div>
            <p className="text-zinc-300 font-semibold">{error}</p>
            <button
              onClick={onClose}
              className="bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-4 py-2 rounded-xl text-sm transition-all"
            >
              Close Window
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column: Biography & Meta */}
            <div className="w-full md:w-[320px] shrink-0 bg-zinc-900/30 border-b md:border-b-0 md:border-r border-white/5 p-6 overflow-y-auto no-scrollbar flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-[140px] h-[140px] md:w-[160px] md:h-[160px] rounded-full overflow-hidden border border-white/10 shadow-xl bg-zinc-900 mb-4 shrink-0">
                  {person.profilePath ? (
                    <img src={person.profilePath} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 font-bold text-4xl">
                      {person.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">{person.name}</h2>
                {person.knownForDepartment && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] uppercase font-bold tracking-wider rounded-full">
                    <Award className="w-3.5 h-3.5" />
                    <span>{person.knownForDepartment}</span>
                  </div>
                )}
              </div>

              {/* Personal Information */}
              <div className="space-y-4 text-xs text-zinc-400 border-t border-white/5 pt-4">
                {person.birthday && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span>Born: <strong className="text-zinc-200 font-medium">{person.birthday}</strong></span>
                  </div>
                )}
                {person.placeOfBirth && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    <span>From: <strong className="text-zinc-200 font-medium">{person.placeOfBirth}</strong></span>
                  </div>
                )}
              </div>

              {/* Biography */}
              {person.biography && (
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <h3 className="font-display font-bold text-zinc-300 text-xs uppercase tracking-wider">Biography</h3>
                  <div className="text-xs text-zinc-400 leading-relaxed font-light whitespace-pre-line relative">
                    <p className={isBioExpanded ? '' : 'line-clamp-[8] md:line-clamp-[12]'}>
                      {person.biography}
                    </p>
                    {person.biography.length > 250 && (
                      <button
                        onClick={() => setIsBioExpanded(!isBioExpanded)}
                        className="text-amber-500 hover:text-amber-400 font-bold mt-2 hover:underline focus:outline-none cursor-pointer block"
                      >
                        {isBioExpanded ? 'Read Less' : 'Read Full Biography'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Credits Grid */}
            <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/20">
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-amber-500" />
                  <h3 className="font-display font-semibold text-white uppercase tracking-wider text-sm sm:text-base">
                    Filmography / Credits ({credits.length})
                  </h3>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">SORTED BY POPULARITY</span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                {credits.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm py-12">
                    No matching movies or shows found on TMDB.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {credits.map((media) => (
                      <button
                        key={`${media.type}-${media.id}`}
                        onClick={() => onSelectMedia(media)}
                        className="flex flex-col text-left group focus:outline-none cursor-pointer"
                      >
                        {/* Poster Canvas */}
                        <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-900 border border-white/5 shadow-md relative group-hover:border-amber-500/50 group-hover:shadow-amber-500/5 transition-all duration-300 mb-2">
                          {media.posterPath ? (
                            <img
                              src={media.posterPath}
                              alt={media.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-900 text-zinc-600">
                              <Film className="w-6 h-6 mb-1 opacity-50" />
                              <span className="text-[10px] font-medium line-clamp-2">{media.title}</span>
                            </div>
                          )}

                          {/* Overlay Badges */}
                          <div className="absolute top-2 left-2 flex flex-col gap-1.5 pointer-events-none">
                            <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-md tracking-wider flex items-center gap-0.5 ${
                              media.type === 'show' ? 'bg-sky-500/90 text-white' : 'bg-amber-500/90 text-zinc-950'
                            }`}>
                              {media.type === 'show' ? <Tv className="w-2 h-2" /> : <Film className="w-2 h-2" />}
                              {media.type === 'show' ? 'Series' : 'Movie'}
                            </span>
                          </div>

                          {/* Quick Action Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-3 transition-opacity duration-300">
                            <div className="flex items-center justify-between text-white">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">View Details</span>
                              <ArrowUpRight className="w-4 h-4 text-amber-400 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </div>
                          </div>
                        </div>

                        {/* Text Metadata */}
                        <h4 className="font-semibold text-xs text-zinc-200 line-clamp-1 group-hover:text-amber-400 transition-colors mb-0.5">
                          {media.title}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                          <span>{media.releaseDate ? new Date(media.releaseDate).getFullYear() : '—'}</span>
                          {media.rating > 0 && (
                            <div className="flex items-center gap-0.5 text-amber-500">
                              <Star className="w-3 h-3 fill-current" />
                              <span>{media.rating}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
