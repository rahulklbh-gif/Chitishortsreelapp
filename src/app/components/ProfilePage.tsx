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
  const [newUsername, setNewUsername] = useState(''); 
  const [isUploading, setIsUploading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfileAndPosts();
  }, [username, currentUser?.id]); 

  const loadProfileAndPosts = async () => {
    setLoading(true);
    try {
      let targetProfile = null;
      if (username) {
        // Check if username is UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
        if (isUUID) {
          const { data } = await supabase.from('profiles').select('*, followers_count, following_count').eq('id', username).maybeSingle();
          targetProfile = data;
        }
        if (!targetProfile) {
          const { data } = await supabase.from('profiles').select('*, followers_count, following_count').eq('username', username).maybeSingle();
          targetProfile = data;
        }
      } 
      
      if (!targetProfile && currentUser && !username) {
        const { data } = await supabase.from('profiles').select('*, followers_count, following_count').eq('id', currentUser.id).maybeSingle();
        targetProfile = data;
      }

      if (targetProfile) {
        setProfile(targetProfile);
        setNewName(targetProfile.full_name || '');
        setNewUsername(targetProfile.username || '');
        
        // Follow Status Check
        if (currentUser && currentUser.id !== targetProfile.id) {
          const { data } = await supabase.from('follows').select('*').eq('follower_id', currentUser.id).eq('following_id', targetProfile.id).maybeSingle();
          setIsFollowing(!!data);
        }

        // Fetch Posts (R2 Videos)
        const { data: posts } = await supabase.from('posts').select('*').eq('user_id', targetProfile.id).order('created_at', { ascending: false });
        setUserPosts(posts || []);

        if (posts) {
          const totalLikes = posts.reduce((acc, curr) => acc + (curr.likes_count || 0), 0);
          setProfile((prev: any) => ({ ...prev, total_likes: totalLikes }));
        }
      }
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  // --- ACTIONS ---
  const handleFollow = async () => {
    if (!currentUser || !profile || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profile.id);
        setIsFollowing(false);
        setProfile((p: any) => ({ ...p, followers_count: Math.max(0, p.followers_count - 1) }));
      } else {
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: profile.id }]);
        await supabase.rpc('increment_followers', { user_id: profile.id });
        setIsFollowing(true);
        setProfile((p: any) => ({ ...p, followers_count: (p.followers_count || 0) + 1 }));
      }
    } finally { setIsFollowLoading(false); }
  };

  const handleDeletePost = async (e: any, postId: string) => {
    e.stopPropagation();
    if (!window.confirm("Bhai, pakka uda dein?")) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setUserPosts(prev => prev.filter(p => p.id !== postId));
      toast.success("Post khatam!");
    }
  };

  const handleUpdateProfile = async () => {
    const { error } = await supabase.from('profiles').update({ full_name: newName, username: newUsername.toLowerCase().trim() }).eq('id', currentUser?.id);
    if (!error) {
      setProfile((p: any) => ({ ...p, full_name: newName, username: newUsername }));
      setIsEditing(false);
      toast.success("Profile updated!");
    }
  };

  const handlePhotoUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setIsUploading(true);
    try {
      const fileName = `${currentUser.id}/${Date.now()}`;
      await supabase.storage.from('avatars').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
      setProfile((p: any) => ({ ...p, avatar_url: publicUrl }));
      toast.success("Avatar changed!");
    } finally { setIsUploading(false); }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="p-4 pt-8 flex items-center justify-between border-b border-white/10 sticky top-0 bg-black z-20">
        <div className="flex items-center gap-4">
          <ArrowLeft className="cursor-pointer" onClick={() => navigate(-1)} />
          <h1 className="text-lg font-black italic text-blue-400">@{profile?.username}</h1>
        </div>
        {profile?.id === currentUser?.id && (
          <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
             {isEditing ? <X className="text-red-500" /> : <Settings size={20} />}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="p-6 flex items-center gap-6">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-600 bg-gray-900">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User /></div>}
          </div>
          {profile?.id === currentUser?.id && (
            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-blue-600 p-1 rounded-full border border-black">
              {isUploading ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
            </button>
          )}
          <input type="file" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />
        </div>
        
        <div className="flex-1 flex justify-between">
          <div className="text-center"><p className="text-lg font-black">{userPosts.length}</p><p className="text-[8px] text-gray-500 uppercase font-bold">Videos</p></div>
          <div className="text-center"><p className="text-lg font-black">{profile?.followers_count || 0}</p><p className="text-[8px] text-gray-500 uppercase font-bold">Followers</p></div>
          <div className="text-center"><p className="text-lg font-black">{profile?.following_count || 0}</p><p className="text-[8px] text-gray-500 uppercase font-bold">Following</p></div>
          <div className="text-center"><p className="text-lg font-black text-pink-500">{profile?.total_likes || 0}</p><p className="text-[8px] text-gray-500 uppercase font-bold">Likes</p></div>
        </div>
      </div>

      {/* Follow / Edit Button */}
      <div className="px-6 mb-4">
        {profile?.id !== currentUser?.id ? (
          <button onClick={handleFollow} className={`w-full py-2 rounded-lg font-black text-xs uppercase ${isFollowing ? 'bg-white/10' : 'bg-blue-600'}`}>
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        ) : (
          <button onClick={() => setIsEditing(!isEditing)} className="w-full py-2 bg-white/5 border border-white/10 rounded-lg font-black text-xs uppercase">Edit Profile</button>
        )}
      </div>

      {/* Name / Editing */}
      <div className="px-6 mb-6">
        {isEditing ? (
          <div className="space-y-2">
            <input value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-gray-900 p-2 rounded border border-white/10 text-sm" placeholder="Username" />
            <div className="flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 bg-gray-900 p-2 rounded border border-white/10 text-sm" placeholder="Full Name" />
              <button onClick={handleUpdateProfile} className="bg-blue-600 px-3 rounded"><Check size={18} /></button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">{profile?.full_name || 'User'}</h2>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Verified Creator ⚡</p>
          </>
        )}
      </div>

      <div className="flex justify-center border-t border-white/10 py-3"><Grid size={20} className="text-gray-500" /></div>
      
      {/* R2 Video Grid */}
      <div className="grid grid-cols-3 gap-0.5 px-0.5">
        {userPosts.map(post => (
          <div key={post.id} className="relative aspect-[9/16] bg-gray-900 overflow-hidden group">
            {/* IMPORTANT: Cloudflare R2 video ke URL me '#t=0.1' jodne se 
               browser video ka pehla frame as a thumbnail dikha deta hai.
            */}
            <video 
              onClick={() => navigate(`/?video=${post.id}`)}
              src={`${post.video_url}#t=0.1`} 
              className="w-full h-full object-cover cursor-pointer"
              muted
              playsInline
              preload="metadata"
            />
            
            {profile?.id === currentUser?.id && (
              <button onClick={(e) => handleDeletePost(e, post.id)} className="absolute top-1 right-1 p-1 bg-red-600/80 rounded-full z-10">
                <Trash2 size={12} />
              </button>
            )}
            
            <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/40 px-1 rounded">
              <Play size={8} fill="white" />
              <span className="text-[9px] font-bold">{post.views_count || 0}</span>
            </div>
          </div>
        ))}
      </div>
      
      {userPosts.length === 0 && (
        <div className="text-center py-20 text-gray-600 text-xs font-bold uppercase">Abhi koi video nahi hai</div>
      )}
    </div>
  );
}
