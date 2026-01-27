import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Settings, Grid, Play, Loader2, Check, User, Trash2, Camera } from 'lucide-react';
import { toast } from 'sonner';

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchProfileAndPosts();
  }, [user]);

  const fetchProfileAndPosts = async () => {
    setLoading(true);
    try {
      // 1. Profile Data fetch karein
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (prof) {
        setProfile(prof);
        setNewName(prof.full_name || '');
      }
      // 2. Sirf login user ki videos fetch karein
      const { data: posts } = await supabase.from('posts').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
      if (posts) setUserPosts(posts);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`; // bucket path

      // Uploading to Supabase bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Database mein link save karein
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id);
      if (updateError) throw updateError;
      
      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success("Profile photo updated!");
    } catch (error) {
      console.error(error);
      toast.error("Upload failed! Check if bucket 'avatars' is Public.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const confirmDelete = window.confirm("Bhai, kya sach mein ye video delete karni hai?");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user?.id);
      if (error) throw error;
      setUserPosts(userPosts.filter(p => p.id !== postId));
      toast.success("Reel deleted successfully!");
    } catch (error) {
      toast.error("Delete failed!");
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await supabase.from('profiles').update({ full_name: newName }).eq('id', user?.id);
      setIsEditing(false);
      toast.success("Name updated!");
      fetchProfileAndPosts();
    } catch (error) { toast.error("Failed to update name"); }
  };

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="p-6 pt-12 border-b border-white/10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-blue-400">@{profile?.username || 'user'}</h1>
          <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
            {isEditing ? <Check className="text-green-500" onClick={handleUpdateProfile}/> : <Settings size={22} />}
          </button>
        </div>

        <div className="flex items-center gap-8 mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-600 p-0.5">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="profile" />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center rounded-full"><User size={40} /></div>
              )}
            </div>
            {/* Gallery Upload Button */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border-2 border-black hover:scale-110 transition shadow-lg"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
          </div>
          
          <div className="flex flex-1 justify-around">
            <div className="text-center">
              <p className="font-black text-lg">{userPosts.length}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Posts</p>
            </div>
            <div className="text-center">
              <p className="font-black text-lg">{profile?.followers_count || 0}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Followers</p>
            </div>
          </div>
        </div>

        {isEditing ? (
          <div className="animate-in fade-in slide-in-from-top-2">
            <input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:border-blue-500 outline-none text-sm mb-2" 
              placeholder="Enter your name"
            />
            <button onClick={handleUpdateProfile} className="w-full bg-blue-600 py-2.5 rounded-xl font-bold text-sm">Save Name</button>
          </div>
        ) : (
          <div className="space-y-1">
            <h2 className="font-extrabold text-lg">{profile?.full_name || 'Anonymous User'}</h2>
            <p className="text-sm text-gray-400 font-medium">Chiti Shorts Creator 🎬</p>
          </div>
        )}
      </div>

      {/* Grid Tabs */}
      <div className="flex justify-center py-4 border-b border-white/5">
        <Grid className="text-blue-500" size={24} />
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-3 gap-0.5 mt-0.5">
        {userPosts.length > 0 ? (
          userPosts.map((post) => (
            <div key={post.id} className="relative aspect-[9/16] bg-gray-900 group overflow-hidden">
              <img 
                src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} 
                className="w-full h-full object-cover opacity-90 transition group-hover:scale-110" 
                alt="thumbnail"
              />
              
              {/* Delete Button (Trash Icon) */}
              <button 
                onClick={() => handleDeletePost(post.id)}
                className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition shadow-lg"
              >
                <Trash2 size={16} />
              </button>

              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white drop-shadow-md">
                <Play size={10} fill="white" className="text-white" />
                <span className="text-[10px] font-black">{post.views_count || 0}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center py-20 opacity-30">
            <p className="text-sm">Abhi tak koi video nahi hai!</p>
          </div>
        )}
      </div>
    </div>
  );
}
