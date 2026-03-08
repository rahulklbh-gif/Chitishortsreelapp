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

export function OptimizedVideoPlayer({ 
  videoUrl: rawVideoUrl, 
  videoId, 
  isActive, 
  filterName = 'none', 
  textOverlays = [], 
  isFrontCamera = false 
}: any) {
 
 const videoUrl = rawVideoUrl?.replace(/pub-[a-zA-Z0-9]+\.r2\.dev/g, 'cdn.chitishort.store') + "#t=0.001";

 const videoRef = useRef<HTMLVideoElement>(null);
 const secondaryRefs = useRef<(HTMLVideoElement | null)[]>([]);
 const [isLoaded, setIsLoaded] = useState(false);
 const [isBuffering, setIsBuffering] = useState(false);
 const [parsedOverlays, setParsedOverlays] = useState<any[]>([]);

 // 🚀 FIX 1: JSON Parsing Logic (Screenshot ke hisaab se)
 useEffect(() => {
  if (typeof textOverlays === 'string') {
    try {
      setParsedOverlays(JSON.parse(textOverlays));
    } catch (e) {
      setParsedOverlays([]);
    }
  } else {
    setParsedOverlays(textOverlays || []);
  }
 }, [textOverlays]);

 // Preload logic intact
 useEffect(() => {
  if (videoUrl) {
    const link = document.createElement('link');
    link.rel = 'preload'; link.as = 'video'; link.href = videoUrl;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch(e) {} };
  }
 }, [videoUrl]);

 // Fast Playback Logic intact
 useEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  if (isActive) {
    video.muted = true; 
    video.play().then(() => {
      setIsLoaded(true);
      setIsBuffering(false);
      video.muted = false;
      secondaryRefs.current.forEach(v => { if(v) { v.currentTime = video.currentTime; v.play().catch(() => {}); } });
    }).catch(() => { video.muted = true; video.play(); });
  } else {
    video.pause();
    secondaryRefs.current.forEach(v => v?.pause());
  }
 }, [isActive]);

 const currentFilter = FILTERS_DATA[filterName] || FILTERS_DATA.none;
 const gridCount = currentFilter.isGrid ? currentFilter.gridCount : 1;

 return (
  <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
    {(!isLoaded || isBuffering) && (
     <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
        <Zap size={24} className="text-blue-500 animate-bounce"/>
     </div>
    )}

    <div className={`w-full h-full transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${currentFilter.isGrid ? 'grid' : ''}`}
          style={currentFilter.isGrid ? { 
            gridTemplateColumns: `repeat(${currentFilter.cols}, 1fr)`,
            gridTemplateRows: `repeat(${currentFilter.rows}, 1fr)` 
          } : {}}>
    
      {[...Array(gridCount)].map((_, i) => (
       <div key={i} className="relative w-full h-full overflow-hidden bg-zinc-950">
        <video
         ref={(el) => { if (i === 0) (videoRef as any).current = el; else secondaryRefs.current[i] = el; }}
         className="w-full h-full object-cover"
         src={videoUrl}
         loop playsInline
         muted={i !== 0 || !isActive}
         crossOrigin="anonymous"
         // 🚀 FIX 2: Front Camera Mirroring Fix
         style={{ 
           filter: currentFilter.style, 
           transform: isFrontCamera ? 'scaleX(-1)' : 'none' 
         }}
        />

        {/* 🚀 FIX 3: Text Overlay Rendering with Mirror Correction */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {parsedOverlays.map((t: any, idx: number) => (
            <div
              key={idx}
              className="absolute"
              style={{
                top: `${t.y}%`,
                left: `${t.x}%`,
                // Video mirror hai toh text ko wapas flip karo (isFrontCamera fix)
                transform: `translate(-50%, -50%) ${isFrontCamera ? 'scaleX(-1)' : ''}`,
              }}
            >
              <span
                style={{ color: t.color, fontSize: `${t.fontSize}px`, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                className={`whitespace-nowrap px-2 block ${t.fontStyle === 'classic' ? 'font-black italic' : 'font-sans'}`}
              >
                {t.text}
              </span>
            </div>
          ))}
        </div>
       </div>
      ))}
    </div>
  </div>
 );
}
