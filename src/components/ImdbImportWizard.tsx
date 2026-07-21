/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Check, 
  AlertCircle, 
  HelpCircle, 
  Tv, 
  Film, 
  Star, 
  CheckCircle2, 
  ArrowRight,
  Play,
  RotateCcw
} from 'lucide-react';
import { MediaItem, MediaType } from '../types';
import { findOrSearchMediaItem } from '../tmdb';

interface ImdbImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  importMultipleMediaItems: (
    itemsToImport: {
      item: MediaItem;
      rating: number | null;
      makeFavorite: boolean;
      completed: boolean;
    }[]
  ) => void;
}

interface ParsedImdbRow {
  imdbId: string;
  title: string;
  rating: number | null;
  type: 'movie' | 'show';
  originalType: string;
  selected: boolean;
}

export function ImdbImportWizard({ isOpen, onClose, importMultipleMediaItems }: ImdbImportWizardProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedImdbRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Progress States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [currentLog, setCurrentLog] = useState('');
  const cancelRef = useRef(false);

  if (!isOpen) return null;

  // Custom CSV Parser supporting quotes and headers
  const parseImdbCsv = (text: string): ParsedImdbRow[] => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if (char === '\n' && !inQuotes) {
        lines.push(currentLine);
        currentLine = '';
      } else if (char === '\r' && !inQuotes) {
        // Skip carriage return
      } else {
        currentLine += char;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return [];

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let field = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(field);
          field = '';
        } else {
          field += char;
        }
      }
      result.push(field);
      return result;
    };

    const firstLine = lines[0];
    if (!firstLine) return [];
    
    const rawHeaders = parseCSVLine(firstLine).map(h => h.trim().replace(/^\uFEFF/, ''));
    
    const imdbIdIndex = rawHeaders.findIndex(h => h.toLowerCase() === 'const' || h.toLowerCase() === 'id' || h.toLowerCase() === 'imdbid');
    const titleIndex = rawHeaders.findIndex(h => h.toLowerCase() === 'title' || h.toLowerCase() === 'name');
    const ratingIndex = rawHeaders.findIndex(h => h.toLowerCase() === 'your rating' || h.toLowerCase() === 'rating' || h.toLowerCase() === 'user rating');
    const typeIndex = rawHeaders.findIndex(h => h.toLowerCase() === 'title type' || h.toLowerCase() === 'type');

    const rows: ParsedImdbRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(lines[i]);
      const rawTitle = titleIndex >= 0 ? values[titleIndex]?.trim() : '';
      if (!rawTitle) continue;

      const rawId = imdbIdIndex >= 0 ? values[imdbIdIndex]?.trim() : '';
      const rawRating = ratingIndex >= 0 ? values[ratingIndex]?.trim() : '';
      const rawType = typeIndex >= 0 ? values[typeIndex]?.trim() : '';

      let rating: number | null = null;
      if (rawRating) {
        const parsedRating = parseFloat(rawRating);
        if (!isNaN(parsedRating)) {
          rating = parsedRating;
        }
      }

      let type: 'movie' | 'show' = 'movie';
      const typeLower = rawType.toLowerCase();
      if (
        typeLower.includes('series') || 
        typeLower.includes('show') || 
        typeLower.includes('tv') || 
        typeLower === 'tvseries' || 
        typeLower === 'tvminiseries'
      ) {
        type = 'show';
      } else {
        type = 'movie';
      }

      rows.push({
        imdbId: rawId,
        title: rawTitle,
        rating,
        type,
        originalType: rawType,
        selected: true
      });
    }

    return rows;
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMsg('Invalid file format. Please upload a valid CSV file.');
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = parseImdbCsv(text);
        if (rows.length === 0) {
          setErrorMsg('No valid shows or movies could be parsed from this CSV.');
          return;
        }
        setParsedRows(rows);
        setStep('preview');
      } catch (err) {
        console.error(err);
        setErrorMsg('An error occurred while parsing the CSV. Please try again.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const selectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const toggleRowSelected = (idx: number) => {
    setParsedRows(prev => prev.map((row, i) => i === idx ? { ...row, selected: !row.selected } : row));
  };

  const toggleRowType = (idx: number) => {
    setParsedRows(prev => prev.map((row, i) => i === idx ? { ...row, type: row.type === 'movie' ? 'show' : 'movie' } : row));
  };

  const selectAll = () => {
    setParsedRows(prev => prev.map(row => ({ ...row, selected: true })));
  };

  const selectNone = () => {
    setParsedRows(prev => prev.map(row => ({ ...row, selected: false })));
  };

  // Run the batch import with delays
  const startImport = async () => {
    const selectedRows = parsedRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      setErrorMsg('Please select at least one item to import.');
      return;
    }

    setStep('importing');
    setCurrentIndex(0);
    setSuccessCount(0);
    setFailCount(0);
    setImportLogs([]);
    setCurrentLog('Initializing import connection...');
    cancelRef.current = false;

    const importedItems: {
      item: MediaItem;
      rating: number | null;
      makeFavorite: boolean;
      completed: boolean;
    }[] = [];

    // Utility sleep to avoid hitting API rate limits
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < selectedRows.length; i++) {
      if (cancelRef.current) {
        addLog(`[Cancelled] Import process was stopped by user.`);
        break;
      }

      const row = selectedRows[i];
      setCurrentIndex(i + 1);
      setCurrentLog(`Searching TMDB for "${row.title}"...`);

      try {
        // Find item in TMDB
        const matchedItem = await findOrSearchMediaItem(row.title, row.type, row.imdbId);
        
        if (matchedItem) {
          const makeFav = row.rating !== null && row.rating >= 8;
          importedItems.push({
            item: matchedItem,
            rating: row.rating,
            makeFavorite: makeFav,
            completed: true
          });
          
          setSuccessCount(prev => prev + 1);
          addLog(`[Match] "${row.title}" matched with TMDB ID: ${matchedItem.id}${makeFav ? ' (⭐ Added to Favorites)' : ''}`);
        } else {
          setFailCount(prev => prev + 1);
          addLog(`[Not Found] Could not find TMDB match for "${row.title}"`);
        }
      } catch (err) {
        setFailCount(prev => prev + 1);
        addLog(`[Error] Failed to process "${row.title}" due to connection error`);
      }

      // 250ms gap to comply with TMDB rate guidelines
      await sleep(250);
    }

    // Call the bulk state update atomically
    if (importedItems.length > 0) {
      importMultipleMediaItems(importedItems);
    }

    setCurrentLog('Done!');
    setStep('complete');
  };

  const addLog = (msg: string) => {
    setImportLogs(prev => [msg, ...prev.slice(0, 49)]); // keep last 50 logs
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setStep('preview');
  };

  const handleReset = () => {
    setParsedRows([]);
    setStep('upload');
    setErrorMsg(null);
  };

  const selectedCount = parsedRows.filter(r => r.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0A0A0A] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0D0D0D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Upload className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-[#F5F5F5] tracking-tight">
                IMDb CSV Import Wizard
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                STEP {step === 'upload' ? '1' : step === 'preview' ? '2' : step === 'importing' ? '3' : '4'} OF 4
              </p>
            </div>
          </div>
          {step !== 'importing' && (
            <button 
              onClick={onClose}
              className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0 space-y-4">
          
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  dragActive 
                    ? 'border-amber-500 bg-amber-500/5' 
                    : 'border-white/10 hover:border-white/20 bg-zinc-950/30'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="p-4 rounded-full bg-[#111] border border-white/5 text-zinc-400">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-200">
                    Drag and drop your IMDb ratings CSV file
                  </p>
                  <p className="text-xs text-zinc-500">
                    Or click to browse your local computer
                  </p>
                </div>
                <div className="text-[10px] font-mono text-zinc-600 bg-black/40 px-3 py-1.5 rounded-md border border-white/5 mt-2">
                  Supports default IMDb export containing: Title, Your Rating, and Title Type
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".csv" 
                  className="hidden" 
                  onChange={selectFile} 
                />
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/50 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  <span>How to export IMDb Ratings?</span>
                </div>
                <ol className="list-decimal list-inside text-[11px] text-zinc-500 space-y-1.5 pl-1">
                  <li>Go to your IMDb Profile and click on <span className="text-zinc-400">Your Ratings</span>.</li>
                  <li>Click on the three dots <span className="text-zinc-400 font-bold">...</span> in the upper-right corner.</li>
                  <li>Select <span className="text-zinc-400 font-semibold">Export</span> to download your personal `.csv` file.</li>
                  <li>Upload the downloaded `.csv` file here to synchronize instantly.</li>
                </ol>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & CUSTOMIZE */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <div className="text-zinc-400">
                  Parsed <span className="text-[#F5F5F5] font-semibold">{parsedRows.length}</span> items from CSV. Ready to match.
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={selectAll}
                    className="px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:text-amber-400 hover:bg-amber-500/5 rounded transition-all cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-800">|</span>
                  <button 
                    onClick={selectNone}
                    className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Table of Parsed Rows */}
              <div className="border border-white/5 rounded-xl bg-zinc-950/30 overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#111]/70 sticky top-0 border-b border-white/5 text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Title</th>
                      <th className="p-3 w-28">Type</th>
                      <th className="p-3 w-16 text-center">Rating</th>
                      <th className="p-3 w-16 text-center">Fav</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsedRows.map((row, idx) => (
                      <tr 
                        key={idx} 
                        className={`hover:bg-white/[2%] transition-colors ${!row.selected ? 'opacity-40' : ''}`}
                      >
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={row.selected}
                            onChange={() => toggleRowSelected(idx)}
                            className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/50 w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-semibold text-zinc-200">
                          {row.title}
                          {row.imdbId && (
                            <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">
                              {row.imdbId}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => toggleRowType(idx)}
                            disabled={!row.selected}
                            className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-white/5 hover:border-white/10 rounded text-[10px] text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {row.type === 'movie' ? <Film className="w-3 h-3 text-sky-400" /> : <Tv className="w-3 h-3 text-amber-500" />}
                            <span className="capitalize">{row.type === 'movie' ? 'Movie' : 'TV Show'}</span>
                          </button>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#F5F5F5]">
                          {row.rating || '-'}
                        </td>
                        <td className="p-3 text-center">
                          {row.rating !== null && row.rating >= 8 ? (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 mx-auto" />
                          ) : (
                            <span className="text-zinc-600 text-[10px] font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Options Summary Card */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-950/50 rounded-xl border border-white/5 text-xs text-zinc-400 select-none">
                <div className="space-y-1">
                  <div className="text-zinc-500 font-medium">Items Selected:</div>
                  <div className="text-base font-bold text-[#F5F5F5] font-display">
                    {selectedCount} <span className="text-zinc-500 text-xs font-normal">/ {parsedRows.length}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-zinc-500 font-medium">Automatic Favorites (Rating ≥ 8):</div>
                  <div className="text-base font-bold text-amber-500 font-display flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    {parsedRows.filter(r => r.selected && r.rating !== null && r.rating >= 8).length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING PROGRESS */}
          {step === 'importing' && (
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                    {currentLog}
                  </span>
                  <span>
                    {currentIndex} / {parsedRows.filter(r => r.selected).length} ({Math.round((currentIndex / parsedRows.filter(r => r.selected).length) * 100)}%)
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300 rounded-full"
                    style={{ width: `${(currentIndex / parsedRows.filter(r => r.selected).length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Progress Statistics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-950/50 rounded-xl border border-white/5 text-center">
                  <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Processed</span>
                  <span className="font-display font-bold text-lg text-zinc-200">{currentIndex}</span>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded-xl border border-white/5 text-center">
                  <span className="block text-[10px] font-mono text-emerald-500/80 uppercase tracking-wider">Matched</span>
                  <span className="font-display font-bold text-lg text-emerald-400">{successCount}</span>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded-xl border border-white/5 text-center">
                  <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Skipped</span>
                  <span className="font-display font-bold text-lg text-zinc-400">{failCount}</span>
                </div>
              </div>

              {/* Sync Console/Logs */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Sync Console Output</span>
                <div className="p-4 bg-black border border-white/5 rounded-xl h-36 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 select-text scrollbar-thin">
                  {importLogs.map((log, i) => {
                    let colorClass = 'text-zinc-500';
                    if (log.includes('[Match]')) colorClass = 'text-emerald-400';
                    if (log.includes('[Not Found]')) colorClass = 'text-zinc-500';
                    if (log.includes('[Error]')) colorClass = 'text-red-400';
                    if (log.includes('[Cancelled]')) colorClass = 'text-amber-500 font-bold';
                    return (
                      <div key={i} className={colorClass}>
                        {log}
                      </div>
                    );
                  })}
                  {importLogs.length === 0 && (
                    <div className="text-zinc-600 italic">Console initialized. Awaiting results...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETE SUMMARY */}
          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-display font-bold text-lg text-[#F5F5F5]">
                  IMDb Import Completed!
                </h3>
                <p className="text-xs text-zinc-400">
                  Successfully completed syncing your IMDb watch ratings with your TV Tracker account!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-sm p-4 bg-zinc-950/50 rounded-xl border border-white/5">
                <div className="text-center">
                  <span className="block text-2xl font-black text-amber-500 font-display">
                    {successCount}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wide">
                    Matched & Imported
                  </span>
                </div>
                <div className="text-center border-l border-white/5">
                  <span className="block text-2xl font-black text-zinc-400 font-display">
                    {failCount}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wide">
                    Not Found / Skipped
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D0D0D] border border-white/5 text-[11px] text-zinc-500 max-w-md">
                💡 Rated movies are marked as completed. Rated TV shows are added to your tracked watchlist with all episodes watched. Any item rated 8 or above has also been added to your favorites.
              </div>
            </div>
          )}

        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-[#0D0D0D] flex items-center justify-between">
          <div>
            {step === 'preview' && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 hover:bg-white/5 border border-transparent rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload Another</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {step === 'upload' && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-white/5 hover:bg-white/5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step === 'preview' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-white/5 hover:bg-white/5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={startImport}
                  disabled={selectedCount === 0}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md shadow-amber-500/10"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Import ({selectedCount})</span>
                </button>
              </>
            )}

            {step === 'importing' && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Cancel Sync
              </button>
            )}

            {step === 'complete' && (
              <button
                onClick={onClose}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <span>Finish & Sync</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
