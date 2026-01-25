import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

interface VideoActionsProps {
  videoId: string;
  initialLikes: number;
  initialComments: number;
  initialShares: number;
  onComment: () => void;
}

export function VideoActions({
  videoId,
  initialLikes,
  initialComments,
  initialShares,
  onComment,
}: VideoActionsProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    setIsLiked(likedVideos.includes(videoId));
  }, [videoId]);

  const handleLike = async () => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    const action = isLiked ? 'unlike' : 'like';
    
    // Optimistic update
    const newIsLiked = !isLiked;
    const newCount = isLiked ? likeCount - 1 : likeCount + 1;
    setIsLiked(newIsLiked);
    setLikeCount(newCount);

    // Update localStorage
    if (newIsLiked) {
      likedVideos.push(videoId);
    } else {
      const updated = likedVideos.filter((id: string) => id !== videoId);
      localStorage.setItem('likedVideos', JSON.stringify(updated));
    }
    localStorage.setItem('likedVideos', JSON.stringify(likedVideos));

    // Update backend
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-d82a0f74/videos/${videoId}/like`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ action })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const data = await response.json();
      setLikeCount(data.likes);
    } catch (error) {
      console.error('Error updating like:', error);
      // Revert on error
      setIsLiked(!newIsLiked);
      setLikeCount(likeCount);
      toast.error('Failed to update like. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this video on Chiti Shorts!',
          text: 'Amazing video I found on Chiti Shorts',
          url: window.location.href
        });
        toast.success('Shared successfully!');
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Silent fail for user cancellation
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
      {/* Like Button */}
      <button 
        onClick={handleLike} 
        disabled={isUpdating}
        className="flex flex-col items-center gap-1 active:scale-90 transition"
      >
        <div className={`transform transition-transform ${isLiked ? 'scale-110' : ''}`}>
          <Heart
            className={`w-9 h-9 drop-shadow-lg ${
              isLiked ? 'fill-red-500 text-red-500 animate-pulse' : 'text-white'
            }`}
            strokeWidth={1.5}
          />
        </div>
        <span className="text-white text-xs font-bold drop-shadow-lg">
          {formatCount(likeCount)}
        </span>
      </button>

      {/* Comment Button */}
      <button 
        onClick={onComment} 
        className="flex flex-col items-center gap-1 active:scale-90 transition"
      >
        <MessageCircle className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={1.5} />
        <span className="text-white text-xs font-bold drop-shadow-lg">
          {formatCount(initialComments)}
        </span>
      </button>

      {/* Share Button */}
      <button 
        onClick={handleShare} 
        className="flex flex-col items-center gap-1 active:scale-90 transition"
      >
        <Share2 className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={1.5} />
        <span className="text-white text-xs font-bold drop-shadow-lg">
          {formatCount(initialShares)}
        </span>
      </button>

      {/* More Options */}
      <button className="flex flex-col items-center gap-1 active:scale-90 transition">
        <MoreHorizontal className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={1.5} />
      </button>
    </div>
  );
}
