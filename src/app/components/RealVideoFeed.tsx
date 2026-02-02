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
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedVideos = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (currentUser) fetchFollows();
  }, [currentUser]);

  // Smooth Scroll and Snap Logic
  useEffect(() => {
    const recordView = async () => {
      if (!videos.length || !videos[activeIndex] || !currentUser) return;
      const currentVideoId = videos[activeIndex].id;
      if (viewedVideos.current.has(currentVideoId)) return;

      try {
        await supabase.rpc('increment_views', { 
          post_id: currentVideoId, 
          viewer_id: currentUser.id 
        });
        viewedVideos.current.add(currentVideoId);
      } catch (err) { console.error(err); }
    };
    const timer = setTimeout(recordView, 3000); // 3 sec for genuine view
    return () => clearTimeout(timer);
  }, [activeIndex, videos, currentUser?.id]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (data) setVideos(data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const fetchFollows = async () => {
    if (!currentUser) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', currentUser.id);
    if (data) setFollowedUsers(new Set(data.map(f => f.following_id)));
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

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 500);
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black scroll-smooth"
      onScroll={handleScroll}
      style={{ WebkitOverflowScrolling: 'touch' }} // Mobile smooth scroll
    >
      {videos.map((video, index) => {
        const isActive = index === activeIndex;
        // Optimize: Sirf current, upar wala aur niche wala video hi render hoga
        const shouldRender = Math.abs(index - activeIndex) <= 1;

        return (
          <div 
            key={video.id} 
            className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black flex items-center justify-center"
            onClick={togglePlayPause}
          >
            {shouldRender ? (
              <div className="relative w-full h-full flex items-center justify-center">
                
                {/* 1. Static Thumbnail Placeholder (Loading cover) */}
                {!isActive && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center z-10"
                    style={{ backgroundImage: `url(https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg)` }}
                  />
                )}

                {/* 2. Youtube Player with Zero Lag Params */}
                <iframe
                  className={`w-full h-full transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  style={{ 
                    height: '100vh', 
                    width: '177.78vh', // 16:9 Aspect ratio correction for mobile
                    minWidth: '100%',
                    pointerEvents: 'none'
                  }}
                  src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${isActive ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=1&playlist=${video.youtube_video_id}&mute=${isActive ? 0 : 1}&enablejsapi=1&iv_load_policy=3&disablekb=1&origin=${window.location.origin}`}
                  allow="autoplay; encrypted-media"
                ></iframe>

                {/* Overlay Elements (UI) */}
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
              </div>
            ) : (
              <div className="w-full h-full bg-neutral-900 animate-pulse" /> // Skeleton
            )}

            {/* User Interface (Caption, Actions, etc.) */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-30 pointer-events-none">
                <div className="flex items-center gap-3 mb-4 pointer-events-auto">
                   <img src={video.user_avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-xl" />
                   <div className="flex flex-col">
                      <span className="font-bold text-white shadow-black text-shadow-sm">@{video.user_name}</span>
                   </div>
                </div>
                <p className="text-white text-sm mb-6 max-w-[80%] pointer-events-auto drop-shadow-lg">{video.caption}</p>
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md w-fit px-3 py-1 rounded-full border border-white/10">
                  <Music2 size={14} className="text-white animate-spin-slow" />
                  <span className="text-white text-[10px]">Original Audio - {video.user_name}</span>
                </div>
            </div>

            {/* Sidebar Actions */}
            <div className="absolute right-4 bottom-28 z-40">
              <VideoActions 
                videoId={video.id} 
                initialLikes={video.likes_count} 
                videoOwnerId={video.user_id} 
                onComment={() => onComment(video.id, video.user_id)} 
              />
            </div>

            {/* Play/Pause Icon Animation */}
            {showPlayIcon && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-white/20 p-6 rounded-full backdrop-blur-sm animate-ping">
                  {isPlaying ? <PlayIcon size={40} fill="white" /> : <div className="w-8 h-8 bg-white rounded-sm" />}
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
      `}</style>
    </div>
  );
}
