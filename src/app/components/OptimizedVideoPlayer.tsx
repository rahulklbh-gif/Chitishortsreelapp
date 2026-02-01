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

  // Viewport detection
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInViewport(entry.isIntersecting && entry.intersectionRatio === 1);
        });
      },
      { threshold: 1.0, rootMargin: '0px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- VIEWS UPDATE LOGIC (VIEWS_COUNT KE LIYE) ---
  useEffect(() => {
    if (isInViewport && isActive && videoId) {
      const triggerView = async () => {
        // SQL Function 'increment_views' ko call kar rahe hain
        const { error } = await supabase.rpc('increment_views', { 
          post_id: videoId 
        });
        
        if (error) {
          console.error("View Error:", error.message);
          // Mobile par test karne ke liye niche wala alert on kar sakte hain
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
      }).catch(error => {
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
    <div ref={containerRef} className="relative w-full h-full bg-black" onClick={handleVideoClick}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={hasLoaded ? videoUrl : undefined}
        loop
        muted={isMuted}
        playsInline
        preload="none"
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

      <div className="absolute bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        <div className="text-white space-y-2">
          <p className="font-semibold">@{username || 'Unknown'}</p>
          {caption && <p className="text-sm line-clamp-2">{caption}</p>}
          {music && <p className="text-xs text-gray-300 flex items-center"><span className="mr-2">♪</span>{music}</p>}
        </div>
      </div>

      <button onClick={toggleMute} className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm p-3 rounded-full hover:bg-black/70 transition z-10">
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {!hasLoaded && !isInViewport && (
        <div className="absolute top-4 left-4 bg-green-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white font-medium">
          📊 Data Saver Active
        </div>
      )}
    </div>
  );
}
