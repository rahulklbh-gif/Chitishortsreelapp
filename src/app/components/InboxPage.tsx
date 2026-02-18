import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

// ✅ ALAG COMPONENT: Ye 100% photo dikhayega kyunki ye direct profiles table se fetch karega
function NotificationAvatar({ userId }: { userId: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    async function getAvatar() {
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();
      if (data?.avatar_url) setImgUrl(data.avatar_url);
    }
    getAvatar();
  }, [userId]);

  return (
    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0">
      {imgUrl ? (
        <img src={imgUrl} className="w-full h-full object-cover" alt="p" />
      ) : (
        <span className="text-white text-xs font-bold">U</span>
      )}
    </div>
  );
}

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      markNotificationsAsRead(); 

      // Real-time listener
      const channel = supabase
        .channel(`inbox_updates_${user.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `receiver_id=eq.${user.id}`,
          }, () => fetchNotifications()
        ).subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Query ko simple rakha hai taaki Follow wale data mein error na aaye
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:sender_id (username),
          post:post_id (youtube_video_id)
        `) 
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationsAsRead = async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', user.id).eq('is_read', false);
    } catch (err) { console.error(err); }
  };

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
              
              {/* ✅ PHOTO FIX: Naya component use kiya hai */}
              <NotificationAvatar userId={n.sender_id} />
              
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-bold text-white">@{n.sender?.username || 'User'}</span>
                  <span className="text-gray-400 ml-1">
                    {n.type === 'follow' ? 'started following you' : n.content}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Video Preview - Only for Likes/Comments */}
              {n.post?.youtube_video_id && (n.type === 'like' || n.type === 'comment') && (
                <div className="w-10 h-14 rounded bg-gray-800 overflow-hidden border border-white/10">
                  <img 
                    src={`https://img.youtube.com/vi/${n.post.youtube_video_id}/mqdefault.jpg`}
                    className="w-full h-full object-cover opacity-70"
                    alt="v"
                  />
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
