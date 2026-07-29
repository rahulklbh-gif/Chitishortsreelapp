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
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

function checkIsOnline(userId: string, lastSeen: string | null, onlineSet: Set<string>) {
  if (!userId) return false;
  if (onlineSet.has(userId)) return true;
  if (lastSeen) {
    const diffInMs = new Date().getTime() - new Date(lastSeen).getTime();
    if (diffInMs < 120000) return true; 
  }
  return false;
}

function UserAvatar({ userId, username, isOnline }: { userId: string, username: string, isOnline: boolean }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function getPhoto() {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', userId)
          .maybeSingle();
        if (isMounted && data?.avatar_url) setAvatarUrl(data.avatar_url);
      } catch (e) {
        console.error(e);
      }
    }
    getPhoto();
    return () => { isMounted = false; };
  }, [userId]);

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <div className="absolute inset-0 w-14 h-14 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 font-bold text-sm">
        {username ? username[0].toUpperCase() : 'U'}
      </div>
      {avatarUrl && (
        <img 
          src={avatarUrl} 
          className="absolute inset-0 w-14 h-14 rounded-full object-cover border border-gray-100"
          crossOrigin="anonymous"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      {/* 🟢 Top Active Bubble Green Dot */}
      {isOnline && (
        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </div>
  );
}

export function ChatListPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // 🚀 INSTANT LOAD: Cache se pehle hi render kar do (0-second delay)
  const [rooms, setRooms] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_chat_rooms');
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('cached_chat_rooms');
    }
    return true;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'all' | 'primary' | 'general' | 'requests'>('all');

  useEffect(() => {
    let isMounted = true;

    async function initChatList() {
      if (!user?.id) {
        if (!authLoading) setLoading(false);
        return;
      }

      await fetchRooms();

      // 🌐 Real-time Online Channel
      const presenceChannel = supabase.channel('global-app-presence', {
        config: { presence: { key: user.id } }
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          if (!isMounted) return;
          const state = presenceChannel.presenceState();
          setOnlineUsers(new Set(Object.keys(state)));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ online_at: new Date().toISOString() });
          }
        });

      // ⚡ DUAL REALTIME LISTENER (Rooms + Messages Delete/Insert Sync)
      const realtimeChannel = supabase
        .channel('chat_list_realtime_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_rooms' },
          () => { if (isMounted) fetchRooms(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_messages' },
          () => { if (isMounted) fetchRooms(); }
        )
        .subscribe();
    }

    initChatList();

    return () => {
      isMounted = false;
      supabase.removeAllChannels();
    };
  }, [user?.id, authLoading]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name, last_seen')
        .ilike('username', `%${query}%`)
        .not('id', 'eq', user?.id)
        .limit(8);
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // 🚀 CRASH-PROOF & INSTANT CACHED FETCH ROOMS
  const fetchRooms = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data: rawRooms, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_time', { ascending: false });

      if (roomError || !rawRooms || rawRooms.length === 0) {
        if (rawRooms?.length === 0) {
          setRooms([]);
          localStorage.removeItem('cached_chat_rooms');
        }
        setLoading(false);
        return;
      }

      const friendIds = rawRooms.map(r => r.user1_id === user.id ? r.user2_id : r.user1_id).filter(Boolean);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, last_seen, full_name')
        .in('id', friendIds);

      const profileMap = new Map();
      (profiles || []).forEach(p => profileMap.set(p.id, p));

      const formattedRooms = rawRooms.map(room => {
        const otherId = room.user1_id === user.id ? room.user2_id : room.user1_id;
        const otherProfile = profileMap.get(otherId) || { id: otherId, username: 'User' };
        return {
          ...room,
          user1: room.user1_id === user.id ? user : otherProfile,
          user2: room.user2_id === user.id ? user : otherProfile,
        };
      });

      setRooms(formattedRooms);
      localStorage.setItem('cached_chat_rooms', JSON.stringify(formattedRooms));
    } catch (err) { 
      console.error("Fetch Rooms Error: ", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const startChat = async (friendId: string) => {
    if (!user?.id) return;
    try {
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingRoom) {
        navigate(`/chat/${existingRoom.id}?friend=${friendId}`);
      } else {
        const { data: newRoom, error } = await supabase
          .from('chat_rooms')
          .insert([{ user1_id: user.id, user2_id: friendId }])
          .select().single();
        if (!error && newRoom) navigate(`/chat/${newRoom.id}?friend=${friendId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 🚀 ONLY Top Horizontal Tray Filters for Online Friends
  const topActiveTrayRooms = rooms.filter(room => {
    const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
    return checkIsOnline(otherUser?.id, otherUser?.last_seen, onlineUsers);
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

      {/* Top Active Tray (Right-slide bubbles - ONLY for online friends) */}
      {topActiveTrayRooms.length > 0 && searchQuery.length < 2 && (
        <div className="px-4 py-3 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-gray-100">
          {topActiveTrayRooms.map((room) => {
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;

            return (
              <div 
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}?friend=${otherUser?.id}`)}
                className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <UserAvatar userId={otherUser?.id} username={otherUser?.username} isOnline={true} />
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

      {/* Tabs */}
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

      {/* Main Chat List / Instant Skeleton */}
      <div className="px-4 space-y-1 mt-2">
        {(loading || authLoading) && rooms.length === 0 ? (
          /* 🚀 INSTAGRAM SKELETON PLACEHOLDER (Delay bilkul feel nahi hone dega) */
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-14 h-14 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2 border-b border-gray-50 pb-3">
                  <div className="w-32 h-4 bg-gray-200 rounded" />
                  <div className="w-48 h-3 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery.length >= 2 ? (
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Suggested People</h2>
            {searchResults.map((person) => {
              const isOnline = checkIsOnline(person.id, person.last_seen, onlineUsers);
              return (
                <div key={person.id} onClick={() => startChat(person.id)} className="flex items-center justify-between py-3 cursor-pointer">
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
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm font-medium">
            No conversations yet. Search friends to start chatting!
          </div>
        ) : (
          rooms.map((room) => {
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
            const isOnline = checkIsOnline(otherUser?.id, otherUser?.last_seen, onlineUsers);
            
            const isTapToChat = !room.last_message || room.last_message === 'Tap to chat';
            const isUnread = !isTapToChat && room.last_sender_id !== user?.id && room.is_read === false;

            return (
              <div 
                key={room.id} 
                onClick={() => navigate(`/chat/${room.id}?friend=${otherUser?.id}`)} 
                className="flex items-center gap-4 py-3 active:bg-gray-50 transition-colors cursor-pointer"
              >
                <UserAvatar userId={otherUser?.id} username={otherUser?.username} isOnline={isOnline} />
                <div className="flex-1 border-b border-gray-50 pb-3 flex items-center justify-between pr-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm ${isUnread ? 'font-black text-red-600' : 'font-bold text-gray-800'}`}>
                      {otherUser?.username || 'User'}
                    </h3>
                    
                    <p className={`text-xs truncate ${isUnread ? 'font-black text-red-600' : 'text-gray-500 font-normal'}`}>
                      {room.last_message || 'Tap to chat'} 
                      <span className="text-gray-400 font-normal text-[10px] ml-1.5">
                        · {formatLastSeen(room.last_message_time || otherUser?.last_seen)}
                      </span>
                    </p>
                  </div>
                  
                  {isUnread && (
                    <div className="w-2.5 h-2.5 bg-red-600 rounded-full flex-shrink-0 ml-2" />
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
