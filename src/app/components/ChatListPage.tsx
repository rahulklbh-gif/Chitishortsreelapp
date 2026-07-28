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

function checkIsOnline(userId: string, lastSeen: string | null, onlineSet: Set<string>) {
  if (!userId) return false;
  if (onlineSet.has(userId)) return true;
  if (lastSeen) {
    const diffInMs = new Date().getTime() - new Date(lastSeen).getTime();
    if (diffInMs < 120000) return true; // 2 minutes heartbeat window
  }
  return false;
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

    // ⚡ REALTIME LISTENER FOR CHAT ROOMS & INSTANT MESSAGE UPDATES
    const roomChannel = supabase
      .channel('chat_rooms_realtime_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_rooms' },
        () => {
          fetchRooms(); // Naya text ya video message aate hi instant top re-fetch
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
        .order('last_message_time', { ascending: false }); // 🔥 RECENT CHAT ALWAYS TOP (Latest Time First)

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

  // 🚀 Top Tray Sort: Online Friends First for Top Bubble Row
  const topActiveRooms = [...rooms].sort((a, b) => {
    const userA = a.user1_id === user?.id ? a.user2 : a.user1;
    const userB = b.user1_id === user?.id ? b.user2 : b.user1;
    const isAOnline = checkIsOnline(userA?.id, userA?.last_seen, onlineUsers);
    const isBOnline = checkIsOnline(userB?.id, userB?.last_seen, onlineUsers);

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
      {topActiveRooms.length > 0 && searchQuery.length < 2 && (
        <div className="px-4 py-3 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-gray-50">
          {topActiveRooms.map((room) => {
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
            const isOnline = checkIsOnline(otherUser?.id, otherUser?.last_seen, onlineUsers);

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

      {/* 🚀 Main Chat List: ALWAYS STRICTLY SORTED BY RECENT CHAT TIME */}
      <div className="px-4 space-y-1 mt-2">
        {searchQuery.length >= 2 ? (
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Suggested People</h2>
            {searchResults.map((person) => {
              const isOnline = checkIsOnline(person.id, person.last_seen, onlineUsers);
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
            const isOnline = checkIsOnline(otherUser?.id, otherUser?.last_seen, onlineUsers);
            
            // 🔴 UNREAD LOGIC: Agar last message kisi aur ne bheja hai aur wo read nahi hua
            const isUnread = room.last_sender_id !== user?.id && room.is_read === false;

            return (
              <div 
                key={room.id} 
                onClick={() => navigate(`/chat/${room.id}?friend=${otherUser?.id}`)} 
                className={`flex items-center gap-4 py-3 active:bg-gray-50 transition-colors cursor-pointer ${isUnread ? 'bg-red-50/60 font-black' : ''}`}
              >
                <UserAvatar userId={otherUser?.id} username={otherUser?.username} isOnline={isOnline} />
                <div className="flex-1 border-b border-gray-50 pb-3 flex items-center justify-between pr-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm ${isUnread ? 'font-black text-red-600' : 'font-bold text-gray-900'}`}>
                      {otherUser?.username}
                    </h3>
                    
                    {/* 🔴 TEXT PREVIEW & RED UNREAD COLOR */}
                    <p className={`text-xs truncate ${isUnread ? 'font-black text-red-600' : 'text-gray-500'}`}>
                      {room.last_message || 'Tap to chat'} 
                      <span className="text-gray-400 font-normal text-[10px] ml-2">
                        · {isOnline ? 'Active now' : formatLastSeen(otherUser?.last_seen)}
                      </span>
                    </p>
                  </div>
                  
                  {/* 🔴 RED PULSE GLOWING DOT FOR UNREAD MESSAGES */}
                  {isUnread && (
                    <div className="w-3 h-3 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.7)] animate-pulse" />
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
