import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Music2, Play as PlayIcon } from 'lucide-react';
import { toast } from 'sonner';

export function RealVideoFeed({ onComment }: { onComment: (videoId: string, videoOwnerId: string) => void }) {
  const { user: currentUser } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (data) setVideos(data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeIndex) {
      setActiveIndex(index);
      setIsPlaying(true);
    }
  };

  if (loading) return <div className="fixed inset-0 bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black scroll-smooth"
      onScroll={handleScroll}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {videos.map((video, index) => {
        const isActive = index === activeIndex;
        // JUGAAD 1: Isse hum agla aur pichla video background mein load kar rahe hain (Buffer)
        const isNear = Math.abs(index - activeIndex) <= 1; 

        return (
          <div key={video.id} className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black flex items-center justify-center">
            
            {/* THUMBNAIL LAYER: Ye hamesha niche rahega loading chupane ke liye */}
            <div 
              className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-300"
              style={{ 
                backgroundImage: `url(https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg)`,
                filter: 'blur(10px) brightness(0.5)'
              }}
            />

            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
               {/* ACTUAL THUMBNAIL: Jo video ke aane tak dikhega */}
               <img 
                src={`https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg`}
                className={`absolute w-full h-auto z-10 transition-opacity duration-500 ${isActive ? 'opacity-0 delay-[1500ms]' : 'opacity-100'}`}
                style={{ aspectRatio: '9/16' }}
              />

              {/* JUGAAD 2: IFRAME PRE-LOADING LOGIC */}
              {isNear && (
                <iframe
                  className={`w-full h-full z-20 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  style={{ 
                    height: '105vh', // Small zoom to hide bars
                    width: '100%',
                    minWidth: '100%',
                    pointerEvents: 'none',
                    transform: 'scale(1.1)' // Smoothness ke liye
                  }}
                  // JUGAAD 3: Fastest Params (origin, widget_referrer, iv_load_policy)
                  src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${isActive ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=1&playlist=${video.youtube_video_id}&mute=${isActive ? 0 : 1}&enablejsapi=1&origin=${window.location.origin}&iv_load_policy=3&widget_referrer=${window.location.origin}`}
                  allow="autoplay; encrypted-media"
                ></iframe>
              )}
            </div>

            {/* UI Content */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-30 pb-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <div className="flex items-center gap-3 mb-3 pointer-events-auto">
                <img src={video.user_avatar} className="w-11 h-11 rounded-full border border-white" />
                <span className="font-bold text-white">@{video.user_name}</span>
              </div>
              <p className="text-white text-sm line-clamp-2 mb-4 pointer-events-auto">{video.caption}</p>
              <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                <Music2 size={12} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-white text-[10px]">Original Audio</span>
              </div>
            </div>

            {/* Sidebar Actions */}
            <div className="absolute right-4 bottom-24 z-40">
              <VideoActions 
                videoId={video.id} 
                initialLikes={video.likes_count} 
                videoOwnerId={video.user_id} 
                onComment={() => onComment(video.id, video.user_id)} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
