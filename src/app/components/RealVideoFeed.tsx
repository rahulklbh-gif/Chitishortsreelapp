import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Music2, Volume2, VolumeX } from 'lucide-react'; 
import { toast } from 'sonner'; 

export function RealVideoFeed({ onComment }: { onComment: (videoId: string, videoOwnerId: string) => void }) {
  const { user: currentUser } = useAuth();
  const [videos, setVideos] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Mute aur Icon ke liye states
  const [isMuted, setIsMuted] = useState(false); 
  const [showMuteIcon, setShowMuteIcon] = useState(false); 
  
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set()); 
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedVideos = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (currentUser) fetchFollows();
  }, [currentUser]);

  // View count logic (Same as before)
  useEffect(() => {
    const recordView = async () => {
      if (!videos || videos.length === 0 || !videos[activeIndex] || !currentUser) return;
      
      const currentVideoId = videos[activeIndex].id;
      const currentUserId = currentUser.id;
      
      if (viewedVideos.current.has(currentVideoId)) return;
      
      try {
        const { error } = await supabase.rpc('increment_views', { 
          post_id: currentVideoId, 
          viewer_id: currentUserId 
        });
        if (!error) viewedVideos.current.add(currentVideoId);
      } catch (err) {
        console.error("View error:", err);
      }
    };
    const timer = setTimeout(recordView, 2000);
    return () => clearTimeout(timer);
  }, [activeIndex, videos, currentUser?.id]); 

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
       .from('posts')
       .select('*')
       .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setVideos(data);
    } catch (error) { console.error('Error fetching videos:', error); }
    finally { setLoading(false); }
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

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  // 🔥 Mute Toggle Function
  const toggleMute = () => {
    setIsMuted(!isMuted);
    setShowMuteIcon(true);
    setTimeout(() => setShowMuteIcon(false), 500); // 0.5 second baad icon gayab
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
    } catch (err) { toast.error("Error updating follow"); }
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
        return (
          <div 
            key={video.id} 
            className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black flex items-center justify-center"
            onClick={toggleMute} 
          >
            {/* Background Thumbnail */}
            <img 
              src={`https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg`}
              className="absolute inset-0 w-full h-full object-cover z-0 opacity-50 blur-[2px]"
              alt="loading bg"
            />

            <div className="relative w-full h-full max-h-screen flex items-center justify-center overflow-hidden bg-transparent z-10">
              <iframe
                className={`w-full h-full pointer-events-none transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                style={{ aspectRatio: '9/16', height: '100vh', width: 'auto', minWidth: '100%' }}
                src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${isActive ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=1&playlist=${video.youtube_video_id}&mute=${isMuted ? 1 : 0}&showinfo=0&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${window.location.origin}`}
                title="Chiti Short"
                allow="autoplay; encrypted-media"
              ></iframe>
            </div>

            {/* Mute/Unmute Icon Overlay */}
            {showMuteIcon && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="bg-black/40 p-5 rounded-full animate-ping">
                  {isMuted ? <VolumeX size={40} color="white" /> : <Volume2 size={40} color="white" />}
                </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/80 to-transparent text-white z-20 pointer-events-none">
              <div className="flex items-center gap-3 mb-3 pointer-events-auto">
                <img 
                  src={video.user_avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                  className="w-11 h-11 rounded-full border-2 border-white shadow-lg" 
                />
                <span className="font-black text-lg">@{video.user_name}</span>
                <button 
                  onClick={(e) => handleFollowToggle(e, video.user_id)} 
                  className={`ml-2 px-5 py-1.5 rounded-full text-xs font-black transition-all pointer-events-auto ${followedUsers.has(video.user_id) ? 'bg-gray-700' : 'bg-blue-600'}`}
                >
                  {followedUsers.has(video.user_id) ? 'Following' : 'Follow'}
                </button>
              </div>
              <p className="text-sm mb-4 line-clamp-2 pr-20 pointer-events-auto">{video.caption}</p>
              <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-auto">
                <Music2 size={14} className="animate-spin" style={{ animationDuration: '3s' }} />
                <span className="truncate">Original Audio - {video.user_name}</span>
              </div>
            </div>

            <div className="absolute right-3 bottom-24 z-30" onClick={(e) => e.stopPropagation()}>
              <VideoActions 
                videoId={video.id} 
                initialLikes={video.likes_count || 0} 
                videoOwnerId={video.user_id} 
                onComment={() => onComment(video.id, video.user_id)} 
                onShare={() => handleVideoShare(video)} 
              />
            </div>
          </div>
        )
      })}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 3s linear infinite; }
      `}</style>
    </div>
  );
}
