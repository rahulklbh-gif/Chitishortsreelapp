import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Settings, Grid, Play, Loader2, Check, 
  User, Camera, ArrowLeft, X 
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

  const isOwnProfile = !username || (profile && currentUser && profile.id === currentUser.id);

  useEffect(() => {
    loadProfileAndPosts();
  }, [username, currentUser]);

  const loadProfileAndPosts = async () => {
    setLoading(true);
    try {
      let targetProfile;
      // Get Profile from Supabase
      if (username) {
        const { data } = await supabase.from('profiles').select('*').eq('username', username).single();
        targetProfile = data;
      } else if (currentUser) {
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        targetProfile = data;
      }

      if (targetProfile) {
        setProfile(targetProfile);
        setNewName(targetProfile.full_name || '');
        // Get Posts
        const { data: posts } = await supabase.from('posts').select('*').eq('user_id', targetProfile.id).order('created_at', { ascending: false });
        setUserPosts(posts || []);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || !profile) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', currentUser.id);

      if (error) throw error;
      
      // Update local state so it stays after refresh
      setProfile({ ...profile, full_name: newName });
      setIsEditing(false);
      toast.success("Name saved to database!");
    } catch (error: any) {
      toast.error("Failed to save name");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    try {
      const fileName = `${currentUser.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success("Photo saved!");
    } catch (error: any) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10 sticky top-0 bg-black z-10">
        <div className="flex items-center gap-4">
          <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />
          <h1 className="text-lg font-black italic text-blue-400 uppercase">@{profile?.username || 'USER'}</h1>
        </div>
        {isOwnProfile && (
          <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
            {isEditing ? <X size={20} className="text-red-500" /> : <Settings size={20} />}
          </button>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-center gap-8 mb-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center"><User size={40} /></div>
              )}
              {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
            </div>
            {isOwnProfile && (
              <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-blue-600 p-2 rounded-full border-2 border-black">
                <Camera size={14} />
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </div>
          <div className="flex-1 flex justify-around text-center">
            <div><p className="text-xl font-black">{userPosts.length}</p><p className="text-[10px] text-gray-500 uppercase font-bold">Posts</p></div>
            <div><p className="text-xl font-black">{profile?.followers_count || 0}</p><p className="text-[10px] text-gray-500 uppercase font-bold">Followers</p></div>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-blue-500 font-bold"
              placeholder="Full Name"
            />
            <button onClick={handleUpdateProfile} className="w-full bg-blue-600 py-2 rounded-xl font-black flex items-center justify-center gap-2">
              <Check size={18} /> SAVE PROFILE
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">{profile?.full_name || 'ANONYMOUS USER'}</h2>
            <p className="text-sm text-gray-400">Chiti Shorts Creator 🎥</p>
          </div>
        )}
      </div>

      <div className="flex justify-center border-t border-white/10 py-3 mt-4"><Grid size={24} className="text-blue-500" /></div>

      <div className="grid grid-cols-3 gap-0.5 px-0.5">
        {userPosts.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer" onClick={() => navigate(`/video/${post.id}`)}>
            <img src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} className="w-full h-full object-cover" />
            <div className="absolute bottom-1 left-1 flex items-center gap-1 text-[10px] font-bold bg-black/50 px-1 rounded"><Play size={10} fill="white" />{post.views_count || 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
