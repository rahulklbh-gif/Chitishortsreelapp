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
 * 🎨 FILTERS DATA (Exported for Feed Page use)
 */
export const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.5px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  storm: { name: "Lightning", style: "contrast(1.3) brightness(1.1)", isVFX: true, vfxType: 'lightning', thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  pulse: { name: "Flash Beat", style: "", isVFX: true, vfxType: 'pulse', thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, cols: 2, rows: 2, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, cols: 2, rows: 3, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, cols: 1, rows: 3, thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
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
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('none');

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Music Loader (Keep Original)
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

  // 2. Camera Start (Keep Original)
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
          videoPreviewRef.current?.play().catch(e => console.error(e));
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

  // 3. Recording Process (Keep Original)
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], `chiti_vid.webm`, { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordLimit);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { mediaRecorderRef.current?.stop(); clearInterval(timerRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  };

  /**
   * 🚀 4. PUBLISH FUNCTION (FIXED FOR FAST UPLOAD & NO HANG)
   * Isme hum Canvas recording bypass karke metadata use kar rahe hain.
   */
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    
    setIsUploading(true);
    setUploadProgress(10); // Start progress

    try {
      const fileName = `chiti_vids/${user.id}/${Date.now()}.webm`;
      const client = new S3Client({
        region: "auto",
        endpoint: R2_CONFIG.endpoint, 
        credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
        forcePathStyle: true, 
      });

      // Direct Upload Original File (Ye fast hoga aur hang nahi karega)
      await client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: selectedFile,
        ContentType: selectedFile.type,
      }));

      setUploadProgress(70);

      const videoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      
      // Database mein 'filter_name' save kar rahe hain
      await supabase.from('posts').insert([{ 
        video_url: videoUrl, 
        caption, 
        user_id: user.id, 
        user_name: user.user_metadata?.full_name || 'Creator',
        filter_name: selectedFilter // <--- Ye aapki feed ko batayega kya dikhana hai
      }]);

      setUploadProgress(100);
      toast.success('Fast Posted!');
      setTimeout(() => window.location.href = '/', 1000);
    } catch (err) { 
      setIsUploading(false);
      toast.error("Upload failed.");
      console.error(err);
    }
  };

  /**
   * 📺 STUDIO RENDERER (Keep Original Layout)
   */
  const renderStudioDisplay = (url?: string) => {
    const filter = FILTERS_DATA[selectedFilter];
    const gridCount = filter.isGrid ? filter.gridCount : 1;
    const shouldMirror = facingMode === 'user' && !url;

    let gridClass = "w-full h-full";
    if (filter.isGrid) {
      if (gridCount === 4) gridClass = "w-full h-full grid grid-cols-2 grid-rows-2";
      if (gridCount === 6) gridClass = "w-full h-full grid grid-cols-2 grid-rows-3";
      if (gridCount === 3) gridClass = "w-full h-full grid grid-cols-1 grid-rows-3";
    }

    return (
      <div className={gridClass}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full overflow-hidden border-[0.5px] border-black/10">
            <video 
              ref={i === 0 ? videoPreviewRef : null}
              src={url}
              className={`w-full h-full object-cover ${shouldMirror ? 'scale-x-[-1]' : ''}`}
              style={{ filter: filter.style }}
              autoPlay 
              playsInline 
              muted={i !== 0 || !url} 
              loop
              crossOrigin="anonymous"
            />
          </div>
        ))}
        {filter.vfxType === 'lightning' && <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none z-10" />}
      </div>
    );
  };

  // --- UI RENDER (Original Version) ---
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-black italic text-blue-600 flex items-center gap-1 tracking-tighter">CHITI <Zap size={18} fill="currentColor"/></h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10"><ShieldCheck size={50} className="text-blue-500 mb-4"/><a href="/login" className="px-10 py-4 bg-blue-600 rounded-full font-black text-xs uppercase">Sign In</a></div>
      ) : !isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-16">
          <button onClick={() => setIsCameraMode(true)} className="w-52 h-52 bg-blue-600 rounded-[70px] flex flex-col items-center justify-center shadow-2xl active:scale-90 transition-all">
            <Camera size={70} />
            <span className="text-[10px] font-black uppercase mt-2 italic">Start Shoot</span>
          </button>
          <label className="flex items-center gap-4 px-10 py-5 bg-zinc-900 rounded-full border border-white/5 cursor-pointer">
            <Upload size={24} className="text-blue-500" />
            <span className="text-xs font-black uppercase italic">Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
               const file = e.target.files?.[0];
               if(file) {
                 setSelectedFile(file);
                 setPreviewUrl(URL.createObjectURL(file));
                 const v = document.createElement('video');
                 v.src = URL.createObjectURL(file);
                 v.onloadedmetadata = () => setVideoDuration(Math.round(v.duration));
               }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1 bg-black overflow-hidden">
          {renderStudioDisplay()}
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-xl rounded-2xl"><RefreshCw size={22}/></button>
            <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 backdrop-blur-xl rounded-2xl text-blue-400"><Sparkles size={22}/></button>
            <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 backdrop-blur-xl rounded-2xl text-pink-500"><Music size={22}/></button>
          </div>
          <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/50 p-1 rounded-full border border-white/10">
                {[15, 30].map(sec => (
                  <button key={sec} onClick={() => {setRecordLimit(sec); setTimeLeft(sec);}} className={`px-10 py-2.5 rounded-full text-[10px] font-black ${recordLimit === sec ? 'bg-white text-black' : 'text-gray-400'}`}>{sec}S</button>
                ))}
              </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-600' : 'border-white'}`}>
              <div className={`${isRecording ? 'w-8 h-8 bg-red-600 rounded-lg' : 'w-14 h-14 bg-white rounded-full'}`} />
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1300]">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {renderStudioDisplay(previewUrl)}
              <div className="absolute bottom-10 inset-x-0 px-8 flex justify-between items-center z-[1320]">
                <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 backdrop-blur-xl rounded-full text-blue-400"><Sparkles size={24}/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-12 py-4 bg-blue-600 rounded-full font-black text-xs">NEXT</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col bg-black">
               <div className="flex items-center gap-4 mb-10 pt-4">
                <button onClick={() => setIsFinalStep(false)} className="p-3 bg-white/5 rounded-full"><ArrowLeft size={24}/></button>
                <h2 className="text-xl font-black italic uppercase">Ready to Post</h2>
              </div>
              <div className="flex gap-6 mb-12">
                <div className="w-32 h-48 bg-zinc-900 rounded-[30px] overflow-hidden relative">
                   {renderStudioDisplay(previewUrl)}
                </div>
                <div className="flex-1 pt-2">
                  <textarea placeholder="Describe your video..." className="w-full h-32 bg-transparent border-b border-white/10 py-4 outline-none font-bold text-sm resize-none" value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </div>
              {isUploading && (
                <div className="mb-10 space-y-2">
                   <div className="flex justify-between items-end text-[9px] font-black text-blue-500 uppercase italic"><span>Uploading Fast...</span><span>{uploadProgress}%</span></div>
                   <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              )}
              <button onClick={handlePublish} disabled={isUploading} className="mt-auto w-full bg-blue-600 py-6 rounded-[30px] font-black text-lg flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all disabled:opacity-50">
                {isUploading ? <Loader2 className="animate-spin" size={28}/> : <Send size={28}/>}
                <span className="uppercase tracking-tighter">{isUploading ? 'Posting...' : 'Publish'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* FILTERS DRAWER (Keep Original) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 rounded-t-[50px] z-[1500] border-t border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-xs uppercase italic text-zinc-500">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={18}/></button>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-3">
                <div className={`w-16 h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${selectedFilter === key ? 'border-blue-500 scale-105 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[8px] font-black uppercase text-zinc-600">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MUSIC DRAWER (Keep Original) */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1600] flex flex-col">
           <div className="w-full max-w-md mx-auto h-full flex flex-col p-6 pt-16">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black italic tracking-tighter text-blue-600 uppercase">Sounds</h2>
                <button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pb-20 no-scrollbar">
                {filteredMusic.map(music => (
                  <div key={music.id} className={`p-5 rounded-[35px] flex items-center justify-between border ${selectedMusic?.id === music.id ? 'bg-blue-600/10 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                    <div className="flex items-center gap-5 flex-1" onClick={() => {
                        if(playingMusicId === music.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = music.audio_url; audioRef.current?.play(); setPlayingMusicId(music.id); }
                    }}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${playingMusicId === music.id ? 'bg-blue-600' : 'bg-white/5'}`}><Play size={20}/></div>
                      <p className="font-black text-sm uppercase">{music.title}</p>
                    </div>
                    <button onClick={() => {setSelectedMusic(music); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className={`p-4 rounded-2xl ${selectedMusic?.id === music.id ? 'bg-blue-600' : 'bg-white/5'}`}><Check size={20}/></button>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
