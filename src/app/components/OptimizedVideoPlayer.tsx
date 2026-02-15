"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
// ✅ FIXED: Missing 'Check' icon add kiya
import { Sparkles, Music, Zap, Check } from 'lucide-react';

/**
 * 🎨 MASTER FILTERS DATA
 */
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.5px)" },
  storm: { name: "Lightning", style: "contrast(1.3) brightness(1.1)", isVFX: true, vfxType: 'lightning' },
  pulse: { name: "Flash Beat", style: "", isVFX: true, vfxType: 'pulse' },
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, cols: 2, rows: 2 },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, cols: 2, rows: 3 },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, cols: 1, rows: 3 },
  cine: { name: "CineMax", style: "contrast(1.6) saturate(0.8) brightness(0.9)" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)" },
  retro: { name: "Vintage", style: "sepia(0.8) contrast(1.2) brightness(0.9)" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.8)" },
  warm: { name: "Sunny", style: "sepia(0.4) saturate(1.6) brightness(1.1)" },
  gold: { name: "Royal Gold", style: "sepia(0.5) brightness(1.1) saturate(2)" },
  cyber: { name: "Cyberpunk", style: "hue-rotate(280deg) saturate(2) contrast(1.2)" },
  dream: { name: "Dreamy", style: "blur(1.2px) brightness(1.2)" },
  mono: { name: "Classic", style: "grayscale(1) contrast(1.1)" },
  vivid: { name: "Ultra Vivid", style: "saturate(3) contrast(1.2)" },
  ocean: { name: "Oceanic", style: "hue-rotate(180deg) brightness(1.1)" }
};

interface OptimizedVideoPlayerProps {
  videoUrl: string;
  videoId: string;
  isActive: boolean;
  username?: string;
  avatarUrl?: string;
  caption?: string;
  filterName?: string;
}

export function OptimizedVideoPlayer({
  videoUrl,
  videoId,
  isActive,
  username,
  avatarUrl,
  caption,
  filterName = 'none'
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const secondaryRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const hasCounted = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const currentFilter = FILTERS_DATA[filterName] || FILTERS_DATA.none;
  const gridCount = currentFilter.isGrid ? currentFilter.gridCount : 1;

  let gridContainerClass = "w-full h-full";
  if (currentFilter.isGrid) {
    if (gridCount === 4) gridContainerClass = "w-full h-full grid grid-cols-2 grid-rows-2";
    if (gridCount === 6) gridContainerClass = "w-full h-full grid grid-cols-2 grid-rows-3";
    if (gridCount === 3) gridContainerClass = "w-full h-full grid grid-cols-1 grid-rows-3";
  }

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  // --- VIEW COUNTER (Safe Version) ---
  useEffect(() => {
    let timer: any; // Changed to any to prevent crash
    if (isActive && !hasCounted.current && videoId) {
      timer = setTimeout(async () => {
        try {
          const { error } = await supabase.rpc('increment_views', { post_id: videoId });
          if (!error) hasCounted.current = true;
        } catch (err) {
          console.error("View update failed", err);
        }
      }, 3000); 
    }
    return () => clearTimeout(timer);
  }, [isActive, videoId]);

  // --- PLAY/PAUSE SYNC ---
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isActive) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          secondaryRefs.current.forEach((v) => {
            if (v) {
              v.currentTime = videoRef.current!.currentTime;
              v.play().catch(() => {});
            }
          });
        }).catch(() => {});
      }
    } else {
      videoRef.current.pause();
      secondaryRefs.current.forEach((v) => v?.pause());
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <Zap size={18} className="text-blue-900 animate-pulse"/>
          </div>
        </div>
      )}

      <div className={`${gridContainerClass} transition-all duration-700 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full overflow-hidden border-[0.2px] border-white/5 bg-zinc-900">
            <video
              ref={(el) => {
                if (i === 0) (videoRef as any).current = el;
                else secondaryRefs.current[i] = el;
              }}
              className="w-full h-full object-cover"
              src={videoUrl}
              loop
              muted={!isActive || i !== 0}
              playsInline
              autoPlay={isActive}
              preload="auto"
              style={{ filter: currentFilter.style }}
              onLoadedData={() => i === 0 && setIsLoaded(true)}
            />
          </div>
        ))}

        {/* VFX Effects */}
        {isActive && currentFilter.vfxType === 'lightning' && (
          <div className="absolute inset-0 z-10 pointer-events-none bg-blue-500/10 animate-pulse" />
        )}
      </div>
      
      {/* UI OVERLAY */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-28 bg-gradient-to-t from-black/90 via-transparent to-transparent text-white pointer-events-none z-30">
        
        <div className="flex items-center gap-3 mb-3">
          <div className="relative pointer-events-auto">
            <img 
              src={avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'} 
              className="w-12 h-12 rounded-full border-2 border-blue-500 object-cover" 
              alt="creator"
            />
            <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-0.5 border border-black">
               <Check size={10} className="text-white" strokeWidth={4}/>
            </div>
          </div>
          <div className="pointer-events-auto">
            <h3 className="font-black text-base italic flex items-center gap-1 uppercase">
              {username || 'chiti_user'} 
              <Zap size={14} className="text-yellow-400" fill="currentColor"/>
            </h3>
          </div>
        </div>

        <p className="text-sm mb-4 line-clamp-2 max-w-[85%] pointer-events-auto">
          {caption}
        </p>
        
        {filterName !== 'none' && (
          <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10 pointer-events-auto">
             <Sparkles size={12} className="text-blue-400 fill-blue-400"/>
             <span className="text-[10px] font-black uppercase italic">{currentFilter.name}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
} 
