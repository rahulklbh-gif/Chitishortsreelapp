import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Settings, Grid, Play, Loader2, Check, 
  User, Camera, Share2, ArrowLeft, X 
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if this is the user's own profile
  const isOwnProfile = !username || (profile && currentUser && profile.id === currentUser.id);

  useEffect(() => {
    loadProfileAndPosts();
  }, [username, currentUser]);

  const loadProfileAndPosts = async () => {
    setLoading(true);
    try {
      let targetProfile;
      
      // 1. Fetch Profile Data
      if (username) {
        // Fetch by username (for public view)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();
        if (error) throw error;
        targetProfile = data;
      } else if (currentUser) {
        // Fetch current user profile
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

        // 2. Fetch User Posts for Grid View
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', targetProfile.id)
          .order('created_at', { ascending: false });

        if (postsError) throw postsError;
        setUserPosts(posts || []);
      }
    } catch (error: any) {
      console.error("Error loading profile:", error.message);
      toast.error("Could not load profile");
    } finally {
      setLoading(false);
    }
  };

  // UPDATE PROFILE NAME
  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', currentUser.id);

      if (error) throw error;
      setProfile({ ...profile, full_name: newName });
      setIsEditing(false);
      toast.success("Profile updated!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // UPLOAD PROFILE PHOTO
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update Profile table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success("Photo updated!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // NATIVE SHARE LOGIC
  const handleNativeShare = async () => {
    const shareData = {
      title: `${profile?.full_name}'s Profile`,
      text: `Check out @${profile?.username} on Chiti Shorts!`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link Copied!");
      }
    } catch (err) {
      console.log("Share failed");
    }
  };

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500 w-10" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Top Header */}
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10 sticky top-0 bg-black z-10">
        <div className="flex items-center gap-4">
          <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />
          <h1 className="text-lg font-black italic text-blue-400 uppercase tracking-tighter">
            @{profile?.username || 'user'}
          </h1>
        </div>
        <div className="flex gap-3">
          <button onClick={handleNativeShare} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition">
            <Share2 size={20} />
          </button>
          {isOwnProfile && (
            <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition">
              {isEditing ? <X size={20} className="text-red-500" /> : <Settings size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="p-6">
        <div className="flex items-center gap-8 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 shadow-lg shadow-blue-500/20">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <User size={40} className="text-gray-500" />
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="animate-spin text-white w-6" />
                </div>
              )}
            </div>
            {isOwnProfile && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-blue-600 p-2 rounded-full border-2 border-black shadow-lg"
              >
                <Camera size={14} />
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
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

        {/* Name and Bio */}
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <input 
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter full name"
              className="bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-blue-500 transition font-bold"
            />
            <button 
              onClick={handleUpdateProfile}
              className="bg-blue-600 text-white font-black py-2 rounded-xl flex items-center justify-center gap-2"
            >
              <Check size={18} /> SAVE CHANGES
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <h2 className="text-xl font-black uppercase italic tracking-tighter">
              {profile?.full_name || 'Anonymous User'}
            </h2>
            <p className="text-sm text-gray-400 font-medium">Chiti Shorts Creator 🎥</p>
          </div>
        )}

        {/* Follow Button for others */}
        {!isOwnProfile && (
          <button className="w-full mt-6 bg-blue-600 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95 transition">
            Follow
          </button>
        )}
      </div>

      {/* Grid Tabs */}
      <div className="flex justify-center border-t border-white/10 py-3 mt-4">
        <Grid size={24} className="text-blue-500" />
      </div>

      {/* VIDEO GRID VIEW */}
      <div className="grid grid-cols-3 gap-0.5 px-0.5">
        {userPosts.length > 0 ? (
          userPosts.map((post) => (
            <div 
              key={post.id} 
              className="relative aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer group"
              onClick={() => navigate(`/video/${post.id}`)}
            >
              <img 
                src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} 
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                alt="thumbnail"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-black bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                <Play size={10} fill="white" className="text-white" />
                {post.views_count || 0}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center py-20">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Play size={40} className="opacity-20" />
              <p className="font-bold text-sm uppercase tracking-widest">No videos yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
