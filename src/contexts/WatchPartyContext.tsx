"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Share2 } from 'lucide-react';

const RTC_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

interface WatchPartyContextType {
  activeRoomId: string | null;
  startParty: (roomId: string, videoId?: string) => void;
  leaveParty: () => void;
  broadcastVideoChange: (videoId: string, path?: string) => void;
  remoteVideoId: string | null;
}

const WatchPartyContext = createContext<WatchPartyContextType>({
  activeRoomId: null,
  startParty: () => {},
  leaveParty: () => {},
  broadcastVideoChange: () => {},
  remoteVideoId: null,
});

// 🟢 Camera Bubble: Local Selfie Mirror & Remote Straight View Fix
function RemoteVideoBubble({ stream, isLocal = false }: { stream: MediaStream | null; isLocal?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.log("Stream play error:", e));
    }
  }, [stream]);

  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-zinc-950 rounded-full border-2 border-pink-500 overflow-hidden shadow-2xl flex-shrink-0 z-[99999]">
      {stream ? (
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted={isLocal}
          // 🚀 FIX: Local User = Mirror Flipped (-1), Remote Friend = Straight Normal (1)
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : 'scale-x-100'}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 animate-pulse">
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-ping" />
        </div>
      )}
    </div>
  );
}

export const WatchPartyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePeers, setActivePeers] = useState<Array<{ peerId: string; name: string; stream: MediaStream | null }>>([]);
  const [remoteVideoId, setRemoteVideoId] = useState<string | null>(null);
  
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const disconnectTimerRef = useRef<any>(null);

  const effectiveUserId = user?.id || `user_${Math.random().toString(36).substring(2, 7)}`;
  const effectiveUserName = user?.user_metadata?.username || user?.email?.split('@')[0] || "Friend";

  const stopAllMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    Object.keys(peerConnectionsRef.current).forEach(id => {
      peerConnectionsRef.current[id].close();
    });
    peerConnectionsRef.current = {};
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setActivePeers([]);
    setActiveRoomId(null);
  }, []);

  // 30-Second Grace Disconnect Timer (Minimise / Background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        disconnectTimerRef.current = setTimeout(() => {
          stopAllMedia();
          toast.info("Watch party disconnected due to 30s inactivity.");
        }, 30000);
      } else {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [stopAllMedia]);

  // Enhanced Hardware Audio Processing for Echo & Noise Shield
  const initLocalStream = async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 320 }, 
          height: { ideal: 320 }, 
          frameRate: { max: 24 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: { exact: true },
          noiseSuppression: { exact: true },
          autoGainControl: { exact: true },
          // @ts-ignore
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true
        }
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.warn("Camera/Mic Permission error:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        localStreamRef.current = fallbackStream;
        return fallbackStream;
      } catch (fallbackErr) {
        toast.error("Camera/Mic access failed");
        return null;
      }
    }
  };

  const createPeerConnection = (targetId: string, peerName: string, stream: MediaStream | null) => {
    if (peerConnectionsRef.current[targetId]) return peerConnectionsRef.current[targetId];

    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    peerConnectionsRef.current[targetId] = pc;

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setActivePeers(prev => {
          const exists = prev.some(p => p.peerId === targetId);
          if (exists) {
            return prev.map(p => p.peerId === targetId ? { ...p, stream: remoteStream } : p);
          }
          return [...prev, { peerId: targetId, name: peerName, stream: remoteStream }];
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { to: targetId, from: effectiveUserId, candidate: event.candidate }
        });
      }
    };

    return pc;
  };

  const startParty = async (roomId: string) => {
    if (activeRoomId === roomId) return;
    setActiveRoomId(roomId);

    const stream = await initLocalStream();
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
            toast.success("Friend Connected! 🎉");
            setActivePeers(prev => {
              if (prev.some(p => p.peerId === presence.userId)) return prev;
              return [...prev, { peerId: presence.userId, name: presence.name, stream: null }];
            });
            handleOffer(presence.userId, presence.name, stream);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: any) => {
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
        } catch (e) {}
      }
    });

    // 🔴 Full App Screen & Video Sync Receiver
    channel.on('broadcast', { event: 'app-sync' }, ({ payload }) => {
      if (payload.senderId !== effectiveUserId) {
        if (payload.path && payload.path !== window.location.pathname) {
          window.location.href = payload.path;
        }
        if (payload.videoId) {
          setRemoteVideoId(payload.videoId);
        }
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: effectiveUserId, name: effectiveUserName });
      }
    });
  };

  const handleOffer = async (targetId: string, peerName: string, stream: MediaStream | null) => {
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

  // 🔴 Universal Remote Screen Broadcast Engine
  const broadcastVideoChange = (videoId: string, path?: string) => {
    if (channelRef.current && activeRoomId) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'app-sync',
        payload: { 
          senderId: effectiveUserId, 
          videoId,
          path: path || window.location.pathname 
        }
      });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const copyPartyLink = async () => {
    if (!activeRoomId) return;
    const inviteUrl = `${window.location.origin}/?partyRoom=${activeRoomId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Chiti Shorts Watch Party', url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Party Link Copied!");
      }
    } catch (e) {}
  };

  return (
    <WatchPartyContext.Provider value={{ activeRoomId, startParty, leaveParty: stopAllMedia, broadcastVideoChange, remoteVideoId }}>
      {children}

      {/* 🔴 ALWAYS VISIBLE CLEAN CAMERA BUBBLES */}
      {activeRoomId && (
        <div className="fixed top-14 right-3 z-[99999] flex flex-col gap-2 items-end pointer-events-auto">
          {/* Local User */}
          <RemoteVideoBubble stream={localStreamRef.current} isLocal={true} />

          {/* Connected Remote Friend */}
          {activePeers.map(peer => (
            <RemoteVideoBubble key={peer.peerId} stream={peer.stream} isLocal={false} />
          ))}

          <div className="flex items-center gap-1.5 bg-black/80 p-2 rounded-full border border-white/20 shadow-2xl backdrop-blur-md mt-1">
            <button onClick={toggleMute} className="p-1.5 text-white">
              {audioEnabled ? <Mic size={14}/> : <MicOff size={14} className="text-red-500"/>}
            </button>
            <button onClick={toggleVideo} className="p-1.5 text-white">
              {videoEnabled ? <Video size={14}/> : <VideoOff size={14} className="text-red-500"/>}
            </button>
            <button onClick={copyPartyLink} className="p-1.5 text-blue-400">
              <Share2 size={14}/>
            </button>
            <button onClick={stopAllMedia} className="p-1.5 bg-red-600 text-white rounded-full">
              <PhoneOff size={14}/>
            </button>
          </div>
        </div>
      )}
    </WatchPartyContext.Provider>
  );
};

export const useWatchParty = () => useContext(WatchPartyContext);
