import { useState, useEffect, useRef } from 'react';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer';
import { VideoActions } from './VideoActions';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Loader2 } from 'lucide-react';

interface Video {
  id: string;
  videoUrl: string;
  username: string;
  caption: string;
  music: string;
  filter: string;
  likes: number;
  comments: number;
  shares: number;
}

export function RealVideoFeed({ onComment }: { onComment: (videoId: string) => void }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-d82a0f74/videos`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const data = await response.json();
      if (data.videos && data.videos.length > 0) {
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const clientHeight = containerRef.current.clientHeight;
    const index = Math.round(scrollTop / clientHeight);
    setActiveIndex(index);
  };

  const scrollToVideo = (index: number) => {
    if (!containerRef.current) return;
    const clientHeight = containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: index * clientHeight,
      behavior: 'smooth'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white p-8">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <span className="text-4xl">📹</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">No Videos Yet</h2>
          <p className="text-gray-400 mb-4">Be the first to upload a video!</p>
          <p className="text-sm text-gray-500">
            Sign in and go to the Create tab to share your first video
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      onScroll={handleScroll}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {videos.map((video, index) => (
        <div key={video.id} className="relative h-screen w-full snap-start snap-always">
          <OptimizedVideoPlayer
            videoId={video.id}
            videoUrl={video.videoUrl}
            isActive={index === activeIndex}
            caption={video.caption}
            username={video.username}
            music={video.music}
            filter={video.filter}
          />

          <VideoActions
            videoId={video.id}
            initialLikes={video.likes}
            initialComments={video.comments}
            initialShares={video.shares}
            onComment={() => onComment(video.id)}
          />

          {/* Navigation hint */}
          {index === 0 && (
            <div className="absolute bottom-32 left-0 right-0 text-center animate-bounce">
              <p className="text-white text-sm opacity-75">Swipe up for more videos</p>
            </div>
          )}
        </div>
      ))}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
