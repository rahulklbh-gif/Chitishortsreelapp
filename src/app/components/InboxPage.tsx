import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle } from 'lucide-react';

export function InboxPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      markNotificationsAsRead(); // Inbox kholte hi red dot hatane ke liye
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // FIX: Hum 'sender_id' ke zariye profiles table se naam aur avatar la rahe hain
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:sender_id (
            username,
            avatar_url
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
      // Saare unread notifications ko true kar do
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  if (loading) return <div className="flex justify-center p-10 text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-xl font-bold mb-6 italic">INBOX</h1>
      
      {notifications.length === 0 ? (
        <div className="text-center text-gray-500 mt-20">
          <MessageCircle className="mx-auto mb-2 opacity-20" size={50} />
          <p>Abhi tak koi activity nahi hui</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center gap-3 bg-gray-900 p-4 rounded-xl border border-white/5">
              {/* Sender Avatar */}
              <img 
                src={n.sender?.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                className="w-10 h-10 rounded-full border border-gray-700"
              />
              
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-black text-white">@{n.sender?.username || 'User'}</span>
                  <span className="text-gray-300 ml-1">{n.content}</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter font-bold">
                  {n.type} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Red Dot if unread (Optional display) */}
              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
