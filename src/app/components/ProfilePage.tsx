import { Settings, Grid3x3, Heart, Bookmark, Link as LinkIcon, Download } from 'lucide-react';
import { useState } from 'react';
import { InstallGuide } from './InstallGuide';

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts');
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const profile = {
    username: 'current_user',
    displayName: 'Your Name',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    bio: '🎬 Content Creator | 🎨 Artist | ✨ Living my best life',
    followers: 12500,
    following: 340,
    likes: 45800,
    link: 'yourwebsite.com',
  };

  const userVideos = [
    { id: '1', thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300', likes: '12.5K', views: '45K' },
    { id: '2', thumbnail: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=300', likes: '8.2K', views: '32K' },
    { id: '3', thumbnail: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=300', likes: '15.3K', views: '58K' },
    { id: '4', thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300', likes: '6.7K', views: '28K' },
    { id: '5', thumbnail: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=300', likes: '9.1K', views: '38K' },
    { id: '6', thumbnail: 'https://images.unsplash.com/photo-1611162618479-ee3d24aaef0b?w=300', likes: '11.4K', views: '42K' },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold">@{profile.username}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInstallGuide(true)}
            className="p-2 hover:bg-gray-900 rounded-full"
            title="Install App"
          >
            <Download className="w-6 h-6" />
          </button>
          <button className="p-2 hover:bg-gray-900 rounded-full">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="p-4">
        <div className="flex items-start gap-4 mb-4">
          <img
            src={profile.avatar}
            alt={profile.username}
            className="w-24 h-24 rounded-full object-cover"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{profile.displayName}</h2>
            {profile.link && (
              <a href={`https://${profile.link}`} className="flex items-center gap-1 text-sm text-blue-400 mb-2">
                <LinkIcon className="w-4 h-4" />
                {profile.link}
              </a>
            )}
          </div>
        </div>

        <p className="text-sm mb-4">{profile.bio}</p>

        {/* Stats */}
        <div className="flex gap-6 mb-4">
          <div className="text-center">
            <div className="font-bold text-lg">{formatNumber(profile.following)}</div>
            <div className="text-sm text-gray-400">Following</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{formatNumber(profile.followers)}</div>
            <div className="text-sm text-gray-400">Followers</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{formatNumber(profile.likes)}</div>
            <div className="text-sm text-gray-400">Likes</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold">
            Edit Profile
          </button>
          <button className="flex-1 py-2 bg-gray-900 rounded-lg font-semibold">
            Share Profile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 ${
            activeTab === 'posts' ? 'border-b-2 border-white' : 'text-gray-500'
          }`}
        >
          <Grid3x3 className="w-5 h-5" />
          <span className="font-semibold">Posts</span>
        </button>
        <button
          onClick={() => setActiveTab('likes')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 ${
            activeTab === 'likes' ? 'border-b-2 border-white' : 'text-gray-500'
          }`}
        >
          <Heart className="w-5 h-5" />
          <span className="font-semibold">Liked</span>
        </button>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-3 gap-1 p-1">
        {userVideos.map((video) => (
          <div key={video.id} className="relative aspect-[9/16] bg-gray-900 cursor-pointer group">
            <img
              src={video.thumbnail}
              alt="Video"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition">
              <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-sm font-semibold">
                <Heart className="w-4 h-4 fill-white" />
                {video.likes}
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'likes' && userVideos.length === 0 && (
        <div className="p-8 text-center">
          <Heart className="w-16 h-16 mx-auto text-gray-700 mb-3" />
          <h3 className="font-semibold text-lg mb-1">No liked videos yet</h3>
          <p className="text-gray-500 text-sm">
            Videos you like will appear here
          </p>
        </div>
      )}

      {/* Install Guide Modal */}
      {showInstallGuide && (
        <InstallGuide onClose={() => setShowInstallGuide(false)} />
      )}
    </div>
  );
}