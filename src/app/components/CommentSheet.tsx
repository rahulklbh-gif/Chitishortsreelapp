import { X, Send, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Props mein videoOwnerId add kiya gaya hai
export function CommentSheet({ videoId, videoOwnerId, isOpen, onClose }: any) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && videoId) {
      fetchComments();
    }
  }, [isOpen, videoId]);

  const fetchComments = async () => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const commentData = {
        video_id: videoId,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'User',
        text: newComment
      };

      // 1. Comment Save Karo
      const { data: commentRes, error: commentError } = await supabase
        .from('comments')
        .insert([commentData])
        .select()
        .single();

      if (commentError) throw commentError;

      // 2. NOTIFICATION LOGIC (Naya Kaam)
      // Agar video owner khud comment kar raha hai toh notification nahi bhejenge
      if (videoOwnerId && user.id !== videoOwnerId) {
        await supabase.from('notifications').insert([
          {
            type: 'comment',
            sender_id: user.id,
            receiver_id: videoOwnerId,
            post_id: videoId,
            content: newComment // Inbox mein comment text dikhane ke liye
          }
        ]);
      }

      setComments([commentRes, ...comments]);
      setNewComment('');
      toast.success('Comment added!');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Could not post comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-3xl z-50 max-h-[75vh] flex flex-col transition-all border-t border-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <span className="font-bold text-white text-md">Comments ({comments.length})</span>
          <button onClick={onClose} className="p-1 bg-white/5 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No comments yet. Start the conversation!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 animate-in fade-in duration-300">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {c.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-200">@{c.username}</span>
                    <span className="text-[10px] text-gray-600">Just now</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{c.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
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
