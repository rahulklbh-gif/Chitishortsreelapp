"use client";

import { useEffect, useRef, useState } from 'react';
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

export function OptimizedVideoPlayer({ videoUrl: rawVideoUrl, videoId, isActive, filterName = 'none' }: any) {
 // ✅ SMART LINK FIX + FAST START TRICK
 // #t=0.001 browser ko metadata aur pehla frame jaldi fetch karne pe majboor karta hai
 const videoUrl = rawVideoUrl?.replace(
   /pub-[a-zA-Z0-9]+\.r2\.dev/g, 
   'cdn.chitishort.store'
 ) + "#t=0.001";

 const videoRef = useRef<HTMLVideoElement>(null);
 const secondaryRefs = useRef<(HTMLVideoElement | null)[]>([]);
 const [isLoaded, setIsLoaded] = useState(false);
 const [isBuffering, setIsBuffering] = useState(false);

 const currentFilter = FILTERS_DATA[filterName] || FILTERS_DATA.none;
 const gridCount = currentFilter.isGrid ? currentFilter.gridCount : 1;

 // 🚀 JUGAR 1: Resource Pre-connection (Preload optimized for CDN)
 useEffect(() => {
  if (videoUrl) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = videoUrl;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch(e) {} };
  }
 }, [videoUrl]);

 useEffect(() => {
  setIsLoaded(false);
  setIsBuffering(false);
  if (videoRef.current) {
    videoRef.current.load();
  }
 }, [videoUrl]);

 // 🚀 JUGAR 2: Aggressive Buffer & Sound Management
 useEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  
  if (isActive) {
    // Ultra-fast start ke liye pehle mute rakhte hain
    video.muted = true; 
    
    const playPromise = video.play();
    
    if (playPromise !== undefined) {
     playPromise.then(() => {
      setIsLoaded(true);
      setIsBuffering(false);
      
      // Successfully play hone ke baad unmute
      video.muted = false;

      // Sync secondary grid videos
      secondaryRefs.current.forEach(v => {
       if(v) { 
         v.currentTime = video.currentTime; 
         v.play().catch(() => {}); 
       }
      });
     }).catch((error) => {
      console.log("Autoplay check failed, forcing muted play...");
      video.muted = true;
      video.play().then(() => setIsLoaded(true));
     });
    }
  } else {
    video.pause();
    secondaryRefs.current.forEach(v => v?.pause());
  }
 }, [isActive]);

 return (
  <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
    
    {/* 🔥 ULTRA FAST LOADER UI */}
    {(!isLoaded || isBuffering) && (
     <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
      <div className="flex flex-col items-center gap-3">
       <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
       <div className="flex items-center gap-2">
        <Zap size={16} className="text-blue-500 animate-pulse"/>
        <span className="text-blue-500 text-[10px] font-black uppercase tracking-widest">Boosted Speed...</span>
       </div>
      </div>
     </div>
    )}

    <div className={`w-full h-full transition-all duration-500 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} ${currentFilter.isGrid ? 'grid' : ''}`}
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
        autoPlay={isActive}
        muted={i !== 0 || !isActive}
        // 🔥 OPTIMIZED PRELOAD
        preload="auto"
        // @ts-ignore
        fetchpriority={isActive ? "high" : "low"}
        // Event handling (Purane functions intact hain)
        onLoadedMetadata={() => i === 0 && setIsLoaded(true)}
        onWaiting={() => i === 0 && setIsBuffering(true)}
        onPlaying={() => i === 0 && (setIsBuffering(false), setIsLoaded(true))}
        onCanPlay={() => i === 0 && setIsLoaded(true)}
        onCanPlayThrough={() => i === 0 && setIsLoaded(true)}
        crossOrigin="anonymous"
        style={{ filter: currentFilter.style }}
       />
      </div>
     ))}

     {/* VFX Overlay (Purana logic) */}
     {isActive && currentFilter.vfxType === 'lightning' && (
      <div className="absolute inset-0 z-10 pointer-events-none bg-blue-500/10 animate-pulse" />
     )}
    </div>
  </div>
 );
} 
