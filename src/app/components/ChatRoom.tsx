import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, Send, Camera, Image as ImageIcon, 
  Paperclip, Mic, Smile, Plus, Loader2, Play 
} from 'lucide-react';
import { toast } from 'sonner';

export function ChatRoom() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const friendId = searchParams.get('friend');
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (roomId) {
      fetchFriendProfile();
      fetchMessages();
      subscribeToMessages();
    }
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchFriendProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', friendId).single();
    if (data) setFriendProfile(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}` 
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;

    const messageData = {
      room_id: roomId,
      sender_id: user?.id,
      content: newMessage,
      media_url: mediaUrl || null
    };

    const { error } = await supabase.from('chat_messages').insert([messageData]);
    if (!error) {
      setNewMessage('');
      // Update last message in chat_rooms
      await supabase.from('chat_rooms').update({
        last_message: mediaUrl ? '🎥 Video' : newMessage,
        last_message_time: new Date()
      }).eq('id', roomId);
    }
  };

  // 🔥 R2 VIDEO UPLOAD LOGIC
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    const fileName = `chats/${roomId}/${Date.now()}-${file.name}`;

    try {
      // 1. Upload to R2 Bucket (chiti-videos)
      const { data, error } = await supabase.storage
        .from('chiti-videos')
        .upload(fileName, file);

      if (error) throw error;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chiti-videos')
        .getPublicUrl(fileName);

      // 3. Send as Message
      await handleSendMessage(undefined, publicUrl);
      toast.success("Video sent!");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <div className="p-4 pt-8 border-b border-white/10 flex items-center justify-between bg-black sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <ArrowLeft onClick={() => navigate('/chats')} className="cursor-pointer" />
          <div className="relative">
            <img 
              src={friendProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendProfile?.username}`} 
              className="w-10 h-10 rounded-full object-cover border border-white/10"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></span>
          </div>
          <div>
            <h3 className="text-sm font-bold leading-none">{friendProfile?.full_name || friendProfile?.username}</h3>
            <p className="text-[10px] text-gray-500 mt-1">Active now</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] ${msg.sender_id === user?.id ? 'bg-blue-600 rounded-2xl rounded-tr-none' : 'bg-white/10 rounded-2xl rounded-tl-none'} p-3 shadow-lg`}>
              {msg.media_url && (
                <div className="relative rounded-xl overflow-hidden mb-2 bg-black border border-white/10">
                  <video src={msg.media_url} className="max-h-60 w-full object-cover" controls />
                </div>
              )}
              {msg.content && <p className="text-sm leading-relaxed">{msg.content}</p>}
              <span className="text-[8px] opacity-50 mt-1 block text-right">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black border-t border-white/10">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-white/5 p-2 rounded-3xl px-4 border border-white/10 focus-within:border-blue-500/50 transition-all">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-500 hover:scale-110 transition-transform"
          >
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={22} />}
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="video/*" 
            onChange={handleVideoUpload}
          />

          <input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-600" 
            placeholder="Message..." 
          />

          {newMessage.trim() ? (
            <button type="submit" className="text-blue-500 font-bold text-sm px-2 animate-in fade-in zoom-in duration-200">
              Send
            </button>
          ) : (
            <div className="flex items-center gap-3 text-gray-400">
              <Mic size={20} />
              <ImageIcon size={20} />
              <Smile size={20} />
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
