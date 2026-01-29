import { Heart, MessageCircle, UserPlus, PlayCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Fetch + Real-time Subscription
  useEffect(() => {
    if (user) {
      fetchNotifications();

      // REAL-TIME: Database mein naya row aate hi screen update hogi
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `receiver_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications(); // Naya data aate hi fetch call
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!sender_id (
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
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-black text-white">
      <Loader2 className="animate-spin text-purple-500" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800">
        <h1 className="text-xl font-black italic">INBOX</h1>
      </div>

      <div className="divide-y divide-gray-900">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div key={notif.id} className="flex items-center gap-3 p-4 hover:bg-gray-900 transition active:bg-gray-800">
              {/* Profile Photo - Ab asli dikhegi */}
              <img 
                src={notif.sender?.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                className="w-12 h-12 rounded-full object-cover border border-gray-700"
              />
              
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-bold">@{notif.sender?.username || 'user'}</span>{' '}
                  <span className="text-gray-300">
                    {notif.type === 'like' && 'liked your video'}
                    {notif.type === 'follow' && 'started following you'}
                    {notif.type === 'comment' && `commented: ${notif.content}`}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-tighter">
                  {formatDistanceToNow(new Date(notif.created_at))} ago
                </p>
              </div>

              {/* Video Thumbnail - Asli YouTube image */}
              {notif.post?.youtube_video_id && (
                <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0 border border-gray-700">
                  <img 
                    src={`https://img.youtube.com/vi/${notif.post.youtube_video_id}/default.jpg`} 
                    className="w-full h-full object-cover" 
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center pt-20 text-gray-600">
             <MessageCircle size={60} strokeWidth={1} />
             <p className="mt-4 font-bold">No activity yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
