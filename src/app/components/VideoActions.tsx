"use client";

import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react'; 
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function VideoActions({ 
  videoId, 
  initialLikes, 
  initialComments, 
  initialShares, 
  videoOwnerId, 
  onComment, 
  onShare 
}: any) {
  const { user } = useAuth(); 
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes || 0);
  
  // States for dynamic counts
  const [commentCount, setCommentCount] = useState(initialComments || 0);
  const [shareCount, setShareCount] = useState(initialShares || 0);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [hearts, setHearts] = useState<any[]>([]);

  // Like check logic (Unchanged as per your request)
  const checkIfLiked = useCallback(async () => {
    if (!user || !videoId) return;
    try {
      const { data } = await supabase
        .from('likes')
        .select('id') 
        .eq('post_id', videoId)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsLiked(!!data);
    } catch (err) { console.error("Check like error:", err); }
  }, [user?.id, videoId]);

  // 🔥 FIX: Syncing initial props with local state properly
  useEffect(() => {
    checkIfLiked();
    // Jab database se fresh data aaye, toh state update karo
    setLikeCount(initialLikes ?? 0);
    setCommentCount(initialComments ?? 0);
    setShareCount(initialShares ?? 0);
  }, [videoId, initialLikes, initialComments, initialShares, checkIfLiked]);

  // --- 1. HANDLE LIKE (Aapka Original Function) ---
  const handleLike = async () => {
    if (!user) { toast.error("Pehle login karein!"); return; }
    if (isUpdating) return;
    setIsUpdating(true);

    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    
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
        await Promise.all([
           supabase.from('likes').insert([{ user_id: user.id, post_id: videoId }]),
           supabase.rpc('increment_likes', { post_id: videoId })
        ]);

        if (videoOwnerId && user.id !== videoOwnerId) {
          await supabase.from('notifications').insert([{
            type: 'like',
            sender_id: user.id,
            sender_name: user.user_metadata?.username || user.email?.split('@')[0] || "Someone",
            receiver_id: videoOwnerId,
            post_id: videoId,
            content: 'liked your video',
            is_read: false
          }]);
        }
      } else {
        await Promise.all([
          supabase.from('likes').delete().eq('post_id', videoId).eq('user_id', user.id),
          supabase.rpc('decrement_likes', { post_id: videoId }) 
        ]);
      }
    } catch (err) {
      console.error("Like error:", err);
      setIsLiked(!newIsLiked);
      setLikeCount(likeCount);
    } finally {
      setIsUpdating(false);
    }
  };

  // --- 2. HANDLE COMMENT (Enhanced with DB Increment) ---
  const handleCommentClick = async () => {
    // Comment modal kholne ka logic jo parent se aa raha hai
    onComment(videoId, videoOwnerId);
    
    // Note: Comment count tab badhna chahiye jab user actual comment post kare.
    // Agar aap modal khulte hi count badhana chahte hain (Sirf test ke liye), 
    // toh niche wala RPC logic yahan bhi use kar sakte hain.
  };

  // --- 3. HANDLE SHARE (Enhanced with DB Increment) ---
  const handleShareInternal = async () => {
    try {
      // Optimistically update UI
      setShareCount(prev => prev + 1);

      // Call the parent sharing function (Navigator or Clipboard)
      if (onShare) {
        await onShare();
      }

      // Note: Backend increment RealVideoFeed ke handleVideoShare mein pehle se ho raha hai.
      // Isliye yahan dubara RPC call karne ki zarurat nahi hai warna count double badhega.

    } catch (err) {
      console.error("Share DB error:", err);
      // Rollback if fail
      setShareCount(prev => Math.max(0, prev - 1));
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 relative">
      {/* Hearts Animation */}
      {hearts.map(heart => (
        <div key={heart.id} className="absolute bottom-10 text-red-500 text-2xl animate-bounce-up pointer-events-none" style={{ left: `${heart.left}px` }}>❤️</div>
      ))}

      {/* Like Button */}
      <button onClick={handleLike} className="flex flex-col items-center group outline-none focus:outline-none bg-transparent border-none">
        <div className={`p-2 rounded-full transition-transform active:scale-150 duration-200 ${isLiked ? 'scale-110' : 'scale-100'}`}>
          <Heart className={`w-9 h-9 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} strokeWidth={2.5} />
        </div>
        <span className="text-white text-[12px] font-black drop-shadow-md">{likeCount}</span>
      </button>

      {/* Reply (Comment) Button */}
      <button 
        onClick={handleCommentClick} 
        className="flex flex-col items-center group outline-none bg-transparent border-none"
      >
        <div className="p-2 active:scale-125 transition-transform text-white">
          <MessageCircle className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <span className="text-white text-[12px] font-black drop-shadow-md">
          {commentCount}
        </span>
      </button>

      {/* Share Button */}
      <button 
        onClick={handleShareInternal} 
        className="flex flex-col items-center group outline-none bg-transparent border-none"
      >
        <div className="p-2 active:scale-125 transition-transform text-white">
          <Share2 className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <span className="text-white text-[12px] font-black drop-shadow-md">
          {shareCount}
        </span>
      </button>

      <style>{`
        @keyframes bounce-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-150px) scale(2.5); opacity: 0; }
        }
        .animate-bounce-up { animation: bounce-up 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
} 
