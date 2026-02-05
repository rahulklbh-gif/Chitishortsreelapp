import { useRef, useEffect, useState } from 'react';
import { VideoActions } from './VideoActions';
import { Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { toast } from 'sonner';

export interface Video {
  id: string;
  url: string;
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

  // --- NEW: YouTube ID Extractor ---
  const getYouTubeID = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const youtubeId = getYouTubeID(video.url);
  // ----------------------------------

  // 1. Views Badhane ka logic (Bilkul Safe)
  useEffect(() => {
    if (isActive && video.id) {
      supabase.rpc('increment_views', { post_id: video.id });
    }
  }, [isActive, video.id]);

  useEffect(() => {
    // Agar normal video hai (Not YouTube), tabhi ref use karenge
    if (videoRef.current && !youtubeId) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive, youtubeId]);

  // 2. Follow Handle karne ka asli logic (Database Connection)
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
        if (error.code === '23505') { // Pehle se follow hai
          toast.info("Aap pehle hi follow kar rahe hain");
        } else {
          throw error;
        }
      } else {
        // Database mein count +1 karo
        await supabase.rpc('increment_followers', { user_id: video.user_id });
        
        // Notification bhejo
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
    <div className="relative w-full h-full bg-black">
      
      {/* --- FAST LOADING HACK: Background Thumbnail --- */}
      {/* Ye video ke piche rahega, taaki black screen kabhi na dikhe */}
      <img 
        src={video.thumbnail} 
        alt="background" 
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        style={{ zIndex: 0 }} 
      />

      {youtubeId ? (
        // --- YOUTUBE FAST PLAYER (Iframe) ---
        <div className="absolute inset-0 z-0 pointer-events-none">
          <iframe
            className="w-full h-full object-cover"
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&loop=1&playlist=${youtubeId}&playsinline=1&disablekb=1&fs=0`}
            title={video.caption}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          {/* Transparent overlay to capture clicks for Mute if needed, 
              filhal actions buttons handle karenge */}
        </div>
      ) : (
        // --- NORMAL VIDEO PLAYER (Fallback) ---
        <video
          ref={videoRef}
          src={video.url}
          poster={video.thumbnail}
          loop
          muted={isMuted}
          playsInline
          className="relative z-0 w-full h-full object-cover"
          onClick={toggleMute}
        />
      )}

      {/* --- Mute Button (Works for both) --- */}
      <button
        onClick={toggleMute}
        className="absolute top-20 right-3 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center z-20 pointer-events-auto"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {/* --- Video Info Overlay --- */}
      <div className="absolute bottom-20 left-3 right-20 z-20 pointer-events-none">
        <div className="space-y-2 pointer-events-auto">
          <h3 className="text-white font-semibold text-lg drop-shadow-md">@{video.username}</h3>
          <p className="text-white text-sm line-clamp-2 drop-shadow-md">{video.caption}</p>
          <div className="flex flex-wrap gap-2">
            {video.hashtags.map((tag) => (
              <span key={tag} className="text-white text-sm font-semibold drop-shadow-md">#{tag}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white text-sm drop-shadow-md">
            <span className="truncate">🎵 {video.musicTitle}</span>
          </div>
        </div>
      </div>

      <div className="relative z-20">
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
