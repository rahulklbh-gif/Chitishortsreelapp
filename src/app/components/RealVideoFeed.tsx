import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Music2, Play as PlayIcon } from 'lucide-react';
import { toast } from 'sonner'; 

export function RealVideoFeed({ onComment }: { onComment: (videoId: string) => void }) {
  const { user: currentUser } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); 
  const [showPlayIcon, setShowPlayIcon] = useState(false); 
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set()); // Followed IDs store karne ke liye
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideos();
    if (currentUser) fetchFollows();
  }, [currentUser]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        const urlParams = new URLSearchParams(window.location.search);
        const videoIdFromUrl = urlParams.get('video');
        if (videoIdFromUrl) {
          const clickedIndex = data.findIndex(v => v.id === videoIdFromUrl);
          if (clickedIndex !== -1) {
            const clickedVideo = data.splice(clickedIndex, 1)[0];
            data.unshift(clickedVideo);
          }
        }
        setVideos(data);
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  // User ne kis-kis ko follow kiya hai wo load karein
  const fetchFollows = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUser.id);
    
    if (data) {
      setFollowedUsers(new Set(data.map(f => f.following_id)));
    }
  };

  // --- AUTO-NEXT FIX ---
  useEffect(() => {
    const handleYTMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data = JSON.parse(event.data);
        // YouTube Player States: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused)
        if (data.event === "infoDelivery" && data.info?.playerState === 0) {
          if (containerRef.current && activeIndex < videos.length - 1) {
            const nextTop = (activeIndex + 1) * window.innerHeight;
            containerRef.current.scrollTo({
              top: nextTop,
              behavior: 'smooth'
            });
          }
        }
      } catch (err) {}
    };

    window.addEventListener("message", handleYTMessage);
    return () => window.removeEventListener("message", handleYTMessage);
  }, [activeIndex, videos]);

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

  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.error("Pehle login karein!");
      return;
    }
    if (currentUser.id === targetUserId) return;

    const isCurrentlyFollowing = followedUsers.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        // Unfollow
        await supabase.from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId);
        
        setFollowedUsers(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      } else {
        // Follow
        await supabase.from('follows').insert([
          { follower_id: currentUser.id, following_id: targetUserId }
        ]);
        
        setFollowedUsers(prev => new Set(prev).add(targetUserId));
      }
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/video/${video.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Chiti Shorts', url: shareUrl }); } 
      catch (err) {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
  };

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-black"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
      onScroll={handleScroll}
    >
      {videos.map((video, index) => (
        <div key={video.id} className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black" onClick={togglePlayPause}>
          
          <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
            <iframe
              className="w-full h-full scale-[1.6] origin-center object-cover" 
              src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${index === activeIndex && isPlaying ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=0&playlist=${video.youtube_video_id}&mute=0&enablejsapi=1`}
              title="Chiti Short"
              allow="autoplay"
            ></iframe>
          </div>

          {showPlayIcon && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-black/40 p-5 rounded-full animate-ping">
                {isPlaying ? <PlayIcon size={40} fill="white" /> : <div className="w-10 h-10 border-l-8 border-r-8 border-white mx-auto"></div>}
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/90 text-white z-10 pointer-events-none">
            <div className="flex items-center gap-3 mb-3 pointer-events-auto">
              <img src={video.user_avatar || ''} className="w-11 h-11 rounded-full border-2 border-white shadow-lg" />
              <div className="flex flex-col">
                <span className="font-black text-lg">@{video.user_name}</span>
              </div>
              
              {/* --- SMART FOLLOW BUTTON --- */}
              <button 
                onClick={(e) => handleFollowToggle(e, video.user_id)}
                className={`ml-2 px-5 py-1.5 rounded-full text-xs font-black uppercase transition-all duration-300 ${
                  followedUsers.has(video.user_id) 
                  ? 'bg-gray-600 text-white' // Following state
                  : 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' // Follow state
                }`}
              >
                {followedUsers.has(video.user_id) ? 'Following' : 'Follow'}
              </button>
            </div>
            
            <p className="text-sm mb-4 line-clamp-2 pr-20">{video.caption}</p>
          </div>

          <div className="absolute right-3 bottom-24 z-20" onClick={(e) => e.stopPropagation()}>
            <VideoActions videoId={video.id} initialLikes={video.likes_count || 0} onComment={() => onComment(video.id)} onShare={() => handleVideoShare(video)} />
          </div>
        </div>
      ))}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
