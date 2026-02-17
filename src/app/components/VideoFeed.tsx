"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
import { Loader2, Zap } from 'lucide-react';

export default function VideoFeed() {
  const [posts, setPosts] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Data Fetching (Profiles Join ke saath update kiya gaya hai)
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        // 🔥 YAHAN CHANGE KIYA HAI: posts ke saath profiles table ko join kiya
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              username,
              avatar_url
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (err) {
        console.error("Feed error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  // 2. Scroll Logic: Pata lagana kaunsi video screen par hai
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      if (index !== activeIndex) {
        setActiveIndex(index);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-blue-500 font-black italic animate-pulse">CHITI FEED LOADING...</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black no-scrollbar"
    >
      {posts.length > 0 ? (
        posts.map((post, index) => {
          const shouldRender = index >= activeIndex - 1 && index <= activeIndex + 1;

          return (
            <div 
              key={post.id} 
              className="h-screen w-full snap-start snap-always relative border-b border-white/5"
            >
              {shouldRender ? (
                <OptimizedVideoPlayer
                  videoUrl={post.video_url}
                  videoId={post.id}
                  isActive={index === activeIndex}
                  // 🔥 YAHAN CHANGE KIYA HAI: Latest data dikhane ke liye profiles object ka use
                  username={post.profiles?.username || post.user_name}
                  userAvatar={post.profiles?.avatar_url || post.user_avatar}
                  caption={post.caption}
                  filterName={post.filter_name || 'none'}
                />
              ) : (
                <div className="h-full w-full bg-zinc-950 flex items-center justify-center">
                   <Zap className="text-zinc-900" size={40} />
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="h-screen w-full flex items-center justify-center text-zinc-500 font-bold">
          Abhi koi video nahi hai.
        </div>
      )}
    </div>
  );
}
