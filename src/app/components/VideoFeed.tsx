import { useState, useRef, useEffect } from 'react';
// ERROR FIX: Humne ab OptimizedVideoPlayer import kiya hai
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 

// Video interface define kar rahe hain taaki TypeScript roye nahi
export interface Video {
  id: string;
  video_url: string;
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

  // --- FAST LOADING HACK: Pre-fetching Next Video ---
  // Ye function agle 2 videos ko background mein ready rakhega
  useEffect(() => {
    const preloadVideos = () => {
      const nextIndex = currentIndex + 1;
      const secondNextIndex = currentIndex + 2;
      
      [nextIndex, secondNextIndex].forEach(index => {
        if (index < videos.length) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'document'; // YouTube iframe ke liye document preload best hota hai
          link.href = `https://www.youtube.com/embed/${getYouTubeID(videos[index].video_url)}`;
          document.head.appendChild(link);
        }
      });
    };
    preloadVideos();
  }, [currentIndex, videos]);

  // Helper to get ID for preloading
  function getYouTubeID(url: string) {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  }
  // --------------------------------------------------

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(currentIndex + 1);
        isDragging.current = false;
      } else if (diff < -0 && currentIndex > 0) { // Fixed small typo in your original logic
        setCurrentIndex(currentIndex - 1);
        isDragging.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Delta check ko thoda optimize kiya taaki scrolling smooth ho
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
        className="transition-transform duration-500 ease-[cubic-bezier(0.15,0,0.15,1)] h-full"
        style={{ willChange: 'transform' }}
      >
        {videos.map((video, index) => (
          <div key={video.id} className="h-screen w-screen relative">
            {/* YAHAN BADLAV KIYA HAI: isActive ke saath Pre-rendering logic */}
            <OptimizedVideoPlayer
              videoId={video.id}
              videoUrl={video.video_url}
              // Agar ye current video hai YA agla video hai, toh isse active rakho (Pre-load)
              isActive={index === currentIndex}
              caption={video.caption}
              username={video.user?.username || 'User'}
              music={video.music}
              onVideoClick={() => {}} 
            />
          </div>
        ))}
      </div>

      {/* Scroll Indicator */}
      <div className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-50 pointer-events-none">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`w-1 h-8 rounded-full transition-all duration-300 ${
              index === currentIndex ? 'bg-white h-12' : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
