"use client";

import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { useWatchParty } from '@/contexts/WatchPartyContext';

interface WatchPartyManagerProps {
  videoId?: string;
  roomId?: string;
  onClose?: () => void;
}

export default function WatchPartyManager({ videoId, roomId: propRoomId, onClose }: WatchPartyManagerProps) {
  const { startParty, activeRoomId } = useWatchParty();

  const handleStart = () => {
    const finalRoom = propRoomId || `room_${videoId?.substring(0, 5) || 'party'}_${Math.random().toString(36).substring(2, 7)}`;
    startParty(finalRoom, videoId);
    if (onClose) onClose();
  };

  // Agar Watch Party pehle se active hai, toh dobara modal mat dikhao (Floating Bubbles already screen par rahenge)
  if (activeRoomId) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 text-white">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-white/10">
          <X size={16} />
        </button>

        <div className="p-3 bg-purple-600/30 rounded-full border border-purple-500/50">
          <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
        </div>
        <h2 className="text-lg font-black tracking-wide">Live Watch Party 🎉</h2>
        <p className="text-xs text-zinc-400 text-center">Doston ko invite karke ek sath video dekho aur live camera/voice par baat karo!</p>
        
        <button 
          onClick={handleStart}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg text-white active:scale-95 transition-all font-bold"
        >
          Start Watch Party Now
        </button>
      </div>
    </div>
  );
}
