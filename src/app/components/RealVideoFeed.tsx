import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Music2, Play as PlayIcon } from 'lucide-react';
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

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchFollows();
    } else {
      setFollowedUsers(new Set());
    }
  }, [currentUser]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setVideos(data);
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
      
      if (error) throw error;
      if (data) {
        setFollowedUsers(new Set(data.map(f => f.following_id)));
      }
    } catch (err) {
      console.error("Error fetching follows:", err);
    }
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
        const { error } = await supabase.from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId);
        
        if (error) throw error;

        setFollowedUsers(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        toast.success("Unfollowed");
      } else {
        const { error } = await supabase.from('follows').insert([
          { follower_id: currentUser.id, following_id: targetUserId }
        ]);

        if (error) throw error;

        // --- PROBLEM 3 FIX: SENDER NAME ADDED ---
        await supabase.from('notifications').insert([
          {
            type: 'follow',
            sender_id: currentUser.id,
            sender_name: currentUser.user_metadata.username || currentUser.email?.split('@')[0] || "Someone",
            receiver_id: targetUserId,
            content: 'started following you'
          }
        ]);

        setFollowedUsers(prev => new Set(prev).add(targetUserId));
        toast.success("Following!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Action fail ho gaya");
    }
  };

  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/video/${video.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Chiti Shorts', url: shareUrl }); } 
      catch (err) {}
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
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
      onScroll={handleScroll}
    >
      {videos.map((video, index) => (
        <div 
          key={video.id} 
          className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black"
          onClick={togglePlayPause} 
        >
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
            <iframe
              className="w-full h-full object-contain pointer-events-none" 
              src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${index === activeIndex && isPlaying ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=1&playlist=${video.youtube_video_id}&mute=0&showinfo=0&iv_load_policy=3&disablekb=1&enablejsapi=1`}
              title="Chiti Short"
              allow="autoplay; encrypted-media"
            ></iframe>
          </div>

          {showPlayIcon && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-black/40 p-5 rounded-full animate-ping">
                {isPlaying ? <PlayIcon size={40} fill="white" /> : <div className="w-10 h-10 border-l-8 border-r-8 border-white mx-auto"></div>}
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/80 to-transparent text-white z-10 pointer-events-none">
            <div className="flex items-center gap-3 mb-3 pointer-events-auto">
              <img 
                src={video.user_avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                className="w-11 h-11 rounded-full border-2 border-white shadow-lg" 
              />
              <span className="font-black text-lg">@{video.user_name}</span>
              <button 
                onClick={(e) => handleFollowToggle(e, video.user_id)}
                className={`ml-2 px-5 py-1.5 rounded-full text-xs font-black uppercase transition-all ${
                  followedUsers.has(video.user_id) ? 'bg-gray-700' : 'bg-blue-600'
                }`}
              >
                {followedUsers.has(video.user_id) ? 'Following' : 'Follow'}
              </button>
            </div>
            <p className="text-sm mb-4 line-clamp-2 pr-20">{video.caption}</p>
            <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">
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
      ))}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
