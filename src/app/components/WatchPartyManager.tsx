"use client";

/**
 * FILE: components/WatchPartyManager.tsx
 * VERSION: 1.0.0 (STABLE P2P ENGINE)
 * STATUS: SECURE, ZERO-LAG EMBEDDED REALTIME SIGNAL & MEDIA CONTROLLER
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Users, Video, VideoOff, Mic, MicOff, PhoneOff, 
  Share2, Play, Pause, Sparkles, Send, Copy
} from 'lucide-react';

// STUN Servers for WebRTC peer signaling (Google Free Public Servers)
const RTC_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Premium Selection of Addictive Emojis requested
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
  roomId: string;
  userId: string;
  userName: string;
  // Video Synchronization callbacks (linked to your video player later)
  onRemoteVideoControl?: (action: 'play' | 'pause' | 'seek', time?: number, videoUrl?: string) => void;
  currentVideoState?: { isPlaying: boolean; currentTime: number; videoUrl: string };
}

export default function WatchPartyManager({
  roomId,
  userId,
  userName,
  onRemoteVideoControl,
  currentVideoState
}: WatchPartyManagerProps) {
  
  // Realtime States
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

    // Attach local streams
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    // Capture incoming tracks from peers
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

    // ICE Candidate management
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            to: targetPeerId,
            from: userId,
            candidate: event.candidate
          }
        });
      }
    };

    return pc;
  };

  // Join the Watch Party Room (Supabase Sockets + WebRTC Setup)
  const joinPartyRoom = async () => {
    if (isJoined) return;

    const stream = await initLocalStream();
    setIsJoined(true);

    // Initialize Supabase Broadcast and Presence Channel
    const channel = supabase.channel(`party_room:${roomId}`, {
      config: { presence: { key: userId } }
    });
    channelRef.current = channel;

    // Presence Sync - Track who enters or exits the group
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Clear offline peers
        const currentPeerIds = Object.keys(state).filter(id => id !== userId);
        setActivePeers(prev => prev.filter(p => currentPeerIds.includes(p.peerId)));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        newPresences.forEach((presence: any) => {
          if (presence.userId !== userId) {
            toast.success(`${presence.name || 'Dost'} joined watch party!`);
            setActivePeers(prev => {
              if (prev.some(p => p.peerId === presence.userId)) return prev;
              return [...prev, { peerId: presence.userId, name: presence.name }];
            });
            // Host creates an Offer to establish target peer connection
            handleWebRTCOfferRequest(presence.userId, presence.name, stream);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          toast.info(`${presence.name || 'Dost'} left watch party.`);
          if (peerConnectionsRef.current[presence.userId]) {
            peerConnectionsRef.current[presence.userId].close();
            delete peerConnectionsRef.current[presence.userId];
          }
          setActivePeers(prev => prev.filter(p => p.peerId !== presence.userId));
        });
      });

    // Handle WebSocket Signal Exchanges & Control synchronization packets
    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (payload.to !== userId) return; // Ignore messages not meant for me

      const pc = peerConnectionsRef.current[payload.from] || createPeerConnection(payload.from, "Friend", stream);

      if (payload.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        if (payload.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { to: payload.from, from: userId, sdp: answer }
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

    // Listen for Realtime Video Control Events (Sync Play, Pause, Seek)
    channel.on('broadcast', { event: 'video-control' }, ({ payload }) => {
      if (payload.senderId !== userId && onRemoteVideoControl) {
        onRemoteVideoControl(payload.action, payload.time, payload.videoUrl);
      }
    });

    // Listen for Realtime Floating Reactions
    channel.on('broadcast', { event: 'emoji-blast' }, ({ payload }) => {
      triggerLocalFloatingReaction(payload.emoji);
    });

    // Connect socket channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, name: userName, joinedAt: new Date() });
      }
    });
  };

  // Send an SDP offer packet (Called when dynamic peers enter context)
  const handleWebRTCOfferRequest = async (targetId: string, peerName: string, stream: MediaStream | null) => {
    const pc = createPeerConnection(targetId, peerName, stream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { to: targetId, from: userId, sdp: offer }
      });
    }
  };

  // --- CONTROLLER API (To trigger events manually or programmatically) ---

  // 1. Host Video Control Sync trigger
  const broadcastVideoControl = useCallback((action: 'play' | 'pause' | 'seek', time?: number) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'video-control',
        payload: {
          senderId: userId,
          action,
          time: time || 0,
          videoUrl: currentVideoState?.videoUrl || ""
        }
      });
    }
  }, [userId, currentVideoState]);

  // 2. Broadcast Floating Emojis Reaction Blast
  const sendEmojiReaction = (emoji: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'emoji-blast',
        payload: { emoji }
      });
    }
    // Also trigger locally for real-time visual responsiveness
    triggerLocalFloatingReaction(emoji);
  };

  // Render dynamic floating animations on local screen UI
  const triggerLocalFloatingReaction = (emoji: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    const leftOffset = Math.floor(Math.random() * 60) + 20; // Coordinates x range [20%, 80%] for clean distribution
    setFloatingEmojis(prev => [...prev, { id, char: emoji, left: leftOffset }]);

    // Dispose nodes dynamically after anim runtime ends (2s) to prevent memory leaks
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
  };

  // Toggle Media States
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

  // Copy Room Link to share with friends easily
  const copyPartyRoomLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?partyRoom=${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success("Watch Party Invite Link Copied! 🎉 Share with friends.");
  };

  useEffect(() => {
    return () => {
      stopAllMediaTracks();
    };
  }, [stopAllMediaTracks]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[490] flex flex-col justify-between">
      
      {/* 🚀 CALLING INTERFACE OVERLAY (FLOATABLE CIRCLES) */}
      <div className="p-4 flex flex-wrap gap-3 pointer-events-auto max-h-[30%] overflow-y-auto">
        {/* Local Stream Feed */}
        {isJoined && (
          <div className="relative w-20 h-20 bg-zinc-950 rounded-full border-2 border-red-500 overflow-hidden shadow-lg shadow-black/80 flex-shrink-0">
            <video 
              ref={localVideoRef} 
              autoPlay playsInline muted 
              className="w-full h-full object-cover scale-x-[-1]" 
            />
            <div className="absolute bottom-1 inset-x-0 mx-auto text-[8px] bg-red-600 px-1 py-0.5 rounded-full w-max font-black uppercase text-white scale-90">
              You
            </div>
          </div>
        )}

        {/* Remote Active Connections Peer Circles */}
        {activePeers.map(peer => (
          <div 
            key={peer.peerId} 
            className="relative w-20 h-20 bg-zinc-950 rounded-full border-2 border-pink-500 overflow-hidden shadow-lg shadow-black/80 flex-shrink-0"
          >
            {peer.stream ? (
              <video 
                autoPlay playsInline
                ref={(el) => {
                  if (el && peer.stream) el.srcObject = peer.stream;
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 animate-pulse">
                <Users size={20}/>
              </div>
            )}
            <div className="absolute bottom-1 inset-x-0 mx-auto text-[8px] bg-pink-600 px-1 py-0.5 rounded-full w-max font-black uppercase text-white scale-90 truncate max-w-[60px]">
              {peer.name}
            </div>
          </div>
        ))}
      </div>

      {/* 🚀 FLOATING EMOTIONAL EXPLOSIONS SYSTEM CANVAS */}
      <div className="relative flex-1 w-full overflow-hidden">
        {floatingEmojis.map(e => (
          <div
            key={e.id}
            className="absolute bottom-0 text-4xl animate-emoji-float select-none transition-all pointer-events-none"
            style={{ 
              left: `${e.left}%`,
              animation: 'emojiRiseAndFade 2s cubic-bezier(0.25, 1, 0.50, 1) forwards'
            }}
          >
            {e.char}
          </div>
        ))}
      </div>

      {/* 🚀 USER REACTION INTERACTIVE CONTROLS PANEL */}
      <div className="p-6 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-4 pointer-events-auto z-[500]">
        
        {/* Dynamic Emoji Click Matrix Slider */}
        <div className="flex justify-between items-center bg-black/40 backdrop-blur-3xl p-3 border border-white/10 rounded-full overflow-x-auto no-scrollbar gap-2">
          {EMOTI_REACTIONS.map(emoji => (
            <button
              key={emoji.name}
              onClick={() => sendEmojiReaction(emoji.char)}
              className="text-3xl active:scale-150 transition-transform hover:-translate-y-1 duration-150 shrink-0"
            >
              {emoji.char}
            </button>
          ))}
        </div>

        {/* Watch Party Connection Controllers */}
        <div className="flex justify-between items-center bg-zinc-950/90 border border-white/5 px-6 py-4 rounded-3xl backdrop-blur-2xl">
          {!isJoined ? (
            <button 
              onClick={joinPartyRoom}
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 py-4.5 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-red-900/10 text-white"
            >
              <Sparkles size={16}/> Start Live Watch Party 🎉
            </button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex gap-3">
                <button 
                  onClick={toggleMute}
                  className={`p-3.5 rounded-2xl border transition-all ${audioEnabled ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-red-500/20 border-red-500 text-red-500'}`}
                >
                  {audioEnabled ? <Mic size={18}/> : <MicOff size={18}/>}
                </button>
                <button 
                  onClick={toggleVideo}
                  className={`p-3.5 rounded-2xl border transition-all ${videoEnabled ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-red-500/20 border-red-500 text-red-500'}`}
                >
                  {videoEnabled ? <Video size={18}/> : <VideoOff size={18}/>}
                </button>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={copyPartyRoomLink}
                  className="px-4 py-3.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-blue-600/20"
                >
                  <Share2 size={14}/> Invite
                </button>
                <button 
                  onClick={stopAllMediaTracks}
                  className="px-4 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 shadow-lg shadow-red-950"
                >
                  <PhoneOff size={14}/> Leave
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global CSS Injecting for Pure Butter Floating Emojis Animations */}
      <style jsx global>{`
        @keyframes emojiRiseAndFade {
          0% {
            transform: translateY(0) scale(0.6) rotate(0deg);
            opacity: 0;
          }
          15% {
            transform: translateY(-50px) scale(1.3) rotate(15deg);
            opacity: 1;
          }
          80% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(-400px) scale(0.8) rotate(-20deg);
            opacity: 0;
          }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
