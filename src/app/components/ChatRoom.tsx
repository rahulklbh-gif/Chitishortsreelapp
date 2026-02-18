import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, Send, Camera, Image as ImageIcon, 
  Mic, Smile, Loader2 
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    const { error } = await supabase.from('chat_messages').insert([{
      room_id: roomId,
      sender_id: user?.id,
      content: newMessage,
      media_url: mediaUrl || null
    }]);

    if (!error) {
      setNewMessage('');
      await supabase.from('chat_rooms').update({
        last_message: mediaUrl ? '🎥 Video' : newMessage,
        last_message_time: new Date()
      }).eq('id', roomId);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const fileName = `chats/${roomId}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('chiti-videos').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('chiti-videos').getPublicUrl(fileName);
      await handleSendMessage(undefined, publicUrl);
      toast.success("Sent!");
    } catch (err) {
      toast.error("Upload failed");
    } finally { setIsUploading(false); }
  };

  return (
    /* ✅ fixed inset-0 aur z-[100] se ye Bottom Nav ke upar aa jayega */
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-black">
      {/* Header (White Theme) */}
      <div className="p-4 pt-10 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0">
        <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer text-black" />
        <div className="relative">
          <img 
            src={friendProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendProfile?.username || 'user'}`} 
            className="w-10 h-10 rounded-full object-cover border border-gray-200"
            alt="profile"
            onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendProfile?.username || 'default'}`;
            }}
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{friendProfile?.full_name || friendProfile?.username || 'Chiti User'}</h3>
          <p className="text-[10px] text-green-600 font-medium">Active now</p>
        </div>
      </div>

      {/* Messages Area (Light Gray/White) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9f9]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 shadow-sm ${
              msg.sender_id === user?.id 
              ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' 
              : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
            }`}>
              {msg.media_url && (
                <video src={msg.media_url} className="rounded-lg mb-2 max-h-60 w-full object-cover" controls />
              )}
              <p className="text-sm leading-relaxed">{msg.content}</p>
              <span className={`text-[8px] mt-1 block text-right ${msg.sender_id === user?.id ? 'text-blue-100' : 'text-gray-400'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (White Theme) */}
      <div className="p-4 bg-white border-t border-gray-100 pb-8">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-gray-100 p-2 rounded-full px-4 border border-gray-200">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600">
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={22} />}
          </button>
          
          <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />

          <input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-black placeholder:text-gray-400" 
            placeholder="Message..." 
          />

          <button type="submit" className="text-blue-600 font-bold text-sm px-2">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
