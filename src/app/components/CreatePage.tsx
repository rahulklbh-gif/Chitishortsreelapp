"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock, ArrowLeft,
  Settings, Volume2, ShieldCheck, Search, Zap, Clock, Info
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * 🛠️ CLOUDFLARE R2 CONFIGURATION (Full detail)
 */
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

/**
 * 🎨 20 FAST WORKING FILTERS (Beauty + VFX + Grid)
 */
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  // BEAUTY (Gora Look)
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.5px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  // VFX & LIGHTS
  storm: { name: "Lightning", style: "contrast(1.3) brightness(1.1)", isVFX: true, vfxType: 'lightning', thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  pulse: { name: "Flash Beat", style: "", isVFX: true, vfxType: 'pulse', thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  // GRID LAYOUTS
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  // CINEMATIC
  cine: { name: "CineMax", style: "contrast(1.6) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Vintage", style: "sepia(0.8) contrast(1.2) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.8)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  warm: { name: "Sunny", style: "sepia(0.4) saturate(1.6) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  gold: { name: "Royal Gold", style: "sepia(0.5) brightness(1.1) saturate(2)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  cyber: { name: "Cyberpunk", style: "hue-rotate(280deg) saturate(2) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  dream: { name: "Dreamy", style: "blur(1.2px) brightness(1.2)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  mono: { name: "Classic", style: "grayscale(1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  vivid: { name: "Ultra Vivid", style: "saturate(3) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  ocean: { name: "Oceanic", style: "hue-rotate(180deg) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- BASIC STATES --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // -- CAMERA & RECORDING STATES --
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // -- UI & MUSIC STATES --
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('none');

  // -- REFS (Fixed Memory Management) --
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  /**
   * 🎵 1. LOAD MUSIC LIBRARY
   */
  useEffect(() => {
    const fetchMusic = async () => {
      const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
      if (data) setMusicList(data);
    };
    fetchMusic();
  }, []);

  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [musicList, searchTerm]);

  /**
   * 🎥 2. CAMERA INITIALIZATION (Fixed Black Screen Problem)
   */
  const startCamera = async () => {
    if (!user) return;
    try {
      // Clear old streams first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: facingMode }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: true
      });

      streamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        // Wait for video to be ready before playing
        videoPreviewRef.current.onloadedmetadata = () => {
          videoPreviewRef.current?.play().catch(e => console.error("Camera play error:", e));
        };
      }
      setIsCameraMode(true);
    } catch (err) {
      toast.error("Camera Access Denied or Error.");
      setIsCameraMode(false);
    }
  };

  useEffect(() => {
    if (isCameraMode) {
      startCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isCameraMode, facingMode]);

  /**
   * 🎙️ 3. PRO RECORDING (Sync Music + Mic 30% Balance)
   */
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    let mixedStream = streamRef.current;

    // Apply Audio Mixing if music is selected
    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        const destination = ctx.createMediaStreamDestination();
        
        const musicGain = ctx.createGain(); 
        musicGain.gain.value = 1.0; 
        
        const micGain = ctx.createGain(); 
        micGain.gain.value = 0.3; // Important: Soft Mic, Loud Music

        musicSource.connect(musicGain).connect(destination);
        micSource.connect(micGain).connect(destination);
        musicGain.connect(ctx.destination);

        mixedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } catch (e) {
        console.error("Mixing Error:", e);
      }
    }

    const recorder = new MediaRecorder(mixedStream, { 
      mimeType: 'video/webm;codecs=vp8,opus',
      videoBitsPerSecond: 5000000 
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setSelectedFile(new File([blob], `chiti_vid.webm`, { type: 'video/webm' }));
      
      // Calculate Exact Duration
      const v = document.createElement('video');
      v.src = url;
      v.onloadedmetadata = () => setVideoDuration(Math.round(v.duration));
      
      setIsCameraMode(false);
      setIsRecording(false);
      audioRef.current?.pause();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordLimit);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          mediaRecorderRef.current?.stop();
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /**
   * 📤 4. UPLOAD LOGIC (With Real-time Progress Bar %)
   */
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(5); // Start

    try {
      const timestamp = Date.now();
      const fileName = `chiti_vids/${user.id}/${timestamp}.webm`;
      const fileBuffer = await selectedFile.arrayBuffer();

      // Progress bar simulation
      const progInterval = setInterval(() => {
        setUploadProgress(p => (p < 95 ? p + 2 : p));
      }, 350);

      const client = new S3Client({
        region: "auto",
        endpoint: R2_CONFIG.endpoint, 
        credentials: { 
          accessKeyId: R2_CONFIG.accessKeyId, 
          secretAccessKey: R2_CONFIG.secretAccessKey 
        },
        forcePathStyle: true, 
      });

      await client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: 'video/webm',
      }));

      clearInterval(progInterval);
      setUploadProgress(98);

      const videoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      const finalTitle = caption.trim() || "Chiti Sound";

      // DB entries
      await Promise.all([
        supabase.from('posts').insert([{
          video_url: videoUrl,
          caption: finalTitle,
          user_id: user.id,
          user_name: user.user_metadata?.full_name || 'Creator',
          thumbnail_url: `${videoUrl}#t=0.5`
        }]),
        supabase.from('music_library').insert([{
          title: finalTitle,
          audio_url: videoUrl,
          user_id: user.id,
          created_at: new Date().toISOString()
        }])
      ]);

      setUploadProgress(100);
      toast.success('Posted Successfully!');
      setTimeout(() => window.location.href = '/', 1000);
    } catch (err: any) {
      toast.error("Upload failed.");
      setIsUploading(false);
    }
  };

  /**
   * 📺 5. THE STUDIO RENDERER (Filters + Grids + VFX)
   */
  const renderStudioDisplay = (url?: string) => {
    const filter = FILTERS_DATA[selectedFilter];
    const gridCount = filter.isGrid ? filter.gridCount : 1;
    const isLightning = filter.vfxType === 'lightning';

    const VideoComponent = ({ isRef }: { isRef: boolean }) => (
      <video 
        ref={isRef ? videoPreviewRef : null}
        src={url}
        className={`w-full h-full object-cover ${facingMode === 'user' && !url ? 'scale-x-[-1]' : ''}`}
        style={{ filter: filter.style }}
        autoPlay playsInline muted={!url} // Sync handles music for recorded vids
        loop
      />
    );

    return (
      <div className={`relative w-full h-full overflow-hidden ${filter.isGrid ? `grid ${gridCount === 3 ? 'grid-cols-1 grid-rows-3' : 'grid-cols-2'}` : ''}`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative overflow-hidden border-[0.5px] border-white/10">
            <VideoComponent isRef={i === 0} />
          </div>
        ))}
        {isLightning && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
            <div className="absolute top-0 left-1/4 w-1 h-full bg-white/40 blur-3xl animate-[bounce_0.2s_infinite]" />
            <div className="absolute top-0 right-1/4 w-1 h-full bg-white/40 blur-3xl animate-[bounce_0.3s_infinite]" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden selection:bg-blue-500">
      
      {/* 🔝 HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic text-blue-600 flex items-center gap-1 tracking-tighter">CHITI <Zap size={20} fill="currentColor"/></h1>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-gray-400">STUDIO ACTIVE</span>
          </div>
        </div>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/10 transition-all"><X size={24}/></button>
        )}
      </div>

      {!user ? (
        /* 🔒 AUTH PROTECT */
        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-zinc-950">
          <ShieldCheck size={60} className="text-blue-500 mb-6" />
          <h2 className="text-3xl font-black mb-10 text-center tracking-tight">STUDIO LOCKED</h2>
          <a href="/login" className="px-20 py-5 bg-blue-600 rounded-full font-black text-lg shadow-2xl active:scale-95 transition-all">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* 🏠 MAIN MENU */
        <div className="flex-1 flex flex-col items-center justify-center gap-16">
          <button onClick={() => setIsCameraMode(true)} className="w-64 h-64 bg-blue-600 rounded-[80px] flex flex-col items-center justify-center shadow-[0_30px_60px_rgba(37,99,235,0.3)] active:scale-90 transition-all group">
            <Camera size={90} className="text-white mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-black italic tracking-widest uppercase">Start Shoot</span>
          </button>
          
          <label className="w-80 p-6 bg-zinc-900/40 rounded-[40px] flex items-center justify-center gap-5 border border-white/5 cursor-pointer hover:bg-zinc-900 transition-all group">
            <Upload size={30} className="text-blue-500 group-hover:bounce" />
            <div className="flex flex-col text-left">
              <span className="font-black uppercase text-xs tracking-widest">Open Gallery</span>
              <span className="text-[10px] text-gray-500 font-bold italic tracking-tighter">Maximum length 30s</span>
            </div>
            <input type="file" hidden accept="video/*" onChange={(e) => {
               const file = e.target.files?.[0];
               if(file) {
                 const v = document.createElement('video');
                 v.src = URL.createObjectURL(file);
                 v.onloadedmetadata = () => {
                   if(v.duration > 31) return toast.error("Video too long!");
                   setSelectedFile(file);
                   setPreviewUrl(URL.createObjectURL(file));
                   setVideoDuration(Math.round(v.duration));
                 }
               }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* 🎥 RECORDING INTERFACE */
        <div className="relative flex-1 bg-black">
          {renderStudioDisplay()}
          
          <div className="absolute right-5 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-5 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 active:rotate-180 transition-all duration-500"><RefreshCw size={28}/></button>
            <button onClick={() => setShowFilters(true)} className="p-5 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]"><Sparkles size={28}/></button>
            <button onClick={() => setShowMusic(true)} className="p-5 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 text-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]"><Music size={28}/></button>
          </div>

          <div className="absolute bottom-16 inset-x-0 flex flex-col items-center gap-8 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/50 backdrop-blur-3xl p-1.5 rounded-full border border-white/10 shadow-2xl">
                {[15, 30].map(sec => (
                  <button key={sec} onClick={() => {setRecordLimit(sec); setTimeLeft(sec);}} className={`px-12 py-3.5 rounded-full text-[11px] font-black tracking-[0.2em] transition-all ${recordLimit === sec ? 'bg-white text-black scale-105' : 'text-gray-400'}`}>{sec}S</button>
                ))}
              </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-24 h-24 rounded-full border-[7px] flex items-center justify-center transition-all ${isRecording ? 'border-red-600 scale-110 shadow-[0_0_40px_rgba(220,38,38,0.6)]' : 'border-white shadow-2xl'}`}>
              <div className={`${isRecording ? 'w-10 h-10 bg-red-600 rounded-xl animate-pulse' : 'w-16 h-16 bg-white rounded-full'}`} />
            </button>
            {isRecording && <div className="font-black text-red-500 bg-black/60 px-8 py-2.5 rounded-full text-xs animate-bounce tracking-widest border border-red-500/30 uppercase">{timeLeft}S RECORDING</div>}
          </div>
        </div>
      ) : (
        /* 🎬 PREVIEW & PUBLISH UI */
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1300] animate-in slide-in-from-right duration-500">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              {renderStudioDisplay(previewUrl)}
              
              <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-xl px-6 py-2 rounded-full border border-white/10 z-[1320] flex items-center gap-3">
                <Clock size={14} className="text-blue-500"/>
                <span className="text-xs font-black tracking-widest">{videoDuration} Seconds Video</span>
              </div>

              <div className="absolute top-0 inset-x-0 p-8 flex justify-between items-center z-[1310] bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-4 bg-black/50 backdrop-blur-md rounded-full border border-white/10"><ArrowLeft/></button>
                <div className="flex gap-4">
                  <button onClick={() => setShowFilters(true)} className="p-4 bg-black/50 backdrop-blur-md rounded-full text-blue-400 border border-white/10"><Sparkles/></button>
                  <button onClick={() => setIsFinalStep(true)} className="px-16 py-4 bg-blue-600 rounded-full font-black text-sm tracking-widest shadow-2xl active:scale-95">NEXT</button>
                </div>
              </div>
              
              {/* Force Music Play in Preview */}
              {selectedMusic && (
                 <button 
                   onClick={() => { if(audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } }}
                   className="absolute bottom-12 left-10 p-5 bg-pink-600 rounded-full shadow-[0_0_30px_rgba(219,39,119,0.5)] z-[1320] animate-pulse"
                 >
                   <Music size={24}/>
                 </button>
              )}
            </div>
          ) : (
            <div className="flex-1 p-8 flex flex-col overflow-y-auto bg-black">
              <div className="flex items-center gap-5 mb-16">
                <button onClick={() => setIsFinalStep(false)} className="p-4 bg-white/5 rounded-full border border-white/5"><ArrowLeft size={28}/></button>
                <h2 className="text-3xl font-black italic tracking-tighter">READY TO POST</h2>
              </div>
              
              <div className="flex gap-8 mb-20">
                <div className="w-44 h-64 bg-zinc-900 rounded-[45px] overflow-hidden border border-white/10 shadow-2xl relative group">
                   {renderStudioDisplay(previewUrl)}
                </div>
                <div className="flex-1 flex flex-col pt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Info size={12} className="text-blue-500"/>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Caption & Details</span>
                  </div>
                  <textarea 
                    placeholder="Enter music name or describe your video..." 
                    className="w-full h-48 bg-transparent border-b border-white/10 py-5 outline-none font-bold text-2xl resize-none focus:border-blue-500 transition-all placeholder:text-zinc-700" 
                    value={caption} 
                    onChange={(e) => setCaption(e.target.value)} 
                  />
                </div>
              </div>

              {/* 📊 PROGRESS BAR (Full Detail) */}
              {isUploading && (
                <div className="mb-14 space-y-4 animate-in fade-in zoom-in duration-500">
                   <div className="flex justify-between items-end">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-1.5">Network Status</span>
                        <span className="text-sm font-bold text-zinc-400 italic">Uploading to R2 Cloud...</span>
                      </div>
                      <div className="text-4xl font-black italic text-blue-500">{uploadProgress}%</div>
                   </div>
                   <div className="w-full h-3.5 bg-zinc-900/80 rounded-full overflow-hidden border border-white/5 shadow-inner">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300 shadow-[0_0_25px_#2563eb]" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                   </div>
                </div>
              )}

              <button 
                onClick={handlePublish} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-7 rounded-[50px] font-black text-2xl flex items-center justify-center gap-5 shadow-[0_20px_50px_rgba(37,99,235,0.4)] active:scale-95 transition-all disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin" size={35}/> : <Send size={35}/>}
                {isUploading ? 'UPLOADING...' : 'PUBLISH NOW'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🎨 FILTER DRAWER (Full Library) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur-3xl z-[1500] p-10 pb-16 rounded-t-[60px] border-t border-white/10 animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
              <div className="w-2.5 h-10 bg-blue-600 rounded-full shadow-[0_0_15px_#2563eb]" />
              <h3 className="font-black text-2xl uppercase tracking-widest italic">Visual Effects</h3>
            </div>
            <button onClick={() => setShowFilters(false)} className="p-4 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={28}/></button>
          </div>
          <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 px-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-4 transition-all">
                <div className={`w-28 h-36 rounded-[35px] overflow-hidden border-[3px] transition-all duration-300 ${selectedFilter === key ? 'border-blue-500 scale-110 shadow-[0_0_30px_rgba(37,99,235,0.6)]' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🎵 MUSIC DRAWER */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1600] p-10 pt-28 overflow-y-auto animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-5xl font-black italic tracking-tighter text-blue-600">SOUNDS</h2>
            <button onClick={() => setShowMusic(false)} className="p-5 bg-white/5 rounded-full border border-white/5"><X size={32}/></button>
          </div>
          <div className="relative mb-12">
            <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-zinc-500" size={24}/>
            <input 
              type="text" 
              placeholder="Search Chiti music library..." 
              className="w-full bg-zinc-900/60 border border-white/10 rounded-[35px] py-7 pl-18 pr-7 outline-none font-bold text-xl focus:border-blue-600 transition-all shadow-inner" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="space-y-5">
            {filteredMusic.map(music => (
              <div key={music.id} className={`p-7 rounded-[45px] flex items-center justify-between border-2 transition-all duration-300 ${selectedMusic?.id === music.id ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.2)]' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}>
                <div className="flex items-center gap-8 flex-1" onClick={() => {
                    if(playingMusicId === music.id) { 
                      audioRef.current?.pause(); 
                      setPlayingMusicId(null); 
                    } else { 
                      audioRef.current!.src = music.audio_url; 
                      audioRef.current?.play(); 
                      setPlayingMusicId(music.id); 
                    }
                }}>
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all ${playingMusicId === music.id ? 'bg-blue-600 shadow-lg scale-110' : 'bg-white/5'}`}>
                    {playingMusicId === music.id ? <Pause size={30} fill="white"/> : <Play size={30} fill="white" className="ml-1.5"/>}
                  </div>
                  <div className="flex flex-col">
                    <p className="font-black text-xl truncate w-48">{music.title}</p>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-1">Official Chiti Sound</p>
                  </div>
                </div>
                <button onClick={() => {setSelectedMusic(music); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className={`p-7 rounded-3xl transition-all ${selectedMusic?.id === music.id ? 'bg-blue-600 shadow-xl' : 'bg-white/5 hover:bg-white/10'}`}>
                  <Check size={28} strokeWidth={4}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 🧩 HIDDEN SYNC PLAYER */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
