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
 * 🎨 20 FAST WORKING FILTERS (Sare original filters wapas add kar diye hain)
 */
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.5px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  storm: { name: "Lightning", style: "contrast(1.3) brightness(1.1)", isVFX: true, vfxType: 'lightning', thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  pulse: { name: "Flash Beat", style: "", isVFX: true, vfxType: 'pulse', thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
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

  // -- REFS --
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
   * 🎥 2. CAMERA INITIALIZATION (Fixed Black Screen & Mirror)
   */
  const startCamera = async () => {
    if (!user) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.onloadedmetadata = () => {
          videoPreviewRef.current?.play().catch(e => console.error("Play error:", e));
        };
      }
      setIsCameraMode(true);
    } catch (err) {
      toast.error("Camera Access Denied.");
      setIsCameraMode(false);
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [isCameraMode, facingMode]);

  /**
   * 🎙️ 3. PRO RECORDING (Sync Music + Mic 30% Balance)
   * FIX: Maine AudioContext ko tab tak start nahi kiya jab tak recording shuru na ho, 
   * taaki camera "busy" na dikhaye (Black screen fix).
   */
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    let mixedStream = streamRef.current;

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
        micGain.gain.value = 0.4; // Mic clear rahega

        musicSource.connect(musicGain).connect(destination);
        micSource.connect(micGain).connect(destination);
        musicGain.connect(ctx.destination);

        mixedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } catch (e) { console.error("Mixing Error:", e); }
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
    setUploadProgress(5);

    try {
      const fileName = `chiti_vids/${user.id}/${Date.now()}.webm`;
      const fileBuffer = await selectedFile.arrayBuffer();

      const progInterval = setInterval(() => {
        setUploadProgress(p => (p < 95 ? p + 2 : p));
      }, 400);

      const client = new S3Client({
        region: "auto",
        endpoint: R2_CONFIG.endpoint, 
        credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
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
      await Promise.all([
        supabase.from('posts').insert([{
          video_url: videoUrl,
          caption: caption || "Chiti Sound",
          user_id: user.id,
          user_name: user.user_metadata?.full_name || 'Creator',
          thumbnail_url: `${videoUrl}#t=0.5`
        }]),
        supabase.from('music_library').insert([{
          title: caption || "Chiti Sound",
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

    return (
      <div className={`relative w-full h-full overflow-hidden ${filter.isGrid ? `grid ${gridCount === 3 ? 'grid-cols-1 grid-rows-3' : 'grid-cols-2'}` : ''}`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative overflow-hidden">
            <video 
              ref={i === 0 ? videoPreviewRef : null}
              src={url}
              className={`w-full h-full object-cover ${facingMode === 'user' && !url ? 'scale-x-[-1]' : ''}`}
              style={{ filter: filter.style }}
              autoPlay playsInline muted={!url} loop
            />
          </div>
        ))}
        {isLightning && (
          <div className="absolute inset-0 z-20 pointer-events-none bg-blue-500/10 animate-pulse" />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      
      {/* 🔝 HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-black italic text-blue-600 flex items-center gap-1 tracking-tighter">CHITI <Zap size={18} fill="currentColor"/></h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center"><ShieldCheck size={50} className="text-blue-500 mb-4"/><a href="/login" className="px-10 py-4 bg-blue-600 rounded-full font-black text-xs uppercase">Sign In</a></div>
      ) : !isCameraMode && !previewUrl ? (
        /* 🏠 MAIN MENU */
        <div className="flex-1 flex flex-col items-center justify-center gap-16">
          <button onClick={() => setIsCameraMode(true)} className="w-52 h-52 bg-blue-600 rounded-[70px] flex flex-col items-center justify-center shadow-2xl active:scale-90 transition-all">
            <Camera size={70} />
            <span className="text-[10px] font-black uppercase mt-2 italic">Start Shoot</span>
          </button>
          
          <label className="flex items-center gap-4 px-10 py-5 bg-zinc-900 rounded-full border border-white/5 cursor-pointer hover:bg-zinc-800 transition-all">
            <Upload size={24} className="text-blue-500" />
            <span className="text-xs font-black uppercase italic tracking-widest">Gallery</span>
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
          
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10"><RefreshCw size={22}/></button>
            <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 text-blue-400"><Sparkles size={22}/></button>
            <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 text-pink-500"><Music size={22}/></button>
          </div>

          <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/50 p-1 rounded-full border border-white/10">
                {[15, 30].map(sec => (
                  <button key={sec} onClick={() => {setRecordLimit(sec); setTimeLeft(sec);}} className={`px-10 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === sec ? 'bg-white text-black' : 'text-gray-400'}`}>{sec}S</button>
                ))}
              </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-600 scale-110 shadow-lg' : 'border-white'}`}>
              <div className={`${isRecording ? 'w-8 h-8 bg-red-600 rounded-lg animate-pulse' : 'w-14 h-14 bg-white rounded-full'}`} />
            </button>
            {isRecording && <div className="font-black text-red-500 text-[9px] tracking-[0.3em] uppercase">{timeLeft}S recording</div>}
          </div>
        </div>
      ) : (
        /* 🎬 PREVIEW & PUBLISH UI */
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1300] animate-in slide-in-from-right">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              {renderStudioDisplay(previewUrl)}
              
              <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-1.5 rounded-full border border-white/10 z-[1320] flex items-center gap-2">
                <Clock size={12} className="text-blue-500"/>
                <span className="text-[10px] font-black tracking-widest uppercase">{videoDuration}s Video</span>
              </div>

              <div className="absolute top-4 left-4 z-[1310]">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-3 bg-black/50 rounded-full"><ArrowLeft size={20}/></button>
              </div>

              <div className="absolute bottom-10 inset-x-0 px-8 flex justify-between items-center z-[1320]">
                {selectedMusic && <button onClick={() => audioRef.current?.play()} className="p-4 bg-pink-600 rounded-full shadow-lg animate-bounce"><Music size={20}/></button>}
                <button onClick={() => setIsFinalStep(true)} className="ml-auto px-12 py-4 bg-blue-600 rounded-full font-black text-xs tracking-widest shadow-2xl active:scale-95">NEXT</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col bg-black">
              <div className="flex items-center gap-4 mb-10 pt-4">
                <button onClick={() => setIsFinalStep(false)} className="p-3 bg-white/5 rounded-full"><ArrowLeft size={24}/></button>
                <h2 className="text-xl font-black italic tracking-tighter uppercase">Ready to Post</h2>
              </div>
              
              <div className="flex gap-6 mb-12">
                <div className="w-32 h-48 bg-zinc-900 rounded-[30px] overflow-hidden border border-white/10 shadow-2xl relative">
                   {renderStudioDisplay(previewUrl)}
                </div>
                <div className="flex-1 pt-2">
                  <textarea 
                    placeholder="Describe your video..." 
                    className="w-full h-32 bg-transparent border-b border-white/10 py-4 outline-none font-bold text-sm resize-none focus:border-blue-500 transition-all" 
                    value={caption} 
                    onChange={(e) => setCaption(e.target.value)} 
                  />
                </div>
              </div>

              {isUploading && (
                <div className="mb-10 space-y-2">
                   <div className="flex justify-between items-end text-[9px] font-black text-blue-500 tracking-widest uppercase italic"><span>Uploading to Cloud...</span><span>{uploadProgress}%</span></div>
                   <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              )}

              <button 
                onClick={handlePublish} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-6 rounded-[30px] font-black text-lg flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin" size={28}/> : <Send size={28}/>}
                <span className="uppercase tracking-tighter">{isUploading ? 'Sending...' : 'Publish'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🎨 FILTER DRAWER (20 Filters) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 rounded-t-[50px] z-[1500] border-t border-white/5 animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-xs uppercase tracking-widest italic text-zinc-500">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={18}/></button>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-3">
                <div className={`w-16 h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${selectedFilter === key ? 'border-blue-500 scale-105 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[8px] font-black uppercase text-zinc-600 tracking-tighter">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🎵 MUSIC DRAWER (Fixed Screenshot issue) */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1600] flex flex-col animate-in fade-in duration-300">
           {/* max-w-md fix for mobile screen alignment */}
           <div className="w-full max-w-md mx-auto h-full flex flex-col p-6 pt-16">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black italic tracking-tighter text-blue-600 uppercase">Sounds</h2>
                <button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full border border-white/5"><X size={24}/></button>
              </div>
              
              <div className="relative mb-8">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={20}/>
                <input 
                  type="text" 
                  placeholder="Search Chiti music..." 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-5 pl-14 pr-5 outline-none font-bold text-sm focus:border-blue-600 transition-all" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pb-20 no-scrollbar">
                {filteredMusic.map(music => (
                  <div key={music.id} className={`p-5 rounded-[35px] flex items-center justify-between border transition-all duration-300 ${selectedMusic?.id === music.id ? 'bg-blue-600/10 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                    <div className="flex items-center gap-5 flex-1" onClick={() => {
                        if(playingMusicId === music.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = music.audio_url; audioRef.current?.play(); setPlayingMusicId(music.id); }
                    }}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${playingMusicId === music.id ? 'bg-blue-600 scale-105' : 'bg-white/5'}`}>
                        {playingMusicId === music.id ? <Pause size={20}/> : <Play size={20} className="ml-0.5"/>}
                      </div>
                      <div className="flex flex-col">
                        <p className="font-black text-sm truncate w-36 uppercase tracking-tight italic">{music.title}</p>
                        <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Official Sound</p>
                      </div>
                    </div>
                    <button onClick={() => {setSelectedMusic(music); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className={`p-4 rounded-2xl transition-all ${selectedMusic?.id === music.id ? 'bg-blue-600' : 'bg-white/5'}`}>
                      <Check size={20} strokeWidth={4}/>
                    </button>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
      
      {/* 🧩 HIDDEN AUDIO PLAYER */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
