import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, Loader2 } from 'lucide-react';

export function ChatListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (user) fetchRooms();
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
        .select(`*, user1:profiles!chat_rooms_user1_id_fkey(*), user2:profiles!chat_rooms_user2_id_fkey(*)`)
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
    /* ✅ Pure White Theme & Full Screen (Hides Bottom Navigation) */
    <div className="fixed inset-0 z-[110] bg-white text-black overflow-y-auto">
      {/* Header */}
      <div className="p-4 pt-10 flex items-center gap-6 sticky top-0 bg-white border-b border-gray-100">
        <ArrowLeft onClick={() => navigate('/')} className="cursor-pointer text-black" />
        <h1 className="text-xl font-extrabold tracking-tight">Messages</h1>
      </div>

      {/* Search Section */}
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

      {/* Results / List Area */}
      <div className="px-4 space-y-1">
        {searchQuery.length >= 2 ? (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Suggested People</h2>
            {searchResults.map((person) => (
              <div key={person.id} onClick={() => startChat(person.id)} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 bg-gray-200">
                    <img 
                      src={person.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${person.username}`} 
                      className="w-full h-full object-cover"
                      onError={(e) => {(e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${person.username}`}}
                    />
                  </div>
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
            return (
              <div key={room.id} onClick={() => navigate(`/chat/${room.id}?friend=${otherUser.id}`)} className="flex items-center gap-4 py-3 active:bg-gray-50 transition-colors">
                <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-100 bg-gray-200">
                  <img 
                    src={otherUser?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${otherUser?.username}`} 
                    className="w-full h-full object-cover"
                    onError={(e) => {(e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${otherUser?.username}`}}
                  />
                </div>
                <div className="flex-1 border-b border-gray-50 pb-3">
                  <h3 className="text-sm font-bold text-gray-900">{otherUser?.username}</h3>
                  <p className="text-xs text-gray-500 truncate">{room.last_message || 'Tap to chat'}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
} 
