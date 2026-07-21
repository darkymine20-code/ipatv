import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsVideoPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  onPlayerError?: (errorEvent: Event) => void;
  title?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  controlsList?: string;
  kuSub?: string;
  enSub?: string;
}

export default function HlsVideoPlayer({ src, onPlayerError, kuSub, enSub, ...props }: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    const handleError = (e: Event) => {
      console.log('Video error encountered for src:', src, e);
      if (onPlayerError) {
        onPlayerError(e);
      }
    };

    video.addEventListener('error', handleError);

    if (src.toLowerCase().includes('.m3u8') || src.toLowerCase().includes('.txt')) {
      if (Hls.isSupported()) {
        hls = new Hls({
          capLevelToPlayerSize: true,
          maxBufferLength: 30,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(err => console.warn('Auto-play prevented:', err));
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.log('Fatal Hls error encountered:', data);
            if (onPlayerError) {
              onPlayerError(new Event('error'));
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = src;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(err => console.warn('Auto-play prevented:', err));
        });
      }
    } else {
      // Standard MP4 or other native formats
      video.src = src;
      if (props.autoPlay) {
        video.play().catch(err => console.warn('Auto-play prevented:', err));
      }
    }

    return () => {
      video.removeEventListener('error', handleError);
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, props.autoPlay, onPlayerError]);

  return (
    <video
      ref={videoRef}
      crossOrigin="anonymous"
      {...props}
    >
      {kuSub && (
        <track
          src={`/api/proxy-subtitle?url=${encodeURIComponent(kuSub)}`}
          label="Kurdish"
          kind="subtitles"
          srcLang="ku"
          default
        />
      )}
      {enSub && (
        <track
          src={`/api/proxy-subtitle?url=${encodeURIComponent(enSub)}`}
          label="English"
          kind="subtitles"
          srcLang="en"
        />
      )}
    </video>
  );
}

