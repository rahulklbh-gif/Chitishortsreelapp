import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, Loader2 } from 'lucide-react';

// ✅ Wahi logic jo CommentSheet mein kaam kar raha hai
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
    <div className="relative w-12 h-12 flex-shrink-0">
      <div className="absolute inset-0 w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 font-bold text-sm">
        {username ? username[0].toUpperCase() : 'U'}
      </div>
      {avatarUrl && (
        <img 
          src={avatarUrl} 
          className="absolute inset-0 w-12 h-12 rounded-full object-cover border border-gray-100"
          crossOrigin="anonymous"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
    </div>
  );
}

export function ChatListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRooms();

      // ✅ Real-time subscription for unread highlights
      const channel = supabase
        .channel('room-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_rooms' }, () => {
          fetchRooms();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, full_name')
      .ilike('username', `%${query}%`)
      .not('id', 'eq', user?.id)
      .limit(8);
    setSearchResults(data || []);
    setIsSearching(false);
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`*, user1:profiles!chat_rooms_user1_id_fkey(id, username), user2:profiles!chat_rooms_user2_id_fkey(id, username)`)
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
        .order('last_message_time', { ascending: false });
      if (!error) setRooms(data || []);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const startChat = async (friendId: string) => {
    const { data: existingRoom } = await supabase
      .from('chat_rooms')
      .select('id')
      .or(`and(user1_id.eq.${user?.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user?.id})`)
      .maybeSingle();

    if (existingRoom) {
      navigate(`/chat/${existingRoom.id}?friend=${friendId}`);
    } else {
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert([{ user1_id: user?.id, user2_id: friendId }])
        .select().single();
      if (!error) navigate(`/chat/${newRoom.id}?friend=${friendId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white text-black overflow-y-auto">
      <div className="p-4 pt-10 flex items-center gap-6 sticky top-0 bg-white border-b border-gray-100">
        <ArrowLeft onClick={() => navigate('/')} className="cursor-pointer text-black" />
        <h1 className="text-xl font-extrabold tracking-tight">Messages</h1>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 bg-gray-100 p-3 rounded-2xl border border-gray-200">
          <Search size={18} className="text-gray-400" />
          <input 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search friends..." 
            className="bg-transparent border-none outline-none text-sm w-full text-black placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="px-4 space-y-1">
        {searchQuery.length >= 2 ? (
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Suggested People</h2>
            {searchResults.map((person) => (
              <div key={person.id} onClick={() => startChat(person.id)} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-4">
                  <UserAvatar userId={person.id} username={person.username} />
                  <div>
                    <p className="text-sm font-bold">@{person.username}</p>
                    <p className="text-xs text-gray-500">{person.full_name}</p>
                  </div>
                </div>
                <UserPlus size={18} className="text-blue-500" />
              </div>
            ))}
          </div>
        ) : (
          rooms.map((room) => {
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
            
            // ✅ Highlight Logic: Agar last message kisi aur ne bheja aur read nahi hua
            const isUnread = room.last_sender_id !== user?.id && room.is_read === false;

            return (
              <div 
                key={room.id} 
                onClick={() => navigate(`/chat/${room.id}?friend=${otherUser?.id}`)} 
                className={`flex items-center gap-4 py-3 active:bg-gray-50 transition-colors cursor-pointer ${isUnread ? 'bg-blue-50/30' : ''}`}
              >
                <UserAvatar userId={otherUser?.id} username={otherUser?.username} />
                <div className="flex-1 border-b border-gray-50 pb-3 flex items-center justify-between pr-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm ${isUnread ? 'font-black text-black' : 'font-bold text-gray-900'}`}>
                      {otherUser?.username}
                    </h3>
                    <p className={`text-xs truncate ${isUnread ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                      {room.last_message || 'Tap to chat'}
                    </p>
                  </div>
                  
                  {/* ✅ Instagram Blue Dot */}
                  {isUnread && (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
} 
