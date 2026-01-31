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

  // 1. Views Badhane ka logic (Bilkul Safe)
  useEffect(() => {
    if (isActive && video.id) {
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

      <VideoActions
        videoId={video.id}
        initialLikes={video.likes}
        videoOwnerId={video.user_id} 
        onComment={onComment}
        onShare={handleShare}
        onFollow={handleFollow} // Naya follow logic pass kiya
      />
    </div>
  );
}
