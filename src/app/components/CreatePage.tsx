"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, ShieldCheck, Search
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p, getVideoFileSizeInfo } from '@/lib/videoCompression'; 

/**
 * 🛠️ STABLE CONFIGURATION
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
  vivid: { name: "Ultra Vivid", style: "saturate(3) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  ocean: { name: "Oceanic", style: "hue-rotate(180deg) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  mono: { name: "Mono", style: "grayscale(1) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, cols: 2, rows: 2, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, cols: 2, rows: 3, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, cols: 1, rows: 3, thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  storm: { name: "Lightning", style: "contrast(1.4) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [compressionStatus, setCompressionStatus] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const fetchMusic = async () => {
      const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
      if (data) setMusicList(data);
    };
    fetchMusic();
  }, []);

  const filteredMusic = musicList.filter(m => 
    m.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: facingMode }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 } 
        },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { toast.error("Camera access denied"); }
  }, [facingMode]);

  useEffect(() => { if (isCameraMode) startCamera(); }, [isCameraMode, startCamera]);

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      if (video.duration > 31) {
        toast.error("Video must be 30 seconds or less!");
        return;
      }
      setSelectedFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    };
    video.src = URL.createObjectURL(f);
  };

  // ✅ FIX: Sync Recording with Music
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    // Play music if selected
    if (selectedMusic && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp8' });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      if (audioRef.current) audioRef.current.pause();
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setSelectedFile(new File([blob], "video.webm", { type: 'video/webm' }));
      setPreviewUrl(URL.createObjectURL(blob));
      setIsCameraMode(false);
      setIsRecording(false);
    };

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordLimit);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { stopRecording(); return 0; }
        return p - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current) recorderRef.current.stop();
    if (audioRef.current) audioRef.current.pause();
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  // ✅ FIX: Slow Music loading fix
  const toggleMusic = (music: any) => {
    if (!audioRef.current) return;
    if (playingMusicId === music.id) {
      audioRef.current.pause();
      setPlayingMusicId(null);
    } else {
      audioRef.current.src = music.audio_url;
      audioRef.current.preload = "auto"; // Preload for faster play
      audioRef.current.play().then(() => setPlayingMusicId(music.id))
      .catch(() => toast.info("Buffering music..."));
    }
  };

  // ✅ FIX: Save music automatically & Feed profile fix
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(5);
    setCompressionStatus("Optimizing for high quality...");

    try {
      const compressedBlob = await compressVideoTo480p(selectedFile, (p) => {
        setUploadProgress(Math.floor(p.progress * 0.4)); 
        setCompressionStatus(p.message);
      });

      const fileName = `chiti_vids/${user.id}/${Date.now()}.mp4`;
      const body = new Uint8Array(await compressedBlob.arrayBuffer());

      setCompressionStatus("Uploading to cloud...");
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: body,
        ContentType: 'video/mp4',
      }));

      const finalVideoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;

      // Insert Post with Profile Image (for feed fix)
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: finalVideoUrl,
        caption: caption || "",
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Creator',
        user_image: user.user_metadata?.avatar_url || null, // FIX: Profile Photo in Feed
        filter_name: selectedFilter,
        music_id: selectedMusic?.id || null
      }]);

      if (dbError) throw dbError;

      // ✅ FIX: Automatically save video as music if no music selected
      if (!selectedMusic) {
         await supabase.from('music_library').insert([{
            title: caption.substring(0, 20) || "Original Audio",
            audio_url: finalVideoUrl, // Video is used as audio
            user_id: user.id
         }]);
      }

      setUploadProgress(100);
      toast.success("Short Published!");
      setTimeout(() => window.location.href = '/', 1000);

    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      setIsUploading(false);
    }
  };

  const renderDisplay = (url?: string) => {
    const f = FILTERS_DATA[selectedFilter];
    const grids = f.isGrid ? f.gridCount : 1;
    return (
      <div className={f.isGrid ? `grid h-full w-full grid-cols-${f.cols} grid-rows-${f.rows}` : 'h-full w-full'}>
        {[...Array(grids)].map((_, i) => (
          <video 
            key={i} ref={i === 0 ? videoRef : null} src={url}
            autoPlay playsInline muted={i !== 0 || !url} loop
            className={`w-full h-full object-cover transition-all`}
            style={{ 
              filter: f.style, 
              transform: facingMode === 'user' && !url ? 'scaleX(-1)' : 'scaleX(1)' 
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden font-sans">
      <div className="p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-black italic text-blue-600">CHITI <Zap size={18} className="inline" fill="currentColor"/></h1>
        {(isCameraMode || previewUrl) && <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 gap-4 text-center">
          <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mb-4"><ShieldCheck size={50} className="text-blue-500"/></div>
          <h2 className="text-2xl font-black">LOGIN REQUIRED</h2>
          <a href="/login" className="bg-blue-600 px-12 py-4 rounded-full font-black mt-4 uppercase">Login Now</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-14">
           <button onClick={() => setIsCameraMode(true)} className="w-44 h-44 bg-blue-600 rounded-[50px] flex items-center justify-center shadow-2xl"><Camera size={60}/></button>
           <label className="flex items-center gap-4 bg-zinc-900 px-12 py-5 rounded-full border border-white/10 cursor-pointer">
            <Upload size={22} className="text-blue-500"/>
            <span className="text-xs font-black uppercase tracking-widest">Select from Gallery</span>
            <input type="file" hidden accept="video/*" onChange={handleGallerySelect}/>
          </label>
        </div>
      ) : (
        <div className="flex-1 relative">
          {!isFinalStep ? (
            <>
              {renderDisplay(previewUrl)}
              <div className="absolute right-4 top-24 flex flex-col gap-5">
                <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 rounded-2xl backdrop-blur-xl"><RefreshCw size={24}/></button>
                <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 rounded-2xl backdrop-blur-xl text-blue-400"><Sparkles size={24}/></button>
                <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 rounded-2xl backdrop-blur-xl text-pink-500"><Music size={24}/></button>
              </div>
              <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6">
                {isCameraMode ? (
                  <>
                    <div className="flex bg-black/60 p-1.5 rounded-full border border-white/10 backdrop-blur-md">
                        {[15, 30].map(s => <button key={s} onClick={() => setRecordLimit(s)} className={`px-8 py-2 rounded-full text-[11px] font-black ${recordLimit === s ? 'bg-white text-black' : 'text-zinc-500'}`}>{s}S</button>)}
                    </div>
                    <button onClick={isRecording ? stopRecording : startRecording} className={`w-24 h-24 rounded-full border-[6px] ${isRecording ? 'border-red-600/30' : 'border-white/20'} flex items-center justify-center`}>
                      <div className={`transition-all ${isRecording ? 'w-10 h-10 bg-red-600 rounded-lg animate-pulse' : 'w-16 h-16 bg-white rounded-full'}`} />
                    </button>
                    {isRecording && <div className="bg-red-600 px-4 py-1 rounded-full text-[10px] font-black animate-pulse">Recording {timeLeft}s</div>}
                  </>
                ) : (
                  <button onClick={() => setIsFinalStep(true)} className="bg-blue-600 px-20 py-5 rounded-full font-black uppercase tracking-[0.2em]">Next Step</button>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 h-full bg-black flex flex-col">
              <div className="flex gap-5 mb-10 pt-4 items-start">
                <div className="w-28 h-44 bg-zinc-900 rounded-3xl overflow-hidden">
                  {renderDisplay(previewUrl)}
                </div>
                <div className="flex-1 pt-2">
                   <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write something catchy..." className="w-full bg-transparent p-2 outline-none font-bold italic text-lg border-b border-white/10 resize-none h-32" />
                </div>
              </div>

              {isUploading && (
                <div className="mb-8 space-y-4 px-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-blue-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> {compressionStatus}</span>
                    <span className="text-zinc-500">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{width: `${uploadProgress}%`}}/>
                  </div>
                </div>
              )}

              <button onClick={handlePublish} disabled={isUploading} className="mt-auto bg-blue-600 py-6 rounded-[35px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50">
                {isUploading ? <Loader2 className="animate-spin" /> : <Send size={24}/>} {isUploading ? "PUBLISHING..." : "POST NOW"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* FILTER DRAWER */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 rounded-t-[45px] z-[1000] border-t border-white/5 shadow-2xl">
          <div className="flex justify-between items-center mb-8 px-2">
            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Effects Library</span>
            <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={16}/></button>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-6 px-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-3 min-w-[70px]">
                <div className={`w-16 h-20 rounded-2xl border-2 transition-all overflow-hidden ${selectedFilter === key ? 'border-blue-500 scale-110 shadow-lg' : 'border-transparent opacity-40'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className={`text-[9px] font-black uppercase ${selectedFilter === key ? 'text-blue-500' : 'text-zinc-600'}`}>{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MUSIC DRAWER */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[1100] p-6 pt-16 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black italic text-blue-600 uppercase">Music Library</h2>
            <button onClick={() => { setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null); }} className="p-2 bg-white/5 rounded-full"><X/></button>
          </div>
          <div className="relative mb-8">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
            <input type="text" placeholder="Search sounds..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-4 pl-14 pr-6 font-bold outline-none" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
            {filteredMusic.map(m => (
              <div key={m.id} className={`p-5 rounded-[35px] flex items-center justify-between border ${selectedMusic?.id === m.id ? 'bg-blue-600/10 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-5 flex-1 cursor-pointer" onClick={() => toggleMusic(m)}>
                   <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                    {playingMusicId === m.id ? <Pause size={24}/> : <Play size={24}/>}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase">{m.title}</span>
                    <span className="text-[10px] text-zinc-500 font-black italic">Original Sound</span>
                  </div>
                </div>
                <button onClick={() => { setSelectedMusic(m); setShowMusic(false); }} className={`p-4 rounded-2xl ${selectedMusic?.id === m.id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Check size={20} strokeWidth={3}/>
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
