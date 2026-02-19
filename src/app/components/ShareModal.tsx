import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Send, X, Loader2, Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ videoUrl, isOpen, onClose }: ShareModalProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) fetchFriends();
  }, [isOpen]);

  const fetchFriends = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id)
      .limit(10);
    
    if (!error) setFriends(data || []);
    setLoading(false);
  };

  const handleInternalShare = async (friendId: string) => {
    setSendingId(friendId);
    try {
      const { data: roomId, error: roomError } = await supabase.rpc('get_or_create_chat_room', { 
        user1: user?.id, 
        user2: friendId 
      });

      if (roomError) throw roomError;

      const { error: msgError } = await supabase.from('chat_messages').insert([{
        room_id: roomId,
        sender_id: user?.id,
        content: "Shared a video 🎥",
        media_url: videoUrl
      }]);

      if (msgError) throw msgError;
      toast.success("Sent to friend!");
      setTimeout(onClose, 500);
    } catch (err) {
      toast.error("Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  // ✅ External Share Function (Naya Add Kiya)
  const handleExternalShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this video',
          url: videoUrl,
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      navigator.clipboard.writeText(videoUrl);
      toast.success("Link copied to clipboard!");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-end justify-center p-0">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="relative bg-white w-full rounded-t-[32px] p-6 animate-in slide-in-from-bottom duration-300 max-w-lg shadow-2xl">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-black">Send to</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-black">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar min-h-[100px]">
          {loading ? (
            <div className="w-full flex justify-center items-center">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : friends.length > 0 ? (
            friends.map(friend => (
              <div key={friend.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                <div className="relative">
                  <img 
                    src={friend.avatar_url || `https://ui-avatars.com/api/?name=${friend.username}`} 
                    // ✅ Broken photo fix
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${friend.username}`; }}
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 p-0.5 shadow-md" 
                  />
                  <button 
                    onClick={() => handleInternalShare(friend.id)}
                    disabled={!!sendingId}
                    className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-2 border-2 border-white shadow-lg active:scale-90 transition-transform"
                  >
                    {sendingId === friend.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
                <span className="text-[11px] text-gray-800 font-bold truncate w-20 text-center">
                  {friend.username}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm text-center w-full">No friends found</p>
          )}
        </div>

        {/* ✅ Bottom Options Section (Updated) */}
        <div className="pt-6 border-t border-gray-100 flex justify-center gap-12">
          {/* Copy Link Button */}
          <button 
            onClick={() => { 
              navigator.clipboard.writeText(videoUrl); 
              toast.success("Link Copied!"); 
            }} 
            className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-black shadow-inner">
              <Copy size={20} />
            </div>
            <span className="text-[11px] text-gray-500 font-medium">Copy Link</span>
          </button>

          {/* Naya Share Other Button */}
          <button 
            onClick={handleExternalShare} 
            className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shadow-inner border border-blue-100">
              <Share2 size={20} />
            </div>
            <span className="text-[11px] text-gray-500 font-medium">Share Other</span>
          </button>
        </div>
      </div>
    </div>
  );
}
