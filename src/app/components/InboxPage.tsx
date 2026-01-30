import { Heart, MessageCircle, UserPlus, PlayCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
            console.log("Naya notification aaya!");
            fetchNotifications(); 
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      // Yahan humne Join ko thoda asaan banaya hai taaki profiles ka data pakka aaye
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
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase Query Error:', error.message);
        throw error;
      }

      console.log("Fetched Data:", data); // Check karne ke liye console mein dekhein
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
        <h1 className="text-xl font-black italic uppercase tracking-widest">Inbox</h1>
      </div>

      <div className="divide-y divide-gray-900">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div key={notif.id} className="flex items-center gap-3 p-4 hover:bg-gray-900/50 transition active:bg-gray-800">
              {/* Profile Photo */}
              <div className="relative">
                <img 
                  src={notif.sender?.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                  className="w-12 h-12 rounded-full object-cover border border-gray-700"
                  alt="avatar"
                />
                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1">
                  {notif.type === 'like' && <Heart size={12} className="fill-red-500 text-red-500" />}
                  {notif.type === 'follow' && <UserPlus size={12} className="text-blue-500" />}
                  {notif.type === 'comment' && <MessageCircle size={12} className="text-green-500" />}
                </div>
              </div>
              
              <div className="flex-1">
                <p className="text-sm leading-tight">
                  <span className="font-bold text-gray-100">@{notif.sender?.username || 'user'}</span>{' '}
                  <span className="text-gray-400">
                    {notif.type === 'like' && 'liked your video'}
                    {notif.type === 'follow' && 'started following you'}
                    {notif.type === 'comment' && `commented: ${notif.content}`}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">
                  {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : ''}
                </p>
              </div>

              {/* Video Thumbnail */}
              {notif.post?.youtube_video_id && (
                <div className="w-10 h-14 bg-gray-800 rounded overflow-hidden flex-shrink-0 border border-gray-700">
                  <img 
                    src={`https://img.youtube.com/vi/${notif.post.youtube_video_id}/default.jpg`} 
                    className="w-full h-full object-cover opacity-80" 
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center pt-32 text-gray-600 px-10 text-center">
             <MessageCircle size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
             <p className="text-sm font-medium">No activity yet. Your notifications will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
