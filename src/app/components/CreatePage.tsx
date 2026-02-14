"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock, ArrowLeft,
  Settings, Volume2, ShieldCheck, Search, Zap, Layers
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
 * 🎨 20+ ADVANCED FILTERS DATA
 */
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  
  // BEAUTY (Gora Look)
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.4px) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },

  // VFX
  storm: { name: "Lightning", style: "contrast(1.4) brightness(1.1)", isVFX: true, vfxType: 'lightning', thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  
  // GRIDS (Split Screens)
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },

  // CINEMATIC & COLORS
  cine: { name: "CineMax", style: "contrast(1.6) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Vintage", style: "sepia(0.8) contrast(1.2) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.8)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  warm: { name: "Sunny", style: "sepia(0.4) saturate(1.6) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  gold: { name: "Royal Gold", style: "sepia(0.5) brightness(1.1) saturate(2)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  cyber: { name: "Cyberpunk", style: "hue-rotate(280deg) saturate(2) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  dream: { name: "Dreamy", style: "blur(1px) brightness(1.2) saturate(1.3)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- BASIC STATES --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Progress Bar State
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [recordedFacingMode, setRecordedFacingMode] = useState<'user' | 'environment'>('user');
  
  // -- UI STATES --
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

  // Load Music Database
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
   * 🎥 CAMERA ENGINE
   */
  const startCamera = async () => {
    if (!user) return;
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: 1280, height: 720 },
        audio: true
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraMode(true);
      setTimeLeft(recordLimit);
    } catch (err) { toast.error("Camera access failed."); }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [isCameraMode, facingMode]);

  /**
   * 📁 GALLERY LOGIC
   */
  const handleGalleryVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      if (video.duration > 31) {
        toast.error("Video too long (Max 30s)");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRecordedFacingMode('environment');
    };
    video.src = URL.createObjectURL(file);
  };

  /**
   * 🎙️ RECORDING (Mic 30% | Music 100%)
   */
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let mixedStream = streamRef.current;

    if (selectedMusic && audioRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        const destination = ctx.createMediaStreamDestination();
        
        const musicGain = ctx.createGain(); musicGain.gain.value = 1.0; 
        const micGain = ctx.createGain(); micGain.gain.value = 0.3; // Low Mic for pro feel

        musicSource.connect(musicGain).connect(destination);
        micSource.connect(micGain).connect(destination);
        musicGain.connect(ctx.destination);

        mixedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } catch (e) { console.error(e); }
    }

    const recorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 4000000 });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], `chiti_post.webm`, { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
      audioRef.current?.pause();
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { mediaRecorderRef.current?.stop(); clearInterval(timerRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  };

  /**
   * 📤 PUBLISH WITH PROGRESS BAR
   */
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(10); // Start progress

    try {
      const timestamp = Date.now();
      const fileName = `chiti_vids/${user.id}/${timestamp}.webm`;
      const fileBuffer = await selectedFile.arrayBuffer();

      // S3 / R2 Upload (Manual progress simulation since AWS SDK Free Tier lacks simple progress hook)
      const interval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 5 : prev));
      }, 400);

      const r2Client = new S3Client({
        region: "auto",
        endpoint: R2_CONFIG.endpoint, 
        credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
        forcePathStyle: true, 
      });

      await r2Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: 'video/webm',
      }));

      clearInterval(interval);
      setUploadProgress(95);

      const videoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      const finalTitle = caption.trim() || "Chiti Original Sound";

      await Promise.all([
        supabase.from('posts').insert([{ video_url: videoUrl, caption: finalTitle, user_id: user.id, user_name: user.user_metadata?.full_name || 'Creator', thumbnail_url: `${videoUrl}#t=0.5` }]),
        supabase.from('music_library').insert([{ title: finalTitle, audio_url: videoUrl, user_id: user.id, created_at: new Date().toISOString() }])
      ]);

      setUploadProgress(100);
      toast.success('Successfully Posted!');
      setTimeout(() => window.location.href = '/', 1000);
    } catch (err: any) {
      toast.error("Upload failed");
      setIsUploading(false);
    }
  };

  /**
   * 📺 VIDEO DISPLAY SYSTEM
   */
  const renderDisplay = (url?: string) => {
    const filter = FILTERS_DATA[selectedFilter];
    const grid = filter.isGrid ? filter.gridCount : 1;
    const VideoTag = ({ isMain }: { isMain: boolean }) => (
      <video ref={isMain ? videoPreviewRef : null} src={url} className={`w-full h-full object-cover ${facingMode === 'user' && !url ? 'scale-x-[-1]' : ''}`} style={{ filter: filter.style }} autoPlay playsInline muted loop={!!url} />
    );

    return (
      <div className={`relative w-full h-full ${filter.isGrid ? `grid ${grid === 3 ? 'grid-cols-1 grid-rows-3' : 'grid-cols-2'}` : ''}`}>
        {[...Array(grid)].map((_, i) => (
          <div key={i} className="relative overflow-hidden border-[0.5px] border-white/5"><VideoTag isMain={i === 0} /></div>
        ))}
        {filter.vfxType === 'lightning' && (
          <div className="absolute inset-0 pointer-events-none z-10 bg-blue-500/10 animate-pulse overflow-hidden">
            <div className="absolute top-0 left-1/4 w-1 h-full bg-white/40 blur-2xl animate-bounce" />
            <div className="absolute top-0 right-1/4 w-1 h-full bg-white/40 blur-2xl animate-bounce delay-75" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      
      {/* Header */}
      <div className="p-4 flex justify-between items-center z-[1001]">
        <h1 className="text-2xl font-black italic text-blue-500 tracking-tighter">CHITI STUDIO</h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-3 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950">
          <ShieldCheck size={40} className="text-blue-500 mb-6" />
          <h2 className="text-2xl font-black mb-6">PLEASE LOGIN</h2>
          <a href="/login" className="px-12 py-4 bg-blue-600 rounded-full font-black">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* Menu */
        <div className="flex-1 flex flex-col items-center justify-center gap-12">
          <button onClick={() => setIsCameraMode(true)} className="w-60 h-60 bg-blue-600 rounded-[60px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={70} className="text-white mb-2" />
            <span className="text-lg font-black tracking-widest">RECORD</span>
          </button>
          <label className="w-72 p-6 bg-zinc-900 rounded-[30px] flex items-center justify-center gap-4 border border-white/5 cursor-pointer active:scale-95">
            <Upload className="text-blue-500"/>
            <div className="flex flex-col text-left">
              <span className="font-black uppercase text-xs">Gallery</span>
              <span className="text-[10px] text-gray-500">Video max 30s</span>
            </div>
            <input type="file" hidden accept="video/*" onChange={handleGalleryVideo} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* Camera UI */
        <div className="relative flex-1 bg-black">
          {renderDisplay()}
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/50 backdrop-blur-xl rounded-2xl"><RefreshCw size={24}/></button>
            <button onClick={() => setShowFilters(true)} className="p-4 bg-black/50 backdrop-blur-xl rounded-2xl text-blue-400"><Sparkles size={24}/></button>
            <button onClick={() => setShowMusic(true)} className="p-4 bg-black/50 backdrop-blur-xl rounded-2xl text-pink-500"><Music size={24}/></button>
          </div>
          <div className="absolute bottom-12 inset-x-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/50 backdrop-blur-2xl p-1 rounded-full border border-white/10">
                {[15, 30].map(sec => (
                  <button key={sec} onClick={() => {setRecordLimit(sec); setTimeLeft(sec);}} className={`px-8 py-2 rounded-full text-[10px] font-black ${recordLimit === sec ? 'bg-white text-black' : 'text-gray-400'}`}>{sec}S</button>
                ))}
              </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500' : 'border-white'}`}>
              <div className={`${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-14 h-14 bg-white rounded-full'}`} />
            </button>
            {isRecording && <div className="font-black text-red-500 text-xs bg-black/50 px-4 py-1 rounded-full">{timeLeft}s LEFT</div>}
          </div>
        </div>
      ) : (
        /* Preview & Progress */
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1300]">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              {renderDisplay(previewUrl)}
              <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[1310]">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-4 bg-black/50 rounded-full"><ArrowLeft/></button>
                <div className="flex gap-4">
                  <button onClick={() => setShowFilters(true)} className="p-4 bg-black/50 rounded-full text-blue-400"><Sparkles/></button>
                  <button onClick={() => setIsFinalStep(true)} className="px-10 py-4 bg-blue-600 rounded-full font-black text-sm tracking-widest shadow-lg">NEXT</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-8 flex flex-col">
              <div className="flex items-center gap-4 mb-10">
                <button onClick={() => setIsFinalStep(false)} className="p-3 bg-white/5 rounded-full"><ArrowLeft/></button>
                <h2 className="text-xl font-black">FINALIZE POST</h2>
              </div>
              <div className="flex gap-6 mb-12">
                <div className="w-32 h-48 bg-zinc-900 rounded-3xl overflow-hidden border border-white/10">
                   {renderDisplay(previewUrl)}
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-black text-blue-500 uppercase">Caption / Title</span>
                  <textarea placeholder="Write something catchy..." className="w-full h-32 bg-transparent border-b border-white/10 py-3 outline-none font-bold text-lg resize-none" value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </div>
              
              {/* 📊 Progress Bar UI */}
              {isUploading && (
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span>Uploading to Cloud</span>
                    <span className="text-blue-500">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-blue-600 transition-all duration-300 shadow-[0_0_10px_#2563eb]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <button onClick={handlePublish} disabled={isUploading} className="mt-auto w-full bg-blue-600 py-5 rounded-[30px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                {isUploading ? <Loader2 className="animate-spin" /> : <Send />}
                {isUploading ? `POSTING...` : 'POST NOW'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🎨 Filters Drawer */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950/98 backdrop-blur-3xl z-[1500] p-6 pb-12 rounded-t-[40px] border-t border-white/10 animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-lg uppercase tracking-tighter">Effects Store</h3>
            <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X/></button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-2">
                <div className={`w-20 h-28 rounded-2xl overflow-hidden border-2 transition-all ${selectedFilter === key ? 'border-blue-500 scale-105 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'border-transparent opacity-40'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[8px] font-bold uppercase text-zinc-500">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🔍 Music Browser */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1600] p-6 pt-20 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black italic">SOUNDS</h2>
            <button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full"><X/></button>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
            <input type="text" placeholder="Search Chiti Sounds..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="space-y-3">
            {filteredMusic.map(music => (
              <div key={music.id} className={`p-4 rounded-[25px] flex items-center justify-between border ${selectedMusic?.id === music.id ? 'bg-blue-600/10 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-4 flex-1" onClick={() => {
                    if(playingMusicId === music.id) { audioRef.current?.pause(); setPlayingMusicId(null); } 
                    else { audioRef.current!.src = music.audio_url; audioRef.current?.play(); setPlayingMusicId(music.id); }
                }}>
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    {playingMusicId === music.id ? <Pause size={20} fill="white"/> : <Play size={20} fill="white" className="ml-0.5"/>}
                  </div>
                  <p className="font-bold text-sm truncate w-40">{music.title}</p>
                </div>
                <button onClick={() => {setSelectedMusic(music); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className="p-4 bg-white/5 rounded-xl"><Check/></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
