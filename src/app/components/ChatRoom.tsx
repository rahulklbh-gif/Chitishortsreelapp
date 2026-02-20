import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ArrowLeft, Send, Camera, Loader2, Trash2, Play } from 'lucide-react'; // ✅ Play icon added
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

// ✅ SOUNDS SYSTEM (Pre-loaded outside component to avoid browser block)
const sentSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
const receivedSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');

// Preload sounds
sentSound.load();
receivedSound.load();

const playSentSound = () => {
  sentSound.currentTime = 0;
  sentSound.play().catch(e => console.log("Sent sound blocked:", e));
};

const playReceivedSound = () => {
  receivedSound.currentTime = 0;
  receivedSound.play().catch(e => console.log("Received sound blocked:", e));
};

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
  const [now, setNow] = useState(new Date()); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusInterval = useRef<any>(null);

  // ✅ MARK MESSAGES AS READ LOGIC
  const markAsRead = async () => {
    if (!roomId || !user) return;
    await supabase.from('chat_messages').update({ is_read: true }).eq('room_id', roomId).neq('sender_id', user.id).eq('is_read', false);
    
    // Update chat_rooms to show read status in list
    await supabase.from('chat_rooms').update({ is_read: true }).eq('id', roomId).neq('last_sender_id', user.id);
  };

  useEffect(() => {
    if (roomId) {
      fetchFriendProfile();
      fetchMessages();
      markAsRead(); // Mark existing as read
      
      const messageChannel = supabase.channel(`room-${roomId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (payload.new.sender_id !== user?.id) {
            playReceivedSound(); // ✅ Correct Sound Trigger
            markAsRead(); // Mark incoming as read
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
          setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
        })
        .subscribe();

      updateMyStatus();
      statusInterval.current = setInterval(updateMyStatus, 20000);
      
      const uiTimer = setInterval(() => setNow(new Date()), 30000);

      const profileSubscription = supabase.channel(`profile-${friendId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${friendId}` }, (payload) => {
          setFriendProfile(payload.new);
        }).subscribe();

      return () => {
        clearInterval(statusInterval.current);
        clearInterval(uiTimer);
        supabase.removeChannel(messageChannel);
        supabase.removeChannel(profileSubscription);
      };
    }
  }, [roomId, friendId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMyStatus = async () => {
    if (user?.id) {
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

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, mediaType?: 'video' | 'photo') => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;

    const { error } = await supabase.from('chat_messages').insert([{
      room_id: roomId,
      sender_id: user?.id,
      content: newMessage.trim(),
      media_url: mediaUrl || null,
      media_type: mediaType || (mediaUrl ? 'video' : null)
    }]);

    if (!error) {
      setNewMessage('');
      playSentSound(); // ✅ Correct Sound Trigger
      await supabase.from('chat_rooms').update({
        last_message: mediaUrl ? (mediaType === 'photo' ? '📷 Photo' : '🎥 Video') : newMessage.trim(),
        last_message_time: new Date().toISOString(),
        last_sender_id: user?.id,
        is_read: false
      }).eq('id', roomId);
    }
  };

  const handleDeleteMessage = async (messageId: string, senderId: string) => {
    if (senderId !== user?.id) return;

    const confirmDelete = window.confirm("Delete this message?");
    if (!confirmDelete) return;

    const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
    if (error) toast.error("Delete failed");
    else toast.success("Message deleted");
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const isVideo = file.type.startsWith('video/');
    const isPhoto = file.type.startsWith('image/');
    
    if (!isVideo && !isPhoto) {
      toast.error("Format not supported");
      return;
    }

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
        ContentDisposition: 'inline',
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
      {/* Header */}
      <div className="p-4 pt-10 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 shadow-sm">
        <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer text-black" />
        <div className="relative">
          <UserAvatar userId={friendId || ''} username={friendProfile?.username || 'U'} />
          {status === "Online" && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>}
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{friendProfile?.full_name || friendProfile?.username || 'User'}</h3>
          <p className={`text-[10px] font-bold ${status === "Online" ? 'text-green-600' : 'text-gray-400'}`}>
            {status === "Online" ? "Online" : `Active ${status}`}
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9f9]">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            onContextMenu={(e) => { e.preventDefault(); handleDeleteMessage(msg.id, msg.sender_id); }}
          >
            <div className={`group relative max-w-[75%] shadow-sm overflow-hidden ${
              msg.sender_id === user?.id ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
            } ${msg.media_url ? 'p-1' : 'px-4 py-2.5'}`}>
              
              {msg.media_url && (
                <div className="relative rounded-xl overflow-hidden bg-black mb-1 w-48 aspect-[9/16] shadow-inner group/vid cursor-pointer active:scale-95 transition-transform">
                  {msg.media_type === 'photo' ? (
                    <img 
                       src={msg.media_url} 
                       className="w-full h-full object-cover" 
                       crossOrigin="anonymous" 
                       onClick={() => window.open(msg.media_url, '_blank')}
                    />
                  ) : (
                    <div className="w-full h-full relative">
                      <video 
                        src={msg.media_url} 
                        className="w-full h-full object-cover" 
                        playsInline 
                        controls 
                        preload="metadata" 
                        crossOrigin="anonymous" 
                      />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black tracking-widest text-white uppercase">Chiti Short</span>
                  </div>
                </div>
              )}

              {msg.content && <p className={`text-sm leading-relaxed ${msg.media_url ? 'px-2 pb-1 pt-1 font-medium' : ''}`}>{msg.content}</p>}
              
              <div className={`flex items-center justify-end gap-1 px-2 pb-1 ${msg.media_url ? 'mt-0' : 'mt-1'}`}>
                 <span className={`text-[8px] block ${msg.sender_id === user?.id ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              {msg.sender_id === user?.id && (
                <button 
                  onClick={() => handleDeleteMessage(msg.id, msg.sender_id)}
                  className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              )}
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
          <input 
             type="file" 
             ref={fileInputRef} 
             className="hidden" 
             accept="video/*,image/*" 
             onChange={handleMediaUpload} 
          />
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
