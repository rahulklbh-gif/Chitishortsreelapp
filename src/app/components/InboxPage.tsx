import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mark as read function (Purana logic)
  const markNotificationsAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      // 1. Notifications fetch karo
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Data Enrichment (Photo aur Username ke liye)
      // Kyunki UUID alag hai, hum notifications table ke 'sender_id' 
      // ka use karke profile table se matching data nikaalenge
      const enriched = await Promise.all((notifs || []).map(async (n) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', n.sender_id) // Yahan match check ho raha hai
          .single();

        return {
          ...n,
          sender: profile || { username: 'User', avatar_url: null }
        };
      }));

      setNotifications(enriched);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      markNotificationsAsRead();

      // Real-time notification logic
      const channel = supabase
        .channel(`inbox_realtime_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `receiver_id=eq.${user.id}`,
        }, () => fetchNotifications())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  if (loading && notifications.length === 0) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <h1 className="text-xl font-bold mb-6 italic tracking-widest uppercase">Inbox</h1>
      
      {notifications.length === 0 ? (
        <div className="text-center text-gray-500 mt-20">
          <MessageCircle className="mx-auto mb-2 opacity-20" size={50} />
          <p>Koi activity nahi mili</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
              
              {/* ✅ PROFILE PHOTO FIX: Direct link or Initial */}
              <div className="w-11 h-11 flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 overflow-hidden flex items-center justify-center border border-white/10">
                  {n.sender?.avatar_url ? (
                    <img 
                      src={n.sender.avatar_url} 
                      className="w-full h-full object-cover"
                      alt="avatar"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <span className="text-white font-bold text-sm uppercase">
                      {n.sender?.username?.[0] || 'U'}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-black text-white">@{n.sender?.username || 'User'}</span>
                  <span className="text-gray-300 ml-1">
                    {/* ✅ FOLLOW NOTIFICATION FIX */}
                    {n.type === 'follow' ? 'started following you' : n.content}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-tighter">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* ✅ R2 VIDEO THUMBNAIL (YouTube hata diya) */}
              {n.post_id && (n.type === 'like' || n.type === 'comment') && (
                <div className="w-10 h-14 rounded overflow-hidden border border-white/10 bg-gray-900 flex-shrink-0">
                  <video 
                    src={`https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/videos/${n.post_id}`} 
                    className="w-full h-full object-cover opacity-50"
                  />
                </div>
              )}

              {/* Unread dot */}
              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
