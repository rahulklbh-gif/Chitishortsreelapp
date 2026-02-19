import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Send, X, Loader2, Share2, Copy, User } from 'lucide-react'; // User icon add kiya
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
      // Navigation hide karne ka logic (Jo humne pehle discuss kiya tha)
      const navbar = document.querySelector('nav'); 
      if (navbar) navbar.style.display = 'none';
    }
    return () => {
      const navbar = document.querySelector('nav');
      if (navbar) navbar.style.display = 'flex';
    };
  }, [isOpen]);

  const fetchFriends = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // InboxPage jaisa logic: profiles fetch karna
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .neq('id', currentUser.id) // Khud ko chhod kar
        .limit(15);
      
      if (!error) setFriends(data || []);
    } catch (err) {
      console.error("Fetch friends error:", err);
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
    <div className="fixed inset-0 z-[999] bg-black/80 flex items-end justify-center p-0">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="relative bg-[#111] w-full rounded-t-[32px] p-6 animate-in slide-in-from-bottom duration-300 max-w-lg shadow-2xl border-t border-white/10">
        <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-6"></div>
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white tracking-tight">Send to</h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white">
            <X size={20} />
          </button>
        </div>

        {/* Friends Horizontal List */}
        <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar min-h-[110px]">
          {loading ? (
            <div className="w-full flex justify-center py-4">
              <Loader2 className="animate-spin text-blue-500" />
            </div>
          ) : friends.map(friend => (
            <div key={friend.id} className="flex flex-col items-center gap-2 min-w-[75px]">
              {/* Profile Photo - InboxPage Style Logic */}
              <div className="relative w-16 h-16 rounded-full border-2 border-blue-600/30 overflow-hidden bg-gray-900">
                {friend.avatar_url ? (
                  <img 
                    src={friend.avatar_url} 
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                    onError={(e) => { e.currentTarget.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <User size={24} />
                  </div>
                )}
                
                {/* Send Button Overlay */}
                <button 
                  onClick={() => handleInternalShare(friend.id)}
                  disabled={!!sendingId}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
                >
                  {sendingId === friend.id ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={18} className="text-white" />}
                </button>
              </div>

              <span className="text-[10px] text-gray-400 font-bold truncate w-16 text-center">
                @{friend.username || 'user'}
              </span>
              
              {/* Chhota Send Button (Taaki user ko pata chale kahan click karna hai) */}
              <button 
                onClick={() => handleInternalShare(friend.id)}
                className="mt-1 bg-blue-600 px-2 py-0.5 rounded text-[9px] font-black uppercase text-white"
              >
                {sendingId === friend.id ? '...' : 'Send'}
              </button>
            </div>
          ))}
        </div>

        {/* Options Section */}
        <div className="pt-6 border-t border-white/5 flex justify-center gap-16">
          <button onClick={() => { navigator.clipboard.writeText(videoUrl); toast.success("Copied!"); }} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-white"><Copy size={20} /></div>
            <span className="text-[10px] text-gray-500 font-bold uppercase">Link</span>
          </button>

          <button onClick={() => navigator.share?.({ url: videoUrl })} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-500"><Share2 size={20} /></div>
            <span className="text-[10px] text-gray-500 font-bold uppercase">Other</span>
          </button>
        </div>
      </div>
    </div>
  );
} 
