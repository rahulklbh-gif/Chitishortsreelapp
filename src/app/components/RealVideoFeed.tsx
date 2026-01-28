import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext'; // Follow ke liye zaruri
import { Loader2, Music2, Play as PlayIcon } from 'lucide-react';
import { toast } from 'sonner'; 

export function RealVideoFeed({ onComment }: { onComment: (videoId: string) => void }) {
  const { user: currentUser } = useAuth(); // Auth context se user le rahe hain
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); 
  const [showPlayIcon, setShowPlayIcon] = useState(false); 
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
      
      if (data) {
        // --- FEATURE 1: SEARCH & URL FILTER ---
        const urlParams = new URLSearchParams(window.location.search);
        const videoIdFromUrl = urlParams.get('video');
        const searchTerm = urlParams.get('search')?.toLowerCase();

        let filteredData = data;

        // Agar search keyword hai toh filter karein
        if (searchTerm) {
          filteredData = data.filter(v => 
            v.user_name?.toLowerCase().includes(searchTerm) || 
            v.caption?.toLowerCase().includes(searchTerm)
          );
        }

        // Grid Click Logic
        if (videoIdFromUrl) {
          const clickedVideoIndex = filteredData.findIndex(v => v.id === videoIdFromUrl);
          if (clickedVideoIndex !== -1) {
            const clickedVideo = filteredData.splice(clickedVideoIndex, 1)[0];
            filteredData.unshift(clickedVideo);
          }
        }
        
        setVideos(filteredData);
      }
      
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- FEATURE 2: AUTO-NEXT LOGIC ---
  useEffect(() => {
    const handleYTMessage = (event: MessageEvent) => {
      // YouTube player se message listen karte hain
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data = JSON.parse(event.data);
        // infoDelivery aur state 0 ka matlab video khatam (Ended)
        if (data.event === "infoDelivery" && data.info?.playerState === 0) {
          if (containerRef.current && activeIndex < videos.length - 1) {
            containerRef.current.scrollTo({
              top: (activeIndex + 1) * window.innerHeight,
              behavior: 'smooth'
            });
          }
        }
      } catch (err) {}
    };

    window.addEventListener("message", handleYTMessage);
    return () => window.removeEventListener("message", handleYTMessage);
  }, [activeIndex, videos]);

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

  // --- FEATURE 3: FOLLOW/UNFOLLOW LOGIC ---
  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.error("Please login to follow creators");
      return;
    }
    if (currentUser.id === targetUserId) {
      toast.error("Bhai, khud ko kaise follow karoge?");
      return;
    }

    try {
      // Check if already following
      const { data: existingFollow } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (existingFollow) {
        await supabase.from('follows').delete().eq('id', existingFollow.id);
        toast.success("Unfollowed");
      } else {
        await supabase.from('follows').insert([
          { follower_id: currentUser.id, following_id: targetUserId }
        ]);
        toast.success("Following!");
      }
    } catch (err) {
      toast.error("Kuch gadbad hui");
    }
  };

  const handleVideoShare = async (video: any) => {
    const shareUrl = `${window.location.origin}/video/${video.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Chiti Shorts',
          text: `Check out this video by @${video.user_name}`,
          url: shareUrl
        });
      } catch (err) { console.log("Share cancelled"); }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      } catch (err) { toast.error("Failed to copy link"); }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-400 font-bold tracking-widest uppercase">Chiti Loading...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 uppercase italic">Koi Video Nahi Mili</h2>
          <p className="text-gray-400 mb-4">Search badaliye ya naya upload kijiye!</p>
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
        <div 
          key={video.id} 
          className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black"
          onClick={togglePlayPause} 
        >
          
          <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
            <iframe
              className="w-full h-full scale-[1.6] origin-center object-cover" 
              src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${index === activeIndex && isPlaying ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=0&playlist=${video.youtube_video_id}&mute=0&showinfo=0&iv_load_policy=3&disablekb=1&enablejsapi=1`}
              title="Chiti Short"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>

          {showPlayIcon && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-black/40 p-5 rounded-full animate-ping">
                {isPlaying ? <PlayIcon size={40} fill="white" /> : <div className="w-10 h-10 border-l-8 border-r-8 border-white mx-auto"></div>}
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white z-10 pointer-events-none">
            <div className="flex items-center gap-3 mb-3 pointer-events-auto">
              <img 
                src={video.user_avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                className="w-11 h-11 rounded-full border-2 border-white shadow-lg" 
                alt="user" 
              />
              <div className="flex flex-col">
                <span className="font-black text-lg tracking-tight">@{video.user_name}</span>
              </div>
              <button 
                onClick={(e) => handleFollowToggle(e, video.user_id)}
                className="ml-2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold active:scale-90 transition shadow-lg shadow-blue-500/20"
              >
                Follow
              </button>
            </div>
            
            <p className="text-sm mb-4 line-clamp-2 pr-20 font-medium opacity-90">{video.caption}</p>
            
            <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
              <Music2 size={14} className="animate-pulse" />
              <span className="truncate">Original Audio - {video.user_name}</span>
            </div>
          </div>

          <div className="absolute right-3 bottom-24 z-20" onClick={(e) => e.stopPropagation()}>
            <VideoActions
              videoId={video.id}
              initialLikes={video.likes_count || 0}
              initialComments={0}
              initialShares={0}
              onComment={() => onComment(video.id)}
              onShare={() => handleVideoShare(video)}
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
