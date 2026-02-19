import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Send, X, Loader2, Share2, Copy, User } from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ videoUrl, isOpen, onClose }: ShareModalProps) {
  const { user: currentUser } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
      
      // ✅ Powerful Navigation Hider: 
      // Ye un saare elements ko hide karega jo bottom mein fixed hain (Nav bar)
      const bottomNav = document.querySelector('nav, footer, [class*="bottom-nav"], [class*="TabBar"]');
      if (bottomNav) {
        (bottomNav as HTMLElement).style.display = 'none';
      }
    }

    // ✅ Clean-up: Modal band hote hi wapas dikhao
    return () => {
      const bottomNav = document.querySelector('nav, footer, [class*="bottom-nav"], [class*="TabBar"]');
      if (bottomNav) {
        (bottomNav as HTMLElement).style.display = 'flex';
      }
    };
  }, [isOpen]);

  const fetchFriends = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .neq('id', currentUser.id)
        .limit(15);
      
      if (!error) setFriends(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInternalShare = async (friendId: string) => {
    setSendingId(friendId);
    try {
      const { data: roomId } = await supabase.rpc('get_or_create_chat_room', { 
        user1: currentUser?.id, 
        user2: friendId 
      });

      await supabase.from('chat_messages').insert([{
        room_id: roomId,
        sender_id: currentUser?.id,
        content: "Shared a video 🎥",
        media_url: videoUrl
      }]);

      toast.success("Sent!");
    } catch (err) {
      toast.error("Failed");
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/60 flex items-end justify-center p-0">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      {/* ✅ Theme wapas White kar diya hai */}
      <div className="relative bg-white w-full rounded-t-[32px] p-6 animate-in slide-in-from-bottom duration-300 max-w-lg shadow-2xl">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-black tracking-tight">Send to</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-black">
            <X size={20} />
          </button>
        </div>

        {/* Friends List */}
        <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar min-h-[120px]">
          {loading ? (
            <div className="w-full flex justify-center py-4">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : friends.map(friend => (
            <div key={friend.id} className="flex flex-col items-center gap-2 min-w-[85px]">
              <div className="relative w-16 h-16 rounded-full border-2 border-gray-100 overflow-hidden bg-gray-50 shadow-sm">
                {friend.avatar_url ? (
                  <img 
                    src={friend.avatar_url} 
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                    onError={(e) => { e.currentTarget.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <User size={24} />
                  </div>
                )}
              </div>

              <span className="text-[10px] text-gray-700 font-bold truncate w-20 text-center">
                @{friend.username || 'user'}
              </span>
              
              <button 
                onClick={() => handleInternalShare(friend.id)}
                disabled={!!sendingId}
                className="mt-1 bg-blue-600 hover:bg-blue-700 active:scale-90 transition-all px-4 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-md disabled:bg-gray-300"
              >
                {sendingId === friend.id ? '...' : 'Send'}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Options - White Theme style */}
        <div className="pt-6 border-t border-gray-100 flex justify-center gap-16">
          <button 
            onClick={() => { navigator.clipboard.writeText(videoUrl); toast.success("Link Copied!"); }} 
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-black shadow-inner active:bg-gray-200">
              <Copy size={20} />
            </div>
            <span className="text-[10px] text-gray-500 font-bold uppercase">Copy Link</span>
          </button>

          <button 
            onClick={() => navigator.share?.({ url: videoUrl })} 
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shadow-inner active:bg-blue-100 border border-blue-100">
              <Share2 size={20} />
            </div>
            <span className="text-[10px] text-gray-500 font-bold uppercase">Other</span>
          </button>
        </div>
      </div>
    </div>
  );
}
