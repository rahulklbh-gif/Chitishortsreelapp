"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock, ArrowLeft,
  Settings, Volume2, ShieldCheck, Search, Zap, Clock
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * 🛠️ CLOUDFLARE R2 CONFIGURATION
 */
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

/**
 * 🎨 20+ FAST WORKING FILTERS (Beauty, VFX, Column Grids)
 */
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.5px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  storm: { name: "Lightning", style: "contrast(1.3) brightness(1.1)", isVFX: true, vfxType: 'lightning', thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
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
  pulse: { name: "Flash Beat", style: "", isVFX: true, vfxType: 'pulse', thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- STATES --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [recordedFacingMode, setRecordedFacingMode] = useState<'user' | 'environment'>('user');
  
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
   * 🎵 MUSIC SYSTEM
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
   * 🎥 CAMERA STABILIZER (Fixed Black Screen Error)
   */
  const startCamera = async () => {
    if (!user) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: 1280, height: 720 },
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
      toast.error("Camera error. Please check permissions.");
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
   * 🎙️ RECORDING LOGIC (Mic 30% | Music 100%)
   */
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
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
        micGain.gain.value = 0.3; // Mic reduced to 30% for studio effect

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
      videoBitsPerSecond: 4500000 
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setSelectedFile(new File([blob], `chiti_${Date.now()}.webm`, { type: 'video/webm' }));
      
      // Get Duration
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
   * 📤 PUBLISH WITH REAL-TIME PROGRESS
   */
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(5);

    try {
      const timestamp = Date.now();
      const fileName = `chiti_vids/${user.id}/${timestamp}.webm`;
      const fileBuffer = await selectedFile.arrayBuffer();

      // Progress Simulation (AWS SDK doesn't support progress in simple PutObject)
      const progInterval = setInterval(() => {
        setUploadProgress(p => (p < 90 ? p + 2 : p));
      }, 300);

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
      setUploadProgress(95);

      const videoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      const finalTitle = caption.trim() || "Chiti Music";

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
      toast.success('Successfully Posted!');
      setTimeout(() => window.location.href = '/', 1000);
    } catch (err: any) {
      toast.error("Upload failed. Try again.");
      setIsUploading(false);
    }
  };

  /**
   * 📺 DYNAMIC VIDEO RENDERER (Filters + Grids + Sync)
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
        autoPlay playsInline muted={!url} // Preview URL muted because we handle music separately
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
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
            <div className="absolute top-0 left-1/4 w-1 h-full bg-white/40 blur-3xl animate-[bounce_0.2s_infinite]" />
            <div className="absolute top-0 right-1/4 w-1 h-full bg-white/40 blur-3xl animate-[bounce_0.3s_infinite]" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden font-sans">
      
      {/* 🔝 Top Nav */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic text-blue-500 flex items-center gap-1">CHITI <Zap size={18} fill="currentColor"/></h1>
          <p className="text-[8px] font-bold tracking-widest text-blue-300">PRO STUDIO MODE</p>
        </div>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X size={24}/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950">
          <ShieldCheck size={50} className="text-blue-500 mb-6 animate-pulse" />
          <h2 className="text-2xl font-black mb-8">IDENTITY REQUIRED</h2>
          <a href="/login" className="px-16 py-4 bg-blue-600 rounded-full font-black text-lg tracking-widest">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* 🏠 MAIN MENU */
        <div className="flex-1 flex flex-col items-center justify-center gap-14">
          <button onClick={() => setIsCameraMode(true)} className="w-64 h-64 bg-blue-600 rounded-[70px] flex flex-col items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.3)] active:scale-90 transition-all">
            <Camera size={80} className="text-white mb-2" />
            <span className="text-xl font-black italic tracking-widest uppercase">Shoot Video</span>
          </button>
          
          <label className="w-80 p-6 bg-zinc-900/50 rounded-[35px] flex items-center justify-center gap-5 border border-white/5 cursor-pointer hover:bg-zinc-900 transition-all">
            <Upload size={28} className="text-blue-500"/>
            <div className="flex flex-col text-left">
              <span className="font-black uppercase text-xs tracking-wider">From Gallery</span>
              <span className="text-[10px] text-gray-500 font-bold italic tracking-tighter">Max Length: 30 Seconds</span>
            </div>
            <input type="file" hidden accept="video/*" onChange={handleGalleryVideo} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* 🎥 RECORDING INTERFACE */
        <div className="relative flex-1 bg-black">
          {renderStudioDisplay()}
          
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-5 bg-black/50 backdrop-blur-2xl rounded-3xl border border-white/10"><RefreshCw size={26}/></button>
            <button onClick={() => setShowFilters(true)} className="p-5 bg-black/50 backdrop-blur-2xl rounded-3xl border border-white/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]"><Sparkles size={26}/></button>
            <button onClick={() => setShowMusic(true)} className="p-5 bg-black/50 backdrop-blur-2xl rounded-3xl border border-white/10 text-pink-500"><Music size={26}/></button>
          </div>

          <div className="absolute bottom-12 inset-x-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/50 backdrop-blur-2xl p-1 rounded-full border border-white/10 shadow-xl">
                {[15, 30].map(sec => (
                  <button key={sec} onClick={() => {setRecordLimit(sec); setTimeLeft(sec);}} className={`px-10 py-3 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === sec ? 'bg-white text-black' : 'text-gray-400'}`}>{sec}S</button>
                ))}
              </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'border-white shadow-2xl'}`}>
              <div className={`${isRecording ? 'w-10 h-10 bg-red-500 rounded-xl animate-pulse' : 'w-16 h-16 bg-white rounded-full'}`} />
            </button>
            {isRecording && <div className="font-black text-red-500 bg-black/60 px-6 py-2 rounded-full text-xs animate-bounce tracking-widest border border-red-500/30">{timeLeft}S RECORDING</div>}
          </div>
        </div>
      ) : (
        /* 🎬 PREVIEW & FINAL STEPS */
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1300] animate-in slide-in-from-right duration-500">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              {renderStudioDisplay(previewUrl)}
              
              {/* 🕒 Duration Indicator */}
              <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 z-[1320] flex items-center gap-2">
                <Clock size={12} className="text-blue-400"/>
                <span className="text-[10px] font-black">{videoDuration}s Video</span>
              </div>

              <div className="absolute top-0 inset-x-0 p-8 flex justify-between items-center z-[1310] bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-4 bg-black/50 rounded-full border border-white/5"><ArrowLeft/></button>
                <div className="flex gap-4">
                  <button onClick={() => setShowFilters(true)} className="p-4 bg-black/50 rounded-full text-blue-400 border border-white/5"><Sparkles/></button>
                  <button onClick={() => setIsFinalStep(true)} className="px-14 py-4 bg-blue-600 rounded-full font-black text-sm tracking-widest shadow-xl active:scale-95 transition-all">NEXT</button>
                </div>
              </div>
              
              {/* Force Music Sync in Preview */}
              <button 
                onClick={() => {
                   if(audioRef.current) {
                     audioRef.current.currentTime = 0;
                     audioRef.current.play();
                   }
                }}
                className="absolute bottom-10 left-10 p-4 bg-pink-600 rounded-full shadow-lg z-[1320] animate-pulse"
              >
                <Music size={20}/>
              </button>
            </div>
          ) : (
            <div className="flex-1 p-8 flex flex-col overflow-y-auto">
              <div className="flex items-center gap-4 mb-14">
                <button onClick={() => setIsFinalStep(false)} className="p-4 bg-white/5 rounded-full"><ArrowLeft size={24}/></button>
                <h2 className="text-2xl font-black italic tracking-tighter">FINAL PUBLISH</h2>
              </div>
              
              <div className="flex gap-8 mb-16">
                <div className="w-40 h-60 bg-zinc-900 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative group">
                   {renderStudioDisplay(previewUrl)}
                   <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all"/>
                </div>
                <div className="flex-1 pt-2">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3 block">Caption & Title</span>
                  <textarea 
                    placeholder="Enter music title or video description..." 
                    className="w-full h-44 bg-transparent border-b border-white/10 py-4 outline-none font-bold text-xl resize-none focus:border-blue-500 transition-all" 
                    value={caption} 
                    onChange={(e) => setCaption(e.target.value)} 
                  />
                </div>
              </div>

              {/* 📊 REAL-TIME UPLOAD PROGRESS */}
              {isUploading && (
                <div className="mb-10 space-y-3 animate-in fade-in duration-500">
                   <div className="flex justify-between items-end">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Status</span>
                        <span className="text-xs font-bold text-gray-400 italic">Sending to Chiti Clouds...</span>
                      </div>
                      <span className="text-2xl font-black italic text-blue-500">{uploadProgress}%</span>
                   </div>
                   <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5 shadow-inner">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300 shadow-[0_0_20px_#2563eb]" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                   </div>
                </div>
              )}

              <button 
                onClick={handlePublish} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-6 rounded-[45px] font-black text-2xl flex items-center justify-center gap-4 shadow-[0_15px_40px_rgba(37,99,235,0.4)] active:scale-95 transition-all disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin" size={32}/> : <Send size={32}/>}
                {isUploading ? 'UPLOADING...' : 'POST NOW'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🎨 FILTER DRAWER (20 FAST FILTERS) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950/98 backdrop-blur-3xl z-[1500] p-8 pb-14 rounded-t-[50px] border-t border-white/10 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 bg-blue-500 rounded-full" />
              <h3 className="font-black text-xl uppercase tracking-widest">Filters</h3>
            </div>
            <button onClick={() => setShowFilters(false)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={24}/></button>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4 px-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-3 transition-all">
                <div className={`w-24 h-32 rounded-[28px] overflow-hidden border-2 transition-all ${selectedFilter === key ? 'border-blue-500 scale-110 shadow-[0_0_25px_rgba(37,99,235,0.5)]' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🎵 MUSIC LIBRARY */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1600] p-8 pt-24 overflow-y-auto animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-4xl font-black italic tracking-tighter">MUSIC</h2>
            <button onClick={() => setShowMusic(false)} className="p-4 bg-white/5 rounded-full"><X size={28}/></button>
          </div>
          <div className="relative mb-10">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500" size={20}/>
            <input 
              type="text" 
              placeholder="Search trending sounds..." 
              className="w-full bg-zinc-900/50 border border-white/10 rounded-[25px] py-6 pl-16 pr-6 outline-none font-bold text-lg focus:border-blue-500 transition-all shadow-inner" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="space-y-4">
            {filteredMusic.map(music => (
              <div key={music.id} className={`p-6 rounded-[35px] flex items-center justify-between border-2 transition-all ${selectedMusic?.id === music.id ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}>
                <div className="flex items-center gap-6 flex-1" onClick={() => {
                    if(playingMusicId === music.id) { 
                      audioRef.current?.pause(); 
                      setPlayingMusicId(null); 
                    } else { 
                      audioRef.current!.src = music.audio_url; 
                      audioRef.current?.play(); 
                      setPlayingMusicId(music.id); 
                    }
                }}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${playingMusicId === music.id ? 'bg-blue-500 animate-pulse' : 'bg-white/5'}`}>
                    {playingMusicId === music.id ? <Pause size={24} fill="white"/> : <Play size={24} fill="white" className="ml-1"/>}
                  </div>
                  <div className="flex flex-col">
                    <p className="font-black text-lg truncate w-44">{music.title}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Chiti Official Sound</p>
                  </div>
                </div>
                <button onClick={() => {setSelectedMusic(music); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className={`p-6 rounded-2xl transition-all ${selectedMusic?.id === music.id ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'}`}>
                  <Check size={24} strokeWidth={3}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
