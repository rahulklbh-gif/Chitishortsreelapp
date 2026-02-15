"use client";

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VideoActions } from './VideoActions';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Music2 } from 'lucide-react'; 
import { toast } from 'sonner'; 

export function RealVideoFeed({ onComment }: { onComment: (videoId: string, videoOwnerId: string) => void }) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // -- STATES --
  const [videos, setVideos] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set()); 
  
  // -- REFS --
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedVideos = useRef<Set<string>>(new Set());

  /**
   * 1. PRECONNECT & OPTIMIZATION
   * CDN aur resources ko pehle se connect karna takki speed fast rahe.
   */
  useEffect(() => {
    const domains = ['https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev'];
    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      document.head.appendChild(link);
    });
  }, []);

  /**
   * 2. MAIN FETCH LOGIC (Filter Support ke saath)
   * Isme hum URL se video ID uthate hain aur database se filter_name select karte hain.
   */
  const fetchVideos = async () => {
    try {
      setLoading(true);
      const videoIdFromUrl = searchParams.get('video');

      // Sabhi posts fetch karna profiles ke saath
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
        let updatedVideos = data.map((video: any) => ({
          ...video,
          user_name: video.profiles?.full_name || video.profiles?.username || 'chiti_user',
          user_avatar: video.profiles?.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
        }));

        // Agar URL mein specific video ID hai (?video=...), toh use top par rakho
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
      console.error('Error fetching videos:', error); 
      toast.error("Video load nahi ho payi");
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchVideos(); }, [searchParams]);

  /**
   * 3. FOLLOW LOGIC
   * User ne kisse follow kiya hai wo state mein load karna.
   */
  const fetchFollows = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
       .from('follows')
       .select('following_id')
       .eq('follower_id', currentUser.id);
      if (data) setFollowedUsers(new Set(data.map(f => f.following_id)));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { if (currentUser) fetchFollows(); }, [currentUser]);

  /**
   * 4. REAL-TIME UPDATES
   * Jab koi like ya comment kare, toh list turant update ho jaye.
   */
  useEffect(() => {
    const channel = supabase
      .channel('realtime-feed')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          setVideos(prev => prev.map(v => 
            v.id === payload.new.id ? { ...v, ...payload.new } : v
          ));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /**
   * 5. VIEW COUNT LOGIC
   * 3 second video dekhne par view count badhana.
   */
  useEffect(() => {
    const recordView = async () => {
      if (!videos[activeIndex] || !currentUser) return;
      const vid = videos[activeIndex].id;
      if (viewedVideos.current.has(vid)) return;
      
      try {
        await supabase.rpc('increment_views', { post_id: vid, viewer_id: currentUser.id });
        viewedVideos.current.add(vid);
      } catch (e) { console.log("View error", e); }
    };
    const timer = setTimeout(recordView, 3000);
    return () => clearTimeout(timer);
  }, [activeIndex, videos, currentUser]);

  /**
   * 6. NAVIGATION & HANDLERS
   */
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUser) return toast.error("Please login first");
    if (currentUser.id === targetUserId) return;

    const isFollowing = followedUsers.has(targetUserId);
    try {
      if (isFollowing) {
        setFollowedUsers(prev => { const n = new Set(prev); n.delete(targetUserId); return n; });
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId);
      } else {
        setFollowedUsers(prev => new Set(prev).add(targetUserId));
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
        toast.success("Following");
      }
    } catch (err) { toast.error("Error updating follow"); }
  };

  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/?video=${video.id}`;
    try {
      await supabase.rpc('increment_shares', { post_id: video.id });
      if (navigator.share) {
        await navigator.share({ title: 'CHITI', url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied!");
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
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
          <div key={video.id} className="relative h-screen w-full snap-start snap-always bg-black">
            
            {/* 🎨 FILTER & VIDEO PLAYER ENGINE */}
            <OptimizedVideoPlayer
              videoUrl={video.video_url}
              videoId={video.id}
              isActive={isActive}
              username={video.user_name}
              avatarUrl={video.user_avatar}
              caption={video.caption}
              filterName={video.filter_name || 'none'}
            />

            {/* ⚡ RIGHT SIDE ACTIONS (Likes, Comments, Share) */}
            <div className="absolute right-3 bottom-24 z-50">
              <VideoActions 
                videoId={video.id} 
                initialLikes={video.likes_count || 0}
                initialComments={video.comments_count || 0}
                initialShares={video.shares_count || 0}
                videoOwnerId={video.user_id} 
                onComment={() => onComment(video.id, video.user_id)} 
                onShare={() => handleVideoShare(video)} 
              />
            </div>

            {/* 👤 FOLLOW BUTTON OVERLAY */}
            <div className="absolute bottom-36 left-4 z-50 pointer-events-none">
                <button 
                  onClick={(e) => handleFollowToggle(e, video.user_id)}
                  className={`pointer-events-auto px-5 py-1.5 rounded-full text-[10px] font-black italic uppercase transition-all shadow-xl ${
                    followedUsers.has(video.user_id) 
                    ? 'bg-zinc-900/80 text-zinc-400 border border-white/10' 
                    : 'bg-blue-600 text-white animate-pulse'
                  }`}
                >
                  {followedUsers.has(video.user_id) ? 'Following' : 'Follow +'}
                </button>
            </div>

            {/* 🎵 MUSIC MARQUEE OVERLAY */}
            <div className="absolute bottom-20 left-4 z-40 flex items-center gap-2 pointer-events-none opacity-80">
                <div className="bg-black/20 backdrop-blur-md p-2 rounded-full border border-white/5">
                    <Music2 size={12} className="text-blue-400 animate-spin-slow" />
                </div>
                <div className="overflow-hidden w-32">
                    <p className="text-[10px] font-black italic whitespace-nowrap animate-marquee uppercase tracking-widest">
                        Original Sound - {video.user_name}
                    </p>
                </div>
            </div>

          </div>
        );
      })}
      
      {/* 🟢 CSS ANIMATIONS */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 8s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 4s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 
