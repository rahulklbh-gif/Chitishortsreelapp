"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, ShieldCheck,
  Volume2, Search, Settings, Clock, Info
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * 🛠️ EXTERNAL CONFIGURATION (To prevent memory leaks)
 */
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
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

/**
 * 🎨 FULL 20+ FILTERS DATA
 */
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.5px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
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
  ocean: { name: "Oceanic", style: "hue-rotate(180deg) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, cols: 2, rows: 2, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, cols: 2, rows: 3, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, cols: 1, rows: 3, thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  storm: { name: "Lightning", style: "contrast(1.3) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- STATES --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);

  // -- REFS --
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // 1. Fetch Music
  useEffect(() => {
    const fetchMusic = async () => {
      const { data } = await supabase.from('music_library').select('*');
      if (data) setMusicList(data);
    };
    fetchMusic();
  }, []);

  // 2. Camera Management
  const startCamera = useCallback(async () => {
    try {
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
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast.error("Camera access denied.");
      setIsCameraMode(false);
    }
  }, [facingMode]);

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isCameraMode, startCamera]);

  // 3. Recording Logic
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { 
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 2500000 
    });

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `chiti_${Date.now()}.webm`, { type: 'video/webm' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
      setIsCameraMode(false);
      setIsRecording(false);
    };

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordLimit);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
            stopRecording();
            return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  // 4. Music Logic (Fix for Lag)
  const toggleMusic = (music: any) => {
    if (!audioRef.current) return;
    if (playingMusicId === music.id) {
      audioRef.current.pause();
      setPlayingMusicId(null);
    } else {
      audioRef.current.src = music.audio_url;
      audioRef.current.load(); // Pre-load to avoid lag
      audioRef.current.play().catch(e => console.error("Play failed", e));
      setPlayingMusicId(music.id);
    }
  };

  // 5. Upload & Publish (Full Logic)
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(15);

    try {
      const fileName = `chiti_vids/${user.id}/${Date.now()}.webm`;
      
      // Binary upload (More stable for mobile)
      const arrayBuffer = await selectedFile.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: body,
        ContentType: 'video/webm',
      }));

      setUploadProgress(70);

      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: `${R2_CONFIG.publicDomain}/${fileName}`,
        caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        filter_name: selectedFilter,
        music_id: selectedMusic?.id || null
      }]);

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success("Video Published Successfully!");
      setTimeout(() => window.location.href = '/', 1000);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || 'Upload failed'}`);
      setIsUploading(false);
    }
  };

  // UI Render Helper
  const renderStudio = (url?: string) => {
    const f = FILTERS_DATA[selectedFilter];
    const grids = f.isGrid ? f.gridCount : 1;
    const isFront = facingMode === 'user' && !url;

    return (
      <div className={f.isGrid ? `grid w-full h-full grid-cols-${f.cols} grid-rows-${f.rows}` : 'w-full h-full'}>
        {[...Array(grids)].map((_, i) => (
          <video 
            key={i}
            ref={i === 0 ? videoRef : null}
            src={url}
            className={`w-full h-full object-cover ${isFront ? 'scale-x-[-1]' : ''}`}
            style={{ filter: f.style }}
            autoPlay playsInline muted={i !== 0 || !url} loop
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-black italic text-blue-600 flex items-center gap-1">CHITI <Zap size={18} fill="currentColor"/></h1>
        {(isCameraMode || previewUrl) && (
            <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 gap-4">
          <ShieldCheck size={60} className="text-blue-500"/>
          <p className="font-bold text-center">Please login to create videos</p>
          <a href="/login" className="bg-blue-600 px-10 py-3 rounded-full font-black uppercase italic">Login</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-14">
          <button onClick={() => setIsCameraMode(true)} className="w-48 h-48 bg-blue-600 rounded-[60px] flex items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={60}/>
          </button>
          <label className="flex items-center gap-3 bg-zinc-900 px-10 py-5 rounded-full border border-white/10 cursor-pointer active:bg-zinc-800">
            <Upload size={22} className="text-blue-500"/>
            <span className="text-xs font-black uppercase italic">Pick from Gallery</span>
            <input type="file" hidden accept="video/*" onChange={e => {
                const f = e.target.files?.[0];
                if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }
            }}/>
          </label>
        </div>
      ) : (
        <div className="flex-1 relative bg-black">
          {!isFinalStep ? (
            <>
              {renderStudio(previewUrl)}
              
              {/* Sidebar Controls */}
              <div className="absolute right-4 top-24 flex flex-col gap-6 z-[1010]">
                <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl"><RefreshCw/></button>
                <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl text-blue-400"><Sparkles/></button>
                <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl text-pink-500"><Music/></button>
              </div>

              {/* Bottom Capture Area */}
              <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6 z-[1010]">
                {isCameraMode ? (
                  <>
                    <div className="flex bg-black/50 p-1 rounded-full border border-white/10">
                        {[15, 30].map(s => (
                            <button key={s} onClick={() => setRecordLimit(s)} className={`px-8 py-2 rounded-full text-[10px] font-black ${recordLimit === s ? 'bg-white text-black' : 'text-zinc-500'}`}>{s}S</button>
                        ))}
                    </div>
                    <button 
                        onClick={isRecording ? stopRecording : startRecording} 
                        className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-600' : 'border-white'}`}
                    >
                        <div className={isRecording ? 'w-8 h-8 bg-red-600 rounded-sm' : 'w-14 h-14 bg-white rounded-full'} />
                    </button>
                    {isRecording && <span className="text-red-500 font-black animate-pulse">{timeLeft}S</span>}
                  </>
                ) : (
                  <button onClick={() => setIsFinalStep(true)} className="bg-blue-600 px-16 py-4 rounded-full font-black uppercase italic tracking-widest shadow-xl">Next</button>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 h-full bg-black flex flex-col animate-in fade-in slide-in-from-bottom-4">
              <div className="flex gap-4 mb-10 pt-4">
                <div className="w-24 h-40 bg-zinc-900 rounded-2xl overflow-hidden border border-white/10">{renderStudio(previewUrl)}</div>
                <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)} 
                  placeholder="Describe your video..." 
                  className="flex-1 bg-transparent p-2 outline-none font-bold italic border-b border-white/10" 
                />
              </div>

              {isUploading && (
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-blue-500 uppercase italic">
                    <span>Publishing Video</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${uploadProgress}%`}}/>
                  </div>
                </div>
              )}

              <button 
                onClick={handlePublish} 
                disabled={isUploading} 
                className="mt-auto bg-blue-600 py-6 rounded-[30px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : <Send />} 
                PUBLISH NOW
              </button>
            </div>
          )}
        </div>
      )}

      {/* FILTER DRAWER */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 rounded-t-[50px] z-[1500] border-t border-white/5 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Select Effect</span>
            <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={18}/></button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-3">
                <div 
                    className={`w-16 h-20 rounded-2xl border-2 transition-all ${selectedFilter === key ? 'border-blue-500 scale-110' : 'border-transparent opacity-40'}`}
                    style={{ background: '#111' }}
                >
                    <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover rounded-xl" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[8px] font-black uppercase text-zinc-500">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MUSIC DRAWER */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1600] flex flex-col p-6 pt-16">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black italic text-blue-600 uppercase">Music Library</h2>
            <button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full"><X/></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
            {musicList.map(m => (
              <div key={m.id} className={`p-5 rounded-[30px] flex items-center justify-between border ${selectedMusic?.id === m.id ? 'bg-blue-600/10 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => toggleMusic(m)}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${playingMusicId === m.id ? 'bg-blue-600' : 'bg-white/5'}`}>
                    {playingMusicId === m.id ? <Pause size={20}/> : <Play size={20}/>}
                  </div>
                  <span className="font-black text-sm uppercase truncate max-w-[150px]">{m.title}</span>
                </div>
                <button onClick={() => { setSelectedMusic(m); setShowMusic(false); }} className="p-4 bg-blue-600 rounded-2xl active:scale-90"><Check/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <audio ref={audioRef} hidden />
    </div>
  );
} 
