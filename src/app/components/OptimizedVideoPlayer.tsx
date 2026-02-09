import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

// --- INTERFACE UPDATE ---
// Humne yahan avatarUrl aur caption add kiya hai taki parent se data yahan aa sake
interface OptimizedVideoPlayerProps {
  videoUrl: string;
  videoId: string;
  isActive: boolean;
  username?: string;
  avatarUrl?: string; // Naya prop: Photo ke liye
  caption?: string;   // Naya prop: Caption ke liye
}

export function OptimizedVideoPlayer({
  videoUrl,
  videoId,
  isActive,
  username,
  avatarUrl,
  caption
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasCounted = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // --- 🚀 SPEED BOOSTER: Preload logic (Same as yours) ---
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  // --- VIEW COUNT LOGIC (Same as yours) ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActive && !hasCounted.current && videoId) {
      timer = setTimeout(async () => {
        try {
          const { error } = await supabase.rpc('increment_views', { 
            post_id: videoId 
          });
          if (!error) {
            hasCounted.current = true;
            console.log("View recorded for:", videoId);
          }
        } catch (err) {
          console.error("View error:", err);
        }
      }, 2000); 
    }
    return () => clearTimeout(timer);
  }, [isActive, videoId]);

  // --- PLAY/PAUSE CONTROL (Same as yours) ---
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isActive) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Autoplay blocked");
        });
      }
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; 
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* Loading Spinner */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        src={videoUrl}
        loop
        muted={!isActive}
        playsInline
        preload="auto"
        onCanPlay={() => setIsLoaded(true)}
      />
      
      {/* --- UI OVERLAY (Ismein humne Photo aur Fresh Name add kiya hai) --- */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white pointer-events-none">
        
        <div className="flex items-center gap-3 mb-3">
          {/* User Photo: Ye ab hamesha latest avatarUrl dikhayega */}
          <img 
            src={avatarUrl || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
            className="w-11 h-11 rounded-full border-2 border-white shadow-lg object-cover" 
            alt="avatar"
          />
          <div>
            {/* Latest Username */}
            <p className="font-black text-lg shadow-black drop-shadow-lg">@{username || 'user'}</p>
          </div>
        </div>

        {/* Video Caption */}
        <p className="text-sm mb-4 line-clamp-2 drop-shadow-md">{caption}</p>
        
        <p className="text-[10px] opacity-30 mt-1">ID: {videoId}</p>
      </div>
    </div>
  );
}
