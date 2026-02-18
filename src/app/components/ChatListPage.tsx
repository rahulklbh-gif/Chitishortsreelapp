import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Camera, Loader2 } from 'lucide-react';

export function ChatListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchRooms();
  }, [user]);

  const fetchRooms = async () => {
    try {
      // Un rooms ko lao jahan current user participant hai
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
    } catch (err) {
      console.error("Fetch rooms error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="p-4 pt-8 flex items-center gap-6 sticky top-0 bg-black z-20 border-b border-white/5">
        <ArrowLeft onClick={() => navigate('/')} className="cursor-pointer" />
        <h1 className="text-xl font-bold">Messages</h1>
      </div>

      {/* Search Bar */}
      <div className="p-4">
        <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/10">
          <Search size={18} className="text-gray-500" />
          <input 
            placeholder="Search friends..." 
            className="bg-transparent border-none outline-none text-sm w-full"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="px-2 space-y-1">
        {rooms.length > 0 ? (
          rooms.map((room) => {
            // Check karo ki doosra banda kaun hai
            const otherUser = room.user1_id === user?.id ? room.user2 : room.user1;
            
            return (
              <div 
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}?friend=${otherUser.id}`)}
                className="flex items-center gap-4 p-3 hover:bg-white/5 active:bg-white/10 rounded-2xl transition-all cursor-pointer"
              >
                <div className="relative">
                  <img 
                    src={otherUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username}`} 
                    className="w-14 h-14 rounded-full object-cover border border-white/10"
                  />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-black rounded-full"></div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{otherUser?.full_name || otherUser?.username}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">
                    {room.last_message || 'Tap to chat'}
                  </p>
                </div>
                
                <Camera size={20} className="text-gray-600" />
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 text-gray-600">
            <p className="text-sm font-bold uppercase tracking-widest">No conversations yet</p>
            <p className="text-[10px] mt-2">Share a video to start chatting!</p>
          </div>
        )}
      </div>
    </div>
  );
}
