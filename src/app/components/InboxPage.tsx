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
  const [activeTab, setActiveTab] = useState<'all' | 'messages'>('all');

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Is query mein hum 'profiles' table se sender ka naam aur avatar le rahe hain
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          posts (youtube_video_id)
        `)
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800 text-center">
        <h1 className="text-xl font-black tracking-tighter uppercase">Inbox</h1>
      </div>

      {/* Tabs Logic */}
      <div className="flex border-b border-gray-800">
        <button 
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-3 font-bold transition ${activeTab === 'all' ? 'border-b-2 border-white text-white' : 'text-gray-500'}`}
        >
          All Activity
        </button>
        <button 
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-3 font-bold transition ${activeTab === 'messages' ? 'border-b-2 border-white text-white' : 'text-gray-500'}`}
        >
          Messages
        </button>
      </div>

      <div className="p-2">
        {activeTab === 'all' ? (
          loading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-purple-500" /></div>
          ) : notifications.length > 0 ? (
            notifications.map((notif) => (
              <div key={notif.id} className="flex items-center gap-3 p-3 hover:bg-gray-900 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0 border border-gray-700 overflow-hidden">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.sender_id}`} alt="avatar" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-bold">A user</span> {notif.type === 'like' ? 'liked your video' : notif.type === 'comment' ? 'commented on your post' : 'followed you'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(notif.created_at))} ago</p>
                </div>
                {notif.posts?.youtube_video_id && (
                  <img src={`https://img.youtube.com/vi/${notif.posts.youtube_video_id}/default.jpg`} className="w-10 h-14 rounded object-cover" />
                )}
              </div>
            ))
          ) : (
             <div className="text-center py-20 text-gray-500">No activity yet</div>
          )
        ) : (
          /* Messages View */
          <div className="text-center py-20">
            <MessageCircle className="w-16 h-16 mx-auto text-gray-800 mb-4" />
            <h2 className="text-lg font-bold">No Messages</h2>
            <p className="text-gray-500 text-sm px-10">Direct messages between you and your friends will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
