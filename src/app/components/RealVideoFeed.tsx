import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase'; // Path check kar lena
import { Loader2, Music2 } from 'lucide-react';

export function RealVideoFeed({ onComment }: { onComment: (videoId: string) => void }) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      // Naya Logic: Seedha 'posts' table se data lena
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setVideos(data);
      
    } catch (error) {
      console.error('Error fetching videos from Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    setActiveIndex(index);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-400">Loading Chiti Shorts...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Videos in Feed</h2>
          <p className="text-gray-400 mb-4">Database is empty or not connected.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
      onScroll={handleScroll}
      style={{ scrollbarWidth: 'none' }}
    >
      {videos.map((video, index) => (
        <div key={video.id} className="relative h-screen w-full snap-start snap-always overflow-hidden">
          {/* YouTube Player Wrapper */}
          <div className="absolute inset-0 w-full h-full bg-black">
            <iframe
              className="w-full h-full object-cover"
              src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${index === activeIndex ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=1&mute=0`}
              title="Chiti Short"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>

          {/* User Info Overlay */}
          <div className="absolute bottom-20 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white z-10">
            <div className="flex items-center gap-3 mb-3">
              <img 
                src={video.user_avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                className="w-11 h-11 rounded-full border-2 border-white" 
                alt="u" 
              />
              <span className="font-bold text-lg italic">@{video.user_name}</span>
            </div>
            <p className="text-sm mb-4 line-clamp-2 pr-16">{video.caption}</p>
            <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
              <Music2 size={14} className="animate-pulse" />
              <span>Original Audio - {video.user_name}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="z-20">
            <VideoActions
              videoId={video.id}
              initialLikes={0}
              initialComments={0}
              initialShares={0}
              onComment={() => onComment(video.id)}
            />
          </div>
        </div>
      ))}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
