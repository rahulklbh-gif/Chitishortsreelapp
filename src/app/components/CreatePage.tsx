"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, ShieldCheck, Search
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p } from '@/lib/videoCompression'; 

// --- Configuration (R2 & S3) ---
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

// --- All 20 Filters Data (Preserved) ---
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
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, cols: "grid-cols-2", rows: "grid-rows-2", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, cols: "grid-cols-2", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column", style: "", isGrid: true, gridCount: 3, cols: "grid-cols-1", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  storm: { name: "Lightning", style: "contrast(1.4) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
  // --- States ---
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

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // --- Music Fetching ---
  useEffect(() => {
    const fetchMusic = async () => {
      const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
      if (data) setMusicList(data);
    };
    fetchMusic();
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [musicList, searchQuery]);

  // --- Camera Core Logic ---
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      toast.error("Camera access failed. Check permissions.");
    }
  }, [facingMode]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) startCamera();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [isCameraMode, startCamera, previewUrl]);

  // --- Audio Engine (Mic 20% Fix) ---
  const setupAudioMixing = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;

    // Close old context if exists to prevent duplicate music play
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContext();
    const dest = audioCtxRef.current.createMediaStreamDestination();

    // Mic Gain Setup (20%)
    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain();
    micGain.gain.value = 0.2; 

    // Music Source Setup
    const musicSource = audioCtxRef.current.createMediaElementSource(audioRef.current);
    
    micSource.connect(micGain);
    micGain.connect(dest);
    musicSource.connect(dest);
    musicSource.connect(audioCtxRef.current.destination);

    const videoTrack = streamRef.current.getVideoTracks()[0];
    const mixedAudioTrack = dest.stream.getAudioTracks()[0];
    
    return new MediaStream([videoTrack, mixedAudioTrack]);
  };

  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    const finalStream = selectedMusic ? setupAudioMixing() : streamRef.current;

    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      if (videoRef.current) videoRef.current.srcObject = null;
      setPreviewUrl(url);
      setSelectedFile(new File([blob], "recorded.webm", { type: 'video/webm' }));
      setIsRecording(false);
      audioRef.current?.pause();
    };

    if (selectedMusic && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

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
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    clearInterval(timerRef.current);
  };

  // --- Publishing ---
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    try {
      const compressed = await compressVideoTo480p(selectedFile, (p) => {
        setUploadProgress(10 + Math.floor(p.progress * 70));
        setCompressionStatus(p.message);
      });

      const fileName = `shorts/${user.id}/${Date.now()}.mp4`;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(await compressed.arrayBuffer()),
        ContentType: 'video/mp4',
      }));

      await supabase.from('posts').insert([{
        video_url: `${R2_CONFIG.publicDomain}/${fileName}`,
        caption, user_id: user.id, filter_name: selectedFilter,
        user_name: user.user_metadata?.full_name,
        user_image: user.user_metadata?.avatar_url
      }]);

      toast.success("Short Published!");
      window.location.href = '/';
    } catch (e: any) {
      toast.error(e.message);
      setIsUploading(false);
    }
  };

  // --- Mirror & Layout Fix Logic ---
  const renderVideo = (isLive: boolean, url?: string) => {
    const f = FILTERS_DATA[selectedFilter];
    const grids = f.isGrid ? f.gridCount : 1;

    return (
      <div className={`h-full w-full bg-black ${f.isGrid ? `grid ${f.cols} ${f.rows} gap-0.5` : 'flex'}`}>
        {[...Array(grids)].map((_, i) => (
          <video 
            key={i} 
            ref={i === 0 && isLive ? videoRef : null}
            src={!isLive ? url : undefined}
            autoPlay playsInline loop muted={isLive && i !== 0}
            className="w-full h-full object-cover"
            style={{ 
              filter: f.style,
              // Mirror ONLY for live front camera, NOT for recorded preview
              transform: (isLive && facingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)'
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white z-[999] overflow-hidden select-none">
      
      {/* 1. Camera View */}
      {!isFinalStep && (
        <div className="relative h-full w-full flex flex-col">
          {/* Top Bar */}
          <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[60] bg-gradient-to-b from-black/80 to-transparent">
            <button onClick={() => window.location.href='/'} className="p-2 active:scale-75 transition-all"><X size={30}/></button>
            <button onClick={() => setShowMusic(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-2xl px-5 py-2 rounded-full border border-white/20">
              <Music size={16} className="text-pink-500 animate-pulse"/>
              <span className="text-[11px] font-black uppercase tracking-widest truncate max-w-[100px]">
                {selectedMusic?.title || "Add Sound"}
              </span>
            </button>
            <div className="w-10"/>
          </div>

          {/* Main Display - Mirror & Layout Fixed */}
          <div className="flex-1 overflow-hidden relative">
            {isCameraMode || previewUrl ? (
               renderVideo(!previewUrl, previewUrl)
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-10">
                <button onClick={() => setIsCameraMode(true)} className="w-40 h-40 bg-blue-600 rounded-[50px] flex items-center justify-center shadow-2xl active:scale-90 transition-all">
                  <Camera size={50} strokeWidth={3}/>
                </button>
                <label className="flex items-center gap-3 bg-zinc-900 px-10 py-5 rounded-3xl border border-white/10 cursor-pointer">
                  <Upload size={20}/> <span className="font-bold text-sm uppercase">Upload Gallery</span>
                  <input type="file" hidden accept="video/*" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }
                  }}/>
                </label>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          {(isCameraMode && !previewUrl) && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-[60]">
               <button onClick={() => setFacingMode(p => p==='user'?'environment':'user')} className="flex flex-col items-center gap-1">
                 <div className="p-3.5 bg-black/40 rounded-2xl backdrop-blur-md border border-white/10"><RefreshCw size={24}/></div>
                 <span className="text-[9px] font-bold uppercase">Flip</span>
               </button>
               <button onClick={() => setShowFilters(true)} className="flex flex-col items-center gap-1">
                 <div className="p-3.5 bg-black/40 rounded-2xl backdrop-blur-md border border-white/10 text-cyan-400"><Sparkles size={24}/></div>
                 <span className="text-[9px] font-bold uppercase">Filters</span>
               </button>
            </div>
          )}

          {/* Bottom Controls - TikTok Style */}
          {(isCameraMode || previewUrl) && (
            <div className="absolute bottom-0 inset-x-0 p-10 pb-12 flex flex-col items-center gap-8 bg-gradient-to-t from-black/80 to-transparent z-[60]">
               {!previewUrl ? (
                 <>
                   <div className="flex bg-black/60 p-1 rounded-full border border-white/10">
                      {[15, 30].map(s => (
                        <button key={s} onClick={() => setRecordLimit(s)} className={`px-6 py-2 rounded-full text-[10px] font-black transition-all ${recordLimit===s?'bg-white text-black':'text-zinc-500'}`}>{s}S</button>
                      ))}
                   </div>
                   <div className="relative flex items-center justify-center">
                      <button onClick={isRecording ? stopRecording : startRecording} className={`w-20 h-20 rounded-full border-[6px] flex items-center justify-center transition-all ${isRecording?'border-red-600/20':'border-white/30'}`}>
                        <div className={`transition-all duration-300 ${isRecording?'w-8 h-8 bg-red-600 rounded-lg animate-pulse':'w-14 h-14 bg-red-600 rounded-full'}`}/>
                      </button>
                      {isRecording && <span className="absolute -top-8 text-red-500 font-black text-xs tracking-tighter animate-bounce">{timeLeft}S LEFT</span>}
                   </div>
                 </>
               ) : (
                 <div className="flex gap-4 w-full max-w-sm">
                   <button onClick={() => {setPreviewUrl(''); startCamera();}} className="flex-1 py-4 bg-zinc-900 rounded-2xl font-black uppercase text-xs border border-white/10">Discard</button>
                   <button onClick={() => setIsFinalStep(true)} className="flex-1 py-4 bg-red-600 rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-600/30">Next Step</button>
                 </div>
               )}
            </div>
          )}
        </div>
      )}

      {/* 2. Final Post Step */}
      {isFinalStep && (
        <div className="h-full bg-zinc-950 flex flex-col p-6 pt-10">
           <div className="flex items-center gap-4 mb-10">
             <button onClick={() => setIsFinalStep(false)}><ArrowLeft size={30}/></button>
             <h2 className="text-xl font-black italic uppercase">Share Short</h2>
           </div>
           <div className="flex gap-4 mb-10">
              <div className="w-32 h-48 bg-zinc-900 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                 {renderVideo(false, previewUrl)}
              </div>
              <textarea 
                value={caption} 
                onChange={e => setCaption(e.target.value)} 
                placeholder="Write a catchy caption..."
                className="flex-1 bg-transparent py-2 outline-none text-lg font-medium resize-none"
              />
           </div>

           {isUploading && (
             <div className="mb-8 space-y-3">
               <div className="flex justify-between text-[10px] font-black text-blue-500 uppercase">
                 <span>{compressionStatus}</span>
                 <span>{uploadProgress}%</span>
               </div>
               <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-600 transition-all duration-500" style={{width:`${uploadProgress}%`}}/>
               </div>
             </div>
           )}

           <button 
             onClick={handlePublish} 
             disabled={isUploading}
             className="mt-auto w-full bg-red-600 py-5 rounded-[25px] font-black text-lg shadow-2xl shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
           >
             {isUploading ? <Loader2 className="animate-spin"/> : <Send size={20}/>}
             {isUploading ? "PUBLISHING..." : "POST NOW"}
           </button>
        </div>
      )}

      {/* 3. Filters Drawer (Z-Index Fixed) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-8 pt-10 rounded-t-[40px] z-[100] border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Select Effect</span>
            <button onClick={() => setShowFilters(false)} className="bg-white/5 p-1.5 rounded-full"><X size={18}/></button>
          </div>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-2 min-w-[70px]">
                <div className={`w-14 h-18 rounded-2xl border-2 transition-all ${selectedFilter===key?'border-red-600 scale-110 shadow-lg shadow-red-600/20':'border-transparent opacity-40'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover rounded-xl" style={{filter: FILTERS_DATA[key].style}}/>
                </div>
                <span className={`text-[9px] font-bold ${selectedFilter===key?'text-red-500':'text-zinc-600'}`}>{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Music Library (Z-Index Fixed) */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[200] p-6 pt-16 flex flex-col animate-in fade-in duration-300">
           <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black italic text-pink-500 uppercase tracking-tighter">Sound Library</h2>
              <button onClick={() => {setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}}><X size={32}/></button>
           </div>
           <div className="relative mb-6">
             <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={20}/>
             <input 
               type="text" 
               placeholder="Search trending music..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="w-full bg-zinc-900 py-5 pl-14 pr-6 rounded-[25px] outline-none font-bold border border-white/5 focus:border-pink-500/50 transition-all"
             />
           </div>
           <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pb-20">
             {filteredMusic.map(m => (
               <div key={m.id} className={`p-5 rounded-[30px] flex items-center justify-between border ${selectedMusic?.id===m.id?'bg-pink-600/10 border-pink-500':'bg-zinc-900 border-transparent'}`}>
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => {
                    if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                    else { if(audioRef.current) { audioRef.current.src = m.audio_url; audioRef.current.play(); setPlayingMusicId(m.id); }}
                  }}>
                    <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center">
                      {playingMusicId === m.id ? <Pause size={20}/> : <Play size={20} className="ml-1"/>}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase tracking-tighter truncate max-w-[150px]">{m.title}</span>
                      <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Popular Sound</span>
                    </div>
                  </div>
                  <button onClick={() => {setSelectedMusic(m); setShowMusic(false);}} className={`p-3.5 rounded-xl transition-all ${selectedMusic?.id===m.id?'bg-pink-600':'bg-zinc-800 active:scale-90'}`}>
                    <Check size={20} strokeWidth={4}/>
                  </button>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Global Hidden Audio */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
}
