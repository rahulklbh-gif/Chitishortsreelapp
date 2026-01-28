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
  const { username } = useParams(); // URL se username pakadne ke liye
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  // States
  const [profile, setProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if this is the user's own profile
  const isOwnProfile = !username || (profile && currentUser && profile.id === currentUser.id);

  useEffect(() => {
    loadProfileData();
  }, [username, currentUser]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      let targetProfile;

      if (username) {
        // Kisi aur ki profile dekh rahe hain
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();
        if (error) throw error;
        targetProfile = data;
      } else if (currentUser) {
        // Apni profile dekh rahe hain
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
        
        // Posts fetch karein
        const { data: posts } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', targetProfile.id)
          .order('created_at', { ascending: false });
        
        setUserPosts(posts || []);
      }
    } catch (error: any) {
      console.error("Error:", error.message);
      toast.error("Profile load nahi ho saki");
    } finally {
      setLoading(false);
    }
  };

  // --- SHARE FUNCTION (As per your request) ---
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.full_name} on Chiti Shorts`,
          text: `Check out this profile!`,
          url: url,
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 w-10" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <p className="mb-4 text-gray-400">Profile nahi mili</p>
        <button onClick={() => navigate('/')} className="text-blue-500 font-bold">Wapas Jayein</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          {username && <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />}
          <h1 className="text-lg font-black tracking-tighter italic text-blue-400">
            @{profile.username}
          </h1>
        </div>
        <div className="flex gap-4">
          <button onClick={handleShare} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
            <Share2 size={20} />
          </button>
          {isOwnProfile && (
            <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
              <Settings size={20} className={isEditing ? "text-blue-500" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Profile Section */}
      <div className="p-6">
        <div className="flex items-center gap-8 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 shadow-lg shadow-blue-500/20">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="profile" />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center"><User size={40} /></div>
              )}
            </div>
            {isOwnProfile && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border-2 border-black"
              >
                <Camera size={12} />
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
          </div>

          <div className="flex-1 flex justify-around text-center">
            <div>
              <p className="text-xl font-black">{userPosts.length}</p>
              <p className="text-[10px] text-gray-500 font-bold">POSTS</p>
            </div>
            <div>
              <p className="text-xl font-black">{profile.followers_count || 0}</p>
              <p className="text-[10px] text-gray-500 font-bold">FOLLOWERS</p>
            </div>
          </div>
        </div>

        {/* Info Section */}
        {isEditing ? (
          <div className="flex gap-2 mb-4">
            <input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 p-2 rounded-lg outline-none focus:border-blue-500"
            />
            <button className="bg-blue-600 p-2 rounded-lg"><Check size={20} /></button>
          </div>
        ) : (
          <div className="mb-4">
            <h2 className="text-lg font-black uppercase italic tracking-tight">
              {profile.full_name || 'Anonymous User'}
            </h2>
            <p className="text-sm text-gray-400">Creator at Chiti Shorts 🎥</p>
          </div>
        )}
      </div>

      {/* Grid Header */}
      <div className="flex justify-center border-t border-white/5 py-3">
        <Grid size={24} className="text-blue-500" />
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-3 gap-0.5 px-0.5">
        {userPosts.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] bg-gray-900 group">
            <img 
              src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} 
              className="w-full h-full object-cover" 
              alt="thumb"
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
