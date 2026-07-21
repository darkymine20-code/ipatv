/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';

interface WebtorPlayerProps {
  magnet?: string;
  magnetUrl?: string;
  onClose?: () => void;
  title?: string;
  className?: string;
}

export function WebtorPlayer({ magnet, magnetUrl, onClose, title, className }: WebtorPlayerProps) {
  const containerId = "webtor-player-container";
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);
  
  const finalMagnet = magnet || magnetUrl || '';

  useEffect(() => {
    if (!finalMagnet) {
      setError("No magnet link provided for playback.");
      setIsLoading(false);
      return;
    }

    // 1. Check if webtor script is already loaded
    const scriptId = 'webtor-embed-sdk-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initPlayer = () => {
      try {
        const win = window as any;
        win.webtor = win.webtor || [];
        
        // Clear previous players in the same div
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '';
        }

        win.webtor.push({
          id: containerId,
          magnet: finalMagnet,
          on: function(e: any) {
            if (e.name === 'init') {
              setIsLoading(false);
            }
          },
        });
      } catch (err: any) {
        console.error("Webtor player init error:", err);
        setError("Failed to initialize Webtor player. Please check your browser's third-party cookies or connection settings.");
        setIsLoading(false);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdn.jsdelivr.net/npm/@webtor/embed-sdk-js/dist/index.min.js';
      script.charset = 'utf-8';
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        initPlayer();
      };
      script.onerror = () => {
        setError("Failed to load Webtor streaming engine from CDN. Check your connection.");
        setIsLoading(false);
      };
      document.body.appendChild(script);
    } else {
      // Script is already there, give it a tiny delay to ensure window.webtor is ready
      setTimeout(() => {
        initPlayer();
      }, 100);
    }

    return () => {
      // Cleanup previous player items
    };
  }, [magnet]);

  return (
    <div className="flex flex-col bg-zinc-950/95 border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative w-full h-full min-h-[450px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border-b border-white/5 z-10">
        <div className="flex flex-col max-w-[80%]">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Webtor WebRTC In-App Streamer</span>
          <p className="text-xs font-semibold text-zinc-100 truncate mt-0.5">{title || "Stream Playback"}</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer text-zinc-400 hover:text-white"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        )}
      </div>

      {/* Main stage */}
      <div className="relative flex-grow bg-black flex items-center justify-center min-h-[350px]">
        {isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-xs font-medium text-zinc-400">Booting Webtor WebRTC streaming node...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 gap-3 px-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-xs font-semibold text-zinc-300">{error}</p>
            <p className="text-[10px] text-zinc-500 max-w-[280px]">Ensure third-party cookies or scripts are not blocked in your browser settings (required for Webtor iframe player).</p>
          </div>
        )}

        {/* The video container */}
        <div 
          id={containerId} 
          className="w-full h-full min-h-[350px] flex-grow webtor-embedded-frame"
        />
      </div>
    </div>
  );
}
