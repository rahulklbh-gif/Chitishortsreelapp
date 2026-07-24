"use client";

/**
 * FILE: components/WatchPartyManager.tsx
 * VERSION: 1.2.0 (LIVE CAMERA FIX & FLOATING FACE BUBBLES)
 * STATUS: SECURE REALTIME WEBRTC SIGNALING + FLOATING OVERLAY
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Users, Video, VideoOff, Mic, MicOff, PhoneOff, 
  Share2, Sparkles, X, Minimize2, Maximize2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const RTC_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const EMOTI_REACTIONS = [
  { char: '🙏', name: 'prayers' },
  { char: '🥰', name: 'love-glow' },
  { char: '💘', name: 'heart-arrow' },
  { char: '👌', name: 'ok-gesture' },
  { char: '💋', name: 'kiss' },
  { char: '❤️', name: 'red-heart' },
  { char: '💔', name: 'broken' },
  { char: '🌹', name: 'rose' },
  { char: '😂', name: 'laugh' }
];

interface WatchPartyManagerProps {
  videoId?: string;
  videoUrl?: string;
  roomId?: string;
  userId?: string;
  userName?: string;
  onClose?: () => void;
  onRemoteVideoControl?: (action: 'play' | 'pause' | 'seek', time?: number, videoUrl?: string) => void;
  currentVideoState?: { isPlaying: boolean; currentTime: number; videoUrl: string };
}

// Sub-component to ensure Video Element gets srcObject attached properly (Camera Black Screen Fix)
function RemoteVideoBubble({ stream, name, isLocal = false }: { stream: MediaStream | null; name: string; isLocal?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-zinc-950 rounded-full border-2 border-pink-500 overflow-hidden shadow-xl flex-shrink-0">
      {stream ? (
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 animate-pulse">
          <Users size={20}/>
        </div>
      )}
      <div className="absolute bottom-0.5 inset-x-0 text-[8px] bg-pink-600 text-white font-black uppercase text-center py-0.5 truncate px-1 shadow-md">
        {name}
      </div>
    </div>
  );
}

export default function WatchPartyManager({
  videoId = '',
  videoUrl = '',
  roomId: propRoomId,
  userId: propUserId,
  userName: propUserName,
  onClose,
  onRemoteVideoControl,
  currentVideoState
}: WatchPartyManagerProps) {
  
  const { user } = useAuth();

  const effectiveUserId = propUserId || user?.id || `user_${Math.random().toString(36).substring(2, 7)}`;
  const effectiveUserName = propUserName || user?.user_metadata?.username || user?.email?.split('@')[0] || "Friend";

  // States
  const [roomId, setRoomId] = useState<string>('');
  const [activePeers, setActivePeers] = useState<Array<{ peerId: string; name: string; stream: MediaStream | null }>>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; char: string; left: number }>>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // Floating Feed Bubbles Toggle
  
  // Media Controls
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // References
  const channelRef = useRef<any>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});

  const stopAllMediaTracks = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    Object.keys(peerConnectionsRef.current).forEach(peerId => {
      peerConnectionsRef.current[peerId].close();
    });
    peerConnectionsRef.current = {};
    setActivePeers([]);
    setIsJoined(false);
  }, [localStream]);

  // Setup Room ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const existingRoom = urlParams.get('partyRoom');

    if (propRoomId && propRoomId !== 'undefined') {
      setRoomId(propRoomId);
    } else if (existingRoom && existingRoom !== 'undefined') {
      setRoomId(existingRoom);
    } else {
      const newRoom = `room_${videoId ? videoId.substring(0, 5) : 'party'}_${Math.random().toString(36).substring(2, 7)}`;
      setRoomId(newRoom);
    }
  }, [propRoomId, videoId]);

  // Camera Access
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 320, frameRate: 20 },
        audio: true
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn("Camera or microphone permission error:", err);
      toast.error("Camera permissions required for Watch Party");
      return null;
    }
  };

  const createPeerConnection = (targetPeerId: string, peerName: string, stream: MediaStream | null) => {
    if (peerConnectionsRef.current[targetPeerId]) return peerConnectionsRef.current[targetPeerId];

    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    peerConnectionsRef.current[targetPeerId] = pc;

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setActivePeers(prev => {
        const index = prev.findIndex(p => p.peerId === targetPeerId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], stream: remoteStream };
          return updated;
        }
        return [...prev, { peerId: targetPeerId, name: peerName, stream: remoteStream }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            to: targetPeerId,
            from: effectiveUserId,
            candidate: event.candidate
          }
        });
      }
    };

    return pc;
  };

  const joinPartyRoom = async () => {
    if (isJoined || !roomId || roomId === 'undefined') return;

    const stream = await initLocalStream();
    setIsJoined(true);

    const channel = supabase.channel(`party_room:${roomId}`, {
      config: { presence: { key: effectiveUserId } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const currentPeerIds = Object.keys(state).filter(id => id !== effectiveUserId);
        setActivePeers(prev => prev.filter(p => currentPeerIds.includes(p.peerId)));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence: any) => {
          if (presence.userId !== effectiveUserId) {
            toast.success(`${presence.name || 'Friend'} connected! 🎉`);
            setActivePeers(prev => {
              if (prev.some(p => p.peerId === presence.userId)) return prev;
              return [...prev, { peerId: presence.userId, name: presence.name, stream: null }];
            });
            handleWebRTCOfferRequest(presence.userId, presence.name, stream);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          toast.info(`${presence.name || 'Friend'} left watch party.`);
          if (peerConnectionsRef.current[presence.userId]) {
            peerConnectionsRef.current[presence.userId].close();
            delete peerConnectionsRef.current[presence.userId];
          }
          setActivePeers(prev => prev.filter(p => p.peerId !== presence.userId));
        });
      });

    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (payload.to !== effectiveUserId) return;

      const pc = peerConnectionsRef.current[payload.from] || createPeerConnection(payload.from, "Friend", stream);

      if (payload.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        if (payload.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { to: payload.from, from: effectiveUserId, sdp: answer }
          });
        }
      } else if (payload.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.warn("Failed ICE Candidate", e);
        }
      }
    });

    channel.on('broadcast', { event: 'video-control' }, ({ payload }) => {
      if (payload.senderId !== effectiveUserId && onRemoteVideoControl) {
        onRemoteVideoControl(payload.action, payload.time, payload.videoUrl);
      }
    });

    channel.on('broadcast', { event: 'emoji-blast' }, ({ payload }) => {
      triggerLocalFloatingReaction(payload.emoji);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: effectiveUserId, name: effectiveUserName, joinedAt: new Date() });
      }
    });
  };

  const handleWebRTCOfferRequest = async (targetId: string, peerName: string, stream: MediaStream | null) => {
    const pc = createPeerConnection(targetId, peerName, stream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { to: targetId, from: effectiveUserId, sdp: offer }
      });
    }
  };

  const sendEmojiReaction = (emoji: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'emoji-blast',
        payload: { emoji }
      });
    }
    triggerLocalFloatingReaction(emoji);
  };

  const triggerLocalFloatingReaction = (emoji: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    const leftOffset = Math.floor(Math.random() * 60) + 20;
    setFloatingEmojis(prev => [...prev, { id, char: emoji, left: leftOffset }]);

    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const copyPartyRoomLink = async () => {
    if (!roomId || roomId === 'undefined') {
      toast.error("Room ID creating...");
      return;
    }
    const inviteUrl = `${window.location.origin}/?partyRoom=${roomId}&video=${videoId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Chiti Shorts - Watch Party',
          text: 'Aao mere sath video dekho aur baat karo!',
          url: inviteUrl
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Party Link Copied!");
      }
    } catch (err) {
      console.log("Share cancelled");
    }
  };

  const handleCloseOrLeave = () => {
    stopAllMediaTracks();
    if (onClose) onClose();
  };

  useEffect(() => {
    return () => {
      stopAllMediaTracks();
    };
  }, [stopAllMediaTracks]);

  return (
    <>
      {/* 🚀 1. FLOATING FEED CAMERA BUBBLES (Directly floats over Video Feed when minimized or in party) */}
      {isJoined && (
        <div className="fixed top-16 right-4 z-[9990] flex flex-col gap-2 items-end pointer-events-auto">
          {/* Local Camera Bubble */}
          <RemoteVideoBubble stream={localStream} name="YOU" isLocal={true} />

          {/* Connected Friends Camera Bubbles */}
          {activePeers.map(peer => (
            <RemoteVideoBubble key={peer.peerId} stream={peer.stream} name={peer.name} />
          ))}

          {/* Quick Expand Menu Control */}
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 bg-black/60 border border-white/20 rounded-full text-white backdrop-blur-md shadow-lg"
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>
      )}

      {/* Floating Emojis Layer */}
      <div className="fixed inset-0 pointer-events-none z-[9995] overflow-hidden">
        {floatingEmojis.map(e => (
          <div
            key={e.id}
            className="absolute bottom-10 text-3xl select-none"
            style={{ 
              left: `${e.left}%`,
              animation: 'emojiRiseAndFade 2s cubic-bezier(0.25, 1, 0.50, 1) forwards'
            }}
          >
            {e.char}
          </div>
        ))}
      </div>

      {/* 🚀 2. CENTERED WATCH PARTY CONTROLLER MODAL */}
      {(!isMinimized || !isJoined) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-4 text-white overflow-hidden">
            
            {/* Close / Minimize Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              {isJoined && (
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="p-2 text-zinc-400 hover:text-white rounded-full bg-white/10 active:scale-95"
                >
                  <Minimize2 size={16} />
                </button>
              )}
              <button 
                onClick={handleCloseOrLeave}
                className="p-2 text-zinc-400 hover:text-white rounded-full bg-white/10 active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            {/* Header */}
            <div className="flex flex-col items-center text-center gap-1.5 mt-1">
              <div className="p-3 bg-purple-600/30 rounded-full border border-purple-500/50">
                <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
              </div>
              <h2 className="text-lg font-black tracking-wide">Live Watch Party 🎉</h2>
              <p className="text-[11px] text-zinc-400 max-w-[240px]">
                Doston ko invite karke ek sath video dekho aur live camera/voice par baat karo!
              </p>
            </div>

            {/* Camera Bubbles Preview in Modal */}
            {isJoined && (
              <div className="flex items-center justify-center gap-3 w-full my-2 py-2">
                <RemoteVideoBubble stream={localStream} name="YOU" isLocal={true} />
                {activePeers.map(peer => (
                  <RemoteVideoBubble key={peer.peerId} stream={peer.stream} name={peer.name} />
                ))}
              </div>
            )}

            {!isJoined ? (
              <div className="w-full flex flex-col gap-3 mt-2">
                <button 
                  onClick={joinPartyRoom}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-purple-900/30 text-white"
                >
                  <Sparkles size={16}/> Start Watch Party Now
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-3">
                {/* Emojis Slider */}
                <div className="flex justify-between items-center w-full bg-black/50 p-2 border border-white/10 rounded-2xl overflow-x-auto no-scrollbar gap-1">
                  {EMOTI_REACTIONS.map(emoji => (
                    <button
                      key={emoji.name}
                      onClick={() => sendEmojiReaction(emoji.char)}
                      className="text-2xl active:scale-150 transition-transform hover:-translate-y-1 duration-150 shrink-0 px-1"
                    >
                      {emoji.char}
                    </button>
                  ))}
                </div>

                {/* Media Control Panel */}
                <div className="flex items-center justify-between w-full bg-zinc-800/80 p-2.5 rounded-2xl border border-white/10 mt-1">
                  <div className="flex gap-2">
                    <button 
                      onClick={toggleMute}
                      className={`p-3 rounded-xl border transition-all ${audioEnabled ? 'bg-white/10 border-white/10 text-white' : 'bg-red-500/20 border-red-500 text-red-500'}`}
                    >
                      {audioEnabled ? <Mic size={16}/> : <MicOff size={16}/>}
                    </button>
                    <button 
                      onClick={toggleVideo}
                      className={`p-3 rounded-xl border transition-all ${videoEnabled ? 'bg-white/10 border-white/10 text-white' : 'bg-red-500/20 border-red-500 text-red-500'}`}
                    >
                      {videoEnabled ? <Video size={16}/> : <VideoOff size={16}/>}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={copyPartyRoomLink}
                      className="px-3.5 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-blue-900/30"
                    >
                      <Share2 size={14}/> Invite
                    </button>
                    <button 
                      onClick={handleCloseOrLeave}
                      className="px-3 py-3 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-red-900/30"
                    >
                      <PhoneOff size={14}/> Leave
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes emojiRiseAndFade {
          0% { transform: translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { transform: translateY(-30px) scale(1.2) rotate(15deg); opacity: 1; }
          80% { opacity: 0.9; }
          100% { transform: translateY(-250px) scale(0.8) rotate(-20deg); opacity: 0; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
