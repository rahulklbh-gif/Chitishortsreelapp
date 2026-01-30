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

  // Database se check karna ki user ne pehle like kiya hai ya nahi
  useEffect(() => {
    if (user && videoId) {
      checkIfLiked();
    }
    setLikeCount(initialLikes || 0);
  }, [videoId, initialLikes, user]);

  const checkIfLiked = async () => {
    const { data, error } = await supabase
      .from('likes') // Make sure aapke paas 'likes' table ho (optional but better)
      .select('*')
      .eq('post_id', videoId)
      .eq('user_id', user?.id)
      .single();
    
    if (data) setIsLiked(true);
  };

  const handleLike = async () => {
    if (!user) {
      toast.error("Pehle login karein!");
      return;
    }
    if (isUpdating) return;
    setIsUpdating(true);

    const newIsLiked = !isLiked;
    const newCount = isLiked ? Math.max(0, likeCount - 1) : likeCount + 1;
    
    // UI Update (Fast feel ke liye)
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
      // 1. Post Table ka count update karein
      await supabase.from('posts').update({ likes_count: newCount }).eq('id', videoId);

      if (newIsLiked) {
        // 2. Notification bhejna
        if (videoOwnerId && user.id !== videoOwnerId) {
          await supabase.from('notifications').insert([
            {
              type: 'like',
              sender_id: user.id,
              receiver_id: videoOwnerId,
              post_id: videoId,
              content: 'liked your video' // Ye Inbox mein dikhega
            }
          ]);
        }
      }
    } catch (err) {
      console.error("Like error:", err);
      // Rollback UI if error
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

      {/* Comment Button */}
      <button 
        onClick={() => videoId ? onComment(videoId, videoOwnerId) : toast.error("ID missing")} 
        className="flex flex-col items-center group outline-none"
      >
        <div className="p-3 active:scale-90 transition-transform text-white">
          <MessageCircle className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <span className="text-white text-xs font-black italic">Reply</span>
      </button>

      {/* Share Button */}
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
