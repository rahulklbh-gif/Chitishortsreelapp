import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function VideoActions({ videoId, initialLikes, videoOwnerId, onComment, onShare }: any) {
  const { user } = useAuth(); 
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes || 0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hearts, setHearts] = useState<any[]>([]);

  useEffect(() => {
    if (user && videoId) {
      checkIfLiked();
    }
    setLikeCount(initialLikes || 0);
  }, [videoId, initialLikes, user]);

  const checkIfLiked = async () => {
    try {
      const { data } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', videoId)
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (data) setIsLiked(true);
      else setIsLiked(false);
    } catch (err) {
      console.error("Check like error:", err);
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error("Pehle login karein!");
      return;
    }
    if (isUpdating) return;
    setIsUpdating(true);

    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    
    // UI fast update
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

    try {
      if (newIsLiked) {
        // 1. Likes table mein permanent record
        await supabase.from('likes').insert([{ user_id: user.id, post_id: videoId }]);
        
        // 2. PROBLEM 3 FIX: Notification with SENDER NAME
        if (videoOwnerId && user.id !== videoOwnerId) {
          await supabase.from('notifications').insert([
            {
              type: 'like',
              sender_id: user.id,
              sender_name: user.user_metadata.username || user.email?.split('@')[0] || "Someone",
              receiver_id: videoOwnerId,
              post_id: videoId,
              content: 'liked your video',
              is_read: false // Problem 4 ke liye taiyari
            }
          ]);
        }
      } else {
        // Unlike: entry delete karo
        await supabase.from('likes').delete().eq('post_id', videoId).eq('user_id', user.id);
      }

      // 3. Posts Table ka count sync karo
      await supabase.from('posts').update({ likes_count: newCount }).eq('id', videoId);

    } catch (err) {
      console.error("Like error:", err);
      // Galti par purana state wapas
      setIsLiked(!newIsLiked);
      setLikeCount(likeCount);
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

      {/* Reply/Comment Button (Unchanged) */}
      <button 
        onClick={() => videoId ? onComment(videoId, videoOwnerId) : toast.error("ID missing")} 
        className="flex flex-col items-center group outline-none"
      >
        <div className="p-3 active:scale-90 transition-transform text-white">
          <MessageCircle className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <span className="text-white text-xs font-black italic">Reply</span>
      </button>

      {/* Share Button (Unchanged) */}
      <button 
        onClick={() => onShare ? onShare() : toast.error("Share function missing")} 
        className="flex flex-col items-center group outline-none"
      >
        <div className="p-3 active:scale-90 transition-transform text-white">
          <Share2 className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <span className="text-white text-xs font-black italic">Share</span>
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
