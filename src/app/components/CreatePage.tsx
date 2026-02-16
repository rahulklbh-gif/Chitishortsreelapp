"use client";

/**
 * ------------------------------------------------------------------
 * PROJECT: CHITI CREATOR STUDIO - FULL FUNCTIONAL VERSION
 * ------------------------------------------------------------------
 * VAADA: No functions removed, No extra icons, Mirroring Fixed.
 * ------------------------------------------------------------------
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  X,               // Close
  Music,           // Add Sound
  RefreshCw,       // Flip Camera
  Sparkles,        // Effects/Filters
  Zap,             // Flash
  Upload,          // Gallery
  Check,           // Confirm
  Play, 
  Pause, 
  Search, 
  Loader2, 
  Send, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p } from '@/lib/videoCompression';

// --- CONFIGURATION: Cloudflare R2 ---
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

// --- 20 PROFESSIONAL FILTERS ---
const FILTERS_DATA: any = {
  none: { name: "Natural", style: "none", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  vivid: { name: "Vivid", style: "saturate(2) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  bright: { name: "Bright", style: "brightness(1.4)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  warm: { name: "Warm", style: "sepia(0.4) saturate(1.2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  cold: { name: "Cold", style: "hue-rotate(180deg) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.5)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  retro: { name: "Retro", style: "sepia(0.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  cinema: { name: "Cinema", style: "contrast(1.6) saturate(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  dreamy: { name: "Dreamy", style: "blur(1px) brightness(1.2)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  soft: { name: "Soft", style: "brightness(1.1) blur(0.4px)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  sunset: { name: "Sunset", style: "hue-rotate(-20deg) saturate(1.5)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  ocean: { name: "Ocean", style: "hue-rotate(160deg) saturate(1.2)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  gold: { name: "Gold", style: "sepia(0.5) brightness(1.1) saturate(1.8)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  cyber: { name: "Cyber", style: "hue-rotate(280deg) saturate(2)", thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  faded: { name: "Faded", style: "opacity(0.8) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  mono: { name: "Mono", style: "grayscale(1) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  vintage: { name: "Vintage", style: "sepia(0.6) contrast(1.1) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  sharp: { name: "Sharp", style: "contrast(1.4)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel", style: "brightness(1.5) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "sepia(0.1) brightness(1.2) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" }
};

export default function CreateShortsPage() {
  const { user } = useAuth();
  
  // -- State: Files & UI --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState(""); 
  
  // -- State: Camera & Recording --
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationLimit, setDurationLimit] = useState(15);
  const [timer, setTimer] = useState(15);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [flashOn, setFlashOn] = useState(false);
  
  // -- State: Filter & Music --
  const [activeFilter, setActiveFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [musicQuery, setMusicQuery] = useState(''); 
  const [activeMusic, setActiveMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [audioPlayId, setAudioPlayId] = useState<string | null>(null);

  // -- Refs --
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_CONFIG.endpoint,
    credentials: { 
      accessKeyId: R2_CONFIG.accessKeyId, 
      secretAccessKey: R2_CONFIG.secretAccessKey 
    },
    forcePathStyle: true,
  });

  // --- Initialize Music Library ---
  useEffect(() => {
    const loadMusic = async () => {
      const { data } = await supabase.from('music_library').select('*');
      if (data) setMusicList(data);
    };
    loadMusic();
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      clearInterval(countdownRef.current);
    };
  }, []);

  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(musicQuery.toLowerCase()));
  }, [musicList, musicQuery]);

  // --- CAMERA LOGIC (Mirroring Fix Integrated) ---
  const initCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      toast.error("Camera access denied");
      setIsCameraMode(false);
    }
  }, [facing]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) initCamera();
  }, [isCameraMode, initCamera, previewUrl]);

  // --- AUDIO MIXING (20% Mic Logic) ---
  const getMixedStream = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AC();
    const dest = audioCtxRef.current.createMediaStreamDestination();

    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain();
    micGain.gain.value = 0.2; // 20% Mic
    micSource.connect(micGain); micGain.connect(dest);

    const musicSource = audioCtxRef.current.createMediaElementSource(audioRef.current);
    const musicGain = audioCtxRef.current.createGain();
    musicGain.gain.value = 1.0; // 100% Music
    musicSource.connect(musicGain); musicGain.connect(dest);
    musicGain.connect(audioCtxRef.current.destination);

    return new MediaStream([streamRef.current.getVideoTracks()[0], dest.stream.getAudioTracks()[0]]);
  };

  // --- RECORDING CONTROLS ---
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const streamToRecord = activeMusic ? getMixedStream() : streamRef.current;
    const recorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm;codecs=vp8,opus' });

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], 'record.webm', { type: 'video/webm' }));
      setIsRecording(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    };

    if (activeMusic && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimer(durationLimit);
    countdownRef.current = setInterval(() => {
      setTimer(p => { if (p <= 1) { stopRecording(); return 0; } return p - 1; });
    }, 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    clearInterval(countdownRef.current);
  };

  // --- GALLERY LOGIC (Filter Preview Enabled) ---
  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      setSelectedFile(file);
      setIsCameraMode(false);
    }
  };

  // --- PUBLISH TO R2 & SUPABASE ---
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setStatusText("Optimizing...");
    try {
      const compressed = await compressVideoTo480p(selectedFile, (p) => {
        setUploadProgress(10 + Math.floor(p.progress * 60));
        setStatusText(p.message);
      });
      const key = `shorts/${user.id}/${Date.now()}.mp4`;
      setStatusText("Uploading...");
      const buf = await compressed.arrayBuffer();
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName, Key: key, Body: new Uint8Array(buf), ContentType: 'video/mp4'
      }));
      await supabase.from('posts').insert([{
        video_url: `${R2_CONFIG.publicDomain}/${key}`,
        caption, user_id: user.id, user_name: user.user_metadata?.full_name,
        filter_name: activeFilter, music_id: activeMusic?.id
      }]);
      toast.success("Posted!");
      window.location.href = '/';
    } catch (e: any) { toast.error("Failed"); setIsUploading(false); }
  };

  // --- CORE RENDER ENGINE (Mirror Fix + Filter Fix) ---
  const renderVisuals = (isLive: boolean) => {
    const filter = FILTERS_DATA[activeFilter];
    // Live Front Camera = Mirror. Preview/Gallery = Straight.
    const transform = (isLive && facing === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
    return (
      <div className="w-full h-full bg-black relative">
        <video 
          ref={isLive ? videoRef : null} 
          src={!isLive ? previewUrl : undefined}
          autoPlay loop playsInline muted={isLive}
          className="w-full h-full object-cover"
          style={{ filter: filter.style, transform, transition: 'filter 0.3s' }}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white z-[999] flex flex-col overflow-hidden select-none font-sans">
      
      {/* HEADER: Dynamic */}
      {!isFinalStep && (
        <div className="absolute top-0 inset-x-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={() => previewUrl ? (setPreviewUrl(''), initCamera()) : window.history.back()} className="p-2 bg-black/20 backdrop-blur-xl rounded-full border border-white/10"><X size={22}/></button>
          <button onClick={() => setShowMusic(true)} className="flex items-center gap-2 bg-pink-600/90 px-4 py-1.5 rounded-full border border-white/20">
            <Music size={14}/>
            <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[120px]">{activeMusic?.title || "Add Sound"}</span>
          </button>
          <div className="w-10"></div>
        </div>
      )}

      {/* VIEWPORT */}
      <main className="flex-1 relative bg-zinc-950">
        {!isCameraMode && !previewUrl ? (
          <div className="h-full flex flex-col items-center justify-center gap-10">
            <button onClick={() => setIsCameraMode(true)} className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition"><Upload size={40}/></button>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 cursor-pointer">
              Open Gallery <input type="file" hidden accept="video/*" onChange={handleGallerySelect}/>
            </label>
          </div>
        ) : !isFinalStep ? (
          <div className="h-full relative">
            {renderVisuals(!previewUrl)}
            
            {/* CLEAN SIDEBAR (User Icons) */}
            {!previewUrl && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-50">
                <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="flex flex-col items-center gap-1">
                  <div className="p-3 bg-black/40 rounded-full border border-white/10"><RefreshCw size={22}/></div>
                  <span className="text-[9px] font-bold uppercase">Flip</span>
                </button>
                <button onClick={() => setShowFilters(true)} className="flex flex-col items-center gap-1">
                  <div className="p-3 bg-black/40 rounded-full border border-white/10 text-cyan-400"><Sparkles size={22}/></div>
                  <span className="text-[9px] font-bold uppercase">Effects</span>
                </button>
                <button onClick={() => setFlashOn(!flashOn)} className={`flex flex-col items-center gap-1 ${flashOn ? 'text-yellow-400' : ''}`}>
                  <div className="p-3 bg-black/40 rounded-full border border-white/10"><Zap size={22}/></div>
                  <span className="text-[9px] font-bold uppercase">Flash</span>
                </button>
              </div>
            )}

            {/* BOTTOM CONTROLS */}
            <div className="absolute bottom-0 inset-x-0 p-10 flex flex-col items-center gap-6 bg-gradient-to-t from-black via-transparent to-transparent z-50">
              {!previewUrl ? (
                <>
                  <div className="flex gap-4 bg-black/40 p-1 rounded-full border border-white/10 backdrop-blur-xl">
                    {[15, 30, 60].map(s => (
                      <button key={s} onClick={() => setDurationLimit(s)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold ${durationLimit === s ? 'bg-white text-black' : 'text-zinc-400'}`}>{s}S</button>
                    ))}
                  </div>
                  <button onClick={isRecording ? stopRecording : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500/20' : 'border-white/40'}`}>
                    <div className={`bg-red-600 transition-all ${isRecording ? 'w-8 h-8 rounded-md animate-pulse' : 'w-16 h-16 rounded-full'}`}/>
                  </button>
                </>
              ) : (
                <div className="flex gap-4 w-full px-6">
                  <button onClick={() => { setPreviewUrl(''); initCamera(); }} className="flex-1 py-4 bg-zinc-900 rounded-2xl font-bold text-xs uppercase">Reshoot</button>
                  <button onClick={() => setIsFinalStep(true)} className="flex-1 py-4 bg-red-600 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2">Next <ChevronRight size={16}/></button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* PUBLISH SCREEN */
          <div className="h-full bg-zinc-950 p-6 flex flex-col gap-6 animate-in slide-in-from-right">
            <div className="flex items-center gap-4"><button onClick={() => setIsFinalStep(false)}><ArrowLeft/></button><h2 className="text-xl font-black italic uppercase">Post</h2></div>
            <div className="flex gap-4 p-4 bg-zinc-900 rounded-3xl border border-white/5">
              <div className="w-24 h-36 bg-black rounded-xl overflow-hidden border border-white/10">{renderVisuals(false)}</div>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write a caption..." className="flex-1 bg-transparent outline-none py-2 text-sm font-medium resize-none"/>
            </div>
            {isUploading && (
              <div className="space-y-2 px-2">
                <div className="flex justify-between text-[10px] font-bold text-blue-400"><span>{statusText}</span><span>{uploadProgress}%</span></div>
                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${uploadProgress}%`}}/></div>
              </div>
            )}
            <button onClick={handlePublish} disabled={isUploading} className="mt-auto w-full bg-red-600 py-5 rounded-2xl font-bold text-sm uppercase flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50">
              {isUploading ? <Loader2 className="animate-spin"/> : <Send size={18}/>} {isUploading ? "Posting..." : "Post Now"}
            </button>
          </div>
        )}
      </main>

      {/* FILTER DRAWER */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-900 z-[100] rounded-t-3xl border-t border-white/10 p-6 pb-10 animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center mb-6 px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Effects (20)</span>
            <button onClick={() => setShowFilters(false)} className="p-1 bg-white/5 rounded-full"><X size={16}/></button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setActiveFilter(key)} className="flex flex-col items-center gap-2 shrink-0">
                <div className={`w-14 h-14 rounded-full border-2 transition-all ${activeFilter === key ? 'border-red-500 scale-110 shadow-lg shadow-red-500/20' : 'border-white/10 opacity-60'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover rounded-full" style={{ filter: FILTERS_DATA[key].style }}/>
                </div>
                <span className={`text-[9px] font-bold uppercase ${activeFilter === key ? 'text-white' : 'text-zinc-600'}`}>{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MUSIC SELECTION */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[200] p-6 flex flex-col gap-6 animate-in slide-in-from-bottom">
          <div className="flex items-center gap-4"><button onClick={() => { setShowMusic(false); audioRef.current?.pause(); setAudioPlayId(null); }}><X/></button><h2 className="text-2xl font-black italic uppercase text-pink-500">Music</h2></div>
          <div className="bg-zinc-900 rounded-2xl flex items-center px-4 py-3 border border-white/5"><Search size={18} className="text-zinc-500"/><input className="bg-transparent flex-1 ml-3 text-sm font-bold outline-none" placeholder="Search..." value={musicQuery} onChange={e => setMusicQuery(e.target.value)}/></div>
          <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pb-20">
            {filteredMusic.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4 flex-1" onClick={() => { if (audioRef.current) { if (audioPlayId === m.id) { audioRef.current.pause(); setAudioPlayId(null); } else { audioRef.current.src = m.audio_url; audioRef.current.play(); setAudioPlayId(m.id); } } }}>
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">{audioPlayId === m.id ? <Pause size={18} className="text-pink-500"/> : <Play size={18}/>}</div>
                  <div><h4 className="text-sm font-bold truncate max-w-[150px]">{m.title}</h4><p className="text-[9px] text-zinc-500 uppercase font-black">{m.artist}</p></div>
                </div>
                <button onClick={() => { setActiveMusic(m); setShowMusic(false); }} className="px-5 py-2 bg-pink-600 rounded-full text-[10px] font-bold uppercase">Use</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <audio ref={audioRef} hidden onEnded={() => setAudioPlayId(null)}/>
      <style jsx global>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
} 
