"use client";

import { useState, useRef, useEffect } from 'react';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
import { supabase } from '@/lib/supabase'; 
import { useSearchParams } from 'react-router-dom';

/**
 * 📝 VIDEO INTERFACE
 * Isme filter_name ko mandatory rakha hai taaki player hamesha alert rahe.
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
  music?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  filter_name?: string; // 👈 Har video ka apna filter
}

interface VideoFeedProps {
  videos: Video[];
  onComment: (videoId: string) => void;
}

export function VideoFeed({ videos: initialVideos, onComment }: VideoFeedProps) {
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const hasHandledDeepLink = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isDragging = useRef(false);

  // 1. SYNC & DEEP LINK LOGIC
  useEffect(() => {
    if (!searchParams.get('video')) {
        setVideos(initialVideos);
    } else if (initialVideos.length > 0 && !hasHandledDeepLink.current) {
        checkAndSetupVideo();
    }
  }, [initialVideos, searchParams]);

  /**
   * 🔗 DEEP LINK HANDLER
   * Agar koi specific video share link se aaya hai, toh use top par layein filter ke saath.
   */
  const checkAndSetupVideo = async () => {
    const videoIdFromUrl = searchParams.get('video');
    if (!videoIdFromUrl || hasHandledDeepLink.current) return;

    const existingIndex = videos.findIndex((v) => v.id === videoIdFromUrl);
    
    if (existingIndex !== -1) {
        setCurrentIndex(existingIndex);
        hasHandledDeepLink.current = true;
    } else {
        try {
            const { data: singleVideo, error } = await supabase
                .from('posts')
                .select(`
                  *,
                  profiles:user_id (
                    username,
                    full_name,
                    avatar_url
                  )
                `)
                .eq('id', videoIdFromUrl)
                .single();

            if (singleVideo && !error) {
                // Video ke saath filter_name bhi load hoga database se
                setVideos((prev) => [singleVideo, ...prev]);
                setCurrentIndex(0);
                hasHandledDeepLink.current = true;
            }
        } catch (err) {
            console.error("Deep link error:", err);
        }
    }
  };

  useEffect(() => {
    checkAndSetupVideo();
  }, [searchParams]);

  
  // 2. REALTIME ENGINE
  // Jab likes ya comments badhein toh state turant update ho
  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          setVideos((currentVideos) =>
            currentVideos.map((v) =>
              v.id === payload.new.id
                ? { 
                    ...v, 
                    comments_count: payload.new.comments_count, 
                    likes_count: payload.new.likes_count,
                    shares_count: payload.new.shares_count,
                    filter_name: payload.new.filter_name // Realtime filter change update
                  }
                : v
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. SMART PRELOAD (Filter-Aware)
  // Agli video load karte waqt filter logic pehle se taiyar rakhein
  useEffect(() => {
    const preloadNextVideos = () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex < videos.length) {
        const videoElement = document.createElement('video');
        videoElement.src = videos[nextIndex].video_url;
        videoElement.preload = 'auto';
      }
    };
    preloadNextVideos();
  }, [currentIndex, videos]);

  // 4. NAVIGATION HANDLERS (Swipe & Wheel)
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;

    if (Math.abs(diff) > 60) { // Threshold for smooth swipe
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(currentIndex + 1);
        isDragging.current = false;
      } else if (diff < 0 && currentIndex > 0) { 
        setCurrentIndex(currentIndex - 1);
        isDragging.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 15) return; 
    if (e.deltaY > 50 && currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (e.deltaY < -50 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // 5. TRANSFORM ANIMATION
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translateY(-${currentIndex * 100}vh)`;
    }
  }, [currentIndex]);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div
        ref={containerRef}
        className="transition-transform duration-500 ease-[cubic-bezier(0.15,1,0.3,1)] h-full"
        style={{ willChange: 'transform' }}
      >
        {videos.map((video, index) => {
          // Fallback logic for user data
          const finalUsername = video.profiles?.username || video.user_name || 'chiti_user';
          const finalAvatar = video.profiles?.avatar_url || video.user_avatar;

          return (
            <div key={video.id} className="h-screen w-screen relative overflow-hidden bg-zinc-950">
              <OptimizedVideoPlayer
                videoId={video.id}
                videoUrl={video.video_url}
                isActive={index === currentIndex}
                caption={video.caption}
                username={finalUsername}
                avatarUrl={finalAvatar} 
                filterName={video.filter_name || 'none'} // 👈 Passing the filter from DB
                likesCount={video.likes_count || 0}
                commentsCount={video.comments_count || 0}
                sharesCount={video.shares_count || 0}
                onComment={() => onComment(video.id)}
              />
            </div>
          );
        })}
      </div>

      {/* 🧭 NAVIGATION DOTS (Right Side Indicator) */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-[100] pointer-events-none">
        {videos.slice(0, 10).map((_, index) => ( // Show first 10 dots only to avoid clutter
          <div
            key={index}
            className={`w-1 rounded-full transition-all duration-700 ${
              index === currentIndex 
                ? 'bg-blue-500 h-14 shadow-[0_0_15px_#3b82f6]' 
                : 'bg-white/10 h-6'
            }`}
          />
        ))}
        {videos.length > 10 && <div className="text-[8px] text-white/20 font-bold self-center">...</div>}
      </div>

      {/* 📱 MOBILE OVERLAY (Optional - For better experience) */}
      <div className="fixed top-0 w-full h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-50" />
    </div>
  );
} 
