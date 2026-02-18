import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Notifications and Mark as Read
  useEffect(() => {
    if (user) {
      fetchNotifications();
      markNotificationsAsRead(); 

      // 🔥 REAL-TIME LOGIC START: Bina refresh kiye naya notification aane ke liye
      const channel = supabase
        .channel(`public:notifications:receiver_id=eq.${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `receiver_id=eq.${user.id}`,
          },
          (payload) => {
            // Naya notification aate hi use fetch karke list mein sabse upar daal dena
            fetchNotifications(); 
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
      // 🔥 REAL-TIME LOGIC END
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // BADLAV: sender table se avatar_url aur username fetch ho raha hai
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:sender_id (
            username,
            avatar_url
          ),
          post:post_id (
            youtube_video_id
          )
        `) 
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching:', err);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading && notifications.length === 0) return <div className="flex justify-center p-10 text-white"><Loader2 className="animate-spin" /></div>;

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
            <div key={n.id} className="flex items-center gap-3 bg-gray-900/60 p-4 rounded-xl border border-white/5">
              {/* Sender Avatar: Fallback letter agar photo na ho */}
              <div className="relative w-10 h-10 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden">
                  {n.sender?.avatar_url ? (
                    <img 
                      src={n.sender.avatar_url} 
                      className="w-full h-full object-cover"
                      alt="user"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <span>{n.sender?.username?.[0] || 'U'}</span>
                  )}
                </div>
              </div>
              
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-black text-white">@{n.sender?.username || 'User'}</span>
                  <span className="text-gray-300 ml-1">{n.content}</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter font-bold">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* FIX: Video Thumbnail display on the right */}
              {n.post?.youtube_video_id && (
                <div className="w-10 h-14 rounded overflow-hidden border border-white/10 bg-gray-800 flex-shrink-0">
                  <img 
                    src={`https://img.youtube.com/vi/${n.post.youtube_video_id}/mqdefault.jpg`}
                    className="w-full h-full object-cover"
                    alt="video preview"
                  />
                </div>
              )}

              {/* Red Dot if unread */}
              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
