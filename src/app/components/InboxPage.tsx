import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

// ✅ ALAG COMPONENT: Jo har halat mein photo aur username layega
function NotificationUser({ userId, type, content }: { userId: string, type: string, content: string }) {
  const [profile, setProfile] = useState<{username: string, avatar_url: string} | null>(null);

  useEffect(() => {
    async function getSenderData() {
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();
      if (data) setProfile(data);
    }
    getSenderData();
  }, [userId]);

  return (
    <>
      {/* Photo Section */}
      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} className="w-full h-full object-cover" alt="p" />
        ) : (
          <span className="text-white text-xs font-bold">{profile?.username?.[0] || 'U'}</span>
        )}
      </div>

      {/* Text Section */}
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-bold text-white">@{profile?.username || 'Loading...'}</span>
          <span className="text-gray-400 ml-1">
            {type === 'follow' ? 'started following you' : content}
          </span>
        </p>
      </div>
    </>
  );
}

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // ✅ SIMPLE QUERY: Bina join ke taaki koi data miss na ho
      const { data, error } = await supabase
        .from('notifications')
        .select('*') 
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Video details ke liye alag se fetch (Aapka original logic)
      const notificationsWithPosts = await Promise.all((data || []).map(async (n) => {
        if (n.post_id) {
          const { data: postData } = await supabase
            .from('posts')
            .select('youtube_video_id')
            .eq('id', n.post_id)
            .single();
          return { ...n, post: postData };
        }
        return n;
      }));

      setNotifications(notificationsWithPosts);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      const channel = supabase
        .channel(`inbox_realtime_${user.id}`)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'notifications',
            filter: `receiver_id=eq.${user.id}`,
          }, () => fetchNotifications()
        ).subscribe();

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
              
              {/* ✅ PHOTO & USERNAME FIX: Component handle karega direct ID se */}
              <NotificationUser userId={n.sender_id} type={n.type} content={n.content} />
              
              <div className="flex flex-col items-end gap-2">
                <p className="text-[10px] text-gray-500 font-medium uppercase">
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>

                {/* Video Preview */}
                {n.post?.youtube_video_id && (n.type === 'like' || n.type === 'comment') && (
                  <div className="w-10 h-12 rounded bg-gray-800 overflow-hidden border border-white/10">
                    <img 
                      src={`https://img.youtube.com/vi/${n.post.youtube_video_id}/mqdefault.jpg`}
                      className="w-full h-full object-cover"
                      alt="v"
                    />
                  </div>
                )}
              </div>

              {!n.is_read && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
