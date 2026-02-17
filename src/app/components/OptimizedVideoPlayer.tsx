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
 const [isLoaded, setIsLoaded] = useState(false);

 const currentFilter = FILTERS_DATA[filterName] || FILTERS_DATA.none;
 const gridCount = currentFilter.isGrid ? currentFilter.gridCount : 1;

 // 🚀 SPEED JUGAR 1: Metadata over Download
 useEffect(() => {
  if (videoRef.current) {
   setIsLoaded(false);
   videoRef.current.load();
  }
 }, [videoUrl]);

 // 🚀 SPEED JUGAR 2: Aggressive Playback
 useEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  
  if (isActive) {
   video.muted = false; 
   const playPromise = video.play();
   
   if (playPromise !== undefined) {
    playPromise.then(() => {
     setIsLoaded(true); // Play shuru hote hi loader khatam
     secondaryRefs.current.forEach((v) => {
      if (v) {
       v.currentTime = video.currentTime;
       v.play().catch(() => {});
      }
     });
    }).catch(() => {
     // Browser block fallback
     video.muted = true;
     video.play().then(() => setIsLoaded(true));
    });
   }
  } else {
   video.pause();
   secondaryRefs.current.forEach((v) => v?.pause());
  }
 }, [isActive]);

 return (
  <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
   
   {/* Fast Skeleton Loader */}
   {!isLoaded && (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
     <div className="flex flex-col items-center gap-2">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <Zap size={14} className="text-blue-500 animate-pulse"/>
     </div>
    </div>
   )}

   <div className={`w-full h-full transition-all duration-300 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} ${currentFilter.isGrid ? 'grid' : ''}`}
        style={currentFilter.isGrid ? { 
          gridTemplateColumns: `repeat(${currentFilter.cols}, 1fr)`,
          gridTemplateRows: `repeat(${currentFilter.rows}, 1fr)` 
        } : {}}>
    
    {[...Array(gridCount)].map((_, i) => (
     <div key={i} className="relative w-full h-full overflow-hidden bg-zinc-950">
      <video
       ref={(el) => {
        if (i === 0) (videoRef as any).current = el;
        else secondaryRefs.current[i] = el;
       }}
       className="w-full h-full object-cover"
       src={videoUrl}
       loop
       playsInline
       // 🔥 INSTAGRAM STREAMING LOGIC
       preload="auto"
       // @ts-ignore
       fetchpriority={isActive ? "high" : "low"}
       // onLoadedMetadata = Jab video ka pehla byte mil jaye tabhi show karo
       onLoadedMetadata={() => i === 0 && setIsLoaded(true)}
       onWaiting={() => i === 0 && setIsLoaded(false)}
       onPlaying={() => i === 0 && setIsLoaded(true)}
       crossOrigin="anonymous"
       style={{ filter: currentFilter.style }}
      />
     </div>
    ))}

    {isActive && currentFilter.vfxType === 'lightning' && (
     <div className="absolute inset-0 z-10 pointer-events-none bg-blue-500/10 animate-pulse" />
    )}

    {isActive && filterName !== 'none' && (
     <div className="absolute top-24 left-6 z-30 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 pointer-events-none">
       <Sparkles size={10} className="text-blue-400"/>
       <span className="text-[9px] font-bold uppercase tracking-widest text-white">{currentFilter.name}</span>
     </div>
    )}
   </div>
  </div>
 );
}
