import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Loader2, Share2, Copy, Send, Search } from 'lucide-react';
import { toast } from 'sonner';

// UserAvatar Logic
function UserAvatar({ userId, username }: { userId: string, username: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    async function getPhoto() {
      if (!userId) return;
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
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
        <img src={avatarUrl} className="absolute inset-0 w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm" crossOrigin="anonymous" />
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
  const [searchQuery, setSearchQuery] = useState(''); // ✅ Search state

  useEffect(() => {
    const navSelectors = ['nav', '.bottom-nav', 'footer'];
    if (isOpen) {
      fetchFriends();
      navSelectors.forEach(s => {
        const el = document.querySelector(s);
        if (el) (el as HTMLElement).style.display = 'none'; // Force hide
      });
      document.body.style.overflow = 'hidden';
    }
    return () => {
      navSelectors.forEach(s => {
        const el = document.querySelector(s);
        if (el) (el as HTMLElement).style.display = 'flex';
      });
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchFriends = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('id, username').neq('id', currentUser.id);
      if (!error) setFriends(data || []);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  // ✅ Search Filter Logic
  const filteredFriends = useMemo(() => {
    return friends.filter(f => 
      f.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [friends, searchQuery]);

  const handleInternalShare = async (friendId: string) => {
    setSendingId(friendId);
    try {
      const { data: roomId } = await supabase.rpc('get_or_create_chat_room', { user1: currentUser?.id, user2: friendId });
      await supabase.from('chat_messages').insert([{ room_id: roomId, sender_id: currentUser?.id, content: "Shared a video 🎥", media_url: videoUrl }]);
      toast.success("Sent!");
    } catch (err) { toast.error("Failed"); } 
    finally { setSendingId(null); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 flex items-end justify-center">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="relative bg-white w-full rounded-t-[32px] p-6 pb-10 animate-in slide-in-from-bottom duration-300 max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 shrink-0"></div>
        
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className="text-xl font-black text-black uppercase italic">Send to</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-black"><X size={20} /></button>
        </div>

        {/* ✅ Search Bar Added */}
        <div className="relative mb-6 shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="w-full bg-gray-100 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-black outline-none border border-transparent focus:border-blue-500/30 transition-all"
          />
        </div>

        {/* Friends Horizontal List */}
        <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar px-1 min-h-[130px]">
          {loading ? (
            <div className="w-full flex justify-center py-4"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : filteredFriends.length > 0 ? (
            filteredFriends.map(friend => (
              <div key={friend.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                <div className="relative">
                   <UserAvatar userId={friend.id} username={friend.username} />
                   <button onClick={() => handleInternalShare(friend.id)} disabled={!!sendingId} className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-2 border-2 border-white shadow-lg active:scale-90 transition-transform">
                    {sendingId === friend.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  </button>
                </div>
                <span className="text-[10px] text-gray-700 font-bold truncate w-20 text-center uppercase tracking-tight">@{friend.username}</span>
              </div>
            ))
          ) : (
            <div className="w-full text-center py-4 text-gray-400 text-xs font-bold uppercase italic">No friends found</div>
          )}
        </div>

        {/* Bottom Options */}
        <div className="pt-6 border-t border-gray-100 flex justify-around items-center shrink-0">
          <button onClick={() => { navigator.clipboard.writeText(videoUrl); toast.success("Copied!"); }} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-black active:bg-gray-200 transition-colors"><Copy size={20} /></div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Link</span>
          </button>
          <button onClick={() => navigator.share?.({ url: videoUrl })} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100 active:bg-blue-100 transition-colors"><Share2 size={20} /></div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Other</span>
          </button>
        </div>
      </div>
      <style jsx global>{` .no-scrollbar::-webkit-scrollbar { display: none; } `}</style>
    </div>
  );
}
