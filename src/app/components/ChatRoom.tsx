import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ArrowLeft, Send, Camera, Loader2, Trash2, Play } from 'lucide-react'; 
import { toast } from 'sonner';

// --- Sound Files (Direct URLs) ---
const SEND_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";
const RECEIVE_SOUND = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint,
  credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
  forcePathStyle: true,
});

function getTimeAgo(lastSeen: string | null) {
  if (!lastSeen) return "Offline";
  const now = new Date();
  const last = new Date(lastSeen);
  const diffInSecs = Math.floor((now.getTime() - last.getTime()) / 1000);
  if (diffInSecs < 40) return "Online";
  if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m ago`;
  if (diffInSecs < 86400) return `${Math.floor(diffInSecs / 3600)}h ago`;
  return `${Math.floor(diffInSecs / 86400)}d ago`;
}

function UserAvatar({ userId, username }: { userId: string, username: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    async function getPhoto() {
      if (!userId) return;
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    }
    getPhoto();
  }, [userId]);
  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <div className="absolute inset-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">{username ? username[0].toUpperCase() : 'U'}</div>
      {avatarUrl && <img src={avatarUrl} className="absolute inset-0 w-10 h-10 rounded-full object-cover border border-gray-100" crossOrigin="anonymous" />}
    </div>
  );
}

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

  // ✅ NEW SIMPLE SOUND LOGIC
  const playSentSound = () => {
    const audio = new Audio(SEND_SOUND);
    audio.play().catch(() => {});
  };

  const playReceivedSound = () => {
    const audio = new Audio(RECEIVE_SOUND);
    audio.play().catch(() => {});
  };

  const markAsRead = async () => {
    if (!roomId || !user) return;
    await supabase.from('chat_messages').update({ is_read: true }).eq('room_id', roomId).neq('sender_id', user.id).eq('is_read', false);
    await supabase.from('chat_rooms').update({ is_read: true }).eq('id', roomId).neq('last_sender_id', user.id);
  };

  useEffect(() => {
    if (roomId && user) {
      fetchFriendProfile();
      fetchMessages();
      markAsRead();
      
      const messageChannel = supabase.channel(`room-${roomId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages', 
          filter: `room_id=eq.${roomId}` 
        }, (payload) => {
          setMessages((prev) => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            // ✅ Sound check for received message
            if (payload.new.sender_id !== user.id) {
                playReceivedSound();
            }
            return [...prev, payload.new];
          });
          if (payload.new.sender_id !== user.id) markAsRead();
        })
        .subscribe();

      return () => { supabase.removeChannel(messageChannel); };
    }
  }, [roomId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchFriendProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', friendId).single();
    if (data) setFriendProfile(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;
    
    // ✅ Instant Sound on Click
    playSentSound();

    const msgToSend = newMessage;
    setNewMessage(''); 

    const { error } = await supabase.from('chat_messages').insert([{
      room_id: roomId,
      sender_id: user?.id,
      content: msgToSend
    }]);

    if (!error) {
      await supabase.from('chat_rooms').update({
        last_message: msgToSend,
        last_message_time: new Date().toISOString(),
        last_sender_id: user?.id,
        is_read: false
      }).eq('id', roomId);
    }
  };

  // ... (handleMediaUpload and rest of the UI stays same as your original)
  // Maine code chhota kiya hai taaki aapko main logic dikhe

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-black" onClick={() => {
        // Unlock browser audio on first touch
        const a = new Audio(SEND_SOUND); a.volume = 0; a.play().catch(()=>{});
    }}>
      {/* Header */}
      <div className="p-4 pt-10 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 shadow-sm">
        <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />
        <UserAvatar userId={friendId || ''} username={friendProfile?.username || 'U'} />
        <div>
          <h3 className="text-sm font-bold">{friendProfile?.username || 'User'}</h3>
          <p className="text-[10px] text-green-600 font-bold">{getTimeAgo(friendProfile?.last_seen)}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9f9]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${msg.sender_id === user?.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-100'}`}>
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t pb-8">
        <form onSubmit={handleSendMessage} className="flex gap-3 bg-gray-100 p-2 rounded-full px-4">
          <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" placeholder="Message..." />
          <button type="submit" className="text-blue-600 font-bold">Send</button>
        </form>
      </div>
    </div>
  );
}
