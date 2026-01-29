import { Search, TrendingUp, Hash, Loader2, Play } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface TrendingItem {
  hashtag: string;
  views: string;
  thumbnail: string;
}

export function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Trending & Mock Data (Aapka purana wala)
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

  // --- SEARCH LOGIC ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        performSearch();
      }
    }, 500); // User ke rukne ka wait karega (Debounce)

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(`caption.ilike.%${searchQuery}%,user_name.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        {/* --- SEARCH RESULTS VIEW --- */}
        {searchQuery ? (
          <section>
            <h2 className="text-xl font-bold mb-4 italic tracking-tight text-purple-400">Search Results</h2>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-purple-500" size={32} />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 animate-in fade-in duration-300">
                {searchResults.map((video) => (
                  <div 
                    key={video.id}
                    onClick={() => navigate(`/video-feed?video=${video.id}`)}
                    className="relative aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden active:scale-95 transition-transform"
                  >
                    <img 
                      src={`https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
                      className="w-full h-full object-cover"
                      alt="thumbnail"
                    />
                    <div className="absolute bottom-1 left-1 flex items-center text-[10px] font-bold bg-black/40 px-1 rounded">
                      <Play size={10} className="mr-0.5 fill-white" />
                      {video.likes_count || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p>No videos found for "{searchQuery}"</p>
              </div>
            )}
          </section>
        ) : (
          /* --- ORIGINAL TRENDING & CREATORS VIEW --- */
          <>
            {/* Trending Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-pink-500" />
                <h2 className="text-xl font-bold">Trending Hashtags</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {trendingHashtags.map((item) => (
                  <div key={item.hashtag} className="relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer" onClick={() => setSearchQuery(item.hashtag)}>
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
          </>
        )}
      </div>
    </div>
  );
}
