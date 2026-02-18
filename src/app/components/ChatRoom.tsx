import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ArrowLeft, Send, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// --- Cloudflare R2 Config ---
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
  credentials: { 
    accessKeyId: R2_CONFIG.accessKeyId, 
    secretAccessKey: R2_CONFIG.secretAccessKey 
  },
  forcePathStyle: true,
});

// ✅ Helper: Time ago calculator (Online status ke liye)
function getTimeAgo(lastSeen: string | null) {
  if (!lastSeen) return "Offline";
  const now = new Date();
  const last = new Date(lastSeen);
  const diffInSecs = Math.floor((now.getTime() - last.getTime()) / 1000);

  if (diffInSecs < 60) return "Active now";
  if (diffInSecs < 3600) return `Active ${Math.floor(diffInSecs / 60)}m ago`;
  if (diffInSecs < 86400) return `Active ${Math.floor(diffInSecs / 3600)}h ago`;
  return `Active ${Math.floor(diffInSecs / 86400)}d ago`;
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
      {avatarUrl && (
        <img src={avatarUrl} className="absolute inset-0 w-10 h-10 rounded-full object-cover border border-gray-100" crossOrigin="anonymous" />
      )}
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

  useEffect(() => {
    if (roomId) {
      fetchFriendProfile();
      fetchMessages();
      subscribeToMessages();
      updateMyStatus(); // ✅ Jab aap chat kholo, aap online ho jao
    }
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMyStatus = async () => {
    if (user) {
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
    }
  };

  const fetchFriendProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', friendId).single();
    if (data) setFriendProfile(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase.channel(`room-${roomId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;

    const { error } = await supabase.from('chat_messages').insert([{
      room_id: roomId,
      sender_id: user?.id,
      content: newMessage.trim(),
      media_url: mediaUrl || null
    }]);

    if (!error) {
      setNewMessage('');
      await supabase.from('chat_rooms').update({
        last_message: mediaUrl ? '🎥 Video' : newMessage.trim(),
        last_message_time: new Date().toISOString()
      }).eq('id', roomId);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileName = `chats/${user.id}/${Date.now()}.mp4`;
      const arrayBuffer = await file.arrayBuffer();

      // ✅ Updated for Auto-Play Fix
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: 'video/mp4', // 🔥 Zaroori hai playback ke liye
        ContentDisposition: 'inline', // 🔥 Browser ko play karne bolta hai
      }));

      const finalUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      await handleSendMessage(undefined, finalUrl);
      toast.success("Video sent!");
    } catch (err: any) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-black">
      {/* Header with Activity Status */}
      <div className="p-4 pt-10 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 shadow-sm">
        <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer text-black" />
        <div className="relative">
          <UserAvatar userId={friendId || ''} username={friendProfile?.username || 'U'} />
          {getTimeAgo(friendProfile?.last_seen) === "Active now" && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{friendProfile?.full_name || friendProfile?.username || 'User'}</h3>
          <p className={`text-[10px] font-medium ${getTimeAgo(friendProfile?.last_seen) === "Active now" ? 'text-green-600' : 'text-gray-400'}`}>
            {getTimeAgo(friendProfile?.last_seen)}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9f9]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 shadow-sm overflow-hidden ${
              msg.sender_id === user?.id ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
            }`}>
              {msg.media_url && (
                <div className="relative rounded-lg overflow-hidden bg-black mb-2 border border-white/10">
                  <video 
                    src={msg.media_url} 
                    className="w-full max-h-64 object-cover" 
                    controls 
                    playsInline 
                    preload="metadata"
                  />
                </div>
              )}
              {msg.content && <p className="text-sm leading-relaxed">{msg.content}</p>}
              <span className={`text-[8px] mt-1 block text-right ${msg.sender_id === user?.id ? 'text-blue-100' : 'text-gray-400'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 pb-8">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-gray-100 p-2 rounded-full px-4 border border-gray-200 shadow-inner">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600 active:scale-90 transition-transform">
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={22} />}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
          <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent text-sm outline-none text-black placeholder:text-gray-400" placeholder="Message..." />
          <button type="submit" className="text-blue-600 font-bold text-sm px-2 active:scale-95">Send</button>
        </form>
      </div>
    </div>
  );
} 
