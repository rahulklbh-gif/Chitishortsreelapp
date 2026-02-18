import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Camera, Loader2, UserPlus } from 'lucide-react';

export function ChatListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 🔥 Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (user) fetchRooms();
  }, [user]);

  // 🔎 Search Function: Supabase se users dhoondhne ke liye
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, full_name')
      .ilike('username', `%${query}%`) // Username match karega
      .not('id', 'eq', user?.id) // Khud ko search mein nahi dikhayega
      .limit(10);

    if (!error) setSearchResults(data || []);
    setIsSearching(false);
  };

  // 🚀 Naya Chat Room banane ya dhoondhne ka function
  const startChat = async (friendId: string) => {
    // Pehle check karo ki kya room pehle se hai?
    const { data: existingRoom } = await supabase
      .from('chat_rooms')
      .select('id')
      .or(`and(user1_id.eq.${user?.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user?.id})`)
      .single();

    if (existingRoom) {
      navigate(`/chat/${existingRoom.id}?friend=${friendId}`);
    } else {
      // Naya room banao
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert([{ user1_id: user?.id, user2_id: friendId }])
        .select()
        .single();
      
      if (!error) navigate(`/chat/${newRoom.id}?friend=${friendId}`);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          user1:profiles!chat_rooms_user1_id_fkey(id, username, avatar_url, full_name),
          user2:profiles!chat_rooms_user2_id_fkey(id, username, avatar_url, full_name)
        `)
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
        .order('last_message_time', { ascending: false });

      if (error) throw error;
      setRooms(data || []);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="p-4 pt-8 flex items-center gap-6 sticky top-0 bg-black z-20 border-b border-white/5">
        <ArrowLeft onClick={() => navigate('/')} className="cursor-pointer" />
        <h1 className="text-xl font-bold">Messages</h1>
      </div>

      {/* 🔎 Search Input */}
      <div className="p-4">
        <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/10 focus-within:border-blue-500/50 transition-all">
          <Search size={18} className={isSearching ? "animate-pulse text-blue-500" : "text-gray-500"} />
          <input 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search friends by username..." 
            className="bg-transparent border-none outline-none text-sm w-full"
          />
        </div>
      </div>

      {/* ⚡ Search Results Area */}
      {searchQuery.length > 0 && (
        <div className="px-4 mb-6 animate-in slide-in-from-top-2 duration-300">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">People</h2>
          <div className="space-y-4">
            {searchResults.map((person) => (
              <div key={person.id} onClick={() => startChat(person.id)} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <img src={person.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.username}`} className="w-12 h-12 rounded-full border border-white/10" />
                  <div>
                    <p className="text-sm font-bold">@{person.username}</p>
                    <p className="text-xs text-gray-500">{person.full_name || 'Chiti User'}</p>
                  </div>
                </div>
                <UserPlus size={20} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
            {searchResults.length === 0 && !isSearching && (
              <p className="text-xs text-center text-gray-600 py-4">No users found with that name.</p>
            )}
          </div>
          <hr className="mt-6 border-white/5" />
        </div>
      )}

      {/* 📁 Existing Chats List */}
      <div className="px-2 space-y-1">
        {!searchQuery && rooms.length > 0 ? (
          rooms.map((room) => {
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
            return (
              <div key={room.id} onClick={() => navigate(`/chat/${room.id}?friend=${otherUser.id}`)} className="flex items-center gap-4 p-3 hover:bg-white/5 active:bg-white/10 rounded-2xl transition-all cursor-pointer">
                <img src={otherUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username}`} className="w-14 h-14 rounded-full object-cover border border-white/10" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{otherUser?.username}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">{room.last_message || 'Tap to chat'}</p>
                </div>
              </div>
            );
          })
        ) : !searchQuery && (
          <div className="text-center py-20 text-gray-600">
            <p className="text-sm font-bold uppercase tracking-widest">No conversations yet</p>
            <p className="text-[10px] mt-2">Search for a friend to start chatting!</p>
          </div>
        )}
      </div>
    </div>
  );
}
