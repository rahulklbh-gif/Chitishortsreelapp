import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom'; // Dusre user ki profile ke liye
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Settings, Grid, Play, Loader2, Check, User, Trash2, Camera, UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

export function ProfilePage() {
  const { username } = useParams(); // URL se username lene ke liye
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [newName, setNewName] = useState('');
  
  const isOwnProfile = !username || username === profile?.username;

  useEffect(() => {
    fetchProfileAndPosts();
  }, [username, currentUser]);

  const fetchProfileAndPosts = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile (Either by username from URL or Current User ID)
      let query = supabase.from('profiles').select('*');
      
      if (username) {
        query = query.eq('username', username).single();
      } else {
        query = query.eq('id', currentUser?.id).single();
      }

      const { data: prof, error } = await query;
      if (error) throw error;

      setProfile(prof);
      setNewName(prof.full_name || '');

      // 2. Fetch Posts for this profile
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', prof.id)
        .order('created_at', { ascending: false });
      
      setUserPosts(posts || []);

      // 3. Check if current user is following this profile
      if (currentUser && !isOwnProfile) {
        const { data: follow } = await supabase
          .from('followers')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', prof.id)
          .single();
        setIsFollowing(!!follow);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) return toast.error("Please login first!");
    try {
      if (isFollowing) {
        await supabase.from('followers').delete().eq('follower_id', currentUser.id).eq('following_id', profile.id);
        setIsFollowing(false);
      } else {
        await supabase.from('followers').insert({ follower_id: currentUser.id, following_id: profile.id });
        setIsFollowing(true);
      }
    } catch (error) { toast.error("Follow action failed"); }
  };

  // ... (Baki handlePhotoUpload aur handleUpdateProfile code wahi rahega jo maine pehle diya tha)

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500 w-10" /></div>;

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      <div className="p-6 pt-12 border-b border-white/10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-black text-blue-400 italic">@{profile?.username}</h1>
          
          {isOwnProfile ? (
            <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-white/5 rounded-full">
              <Settings size={20} className={isEditing ? "text-blue-500" : ""} />
            </button>
          ) : (
            <button onClick={handleFollow} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition ${isFollowing ? 'bg-white/10 text-white' : 'bg-blue-600 text-white'}`}>
              {isFollowing ? <><UserCheck size={18} /> Following</> : <><UserPlus size={18} /> Follow</>}
            </button>
          )}
        </div>
        {/* ... (Baki UI render code same rahega) */}
      </div>
    </div>
  );
}
