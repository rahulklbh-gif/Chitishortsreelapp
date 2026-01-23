import { Heart, MessageCircle, UserPlus, AtSign } from 'lucide-react';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  username: string;
  avatar: string;
  text: string;
  timestamp: string;
  videoThumbnail?: string;
}

export function InboxPage() {
  const notifications: Notification[] = [
    {
      id: '1',
      type: 'like',
      username: 'sarah_creates',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      text: 'liked your video',
      timestamp: '2m ago',
      videoThumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=100',
    },
    {
      id: '2',
      type: 'comment',
      username: 'john_doe',
      avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
      text: 'commented: "Amazing content! 🔥"',
      timestamp: '15m ago',
      videoThumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=100',
    },
    {
      id: '3',
      type: 'follow',
      username: 'dance_mike',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
      text: 'started following you',
      timestamp: '1h ago',
    },
    {
      id: '4',
      type: 'mention',
      username: 'creative_anna',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
      text: 'mentioned you in a comment',
      timestamp: '2h ago',
      videoThumbnail: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=100',
    },
    {
      id: '5',
      type: 'like',
      username: 'fitness_coach',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      text: 'and 47 others liked your video',
      timestamp: '3h ago',
      videoThumbnail: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=100',
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-5 h-5 text-purple-500" />;
      case 'mention':
        return <AtSign className="w-5 h-5 text-pink-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button className="flex-1 py-3 font-semibold border-b-2 border-white">
          All Activity
        </button>
        <button className="flex-1 py-3 font-semibold text-gray-500 border-b-2 border-transparent">
          Messages
        </button>
      </div>

      {/* Notifications List */}
      <div className="divide-y divide-gray-800">
        {notifications.map((notification) => (
          <div key={notification.id} className="p-4 flex items-center gap-3 hover:bg-gray-900/50">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <img
                src={notification.avatar}
                alt={notification.username}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5">
                {getIcon(notification.type)}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{notification.username}</span>{' '}
                <span className="text-gray-400">{notification.text}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{notification.timestamp}</p>
            </div>

            {/* Video Thumbnail */}
            {notification.videoThumbnail && (
              <img
                src={notification.videoThumbnail}
                alt="Video"
                className="w-12 h-16 rounded object-cover flex-shrink-0"
              />
            )}

            {/* Follow Back Button */}
            {notification.type === 'follow' && (
              <button className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold flex-shrink-0">
                Follow
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Empty State for Messages */}
      <div className="p-8 text-center">
        <MessageCircle className="w-16 h-16 mx-auto text-gray-700 mb-3" />
        <h3 className="font-semibold text-lg mb-1">No messages yet</h3>
        <p className="text-gray-500 text-sm">
          Direct messages will appear here when you start chatting
        </p>
      </div>
    </div>
  );
}
