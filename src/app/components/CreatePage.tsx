"use client";

/**
 * PROJECT: CHITI SHORT VIDEO CREATOR PRO
 * VERSION: 4.5.2 (Fixed: Grid Aspect Ratio & Strict Audio Control)
 * VAADA: No functions removed, Code remains full length.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, 
  ShieldCheck, Search, Info, Settings, Scissors, HardDrive,
  MonitorPlay, Mic, Volume2, Clapperboard, Layers, Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p } from '@/lib/videoCompression';

// --- Cloudflare R2 Config ---
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

// --- Professional Filters Data ---
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "none", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Glow", style: "brightness(1.2) blur(0.6px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  cine: { name: "Cinema", style: "contrast(1.6) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Retro", style: "sepia(0.8) contrast(1.2) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
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
  credentials: { 
    accessKeyId: R2_CONFIG.accessKeyId, 
    secretAccessKey: R2_CONFIG.secretAccessKey 
  },
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
  const [timer, setTimer] = useState(15);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [query, setQuery] = useState(''); 
  const [activeMusic, setActiveMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [audioPlayId, setAudioPlayId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const loadMusic = async () => {
      const { data } = await supabase.from('music_library').select('*');
      if (data) setMusicList(data);
    };
    loadMusic();
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(query.toLowerCase()));
  }, [musicList, query]);

  const initCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: 1280, height: 720 },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      toast.error("Camera error!");
      setIsCameraMode(false);
    }
  }, [facing]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) initCamera();
  }, [isCameraMode, initCamera, previewUrl]);

  useEffect(() => {
    if (activeMusic && audioRef.current) {
        audioRef.current.src = activeMusic.audio_url;
        audioRef.current.preload = "auto";
        audioRef.current.load();
    }
  }, [activeMusic]);

  const getMixedStream = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AC();
    const dest = audioCtxRef.current.createMediaStreamDestination();

    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain();
    micGain.gain.value = 0.2; 

    const musicSource = audioCtxRef.current.createMediaElementSource(audioRef.current);
    const musicGain = audioCtxRef.current.createGain();
    musicGain.gain.value = 1.0; 

    micSource.connect(micGain);
    micGain.connect(dest);
    musicSource.connect(musicGain);
    musicGain.connect(dest);
    musicGain.connect(audioCtxRef.current.destination);

    return new MediaStream([streamRef.current.getVideoTracks()[0], dest.stream.getAudioTracks()[0]]);
  };

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mixed = activeMusic ? getMixedStream() : streamRef.current;
    const recorder = new MediaRecorder(mixed, { mimeType: 'video/webm' });

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], 'chiti.webm'));
      setIsRecording(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    };

    if (activeMusic && audioRef.current) audioRef.current.play();
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimer(durationLimit);
    countdownRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) stopRec(); return t - 1; });
    }, 1000);
  };

  const stopRec = () => {
    if (recorderRef.current) recorderRef.current.stop();
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const publish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setStatusText("Chiti is processing...");
    try {
      const optimized = await compressVideoTo480p(selectedFile, (p) => {
        setUploadProgress(10 + Math.floor(p.progress * 60));
        setStatusText(p.message);
      });

      const path = `shorts/${user.id}/${Date.now()}.mp4`;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: path,
        Body: new Uint8Array(await optimized.arrayBuffer()),
        ContentType: 'video/mp4'
      }));

      await supabase.from('posts').insert([{
        video_url: `${R2_CONFIG.publicDomain}/${path}`, 
        caption, user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Creator',
        filter_name: selectedFilter,
        music_id: activeMusic?.id || null
      }]);

      toast.success("Short Published!");
      window.location.href = '/';
    } catch (e) {
      toast.error("Upload failed.");
      setIsUploading(false);
    }
  };

  /**
   * UNIVERSAL CONTENT RENDERER
   * FIX 1: Grid items now use h-full to fill the container without gaps at bottom.
   * FIX 2: Strict muted={true} on all grid clones to stop audio doubling.
   */
  const renderContent = (isLive: boolean) => {
    const filter = FILTERS_DATA[selectedFilter];
    const gridCount = filter.isGrid ? filter.gridCount : 1;
    
    const videoStyle = {
      filter: filter.style,
      transform: (isLive && facing === 'user') ? 'scaleX(-1)' : 'scaleX(1)',
      objectFit: 'cover' as const,
      transition: 'filter 0.4s ease'
    };

    return (
      <div className={`h-full w-full bg-black ${filter.isGrid ? `grid ${filter.cols} ${filter.rows}` : 'flex'}`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full bg-zinc-900 overflow-hidden border-[0.5px] border-white/5">
            {isLive ? (
              <video 
                ref={i === 0 ? videoRef : null} 
                autoPlay playsInline 
                muted={true} // Camera feedback should always be muted to prevent loop
                className="w-full h-full" style={videoStyle} 
              />
            ) : (
              <video 
                ref={i === 0 ? previewVideoRef : null} 
                src={previewUrl} 
                autoPlay loop playsInline 
                muted={i !== 0} // Only first video plays audio
                className="w-full h-full" style={videoStyle} 
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden font-sans">
      
      {/* HEADER */}
      {!isFinalStep && (
        <header className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[200] bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={() => {
            if(previewUrl) { setPreviewUrl(''); initCamera(); } 
            else window.history.back();
          }} className="p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
            <X size={24}/>
          </button>
          
          <button onClick={() => setShowMusic(true)} className="flex items-center gap-3 bg-white/10 backdrop-blur-3xl px-6 py-2.5 rounded-full border border-white/20">
            <Music size={16} className="text-pink-500"/>
            <span className="text-[11px] font-black uppercase tracking-tighter truncate max-w-[120px]">
              {activeMusic ? activeMusic.title : "Add Sound"}
            </span>
          </button>

          <button className="p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
            <Settings size={22}/>
          </button>
        </header>
      )}

      {/* VIEWPORT AREA */}
      <main className="flex-1 relative bg-zinc-950 flex flex-col overflow-hidden">
        {!isCameraMode && !previewUrl ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-12">
            <div className="relative group">
               <div className="absolute -inset-10 bg-blue-600/20 blur-3xl rounded-full animate-pulse"/>
               <button onClick={() => setIsCameraMode(true)} className="w-40 h-40 bg-blue-600 rounded-[50px] flex items-center justify-center relative shadow-2xl active:scale-95 transition-all">
                 <Camera size={50} className="text-white"/>
               </button>
            </div>
            <label className="flex items-center gap-4 bg-zinc-900 px-10 py-5 rounded-[25px] border border-white/5 cursor-pointer hover:bg-zinc-800 transition-colors">
              <Upload size={20} className="text-blue-500"/>
              <span className="text-xs font-black uppercase tracking-widest">Gallery Upload</span>
              <input type="file" hidden accept="video/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); setIsCameraMode(false); }
              }}/>
            </label>
          </div>
        ) : !isFinalStep ? (
          <div className="flex-1 relative overflow-hidden flex flex-col">
             {/* Content Area - Fixed height to avoid cutting bottom buttons */}
             <div className="flex-1 w-full relative overflow-hidden">
                {renderContent(!previewUrl)}
                
                {/* Sidebar Tools */}
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-[210]">
                   {!previewUrl && (
                       <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="flex flex-col items-center gap-2">
                           <div className="p-4 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-md"><RefreshCw size={24}/></div>
                           <span className="text-[9px] font-bold uppercase tracking-tighter">Flip</span>
                       </button>
                   )}
                   <button onClick={() => setShowFilters(true)} className="flex flex-col items-center gap-2">
                       <div className="p-4 bg-black/40 rounded-2xl border border-white/10 text-cyan-400 backdrop-blur-md"><Sparkles size={24}/></div>
                       <span className="text-[9px] font-bold uppercase tracking-tighter">Filters</span>
                   </button>
                </div>
             </div>

             {/* Bottom Controls - Stable positioning */}
             <div className="shrink-0 w-full p-6 pb-12 flex flex-col items-center gap-6 bg-gradient-to-t from-black to-transparent z-[210]">
                {!previewUrl ? (
                  <>
                    <div className="flex bg-black/50 p-1.5 rounded-full border border-white/10 backdrop-blur-xl">
                      {[15, 30, 60].map(d => (
                        <button key={d} onClick={() => setDurationLimit(d)} className={`px-7 py-2 rounded-full text-[10px] font-black transition-all ${durationLimit === d ? 'bg-white text-black' : 'text-zinc-500'}`}>{d}s</button>
                      ))}
                    </div>
                    <button onClick={isRecording ? stopRec : startRec} className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center">
                        <div className={`transition-all ${isRecording ? 'w-8 h-8 bg-red-600 rounded-lg animate-pulse' : 'w-14 h-14 bg-red-600 rounded-full'}`}/>
                    </button>
                  </>
                ) : (
                  <div className="flex gap-4 w-full max-w-sm">
                    <button onClick={() => {setPreviewUrl(''); initCamera(); setIsCameraMode(true);}} className="flex-1 py-4 bg-zinc-900 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/10 flex items-center justify-center gap-2">
                        <Trash2 size={16}/> Discard
                    </button>
                    <button onClick={() => setIsFinalStep(true)} className="flex-1 py-4 bg-red-600 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-red-600/30">Next</button>
                  </div>
                )}
             </div>
          </div>
        ) : (
          /* PUBLISH SCREEN */
          <div className="h-full w-full bg-zinc-950 p-8 flex flex-col pt-16 animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-6 mb-10">
               <button onClick={() => setIsFinalStep(false)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors"><ArrowLeft size={30}/></button>
               <h2 className="text-2xl font-black italic uppercase">Publishing</h2>
             </div>

             <div className="flex gap-6 mb-10">
                <div className="w-32 h-48 bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative shrink-0">
                  {renderContent(false)}
                </div>
                <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Caption your short..."
                  className="flex-1 bg-transparent border-none outline-none font-bold text-lg h-40 resize-none pt-4 placeholder:text-zinc-700"
                />
             </div>

             {isUploading && (
               <div className="mb-10 space-y-4">
                 <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-blue-500">
                   <div className="flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> {statusText}</div>
                   <span>{uploadProgress}%</span>
                 </div>
                 <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-blue-600 transition-all duration-500" style={{width: `${uploadProgress}%`}}/>
                 </div>
               </div>
             )}

             <div className="mt-auto space-y-4">
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center gap-3">
                   <ShieldCheck size={18} className="text-green-500"/>
                   <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Creator safety enabled. Quality scan in progress.</span>
                </div>
                <button onClick={publish} disabled={isUploading} className="w-full bg-red-600 py-6 rounded-[30px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 shadow-2xl shadow-red-600/20">
                  {isUploading ? <Loader2 className="animate-spin"/> : <><Send size={24}/> POST SHORT</>}
                </button>
             </div>
          </div>
        )}
      </main>

      {/* FILTERS DRAWER */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 rounded-t-[40px] z-[300] border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300">
           <div className="flex justify-between items-center mb-8">
             <div className="flex flex-col">
                <h3 className="font-black italic uppercase text-lg">Visual Studio</h3>
                <span className="text-[10px] text-zinc-500 font-bold">20 PREMIUM FILTERS ACTIVE</span>
             </div>
             <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
           </div>
           <div className="flex gap-5 overflow-x-auto no-scrollbar pb-6 px-2">
             {Object.keys(FILTERS_DATA).map(key => (
               <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-3 min-w-[75px] group">
                 <div className={`w-16 h-24 rounded-[20px] border-4 transition-all duration-300 ${selectedFilter === key ? 'border-red-600 scale-110 shadow-lg shadow-red-600/20' : 'border-white/5 opacity-50 group-hover:opacity-100'}`}>
                   <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover rounded-[15px]" style={{filter: FILTERS_DATA[key].style}} alt=""/>
                 </div>
                 <span className={`text-[9px] font-black uppercase tracking-tight ${selectedFilter === key ? 'text-red-500' : 'text-zinc-500'}`}>{FILTERS_DATA[key].name}</span>
               </button>
             ))}
           </div>
        </div>
      )}

      {/* MUSIC PICKER */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[400] p-8 pt-20 animate-in slide-in-from-right duration-300 flex flex-col">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-black italic text-pink-500 uppercase">Library</h2>
              <button onClick={() => {setShowMusic(false); audioRef.current?.pause(); setAudioPlayId(null);}} className="p-3 bg-white/5 rounded-full"><X size={24}/></button>
           </div>
           <div className="relative mb-8">
             <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20}/>
             <input value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-zinc-900 rounded-[25px] py-5 pl-14 pr-6 font-bold outline-none border border-white/5 focus:border-pink-500/30" placeholder="Search sounds..."/>
           </div>
           <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pb-20">
             {filteredMusic.map(m => (
               <div key={m.id} className={`p-5 rounded-[30px] flex items-center justify-between border transition-all ${activeMusic?.id === m.id ? 'bg-pink-600/10 border-pink-500/40' : 'bg-zinc-900/40 border-white/5'}`}>
                 <div className="flex items-center gap-4 flex-1" onClick={() => {
                   if(audioRef.current) {
                     if(audioPlayId === m.id) { audioRef.current.pause(); setAudioPlayId(null); }
                     else { 
                        audioRef.current.src = m.audio_url; 
                        audioRef.current.play(); 
                        setAudioPlayId(m.id); 
                     }
                   }
                 }}>
                   <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center relative">
                     {audioPlayId === m.id ? <Pause size={20}/> : <Play size={20}/>}
                   </div>
                   <div className="flex flex-col">
                     <span className="font-black text-sm uppercase tracking-tighter truncate max-w-[150px]">{m.title}</span>
                     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{m.artist}</span>
                   </div>
                 </div>
                 <button onClick={() => {setActiveMusic(m); setShowMusic(false);}} className={`p-4 rounded-2xl transition-all ${activeMusic?.id === m.id ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' : 'bg-zinc-800 text-zinc-500'}`}><Check size={20}/></button>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* HIDDEN AUDIO ELEMENTS */}
      <audio ref={audioRef} hidden onEnded={() => setAudioPlayId(null)}/>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        video { pointer-events: none; }
      `}</style>
    </div>
  );
}
