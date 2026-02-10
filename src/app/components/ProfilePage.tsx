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
  // Username edit ke liye naya state
  const [newUsername, setNewUsername] = useState(''); 
  const [isUploading, setIsUploading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
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
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);

        if (isUUID) {
          // Following_count ko bhi select kiya gaya hai
          const { data: byId } = await supabase
            .from('profiles')
            .select('*, total_likes, followers_count, following_count') 
            .eq('id', username) 
            .maybeSingle();
          targetProfile = byId;
        }

        if (!targetProfile) {
          const { data: byUsername } = await supabase
            .from('profiles')
            .select('*, total_likes, followers_count, following_count')
            .eq('username', username)
            .maybeSingle();
          targetProfile = byUsername;
        }

        if (!targetProfile) {
          const { data: fallbackData } = await supabase
            .from('posts')
            .select('user_id, user_name, user_avatar')
            .or(`user_id.eq.${username},user_name.eq.${username}`)
            .limit(1)
            .maybeSingle();

          if (fallbackData) {
            targetProfile = {
              id: fallbackData.user_id,
              username: fallbackData.user_name || 'user',
              full_name: fallbackData.user_name || 'Naya User',
              avatar_url: fallbackData.user_avatar,
              followers_count: 0,
              following_count: 0,
              total_likes: 0
            };
          }
        }
      } 
      
      if (!targetProfile && currentUser && !username) {
        const { data } = await supabase
          .from('profiles')
          .select('*, total_likes, followers_count, following_count')
          .eq('id', currentUser.id)
          .maybeSingle();
        targetProfile = data;
      }

      if (targetProfile) {
        setProfile(targetProfile);
        setNewName(targetProfile.full_name || '');
        setNewUsername(targetProfile.username || ''); // Username state update
        
        if (currentUser && currentUser.id !== targetProfile.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', currentUser.id)
            .eq('following_id', targetProfile.id)
            .maybeSingle();
          setIsFollowing(!!followData);
        }

        const { data: posts } = await supabase
          .from('posts')
          .select('*, views_count, likes_count')
          .eq('user_id', targetProfile.id)
          .order('created_at', { ascending: false });
        
        setUserPosts(posts || []);

        if (posts) {
          const totalLikes = posts.reduce((acc, curr) => acc + (curr.likes_count || 0), 0);
          setProfile((prev: any) => ({ ...prev, total_likes: totalLikes }));
        }

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

  const handleFollow = async () => {
    if (!currentUser || !profile) return toast.error("Login zaroori hai");
    if (isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id);
        setIsFollowing(false);
        setProfile((prev: any) => ({ ...prev, followers_count: Math.max(0, (prev.followers_count || 0) - 1) }));
      } else {
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: profile.id }]);
        await supabase.rpc('increment_followers', { user_id: profile.id });
        setIsFollowing(true);
        setProfile((prev: any) => ({ ...prev, followers_count: (prev.followers_count || 0) + 1 }));
        
        await supabase.from('notifications').insert([{
          type: 'follow',
          sender_id: currentUser.id,
          sender_name: currentUser.user_metadata.username || currentUser.email?.split('@')[0] || "Someone",
          receiver_id: profile.id,
          content: 'started following you'
        }]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Process fail ho gaya");
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation(); 
    const confirmDelete = window.confirm("Bhai, kya aap sach mein ye video delete karna chahte hain?");
    if (!confirmDelete) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', currentUser?.id);
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
      // Username aur Name dono update honge
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: newName,
          username: newUsername.toLowerCase().trim().replace(/\s+/g, '_') 
        })
        .eq('id', currentUser.id);

      if (error) {
        if (error.code === '23505') throw new Error("Ye username pehle se kisi ne le rakha hai!");
        throw error;
      }

      setProfile((prev: any) => ({ ...prev, full_name: newName, username: newUsername }));
      setIsEditing(false);
      toast.success("Profile update ho gayi!");
      
      // Agar username badla hai toh URL update karne ke liye navigate karein
      if (newUsername !== profile.username) {
        navigate(`/profile/${newUsername}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
      if (updateError) throw updateError;
      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Photo lag gayi!");
    } catch (error: any) {
      toast.error("Upload fail: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-blue-500 mb-2" size={40} />
      <p className="text-gray-500 text-sm">Chiti Shorts is loading...</p>
    </div>
  );

  if (!profile) return (
    <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4"><User size={40} className="text-gray-600" /></div>
      <h1 className="text-2xl font-black mb-2 uppercase">Profile Nahi Mili</h1>
      <p className="text-gray-500 mb-6 text-sm">Ye user abhi tak register nahi hua hai ya system mein entry nahi hai.</p>
      <button onClick={() => navigate('/')} className="bg-blue-600 w-full max-w-xs py-3 rounded-xl font-black uppercase tracking-wider">Wapas Home Jayein</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10 sticky top-0 bg-black z-20">
        <div className="flex items-center gap-4">
          <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />
          <h1 className="text-lg font-black italic text-blue-400 uppercase tracking-tighter">@{profile?.username || 'user'}</h1>
        </div>
        {profile?.id === currentUser?.id && (
          <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
             {isEditing ? <X className="text-red-500" /> : <Settings size={20} />}
          </button>
        )}
      </div>

      <div className="p-6 flex items-center gap-6">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-600 bg-gray-900">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User size={30} className="text-gray-700" /></div>}
          </div>
          {profile?.id === currentUser?.id && (
            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-blue-600 p-1.5 rounded-full border-2 border-black">
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
        </div>
        
        <div className="flex-1 flex justify-between px-2">
          <div className="flex flex-col items-center">
            <p className="text-lg font-black">{userPosts.length}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Videos</p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-lg font-black">{profile?.followers_count || 0}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Followers</p>
          </div>
          {/* Following Count Logic Added */}
          <div className="flex flex-col items-center">
            <p className="text-lg font-black">{profile?.following_count || 0}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Following</p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-lg font-black text-pink-500">{profile?.total_likes || 0}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Likes</p>
          </div>
        </div>
      </div>

      <div className="px-6 mb-4">
        {profile?.id !== currentUser?.id ? (
          <button 
            onClick={handleFollow}
            disabled={isFollowLoading}
            className={`w-full py-2 rounded-lg font-black uppercase tracking-widest text-xs transition-all ${
              isFollowing ? 'bg-white/10 text-white' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
            }`}
          >
            {isFollowLoading ? 'Wait...' : isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        ) : (
          <button onClick={() => setIsEditing(!isEditing)} className="w-full py-2 bg-white/5 border border-white/10 rounded-lg font-black uppercase tracking-widest text-xs">
            Edit Profile
          </button>
        )}
      </div>

      <div className="px-6 mb-6">
        {isEditing ? (
          <div className="space-y-3">
            {/* Username Edit Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Username</label>
              <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-white/10">
                <span className="p-2 text-gray-500 text-sm">@</span>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} className="bg-transparent py-2 rounded flex-1 outline-none text-sm" placeholder="username" />
              </div>
            </div>
            {/* Name Edit Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Full Name</label>
              <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-white/10">
                <input value={newName} onChange={e => setNewName(e.target.value)} className="bg-transparent p-2 rounded flex-1 outline-none text-sm" placeholder="Apna naam likhein..." />
                <button onClick={handleUpdateProfile} className="bg-blue-600 px-4 rounded-md font-bold text-white"><Check size={18} /></button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black uppercase italic tracking-tight">{profile?.full_name || 'Naya User'}</h2>
            <p className="text-xs text-blue-500 font-bold mt-1 uppercase tracking-widest">Creator ⚡</p>
          </>
        )}
      </div>

      <div className="flex justify-center border-t border-white/10 py-3"><Grid size={20} className="text-gray-500" /></div>
      
      {userPosts.length > 0 ? (
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {userPosts.map(post => (
            <div key={post.id} className="relative aspect-[9/16] bg-gray-900 overflow-hidden group">
              {/* Thumbnail Logic: Agar thumbnail_url nahi hai toh youtube_video_id use karega */}
              <img 
                onClick={() => navigate(`/?video=${post.id}`)} 
                src={post.thumbnail_url || `https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`} 
                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500" 
                onError={(e: any) => {
                  e.target.src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500'; // Fallback if YouTube thumb fails
                }}
              />
              {profile?.id === currentUser?.id && (
                <button onClick={(e) => handleDeletePost(e, post.id)} className="absolute top-1 right-1 p-1.5 bg-red-600 rounded-full z-10 active:scale-90"><Trash2 size={12} className="text-white" /></button>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-1.5 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                <div className="flex items-center gap-1"><Play size={8} fill="white" className="text-white" /><span className="text-[9px] font-bold text-white">{post.views_count || 0}</span></div>
                <div className="flex items-center gap-1"><Heart size={8} fill="white" className="text-white" /><span className="text-[9px] font-bold text-white">{post.likes_count || 0}</span></div>
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
