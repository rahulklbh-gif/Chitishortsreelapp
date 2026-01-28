import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Settings, Grid, Play, Loader2, Check, 
  User, Trash2, Camera, Share2, ArrowLeft 
} from 'lucide-react';
import { toast } from 'sonner';

export function ProfilePage() {
  const { username } = useParams(); 
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');

  const isOwnProfile = !username || (profile && currentUser && profile.id === currentUser.id);

  useEffect(() => {
    loadProfileData();
  }, [username, currentUser]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      let targetProfile;
      if (username) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();
        if (error) throw error;
        targetProfile = data;
      } else if (currentUser) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        if (error) throw error;
        targetProfile = data;
      }

      if (targetProfile) {
        setProfile(targetProfile);
        setNewName(targetProfile.full_name || '');
        const { data: posts } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', targetProfile.id)
          .order('created_at', { ascending: false });
        setUserPosts(posts || []);
      }
    } catch (error: any) {
      console.error("Profile Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.full_name} on Chiti Shorts`,
          text: `Check out this amazing profile!`,
          url: url,
        });
      } catch (err) {
        console.log("Share action cancelled");
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 w-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Navigation Header */}
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          {username && <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />}
          <h1 className="text-lg font-black italic text-blue-400 uppercase tracking-tighter">
            @{profile?.username}
          </h1>
        </div>
        <div className="flex gap-4">
          <button onClick={handleShare} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition">
            <Share2 size={20} />
          </button>
          {isOwnProfile && (
            <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
              <Settings size={20} className={isEditing ? "text-blue-500" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* User Information */}
      <div className="p-6 flex items-center gap-8">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 shadow-xl shadow-blue-500/10">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <User size={40} />
            </div>
          )}
        </div>
        <div className="flex-1 flex justify-around text-center">
          <div>
            <p className="text-xl font-black">{userPosts.length}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Posts</p>
          </div>
          <div>
            <p className="text-xl font-black">{profile?.followers_count || 0}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Followers</p>
          </div>
        </div>
      </div>

      <div className="px-6 mb-6">
        <h2 className="text-lg font-black uppercase italic tracking-tight">
          {profile?.full_name || 'Anonymous User'}
        </h2>
        <p className="text-sm text-gray-400">Content Creator on Chiti Shorts</p>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-3 gap-0.5 px-0.5 border-t border-white/5 pt-2">
        {userPosts.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] bg-gray-900 group">
            <img 
              src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} 
              className="w-full h-full object-cover" 
              alt="thumbnail"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-bold">
              <Play size={10} fill="white" /> {post.views_count || 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
