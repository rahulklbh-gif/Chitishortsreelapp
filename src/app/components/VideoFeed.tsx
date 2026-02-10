import { useState, useRef, useEffect } from 'react';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
import { supabase } from '@/lib/supabase'; 
import { useSearchParams } from 'react-router-dom';

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
}

interface VideoFeedProps {
  videos: Video[];
  onComment: (videoId: string) => void;
}

export function VideoFeed({ videos: initialVideos, onComment }: VideoFeedProps) {
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Ref to track if we have already handled the URL redirect
  const hasHandledDeepLink = useRef(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isDragging = useRef(false);

  // Sync props with state ONLY if not deep linking
  useEffect(() => {
    if (!searchParams.get('video')) {
        setVideos(initialVideos);
    } else if (initialVideos.length > 0 && !hasHandledDeepLink.current) {
        // Agar initialVideos load ho gaye hain, toh check karo ki unme wo video hai ya nahi
        checkAndSetupVideo();
    }
  }, [initialVideos, searchParams]);

  /**
   * --- MAIN FIX: URL VIDEO HANDLER ---
   * Ye function check karega ki URL wala video list mein hai ya nahi.
   * Agar nahi hai, to use fetch karke Top par layega.
   */
  const checkAndSetupVideo = async () => {
    const videoIdFromUrl = searchParams.get('video');
    if (!videoIdFromUrl || hasHandledDeepLink.current) return;

    // 1. Check karo ki kya video already list mein hai?
    const existingIndex = videos.findIndex((v) => v.id === videoIdFromUrl);
    
    if (existingIndex !== -1) {
        // Agar mil gaya, to wahan jump karo
        setCurrentIndex(existingIndex);
        hasHandledDeepLink.current = true;
    } else {
        // 2. Agar list mein nahi mila (search result purana ho sakta hai), to use FETCH karo
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
                // Naye video ko sabse upar (Index 0) par add karo
                setVideos((prev) => [singleVideo, ...prev]);
                setCurrentIndex(0); // Pehla video play karo
                hasHandledDeepLink.current = true;
            }
        } catch (err) {
            console.error("Error fetching deep linked video:", err);
        }
    }
  };

  // Jab component mount ho, tab bhi check karo
  useEffect(() => {
    checkAndSetupVideo();
  }, [searchParams]);

  
  // --- REALTIME UPDATES ---
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
                    shares_count: payload.new.shares_count 
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

  // --- PRELOAD LOGIC ---
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

  // --- TOUCH HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;

    if (Math.abs(diff) > 50) {
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

  // --- WHEEL HANDLER ---
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 10) return; 
    if (e.deltaY > 30 && currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (e.deltaY < -30 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // --- SCROLL ANIMATION ---
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
        className="transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] h-full"
        style={{ willChange: 'transform' }}
      >
        {videos.map((video, index) => {
          const finalUsername = video.profiles?.username || video.user_name || 'User';
          const finalAvatar = video.profiles?.avatar_url || video.user_avatar;

          return (
            <div key={video.id} className="h-screen w-screen relative overflow-hidden">
              <OptimizedVideoPlayer
                videoId={video.id}
                videoUrl={video.video_url}
                thumbnailUrl={video.thumbnail_url}
                isActive={index === currentIndex}
                caption={video.caption}
                username={finalUsername}
                avatarUrl={finalAvatar} 
                music={video.music}
                likesCount={video.likes_count || 0}
                commentsCount={video.comments_count || 0}
                sharesCount={video.shares_count || 0}
                onVideoClick={() => {}} 
                onComment={() => onComment(video.id)}
              />
            </div>
          );
        })}
      </div>

      <div className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-50 pointer-events-none">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`w-1 rounded-full transition-all duration-500 ${
              index === currentIndex ? 'bg-blue-500 h-12 shadow-[0_0_10px_#3b82f6]' : 'bg-white/20 h-6'
            }`}
          />
        ))}
      </div>
    </div>
  );
} 
