"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VideoActions } from './VideoActions';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, 
  Music2, 
  Volume2, 
  VolumeX, 
  ChevronDown, 
  ChevronUp, 
  Zap,
  CheckCircle2
} from 'lucide-react'; 
import { toast } from 'sonner'; 

/**
 * 📝 INTERFACE
 */
export interface Video {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  caption: string;
  user_id: string;
  profiles?: {
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
  user_name?: string;
  user_avatar?: string;
  music_id?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  filter_name?: string;
  created_at: string;
}

export function RealVideoFeed({ onComment }: { onComment: (videoId: string, videoOwnerId: string) => void }) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // -- MAIN STATE --
  const [videos, setVideos] = useState<Video[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set()); 
  const [isRefreshing, setIsRefreshing] = useState(false);

  // -- REFS --
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedVideos = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * 1. FETCH VIDEOS & DEEP LINK LOGIC
   * Sabhi videos fetch karna aur agar URL mein ?video=ID hai toh use top par lana.
   */
  const fetchVideos = useCallback(async (isInitial = true) => {
    try {
      if (isInitial) setLoading(true);
      else setIsRefreshing(true);

      const videoIdFromUrl = searchParams.get('video');

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
        let updatedVideos: Video[] = data.map((video: any) => ({
          ...video,
          user_name: video.profiles?.full_name || video.profiles?.username || 'chiti_user',
          user_avatar: video.profiles?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        }));

        // Deep Link: URL wale video ko index 0 par set karna
        if (videoIdFromUrl) {
          const targetIndex = updatedVideos.findIndex(v => v.id === videoIdFromUrl);
          if (targetIndex !== -1) {
            const targetVideo = updatedVideos.splice(targetIndex, 1)[0];
            updatedVideos = [targetVideo, ...updatedVideos];
          }
        }

        setVideos(updatedVideos);
      }
    } catch (error) { 
      console.error('Fetch Error:', error); 
      toast.error("Feed load nahi ho payi");
    } finally { 
      setLoading(false); 
      setIsRefreshing(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  /**
   * 2. FOLLOWS STATUS FETCH
   */
  useEffect(() => {
    const fetchFollows = async () => {
      if (!currentUser) return;
      const { data } = await supabase
       .from('follows')
       .select('following_id')
       .eq('follower_id', currentUser.id);
      if (data) setFollowedUsers(new Set(data.map(f => f.following_id)));
    };
    fetchFollows();
  }, [currentUser]);

  /**
   * 3. REAL-TIME DATA SYNC
   * Jab bhi koi like, share ya filter change ho database mein, feed turant update ho.
   */
  useEffect(() => {
    const channel = supabase
      .channel('feed-global-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setVideos(current => current.map(v => 
              v.id === payload.new.id ? { ...v, ...payload.new } : v
            ));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /**
   * 4. SCROLL & VIEW TRACKING
   * Scroll detect karna aur 3 second baad View count increment karna.
   */
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      const activeVideo = videos[activeIndex];
      if (activeVideo && currentUser && !viewedVideos.current.has(activeVideo.id)) {
        try {
          await supabase.rpc('increment_views', { 
            post_id: activeVideo.id, 
            viewer_id: currentUser.id 
          });
          viewedVideos.current.add(activeVideo.id);
        } catch (e) { console.error(e); }
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [activeIndex, videos, currentUser]);

  /**
   * 5. ACTIONS HANDLERS (Follow, Share, Mute)
   */
  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUser) return toast.error("Please login to follow creators");
    if (currentUser.id === targetUserId) return;

    const isFollowing = followedUsers.has(targetUserId);
    try {
      if (isFollowing) {
        setFollowedUsers(prev => { const n = new Set(prev); n.delete(targetUserId); return n; });
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId);
      } else {
        setFollowedUsers(prev => new Set(prev).add(targetUserId));
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
        toast.success("Following creator!");
      }
    } catch (err) { toast.error("Action failed"); }
  };

  const handleShare = async (video: Video) => {
    const shareUrl = `${window.location.origin}/?video=${video.id}`;
    try {
      await supabase.rpc('increment_shares', { post_id: video.id });
      if (navigator.share) {
        await navigator.share({ title: 'CHITI SHORTS', text: video.caption, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      }
    } catch (err) { console.error(err); }
  };

  // UI RENDER
  if (loading) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-4">
      <div className="relative">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin" strokeWidth={1} />
        <Zap className="absolute inset-0 m-auto text-blue-400 animate-pulse" size={24} fill="currentColor"/>
      </div>
      <p className="text-blue-500 font-black italic tracking-widest animate-pulse">CHITI IS LOADING...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      
      {/* 🔇 GLOBAL MUTE CONTROL */}
      <button 
        onClick={() => setIsMuted(!isMuted)}
        className="fixed top-6 left-6 z-[100] bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/10 text-white active:scale-90 transition-all"
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {/* 🚀 MAIN VERTICAL FEED */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
        onScroll={handleScroll}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {videos.map((video, index) => {
          const isActive = index === activeIndex;

          return (
            <div key={video.id} className="relative h-screen w-full snap-start snap-always overflow-hidden bg-zinc-950">
              
              {/* 🎨 FILTER ENGINE (Optimized Player) */}
              <OptimizedVideoPlayer
                videoUrl={video.video_url}
                videoId={video.id}
                isActive={isActive}
                username={video.user_name}
                avatarUrl={video.user_avatar}
                caption={video.caption}
                filterName={video.filter_name || 'none'}
              />

              {/* ⚡ INTERACTION OVERLAY (Likes, Comments, Share) */}
              <div className="absolute right-4 bottom-28 z-50 flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
                <VideoActions 
                  videoId={video.id} 
                  initialLikes={video.likes_count || 0}
                  initialComments={video.comments_count || 0}
                  initialShares={video.shares_count || 0}
                  videoOwnerId={video.user_id} 
                  onComment={() => onComment(video.id, video.user_id)} 
                  onShare={() => handleShare(video)} 
                />
              </div>

              {/* 👤 CREATOR INFO & FOLLOW */}
              <div className="absolute bottom-0 left-0 right-0 p-6 pb-24 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-40 pointer-events-none">
                <div className="flex items-center gap-3 mb-4 pointer-events-auto">
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => navigate(`/profile/${video.user_id}`)}
                  >
                    <img 
                      src={video.user_avatar} 
                      className="w-12 h-12 rounded-full border-2 border-white object-cover shadow-2xl" 
                      alt="creator"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-0.5 border border-black">
                       <CheckCircle2 size={12} className="text-white" fill="currentColor"/>
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <h3 className="font-black text-white text-lg tracking-tight drop-shadow-md">
                      @{video.user_name}
                    </h3>
                    <button 
                      onClick={(e) => handleFollowToggle(e, video.user_id)}
                      className={`mt-1 px-4 py-1 rounded-full text-[10px] font-black uppercase transition-all border ${
                        followedUsers.has(video.user_id) 
                        ? 'bg-white/10 text-white/60 border-white/10' 
                        : 'bg-blue-600 text-white border-blue-400'
                      }`}
                    >
                      {followedUsers.has(video.user_id) ? 'Following' : 'Follow +'}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-white/90 font-medium mb-4 line-clamp-2 max-w-[80%] pointer-events-auto leading-snug">
                  {video.caption}
                </p>

                {/* 🎵 AUDIO MARQUEE */}
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md w-fit px-4 py-2 rounded-full border border-white/5 pointer-events-auto">
                    <Music2 size={14} className="text-blue-400 animate-spin-slow" />
                    <div className="overflow-hidden w-40">
                       <p className="text-[10px] font-black text-blue-100 italic uppercase tracking-widest whitespace-nowrap animate-marquee">
                          Original Sound - {video.user_name} • {video.filter_name || 'Normal'} Effect
                       </p>
                    </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🧭 NAVIGATION INDICATOR (Tiktok Style) */}
      <div className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50 pointer-events-none">
        {videos.slice(0, 15).map((_, i) => (
          <div key={i} className={`w-1 rounded-full transition-all duration-500 ${i === activeIndex ? 'bg-blue-500 h-10 shadow-[0_0_10px_#3b82f6]' : 'bg-white/20 h-4'}`} />
        ))}
      </div>

      {/* 🎨 CUSTOM CSS ANIMATIONS */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 10s linear infinite;
        }
        .animate-spin-slow {
          animation: rotate 4s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 
