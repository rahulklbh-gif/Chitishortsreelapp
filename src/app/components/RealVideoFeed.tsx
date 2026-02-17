"use client";

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VideoActions } from './VideoActions';
// Filter engine ko import kiya
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
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

  const [isPlaying, setIsPlaying] = useState(true); 
  const [showPlayIcon, setShowPlayIcon] = useState(false); 
  
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set()); 
  const containerRef = useRef<HTMLDivElement>(null);
  
  // UNIQUE VIEW LOGIC
  const viewedVideos = useRef<Set<string>>(new Set());
  
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    const domains = ['https://cdnjs.cloudflare.com'];
    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      document.head.appendChild(link);
    });
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [searchParams]);

  useEffect(() => {
    if (currentUser) fetchFollows();
  }, [currentUser]);

  // --- REAL-TIME COMMENT COUNT ---
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- VIEW RECORDING ---
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

  // --- FETCH VIDEOS (FIXED MAPPING) ---
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
        let updatedVideos = data.map((video: any) => {
          // 🛡️ Sabse important part: Field mapping
          // Video URL agar 'video_url' mein nahi hai toh 'url' check karega
          const finalVideoUrl = video.video_url || video.url || "";
          
          // User data mapping
          const freshName = video.profiles?.username || video.profiles?.full_name || video.user_name || 'user';
          const freshAvatar = video.profiles?.avatar_url || video.user_avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';

          return {
            ...video,
            video_url: finalVideoUrl, 
            user_name: freshName,
            user_avatar: freshAvatar,
            likes_count: video.likes_count || 0,
            comments_count: video.comments_count || 0,
            shares_count: video.shares_count || 0
          };
        });

        // URL Specific Video logic
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
    if (!currentUser) { toast.error("Pehle login karein!"); return; }
    if (currentUser.id === targetUserId) return;
    const isCurrentlyFollowing = followedUsers.has(targetUserId);
    try {
      if (isCurrentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId);
        await supabase.rpc('decrement_followers', { user_id: targetUserId });
        await supabase.rpc('decrement_following', { user_id: currentUser.id });
        setFollowedUsers(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
      } else {
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
        await supabase.rpc('increment_followers', { user_id: targetUserId });
        await supabase.rpc('increment_following', { user_id: currentUser.id });
        setFollowedUsers(prev => new Set(prev).add(targetUserId));
        toast.success("Following!");
      }
    } catch (err) { toast.error("Error toggling follow"); }
  };

  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/?video=${video.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Chiti Shorts', text: `Check out this video`, url: shareUrl });
        await supabase.rpc('increment_shares', { post_id: video.id });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copy ho gaya!");
        await supabase.rpc('increment_shares', { post_id: video.id });
      }
    } catch (err) { console.log("Share cancelled"); }
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
        const shouldRender = index >= activeIndex - 1 && index <= activeIndex + 3;

        return (
          <div 
            key={video.id} 
            className="relative h-screen w-full snap-start snap-always bg-black"
            onClick={togglePlayPause} 
          >
            {shouldRender ? (
              <OptimizedVideoPlayer
                // ✅ Humne fetchVideos mein mapping fix kar di hai, 
                // toh ab video.video_url mein confirm data hoga.
                videoUrl={video.video_url}
                videoId={video.id}
                isActive={isActive && isPlaying}
                username={video.user_name}
                avatarUrl={video.user_avatar}
                caption={video.caption}
                filterName={video.filter_name || 'none'}
              />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white/5 animate-spin" />
              </div>
            )}

            {showPlayIcon && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-black/40 p-4 rounded-full animate-ping">
                  {!isPlaying ? <Pause size={40} fill="white" /> : <PlayIcon size={40} fill="white" />}
                </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/95 via-transparent to-transparent text-white z-20 pointer-events-none">
              <div 
                className="flex items-center gap-3 mb-3 pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (video.user_id) navigate(`/profile/${video.user_id}`);
                }}
              >
                <img 
                  // ✅ Profile Photo Fix: Fallback image handle ho rahi hai
                  src={video.user_avatar} 
                  className="w-11 h-11 rounded-full border-2 border-white object-cover" 
                  alt="avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
                  }}
                />
                <span className="font-black text-lg shadow-black drop-shadow-lg">@{video.user_name}</span>
                <button 
                  onClick={(e) => handleFollowToggle(e, video.user_id)} 
                  className={`ml-2 px-5 py-1.5 rounded-full text-xs font-black pointer-events-auto ${followedUsers.has(video.user_id) ? 'bg-gray-700/80' : 'bg-blue-600'}`}
                >
                  {followedUsers.has(video.user_id) ? 'Following' : 'Follow'}
                </button>
              </div>
              <p className="text-sm mb-4 line-clamp-2 pr-20 drop-shadow-md pointer-events-auto">{video.caption}</p>
              <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">
                <Music2 size={14} />
                <span className="truncate">Original Audio - {video.user_name}</span>
              </div>
            </div>

            <div className="absolute right-3 bottom-24 z-20" onClick={(e) => e.stopPropagation()}>
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
