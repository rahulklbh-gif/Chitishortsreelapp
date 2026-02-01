import { useEffect, useRef } from 'react';
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

  // --- FORCE TEST: Jaise hi video screen par aaye, View count hona chahiye ---
  useEffect(() => {
    const triggerTest = async () => {
      // Agar videoId nahi mil rahi hogi toh ye alert aayega
      if (!videoId) {
        alert("ERROR: Video ID hi nahi mil rahi!");
        return;
      }

      console.log("Sending View for ID:", videoId);
      
      const { error } = await supabase.rpc('increment_views', { 
        post_id: videoId 
      });

      if (error) {
        // Agar SQL function mein galti hai toh ye alert aayega
        alert("SQL DATABASE ERROR: " + error.message);
      } else {
        // Agar sab theek hai toh ye alert aayega
        alert("SUCCESS: View Count Ho Gaya!");
      }
    };

    triggerTest();
  }, [videoId]); // Isme koi condition nahi hai, ye chalna hi chahiye!

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain" // Zoom fix: video kategi nahi
        src={videoUrl}
        loop
        muted
        playsInline
        autoPlay
      />
      <div className="absolute bottom-10 left-4 text-white p-4 bg-black/50">
        <p>User: {username}</p>
        <p>Video ID: {videoId}</p>
      </div>
    </div>
  );
}
