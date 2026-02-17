"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Zap } from 'lucide-react';

/**
 * 🎨 MASTER FILTERS DATA (Original Full List)
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
  filterName = 'none'
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const secondaryRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const hasCounted = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  const currentFilter = FILTERS_DATA[filterName] || FILTERS_DATA.none;
  const gridCount = currentFilter.isGrid ? currentFilter.gridCount : 1;

  // Grid Structure Logic
  let gridContainerClass = "w-full h-full";
  if (currentFilter.isGrid) {
    if (gridCount === 4) gridContainerClass = "w-full h-full grid grid-cols-2 grid-rows-2";
    if (gridCount === 6) gridContainerClass = "w-full h-full grid grid-cols-2 grid-rows-3";
    if (gridCount === 3) gridContainerClass = "w-full h-full grid grid-cols-1 grid-rows-3";
  }

  // --- LOADING & COMPRESSION RESET ---
  useEffect(() => {
    setIsLoaded(false);
    setError(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
    
    // Safety Fallback: Agar video data send na kare toh 3s baad loader hatao
    const timer = setTimeout(() => {
      if (!isLoaded) setIsLoaded(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [videoUrl]);

  // --- UNIQUE VIEW COUNTER (Original Logic) ---
  useEffect(() => {
    let timer: any; 
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

  // --- PLAY/PAUSE & GRID SYNC (Full Logic) ---
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isActive) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsLoaded(true);
          // Sync secondary grid videos
          secondaryRefs.current.forEach((v) => {
            if (v) {
              v.currentTime = videoRef.current!.currentTime;
              v.play().catch(() => {});
            }
          });
        }).catch((err) => {
          console.log("Autoplay prevented or video error", err);
        });
      }
    } else {
      videoRef.current.pause();
      secondaryRefs.current.forEach((v) => v?.pause());
    }
  }, [isActive, videoUrl]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      
      {/* 🔄 LOADING STATE (Full UI) */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-30">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-blue-500 animate-pulse"/>
              <span className="text-blue-500 font-bold text-xs uppercase tracking-tighter">Processing VFX...</span>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ ERROR STATE */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-30">
          <p className="text-white text-xs">Video format not supported</p>
        </div>
      )}

      {/* 🎥 VIDEO GRID LAYER (Original Complex Render) */}
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
              preload="auto"
              // Faster loading flags
              // @ts-ignore
              fetchpriority={isActive ? "high" : "low"}
              onLoadedData={() => { if(i === 0) setIsLoaded(true); }}
              onCanPlay={() => { if(i === 0) setIsLoaded(true); }}
              onError={() => { if(i === 0) setError(true); setIsLoaded(true); }}
              style={{ filter: currentFilter.style }}
            />
          </div>
        ))}

        {/* ⚡ VFX OVERLAY (Lightning/Pulse) */}
        {isActive && currentFilter.vfxType === 'lightning' && (
          <div className="absolute inset-0 z-10 pointer-events-none bg-blue-400/10 animate-pulse mix-blend-overlay" />
        )}
        {isActive && currentFilter.vfxType === 'pulse' && (
          <div className="absolute inset-0 z-10 pointer-events-none animate-[ping_2s_infinite] border-4 border-white/10" />
        )}

        {/* ✨ FILTER NAME BADGE */}
        {isActive && filterName !== 'none' && (
          <div className="absolute top-24 left-6 z-30 flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 pointer-events-none">
            <Sparkles size={12} className="text-yellow-400 animate-spin-slow"/>
            <span className="text-[10px] font-black uppercase tracking-widest text-white shadow-lg">{currentFilter.name}</span>
          </div>
        )}
      </div>

      {/* 🎨 CUSTOM CSS FOR ANIMATIONS */}
      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 
