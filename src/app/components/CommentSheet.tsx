import { X, Send } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  likes: number;
  timestamp: string;
}

interface CommentSheetProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentSheet({ videoId, isOpen, onClose }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Load comments from localStorage
      const storedComments = localStorage.getItem(`comments_${videoId}`);
      if (storedComments) {
        setComments(JSON.parse(storedComments));
      } else {
        // Mock initial comments
        setComments([
          {
            id: '1',
            username: 'sarah_creates',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
            text: 'This is amazing! 🔥',
            likes: 42,
            timestamp: '2h ago',
          },
          {
            id: '2',
            username: 'john_doe',
            avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
            text: 'Love the creativity! Keep it up 💯',
            likes: 28,
            timestamp: '5h ago',
          },
        ]);
      }
    }
  }, [isOpen, videoId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      username: 'current_user',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      text: newComment,
      likes: 0,
      timestamp: 'Just now',
    };

    const updatedComments = [comment, ...comments];
    setComments(updatedComments);
    localStorage.setItem(`comments_${videoId}`, JSON.stringify(updatedComments));
    setNewComment('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{comments.length} Comments</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <img
                src={comment.avatar}
                alt={comment.username}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{comment.username}</span>
                  <span className="text-gray-500 text-xs">{comment.timestamp}</span>
                </div>
                <p className="text-sm mt-1">{comment.text}</p>
                <div className="flex items-center gap-4 mt-2">
                  <button className="text-xs text-gray-500">
                    {comment.likes > 0 ? `${comment.likes} likes` : 'Like'}
                  </button>
                  <button className="text-xs text-gray-500">Reply</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full disabled:opacity-50"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
