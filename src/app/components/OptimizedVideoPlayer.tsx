import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

// --- FILTERS DATA (Create Page se match karne ke liye) ---
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.5px)" },
  storm: { name: "Lightning", style: "contrast(1.3) brightness(1.1)", isVFX: true, vfxType: 'lightning' },
  pulse: { name: "Flash Beat", style: "", isVFX: true, vfxType: 'pulse' },
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4 },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6 },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3 },
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
  filterName?: string; // --- NAYA PROP ---
}

export function OptimizedVideoPlayer({
  videoUrl,
  videoId,
  isActive,
  username,
  avatarUrl,
  caption,
  filterName = 'none' // Default none
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasCounted = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter info nikalna
  const currentFilter = FILTERS_DATA[filterName] || FILTERS_DATA.none;
  const gridCount = currentFilter.isGrid ? currentFilter.gridCount : 1;

  // Grid ke liye CSS classes set karna
  let gridContainerClass = "w-full h-full";
  if (currentFilter.isGrid) {
    if (gridCount === 4) gridContainerClass = "w-full h-full grid grid-cols-2 grid-rows-2";
    if (gridCount === 6) gridContainerClass = "w-full h-full grid grid-cols-2 grid-rows-3";
    if (gridCount === 3) gridContainerClass = "w-full h-full grid grid-cols-1 grid-rows-3";
  }

  // --- 🚀 SPEED BOOSTER ---
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  // --- VIEW COUNT LOGIC ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActive && !hasCounted.current && videoId) {
      timer = setTimeout(async () => {
        try {
          const { error } = await supabase.rpc('increment_views', { 
            post_id: videoId 
          });
          if (!error) {
            hasCounted.current = true;
          }
        } catch (err) {
          console.error("View error:", err);
        }
      }, 2000); 
    }
    return () => clearTimeout(timer);
  }, [isActive, videoId]);

  // --- PLAY/PAUSE CONTROL ---
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isActive) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => console.log("Autoplay blocked"));
      }
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; 
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* Loading Spinner */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* --- GRID & FILTER ENGINE --- */}
      <div className={gridContainerClass}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full overflow-hidden border-[0.5px] border-white/5">
            <video
              ref={i === 0 ? videoRef : null} // Sirf pehle video ka ref control ke liye
              className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              src={videoUrl}
              loop
              muted={!isActive || i !== 0} // Sirf pehle video se sound aaye
              playsInline
              preload="auto"
              style={{ filter: currentFilter.style }}
              onCanPlay={() => setIsLoaded(true)}
              // Baaki videos ko sync karne ke liye (Grids mein)
              onPlay={(e) => {
                 if(i === 0) return;
                 e.currentTarget.currentTime = videoRef.current?.currentTime || 0;
              }}
            />
          </div>
        ))}

        {/* VFX Overlays (Lightning/Pulse) */}
        {currentFilter.vfxType === 'lightning' && (
          <div className="absolute inset-0 bg-blue-400/10 animate-pulse pointer-events-none z-10" />
        )}
      </div>
      
      {/* --- UI OVERLAY --- */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white pointer-events-none z-30">
        
        <div className="flex items-center gap-3 mb-3">
          <img 
            src={avatarUrl || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} 
            className="w-11 h-11 rounded-full border-2 border-white shadow-lg object-cover pointer-events-auto" 
            alt="avatar"
          />
          <div className="pointer-events-auto">
            <p className="font-black text-lg shadow-black drop-shadow-lg">@{username || 'user'}</p>
          </div>
        </div>

        <p className="text-sm mb-4 line-clamp-2 drop-shadow-md pointer-events-auto">{caption}</p>
        
        {/* Filter Name Tag (Optional UI) */}
        {filterName !== 'none' && (
          <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-1 rounded-md mb-2">
             <Sparkles size={10} className="text-blue-400"/>
             <span className="text-[10px] font-bold uppercase">{currentFilter.name}</span>
          </div>
        )}

        <p className="text-[10px] opacity-30 mt-1">ID: {videoId}</p>
      </div>
    </div>
  );
}

// Icons import for the tag
import { Sparkles } from 'lucide-react';
