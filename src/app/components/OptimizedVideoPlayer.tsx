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

  // 1. Viewport Detection (Screen par video hai ya nahi)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Mobile friendly threshold: 60% dikhte hi active maana jayega
          setIsInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.6);
        });
      },
      { threshold: [0.6, 1.0], rootMargin: '0px' } // Thoda margin rakha hai taaki aasani se trigger ho
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. VIEWS COUNT LOGIC (Special Fix)
  useEffect(() => {
    // Sirf tab count karega jab video screen par ho, active ho, aur ID maujood ho
    if (isInViewport && isActive && videoId) {
      const triggerView = async () => {
        // 'views_count' badhane wala function call
        const { error } = await supabase.rpc('increment_views', { 
          post_id: videoId 
        });
        
        if (error) {
          console.error("View Error:", error.message);
          // Agar test karna ho toh is line ko uncomment kar lena:
          // alert("View Error: " + error.message);
        } else {
          console.log("View Added Successfully!");
        }
      };
      // Thoda delay taaki scroll karte waqt faaltu counts na badhein (1 sec wait)
      const timer = setTimeout(() => {
        triggerView();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isInViewport, isActive, videoId]);

  // 3. Playback Logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isInViewport && isActive && hasLoaded) {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isInViewport, isActive, hasLoaded]);

  // 4. Data Saver & Caching
  useEffect(() => {
    if (isInViewport && isActive && !hasLoaded) {
      const cachedUrl = videoCacheManager.get(videoId);
      if (cachedUrl) {
        setHasLoaded(true);
      } else {
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
    none: '', grayscale: 'grayscale(100%)', sepia: 'sepia(100%)',
    blur: 'blur(2px)', brightness: 'brightness(1.2)', contrast: 'contrast(1.3)', saturate: 'saturate(1.5)',
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden" onClick={handleVideoClick}>
      <video
        ref={videoRef}
        // --- ZOOM FIX: object-contain laga diya hai ---
        className="absolute inset-0 w-full h-full object-contain bg-black"
        src={hasLoaded ? videoUrl : undefined}
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        style={{ filter: filterStyles[filter] || '' }}
        onLoadedData={() => setHasLoaded(true)}
      />

      {/* Loading Spinner */}
      {!hasLoaded && isInViewport && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {/* Play Icon Overlay */}
      {!isPlaying && hasLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
          <div className="bg-white/30 backdrop-blur-sm rounded-full p-4">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Details Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-30">
        <div className="text-white space-y-2 mb-16">
          <p className="font-bold text-lg drop-shadow-md">@{username || 'Unknown'}</p>
          {caption && <p className="text-sm line-clamp-2 opacity-95 drop-shadow-sm">{caption}</p>}
          {music && (
            <div className="flex items-center text-xs text-gray-200">
              <span className="mr-2 animate-pulse">♪</span>
              <span className="truncate w-40">{music}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mute Button */}
      <button 
        onClick={toggleMute} 
        className="absolute top-6 right-4 bg-black/40 backdrop-blur-md p-2 rounded-full hover:bg-black/60 transition z-40"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>
    </div>
  );
}
