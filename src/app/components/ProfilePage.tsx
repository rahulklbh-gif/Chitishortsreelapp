import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Settings, Grid, Play, Loader2, Check, 
  User, Camera, ArrowLeft, X, Trash2, Heart
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

  useEffect(() => {
    const handleInitialLoad = async () => {
      await loadProfileAndPosts();
    };
    handleInitialLoad();
  }, [username, currentUser?.id]); 

  const loadProfileAndPosts = async () => {
    setLoading(true);
    try {
      let targetProfile = null;
      
      if (username) {
        // BADLAV: total_likes ko explicit select kiya hai
        const { data, error } = await supabase
          .from('profiles')
          .select('*, total_likes, followers_count')
          .eq('username', username)
          .maybeSingle();
        targetProfile = data;
      } 
      
      if (!targetProfile && currentUser) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, total_likes, followers_count')
          .eq('id', currentUser.id)
          .maybeSingle();
        targetProfile = data;
      }

      if (targetProfile) {
        setProfile(targetProfile);
        setNewName(targetProfile.full_name || '');
        
        const { data: posts } = await supabase
          .from('posts')
          .select('*, views_count, likes_count')
          .eq('user_id', targetProfile.id)
          .order('created_at', { ascending: false });
        
        setUserPosts(posts || []);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Profile Load Error:", error);
      toast.error("Profile load karne mein dikkat hui");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation(); 
    const confirmDelete = window.confirm("Bhai, kya aap sach mein ye video delete karna chahte hain?");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', currentUser?.id);

      if (error) throw error;
      setUserPosts(prev => prev.filter(post => post.id !== postId));
      toast.success("Video delete ho gayi!");
    } catch (error: any) {
      toast.error("Delete nahi ho payi: " + error.message);
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
      setProfile((prev: any) => ({ ...prev, full_name: newName }));
      setIsEditing(false);
      toast.success("Naam save ho gaya!");
    } catch (error: any) {
      toast.error("Save nahi ho paya: " + error.message);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);
      if (updateError) throw updateError;
      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Photo lag gayi!");
    } catch (error: any) {
      toast.error("Upload fail: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-2" size={40} />
        <p className="text-gray-500 text-sm">Chiti Shorts is loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4">
          <User size={40} className="text-gray-600" />
        </div>
        <h1 className="text-2xl font-black mb-2 uppercase">Profile Nahi Mili</h1>
        <button onClick={() => navigate('/')} className="bg-blue-600 w-full max-w-xs py-3 rounded-xl font-black uppercase tracking-wider">
          Wapas Home Jayein
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10 sticky top-0 bg-black z-20">
        <div className="flex items-center gap-4">
          <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />
          <h1 className="text-lg font-black italic text-blue-400 uppercase tracking-tighter">
            @{profile?.username || 'user'}
          </h1>
        </div>
        {profile?.id === currentUser?.id && (
          <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
             {isEditing ? <X className="text-red-500" /> : <Settings size={20} />}
          </button>
        )}
      </div>

      {/* Profile Info */}
      <div className="p-6 flex items-center gap-6">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-600 bg-gray-900">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User size={30} className="text-gray-700" /></div>
            )}
          </div>
          {profile?.id === currentUser?.id && (
            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-blue-600 p-1.5 rounded-full border-2 border-black">
              <Camera size={12} />
            </button>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
        </div>
        
        {/* STATS SECTION: Ab yahan 3 items dikhenge */}
        <div className="flex-1 flex justify-between px-2">
          <div className="flex flex-col items-center">
            <p className="text-lg font-black">{userPosts.length}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Videos</p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-lg font-black">{profile?.followers_count || 0}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Followers</p>
          </div>
          {/* NAYA: LIKES COUNT DISPLAY */}
          <div className="flex flex-col items-center">
            <p className="text-lg font-black text-pink-500">{profile?.total_likes || 0}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Likes</p>
          </div>
        </div>
      </div>

      {/* Name & Bio */}
      <div className="px-6 mb-6">
        {isEditing ? (
          <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-white/10">
            <input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              className="bg-transparent p-2 rounded flex-1 outline-none text-sm"
              placeholder="Apna naam likhein..."
              autoFocus
            />
            <button onClick={handleUpdateProfile} className="bg-blue-600 px-4 rounded-md font-bold text-white">
              <Check size={18} />
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black uppercase italic tracking-tight">
              {profile?.full_name || 'Naya User'}
            </h2>
            <p className="text-xs text-blue-500 font-bold mt-1 uppercase tracking-widest">Creator ⚡</p>
          </>
        )}
      </div>

      {/* Videos Grid */}
      <div className="flex justify-center border-t border-white/10 py-3">
        <Grid size={20} className="text-gray-500" />
      </div>
      
      {userPosts.length > 0 ? (
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {userPosts.map(post => (
            <div key={post.id} className="relative aspect-[9/16] bg-gray-900 overflow-hidden group">
              <img 
                onClick={() => navigate(`/?video=${post.id}`)} 
                src={post.thumbnail_url || `https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} 
                className="w-full h-full object-cover cursor-pointer" 
              />
              {profile?.id === currentUser?.id && (
                <button 
                  onClick={(e) => handleDeletePost(e, post.id)}
                  className="absolute top-1 right-1 p-1.5 bg-red-600 rounded-full z-10"
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-1.5 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-1">
                  <Play size={8} fill="white" className="text-white" />
                  <span className="text-[9px] font-bold text-white">{post.views_count || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart size={8} fill="white" className="text-white" />
                  <span className="text-[9px] font-bold text-white">{post.likes_count || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-gray-600 text-xs font-bold uppercase">Koi video nahi hai</div>
      )}
    </div>
  );
}
