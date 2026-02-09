import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Music2, Play as PlayIcon, Pause } from 'lucide-react'; 
import { toast } from 'sonner'; 

export function RealVideoFeed({ onComment }: { onComment: (videoId: string, videoOwnerId: string) => void }) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const [isPlaying, setIsPlaying] = useState(true); 
  const [showPlayIcon, setShowPlayIcon] = useState(false); 
  
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set()); 
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedVideos = useRef<Set<string>>(new Set());
  
  // R2 Video elements ko control karne ke liye ref array
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    const domains = [
      'https://cdnjs.cloudflare.com', 
    ];
    
    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      document.head.appendChild(link);
    });
  }, []);

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (currentUser) fetchFollows();
  }, [currentUser]);

  useEffect(() => {
    const recordView = async () => {
      if (!videos || videos.length === 0 || !videos[activeIndex] || !currentUser) return;
      const currentVideoId = videos[activeIndex].id;
      const currentUserId = currentUser.id;
      if (viewedVideos.current.has(currentVideoId)) return;
      try {
        await supabase.rpc('increment_views', { 
          post_id: currentVideoId, 
          viewer_id: currentUserId 
        });
        viewedVideos.current.add(currentVideoId);
      } catch (err) {
        console.error("View error:", err);
      }
    };
    const timer = setTimeout(recordView, 3000); 
    return () => clearTimeout(timer);
  }, [activeIndex, videos, currentUser?.id]); 

  // --- 🚀 YAHAN HAI MAIN FIX (FETCH VIDEOS) ---
  const fetchVideos = async () => {
    try {
      setLoading(true);
      
      // Select query mein 'full_name' add kiya gaya hai
      const { data, error } = await supabase
       .from('posts')
       .select(`
         *,
         profiles:user_id (
           username,
           full_name,
           avatar_url
         )
       `)
       .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        // Mapping logic ko vistar se update kiya hai
        const updatedVideos = data.map((video: any) => {
          // Priority Order: 1. full_name, 2. username, 3. posts table ka user_name
          const freshName = video.profiles?.full_name || video.profiles?.username || video.user_name || 'user';
          const freshAvatar = video.profiles?.avatar_url || video.user_avatar;

          return {
            ...video,
            user_name: freshName,
            user_avatar: freshAvatar
          };
        });
        setVideos(updatedVideos);
      }
    } catch (error) { 
      console.error('Error fetching videos:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchFollows = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
       .from('follows')
       .select('following_id')
       .eq('follower_id', currentUser.id);
      if (data) setFollowedUsers(new Set(data.map(f => f.following_id)));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    Object.values(videoRefs.current).forEach((videoEl, idx) => {
      if (videoEl) {
        if (videos[activeIndex]?.id === Object.keys(videoRefs.current)[idx]) {
          if (isPlaying) videoEl.play().catch(() => {});
          else videoEl.pause();
        } else {
          videoEl.pause();
          videoEl.currentTime = 0; 
        }
      }
    });
  }, [activeIndex, isPlaying, videos]);

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
    const currentVideo = videoRefs.current[videos[activeIndex]?.id];
    if (currentVideo) {
      if (isPlaying) {
        currentVideo.pause();
      } else {
        currentVideo.play().catch(() => {});
      }
    }
    setIsPlaying(!isPlaying);
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 500); 
  };

  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUser) { toast.error("Pehle login karein!"); return; }
    if (currentUser.id === targetUserId) return;
    const isCurrentlyFollowing = followedUsers.has(targetUserId);
    try {
      if (isCurrentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId);
        setFollowedUsers(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
      } else {
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
        await supabase.rpc('increment_followers', { user_id: targetUserId });
        setFollowedUsers(prev => new Set(prev).add(targetUserId));
        toast.success("Following!");
      }
    } catch (err) { toast.error("Koshish nakam rahi"); }
  };

  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/video/${video.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Chiti Shorts', url: shareUrl }); } catch (err) {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copy ho gaya!");
    }
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black scroll-smooth"
      onScroll={handleScroll}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {videos.map((video, index) => {
        const isActive = index === activeIndex;
        const isNear = index >= activeIndex - 1 && index <= activeIndex + 2;

        return (
          <div 
            key={video.id} 
            className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black flex items-center justify-center"
            onClick={togglePlayPause} 
          >
             <div 
              className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40 scale-110"
              style={{ backgroundImage: `url(${video.thumbnail_url || video.user_avatar})` }}
            />

            <div className="relative w-full h-full max-h-screen flex items-center justify-center overflow-hidden bg-transparent z-10">
              {isNear && (
                <video
                  ref={(el) => (videoRefs.current[video.id] = el)}
                  src={video.video_url} 
                  className={`w-full h-full object-cover transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  style={{ 
                    height: '100vh',
                    width: '100%',
                    objectFit: 'cover'
                  }}
                  loop
                  playsInline
                  muted={!isActive} 
                  preload="auto"
                />
              )}
              
              {!isActive && (
                 <img 
                 src={video.thumbnail_url || video.user_avatar}
                 className="absolute inset-0 w-full h-full object-cover z-0"
                 alt="buffer"
               />
              )}
            </div>

            {showPlayIcon && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="bg-black/40 p-4 rounded-full animate-ping backdrop-blur-sm">
                  {!isPlaying ? (
                    <Pause size={40} fill="white" className="text-white" />
                  ) : (
                    <PlayIcon size={40} fill="white" className="text-white ml-1" />
                  )}
                </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-white z-20 pointer-events-none">
              
              <div 
                className="flex items-center gap-3 mb-3 pointer-events-auto cursor-pointer active:opacity-70 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  if (video.user_id) navigate(`/profile/${video.user_id}`);
                }}
              >
                <img 
                  src={video.user_avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                  className="w-11 h-11 rounded-full border-2 border-white shadow-lg object-cover" 
                  alt="avatar"
                />
                <span className="font-black text-lg shadow-black drop-shadow-lg hover:underline">
                  @{video.user_name}
                </span>
                
                <button 
                  onClick={(e) => handleFollowToggle(e, video.user_id)} 
                  className={`ml-2 px-5 py-1.5 rounded-full text-xs font-black transition-all shadow-md ${followedUsers.has(video.user_id) ? 'bg-gray-700/80' : 'bg-blue-600'}`}
                >
                  {followedUsers.has(video.user_id) ? 'Following' : 'Follow'}
                </button>
              </div>

              <p className="text-sm mb-4 line-clamp-2 pr-20 drop-shadow-md pointer-events-auto">{video.caption}</p>
              <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                <Music2 size={14} className="animate-pulse" />
                <span className="truncate">Original Audio - {video.user_name}</span>
              </div>
            </div>

            <div className="absolute right-3 bottom-24 z-20" onClick={(e) => e.stopPropagation()}>
              <VideoActions 
                videoId={video.id} 
                initialLikes={video.likes_count || 0} 
                videoOwnerId={video.user_id} 
                onComment={() => onComment(video.id, video.user_id)} 
                onShare={() => handleVideoShare(video)} 
              />
            </div>
          </div>
        );
      })}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
} 
