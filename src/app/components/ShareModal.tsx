import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Loader2, Share2, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

// ✅ UserAvatar logic (No changes here)
function UserAvatar({ userId, username }: { userId: string, username: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function getPhoto() {
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    }
    getPhoto();
  }, [userId]);

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <div className="absolute inset-0 w-14 h-14 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 font-bold text-lg">
        {username ? username[0].toUpperCase() : 'U'}
      </div>
      {avatarUrl && (
        <img 
          src={avatarUrl} 
          className="absolute inset-0 w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm"
          crossOrigin="anonymous"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
    </div>
  );
}

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
      // ✅ CreatePage jaisa extra precaution: Body scroll lock
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchFriends = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .neq('id', currentUser.id)
        .limit(15);
      if (!error) setFriends(data || []);
    } catch (err) {
      console.error(err);
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
      toast.success("Sent to friend!");
    } catch (err) {
      toast.error("Failed");
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    /* ✅ LOGIC: CreatePage ki tarah 'fixed inset-0' use kiya hai.
       z-[99999] itna zyada hai ki ye aapke navigation bar ko peeche dhakel dega.
    */
    <div className="fixed inset-0 z-[99999] bg-black/70 flex items-end justify-center animate-in fade-in duration-200">
      
      {/* Background overlay pe click karne se modal band hoga */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="relative bg-white w-full rounded-t-[40px] p-6 pb-10 animate-in slide-in-from-bottom duration-300 max-w-lg shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
        
        {/* Handle bar */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
        
        <div className="flex justify-between items-center mb-8 px-2">
          <h3 className="text-2xl font-black italic uppercase tracking-tighter text-black">Send to</h3>
          <button onClick={onClose} className="p-2.5 bg-gray-100 rounded-full text-black hover:bg-gray-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Friends List */}
        <div className="flex gap-5 overflow-x-auto pb-8 no-scrollbar px-2">
          {loading ? (
            <div className="w-full flex justify-center py-6">
              <Loader2 className="animate-spin text-blue-600" size={30} />
            </div>
          ) : friends.map(friend => (
            <div key={friend.id} className="flex flex-col items-center gap-3 min-w-[85px]">
              <div className="relative group">
                 <UserAvatar userId={friend.id} username={friend.username} />
                 <button 
                  onClick={() => handleInternalShare(friend.id)}
                  disabled={!!sendingId}
                  className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-2.5 border-[3px] border-white shadow-xl active:scale-90 transition-transform"
                >
                  {sendingId === friend.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
              <span className="text-[11px] text-gray-800 font-extrabold truncate w-20 text-center uppercase tracking-tighter">
                @{friend.username}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="pt-8 border-t border-gray-100 flex justify-around items-center">
          <button 
            onClick={() => { navigator.clipboard.writeText(videoUrl); toast.success("Copied!"); }} 
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-14 h-14 bg-gray-50 rounded-[22px] flex items-center justify-center text-black group-active:bg-gray-200 transition-all border border-gray-100">
              <Copy size={24} />
            </div>
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Link</span>
          </button>

          <button 
            onClick={() => navigator.share?.({ url: videoUrl })} 
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-14 h-14 bg-blue-50 rounded-[22px] flex items-center justify-center text-blue-600 group-active:bg-blue-100 transition-all border border-blue-100/50">
              <Share2 size={24} />
            </div>
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Other</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
} 
