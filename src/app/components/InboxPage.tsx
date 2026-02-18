import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      // 1. Pehle notifications le kar aao
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Data Enrichment (Photo, Username aur R2 Video link ke liye)
      const enriched = await Promise.all((notifs || []).map(async (n) => {
        // Direct ID match logic for profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', n.sender_id) 
          .single();

        return {
          ...n,
          sender: profile || { username: 'User', avatar_url: null }
        };
      }));

      setNotifications(enriched);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Mark as read (Database update)
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .then();

      // Real-time listener: Bina refresh ke naya notification dikhane ke liye
      const channel = supabase
        .channel(`inbox_v3_${user.id}`)
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

  if (loading && notifications.length === 0) return (
    <div className="flex justify-center items-center min-h-screen bg-black">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24 font-sans">
      <h1 className="text-xl font-bold mb-6 italic tracking-widest uppercase border-b border-white/5 pb-2">
        Inbox
      </h1>
      
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-32 text-gray-600">
          <MessageCircle className="mb-4 opacity-10" size={60} />
          <p className="text-sm font-medium">Koi activity nahi mili</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center gap-3 bg-[#0f0f0f] p-3 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
              
              {/* ✅ PROFILE PHOTO: Profiles table se ID match karke */}
              <div className="relative w-12 h-12 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-blue-900/30 overflow-hidden flex items-center justify-center border border-white/10">
                  {n.sender?.avatar_url ? (
                    <img 
                      src={n.sender.avatar_url} 
                      className="w-full h-full object-cover"
                      alt="avatar"
                    />
                  ) : (
                    <span className="text-blue-400 font-black text-sm uppercase">
                      {n.sender?.username?.[0] || 'U'}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Notification Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">
                  <span className="font-bold text-white">@{n.sender?.username || 'user'}</span>
                  <span className="text-gray-400 ml-1">
                    {/* ✅ FOLLOW NOTIFICATION TEXT FIX */}
                    {n.type === 'follow' ? 'started following you' : n.content}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-tight">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* ✅ CLOUDFLARE R2 VIDEO THUMBNAIL (chiti-videos bucket) */}
              {n.post_id && (n.type === 'like' || n.type === 'comment') && (
                <div className="w-10 h-14 rounded-lg overflow-hidden border border-white/10 bg-black flex-shrink-0 shadow-lg">
                  <video 
                    src={`https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/chiti-videos/${n.post_id}`} 
                    className="w-full h-full object-cover opacity-60"
                    muted
                  />
                </div>
              )}

              {/* Unread Indicator */}
              {!n.is_read && <div className="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.6)]"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
