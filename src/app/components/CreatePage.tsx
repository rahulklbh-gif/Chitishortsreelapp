"use client";

/**
 * PROJECT: CHITI SHORT VIDEO CREATOR PRO
 * VERSION: 4.6.0 (FINAL PATH & PLAYBACK FIX)
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
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
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
  }, []);

  useEffect(() => {
    if (previewUrl && previewVideoRef.current) {
        previewVideoRef.current.load();
        previewVideoRef.current.play().catch(() => {});
    }
  }, [previewUrl]);

  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(query.toLowerCase()));
  }, [musicList, query]);

  const playAudio = async (url: string, id: string) => {
    if (!audioRef.current) return;
    if (audioPlayId === id) {
        audioRef.current.pause();
        setAudioPlayId(null);
    } else {
        audioRef.current.src = url;
        audioRef.current.play().then(() => setAudioPlayId(id)).catch(() => toast.error("Tap to enable audio"));
    }
  };

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
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimer(0);
    countdownRef.current = setInterval(() => {
      setTimer(p => p >= durationLimit - 1 ? (stopRec(), durationLimit) : p + 1);
    }, 1000);
  };

  const stopRec = () => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    clearInterval(countdownRef.current);
  };

  // 🔥 NEW CORRECTED PUBLISH FUNCTION
  const publish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setStatusText("Chiti is processing...");
    
    try {
      const fileName = `${Date.now()}.mp4`;
      const path = `chiti_vids/${user.id}/${fileName}`;
      
      let fileToUpload = selectedFile;
      try {
        fileToUpload = await compressVideoTo480p(selectedFile, (p) => {
          setUploadProgress(10 + Math.floor(p.progress * 60));
          setStatusText(p.message);
        });
      } catch (e) { console.warn("Compression skipped"); }

      // R2 Upload
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: path,
        Body: fileToUpload,
        ContentType: 'video/mp4',
        ContentDisposition: 'inline',
        CacheControl: "public, max-age=31536000, immutable"
      }));

      // Database Entry
      const finalUrl = `${R2_CONFIG.publicDomain}/${path}`;
      await supabase.from('posts').insert([{
        video_url: finalUrl, 
        caption: caption || "", 
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Creator',
        filter_name: selectedFilter,
        music_id: activeMusic?.id || null
      }]);

      setUploadProgress(100);
      toast.success("Short Published!");
      window.location.href = '/';
    } catch (e) {
      console.error(e);
      toast.error("Upload failed");
      setIsUploading(false);
    }
  };

  const renderContent = (isLive: boolean) => {
    const filter = FILTERS_DATA[selectedFilter];
    const gridCount = filter.isGrid ? filter.gridCount : 1;
    const style = { filter: filter.style, transform: (isLive && facing === 'user') ? 'scaleX(-1)' : 'none', objectFit: 'cover' as const };

    return (
      <div className={`h-full w-full bg-black ${filter.isGrid ? `grid ${filter.cols} ${filter.rows}` : 'flex'}`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full bg-zinc-900 border-[0.5px] border-white/5">
            {isLive ? <video ref={i === 0 ? videoRef : null} autoPlay playsInline muted className="w-full h-full" style={style} />
                   : <video ref={i === 0 ? previewVideoRef : null} src={previewUrl} autoPlay loop playsInline muted={i !== 0} className="w-full h-full" style={style} />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      {!isFinalStep && (
        <header className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[200] bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={() => previewUrl ? (setPreviewUrl(''), initCamera()) : window.history.back()} className="p-3 bg-black/40 rounded-full border border-white/10"><X size={24}/></button>
          <button onClick={() => setShowMusic(true)} className="flex items-center gap-3 bg-white/10 backdrop-blur-3xl px-6 py-2.5 rounded-full border border-white/20">
            <Music size={16} className="text-pink-500"/><span className="text-[11px] font-black uppercase truncate max-w-[120px]">{activeMusic?.title || "Add Sound"}</span>
          </button>
          <button className="p-3 bg-black/40 rounded-full border border-white/10"><Settings size={22}/></button>
        </header>
      )}

      <main className="flex-1 relative bg-zinc-950 flex flex-col overflow-hidden">
        {!isCameraMode && !previewUrl ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-12">
            <button onClick={() => setIsCameraMode(true)} className="w-40 h-40 bg-blue-600 rounded-[50px] flex items-center justify-center shadow-2xl active:scale-95 transition-all"><Camera size={50}/></button>
            <label className="flex items-center gap-4 bg-zinc-900 px-10 py-5 rounded-[25px] border border-white/5 cursor-pointer">
              <Upload size={20} className="text-blue-500"/><span className="text-xs font-black uppercase">Gallery Upload</span>
              <input type="file" hidden accept="video/*" onChange={e => {
                const f = e.target.files?.[0];
                if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }
              }}/>
            </label>
          </div>
        ) : !isFinalStep ? (
          <div className="flex-1 relative overflow-hidden flex flex-col">
              <div className="flex-1 w-full relative overflow-hidden">{renderContent(!previewUrl)}
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-[210]">
                   {!previewUrl && <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="flex flex-col items-center gap-2"><div className="p-4 bg-black/40 rounded-2xl border border-white/10"><RefreshCw size={24}/></div></button>}
                   <button onClick={() => setShowFilters(true)} className="flex flex-col items-center gap-2"><div className="p-4 bg-black/40 rounded-2xl border border-white/10 text-cyan-400"><Sparkles size={24}/></div></button>
                </div>
              </div>
              <div className="shrink-0 w-full p-6 pb-12 flex flex-col items-center gap-6 bg-gradient-to-t from-black to-transparent z-[210]">
                {!previewUrl ? (
                  <><div className="flex bg-black/50 p-1.5 rounded-full border border-white/10">{[15, 30].map(d => (<button key={d} onClick={() => setDurationLimit(d)} className={`px-7 py-2 rounded-full text-[10px] font-black ${durationLimit === d ? 'bg-white text-black' : 'text-zinc-500'}`}>{d}s</button>))}</div>
                    <button onClick={isRecording ? stopRec : startRec} className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center"><div className={`transition-all ${isRecording ? 'w-8 h-8 bg-red-600 rounded-lg animate-pulse' : 'w-14 h-14 bg-red-600 rounded-full'}`}/></button></>
                ) : (
                  <div className="flex gap-4 w-full max-w-sm">
                    <button onClick={() => {setPreviewUrl(''); setIsCameraMode(true);}} className="flex-1 py-4 bg-zinc-900 rounded-2xl font-black uppercase text-[10px]">Discard</button>
                    <button onClick={() => setIsFinalStep(true)} className="flex-1 py-4 bg-red-600 rounded-2xl font-black uppercase text-[10px]">Next</button>
                  </div>
                )}
              </div>
          </div>
        ) : (
          <div className="h-full w-full bg-zinc-950 p-8 flex flex-col pt-16">
              <div className="flex items-center gap-6 mb-10"><button onClick={() => setIsFinalStep(false)} className="p-2"><ArrowLeft size={30}/></button><h2 className="text-2xl font-black italic uppercase">Publishing</h2></div>
              <div className="flex gap-6 mb-10"><div className="w-32 h-48 bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 relative shrink-0">{renderContent(false)}</div>
                 <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption your short..." className="flex-1 bg-transparent border-none outline-none font-bold text-lg h-40 resize-none pt-4" />
              </div>
              {isUploading && (
                <div className="mb-6"><div className="flex justify-between text-[10px] font-black mb-2 text-blue-400"><span>{statusText.toUpperCase()}</span><span>{uploadProgress}%</span></div>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${uploadProgress}%`}} /></div>
                </div>
              )}
              <button onClick={publish} disabled={isUploading} className="w-full bg-red-600 py-6 rounded-[30px] font-black text-xl flex items-center justify-center gap-3">
                {isUploading ? <Loader2 className="animate-spin"/> : <><Send size={24}/> POST SHORT</>}
              </button>
          </div>
        )}
      </main>

      {/* Modals - Same as before */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 rounded-t-[40px] z-[300] border-t border-white/10">
            <div className="flex justify-between items-center mb-8"><h3 className="font-black italic uppercase">Filters</h3><button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={20}/></button></div>
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-6 px-2">
              {Object.keys(FILTERS_DATA).map(key => (
                <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-3 min-w-[75px]">
                  <div className={`w-16 h-24 rounded-[20px] border-4 transition-all ${selectedFilter === key ? 'border-red-600 scale-110' : 'border-white/5 opacity-50'}`}>
                    <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover rounded-[15px]" style={{filter: FILTERS_DATA[key].style}} alt=""/>
                  </div>
                </button>
              ))}
            </div>
        </div>
      )}

      {showMusic && (
        <div className="absolute inset-0 bg-[#000000] z-[400] p-6 pt-12 flex flex-col">
            <div className="flex justify-between items-center mb-6"><h2 className="text-4xl font-black italic text-pink-500 uppercase">Library</h2><button onClick={() => setShowMusic(false)} className="p-3 bg-white/10 rounded-full"><X size={24}/></button></div>
            <div className="relative mb-6"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500" size={22}/><input value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-[#1A1A1A] rounded-full py-5 pl-16 pr-6 font-bold outline-none" placeholder="Search sounds..." /></div>
            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
              {filteredMusic.map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-5 cursor-pointer" onClick={() => playAudio(m.audio_url, m.id)}><div className="w-16 h-16 bg-[#262626] rounded-2xl flex items-center justify-center">{audioPlayId === m.id ? <Pause/> : <Play/>}</div><div className="flex flex-col"><span className="font-bold text-white">{m.title}</span><span className="text-sm text-zinc-500">{m.artist}</span></div></div>
                  <button onClick={() => {setActiveMusic(m); setShowMusic(false);}} className="bg-[#ED0101] text-white text-[11px] font-black uppercase px-6 py-2.5 rounded-full">Use</button>
                </div>
              ))}
            </div>
        </div>
      )}

      <audio ref={audioRef} preload="auto" onEnded={() => setAudioPlayId(null)} crossOrigin="anonymous" />
      <style jsx global>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
