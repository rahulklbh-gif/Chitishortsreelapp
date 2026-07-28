"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ArrowLeft, Send, Camera, Loader2, Trash2, Play, Volume2, Heart, Check, CheckCheck } from 'lucide-react'; 
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
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false); 
  const [isTyping, setIsTyping] = useState(false);
  const [isFriendOnlineGlobal, setIsFriendOnlineGlobal] = useState(false);
  const [now, setNow] = useState(new Date()); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusInterval = useRef<any>(null);

  const sentAudioRef = useRef<HTMLAudioElement>(null);
  const receivedAudioRef = useRef<HTMLAudioElement>(null);

  // 🔴 LINK FORMATTER & CLICKABLE CONVERTER
  const renderFormattedMessage = (content: string, isMe: boolean) => {
    if (!content) return null;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, idx) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={idx}
            href={part}
            onClick={(e) => {
              e.stopPropagation();
              if (part.includes(window.location.host)) {
                e.preventDefault();
                const targetUrl = new URL(part);
                navigate(`${targetUrl.pathname}${targetUrl.search}`);
              }
            }}
            className={`font-black underline break-all inline-block my-0.5 px-1.5 py-0.5 rounded ${
              isMe 
                ? 'text-yellow-200 hover:text-white bg-blue-700/50' 
                : 'text-blue-600 hover:text-blue-800 bg-blue-50'
            }`}
          >
            {part}
          </a>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const playSound = (type: 'sent' | 'received') => {
    const audio = type === 'sent' ? sentAudioRef.current : receivedAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        if (navigator.vibrate) navigator.vibrate(50);
      });
    }
    if (navigator.vibrate) navigator.vibrate(type === 'sent' ? 30 : 60);
  };

  const unlockAudio = () => {
    if (!isAudioUnlocked && sentAudioRef.current && receivedAudioRef.current) {
      sentAudioRef.current.play().then(() => {
        sentAudioRef.current?.pause();
        setIsAudioUnlocked(true);
      }).catch(() => {});
    }
  };

  const markAsRead = async () => {
    if (!roomId || !user) return;
    await supabase.from('chat_messages').update({ is_read: true, read_at: new Date().toISOString() }).eq('room_id', roomId).neq('sender_id', user.id).eq('is_read', false);
    await supabase.from('chat_rooms').update({ is_read: true }).eq('id', roomId).neq('last_sender_id', user.id);
  };

  useEffect(() => {
    if (roomId && user) {
      fetchFriendProfile();
      fetchMessages();
      markAsRead();
      
      const globalPresence = supabase.channel('global-app-presence', {
        config: { presence: { key: user.id } }
      });

      globalPresence
        .on('presence', { event: 'sync' }, () => {
          const state = globalPresence.presenceState();
          const onlineUsers = new Set(Object.keys(state));
          if (friendId) {
            setIsFriendOnlineGlobal(onlineUsers.has(friendId));
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await globalPresence.track({ online_at: new Date().toISOString() });
          }
        });

      const typingChannel = supabase.channel(`typing-${roomId}`)
        .on('presence', { event: 'sync' }, () => {
          const state: any = typingChannel.presenceState();
          const typingUsers = Object.values(state).flat();
          setIsTyping(typingUsers.some((u: any) => u.user_id === friendId && u.is_typing));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await typingChannel.track({ user_id: user.id, is_typing: false });
          }
        });

      // ⚡ REALTIME LISTENERS FOR INSERT, UPDATE, AND DELETE
      const messageChannel = supabase.channel(`room-${roomId}`)
        .on('postgres_changes', { 
          event: '*',
          schema: 'public', 
          table: 'chat_messages', 
          filter: `room_id=eq.${roomId}` 
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              if (prev.find(m => m.id === payload.new.id)) return prev;
              if (payload.new.deleted_for && payload.new.deleted_for.includes(user.id)) return prev;
              return [...prev, payload.new];
            });
            if (payload.new.sender_id !== user.id) {
              playSound('received'); 
              markAsRead();
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => {
              if (payload.new.deleted_for && payload.new.deleted_for.includes(user.id)) {
                return prev.filter(m => m.id !== payload.new.id);
              }
              return prev.map(m => m.id === payload.new.id ? payload.new : m);
            });
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
          }
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
        supabase.removeChannel(typingChannel);
        supabase.removeChannel(globalPresence);
      };
    }
  }, [roomId, friendId, user?.id]);

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
    const activeMessages = (data || []).filter(m => !m.deleted_for || !m.deleted_for.includes(user?.id));
    setMessages(activeMessages);
  };

  const handleLikeMessage = async (msgId: string, currentLikes: boolean) => {
    await supabase.from('chat_messages').update({ is_liked: !currentLikes }).eq('id', msgId);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleTypingStatus = (val: string) => {
    setNewMessage(val);
    supabase.channel(`typing-${roomId}`).track({ user_id: user?.id, is_typing: val.length > 0 });
  };

  // 🚀 HELPER: Sync remaining latest message with chat_rooms preview
  const updateRoomLastMessageAfterDelete = async (remainingList: any[]) => {
    const lastMsg = remainingList.length > 0 ? remainingList[remainingList.length - 1] : null;

    let previewText = 'Tap to chat';
    if (lastMsg) {
      if (lastMsg.media_url) {
        previewText = lastMsg.media_type === 'photo' ? '📷 Photo' : '🎥 Video Shared';
      } else {
        previewText = lastMsg.content || 'Message';
      }
    }

    await supabase.from('chat_rooms').update({
      last_message: previewText,
      last_message_time: lastMsg ? lastMsg.created_at : new Date().toISOString(),
      last_sender_id: lastMsg ? lastMsg.sender_id : null
    }).eq('id', roomId);
  };

  // 🚀 SMART DELETE LOGIC (Instant Chat List Preview Sync Fix)
  const handleDeleteMessage = async (messageId: string, senderId: string) => {
    if (!user) return;
    const isMe = senderId === user.id;

    if (isMe) {
      const confirmDelete = window.confirm("Delete this message for EVERYONE?");
      if (!confirmDelete) return;

      const remainingMessages = messages.filter(m => m.id !== messageId);
      setMessages(remainingMessages);

      const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
      if (error) {
        toast.error("Delete failed");
        fetchMessages();
      } else {
        toast.success("Message deleted for everyone");
        await updateRoomLastMessageAfterDelete(remainingMessages);
      }
    } else {
      const confirmDelete = window.confirm("Delete this message for YOU ONLY?");
      if (!confirmDelete) return;

      const remainingMessages = messages.filter(m => m.id !== messageId);
      setMessages(remainingMessages);

      const targetMsg = messages.find(m => m.id === messageId);
      const currentDeletedArray = targetMsg?.deleted_for || [];
      const updatedArray = [...new Set([...currentDeletedArray, user.id])];

      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted_for: updatedArray })
        .eq('id', messageId);

      if (error) {
        toast.error("Delete failed");
        fetchMessages();
      } else {
        toast.success("Message deleted for you");
        await updateRoomLastMessageAfterDelete(remainingMessages);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, mediaType?: 'video' | 'photo') => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;
    
    const currentMsg = newMessage.trim();
    setNewMessage(''); 
    supabase.channel(`typing-${roomId}`).track({ user_id: user?.id, is_typing: false });

    const { error } = await supabase.from('chat_messages').insert([{
      room_id: roomId,
      sender_id: user?.id,
      content: currentMsg,
      media_url: mediaUrl || null,
      media_type: mediaType || (mediaUrl ? 'video' : null),
      is_read: false,
      deleted_for: []
    }]);

    if (!error) {
      playSound('sent'); 
      const previewText = mediaUrl ? (mediaType === 'photo' ? '📷 Photo' : '🎥 Video Shared') : currentMsg;
      await supabase.from('chat_rooms').update({
        last_message: previewText,
        last_message_time: new Date().toISOString(),
        last_sender_id: user?.id,
        is_read: false
      }).eq('id', roomId);
    }
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

  const lastSeenStatus = getTimeAgo(friendProfile?.last_seen);
  const isOnline = isFriendOnlineGlobal || lastSeenStatus === "Online";
  
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-black" onClick={unlockAudio}>
      <audio ref={sentAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto" />
      <audio ref={receivedAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />

      {/* Header */}
      <div className="p-4 pt-10 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 shadow-sm z-10">
        <ArrowLeft onClick={() => navigate(-1)} className="cursor-pointer text-black" />
        <div className="relative">
          <UserAvatar userId={friendId || ''} username={friendProfile?.username || 'U'} />
          {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900">{friendProfile?.full_name || friendProfile?.username || 'User'}</h3>
          <p className={`text-[10px] font-bold ${isTyping ? 'text-blue-500 animate-pulse' : (isOnline ? 'text-green-600' : 'text-gray-400')}`}>
            {isTyping ? "typing..." : (isOnline ? "Online" : `Active ${lastSeenStatus}`)}
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9f9]">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;

          return (
            <div 
              key={msg.id} 
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              onContextMenu={(e) => { e.preventDefault(); handleDeleteMessage(msg.id, msg.sender_id); }}
            >
              <div className={`group relative max-w-[80%] shadow-sm overflow-visible ${
                isMe ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
              } ${msg.media_url ? 'p-1' : 'px-4 py-2.5'}`}>
                
                {msg.media_url && (
                  <div className="relative rounded-xl overflow-hidden bg-black mb-1 w-48 aspect-[9/16] shadow-inner group/vid cursor-pointer active:scale-95 transition-transform">
                    {msg.media_type === 'photo' ? (
                      <img src={msg.media_url} className="w-full h-full object-cover" crossOrigin="anonymous" onClick={() => window.open(msg.media_url, '_blank')} />
                    ) : (
                      <div className="w-full h-full relative" onClick={() => msg.post_id ? navigate(`/?video=${msg.post_id}`) : null}>
                        <video src={msg.media_url} className="w-full h-full object-cover" playsInline controls={!msg.post_id} preload="metadata" crossOrigin="anonymous" />
                        {msg.post_id && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                              <Play size={20} className="text-white fill-white ml-1" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {msg.content && (
                  <p className={`text-sm leading-relaxed ${msg.media_url ? 'px-2 pb-1 pt-1 font-medium' : ''}`}>
                    {renderFormattedMessage(msg.content, isMe)}
                  </p>
                )}
                
                <div className={`flex items-center justify-end gap-1 px-2 pb-1 ${msg.media_url ? 'mt-0' : 'mt-1'}`}>
                  <span className={`text-[8px] block ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  {isMe && (
                    <span className="ml-1">
                      {msg.is_read ? <CheckCheck size={12} className="text-blue-200" /> : <Check size={12} className="text-blue-100 opacity-70" />}
                    </span>
                  )}
                </div>

                {isMe && msg.is_read && msg.read_at && (
                  <p className="text-[7px] text-right px-2 text-blue-200 opacity-80 -mt-1 pb-1">
                    Seen {getTimeAgo(msg.read_at)}
                  </p>
                )}

                {/* Like Button */}
                <button 
                  onClick={() => handleLikeMessage(msg.id, msg.is_liked)}
                  className={`absolute -bottom-2 ${isMe ? '-left-2' : '-right-2'} p-1 rounded-full bg-white shadow-md border border-gray-100 transition-transform active:scale-125`}
                >
                  <Heart size={12} className={`${msg.is_liked ? 'fill-red-500 text-red-500' : 'text-gray-300'}`} />
                </button>
                
                {/* 🗑️ Smart Delete Button */}
                <button 
                  onClick={() => handleDeleteMessage(msg.id, msg.sender_id)} 
                  className={`absolute top-2 ${isMe ? 'right-2' : 'left-2'} p-1.5 bg-black/40 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10`}
                  title={isMe ? "Delete for Everyone" : "Delete for You"}
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              </div>
            </div>
          );
        })}
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
            onChange={(e) => handleTypingStatus(e.target.value)} 
            className="flex-1 bg-transparent text-sm outline-none text-black placeholder:text-gray-400" 
            placeholder="Message..." 
          />
          <button type="submit" className="text-blue-600 font-bold text-sm px-2">Send</button>
        </form>
      </div>
    </div>
  );
}
