import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { videoCacheManager, supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface OptimizedVideoPlayerProps {
  videoUrl: string;
  videoId: string;
  isActive: boolean;
  onVideoClick?: () => void;
  caption?: string;
  username?: string;
  music?: string;
  filter?: string;
}

export function OptimizedVideoPlayer({
  videoUrl,
  videoId,
  isActive,
  onVideoClick,
  caption,
  username,
  music,
  filter = 'none'
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isInViewport, setIsInViewport] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // 1. Viewport Detection (Detecting if video is on screen)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInViewport(entry.isIntersecting);
        });
      },
      { threshold: 0.5 } // 50% video dikhte hi count karega
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. VIEWS LOGIC WITH DEBUGGER
  useEffect(() => {
    if (isInViewport && isActive && videoId) {
      const triggerView = async () => {
        const { error } = await supabase.rpc('increment_views', { 
          post_id: videoId 
        });
        
        if (error) {
          console.error("View Error:", error.message);
        } else {
          console.log("View Success!");
        }
      };
      
      // Chhota sa delay
      const timer = setTimeout(triggerView, 1000);
      return () => clearTimeout(timer);
    }
  }, [isInViewport, isActive, videoId]);

  // 3. Playback Controls
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isInViewport && isActive && hasLoaded) {
      video.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isInViewport, isActive, hasLoaded]);

  // 4. Loading & Cache
  useEffect(() => {
    if (isInViewport && isActive && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isInViewport, isActive]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const filterStyles: Record<string, string> = {
    none: '', grayscale: 'grayscale(100%)', sepia: 'sepia(100%)',
    blur: 'blur(2px)', brightness: 'brightness(1.2)', contrast: 'contrast(1.3)', saturate: 'saturate(1.5)',
  };

  return (
    <div ref={containerRef} className="relative w-full h-[100dvh] bg-black overflow-hidden" onClick={onVideoClick}>
      
      {/* --- DEBUG BOX (Ise dekh kar mujhe batao kya likha hai) --- */}
      <div className="absolute top-20 left-4 z-[100] bg-red-600 text-white text-[10px] font-bold p-2 rounded shadow-lg">
        V: {isInViewport ? 'VISIBLE' : 'HIDDEN'} | A: {isActive ? 'ACTIVE' : 'OFF'} | ID: {videoId ? 'OK' : 'MISSING'}
      </div>

      <video
        ref={videoRef}
        // object-contain ensures video fits without cutting
        className="absolute inset-0 w-full h-full object-contain bg-black"
        src={hasLoaded ? videoUrl : undefined}
        loop
        muted={isMuted}
        playsInline
        style={{ filter: filterStyles[filter] || '' }}
        onLoadedData={() => setHasLoaded(true)}
      />

      {/* Overlays */}
      {!isPlaying && hasLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <Play className="w-12 h-12 text-white fill-white opacity-50" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-10">
        <div className="text-white mb-16">
          <p className="font-bold">@{username || 'User'}</p>
          <p className="text-sm opacity-90">{caption}</p>
        </div>
      </div>

      <button onClick={toggleMute} className="absolute top-6 right-6 bg-black/40 p-3 rounded-full z-20">
        {isMuted ? <VolumeX className="text-white" /> : <Volume2 className="text-white" />}
      </button>
    </div>
  );
}
