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

  // Profile refresh par data na khone ke liye primary logic
  useEffect(() => {
    loadProfileAndPosts();
  }, [username, currentUser?.id]); // id par depend rakha hai refresh handle karne ke liye

  const loadProfileAndPosts = async () => {
    setLoading(true);
    try {
      let targetProfile;
      
      if (username) {
        // Kisi aur ki profile ya username link se access
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle(); // error ki jagah null dega agar nahi mila
        targetProfile = data;
      } else if (currentUser) {
        // Khud ki profile (Refresh case)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        targetProfile = data;
      }

      if (targetProfile) {
        setProfile(targetProfile);
        setNewName(targetProfile.full_name || '');
        
        // Videos load karein
        const { data: posts } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', targetProfile.id)
          .order('created_at', { ascending: false });
        
        setUserPosts(posts || []);
      }
    } catch (error) {
      console.error("Profile Load Error:", error);
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
      
      // Update state immediately
      setProfile(prev => ({ ...prev, full_name: newName }));
      setIsEditing(false);
      toast.success("Profile saved!");
    } catch (error: any) {
      toast.error("Failed to save name");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      
      // Upload to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Save to database permanently
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;
      
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Photo updated!");
    } catch (error: any) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  // Agar profile nahi mili (404 condition handle karne ke liye)
  if (!profile && !loading) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-black mb-4">404</h1>
        <p className="text-gray-400 mb-6">User not found or you're not logged in.</p>
        <button onClick={() => navigate('/')} className="bg-blue-600 px-6 py-2 rounded-full font-bold">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* ... (Baki UI code wahi rahega jo pehle tha) ... */}
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10 sticky top-0 bg-black z-10">
        <div className="flex items-center gap-4">
          <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />
          <h1 className="text-lg font-black italic text-blue-400 uppercase tracking-tighter">@{profile?.username}</h1>
        </div>
        <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
           {isEditing ? <X className="text-red-500" /> : <Settings />}
        </button>
      </div>

      <div className="p-6 flex items-center gap-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center"><User size={40} /></div>
            )}
          </div>
          {profile?.id === currentUser?.id && (
            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-blue-600 p-2 rounded-full border-2 border-black">
              <Camera size={14} />
            </button>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
        </div>
        <div className="flex-1 flex justify-around text-center">
          <div><p className="text-xl font-black">{userPosts.length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Posts</p></div>
          <div><p className="text-xl font-black">{profile?.followers_count || 0}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Followers</p></div>
        </div>
      </div>

      <div className="px-6 mb-6">
        {isEditing ? (
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} className="bg-white/10 p-2 rounded flex-1 outline-none border border-white/20 focus:border-blue-500" />
            <button onClick={handleUpdateProfile} className="bg-blue-600 px-4 rounded font-bold"><Check size={20} /></button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black uppercase italic">{profile?.full_name || 'Anonymous User'}</h2>
            <p className="text-sm text-gray-400 font-medium">Chiti Shorts Creator 🎥</p>
          </>
        )}
      </div>

      <div className="flex justify-center border-t border-white/10 py-3"><Grid size={24} className="text-blue-500" /></div>
      <div className="grid grid-cols-3 gap-0.5 px-0.5">
        {userPosts.map(post => (
          <div key={post.id} onClick={() => navigate(`/video/${post.id}`)} className="relative aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer">
            <img src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
