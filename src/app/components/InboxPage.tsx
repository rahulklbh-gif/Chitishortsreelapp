import { Heart, MessageCircle, UserPlus, AtSign, PlayCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function InboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          content,
          created_at,
          sender_id,
          post_id,
          posts (youtube_video_id)
        `)
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500 fill-blue-500" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      case 'new_post':
        return <PlayCircle className="w-4 h-4 text-green-500 fill-green-500" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-pink-500" />;
      default:
        return null;
    }
  };

  const getNotificationText = (notif: any) => {
    switch (notif.type) {
      case 'like': return 'liked your video';
      case 'comment': return `commented: "${notif.content || ''}"`;
      case 'follow': return 'started following you';
      case 'new_post': return 'uploaded a new video! Check it out.';
      case 'mention': return 'mentioned you in a comment';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold italic tracking-tighter">INBOX</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button className="flex-1 py-3 font-semibold border-b-2 border-purple-600">
          All Activity
        </button>
        <button className="flex-1 py-3 font-semibold text-gray-500 border-b-2 border-transparent">
          Messages
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      ) : notifications.length > 0 ? (
        <div className="divide-y divide-gray-900">
          {notifications.map((notif) => (
            <div 
              key={notif.id} 
              className="p-4 flex items-center gap-3 hover:bg-gray-900/40 transition cursor-pointer"
              onClick={() => notif.post_id && navigate(`/?video=${notif.post_id}`)}
            >
              {/* Profile Avatar (Mocking avatar for now as sender metadata needs extra join) */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                  User
                </div>
                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-gray-800">
                  {getIcon(notif.type)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-bold">Someone</span>{' '}
                  <span className="text-gray-300">{getNotificationText(notif)}</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 uppercase font-bold tracking-widest">
                  {formatDistanceToNow(new Date(notif.created_at))} ago
                </p>
              </div>

              {/* Video Thumbnail (Asli YouTube Thumbnail) */}
              {notif.posts?.youtube_video_id && (
                <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0 border border-gray-800 bg-gray-900">
                  <img
                    src={`https://img.youtube.com/vi/${notif.posts.youtube_video_id}/default.jpg`}
                    alt="Video"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Follow Back Button */}
              {notif.type === 'follow' && (
                <button className="px-4 py-1.5 bg-blue-600 rounded-full text-xs font-black uppercase flex-shrink-0 active:scale-90 transition">
                  Follow
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center">
          <AtSign className="w-16 h-16 mx-auto text-gray-800 mb-3" />
          <h3 className="font-bold text-lg mb-1">Nothing to see here</h3>
          <p className="text-gray-500 text-sm">
            Notifications about likes, comments, and followers will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
