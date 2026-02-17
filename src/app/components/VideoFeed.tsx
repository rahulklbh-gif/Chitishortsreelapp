"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
import { Loader2, Zap, Music2 } from 'lucide-react';

export default function VideoFeed() {
  const [posts, setPosts] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
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
          console.error("Join Error:", error);
          const { data: basicData } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      if (index !== activeIndex) setActiveIndex(index);
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
    <div ref={containerRef} className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black no-scrollbar">
      {posts.length > 0 ? (
        posts.map((post, index) => {
          const shouldRender = index >= activeIndex - 1 && index <= activeIndex + 1;

          // 🔥 Fetching latest from join
          const latestName = post.profiles?.username || post.user_name || 'user';
          const latestAvatar = post.profiles?.avatar_url || post.user_avatar;

          return (
            <div key={post.id} className="h-screen w-full snap-start snap-always relative border-b border-white/5">
              {shouldRender ? (
                <>
                  <OptimizedVideoPlayer
                    videoUrl={post.video_url}
                    videoId={post.id}
                    isActive={index === activeIndex}
                    filterName={post.filter_name || 'none'}
                  />

                  {/* 🔥 UI LAYER: Ye yahan hona chahiye kyunki Player se humne hata diya hai */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white z-20 pointer-events-none">
                    <div className="flex items-center gap-3 mb-3 pointer-events-auto">
                      <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden shadow-lg">
                        <img 
                          src={latestAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestName}`} 
                          className="w-full h-full object-cover" 
                          alt="profile" 
                        />
                      </div>
                      <span className="font-black text-lg drop-shadow-lg">@{latestName}</span>
                    </div>
                    
                    <p className="text-sm mb-4 line-clamp-2 pr-10 drop-shadow-md pointer-events-auto">
                      {post.caption}
                    </p>

                    <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">
                      <Music2 size={14} className="animate-spin-slow" />
                      <span>Original Audio - {latestName}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full w-full bg-zinc-950 flex items-center justify-center">
                   <Zap className="text-zinc-900" size={40} />
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="h-screen w-full flex items-center justify-center text-zinc-500 font-bold">Abhi koi video nahi hai.</div>
      )}
    </div>
  );
}
