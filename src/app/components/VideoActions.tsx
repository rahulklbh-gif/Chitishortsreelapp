"use client";

import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react'; 
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// ✅ Modal Import (Barkaraar hai)
import { ShareModal } from '@/app/components/ShareModal';

// ✅ WatchPartyManager Import (Default Import to avoid Vercel build error)
import WatchPartyManager from '@/app/components/WatchPartyManager';

export function VideoActions({ 
  videoId, 
  initialLikes, 
  initialComments, 
  initialShares, 
  videoOwnerId, 
  onComment, 
  onShare,
  videoUrl: rawVideoUrl // ✅ Parent se URL lene ke liye
}: any) {
  
  // ✅ SMART LINK FIX: Link ko fast CDN mein badalne ke liye
  const videoUrl = rawVideoUrl?.replace(
    /pub-[a-zA-Z0-9]+\.r2\.dev/g, 
    'cdn.chitishort.store'
  );

  const { user } = useAuth(); 
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes || 0);
  
  // States for dynamic counts
  const [commentCount, setCommentCount] = useState(initialComments || 0);
  const [shareCount, setShareCount] = useState(initialShares || 0);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [hearts, setHearts] = useState<any[]>([]);

  // ✅ Modal State (Barkaraar hai)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Like check logic (Aapka original logic)
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

  // Syncing initial props with local state
  useEffect(() => {
    checkIfLiked();
    setLikeCount(initialLikes ?? 0);
    setCommentCount(initialComments ?? 0);
    setShareCount(initialShares ?? 0);
  }, [videoId, initialLikes, initialComments, initialShares, checkIfLiked]);

  // --- 1. HANDLE LIKE (Aapka Original Function - No Change) ---
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

  // --- 2. HANDLE COMMENT (Aapka Original logic) ---
  const handleCommentClick = async () => {
    onComment(videoId, videoOwnerId);
  };

  // --- 3. HANDLE SHARE (Aapka Original logic) ---
  const handleShareInternal = async () => {
    try {
      setIsShareModalOpen(true);
      setShareCount(prev => prev + 1);
    } catch (err) {
      console.error("Share DB error:", err);
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

      {/* ✅ Watch Party Button Added */}
      <WatchPartyManager 
        videoId={videoId} 
        videoUrl={videoUrl || ""} 
      />

      {/* ✅ Share Modal (videoUrl replace hokar yahan jayega) */}
      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        videoUrl={videoUrl || ""} 
        videoId={videoId}
      />

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
