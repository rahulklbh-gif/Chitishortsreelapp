import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search as SearchIcon, Loader2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DiscoverPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const navigate = useNavigate();

  // Shuruat mein trending videos dikhane ke liye
  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('likes_count', { ascending: false })
      .limit(12);
    if (data) setTrendingVideos(data);
    setLoading(false);
  };

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.trim().length === 0) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(`caption.ilike.%${val}%,user_name.ilike.%${val}%`)
        .limit(20);

      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const displayVideos = searchTerm.length > 0 ? results : trendingVideos;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      {/* Header Section */}
      <div className="sticky top-0 z-50 bg-black pt-2 pb-4">
        <h1 className="text-3xl font-black mb-4 italic tracking-tighter">DISCOVER</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search creators, hashtags..."
            className="w-full bg-gray-900 border-none rounded-2xl py-3.5 pl-10 pr-4 focus:ring-2 focus:ring-blue-600 transition-all outline-none text-sm"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid Section */}
      {loading ? (
        <div className="flex justify-center pt-20">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 animate-in fade-in duration-500">
          {displayVideos.map((video) => (
            <div 
              key={video.id}
              onClick={() => navigate(`/video-feed?video=${video.id}`)}
              className="relative aspect-[9/16] bg-gray-900 overflow-hidden active:scale-95 transition-transform duration-200"
            >
              <img 
                src={`https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
                className="w-full h-full object-cover opacity-90"
                alt="thumbnail"
                onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150')}
              />
              <div className="absolute bottom-1.5 left-1.5 flex items-center text-[11px] font-bold drop-shadow-md">
                <Play size={12} className="mr-1 fill-white" />
                {video.likes_count || 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results Fallback */}
      {!loading && searchTerm.length > 0 && results.length === 0 && (
        <div className="text-center pt-20 text-gray-500">
          <p className="font-bold uppercase tracking-widest text-xs">No videos found</p>
        </div>
      )}
    </div>
  );
}
