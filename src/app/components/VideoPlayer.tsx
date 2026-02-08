import { useRef, useEffect, useState } from 'react';
import { VideoActions } from './VideoActions';
import { Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { toast } from 'sonner';

export interface Video {
  id: string;
  url: string; // Ab isme Cloudflare R2 ka link (https://pub-xxx.r2.dev/video.mp4) aayega
  thumbnail: string;
  username: string;
  avatar: string;
  caption: string;
  musicTitle: string;
  likes: number;
  comments: number;
  shares: number;
  hashtags: string[];
  user_id?: string; 
}

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
  onComment: () => void;
}

export function VideoPlayer({ video, isActive, onComment }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user: currentUser } = useAuth(); 
  const [isMuted, setIsMuted] = useState(true);

  // 1. Views Badhane ka logic (Bilkul Safe)
  useEffect(() => {
    if (isActive && video.id) {
      supabase.rpc('increment_views', { post_id: video.id });
    }
  }, [isActive, video.id]);

  // 2. Play/Pause Control logic (R2 optimized)
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        // Play() return a promise, handle it to avoid console errors
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            console.log("Auto-play was prevented. Waiting for user interaction.");
          });
        }
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Video ko start se reset karein jab swipe ho jaye
      }
    }
  }, [isActive]);

  // 3. Follow Handle karne ka asli logic (Database Connection)
  const handleFollow = async () => {
    if (!currentUser) {
      toast.error("Pehle login karein!");
      return;
    }
    if (!video.user_id || currentUser.id === video.user_id) return;

    try {
      const { error } = await supabase.from('follows').insert([
        { follower_id: currentUser.id, following_id: video.user_id }
      ]);

      if (error) {
        if (error.code === '23505') { 
          toast.info("Aap pehle hi follow kar rahe hain");
        } else {
          throw error;
        }
      } else {
        await supabase.rpc('increment_followers', { user_id: video.user_id });
        
        await supabase.from('notifications').insert([{
          type: 'follow',
          sender_id: currentUser.id,
          sender_name: currentUser.user_metadata.username || currentUser.email?.split('@')[0] || "Someone",
          receiver_id: video.user_id,
          content: 'started following you'
        }]);
        
        toast.success(`@${video.username} ko follow kar liya!`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Follow nahi ho paya");
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${video.username}'s video on Chiti Shorts`,
        text: video.caption,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copy ho gaya!");
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      
      {/* --- FAST LOADING HACK: Background Thumbnail --- */}
      {/* Jab tak video load ho raha ho, blur thumbnail dikhao */}
      <img 
        src={video.thumbnail} 
        alt="background blur" 
        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
        style={{ zIndex: 0 }} 
      />

      {/* --- CLOUDFLARE R2 VIDEO PLAYER --- */}
      {/* Humne YouTube iframe ko poori tarah hata diya hai fast loading ke liye */}
      <video
        ref={videoRef}
        src={video.url} // Aapka R2 link yahan aayega
        poster={video.thumbnail}
        loop
        muted={isMuted}
        playsInline
        preload="auto" // Isse browser video ko background mein load kar lega
        className="relative z-10 w-full h-full object-contain md:object-cover"
        onClick={toggleMute}
      />

      {/* --- Mute Button --- */}
      <button
        onClick={toggleMute}
        className="absolute top-20 right-3 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center z-30 pointer-events-auto border border-white/10"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {/* --- Video Info Overlay --- */}
      <div className="absolute bottom-24 left-3 right-20 z-20 pointer-events-none">
        <div className="space-y-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <img src={video.avatar} className="w-10 h-10 rounded-full border border-white" alt="avatar" />
            <h3 className="text-white font-bold text-lg drop-shadow-md">@{video.username}</h3>
          </div>
          <p className="text-white text-sm line-clamp-2 drop-shadow-md">{video.caption}</p>
          <div className="flex flex-wrap gap-2">
            {video.hashtags && video.hashtags.map((tag) => (
              <span key={tag} className="text-white text-sm font-semibold drop-shadow-md opacity-90">#{tag}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white/90 text-xs bg-black/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
            <span className="truncate">🎵 {video.musicTitle || 'Original Audio'}</span>
          </div>
        </div>
      </div>

      {/* --- Sidebar Actions --- */}
      <div className="relative z-30">
        <VideoActions
          videoId={video.id}
          initialLikes={video.likes}
          videoOwnerId={video.user_id} 
          onComment={onComment}
          onShare={handleShare}
          onFollow={handleFollow} 
        />
      </div>
    </div>
  );
}
