import { useState, useEffect, useRef } from 'react';
import { VideoActions } from './VideoActions';
import { supabase } from '@/lib/supabase';
import { Loader2, Music2, Play as PlayIcon } from 'lucide-react';
import { toast } from 'sonner'; 

export function RealVideoFeed({ onComment }: { onComment: (videoId: string) => void }) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); // Play/Pause state
  const [showPlayIcon, setShowPlayIcon] = useState(false); // Visual feedback ke liye
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
        // --- GRID CLICK LOGIC START ---
        const urlParams = new URLSearchParams(window.location.search);
        const videoIdFromUrl = urlParams.get('video');

        if (videoIdFromUrl) {
          const clickedVideoIndex = data.findIndex(v => v.id === videoIdFromUrl);
          if (clickedVideoIndex !== -1) {
            // Reorder list: Clicked video ko sabse upar le aao
            const clickedVideo = data.splice(clickedVideoIndex, 1)[0];
            data.unshift(clickedVideo);
          }
        }
        // --- GRID CLICK LOGIC END ---
        
        setVideos(data);
      }
      
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
      setIsPlaying(true); // Agli video automatically play hogi
    }
  };

  // --- PLAY/PAUSE LOGIC ---
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 500); // 0.5 sec baad icon hide ho jayega
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
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
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
        <div 
          key={video.id} 
          className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black"
          onClick={togglePlayPause} // Pure screen par click se Play/Pause
        >
          
          {/* FULL SCREEN YOUTUBE PLAYER */}
          <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
            <iframe
              className="w-full h-full scale-[1.6] origin-center object-cover" 
              src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=${index === activeIndex && isPlaying ? 1 : 0}&controls=0&rel=0&modestbranding=1&loop=1&playlist=${video.youtube_video_id}&mute=0&showinfo=0&iv_load_policy=3&disablekb=1&enablejsapi=1`}
              title="Chiti Short"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>

          {/* PLAY/PAUSE CENTER ICON ANIMATION */}
          {showPlayIcon && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-black/40 p-5 rounded-full animate-ping">
                {isPlaying ? <PlayIcon size={40} fill="white" /> : <div className="w-10 h-10 border-l-8 border-r-8 border-white mx-auto"></div>}
              </div>
            </div>
          )}

          {/* User Info Overlay - Bottom */}
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
              <button className="ml-2 bg-white text-black px-4 py-1 rounded-full text-xs font-bold active:scale-90 transition">Follow</button>
            </div>
            
            <p className="text-sm mb-4 line-clamp-2 pr-20 font-medium opacity-90">{video.caption}</p>
            
            <div className="flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
              <Music2 size={14} className="animate-pulse" />
              <span className="truncate">Original Audio - {video.user_name}</span>
            </div>
          </div>

          {/* Action Buttons (Right Side) */}
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
