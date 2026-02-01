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

  // Viewport detection - Isse pata chalta hai video screen par hai ya nahi
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // threshold 0.6 rakha hai taaki video 60% dikhte hi trigger ho jaye (Mobile friendly)
          setIsInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.6);
        });
      },
      { threshold: [0.6, 1.0], rootMargin: '0px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- VIEWS UPDATE LOGIC ---
  useEffect(() => {
    if (isInViewport && isActive && videoId) {
      const triggerView = async () => {
        const { error } = await supabase.rpc('increment_views', { 
          post_id: videoId 
        });
        
        if (error) {
          console.error("View Error:", error.message);
          // Agar database mein koi galti hogi toh ye alert dikhega
          // alert("View Database Error: " + error.message);
        } else {
          console.log("View count updated successfully");
        }
      };
      triggerView();
    }
  }, [isInViewport, isActive, videoId]);

  // Video playback controls
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

  // Caching and Loading
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
        // FIXED: object-contain use kiya hai taaki zoom na ho aur video poori dikhe
        className="absolute inset-0 w-full h-full object-contain bg-black"
        src={hasLoaded ? videoUrl : undefined}
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        style={{ filter: filterStyles[filter] || '' }}
        onLoadedData={() => setHasLoaded(true)}
      />

      {!hasLoaded && isInViewport && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {!isPlaying && hasLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="bg-white/30 backdrop-blur-sm rounded-full p-4">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Overlay Details */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10">
        <div className="text-white space-y-2 mb-16">
          <p className="font-bold text-lg">@{username || 'Unknown'}</p>
          {caption && <p className="text-sm line-clamp-2 opacity-90">{caption}</p>}
          {music && (
            <div className="flex items-center text-xs text-gray-300">
              <div className="animate-pulse mr-2">♪</div>
              <span className="truncate w-40">{music}</span>
            </div>
          )}
        </div>
      </div>

      <button 
        onClick={toggleMute} 
        className="absolute top-6 right-6 bg-black/40 backdrop-blur-md p-3 rounded-full hover:bg-black/60 transition z-20"
      >
        {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
      </button>

      {!hasLoaded && !isInViewport && (
        <div className="absolute top-6 left-6 bg-green-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] text-white font-bold tracking-wider z-20">
          DATA SAVER
        </div>
      )}
    </div>
  );
}
