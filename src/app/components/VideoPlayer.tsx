import { useRef, useEffect, useState } from 'react';
import { VideoActions } from './VideoActions';
import { Volume2, VolumeX } from 'lucide-react';

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
}

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
  onComment: () => void;
}

export function VideoPlayer({ video, isActive, onComment }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const followedUsers = JSON.parse(localStorage.getItem('followedUsers') || '[]');
    setIsFollowing(followedUsers.includes(video.username));
  }, [video.username]);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {
          // Autoplay failed, likely due to browser policy
        });
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  const handleFollow = () => {
    const followedUsers = JSON.parse(localStorage.getItem('followedUsers') || '[]');
    if (!isFollowing) {
      followedUsers.push(video.username);
      localStorage.setItem('followedUsers', JSON.stringify(followedUsers));
      setIsFollowing(true);
    }
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

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video */}
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

      {/* Mute/Unmute Button */}
      <button
        onClick={toggleMute}
        className="absolute top-20 right-3 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center z-10"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Video Info - Bottom Left */}
      <div className="absolute bottom-20 left-3 right-20 z-10">
        <div className="space-y-2">
          <h3 className="text-white font-semibold text-lg">@{video.username}</h3>
          <p className="text-white text-sm line-clamp-2">{video.caption}</p>
          <div className="flex flex-wrap gap-2">
            {video.hashtags.map((tag) => (
              <span key={tag} className="text-white text-sm font-semibold">
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white text-sm">
            <span className="truncate">🎵 {video.musicTitle}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons - Right Side */}
      <VideoActions
        videoId={video.id}
        likes={video.likes}
        comments={video.comments}
        username={video.username}
        avatar={video.avatar}
        musicTitle={video.musicTitle}
        isFollowing={isFollowing}
        onLike={() => {}}
        onComment={onComment}
        onShare={handleShare}
        onFollow={handleFollow}
      />
    </div>
  );
}
