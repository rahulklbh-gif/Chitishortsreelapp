import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ArrowLeft, Send, Camera, Loader2, Trash2, Play } from 'lucide-react';
import { toast } from 'sonner';

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
      <div className="absolute inset-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
        {username ? username[0].toUpperCase() : 'U'}
      </div>
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

  // ✅ 1. SOUND REFS
  const sentAudioRef = useRef<HTMLAudioElement>(null);
  const receivedAudioRef = useRef<HTMLAudioElement>(null);

  const playSound = (type: 'sent' | 'received') => {
    const audio = type === 'sent' ? sentAudioRef.current : receivedAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log("Sound error:", e));
    }
  };

  const markAsRead = async () => {
    if (!roomId || !user) return;
    await supabase.from('chat_messages').update({ is_read: true }).eq('room_id', roomId).neq('sender_id', user.id).eq('is_read', false);
    await supabase.from('chat_rooms').update({ is_read: true }).eq('id', roomId).neq('last_sender_id', user.id);
  };

  // ✅ 2. REAL-TIME LOGIC (FIXED)
  useEffect(() => {
    if (!roomId || !user) return;

    fetchFriendProfile();
    fetchMessages();
    markAsRead();

    // Channel setup
    const channel = supabase.channel(`chat:${roomId}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, 
        (payload) => {
          // Check if message already exists to avoid duplicates
          setMessages((prev) => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });

          // Sound trigger
          if (payload.new.sender_id !== user.id) {
            playSound('received');
            markAsRead();
          }
        }
      )
      .on('postgres_changes', 
        { event: 'DELETE', schema: 'public', table: 'chat_messages' }, 
        (payload) => {
          setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id]); // Dependency updated

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

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, mediaType?: 'video' | 'photo') => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;

    const tempMessage = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    const { error } = await supabase.from('chat_messages').insert([{
      room_id: roomId,
      sender_id: user?.id,
      content: tempMessage,
      media_url: mediaUrl || null,
      media_type: mediaType || (mediaUrl ? 'video' : null)
    }]);

    if (!error) {
      playSound('sent');
      await supabase.from('chat_rooms').update({
        last_message: mediaUrl ? (mediaType === 'photo' ? '📷 Photo' : '🎥 Video') : tempMessage,
        last_message_time: new Date().toISOString(),
        last_sender_id: user?.id,
        is_read: false
      }).eq('id', roomId);
    } else {
      toast.error("Message failed");
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const isVideo = file.type.startsWith('video/');
    const isPhoto = file.type.startsWith('image/');
    if (!isVideo && !isPhoto) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `chats/${user.id}/${Date.now()}.${fileExt}`;
      const arrayBuffer = await file.arrayBuffer();
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type,
      }));
      const finalUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      await handleSendMessage(undefined, finalUrl, isVideo ? 'video' : 'photo');
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const status = getTimeAgo(friendProfile?.last_seen);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-black">
      {/* ✅ 3. INVISIBLE AUDIO ELEMENTS */}
      <audio ref={sentAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto" />
      <audio ref={receivedAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />

      {/* Header */}
      <div className="p-4 pt-10 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 shadow-sm">
        <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer text-black" />
        <div className="relative">
          <UserAvatar userId={friendId || ''} username={friendProfile?.username || 'U'} />
          {status === "Online" && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>}
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{friendProfile?.username || 'User'}</h3>
          <p className={`text-[10px] font-bold ${status === "Online" ? 'text-green-600' : 'text-gray-400'}`}>{status}</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9f9]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`group relative max-w-[75%] shadow-sm overflow-hidden ${
              msg.sender_id === user?.id ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
            } ${msg.media_url ? 'p-1' : 'px-4 py-2.5'}`}>
              {msg.media_url && (
                <div className="relative rounded-xl overflow-hidden bg-black mb-1 w-48 aspect-[9/16]">
                  {msg.media_type === 'photo' ? (
                    <img src={msg.media_url} className="w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <video src={msg.media_url} className="w-full h-full object-cover" playsInline controls crossOrigin="anonymous" />
                  )}
                </div>
              )}
              {msg.content && <p className="text-sm">{msg.content}</p>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-white border-t border-gray-100 pb-8">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-gray-100 p-2 rounded-full px-4 border border-gray-200">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600">
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={22} />}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="video/*,image/*" onChange={handleMediaUpload} />
          <input 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)} 
            className="flex-1 bg-transparent text-sm outline-none text-black placeholder:text-gray-400" 
            placeholder="Message..." 
          />
          <button type="submit" className="text-blue-600 font-bold text-sm px-2">Send</button>
        </form>
      </div>
    </div>
  );
}
