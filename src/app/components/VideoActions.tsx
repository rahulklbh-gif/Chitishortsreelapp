import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function VideoActions({ videoId, initialLikes, onComment }: any) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes || 0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hearts, setHearts] = useState<any[]>([]); // Multiple hearts for surprise

  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    setIsLiked(likedVideos.includes(videoId));
    setLikeCount(initialLikes);
  }, [videoId, initialLikes]);

  const handleLike = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    const newIsLiked = !isLiked;
    const newCount = isLiked ? Math.max(0, likeCount - 1) : likeCount + 1;
    
    setIsLiked(newIsLiked);
    setLikeCount(newCount);

    // Surprise Animation: Creating multiple heart icons
    if (newIsLiked) {
      const newHearts = Array.from({ length: 5 }).map((_, i) => ({
        id: Date.now() + i,
        left: Math.random() * 50 - 25 // Random position
      }));
      setHearts(newHearts);
      setTimeout(() => setHearts([]), 1000);
    }

    // Local Storage update
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    if (newIsLiked) {
      likedVideos.push(videoId);
    } else {
      const filtered = likedVideos.filter((id: string) => id !== videoId);
      localStorage.setItem('likedVideos', JSON.stringify(filtered));
    }
    localStorage.setItem('likedVideos', JSON.stringify(likedVideos));

    try {
      // Direct Supabase Update
      const { error } = await supabase
        .from('posts')
        .update({ likes_count: newCount })
        .eq('id', videoId);
      
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast.error("Network issue");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 relative">
      
      {/* Floating Hearts Surprise */}
      {hearts.map(heart => (
        <div 
          key={heart.id}
          className="absolute bottom-10 text-red-500 text-2xl animate-bounce-up"
          style={{ left: `${heart.left}px` }}
        >
          ❤️
        </div>
      ))}

      {/* Like */}
      <button onClick={handleLike} className="flex flex-col items-center">
        <div className={`p-3 rounded-full transition-all ${isLiked ? 'scale-125' : 'scale-100'}`}>
          <Heart className={`w-9 h-9 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} strokeWidth={2} />
        </div>
        <span className="text-white text-xs font-bold">{likeCount}</span>
      </button>

      {/* Comment - Added a safety check */}
      <button 
        onClick={() => {
          if (videoId) {
            onComment(videoId);
          } else {
            toast.error("Video ID missing");
          }
        }} 
        className="flex flex-col items-center"
      >
        <div className="p-3">
          <MessageCircle className="w-9 h-9 text-white" strokeWidth={2} />
        </div>
        <span className="text-white text-xs font-bold">Reply</span>
      </button>

      {/* Share */}
      <button onClick={() => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link Copied!");
      }} className="flex flex-col items-center">
        <div className="p-3">
          <Share2 className="w-9 h-9 text-white" strokeWidth={2} />
        </div>
        <span className="text-white text-xs font-bold">Share</span>
      </button>

      <style>{`
        @keyframes bounce-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-150px) scale(1.5); opacity: 0; }
        }
        .animate-bounce-up {
          animation: bounce-up 0.8s ease-out forwards;
          position: absolute;
        }
      `}</style>
    </div>
  );
}
