import { useRef, useEffect, useState } from 'react';
import { VideoActions } from './VideoActions';
import { Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // Naya Import
import { useAuth } from '@/contexts/AuthContext'; // User check ke liye

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
  user_id?: string; // Database ID ke liye
}

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
  onComment: () => void;
}

export function VideoPlayer({ video, isActive, onComment }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user: currentUser } = useAuth(); // Current user lo
  const [isMuted, setIsMuted] = useState(true);

  // 1. Views Badhane ka logic
  useEffect(() => {
    if (isActive && video.id) {
      // Jab video play ho, RPC function call karo
      supabase.rpc('increment_views', { post_id: video.id });
    }
  }, [isActive, video.id]);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

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
    }
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={video.url}
        poster={video.thumbnail}
        loop
        muted={isMuted}
        playsInline
        className="w-full h-full object-cover"
        onClick={toggleMute}
      />

      <button
        onClick={toggleMute}
        className="absolute top-20 right-3 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center z-10"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      <div className="absolute bottom-20 left-3 right-20 z-10">
        <div className="space-y-2">
          <h3 className="text-white font-semibold text-lg">@{video.username}</h3>
          <p className="text-white text-sm line-clamp-2">{video.caption}</p>
          <div className="flex flex-wrap gap-2">
            {video.hashtags.map((tag) => (
              <span key={tag} className="text-white text-sm font-semibold">#{tag}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white text-sm">
            <span className="truncate">🎵 {video.musicTitle}</span>
          </div>
        </div>
      </div>

      {/* 2. VideoActions ko Database se connect kiya */}
      <VideoActions
        videoId={video.id}
        initialLikes={video.likes}
        videoOwnerId={video.user_id} // owner id pass karein
        onComment={onComment}
        onShare={handleShare}
      />
    </div>
  );
}
