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
    e.preventDefault();
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
        className="transition-transform duration-300 ease-out h-full"
        style={{ willChange: 'transform' }}
      >
        {videos.map((video, index) => (
          <div key={video.id} className="h-screen w-screen relative">
            {/* YAHAN BADLAV KIYA HAI: OptimizedVideoPlayer use kiya */}
            <OptimizedVideoPlayer
              videoId={video.id}
              videoUrl={video.video_url}
              isActive={index === currentIndex}
              caption={video.caption}
              username={video.user?.username || 'User'}
              music={video.music}
              onVideoClick={() => {}} // Click handle baad mein dekh lenge
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
