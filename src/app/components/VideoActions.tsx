import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Naya path
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
  const [showHearts, setShowHearts] = useState(false); // Surprise animation state

  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    setIsLiked(likedVideos.includes(videoId));
    setLikeCount(initialLikes);
  }, [videoId, initialLikes]);

  const handleLike = async () => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    
    // UI Update (Optimistic)
    const newIsLiked = !isLiked;
    const newCount = isLiked ? Math.max(0, likeCount - 1) : likeCount + 1;
    
    setIsLiked(newIsLiked);
    setLikeCount(newCount);

    if (newIsLiked) {
      setShowHearts(true); // Like karne par surprise chalu
      setTimeout(() => setShowHearts(false), 2000);
      likedVideos.push(videoId);
    } else {
      const idx = likedVideos.indexOf(videoId);
      if (idx > -1) likedVideos.splice(idx, 1);
    }
    localStorage.setItem('likedVideos', JSON.stringify(likedVideos));

    try {
      // Naya Logic: Seedha Supabase Table update
      const { data, error } = await supabase.rpc(
        newIsLiked ? 'increment_likes' : 'decrement_likes', 
        { row_id: videoId }
      );

      // Agar RPC setup nahi hai, toh simple update use karenge
      if (error) {
        const { error: upError } = await supabase
          .from('posts')
          .update({ likes_count: newCount })
          .eq('id', videoId);
        if (upError) throw upError;
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Could not save like');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Chiti Shorts',
          text: 'Check out this video!',
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied!');
      }
    } catch (error) { console.log(error); }
  };

  const formatCount = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Surprise Hearts Animation */}
      {showHearts && (
        <div className="absolute right-0 bottom-10 pointer-events-none">
          <div className="animate-float-up text-red-500 text-2xl">❤️</div>
          <div className="animate-float-up-slow text-red-400 text-xl ml-4">💖</div>
          <div className="animate-float-up-fast text-pink-500 text-3xl -ml-4">❤️</div>
        </div>
      )}

      {/* Like Button */}
      <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
        <div className={`p-2 rounded-full transition-all ${isLiked ? 'bg-red-500/10' : 'bg-white/5'}`}>
          <Heart
            className={`w-8 h-8 transition-all ${isLiked ? 'fill-red-500 text-red-500 scale-125' : 'text-white'}`}
            strokeWidth={2}
          />
        </div>
        <span className="text-white text-[11px] font-bold shadow-sm">{formatCount(likeCount)}</span>
      </button>

      {/* Comment Button */}
      <button onClick={onComment} className="flex flex-col items-center gap-1">
        <div className="p-2 rounded-full bg-white/5">
          <MessageCircle className="w-8 h-8 text-white" strokeWidth={2} />
        </div>
        <span className="text-white text-[11px] font-bold">{formatCount(initialComments)}</span>
      </button>

      {/* Share Button (Unchanged logic) */}
      <button onClick={handleShare} className="flex flex-col items-center gap-1">
        <div className="p-2 rounded-full bg-white/5">
          <Share2 className="w-8 h-8 text-white" strokeWidth={2} />
        </div>
        <span className="text-white text-[11px] font-bold">Share</span>
      </button>

      {/* Custom Styles for Animation */}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) opacity(1); }
          100% { transform: translateY(-100px) opacity(0); }
        }
        .animate-float-up { animation: float-up 1s ease-out forwards; }
        .animate-float-up-slow { animation: float-up 1.5s ease-out forwards; }
        .animate-float-up-fast { animation: float-up 0.7s ease-out forwards; }
      `}</style>
    </div>
  );
}
