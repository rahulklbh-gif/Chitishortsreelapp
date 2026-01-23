import { Search, TrendingUp, Hash } from 'lucide-react';
import { useState } from 'react';

interface TrendingItem {
  hashtag: string;
  views: string;
  thumbnail: string;
}

export function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const trendingHashtags: TrendingItem[] = [
    { hashtag: 'dance', views: '12.5M', thumbnail: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=400' },
    { hashtag: 'comedy', views: '8.2M', thumbnail: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400' },
    { hashtag: 'cooking', views: '6.8M', thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400' },
    { hashtag: 'fitness', views: '5.4M', thumbnail: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400' },
    { hashtag: 'travel', views: '4.9M', thumbnail: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400' },
    { hashtag: 'art', views: '3.7M', thumbnail: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400' },
  ];

  const popularCreators = [
    { username: 'creative_sarah', followers: '1.2M', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    { username: 'dance_mike', followers: '980K', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100' },
    { username: 'chef_anna', followers: '750K', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
    { username: 'fitness_coach', followers: '650K', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos, users, hashtags..."
            className="w-full pl-11 pr-4 py-3 bg-gray-900 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Trending Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-pink-500" />
            <h2 className="text-xl font-bold">Trending Hashtags</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {trendingHashtags.map((item) => (
              <div key={item.hashtag} className="relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer">
                <img
                  src={item.thumbnail}
                  alt={item.hashtag}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Hash className="w-4 h-4" />
                    <span className="font-bold text-lg">{item.hashtag}</span>
                  </div>
                  <span className="text-sm text-gray-300">{item.views} views</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Popular Creators */}
        <section>
          <h2 className="text-xl font-bold mb-4">Popular Creators</h2>
          <div className="space-y-3">
            {popularCreators.map((creator) => (
              <div key={creator.username} className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl">
                <img
                  src={creator.avatar}
                  alt={creator.username}
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-semibold">@{creator.username}</h3>
                  <p className="text-sm text-gray-400">{creator.followers} followers</p>
                </div>
                <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold text-sm">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Searches */}
        {searchQuery && (
          <section>
            <h2 className="text-xl font-bold mb-4">Search Results</h2>
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Search for "{searchQuery}"</p>
              <p className="text-sm mt-1">Feature coming soon with backend integration</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
