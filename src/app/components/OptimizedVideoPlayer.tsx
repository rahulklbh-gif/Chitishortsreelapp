import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface OptimizedVideoPlayerProps {
  videoUrl: string;
  videoId: string;
  isActive: boolean;
  username?: string;
  caption?: string;
}

export function OptimizedVideoPlayer({
  videoUrl,
  videoId,
  isActive,
  username,
  caption
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- SABSE SIMPLE VIEW COUNT LOGIC (NO CONDITIONS) ---
  useEffect(() => {
    const forceViewCount = async () => {
      if (!videoId) return;

      console.log("Attempting view for:", videoId);
      
      const { data, error } = await supabase.rpc('increment_views', { 
        post_id: videoId 
      });

      if (error) {
        // Agar yahan galti hai toh ye alert pakka aayega
        alert("DATABASE ERROR: " + error.message);
      } else {
        console.log("VIEW SUCCESS:", videoId);
        // Chhota sa alert check karne ke liye (Baad mein hata denge)
        // alert("View Counted for: " + videoId);
      }
    };

    // Jab video active ho, tabhi count kare
    if (isActive) {
      forceViewCount();
    }
  }, [isActive, videoId]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={videoUrl}
        loop
        muted
        playsInline
        autoPlay={isActive}
      />
      
      {/* Video Info Overlay */}
      <div className="absolute bottom-10 left-4 text-white z-10">
        <p className="font-bold">@{username || 'user'}</p>
        <p className="text-sm">{caption}</p>
        <p className="text-[10px] bg-red-600 px-2 py-1 mt-2 inline-block">
          ID: {videoId} | Status: {isActive ? 'ACTIVE' : 'WAITING'}
        </p>
      </div>
    </div>
  );
}
