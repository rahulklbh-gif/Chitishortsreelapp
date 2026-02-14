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
 * 🛠️ CLOUDFLARE R2 CONFIG
 */
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

/**
 * 🎨 20 FULL FILTERS (Fast & Working)
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

  // Music Load
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

  // Camera Fix: Ensuring stream stays active
  const startCamera = async () => {
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
    } catch (err) {
      toast.error("Camera access denied.");
    }
  };

  useEffect(() => { if (isCameraMode) startCamera(); }, [isCameraMode, facingMode]);

  // Recording Fix: Separate Audio handling to prevent Black Screen
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    // Music control - plays without hijacking the video stream
    if (selectedMusic && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setSelectedFile(new File([blob], "vid.webm", { type: 'video/webm' }));
      const v = document.createElement('video');
      v.src = url;
      v.onloadedmetadata = () => setVideoDuration(Math.round(v.duration));
      setIsCameraMode(false);
      setIsRecording(false);
      audioRef.current?.pause();
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

  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(10);
    try {
      const fileName = `chiti_vids/${user.id}/${Date.now()}.webm`;
      const client = new S3Client({
        region: "auto",
        endpoint: R2_CONFIG.endpoint,
        credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
        forcePathStyle: true,
      });
      await client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(await selectedFile.arrayBuffer()),
        ContentType: 'video/webm',
      }));
      setUploadProgress(90);
      const url = `${R2_CONFIG.publicDomain}/${fileName}`;
      await supabase.from('posts').insert([{ video_url: url, caption, user_id: user.id, user_name: user.user_metadata?.full_name || 'Creator' }]);
      toast.success("Posted!");
      window.location.href = '/';
    } catch (e) { setIsUploading(false); }
  };

  const renderStudioDisplay = (url?: string) => {
    const f = FILTERS_DATA[selectedFilter];
    const grids = f.isGrid ? f.gridCount : 1;
    return (
      <div className={`w-full h-full relative overflow-hidden ${f.isGrid ? `grid ${grids === 3 ? 'grid-cols-1 grid-rows-3' : 'grid-cols-2'}` : ''}`}>
        {[...Array(grids)].map((_, i) => (
          <video key={i} ref={i === 0 ? videoPreviewRef : null} src={url} className="w-full h-full object-cover" style={{ filter: f.style }} autoPlay muted={!url} playsInline loop />
        ))}
        {f.vfxType === 'lightning' && <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      {/* 🔝 Top Bar */}
      <div className="p-4 flex justify-between items-center z-[50] bg-gradient-to-b from-black to-transparent">
        <h1 className="text-xl font-black italic text-blue-500 flex items-center gap-1">CHITI <Zap size={18} fill="currentColor"/></h1>
        {(isCameraMode || previewUrl) && <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>}
      </div>

      {!isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-10">
          <button onClick={() => setIsCameraMode(true)} className="w-48 h-48 bg-blue-600 rounded-[50px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={60} />
            <span className="font-bold text-xs mt-2 uppercase">Shoot</span>
          </button>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1">
          {renderStudioDisplay()}
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[60]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 rounded-2xl"><RefreshCw/></button>
            <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 rounded-2xl text-blue-400"><Sparkles/></button>
            <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 rounded-2xl text-pink-500"><Music/></button>
          </div>
          <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6 z-[60]">
            {!isRecording && (
              <div className="flex bg-black/40 p-1 rounded-full border border-white/10">
                {[15, 30].map(s => <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-8 py-2 rounded-full text-[10px] font-bold ${recordLimit === s ? 'bg-white text-black' : ''}`}>{s}S</button>)}
              </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500' : 'border-white'}`}>
              <div className={isRecording ? 'w-8 h-8 bg-red-500 rounded-lg animate-pulse' : 'w-14 h-14 bg-white rounded-full'} />
            </button>
            {isRecording && <div className="text-red-500 font-black text-xs bg-black/60 px-4 py-1 rounded-full">{timeLeft}S RECORDING</div>}
          </div>
        </div>
      ) : (
        /* Preview UI with Duration */
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            {renderStudioDisplay(previewUrl)}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded-full text-[10px] font-bold border border-white/10">
               {videoDuration}s Video
            </div>
            <div className="absolute top-4 left-4">
               <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-3 bg-black/40 rounded-full"><ArrowLeft/></button>
            </div>
            <button onClick={() => setIsFinalStep(true)} className="absolute bottom-10 right-10 px-10 py-4 bg-blue-600 rounded-full font-black shadow-2xl">NEXT</button>
            {selectedMusic && <button onClick={() => {audioRef.current?.play()}} className="absolute bottom-10 left-10 p-4 bg-pink-600 rounded-full animate-bounce"><Music size={20}/></button>}
          </div>
        </div>
      )}

      {/* 🎨 Filters: Mobile Optimized */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-6 rounded-t-[40px] z-[100] animate-in slide-in-from-bottom">
          <div className="flex justify-between mb-4"><h3 className="font-black text-sm">FILTERS</h3><button onClick={() => setShowFilters(false)}><X/></button></div>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {Object.keys(FILTERS_DATA).map(k => (
              <button key={k} onClick={() => setSelectedFilter(k)} className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className={`w-16 h-20 rounded-2xl overflow-hidden border-2 ${selectedFilter === k ? 'border-blue-500' : 'border-transparent opacity-50'}`}>
                  <img src={FILTERS_DATA[k].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[k].style }} />
                </div>
                <span className="text-[8px] font-bold">{FILTERS_DATA[k].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🎵 Music: Screen Screenshot Fix (Centered & Fixed Width) */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[200] p-6 pt-20 flex flex-col items-center overflow-y-auto">
          <div className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black italic">SOUNDS</h2>
              <button onClick={() => setShowMusic(false)} className="p-2 bg-white/5 rounded-full"><X/></button>
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
              <input type="text" placeholder="Search..." className="w-full bg-zinc-900 rounded-2xl py-4 pl-12 pr-4 outline-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="space-y-3 pb-20">
              {filteredMusic.map(m => (
                <div key={m.id} className={`p-4 rounded-3xl flex items-center justify-between ${selectedMusic?.id === m.id ? 'bg-blue-600/20 border border-blue-500' : 'bg-zinc-900'}`}>
                   <div className="flex items-center gap-4 flex-1" onClick={() => {
                     if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                     else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                   }}>
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                        {playingMusicId === m.id ? <Pause size={20}/> : <Play size={20}/>}
                      </div>
                      <div className="max-w-[150px]"><p className="font-bold text-sm truncate uppercase italic tracking-tighter">{m.title}</p></div>
                   </div>
                   <button onClick={() => {setSelectedMusic(m); setShowMusic(false);}} className={`p-3 rounded-xl ${selectedMusic?.id === m.id ? 'bg-blue-600' : 'bg-white/5'}`}><Check size={20}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 📤 Final Step: Upload Progress UI */}
      {isFinalStep && (
        <div className="fixed inset-0 bg-black z-[300] p-8 flex flex-col animate-in slide-in-from-right">
          <button onClick={() => setIsFinalStep(false)} className="self-start p-2 bg-white/10 rounded-full mb-10"><ArrowLeft/></button>
          <div className="flex gap-4 mb-10">
            <div className="w-24 h-36 bg-zinc-900 rounded-2xl overflow-hidden border border-white/10">
               <video src={previewUrl} className="w-full h-full object-cover" muted />
            </div>
            <textarea placeholder="Write a caption..." className="flex-1 bg-transparent border-b border-white/10 py-2 outline-none font-bold resize-none" value={caption} onChange={e => setCaption(e.target.value)} />
          </div>
          {isUploading && (
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-[10px] font-bold text-blue-500 italic"><span>SENDING TO CHITI CLOUDS</span><span>{uploadProgress}%</span></div>
              <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
            </div>
          )}
          <button onClick={handlePublish} disabled={isUploading} className="mt-auto w-full bg-blue-600 py-5 rounded-[30px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg">
            {isUploading ? <Loader2 className="animate-spin" /> : <Send />} {isUploading ? 'UPLOADING...' : 'POST NOW'}
          </button>
        </div>
      )}

      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
}
