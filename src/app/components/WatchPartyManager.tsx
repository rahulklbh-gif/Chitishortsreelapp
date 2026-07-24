"use client";

/**
 * FILE: components/WatchPartyManager.tsx
 * VERSION: 1.1.0 (SECURE EMBEDDED REALTIME SIGNAL & MEDIA CONTROLLER)
 * STATUS: FIXED OVERLAY & AUTO ROOM GENERATION
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Users, Video, VideoOff, Mic, MicOff, PhoneOff, 
  Share2, Sparkles, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// STUN Servers for WebRTC peer signaling (Google Free Public Servers)
const RTC_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Premium Selection of Emojis
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

  // Dynamic Fallbacks for Props
  const effectiveUserId = propUserId || user?.id || `user_${Math.random().toString(36).substring(2, 7)}`;
  const effectiveUserName = propUserName || user?.user_metadata?.username || user?.email?.split('@')[0] || "Friend";

  // Realtime States
  const [roomId, setRoomId] = useState<string>('');
  const [activePeers, setActivePeers] = useState<Array<{ peerId: string; name: string; stream?: MediaStream }>>([]);
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; char: string; left: number }>>([]);
  const [isJoined, setIsJoined] = useState(false);
  
  // Media States
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // References
  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Clean-up Streams
  const stopAllMediaTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    Object.keys(peerConnectionsRef.current).forEach(peerId => {
      peerConnectionsRef.current[peerId].close();
    });
    peerConnectionsRef.current = {};
    setActivePeers([]);
    setIsJoined(false);
  }, []);

  // Room ID Auto-Setup (Prevents undefined link error)
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

  // WebRTC Setup: Initialize Local Camera Stream
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 240, height: 240, frameRate: 15 },
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn("Could not access camera/mic, joining audio-only/listener mode", err);
      return null;
    }
  };

  // Create Peer Connection with STUN servers
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

  // Join Watch Party Room
  const joinPartyRoom = async () => {
    if (isJoined || !roomId || roomId === 'undefined') {
      toast.error("Room initialization in progress...");
      return;
    }

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
            toast.success(`${presence.name || 'Dost'} joined watch party!`);
            setActivePeers(prev => {
              if (prev.some(p => p.peerId === presence.userId)) return prev;
              return [...prev, { peerId: presence.userId, name: presence.name }];
            });
            handleWebRTCOfferRequest(presence.userId, presence.name, stream);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          toast.info(`${presence.name || 'Dost'} left watch party.`);
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
          console.warn("Failed to add ICE Candidate", e);
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
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  // Copy Party Link Fix (Creates clean URL)
  const copyPartyRoomLink = async () => {
    if (!roomId || roomId === 'undefined') {
      toast.error("Room ID link create nahi ho paa rahi hai!");
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
        toast.success("Watch Party Link Copy Ho Gaya!");
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
    /* FIXED FULL-SCREEN POPUP OVERLAY (SABHI SIDE SLIDE PROBLEMS KO FIX KARTA HAI) */
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-4 text-white overflow-hidden">
        
        {/* Close Modal Button */}
        <button 
          onClick={handleCloseOrLeave}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-white/10 active:scale-95 transition-transform z-10"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-1.5 mt-1">
          <div className="p-3 bg-purple-600/30 rounded-full border border-purple-500/50">
            <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-lg font-black tracking-wide">Live Watch Party 🎉</h2>
          <p className="text-[11px] text-zinc-400 max-w-[240px]">
            Doston ko invite karke ek sath video dekho aur audio/video par baat karo!
          </p>
        </div>

        {/* Video Feeds Section (When Call Active) */}
        {isJoined && (
          <div className="flex flex-wrap items-center justify-center gap-3 w-full my-2 max-h-[140px] overflow-y-auto no-scrollbar">
            {/* Local Camera */}
            <div className="relative w-16 h-16 bg-zinc-950 rounded-full border-2 border-red-500 overflow-hidden shadow-lg flex-shrink-0">
              <video 
                ref={localVideoRef} 
                autoPlay playsInline muted 
                className="w-full h-full object-cover scale-x-[-1]" 
              />
              <div className="absolute bottom-0.5 inset-x-0 text-[7px] bg-red-600 text-white font-black uppercase text-center py-0.5">
                You
              </div>
            </div>

            {/* Remote Peers Cameras */}
            {activePeers.map(peer => (
              <div key={peer.peerId} className="relative w-16 h-16 bg-zinc-950 rounded-full border-2 border-pink-500 overflow-hidden shadow-lg flex-shrink-0">
                {peer.stream ? (
                  <video 
                    autoPlay playsInline
                    ref={(el) => { if (el && peer.stream) el.srcObject = peer.stream; }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 animate-pulse">
                    <Users size={16}/>
                  </div>
                )}
                <div className="absolute bottom-0.5 inset-x-0 text-[7px] bg-pink-600 text-white font-black uppercase text-center py-0.5 truncate px-1">
                  {peer.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating Reactions Render Screen */}
        <div className="absolute inset-x-0 top-12 bottom-20 pointer-events-none overflow-hidden">
          {floatingEmojis.map(e => (
            <div
              key={e.id}
              className="absolute bottom-0 text-3xl select-none"
              style={{ 
                left: `${e.left}%`,
                animation: 'emojiRiseAndFade 2s cubic-bezier(0.25, 1, 0.50, 1) forwards'
              }}
            >
              {e.char}
            </div>
          ))}
        </div>

        {/* Controls and Reactions */}
        {!isJoined ? (
          <div className="w-full flex flex-col gap-3 mt-2">
            <button 
              onClick={joinPartyRoom}
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-red-900/30 text-white"
            >
              <Sparkles size={16}/> Start Watch Party Now
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-3">
            {/* Emojis Bar */}
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

            {/* Media & Invite Control Buttons */}
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
    </div>
  );
}
