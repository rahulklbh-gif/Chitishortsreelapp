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
      const { data: prof, error } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (prof) {
        setProfile(prof);
        setNewName(prof.full_name || '');
      }
      const { data: posts } = await supabase.from('posts').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
      if (posts) setUserPosts(posts);
    } catch (error) { 
      console.error(error); 
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${new Date().getTime()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Unique URL with timestamp to force browser refresh
      const finalUrl = `${publicUrl}?t=${new Date().getTime()}`;

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', user?.id);
      if (updateError) throw updateError;
      
      setProfile((prev: any) => ({ ...prev, avatar_url: finalUrl }));
      toast.success("Photo Updated Successfully!");
    } catch (error: any) {
      toast.error(error.message || "Upload failed!");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase.from('profiles').update({ full_name: newName }).eq('id', user?.id);
      if (error) throw error;

      setProfile((prev: any) => ({ ...prev, full_name: newName }));
      setIsEditing(false);
      toast.success("Profile Updated!");
    } catch (error: any) {
      toast.error(error.message || "Update failed!");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Bhai, kya aap ye video delete karna chahte hain?")) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user?.id);
      if (error) throw error;
      setUserPosts(userPosts.filter(p => p.id !== postId));
      toast.success("Video deleted!");
    } catch (error: any) { 
      toast.error(error.message || "Delete failed!"); 
    }
  };

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500 w-10" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      {/* Header Section */}
      <div className="p-6 pt-12 border-b border-white/10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-black text-blue-400 tracking-tighter italic">
            @{profile?.username || 'user'}
          </h1>
          <div className="flex gap-4">
             {isEditing && (
               <button 
                 onClick={handleUpdateProfile} 
                 className="p-2 bg-green-600 rounded-full hover:scale-110 transition active:scale-95"
               >
                 <Check size={18} />
               </button>
             )}
             <button 
               onClick={() => setIsEditing(!isEditing)} 
               className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition"
             >
               <Settings size={20} className={isEditing ? "text-blue-500" : ""} />
             </button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="flex items-center gap-8 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  className="w-full h-full object-cover" 
                  key={profile.avatar_url} // Force re-render
                  alt="profile"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <User size={40} className="text-gray-400" />
                </div>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border-2 border-black hover:bg-blue-500 transition shadow-lg"
              disabled={uploading}
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
              className="hidden" 
              accept="image/*" 
            />
          </div>
          
          <div className="flex flex-1 justify-around text-center">
            <div className="cursor-default">
              <p className="font-black text-xl">{userPosts.length}</p>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Posts</p>
            </div>
            <div className="cursor-default">
              <p className="font-black text-xl">{profile?.followers_count || 0}</p>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Followers</p>
            </div>
          </div>
        </div>

        {/* Name/Edit Section */}
        {isEditing ? (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:border-blue-500 outline-none transition-all" 
              placeholder="Enter Full Name"
              autoFocus
            />
          </div>
        ) : (
          <div className="animate-in fade-in">
            <h2 className="font-black text-lg tracking-tight uppercase italic">{profile?.full_name || 'Add Name'}</h2>
            <p className="text-sm text-gray-400 font-medium mt-1">Chiti Shorts Creator 🎥</p>
          </div>
        )}
      </div>

      {/* Posts Grid Header */}
      <div className="flex justify-center py-4 border-b border-white/5">
        <Grid size={24} className="text-blue-500" />
      </div>

      {/* Videos Grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {userPosts.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] bg-gray-900 group overflow-hidden">
            <img 
              src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} 
              className="w-full h-full object-cover transition duration-500 group-hover:scale-110" 
              alt="thumbnail"
            />
            
            {/* Delete Button */}
            <button 
              onClick={() => handleDeletePost(post.id)} 
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
            >
              <Trash2 size={16} />
            </button>

            {/* View Count Overlay */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-black bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Play size={10} fill="white" className="text-white" /> 
              {post.views_count || 0}
            </div>
          </div>
        ))}
      </div>
      
      {userPosts.length === 0 && (
        <div className="py-20 text-center text-gray-600">
          <Play size={40} className="mx-auto mb-4 opacity-20" />
          <p className="font-bold">No Videos Uploaded Yet</p>
        </div>
      )}
    </div>
  );
}
