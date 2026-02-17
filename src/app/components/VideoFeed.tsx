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

  // 1. Data Fetching (Join logic with safety check)
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        // 🔥 Profiles join kar rahe hain hamesha latest data ke liye
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            profiles!user_id (
              username,
              avatar_url
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Join Error, fetching basic posts:", error);
          // Agar join fail ho jaye (Foreign key issue), toh normal fetch karo
          const { data: basicData } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
          setPosts(basicData || []);
        } else {
          setPosts(data || []);
        }
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

          // 🔥 Logic for latest username and photo
          // Agar profiles join work kar raha hai toh wahan se lo, nahi toh post table se
          const latestName = post.profiles?.username || post.user_name || 'user';
          const latestAvatar = post.profiles?.avatar_url || post.user_avatar;

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
                  // Latest dynamic data pass ho raha hai
                  username={latestName}
                  userAvatar={latestAvatar}
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
