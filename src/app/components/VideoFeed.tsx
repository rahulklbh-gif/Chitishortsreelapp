"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { OptimizedVideoPlayer } from './OptimizedVideoPlayer'; 
import { Loader2, Zap, Music2, Send } from 'lucide-react'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { useNavigate } from 'react-router-dom'; 

export default function VideoFeed() {
  const { user: currentUser } = useAuth(); 
  const navigate = useNavigate(); 
  const [posts, setPosts] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        // ✅ Login status ke hisab se loading state update karein
        setLoading(true); 
        
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
    // ✅ SUDHAR: currentUser ko add kiya taaki login/logout par videos turant reload hon
  }, [currentUser]); 

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
    <div className="relative h-screen w-full bg-black">
      {/* INSTAGRAM STYLE HEADER */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-8 flex items-center justify-between z-[100] bg-gradient-to-b from-black/60 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          CHITI <span className="text-blue-500">SHORTS</span>
        </h1>
        
        <div className="flex items-center gap-3">
          {currentUser ? (
            <button 
              onClick={() => navigate('/chats')} 
              className="p-2 bg-black/20 backdrop-blur-md rounded-full border border-white/10 active:scale-90 transition-all shadow-lg relative"
            >
              <Send size={22} className="text-white -rotate-12" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-black animate-pulse"></span>
            </button>
          ) : (
            <button 
              onClick={() => navigate('/auth')} 
              className="px-4 py-1.5 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* VIDEO CONTAINER */}
      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {posts.length > 0 ? (
          posts.map((post, index) => {
            const shouldRender = index >= activeIndex - 1 && index <= activeIndex + 1;
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

                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white z-20 pointer-events-none">
                      <div className="flex items-center gap-3 mb-3 pointer-events-auto">
                        <div 
                          onClick={() => navigate(`/profile/${latestName}`)}
                          className="w-11 h-11 rounded-full border-2 border-white overflow-hidden shadow-lg cursor-pointer"
                        >
                          <img 
                            src={latestAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestName}`} 
                            className="w-full h-full object-cover" 
                            alt="profile" 
                          />
                        </div>
                        <span 
                          onClick={() => navigate(`/profile/${latestName}`)}
                          className="font-black text-lg drop-shadow-lg cursor-pointer"
                        >
                          @{latestName}
                        </span>
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
    </div>
  );
}
