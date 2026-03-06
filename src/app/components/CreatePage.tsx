"use client";

/**
 * PROJECT: CHITI SHORT VIDEO CREATOR PRO
 * VERSION: 4.8.8 (Full Screen + Mirror Fix + Draggable Text)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, 
  ShieldCheck, Search, Info, Settings, Scissors, HardDrive,
  MonitorPlay, Mic, Volume2, Clapperboard, Layers, Trash2, Type
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p } from '@/lib/videoCompression';

const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://cdn.chitishort.store"
};

const FILTERS_DATA: any = {
  none: { name: "Normal", style: "none", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Glow", style: "brightness(1.2) blur(0.6px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  cine: { name: "Cinema", style: "contrast(1.6) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Vintage", style: "sepia(0.8) contrast(1.2) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.8)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  warm: { name: "Warmth", style: "sepia(0.4) saturate(1.6) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  gold: { name: "Golden", style: "sepia(0.5) brightness(1.1) saturate(2)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  cyber: { name: "Cyber", style: "hue-rotate(280deg) saturate(2) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  vivid: { name: "Vivid", style: "saturate(3) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  mono: { name: "Mono", style: "grayscale(1) brightness(1.2)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  faded: { name: "Faded", style: "opacity(0.8) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  sunset: { name: "Sunset", style: "hue-rotate(-20deg) saturate(1.4)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  ocean: { name: "Ocean", style: "hue-rotate(160deg) saturate(1.3)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  quad: { name: "4-Grid", style: "none", isGrid: true, gridCount: 4, cols: "grid-cols-2", rows: "grid-rows-2", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "none", isGrid: true, gridCount: 6, cols: "grid-cols-2", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "Stacked", style: "none", isGrid: true, gridCount: 3, cols: "grid-cols-1", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" }
};

const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint,
  credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
  forcePathStyle: true,
});

export default function CreatePage() {
  const { user } = useAuth();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState(""); 
  
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationLimit, setDurationLimit] = useState(15);
  const [timer, setTimer] = useState(0);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [query, setQuery] = useState(''); 
  const [activeMusic, setActiveMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [audioPlayId, setAudioPlayId] = useState<string | null>(null);

  // --- TEXT SYSTEM ---
  const [textOverlays, setTextOverlays] = useState<any[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [currentColor, setCurrentColor] = useState("#ffffff");
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMusic = async () => {
      const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
      if (data) setMusicList(data);
    };
    loadMusic();
  }, []);

  const initCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      toast.error("Camera access denied!");
      setIsCameraMode(false);
    }
  }, [facing]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) initCamera();
  }, [isCameraMode, initCamera, previewUrl]);

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], 'chiti.webm'));
      setIsRecording(false);
    };
    if (activeMusic && audioRef.current) audioRef.current.play();
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimer(0);
    countdownRef.current = setInterval(() => setTimer(p => p + 1), 1000);
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    clearInterval(countdownRef.current);
    if (audioRef.current) audioRef.current.pause();
  };

  // --- TEXT DRAG LOGIC ---
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingId === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    setTextOverlays(prev => prev.map(t => t.id === draggingId ? { ...t, x, y } : t));
  };

  const publish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setStatusText("Processing your Short...");
    try {
      const optimized = await compressVideoTo480p(selectedFile, (p) => setUploadProgress(10 + Math.floor(p.progress * 40)));
      const fileName = `${Date.now()}_short.mp4`;
      const path = `chiti_vids/${user.id}/${fileName}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: path,
        Body: new Uint8Array(await optimized.arrayBuffer()),
        ContentType: 'video/mp4'
      }));
      await supabase.from('posts').insert([{
        video_url: `${R2_CONFIG.publicDomain}/${path}`,
        caption: caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Creator'
      }]);
      toast.success("Published!");
      window.location.href = '/';
    } catch (e) {
      toast.error("Upload failed");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden" 
         onMouseMove={handleMouseMove} onTouchMove={handleMouseMove} onMouseUp={() => setDraggingId(null)} onTouchEnd={() => setDraggingId(null)}>
      
      {!isFinalStep && (
        <header className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[200] bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={() => isCameraMode ? (previewUrl ? setPreviewUrl('') : setIsCameraMode(false)) : window.history.back()} className="p-3 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
            <X size={24}/>
          </button>
          <button onClick={() => setShowMusic(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20">
            <Music size={16} className="text-pink-500"/>
            <span className="text-xs font-bold truncate max-w-[100px]">{activeMusic ? activeMusic.title : "Add Sound"}</span>
          </button>
          <button className="p-3 bg-black/20 backdrop-blur-md rounded-full border border-white/10"><Settings size={22}/></button>
        </header>
      )}

      <main ref={containerRef} className="flex-1 relative bg-black flex flex-col">
        {!isCameraMode && !previewUrl ? (
          <div className="h-full flex flex-col items-center justify-center gap-10">
            <button onClick={() => setIsCameraMode(true)} className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
              <Camera size={48}/>
            </button>
            <label className="bg-zinc-900/80 px-8 py-4 rounded-2xl border border-white/10 cursor-pointer flex items-center gap-3">
              <Upload size={20}/> <span className="font-bold uppercase text-xs">Upload Gallery</span>
              <input type="file" hidden accept="video/*" onChange={e => {
                const f = e.target.files?.[0];
                if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }
              }}/>
            </label>
          </div>
        ) : !isFinalStep ? (
          <div className="h-full w-full relative">
            {/* FULL SCREEN VIDEO ENGINE */}
            <div className="absolute inset-0 z-0">
                {!previewUrl ? (
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" 
                    style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none', filter: FILTERS_DATA[selectedFilter].style }} />
                ) : (
                  <video ref={previewVideoRef} src={previewUrl} autoPlay loop playsInline className="h-full w-full object-cover" 
                    style={{ filter: FILTERS_DATA[selectedFilter].style }} />
                )}
            </div>

            {/* TEXT OVERLAYS (ONLY ON PREVIEW) */}
            {previewUrl && textOverlays.map(t => (
              <div 
                key={t.id} 
                onMouseDown={() => setDraggingId(t.id)}
                onTouchStart={() => setDraggingId(t.id)}
                className="absolute z-[250] cursor-move select-none flex items-center group touch-none"
                style={{ top: `${t.y}%`, left: `${t.x}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span className="text-3xl font-black italic uppercase drop-shadow-2xl px-2" style={{ color: t.color }}>{t.text}</span>
                <button onClick={() => setTextOverlays(prev => prev.filter(x => x.id !== t.id))} className="bg-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={16}/>
                </button>
              </div>
            ))}

            {/* SIDE TOOLS */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-[210]">
               {!previewUrl ? (
                 <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="p-3 bg-black/40 rounded-xl backdrop-blur-md border border-white/10 flex flex-col items-center">
                    <RefreshCw size={24}/> <span className="text-[9px] mt-1 font-bold">FLIP</span>
                 </button>
               ) : (
                 <button onClick={() => setIsAddingText(true)} className="p-3 bg-black/40 rounded-xl backdrop-blur-md border border-white/10 flex flex-col items-center text-yellow-400">
                    <Type size={24}/> <span className="text-[9px] mt-1 font-bold text-white">TEXT</span>
                 </button>
               )}
               <button onClick={() => setShowFilters(true)} className="p-3 bg-black/40 rounded-xl backdrop-blur-md border border-white/10 flex flex-col items-center text-cyan-400">
                  <Sparkles size={24}/> <span className="text-[9px] mt-1 font-bold text-white">FILTER</span>
               </button>
            </div>

            {/* BOTTOM CONTROLS */}
            <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6 z-[210]">
               {!previewUrl ? (
                 <>
                   <div className="flex bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10">
                      {[15, 30].map(s => (
                        <button key={s} onClick={() => setDurationLimit(s)} className={`px-6 py-1.5 rounded-full text-[10px] font-black ${durationLimit === s ? 'bg-white text-black' : 'text-white'}`}>{s}s</button>
                      ))}
                   </div>
                   <button onClick={isRecording ? stopRec : startRec} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-600' : 'border-white'}`}>
                      <div className={`bg-red-600 transition-all ${isRecording ? 'w-8 h-8 rounded-lg animate-pulse' : 'w-14 h-14 rounded-full'}`}/>
                   </button>
                 </>
               ) : (
                 <div className="flex gap-4 w-full px-10">
                    <button onClick={() => {setPreviewUrl(''); setTextOverlays([]);}} className="flex-1 py-4 bg-zinc-900/90 rounded-2xl font-black uppercase text-xs border border-white/10 backdrop-blur-md">Discard</button>
                    <button onClick={() => setIsFinalStep(true)} className="flex-1 py-4 bg-red-600 rounded-2xl font-black uppercase text-xs shadow-xl shadow-red-900/20">Next</button>
                 </div>
               )}
            </div>
          </div>
        ) : (
          <div className="h-full bg-zinc-950 p-8 pt-20">
              <div className="flex gap-4 mb-8">
                 <div className="w-24 h-40 rounded-xl overflow-hidden border border-white/10 shrink-0">
                    <video src={previewUrl} autoPlay loop muted className="w-full h-full object-cover"/>
                 </div>
                 <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write a caption..." className="flex-1 bg-transparent outline-none py-2 font-bold text-lg resize-none"/>
              </div>
              {isUploading && (
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-blue-400"><span>{statusText}</span><span>{uploadProgress}%</span></div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{width: `${uploadProgress}%`}}/></div>
                </div>
              )}
              <button onClick={publish} disabled={isUploading} className="w-full bg-red-600 py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3">
                 {isUploading ? <Loader2 className="animate-spin"/> : <><Send size={20}/> POST NOW</>}
              </button>
          </div>
        )}
      </main>

      {/* TEXT EDITOR MODAL */}
      {isAddingText && (
        <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
          <input autoFocus value={currentText} onChange={e => setCurrentText(e.target.value)} className="bg-transparent text-center text-4xl font-black italic uppercase outline-none w-full" style={{ color: currentColor }} placeholder="TEXT HERE..."/>
          <div className="flex gap-4 mt-10 overflow-x-auto py-2">
            {['#ffffff', '#ff0000', '#00ff00', '#0088ff', '#ffff00', '#000000'].map(c => (
              <button key={c} onClick={() => setCurrentColor(c)} className={`w-10 h-10 rounded-full border-2 ${currentColor === c ? 'border-white scale-110' : 'border-white/20'}`} style={{backgroundColor: c}}/>
            ))}
          </div>
          <button onClick={() => { 
            if(currentText) setTextOverlays([...textOverlays, { id: Date.now(), text: currentText, color: currentColor, x: 50, y: 50 }]);
            setCurrentText(""); setIsAddingText(false);
          }} className="mt-10 bg-white text-black px-12 py-4 rounded-full font-black uppercase tracking-widest">Done</button>
        </div>
      )}

      {/* FILTER DRAWER */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950/95 p-6 rounded-t-[32px] z-[500] border-t border-white/10 backdrop-blur-2xl">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-black uppercase text-sm tracking-widest">Filters</h3>
             <button onClick={() => setShowFilters(false)} className="p-2"><X size={20}/></button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
             {Object.keys(FILTERS_DATA).map(k => (
               <button key={k} onClick={() => setSelectedFilter(k)} className="flex flex-col items-center gap-2 shrink-0">
                  <div className={`w-16 h-24 rounded-2xl border-2 overflow-hidden ${selectedFilter === k ? 'border-red-600' : 'border-transparent'}`}>
                    <img src={FILTERS_DATA[k].thumb} className="w-full h-full object-cover" style={{filter: FILTERS_DATA[k].style}}/>
                  </div>
                  <span className="text-[10px] font-bold uppercase">{FILTERS_DATA[k].name}</span>
               </button>
             ))}
          </div>
        </div>
      )}

      {/* MUSIC MODAL */}
      {showMusic && (
        <div className="absolute inset-0 bg-black z-[500] p-6 pt-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black italic">SOUNDS</h2>
              <button onClick={() => setShowMusic(false)} className="p-2 bg-zinc-900 rounded-full"><X/></button>
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-zinc-900 py-4 px-6 rounded-2xl mb-6 font-bold" placeholder="Search music..."/>
            <div className="space-y-4 overflow-y-auto h-[60vh] no-scrollbar">
              {musicList.filter(m => m.title.toLowerCase().includes(query.toLowerCase())).map(m => (
                <div key={m.id} className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-4 cursor-pointer" onClick={() => {
                     if(audioRef.current) { audioRef.current.src = m.audio_url; audioRef.current.play(); setAudioPlayId(m.id); }
                   }}>
                     <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                       {audioPlayId === m.id ? <Pause fill="white"/> : <Play fill="white"/>}
                     </div>
                     <div><p className="font-bold text-sm">{m.title}</p><p className="text-[10px] text-zinc-500 uppercase font-black">Official Sound</p></div>
                   </div>
                   <button onClick={() => {setActiveMusic(m); setShowMusic(false);}} className="bg-white text-black text-[10px] font-black px-4 py-2 rounded-full uppercase">Use</button>
                </div>
              ))}
            </div>
        </div>
      )}

      <audio ref={audioRef} hidden crossOrigin="anonymous"/>
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
} 
