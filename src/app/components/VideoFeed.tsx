import { useState, useRef, useEffect } from 'react';
import { VideoPlayer, Video } from './VideoPlayer';

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

    // Scroll threshold
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        // Scroll down - next video
        setCurrentIndex(currentIndex + 1);
        isDragging.current = false;
      } else if (diff < 0 && currentIndex > 0) {
        // Scroll up - previous video
        setCurrentIndex(currentIndex - 1);
        isDragging.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  // Wheel event for desktop
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
      className="fixed inset-0 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div
        ref={containerRef}
        className="transition-transform duration-300 ease-out"
        style={{ willChange: 'transform' }}
      >
        {videos.map((video, index) => (
          <div key={video.id} className="h-screen w-screen">
            <VideoPlayer
              video={video}
              isActive={index === currentIndex}
              onComment={() => onComment(video.id)}
            />
          </div>
        ))}
      </div>

      {/* Scroll Indicator */}
      <div className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`w-1 h-8 rounded-full transition-all ${
              index === currentIndex ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
