import { X, Send, Loader2, Trash2, Reply } from 'lucide-react'; 
import { useState, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function CommentSheet({ videoId, videoOwnerId, isOpen, onClose }: any) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      const latestUsername = profileData?.username || user.email?.split('@')[0] || 'User';

      const commentData = {
        video_id: videoId,
        user_id: user.id,
        username: latestUsername,
        text: newComment
      };

      const { data: commentRes, error: commentError } = await supabase
        .from('comments')
        .insert([commentData])
        .select()
        .single();

      if (commentError) throw commentError;

      await supabase.rpc('increment_comments', { post_id: videoId });

      if (videoOwnerId && user.id !== videoOwnerId) {
        await supabase.from('notifications').insert([{
            type: 'comment',
            sender_id: user.id,
            receiver_id: videoOwnerId,
            post_id: videoId,
            content: newComment 
        }]);
      }

      setComments(prev => [commentRes, ...prev]);
      setNewComment('');
      toast.success('Comment added!');
    } catch (error: any) {
      console.error("Insert Error:", error);
      toast.error('Could not post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const confirmDelete = window.confirm("Delete this comment permanently?");
    if (!confirmDelete) return;

    const previousComments = [...comments];
    setComments(comments.filter(c => c.id !== commentId));

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user?.id);

      if (error) {
        setComments(previousComments);
        throw error;
      }

      await supabase.rpc('decrement_comments', { post_id: videoId });
      toast.success('Comment deleted');
      fetchComments(); 
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const handleReply = (username: string) => {
    setNewComment(`@${username} `);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-3xl z-50 max-h-[75vh] flex flex-col border-t border-white/10">
        
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <span className="font-bold text-white text-md">Comments ({comments.length})</span>
          <button onClick={onClose} className="p-1 bg-white/5 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading && comments.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No comments yet.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex justify-between items-start">
                <div className="flex gap-3 items-start">
                  
                  {/* 🔥 PHOTO MAGIC AREA START */}
                  <div className="relative w-9 h-9 flex-shrink-0">
                    {/* Fallback Letter (Hamesha piche rahega) */}
                    <div className="absolute inset-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {c.username ? c.username[0].toUpperCase() : 'U'}
                    </div>
                    
                    {/* Actual Photo (Upar load hogi) */}
                    <img 
                      src={`https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/avatars/${c.user_id}`} 
                      className="absolute inset-0 w-9 h-9 rounded-full object-cover border border-white/10 transition-opacity duration-300 opacity-0"
                      crossOrigin="anonymous"
                      onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  {/* 🔥 PHOTO MAGIC AREA END */}
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-200">@{c.username}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{c.text}</p>
                    
                    <button 
                      onClick={() => handleReply(c.username)}
                      className="flex items-center gap-1 text-[11px] text-gray-500 font-bold mt-2 hover:text-white transition-colors"
                    >
                      <Reply size={12} /> Reply
                    </button>
                  </div>
                </div>

                {user?.id === c.user_id && (
                  <button 
                    onClick={() => handleDelete(c.id)}
                    className="p-3 text-gray-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-[#121212] border-t border-white/5 pb-8">
          <div className="flex gap-2 bg-white/5 rounded-2xl p-2 items-center border border-white/10">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={user ? "Add a comment..." : "Login to comment"}
              disabled={!user}
              className="flex-1 bg-transparent text-white px-3 py-1 focus:outline-none text-sm"
            />
            <button 
              type="submit" 
              disabled={!newComment.trim() || submitting || !user} 
              className="p-2 bg-blue-600 rounded-xl text-white disabled:opacity-30"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
