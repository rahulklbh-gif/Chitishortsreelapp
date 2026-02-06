import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface OptimizedVideoPlayerProps {
  videoUrl: string;
  videoId: string;
  isActive: boolean;
  username?: string;
}

export function OptimizedVideoPlayer({
  videoUrl,
  videoId,
  isActive,
  username
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasCounted = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // --- 🚀 SPEED BOOSTER: Preload logic ---
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load(); // Browser ko signal dena ki download shuru karo
    }
  }, [videoUrl]);

  // --- VIEW COUNT LOGIC (With Safety) ---
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isActive && !hasCounted.current && videoId) {
      // 2 second rukne ke baad view count hoga (taki faltu clicks na ho)
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

  // --- PLAY/PAUSE CONTROL ---
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isActive) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Autoplay blocked, waiting for interaction");
        });
      }
    } else {
      videoRef.current.pause();
      // Swipe hone par wapas 0 par set karo taki next time shuru se chale
      videoRef.current.currentTime = 0; 
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* Loading Spinner jab tak video load na ho */}
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
        preload="auto" // Sabse zaroori: Background mein load karne ke liye
        onCanPlay={() => setIsLoaded(true)}
      />
      
      {/* UI Overlay */}
      <div className="absolute bottom-24 left-4 text-white p-4 bg-gradient-to-t from-black/80 to-transparent w-full">
        <p className="font-bold text-lg">@{username}</p>
        <p className="text-xs opacity-50">ID: {videoId}</p>
      </div>
    </div>
  );
}
