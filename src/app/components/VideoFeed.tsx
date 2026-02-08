import { useState, useRef, useEffect } from 'react';
// ERROR FIX: Humne ab OptimizedVideoPlayer import kiya hai
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 

// Video interface define kar rahe hain - Cloudflare R2 ke hisaab se
export interface Video {
  id: string;
  video_url: string; // Cloudflare R2 .mp4 link
  thumbnail_url?: string;
  caption: string;
  user?: {
    username: string;
    avatar_url?: string;
  };
  music?: string;
  likes_count?: number;
  comments_count?: number;
}

interface VideoFeedProps {
  videos: Video[];
  onComment: (videoId: string) => void;
}

export function VideoFeed({ videos, onComment }: VideoFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isDragging = useRef(false);

  // --- NEW CLOUDFLARE R2 PRE-FETCH LOGIC ---
  // R2 videos (MP4) ke liye browser ka native preload kaafi fast hota hai
  useEffect(() => {
    const preloadNextVideos = () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex < videos.length) {
        const videoElement = document.createElement('video');
        videoElement.src = videos[nextIndex].video_url;
        videoElement.preload = 'auto'; // Background mein agla video load karna shuru karega
      }
    };
    preloadNextVideos();
  }, [currentIndex, videos]);
  // ------------------------------------------

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;

    // Sensitivity check: 50px se zyada swipe par video change hoga
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(currentIndex + 1);
        isDragging.current = false;
      } else if (diff < 0 && currentIndex > 0) { 
        setCurrentIndex(currentIndex - 1);
        isDragging.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Scroll speed limiters
    if (Math.abs(e.deltaY) < 10) return; 

    if (e.deltaY > 30 && currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (e.deltaY < -30 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translateY(-${currentIndex * 100}vh)`;
    }
  }, [currentIndex]);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div
        ref={containerRef}
        className="transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] h-full"
        style={{ willChange: 'transform' }}
      >
        {videos.map((video, index) => (
          <div key={video.id} className="h-screen w-screen relative overflow-hidden">
            {/* R2 Optimized Video Player */}
            <OptimizedVideoPlayer
              videoId={video.id}
              videoUrl={video.video_url}
              thumbnailUrl={video.thumbnail_url}
              // isActive sirf current video ko true dega taaki playback handle ho
              isActive={index === currentIndex}
              caption={video.caption}
              username={video.user?.username || 'User'}
              music={video.music}
              onVideoClick={() => {}} 
              // Comments pass karne ke liye logic
              onComment={() => onComment(video.id)}
            />
          </div>
        ))}
      </div>

      {/* Scroll Indicator UI */}
      <div className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-50 pointer-events-none">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`w-1 rounded-full transition-all duration-500 ${
              index === currentIndex ? 'bg-blue-500 h-12 shadow-[0_0_10px_#3b82f6]' : 'bg-white/20 h-6'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
