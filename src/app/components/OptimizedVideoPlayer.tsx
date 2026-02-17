"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Zap } from 'lucide-react';

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

export function OptimizedVideoPlayer({ videoUrl, videoId, isActive, filterName = 'none' }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const secondaryRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const currentFilter = FILTERS_DATA[filterName] || FILTERS_DATA.none;
  const gridCount = currentFilter.isGrid ? currentFilter.gridCount : 1;

  // URL change par loading state reset karein
  useEffect(() => {
    setIsLoaded(false);
  }, [videoUrl]);

  // R2 Video Playback Sync
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isActive) {
      // Browser ko force karein playback start karne ke liye
      videoRef.current.muted = true;
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsLoaded(true);
          // Sync secondary videos for grid filters
          secondaryRefs.current.forEach(v => {
            if (v) {
              v.currentTime = videoRef.current!.currentTime;
              v.play().catch(() => {});
            }
          });
        }).catch(err => {
          console.error("R2 Playback Error:", err);
          // Agar autoplay block ho toh bhi loader hatao
          setIsLoaded(true);
        });
      }
    } else {
      videoRef.current.pause();
      secondaryRefs.current.forEach(v => v?.pause());
    }
  }, [isActive, videoUrl]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* 🔄 Processing/Loading Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-30">
          <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <Zap size={16} className="mt-4 text-blue-500 animate-pulse" />
        </div>
      )}

      <div className={`w-full h-full ${currentFilter.isGrid ? 'grid' : ''}`}
           style={currentFilter.isGrid ? { 
             gridTemplateColumns: `repeat(${currentFilter.cols}, 1fr)`,
             gridTemplateRows: `repeat(${currentFilter.rows}, 1fr)` 
           } : {}}>
        
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full bg-zinc-950">
            <video
              ref={(el) => { if (i === 0) (videoRef as any).current = el; else secondaryRefs.current[i] = el; }}
              src={videoUrl}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
              // 🔥 R2 Compatibility fix: crossOrigin set karna zaroori hai
              crossOrigin="anonymous"
              preload="auto"
              onLoadedData={() => i === 0 && setIsLoaded(true)}
              onCanPlay={() => i === 0 && setIsLoaded(true)}
              style={{ filter: currentFilter.style }}
            />
          </div>
        ))}

        {/* Filters/VFX (Original) */}
        {isActive && currentFilter.vfxType === 'lightning' && (
          <div className="absolute inset-0 z-10 pointer-events-none bg-blue-400/10 animate-pulse" />
        )}
        {isActive && filterName !== 'none' && (
          <div className="absolute top-24 left-6 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <Sparkles size={12} className="text-blue-400"/>
            <span className="text-[10px] font-bold text-white uppercase">{currentFilter.name}</span>
          </div>
        )}
      </div>
    </div>
  );
} 
