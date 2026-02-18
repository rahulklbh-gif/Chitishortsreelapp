import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Notifications Logic
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      // Step 1: Notifications fetch karo (Simple select, koi join nahi taaki fast load ho)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Step 2: In notifications ke liye profiles aur posts ka data manually map karo
      // Ye logic error-free hai kyunki ye database relationships par depend nahi karta
      const enrichedNotifications = await Promise.all((data || []).map(async (n) => {
        // Fetch sender profile (Photo aur Username ke liye)
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', n.sender_id)
          .single();

        // Fetch post thumb (agar post_id ho)
        let postData = null;
        if (n.post_id) {
          const { data: p } = await supabase
            .from('posts')
            .select('youtube_video_id')
            .eq('id', n.post_id)
            .single();
          postData = p;
        }

        return { ...n, sender: profile, post: postData };
      }));

      setNotifications(enrichedNotifications);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Mark as read
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .then();

      // Real-time listener (Bina refresh ke update)
      const channel = supabase
        .channel(`inbox_${user.id}`)
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
      <h1 className="text-xl font-bold mb-6 italic tracking-widest">INBOX</h1>
      
      {notifications.length === 0 ? (
        <div className="text-center text-gray-500 mt-20">
          <MessageCircle className="mx-auto mb-2 opacity-20" size={50} />
          <p>Abhi tak koi activity nahi hui</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center gap-3 bg-gray-900/40 p-3 rounded-2xl border border-white/5">
              
              {/* Profile Photo - Direct from Profile Table */}
              <div className="w-10 h-10 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border border-white/10 overflow-hidden">
                  {n.sender?.avatar_url ? (
                    <img 
                      src={n.sender.avatar_url} 
                      className="w-full h-full object-cover" 
                      alt="avatar" 
                    />
                  ) : (
                    <span className="text-xs font-bold uppercase">{n.sender?.username?.[0] || 'U'}</span>
                  )}
                </div>
              </div>
              
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-bold text-white">@{n.sender?.username || 'User'}</span>
                  <span className="text-gray-400 ml-1">
                    {n.type === 'follow' ? 'started following you' : n.content}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 uppercase">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Video Thumbnail */}
              {n.post?.youtube_video_id && (
                <div className="w-8 h-12 rounded bg-gray-800 overflow-hidden border border-white/10">
                  <img 
                    src={`https://img.youtube.com/vi/${n.post.youtube_video_id}/mqdefault.jpg`}
                    className="w-full h-full object-cover opacity-80"
                    alt="v"
                  />
                </div>
              )}

              {!n.is_read && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
