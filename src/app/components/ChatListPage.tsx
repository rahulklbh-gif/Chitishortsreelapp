"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, Send } from 'lucide-react';

function formatLastSeen(lastSeenTimestamp: string | null) {
  if (!lastSeenTimestamp) return 'Offline';
  const now = new Date().getTime();
  const past = new Date(lastSeenTimestamp).getTime();
  const diffInMinutes = Math.floor((now - past) / (1000 * 60));

  if (diffInMinutes < 1) return 'Active now';
  if (diffInMinutes < 60) return `Active ${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Active ${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Active ${diffInDays}d ago`;
}

function UserAvatar({ userId, username, isOnline }: { userId: string, username: string, isOnline: boolean }) {
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
      {/* 🟢 Real-time Global Green Dot */}
      {isOnline && (
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
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
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'all' | 'primary' | 'general' | 'requests'>('all');

  useEffect(() => {
    if (!user) return;

    fetchRooms();

    // 🌐 GLOBAL PRESENCE CHANNEL
    const presenceChannel = supabase.channel('global-app-presence', {
      config: { presence: { key: user.id } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    // ⚡ REALTIME LISTENER FOR INSTANT CHAT ROOM SORTING & BLUE DOT
    const roomChannel = supabase
      .channel('chat_rooms_realtime_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_rooms' },
        () => {
          fetchRooms(); // Naya message aate hi re-fetch karke sabse upar daal do
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(roomChannel);
    };
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
      .select('id, username, avatar_url, full_name, last_seen')
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
        .select(`
          *, 
          user1:profiles!chat_rooms_user1_id_fkey(id, username, last_seen), 
          user2:profiles!chat_rooms_user2_id_fkey(id, username, last_seen)
        `)
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
        .order('last_message_time', { ascending: false }); // 🔥 Latest Message Pehle Aayega

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

  // 🔴 Active/Online Friends Tray Sort Logic: Online Users First
  const activeOnlineRooms = [...rooms].sort((a, b) => {
    const userA = a.user1_id === user?.id ? a.user2 : a.user1;
    const userB = b.user1_id === user?.id ? b.user2 : b.user1;
    const isAOnline = onlineUsers.has(userA?.id);
    const isBOnline = onlineUsers.has(userB?.id);

    if (isAOnline && !isBOnline) return -1;
    if (!isAOnline && isBOnline) return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-[110] bg-white text-black overflow-y-auto">
      {/* Header */}
      <div className="p-4 pt-10 flex items-center justify-between sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="flex items-center gap-4">
          <ArrowLeft onClick={() => navigate('/')} className="cursor-pointer text-black" />
          <h1 className="text-xl font-extrabold tracking-tight">
            {user?.user_metadata?.username || 'Messages'}
          </h1>
        </div>
        <Send size={20} className="text-black cursor-pointer" />
      </div>

      {/* 🚀 Top Active Friends Horizontal Row */}
      {activeOnlineRooms.length > 0 && searchQuery.length < 2 && (
        <div className="px-4 py-3 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-gray-50">
          {activeOnlineRooms.map((room) => {
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
            const isOnline = onlineUsers.has(otherUser?.id);

            return (
              <div 
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}?friend=${otherUser?.id}`)}
                className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <UserAvatar userId={otherUser?.id} username={otherUser?.username} isOnline={isOnline} />
                <span className="text-[11px] text-gray-600 font-medium truncate max-w-[65px]">
                  @{otherUser?.username}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search Input */}
      <div className="p-4 pb-2">
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

      {/* Tabs Bar */}
      {searchQuery.length < 2 && (
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(['all', 'primary', 'general', 'requests'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-500 hover:text-black'
              }`}
            >
              {tab === 'all' ? 'All' : tab}
            </button>
          ))}
        </div>
      )}

      {/* Chat List Sorted By Last Message Time */}
      <div className="px-4 space-y-1 mt-2">
        {searchQuery.length >= 2 ? (
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Suggested People</h2>
            {searchResults.map((person) => {
              const isOnline = onlineUsers.has(person.id);
              return (
                <div key={person.id} onClick={() => startChat(person.id)} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <UserAvatar userId={person.id} username={person.username} isOnline={isOnline} />
                    <div>
                      <p className="text-sm font-bold">@{person.username}</p>
                      <p className="text-xs text-gray-500">{isOnline ? 'Active now' : formatLastSeen(person.last_seen)}</p>
                    </div>
                  </div>
                  <UserPlus size={18} className="text-blue-500" />
                </div>
              );
            })}
          </div>
        ) : (
          rooms.map((room) => {
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
            const isOnline = onlineUsers.has(otherUser?.id);
            
            // 🚀 Highlight logic: Last message received from friend and unread
            const isUnread = room.last_sender_id !== user?.id && room.is_read === false;

            return (
              <div 
                key={room.id} 
                onClick={() => navigate(`/chat/${room.id}?friend=${otherUser?.id}`)} 
                className={`flex items-center gap-4 py-3 active:bg-gray-50 transition-colors cursor-pointer ${isUnread ? 'bg-blue-50/40' : ''}`}
              >
                <UserAvatar userId={otherUser?.id} username={otherUser?.username} isOnline={isOnline} />
                <div className="flex-1 border-b border-gray-50 pb-3 flex items-center justify-between pr-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm ${isUnread ? 'font-black text-black' : 'font-bold text-gray-900'}`}>
                      {otherUser?.username}
                    </h3>
                    <p className={`text-xs truncate ${isUnread ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                      {room.last_message || 'Tap to chat'} 
                      <span className="text-gray-400 text-[10px] ml-2">
                        · {isOnline ? 'Active now' : formatLastSeen(otherUser?.last_seen)}
                      </span>
                    </p>
                  </div>
                  
                  {/* 🚀 Instagram Blue Dot Badge */}
                  {isUnread && (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
