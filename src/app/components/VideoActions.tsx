import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext'; // Aapke folder structure ke hisaab se sahi path

export function VideoActions({ videoId, initialLikes, videoOwnerId, onComment, onShare }: any) {
  const { user } = useAuth(); 
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes || 0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hearts, setHearts] = useState<any[]>([]);

  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    setIsLiked(likedVideos.includes(videoId));
    setLikeCount(initialLikes || 0);
  }, [videoId, initialLikes]);

  const handleLike = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    const newIsLiked = !isLiked;
    const newCount = isLiked ? Math.max(0, likeCount - 1) : likeCount + 1;
    
    setIsLiked(newIsLiked);
    setLikeCount(newCount);

    if (newIsLiked) {
      const newHearts = Array.from({ length: 5 }).map((_, i) => ({
        id: Date.now() + i,
        left: Math.random() * 50 - 25
      }));
      setHearts(newHearts);
      setTimeout(() => setHearts([]), 1000);
    }

    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    if (newIsLiked) {
      if (!likedVideos.includes(videoId)) likedVideos.push(videoId);
    } else {
      const index = likedVideos.indexOf(videoId);
      if (index > -1) likedVideos.splice(index, 1);
    }
    localStorage.setItem('likedVideos', JSON.stringify(likedVideos));

    try {
      // 1. Database mein Like update
      await supabase.from('posts').update({ likes_count: newCount }).eq('id', videoId);

      // 2. Notification bhejna (Agar user logged in hai aur apna hi video like nahi kar raha)
      if (newIsLiked && user && videoOwnerId && user.id !== videoOwnerId) {
        await supabase.from('notifications').insert([
          {
            type: 'like',
            sender_id: user.id,
            receiver_id: videoOwnerId,
            post_id: videoId
          }
        ]);
      }
    } catch (err) {
      console.error("Like error:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 relative">
      {/* Hearts Animation */}
      {hearts.map(heart => (
        <div key={heart.id} className="absolute bottom-10 text-red-500 text-2xl animate-bounce-up pointer-events-none" style={{ left: `${heart.left}px` }}>❤️</div>
      ))}

      {/* Like Button */}
      <button onClick={handleLike} className="flex flex-col items-center group outline-none">
        <div className={`p-3 rounded-full transition-all duration-300 ${isLiked ? 'scale-125' : 'scale-100'}`}>
          <Heart className={`w-9 h-9 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} strokeWidth={2.5} />
        </div>
        <span className="text-white text-xs font-black">{likeCount}</span>
      </button>

      {/* Comment Button */}
      <button onClick={() => videoId ? onComment(videoId) : toast.error("ID missing")} className="flex flex-col items-center group outline-none">
        <div className="p-3 active:scale-90 transition-transform text-white">
          <MessageCircle className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <span className="text-white text-xs font-black">Reply</span>
      </button>

      {/* Share Button */}
      <button 
        onClick={() => {
          if (onShare) onShare();
          else {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Link Copied!");
          }
        }} 
        className="flex flex-col items-center group outline-none"
      >
        <div className="p-3 active:scale-90 transition-transform text-white">
          <Share2 className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <span className="text-white text-xs font-black">Share</span>
      </button>

      <style>{`
        @keyframes bounce-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-180px) scale(2); opacity: 0; }
        }
        .animate-bounce-up { animation: bounce-up 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
}
