import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Optimized Fetch: Sab kuch ek hi query mein (Super Fast)
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!notifications_sender_id_fkey (
            username,
            avatar_url
          ),
          post:posts (
            youtube_video_id
          )
        `)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Agar fkey error de toh simple fetch fallback
        const { data: simpleData } = await supabase
          .from('notifications')
          .select('*')
          .eq('receiver_id', user.id)
          .order('created_at', { ascending: false });
        
        // Manual Map for speed
        const enriched = await Promise.all((simpleData || []).map(async (n) => {
           const { data: p } = await supabase.from('profiles').select('username, avatar_url').eq('id', n.sender_id).single();
           return { ...n, sender: p };
        }));
        setNotifications(enriched);
      } else {
        setNotifications(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Real-time updates
      const subscription = supabase
        .channel('inbox_realtime')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `receiver_id=eq.${user.id}` 
        }, () => fetchNotifications())
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [user]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <h1 className="text-xl font-bold mb-6 italic tracking-widest">INBOX</h1>
      
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 text-gray-600">
          <MessageCircle size={48} className="mb-2 opacity-20" />
          <p>No activity yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center gap-3 bg-[#121212] p-3 rounded-xl border border-white/5 active:scale-95 transition-transform">
              
              {/* Profile Photo Fix */}
              <div className="relative w-11 h-11 flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center overflow-hidden border border-white/10">
                  {n.sender?.avatar_url ? (
                    <img src={n.sender.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{n.sender?.username?.[0] || 'U'}</span>
                  )}
                </div>
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-tight">
                  <span className="font-bold text-white mr-1">@{n.sender?.username || 'user'}</span>
                  <span className="text-gray-400">
                    {n.type === 'follow' ? 'started following you' : (n.content || 'interacted with you')}
                  </span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1 font-bold uppercase tracking-tighter">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Post Thumbnail (If any) */}
              {n.post?.youtube_video_id && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                  <img src={`https://img.youtube.com/vi/${n.post.youtube_video_id}/default.jpg`} className="w-full h-full object-cover opacity-60" alt="" />
                </div>
              )}

              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
