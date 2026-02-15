"use client";

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VideoActions } from './VideoActions';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; // Filter Engine
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Music2, Play as PlayIcon, Pause } from 'lucide-react'; 
import { toast } from 'sonner'; 

export function RealVideoFeed({ onComment }: { onComment: (videoId: string, videoOwnerId: string) => void }) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Play/Pause State
  const [isPlaying, setIsPlaying] = useState(true); 
  const [showPlayIcon, setShowPlayIcon] = useState(false); 
  
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set()); 
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedVideos = useRef<Set<string>>(new Set());

  // 1. Preconnect Optimization
  useEffect(() => {
    const domains = ['https://cdnjs.cloudflare.com'];
    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      document.head.appendChild(link);
    });
  }, []);

  // 2. Initial Fetch
  useEffect(() => {
    fetchVideos();
  }, [searchParams]); // URL change par refresh

  useEffect(() => {
    if (currentUser) fetchFollows();
  }, [currentUser]);

  // 3. Real-time Updates (Comments Count)
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        (payload) => {
          setVideos(prev => prev.map(v => 
            v.id === payload.new.post_id 
              ? { ...v, comments_count: (v.comments_count || 0) + 1 } 
              : v
          ));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 4. View Recording Logic (3 Seconds)
  useEffect(() => {
    const recordView = async () => {
      if (!videos || videos.length === 0 || !videos[activeIndex] || !currentUser) return;
      const currentVideoId = videos[activeIndex].id;
      if (viewedVideos.current.has(currentVideoId)) return;
      try {
        await supabase.rpc('increment_views', { 
          post_id: currentVideoId, 
          viewer_id: currentUser.id 
        });
        viewedVideos.current.add(currentVideoId);
      } catch (err) {
        console.error("View error:", err);
      }
    };
    const timer = setTimeout(recordView, 3000); 
    return () => clearTimeout(timer);
  }, [activeIndex, videos, currentUser?.id]); 

  // 5. Main Fetch Logic with Deep Linking
  const fetchVideos = async () => {
    try {
      setLoading(true);
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
        let updatedVideos = data.map((video: any) => ({
            ...video,
            user_name: video.profiles?.full_name || video.profiles?.username || 'user',
            user_avatar: video.profiles?.avatar_url
        }));

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
    } finally { 
      setLoading(false); 
    }
  };

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

  // 6. Navigation & Scroll Handlers
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

  // 7. Social Handlers (Follow & Share)
  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUser) { toast.error("Pehle login karein!"); return; }
    if (currentUser.id === targetUserId) return;
    const isCurrentlyFollowing = followedUsers.has(targetUserId);
    try {
      if (isCurrentlyFollowing) {
        setFollowedUsers(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId);
      } else {
        setFollowedUsers(prev => new Set(prev).add(targetUserId));
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
        toast.success("Following!");
      }
    } catch (err) { toast.error("Koshish nakam rahi"); }
  };

  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/?video=${video.id}`;
    try {
      setVideos(prev => prev.map(v => 
        v.id === video.id ? { ...v, shares_count: (v.shares_count || 0) + 1 } : v
      ));
      await supabase.rpc('increment_shares', { post_id: video.id });
      if (navigator.share) {
        await navigator.share({ title: 'Chiti Shorts', url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copy ho gaya!");
      }
    } catch (err) { console.error("Share error:", err); }
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
            className="relative h-screen w-full snap-start snap-always bg-black"
            onClick={togglePlayPause} 
          >
            {/* 🎨 FILTER ENGINE (Optimized Video Player) */}
            {/* Saara Video Render aur Filters yahan se handle honge */}
            <OptimizedVideoPlayer
              videoUrl={video.video_url}
              videoId={video.id}
              isActive={isActive && isPlaying} // Yahan isPlaying sync kiya
              username={video.user_name}
              avatarUrl={video.user_avatar}
              caption={video.caption}
              filterName={video.filter_name || 'none'}
            />

            {/* Play/Pause Visual Indicator */}
            {showPlayIcon && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-black/40 p-4 rounded-full animate-ping">
                  {!isPlaying ? <Pause size={40} fill="white" /> : <PlayIcon size={40} fill="white" />}
                </div>
              </div>
            )}

            {/* 👤 SEPARATE FOLLOW BUTTON LAYER */}
            {/* Ise Player ke upar rakha hai takki user click kar sake */}
            <div className="absolute bottom-36 left-4 z-[60] pointer-events-none">
                <button 
                  onClick={(e) => handleFollowToggle(e, video.user_id)}
                  className={`pointer-events-auto px-5 py-1.5 rounded-full text-[10px] font-black uppercase transition-all shadow-xl ${
                    followedUsers.has(video.user_id) 
                    ? 'bg-zinc-900/80 text-zinc-400 border border-white/10' 
                    : 'bg-blue-600 text-white'
                  }`}
                >
                  {followedUsers.has(video.user_id) ? 'Following' : 'Follow +'}
                </button>
            </div>

            {/* ⚡ RIGHT SIDE ACTIONS */}
            <div className="absolute right-3 bottom-24 z-50" onClick={(e) => e.stopPropagation()}>
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
          </div>
        );
      })}
    </div>
  );
} 
