import { Search, TrendingUp, Hash, Loader2, Play, Film, X, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

// ... (TrendingItem interface and mock data remains same)

export function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Search Debounce Logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 500); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    setLoading(true);
    try {
      // Improved query logic
      const searchTerm = searchQuery.trim().replace('#', '');
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(`caption.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(24); // Increased limit for better grid filling

      if (error) throw error;
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
      {/* Search Header */}
      <div className="sticky top-0 bg-black/60 backdrop-blur-xl z-50 p-4 border-b border-white/5">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search creators, trends, videos..."
            className="w-full pl-12 pr-12 py-3.5 bg-gray-900/50 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-8">
        {searchQuery ? (
          <section className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-400">
                Results for <span className="text-white italic">"{searchQuery}"</span>
              </h2>
              <span className="text-xs text-gray-500">{searchResults.length} videos found</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="animate-spin text-purple-500" size={32} />
                <p className="text-gray-500 animate-pulse">Searching the feed...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {searchResults.map((video) => (
                  <div 
                    key={video.id}
                    onClick={() => handleVideoClick(video.id)}
                    className="relative aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer group hover:ring-2 hover:ring-purple-500 transition-all duration-300"
                  >
                    {video.thumbnail_url ? (
                      <img 
                        src={video.thumbnail_url}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <video 
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline 
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                      />
                    )}
                    
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-medium bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                      <Play size={10} className="fill-white text-white" />
                      {video.views_count || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-gray-900/20 rounded-3xl border border-dashed border-gray-800">
                <Film className="mx-auto w-12 h-12 text-gray-700 mb-4" />
                <p className="text-gray-400 font-medium">No results found</p>
                <button onClick={() => setSearchQuery('')} className="text-purple-500 text-sm mt-2 hover:underline">Clear search</button>
              </div>
            )}
          </section>
        ) : (
          /* --- TRENDING SECTION --- */
          <>
            <section>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-pink-500" />
                  <h2 className="text-xl font-bold">Trending Now</h2>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {trendingHashtags.map((item) => (
                  <div 
                    key={item.hashtag} 
                    className="relative rounded-2xl overflow-hidden aspect-[4/5] cursor-pointer group shadow-2xl" 
                    onClick={() => setSearchQuery(item.hashtag)}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.hashtag}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                    <div className="absolute bottom-0 left-0 p-4 w-full">
                      <div className="flex items-center gap-1.5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        <Hash className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-lg">#{item.hashtag}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1">{item.views} views</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* --- CREATORS SECTION --- */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold">Top Creators</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {popularCreators.map((creator) => (
                  <div key={creator.username} className="flex items-center justify-between p-3 bg-gray-900/40 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={creator.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-gray-800" alt="" />
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border-2 border-black">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">@{creator.username}</h3>
                        <p className="text-xs text-gray-500">{creator.followers} followers</p>
                      </div>
                    </div>
                    <button className="px-5 py-1.5 bg-white text-black rounded-full font-bold text-xs hover:bg-gray-200 transition-colors">
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
