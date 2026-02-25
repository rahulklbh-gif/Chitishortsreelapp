"use client";

/**
 * PROJECT: CHITI SHORT VIDEO CREATOR PRO
 * VERSION: 5.2.0 (Ultra Full-Screen & Fixed UI Layout)
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
      const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
      if (data) setMusicList(data);
    };
    loadMusic();
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (previewUrl && previewVideoRef.current) {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        const vid = previewVideoRef.current;
        vid.load();
        const playPreview = async () => {
            try {
                await vid.play();
                if (activeMusic && audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play();
                }
            } catch (e) {
                console.log("Interaction required for playback");
            }
        };
        playPreview();
    }
  }, [previewUrl, activeMusic]);

  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(query.toLowerCase()));
  }, [musicList, query]);

  const playAudio = async (url: string, id: string) => {
    if (!audioRef.current) return;
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    try {
        if (audioPlayId === id) {
            audioRef.current.pause();
            setAudioPlayId(null);
        } else {
            audioRef.current.pause();
            audioRef.current.crossOrigin = "anonymous";
            audioRef.current.src = url;
            audioRef.current.load();
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setAudioPlayId(id);
                }).catch(error => {
                    console.error("Playback failed:", error);
                });
            }
        }
    } catch (err) {
        console.error(err);
    }
  };

  const initCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: facing }, 
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      toast.error("Camera error!");
      setIsCameraMode(false);
    }
  }, [facing]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) initCamera();
  }, [isCameraMode, initCamera, previewUrl]);

  const getMixedStream = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AC();
    const dest = audioCtxRef.current.createMediaStreamDestination();
    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain();
    micGain.gain.value = 0.5; 
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
    if (activeMusic && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
    const mixed = activeMusic ? getMixedStream() : streamRef.current;
    const recorder = new MediaRecorder(mixed, { mimeType: 'video/webm;codecs=vp8,opus' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], 'chiti.mp4', { type: 'video/mp4' }));
      setIsRecording(false);
      setTimer(0);
    };
    recorder.start(100); 
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimer(0);
    countdownRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev >= durationLimit - 1) { stopRec(); return durationLimit; }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (audioRef.current) audioRef.current.pause();
  };

  const publish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(2);
    setStatusText("Chiti is processing...");
    try {
      let fileToUpload: any = selectedFile;
      try {
        setStatusText("Optimizing...");
        const optimized = await compressVideoTo480p(selectedFile, (p) => { setUploadProgress(5 + Math.floor(p.progress * 40)); });
        fileToUpload = optimized;
      } catch (e) { console.warn("Using original"); }
      const progressInterval = setInterval(() => { setUploadProgress(prev => (prev >= 96 ? 96 : prev + 1)); }, 500);
      const fileName = `${Date.now()}_chiti.mp4`;
      const path = `chiti_vids/${user.id}/${fileName}`;
      const finalUrl = `${R2_CONFIG.publicDomain}/${path}`;
      const arrayBuffer = await fileToUpload.arrayBuffer();
      await s3Client.send(new PutObjectCommand({ Bucket: R2_CONFIG.bucketName, Key: path, Body: new Uint8Array(arrayBuffer), ContentType: 'video/mp4' }));
      clearInterval(progressInterval);
      let finalMusicId = activeMusic?.id || null;
      if (!isCameraMode && !activeMusic) {
        const musicTitle = caption.trim() ? (caption.substring(0, 47) + "...") : `Original Sound - ${user.user_metadata?.full_name || 'User'}`;
        const { data: musicEntry } = await supabase.from('music_library').insert([{ title: musicTitle, audio_url: finalUrl, user_id: user.id, duration: durationLimit }]).select();
        if (musicEntry) finalMusicId = musicEntry[0].id;
      }
      await supabase.from('posts').insert([{ video_url: finalUrl, caption: caption || "", user_id: user.id, user_name: user.user_metadata?.full_name || 'Creator', filter_name: selectedFilter, music_id: finalMusicId }]);
      setUploadProgress(100);
      toast.success("Shorts Published!");
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (e: any) { toast.error("Publish failed"); setIsUploading(false); }
  };

  const renderContent = (isLive: boolean) => {
    const filter = FILTERS_DATA[selectedFilter];
    const gridCount = filter.isGrid ? filter.gridCount : 1;
    
    // FIX: Edge-to-Edge Style
    const videoStyle = {
      filter: filter.style,
      transform: (facing === 'user') ? 'scaleX(-1)' : 'scaleX(1)',
      objectFit: 'cover' as const, // CRITICAL: This fixes the black bars
      width: '100vw',
      height: '100vh',
      backgroundColor: 'black'
    };

    return (
      <div className={`fixed inset-0 w-full h-full bg-black ${filter.isGrid ? `grid ${filter.cols} ${filter.rows}` : 'flex'}`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full bg-black">
            {isLive ? (
              <video ref={i === 0 ? videoRef : null} autoPlay playsInline muted className="absolute inset-0 w-full h-full pointer-events-none" style={videoStyle} />
            ) : (
              <video key={previewUrl} ref={i === 0 ? previewVideoRef : null} src={previewUrl} autoPlay loop playsInline muted={i !== 0} className="absolute inset-0 w-full h-full" style={videoStyle} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black text-white z-[999] overflow-hidden font-sans select-none touch-none">
      
      {/* BACKGROUND VIDEO LAYER */}
      <div className="absolute inset-0 z-0">
        {(isCameraMode || previewUrl) && !isFinalStep && renderContent(!previewUrl)}
      </div>

      {!isFinalStep && (
        <>
          <header className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[200] bg-gradient-to-b from-black/60 to-transparent">
            <button onClick={() => { if(previewUrl) setPreviewUrl(''); else window.history.back(); }} className="p-3 bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-white">
              <X size={24}/>
            </button>
            <button onClick={() => setShowMusic(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20">
              <Music size={14} className="text-pink-500"/>
              <span className="text-[11px] font-bold uppercase truncate max-w-[100px]">{activeMusic ? activeMusic.title : "Add Sound"}</span>
            </button>
            <button className="p-3 bg-black/20 backdrop-blur-md rounded-full border border-white/10"><Settings size={22}/></button>
          </header>

          {/* RIGHT SIDE TOOLS */}
          {(isCameraMode || previewUrl) && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-[200]">
               {!previewUrl && (
                 <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="flex flex-col items-center gap-1">
                   <div className="p-3.5 bg-black/30 backdrop-blur-md rounded-2xl border border-white/10"><RefreshCw size={24}/></div>
                   <span className="text-[10px] font-bold shadow-lg">Flip</span>
                 </button>
               )}
               <button onClick={() => setShowFilters(true)} className="flex flex-col items-center gap-1">
                 <div className="p-3.5 bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 text-cyan-400"><Sparkles size={24}/></div>
                 <span className="text-[10px] font-bold shadow-lg">Filters</span>
               </button>
            </div>
          )}

          {/* BOTTOM CONTROLS */}
          <div className="absolute bottom-0 inset-x-0 p-8 pb-12 z-[200] bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-6">
            {!isCameraMode && !previewUrl ? (
              <div className="flex flex-col items-center gap-8">
                <button onClick={() => setIsCameraMode(true)} className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-4 border-white/20">
                  <Camera size={36}/>
                </button>
                <label className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/10 cursor-pointer">
                  <Upload size={18} className="text-blue-400"/>
                  <span className="text-xs font-bold uppercase tracking-widest">Gallery</span>
                  <input type="file" hidden accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }}}/>
                </label>
              </div>
            ) : !previewUrl ? (
              <>
                <div className="flex bg-black/40 p-1 rounded-full border border-white/10 backdrop-blur-md">
                  {[15, 30].map(d => (
                    <button key={d} onClick={() => setDurationLimit(d)} className={`px-6 py-1.5 rounded-full text-[10px] font-black transition-all ${durationLimit === d ? 'bg-white text-black' : 'text-white/50'}`}>{d}s</button>
                  ))}
                </div>
                <button onClick={isRecording ? stopRec : startRec} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative">
                   <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-600 rounded-md animate-pulse' : 'w-16 h-16 bg-red-600 rounded-full'}`}/>
                   {isRecording && <div className="absolute -inset-2 border-2 border-red-600 rounded-full animate-ping opacity-50"/>}
                </button>
              </>
            ) : (
              <div className="flex gap-4 w-full max-w-sm">
                <button onClick={() => {setPreviewUrl(''); setIsCameraMode(true); initCamera();}} className="flex-1 py-4 bg-white/10 backdrop-blur-md rounded-2xl font-bold uppercase text-xs border border-white/10">Discard</button>
                <button onClick={() => setIsFinalStep(true)} className="flex-1 py-4 bg-red-600 rounded-2xl font-bold uppercase text-xs shadow-xl shadow-red-900/20">Next</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* PUBLISH STEP */}
      {isFinalStep && (
        <div className="absolute inset-0 bg-zinc-950 p-8 flex flex-col pt-16 z-[500] animate-in slide-in-from-right duration-300">
           <div className="flex items-center gap-4 mb-10">
              <button onClick={() => setIsFinalStep(false)} className="p-2"><ArrowLeft size={28}/></button>
              <h2 className="text-xl font-black uppercase tracking-tight">Finalize Post</h2>
           </div>
           <div className="flex gap-4 mb-8">
              <div className="w-24 h-40 bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 relative shrink-0">
                <video src={previewUrl} autoPlay loop muted className="w-full h-full object-cover" />
              </div>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="What's on your mind? #shorts" className="flex-1 bg-transparent border-none outline-none font-medium text-lg h-32 resize-none pt-2" />
           </div>
           <button onClick={publish} disabled={isUploading} className="w-full bg-red-600 py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
             {isUploading ? <Loader2 className="animate-spin"/> : <><Send size={20}/> PUBLISH NOW</>}
           </button>
        </div>
      )}

      {/* MODALS (Filters & Music) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-6 rounded-t-[32px] z-[600] border-t border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold uppercase text-sm tracking-widest text-zinc-400">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={18}/></button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
              {Object.keys(FILTERS_DATA).map(key => (
                <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-2 min-w-[70px]">
                  <div className={`w-16 h-16 rounded-2xl border-2 overflow-hidden ${selectedFilter === key ? 'border-red-600' : 'border-transparent'}`}>
                    <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{filter: FILTERS_DATA[key].style}} />
                  </div>
                  <span className={`text-[10px] font-bold ${selectedFilter === key ? 'text-red-500' : 'text-zinc-500'}`}>{FILTERS_DATA[key].name}</span>
                </button>
              ))}
            </div>
        </div>
      )}

      {showMusic && (
        <div className="absolute inset-0 bg-black z-[700] p-6 pt-16 flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black italic uppercase">Sounds</h2>
                <button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full"><X size={24}/></button>
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-zinc-900 rounded-2xl py-4 px-6 mb-6 outline-none border border-white/5" placeholder="Search music..." />
            <div className="flex-1 overflow-y-auto space-y-4">
              {filteredMusic.map(m => (
                <div key={m.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl" onClick={() => playAudio(m.audio_url, m.id)}>
                   <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-red-500">
                     {audioPlayId === m.id ? <Pause size={20}/> : <Play size={20}/>}
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-sm">{m.title}</p>
                     <p className="text-xs text-zinc-500">Artist</p>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); setActiveMusic(m); setShowMusic(false); }} className="bg-red-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Use</button>
                </div>
              ))}
            </div>
        </div>
      )}

      <audio ref={audioRef} onEnded={() => setAudioPlayId(null)} crossOrigin="anonymous" />
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        video { object-fit: cover !important; }
      `}</style>
    </div>
  );
}
