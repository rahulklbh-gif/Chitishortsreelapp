import { Heart, MessageCircle, Share2, Music, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';

interface VideoActionsProps {
  videoId: string;
  likes: number;
  comments: number;
  username: string;
  avatar: string;
  musicTitle: string;
  isFollowing: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onFollow: () => void;
}

export function VideoActions({
  videoId,
  likes,
  comments,
  username,
  avatar,
  musicTitle,
  isFollowing,
  onLike,
  onComment,
  onShare,
  onFollow,
}: VideoActionsProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);

  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    setIsLiked(likedVideos.includes(videoId));
  }, [videoId]);

  const handleLike = () => {
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    
    if (isLiked) {
      const updated = likedVideos.filter((id: string) => id !== videoId);
      localStorage.setItem('likedVideos', JSON.stringify(updated));
      setLikeCount(likeCount - 1);
      setIsLiked(false);
    } else {
      likedVideos.push(videoId);
      localStorage.setItem('likedVideos', JSON.stringify(likedVideos));
      setLikeCount(likeCount + 1);
      setIsLiked(true);
    }
    onLike();
  };

  return (
    <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
      {/* User Avatar with Follow Button */}
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden">
          <img src={avatar} alt={username} className="w-full h-full object-cover" />
        </div>
        {!isFollowing && (
          <button
            onClick={onFollow}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-black"
          >
            <span className="text-white text-xl leading-none">+</span>
          </button>
        )}
      </div>

      {/* Like Button */}
      <button onClick={handleLike} className="flex flex-col items-center gap-1">
        <Heart
          className={`w-8 h-8 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
          strokeWidth={1.5}
        />
        <span className="text-white text-xs font-semibold">
          {likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}K` : likeCount}
        </span>
      </button>

      {/* Comment Button */}
      <button onClick={onComment} className="flex flex-col items-center gap-1">
        <MessageCircle className="w-8 h-8 text-white" strokeWidth={1.5} />
        <span className="text-white text-xs font-semibold">
          {comments >= 1000 ? `${(comments / 1000).toFixed(1)}K` : comments}
        </span>
      </button>

      {/* Share Button */}
      <button onClick={onShare} className="flex flex-col items-center gap-1">
        <Share2 className="w-8 h-8 text-white" strokeWidth={1.5} />
        <span className="text-white text-xs font-semibold">Share</span>
      </button>

      {/* More Options */}
      <button className="flex flex-col items-center gap-1">
        <MoreHorizontal className="w-8 h-8 text-white" strokeWidth={1.5} />
      </button>

      {/* Spinning Music Icon */}
      <div className="relative mt-2">
        <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center border border-white animate-spin-slow">
          <Music className="w-5 h-5 text-white" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
