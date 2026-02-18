import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function InboxPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!currentUser) return;
    try {
      // Step 1: Pehle notifications le kar aao
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Step 2: Data Enrichment (Aapke Profile Page wale logic se)
      const enriched = await Promise.all((notifs || []).map(async (n) => {
        // Notification ki sender_id se profiles table match karna
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url, full_name')
          .eq('id', n.sender_id)
          .maybeSingle();

        // Agar post_id hai toh video_url fetch karna (R2 ke liye)
        let postData = null;
        if (n.post_id) {
          const { data: post } = await supabase
            .from('posts')
            .select('video_url')
            .eq('id', n.post_id)
            .maybeSingle();
          postData = post;
        }

        return {
          ...n,
          sender: profile,
          post: postData
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
    if (currentUser) {
      fetchNotifications();
      
      // Real-time listener: Naye notifications ke liye
      const channel = supabase
        .channel(`inbox_realtime_${currentUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `receiver_id=eq.${currentUser.id}`,
        }, () => fetchNotifications())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser]);

  if (loading && notifications.length === 0) return (
    <div className="flex justify-center items-center h-screen bg-black">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <h1 className="text-xl font-black italic tracking-widest uppercase mb-6 text-blue-400">Inbox</h1>
      
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-32 text-gray-700">
          <MessageCircle size={60} className="mb-4 opacity-10" />
          <p className="text-sm font-bold uppercase tracking-widest">No Activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div 
              key={n.id} 
              onClick={() => n.post_id && navigate(`/?video=${n.post_id}`)}
              className="flex items-center gap-3 bg-[#111111] p-3 rounded-2xl border border-white/5 active:scale-95 transition-transform"
            >
              {/* Profile Photo - Profile Page logic se */}
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${n.sender?.username || n.sender_id}`);
                }}
                className="w-12 h-12 rounded-full overflow-hidden border border-blue-600/30 bg-gray-900 shrink-0 cursor-pointer"
              >
                {n.sender?.avatar_url ? (
                  <img 
                    src={n.sender.avatar_url} 
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                    onError={(e) => { e.currentTarget.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><User size={20} /></div>
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight">
                  <span className="font-black text-white">@{n.sender?.username || 'user'}</span>
                  <span className="text-gray-400 ml-1">
                    {n.type === 'follow' ? 'started following you' : n.content}
                  </span>
                </p>
                <p className="text-[10px] text-gray-600 mt-1 font-bold uppercase">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* R2 Video Preview - Profile Page logic se */}
              {n.post?.video_url && (n.type === 'like' || n.type === 'comment') && (
                <div className="w-10 h-14 rounded-lg overflow-hidden border border-white/10 bg-black shrink-0">
                  <video 
                    src={`${n.post.video_url}#t=0.5`}
                    className="w-full h-full object-cover opacity-50"
                    muted
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                  />
                </div>
              )}

              {/* Unread Dot */}
              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
