import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { videoCacheManager, supabase } from '@/lib/supabase'; // Supabase add kiya

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

  // Viewport detection using Intersection Observer
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Video is 100% visible in viewport
          setIsInViewport(entry.isIntersecting && entry.intersectionRatio === 1);
        });
      },
      {
        threshold: 1.0, // Trigger when 100% visible
        rootMargin: '0px'
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // --- NAYA BADLAV: Sirf ye 5 lines add ki hain Views ke liye ---
  useEffect(() => {
    if (isInViewport && isActive && videoId) {
      // Database mein ginti badhane ka trigger
      supabase.rpc('increment_views', { post_id: videoId });
    }
  }, [isInViewport, isActive, videoId]);
  // -----------------------------------------------------------

  // Control video playback based on viewport visibility and active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isInViewport && isActive && hasLoaded) {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(error => {
        console.log('Autoplay prevented:', error);
        setIsPlaying(false);
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isInViewport, isActive, hasLoaded]);

  // Load video only when in viewport and active
  useEffect(() => {
    if (isInViewport && isActive && !hasLoaded) {
      // Check cache first
      const cachedUrl = videoCacheManager.get(videoId);
      if (cachedUrl) {
        setHasLoaded(true);
      } else {
        // Cache the URL
        videoCacheManager.set(videoId, videoUrl);
        setHasLoaded(true);
      }
    }
  }, [isInViewport, isActive, videoId, videoUrl, hasLoaded]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoClick = () => {
    if (onVideoClick) {
      onVideoClick();
    } else {
      // Toggle play/pause
      const video = videoRef.current;
      if (video) {
        if (isPlaying) {
          video.pause();
          setIsPlaying(false);
        } else {
          video.play();
          setIsPlaying(true);
        }
      }
    }
  };

  const filterStyles: Record<string, string> = {
    none: '',
    grayscale: 'grayscale(100%)',
    sepia: 'sepia(100%)',
    blur: 'blur(2px)',
    brightness: 'brightness(1.2)',
    contrast: 'contrast(1.3)',
    saturate: 'saturate(1.5)',
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black"
      onClick={handleVideoClick}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={hasLoaded ? videoUrl : undefined}
        loop
        muted={isMuted}
        playsInline
        preload="none"
        style={{
          filter: filterStyles[filter] || ''
        }}
        onLoadedData={() => setHasLoaded(true)}
      />

      {/* Loading Placeholder */}
      {!hasLoaded && isInViewport && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {/* Play Icon Overlay (when paused) */}
      {!isPlaying && hasLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="bg-white/30 backdrop-blur-sm rounded-full p-4">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Video Info Overlay */}
      <div className="absolute bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        <div className="text-white space-y-2">
          <p className="font-semibold">@{username || 'Unknown'}</p>
          {caption && (
            <p className="text-sm line-clamp-2">{caption}</p>
          )}
          {music && (
            <p className="text-xs text-gray-300 flex items-center">
              <span className="mr-2">♪</span>
              {music}
            </p>
          )}
        </div>
      </div>

      {/* Mute/Unmute Button */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm p-3 rounded-full hover:bg-black/70 transition z-10"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Data Saver Indicator */}
      {!hasLoaded && !isInViewport && (
        <div className="absolute top-4 left-4 bg-green-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white font-medium">
          📊 Data Saver Active
        </div>
      )}
    </div>
  );
}
