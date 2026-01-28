import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { Loader2, Music2 } from 'lucide-react';
import { toast } from 'sonner'; // Toast notifications ke liye

export function RealVideoFeed({ onComment }: { onComment: (videoId: string) => void }) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setVideos(data);
      
    } catch (error) {
      console.error('Error fetching videos from Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  // --- NATIVE SHARE LOGIC ADDED HERE ---
  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/video/${video.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Chiti Shorts',
          text: `Check out this video by @${video.user_name}`,
          url: shareUrl
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      } catch (err) {
        toast.error("Failed to copy link");
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-400 font-bold">CHITI LOADING...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Videos Yet</h2>
          <p className="text-gray-400 mb-4">Upload something to see it here!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
      onScroll={handleScroll}
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {videos.map((video, index) => (
        <div key={video.id} className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black">
          
          {/* FULL SCREEN YOUTUBE PLAYER */}
          <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
            <iframe
              className="w-full h-full scale-[1.6] origin-center object-cover" 
              src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${index === activeIndex ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=1&playlist=${video.youtube_video_id}&mute=0&showinfo=0&iv_load_policy=3&disablekb=1`}
              title="Chiti Short"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>

          {/* User Info Overlay - Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white z-10">
            <div className="flex items-center gap-3 mb-3">
              <img 
                src={video.user_avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                className="w-11 h-11 rounded-full border-2 border-white shadow-lg" 
                alt="user" 
              />
              <div className="flex flex-col">
                <span className="font-black text-lg tracking-tight">@{video.user_name}</span>
              </div>
              <button className="ml-2 bg-white text-black px-4 py-1 rounded-full text-xs font-bold active:scale-90 transition">Follow</button>
            </div>
            
            <p className="text-sm mb-4 line-clamp-2 pr-20 font-medium opacity-90">{video.caption}</p>
            
            <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
              <Music2 size={14} className="animate-pulse" />
              <span className="truncate">Original Audio - {video.user_name}</span>
            </div>
          </div>

          {/* Action Buttons (Right Side) */}
          <div className="absolute right-3 bottom-24 z-20">
            <VideoActions
              videoId={video.id}
              initialLikes={video.likes_count || 0}
              initialComments={0}
              initialShares={0}
              onComment={() => onComment(video.id)}
              onShare={() => handleVideoShare(video)} // PASSING THE FUNCTION HERE
            />
          </div>
        </div>
      ))}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        iframe { pointer-events: none; }
      `}</style>
    </div>
  );
}
