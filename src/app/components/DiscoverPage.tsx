import { Search, TrendingUp, Hash, Loader2, Play, Film, X, UserPlus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
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
  const [userResults, setUserResults] = useState<any[]>([]); // 🔥 Naya state users ke liye
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Trending & Mock Data
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
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setSearchResults([]);
        setUserResults([]); // Reset users
      }
    }, 500); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    setLoading(true);
    try {
      // 1. Search Users (from profiles table)
      const { data: userData } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery}%`)
        .limit(5);

      // 2. Search Videos (from posts table)
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(`caption.ilike.%${searchQuery}%,user_name.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(21);

      if (error) throw error;
      
      setUserResults(userData || []);
      setSearchResults(data || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoClick = (videoId: string) => {
    navigate(`/?video=${videoId}`);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-lg z-10 p-4 border-b border-gray-800">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos, users, hashtags..."
              className="w-full pl-11 pr-10 py-3 bg-gray-900 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* --- SEARCH RESULTS VIEW --- */}
        {searchQuery ? (
          <section>
            <h2 className="text-xl font-bold mb-4 italic tracking-tight text-purple-400">Search Results</h2>
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-purple-500" size={40} />
              </div>
            ) : (
              <>
                {/* 🔥 NEW: USERS SECTION IN SEARCH */}
                {userResults.length > 0 && (
                  <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Profiles</p>
                    {userResults.map((user) => (
                      <div 
                        key={user.id} 
                        onClick={() => navigate(`/profile/${user.username}`)}
                        className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-2xl border border-white/5 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <img 
                          src={user.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
                          className="w-12 h-12 rounded-full object-cover border border-purple-500/20"
                          crossOrigin="anonymous"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-sm text-white">@{user.username}</h3>
                          <p className="text-xs text-gray-500">{user.full_name || 'Creator'}</p>
                        </div>
                        <button className="p-2 bg-white/10 hover:bg-purple-600 rounded-full transition-colors text-purple-400 hover:text-white">
                          <UserPlus size={18} />
                        </button>
                      </div>
                    ))}
                    <div className="h-px bg-gray-800/50 my-4 mx-2" />
                  </div>
                )}

                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {searchResults.map((video) => (
                      <div 
                        key={video.id}
                        onClick={() => handleVideoClick(video.id)}
                        className="relative aspect-[9/16] bg-gray-900 rounded-md overflow-hidden active:scale-95 transition-transform cursor-pointer border border-white/5 group"
                      >
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            alt={video.caption || "video thumbnail"}
                            loading="lazy"
                            crossOrigin="anonymous" 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'https://placehold.co/400x600/1a1a1a/purple?text=Video';
                            }}
                          />
                        ) : (
                          <video 
                            src={video.video_url}
                            className="w-full h-full object-cover pointer-events-none"
                            muted
                            preload="metadata"
                            playsInline 
                            crossOrigin="anonymous" 
                          />
                        )}
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
                        <div className="absolute bottom-1.5 left-1.5 flex items-center text-[10px] font-bold bg-black/60 backdrop-blur-md px-2 py-1 rounded-full shadow-lg border border-white/10 z-10">
                          <Play size={10} className="mr-1 fill-white text-white" />
                          {video.views_count >= 1000 
                            ? `${(video.views_count / 1000).toFixed(1)}K` 
                            : video.views_count || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : userResults.length === 0 && (
                  <div className="text-center py-20 bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
                    <Search className="mx-auto w-12 h-12 text-gray-700 mb-4" />
                    <p className="text-lg font-medium text-gray-400">No results found</p>
                    <p className="text-sm text-gray-600 mt-1">Try searching for a name or video caption</p>
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          /* --- ORIGINAL TRENDING & CREATORS VIEW --- */
          <>
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-pink-500" />
                <h2 className="text-xl font-bold tracking-tight">Trending Hashtags</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {trendingHashtags.map((item) => (
                  <div 
                    key={item.hashtag} 
                    className="relative rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer group border border-white/5" 
                    onClick={() => setSearchQuery(item.hashtag)}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.hashtag}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      crossOrigin="anonymous"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Hash className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-lg">{item.hashtag}</span>
                      </div>
                      <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">{item.views} views</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pb-4">
              <h2 className="text-xl font-bold mb-4 tracking-tight">Popular Creators</h2>
              <div className="space-y-3">
                {popularCreators.map((creator) => (
                  <div key={creator.username} className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-2xl border border-white/5 hover:bg-gray-900 transition-colors">
                    <img
                      src={creator.avatar}
                      alt={creator.username}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500/20"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-100 italic">@{creator.username}</h3>
                      <p className="text-xs text-gray-500 font-medium">{creator.followers} followers</p>
                    </div>
                    <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-sm active:scale-95 transition-all shadow-lg shadow-purple-500/20">
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
