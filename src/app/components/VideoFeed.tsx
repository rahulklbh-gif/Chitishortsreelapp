"use client";

import { 
  Upload, X, Camera, RefreshCw, Music, Check, Play, Pause, Zap, 
  Send, Loader2, Sparkles, ShieldCheck, ArrowLeft, Volume2
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * 🛠️ CONFIGURATION - Stable Instance
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
 * 🎨 20+ FILTERS MASTER DATA (CSS Only - No Lag)
 */
export const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal", style: "brightness(1.4) contrast(1.1) saturate(1.2)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel", style: "brightness(1.6) saturate(1.1) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "sepia(0.2) brightness(1.3)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.1) blur(0.4px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  cine: { name: "CineMax", style: "contrast(1.5) saturate(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Or", style: "hue-rotate(-10deg) saturate(1.7)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Retro", style: "sepia(0.7) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.5)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  warm: { name: "Warm", style: "sepia(0.3) saturate(1.5)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  gold: { name: "Royal Gold", style: "sepia(0.5) saturate(2) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  cyber: { name: "Cyberpunk", style: "hue-rotate(280deg) saturate(2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  dream: { name: "Dreamy", style: "blur(1.2px) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  vivid: { name: "Vivid", style: "saturate(2.5)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  ocean: { name: "Oceanic", style: "hue-rotate(180deg) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  mono: { name: "Classic", style: "grayscale(1) brightness(1.2)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  quad: { name: "4-Grid", style: "", isGrid: true, cols: 2, rows: 2, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  triple: { name: "3-Col", style: "", isGrid: true, cols: 1, rows: 3, thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  storm: { name: "Stormy", style: "contrast(1.4) brightness(1.2)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" }
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
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: 1280, height: 720 },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { toast.error("Camera access denied"); setIsCameraMode(false); }
  }, [facingMode]);

  useEffect(() => { if (isCameraMode) startCamera(); }, [isCameraMode, startCamera]);

  // 3. Recording
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setSelectedFile(new File([blob], "vid.webm"));
      setPreviewUrl(URL.createObjectURL(blob));
      setIsCameraMode(false);
      setIsRecording(false);
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordLimit);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => { if (p <= 1) { stopRecording(); return 0; } return p - 1; });
    }, 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current) recorderRef.current.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  // 4. Music Logic (Anti-Lag)
  const toggleMusic = (music: any) => {
    if (!audioRef.current) return;
    if (playingMusicId === music.id) {
      audioRef.current.pause();
      setPlayingMusicId(null);
    } else {
      audioRef.current.src = music.audio_url;
      audioRef.current.load();
      audioRef.current.play();
      setPlayingMusicId(music.id);
    }
  };

  /**
   * 🚀 FULL PUBLISH FUNCTION (Fixed Schema Cache Error)
   */
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const fileName = `chiti_vids/${user.id}/${Date.now()}.webm`;
      const arrayBuffer = await selectedFile.arrayBuffer();
      
      // R2 Upload
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName, Key: fileName, Body: new Uint8Array(arrayBuffer), ContentType: 'video/webm'
      }));

      setUploadProgress(70);

      // Supabase Entry - filter_name aur music_id ke saath
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: `${R2_CONFIG.publicDomain}/${fileName}`,
        caption: caption || "",
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'CHITI User',
        filter_name: selectedFilter,
        music_id: selectedMusic?.id || null
      }]);

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success("Published!");
      setTimeout(() => window.location.href = '/', 1000);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      setIsUploading(false);
    }
  };

  // UI Render for Filter Preview
  const renderPreview = (url?: string) => {
    const f = FILTERS_DATA[selectedFilter];
    const grids = f.isGrid ? (f.cols * f.rows) : 1;
    return (
      <div className={f.isGrid ? `grid h-full w-full grid-cols-${f.cols} grid-rows-${f.rows}` : 'h-full w-full'}>
        {[...Array(grids)].map((_, i) => (
          <video 
            key={i} ref={i === 0 ? videoRef : null} src={url}
            autoPlay playsInline muted={i !== 0 || !url} loop
            className="w-full h-full object-cover"
            style={{ filter: f.style, transform: facingMode === 'user' && !url ? 'scaleX(-1)' : '' }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center z-50">
        <h1 className="text-xl font-black italic text-blue-600">CHITI <Zap size={18} className="inline" fill="currentColor"/></h1>
        {(isCameraMode || previewUrl) && <button onClick={() => window.location.reload()}><X/></button>}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 gap-4 text-center">
          <ShieldCheck size={60} className="text-blue-500"/>
          <p className="font-bold">Login required to post videos</p>
          <a href="/login" className="bg-blue-600 px-10 py-3 rounded-full font-black italic">LOGIN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-14">
          <button onClick={() => setIsCameraMode(true)} className="w-48 h-48 bg-blue-600 rounded-[60px] flex items-center justify-center shadow-2xl active:scale-95 transition-all"><Camera size={60}/></button>
          <label className="flex items-center gap-3 bg-zinc-900 px-10 py-5 rounded-full border border-white/10 cursor-pointer">
            <Upload size={22} className="text-blue-500"/>
            <span className="text-xs font-black uppercase italic">Pick Gallery</span>
            <input type="file" hidden accept="video/*" onChange={e => {
                const f = e.target.files?.[0];
                if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }
            }}/>
          </label>
        </div>
      ) : (
        <div className="flex-1 relative">
          {!isFinalStep ? (
            <>
              {renderPreview(previewUrl)}
              <div className="absolute right-4 top-20 flex flex-col gap-6">
                <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 rounded-2xl backdrop-blur-md"><RefreshCw/></button>
                <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 rounded-2xl backdrop-blur-md text-blue-400"><Sparkles/></button>
                <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 rounded-2xl backdrop-blur-md text-pink-500"><Music/></button>
              </div>
              <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6">
                {isCameraMode ? (
                  <>
                    <div className="flex bg-black/50 p-1 rounded-full border border-white/10">
                        {[15, 30].map(s => <button key={s} onClick={() => setRecordLimit(s)} className={`px-8 py-2 rounded-full text-[10px] font-black ${recordLimit === s ? 'bg-white text-black' : 'text-zinc-500'}`}>{s}S</button>)}
                    </div>
                    <button onClick={isRecording ? stopRecording : startRecording} className={`w-20 h-20 rounded-full border-4 ${isRecording ? 'border-red-600' : 'border-white'} flex items-center justify-center`}>
                      <div className={isRecording ? 'w-8 h-8 bg-red-600 rounded-sm' : 'w-14 h-14 bg-white rounded-full'} />
                    </button>
                    {isRecording && <span className="text-red-500 font-black animate-pulse">{timeLeft}S</span>}
                  </>
                ) : (
                  <button onClick={() => setIsFinalStep(true)} className="bg-blue-600 px-16 py-4 rounded-full font-black uppercase italic tracking-widest">Next Step</button>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 h-full bg-black flex flex-col">
              <div className="flex gap-4 mb-10 pt-4">
                <div className="w-24 h-40 bg-zinc-900 rounded-2xl overflow-hidden border border-white/10">{renderPreview(previewUrl)}</div>
                <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write something cool..." className="flex-1 bg-transparent p-2 outline-none font-bold italic border-b border-white/10 resize-none" />
              </div>

              {isUploading && (
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-blue-500 uppercase"><span>Publishing...</span><span>{uploadProgress}%</span></div>
                  <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${uploadProgress}%`}}/></div>
                </div>
              )}

              <button onClick={handlePublish} disabled={isUploading} className="mt-auto bg-blue-600 py-6 rounded-[30px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50">
                {isUploading ? <Loader2 className="animate-spin" /> : <Send />} PUBLISH NOW
              </button>
            </div>
          )}
        </div>
      )}

      {/* FILTER DRAWER */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 rounded-t-[40px] z-[1000] border-t border-white/5 shadow-2xl">
          <div className="flex justify-between items-center mb-6"><span className="text-[10px] font-black text-zinc-500 uppercase">Filters</span><button onClick={() => setShowFilters(false)}><X size={18}/></button></div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => {setSelectedFilter(key); setShowFilters(false);}} className="flex flex-col items-center gap-3">
                <div className={`w-14 h-18 rounded-xl border-2 transition-all ${selectedFilter === key ? 'border-blue-500 scale-110' : 'border-transparent opacity-40'}`} style={{background: '#111'}}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover rounded-lg" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[8px] font-black uppercase text-zinc-600">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MUSIC DRAWER */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1100] p-6 pt-16 flex flex-col">
          <div className="flex justify-between items-center mb-10"><h2 className="text-3xl font-black italic text-blue-600 uppercase">Music</h2><button onClick={() => setShowMusic(false)}><X/></button></div>
          <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
            {musicList.map(m => (
              <div key={m.id} className={`p-5 rounded-[30px] flex items-center justify-between border ${selectedMusic?.id === m.id ? 'bg-blue-600/10 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => toggleMusic(m)}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${playingMusicId === m.id ? 'bg-blue-600' : 'bg-white/5'}`}>{playingMusicId === m.id ? <Pause size={20}/> : <Play size={20}/>}</div>
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
