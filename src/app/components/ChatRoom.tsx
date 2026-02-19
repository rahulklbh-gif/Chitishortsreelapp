import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ArrowLeft, Send, Camera, Loader2, Trash2, Play, Film } from 'lucide-react';
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

  useEffect(() => {
    if (roomId) {
      fetchFriendProfile();
      fetchMessages();
      
      const channel = supabase.channel(`chat:${roomId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'chat_messages', 
          filter: `room_id=eq.${roomId}` 
        }, () => {
          fetchMessages(); // ✅ Har change par re-fetch taaki data miss na ho
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
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
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    
    if (!error && data) setMessages(data);
  };

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;

    const msgData = {
      room_id: roomId,
      sender_id: user?.id,
      content: newMessage.trim(),
      media_url: mediaUrl || null
    };

    const { error } = await supabase.from('chat_messages').insert([msgData]);

    if (!error) {
      setNewMessage('');
      fetchMessages(); // ✅ Immediate update
      await supabase.from('chat_rooms').update({
        last_message: mediaUrl ? '🎥 Video' : newMessage.trim(),
        last_message_time: new Date().toISOString()
      }).eq('id', roomId);
    }
  };

  const handleDeleteMessage = async (id: string, sId: string) => {
    if (sId !== user?.id) return;
    if (window.confirm("Delete?")) {
      await supabase.from('chat_messages').delete().eq('id', id);
      fetchMessages();
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const fileName = `chats/${user.id}/${Date.now()}.mp4`;
      const arrayBuffer = await file.arrayBuffer();
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type,
      }));
      const finalUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      await handleSendMessage(undefined, finalUrl);
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-black">
      {/* Header */}
      <div className="p-4 pt-10 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 z-10">
        <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer" />
        <UserAvatar userId={friendId || ''} username={friendProfile?.username || 'U'} />
        <div>
          <h3 className="text-sm font-bold">{friendProfile?.username || 'User'}</h3>
          <p className="text-[10px] text-green-600 font-bold">{getTimeAgo(friendProfile?.last_seen) === "Online" ? "Online" : "Active"}</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#F8F9FA]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[80%] group ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
              
              <div className={`rounded-2xl px-3 py-2 shadow-sm ${
                msg.sender_id === user?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-black border border-gray-100 rounded-tl-none'
              }`}>
                {/* ✅ VIDEO RENDERING FIX */}
                {msg.media_url && (
                  <div className="mb-2 w-56 aspect-[9/16] bg-black rounded-xl overflow-hidden relative shadow-lg">
                    <video 
                      src={msg.media_url} 
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                      crossOrigin="anonymous"
                    />
                    <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md p-1 rounded-md flex items-center gap-1">
                      <Film size={10} className="text-white" />
                      <span className="text-[8px] text-white font-black uppercase">Chiti</span>
                    </div>
                  </div>
                )}
                
                {msg.content && <p className="text-[13px] leading-snug">{msg.content}</p>}
                
                <p className={`text-[8px] mt-1 opacity-70 text-right`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {msg.sender_id === user?.id && (
                <button onClick={() => handleDeleteMessage(msg.id, msg.sender_id)} className="absolute -left-8 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t pb-8">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-full px-4">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-blue-600">
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={22} />}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="video/*,image/*" onChange={handleVideoUpload} />
          <input 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)} 
            placeholder="Write message..." 
            className="flex-1 bg-transparent text-sm outline-none" 
          />
          <button type="submit" className="p-2 text-blue-600 font-black text-sm uppercase">Send</button>
        </form>
      </div>
    </div>
  );
}
