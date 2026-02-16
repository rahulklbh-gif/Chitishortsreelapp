"use client";

/**
 * PROJECT: CHITI SHORT VIDEO PLATFORM - CREATOR PRO
 * VERSION: 5.0.0 (Ultimate Mirror & Filter Engine)
 * TOTAL LINES: 700+ 
 * * CORE FIXES:
 * 1. Mirroring: Live (Mirrored) vs Preview (Original/Straight)
 * 2. Filter Sync: Works on Live, Recording Preview, and Gallery Uploads
 * 3. Audio Mixing: 20% Mic + 100% Music
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, 
  ShieldCheck, Search, Info, Settings, Scissors, HardDrive,
  MonitorPlay, Mic, Volume2, Clapperboard, Layers, Eye,
  CloudUpload, Film, Music2, Wand2, Smartphone
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p } from '@/lib/videoCompression';

// --- CONFIGURATION: Cloudflare R2 & Storage ---
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

// --- DATABASE: Professional Filters & Grid Layouts ---
const FILTERS_DATA: any = {
  none: { name: "Natural", style: "none", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory Silk", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.6px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  cine: { name: "CineMax", style: "contrast(1.6) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Vintage 90s", style: "sepia(0.8) contrast(1.2) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "B&W Noir", style: "grayscale(1) contrast(1.8)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  warm: { name: "Golden Hour", style: "sepia(0.4) saturate(1.6) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  gold: { name: "Royal Gold", style: "sepia(0.5) brightness(1.1) saturate(2)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  cyber: { name: "Cyberpunk", style: "hue-rotate(280deg) saturate(2) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  vivid: { name: "Ultra Vivid", style: "saturate(3) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  dreamy: { name: "Dreamy", style: "brightness(1.1) blur(2px) saturate(1.3)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  ocean: { name: "Oceanic", style: "hue-rotate(180deg) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  storm: { name: "Stormy", style: "contrast(1.4) brightness(0.8) saturate(0.6)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  
  // Grid Based Layouts
  quad: { name: "4-Grid", style: "none", isGrid: true, gridCount: 4, cols: "grid-cols-2", rows: "grid-rows-2", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "none", isGrid: true, gridCount: 6, cols: "grid-cols-2", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "Stack 3", style: "none", isGrid: true, gridCount: 3, cols: "grid-cols-1", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" }
};

// --- S3 CLIENT INITIALIZATION ---
const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint,
  credentials: { 
    accessKeyId: R2_CONFIG.accessKeyId, 
    secretAccessKey: R2_CONFIG.secretAccessKey 
  },
  forcePathStyle: true,
});

export default function CreatePage() {
  const { user } = useAuth();
  
  // --- STATE MANAGEMENT (DETAILED) ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionStatus, setCompressionStatus] = useState(""); 
  
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicLibrary, setMusicLibrary] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(''); 
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- COMPONENT MOUNT LOGIC ---
  useEffect(() => {
    const fetchMusic = async () => {
      try {
        const { data, error } = await supabase.from('music_library').select('*');
        if (data) setMusicLibrary(data);
      } catch (err) {
        console.error("Music error:", err);
      }
    };
    fetchMusic();

    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const filteredMusic = useMemo(() => {
    return musicLibrary.filter(m => 
      m.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [musicLibrary, searchQuery]);

  // --- CAMERA INITIALIZATION ---
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: facingMode }, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        },
        audio: true
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      toast.error("Unable to access camera.");
      setIsCameraMode(false);
    }
  }, [facingMode]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) {
      startCamera();
    }
  }, [isCameraMode, startCamera, previewUrl]);

  // --- PROFESSIONAL AUDIO MIXING (MIC 20% | MUSIC 100%) ---
  const setupMixedStream = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContext();
    const destination = audioCtxRef.current.createMediaStreamDestination();

    // MIC: 20% Volume
    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain();
    micGain.gain.value = 0.2; 

    // MUSIC: 100% Volume
    const musicSource = audioCtxRef.current.createMediaElementSource(audioRef.current);
    const musicGain = audioCtxRef.current.createGain();
    musicGain.gain.value = 1.0;

    micSource.connect(micGain);
    micGain.connect(destination);
    
    musicSource.connect(musicGain);
    musicGain.connect(destination);
    
    // Play music locally so user can hear it while recording
    musicGain.connect(audioCtxRef.current.destination);

    const videoTrack = streamRef.current.getVideoTracks()[0];
    const mixedAudioTrack = destination.stream.getAudioTracks()[0];
    
    return new MediaStream([videoTrack, mixedAudioTrack]);
  };

  // --- RECORDING FUNCTIONS ---
  const handleStartRecording = () => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    const recordingStream = selectedMusic ? setupMixedStream() : streamRef.current;
    
    const recorder = new MediaRecorder(recordingStream, { 
      mimeType: 'video/webm;codecs=vp8,opus' 
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setSelectedFile(new File([blob], `chiti_${Date.now()}.webm`, { type: 'video/webm' }));
      setIsRecording(false);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };

    if (selectedMusic && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordDuration);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleStopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    clearInterval(timerRef.current);
  };

  // --- GALLERY UPLOAD LOGIC ---
  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error("Select a video file.");
      return;
    }

    const v = document.createElement('video');
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      if (v.duration > 61) {
        toast.error("Video too long (Max 60s)");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(v.src);
      setIsCameraMode(false);
    };
  };

  // --- FINAL PUBLISH LOGIC (R2 + SUPABASE) ---
  const handlePublishPost = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    setUploadProgress(5);
    setCompressionStatus("Optimizing Video Quality...");

    try {
      // Step 1: Compression
      const compressedBlob = await compressVideoTo480p(selectedFile, (progress) => {
        setUploadProgress(10 + Math.floor(progress.progress * 60));
        setCompressionStatus(progress.message);
      });

      // Step 2: R2 Upload
      const fileKey = `shorts/${user.id}/${Date.now()}.mp4`;
      setCompressionStatus("Uploading to Chiti Servers...");
      
      const buffer = await compressedBlob.arrayBuffer();
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileKey,
        Body: new Uint8Array(buffer),
        ContentType: 'video/mp4',
      }));

      const finalVideoUrl = `${R2_CONFIG.publicDomain}/${fileKey}`;

      // Step 3: Database Insert
      const { error } = await supabase.from('posts').insert([{
        video_url: finalVideoUrl,
        caption: caption || "",
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Anonymous',
        user_image: user.user_metadata?.avatar_url || null,
        filter_name: selectedFilter,
        music_id: selectedMusic?.id || null
      }]);

      if (error) throw error;

      setUploadProgress(100);
      toast.success("Short Uploaded Successfully!");
      setTimeout(() => window.location.href = '/', 1000);

    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
      setIsUploading(false);
    }
  };

  /**
   * CORE RENDER ENGINE: FIXES MIRRORING & FILTERS
   * 1. Live Camera: scaleX(-1) if front camera.
   * 2. Preview/Gallery: scaleX(1) always (No Mirroring).
   * 3. Filter: Applied to both Live and Preview.
   */
  const renderVisualContent = (isLive: boolean) => {
    const filter = FILTERS_DATA[selectedFilter];
    const gridCount = filter.isGrid ? filter.gridCount : 1;

    // The logic to fix your mirroring issue:
    // Mirror only on LIVE front camera. Preview must be straight.
    const mirrorStyle = (isLive && facingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';

    return (
      <div className={`h-full w-full bg-black ${filter.isGrid ? `grid ${filter.cols} ${filter.rows} gap-0.5` : 'flex'}`}>
        {[...Array(gridCount)].map((_, idx) => (
          <div key={idx} className="relative w-full h-full overflow-hidden bg-zinc-900">
            <video 
              ref={idx === 0 && isLive ? videoRef : null}
              src={!isLive ? previewUrl : undefined}
              autoPlay 
              playsInline 
              muted={isLive ? (idx !== 0) : false} 
              loop
              className="w-full h-full object-cover"
              style={{ 
                filter: filter.style,
                transform: mirrorStyle,
                transition: 'filter 0.3s ease-in-out'
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  // --- UI COMPONENT ---
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden select-none">
      
      {/* HEADER: Dynamic Control Bar */}
      {!isFinalStep && (
        <header className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[200] bg-gradient-to-b from-black/70 to-transparent">
          <button 
            onClick={() => {
                if (previewUrl) { setPreviewUrl(''); startCamera(); }
                else { window.history.back(); }
            }} 
            className="p-3 bg-black/20 backdrop-blur-2xl rounded-full border border-white/10"
          >
            <X size={26}/>
          </button>

          <button 
            onClick={() => setShowMusic(true)} 
            className="flex items-center gap-3 bg-white/10 backdrop-blur-3xl px-6 py-2.5 rounded-full border border-white/20 hover:bg-white/20 transition-all"
          >
            <Music size={18} className="text-pink-500 animate-pulse"/>
            <span className="text-[11px] font-black uppercase tracking-widest max-w-[130px] truncate">
              {selectedMusic ? selectedMusic.title : "Add Music"}
            </span>
          </button>

          <button className="p-3 bg-black/20 backdrop-blur-2xl rounded-full border border-white/10">
            <Settings size={22}/>
          </button>
        </header>
      )}

      {/* VIEWPORT: The Content Area */}
      <main className="flex-1 relative flex flex-col items-center justify-center bg-zinc-950 h-full w-full">
        {!isCameraMode && !previewUrl ? (
          /* INITIAL CHOICE SCREEN */
          <div className="flex flex-col items-center gap-16 animate-in zoom-in-95 duration-500">
            <div className="relative group">
              <div className="absolute -inset-12 bg-blue-600/20 blur-[100px] rounded-full group-hover:bg-blue-600/30 transition-all"/>
              <button 
                onClick={() => setIsCameraMode(true)} 
                className="w-44 h-44 bg-blue-600 rounded-[60px] flex items-center justify-center relative shadow-2xl active:scale-90 transition-all cursor-pointer"
              >
                <Camera size={64} strokeWidth={2.5} className="text-white"/>
              </button>
            </div>
            
            <label className="flex items-center gap-4 bg-zinc-900/80 hover:bg-zinc-800 px-14 py-6 rounded-[35px] border border-white/5 cursor-pointer backdrop-blur-3xl transition-all active:scale-95 group">
              <Upload size={24} className="text-blue-500 group-hover:scale-125 transition-transform"/>
              <span className="text-sm font-black uppercase italic tracking-[0.2em]">Open Gallery</span>
              <input type="file" hidden accept="video/*" onChange={handleGallerySelect}/>
            </label>
          </div>
        ) : !isFinalStep ? (
          /* LIVE / PREVIEW CAMERA SCREEN */
          <div className="relative w-full h-full overflow-hidden">
            <div className="h-full w-full flex items-center justify-center">
               {renderVisualContent(!previewUrl)}
            </div>

            {/* Side Tools (Only during live recording) */}
            {!previewUrl && (
              <nav className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-[210]">
                <button 
                  onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} 
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="p-4 bg-black/30 rounded-2xl backdrop-blur-2xl border border-white/10 group-active:bg-blue-600 transition-all">
                    <RefreshCw size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter">Flip</span>
                </button>

                <button 
                  onClick={() => setShowFilters(true)} 
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="p-4 bg-black/30 rounded-2xl backdrop-blur-2xl border border-white/10 text-cyan-400 group-active:bg-cyan-600/40">
                    <Sparkles size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter">Effects</span>
                </button>

                <button className="flex flex-col items-center gap-2 group">
                  <div className="p-4 bg-black/30 rounded-2xl backdrop-blur-2xl border border-white/10 text-yellow-400 group-active:bg-yellow-600/40">
                    <Zap size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter">Flash</span>
                </button>
                
                <button className="flex flex-col items-center gap-2 group">
                  <div className="p-4 bg-black/30 rounded-2xl backdrop-blur-2xl border border-white/10 text-white">
                    <MonitorPlay size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter">Preview</span>
                </button>
              </nav>
            )}

            {/* Bottom Controls Area */}
            <div className="absolute bottom-0 inset-x-0 p-10 pb-16 flex flex-col items-center gap-12 bg-gradient-to-t from-black via-black/40 to-transparent z-[210]">
              {!previewUrl ? (
                <>
                  <div className="flex bg-black/50 p-1.5 rounded-full border border-white/10 backdrop-blur-3xl">
                      {[15, 30, 60].map(duration => (
                        <button 
                          key={duration} 
                          onClick={() => setRecordDuration(duration)} 
                          className={`px-8 py-2.5 rounded-full text-[11px] font-black transition-all ${recordDuration === duration ? 'bg-white text-black scale-105 shadow-xl' : 'text-zinc-500'}`}
                        >
                          {duration}S
                        </button>
                      ))}
                  </div>

                  <div className="relative flex items-center justify-center">
                     <button 
                        onClick={isRecording ? handleStopRecording : handleStartRecording} 
                        className={`w-28 h-28 rounded-full border-[6px] transition-all duration-500 flex items-center justify-center ${
                          isRecording ? 'border-red-600/20 scale-110' : 'border-white/30 hover:border-white/60'
                        }`}
                      >
                        <div className={`transition-all duration-300 ${
                          isRecording ? 'w-12 h-12 bg-red-600 rounded-[10px] animate-pulse' : 'w-20 h-20 bg-red-600 rounded-full'
                        }`} />
                      </button>
                      {isRecording && (
                        <div className="absolute -top-14 px-6 py-2 bg-red-600 rounded-full text-[12px] font-black tracking-widest shadow-2xl">
                          {timeLeft}s REMAINING
                        </div>
                      )}
                  </div>
                </>
              ) : (
                <div className="flex gap-5 w-full max-w-md animate-in slide-in-from-bottom-10 duration-500">
                  <button 
                    onClick={() => { setPreviewUrl(''); startCamera(); }} 
                    className="flex-1 py-6 bg-zinc-900 rounded-[30px] font-black uppercase tracking-widest text-[12px] border border-white/10 backdrop-blur-3xl active:scale-95 transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={() => setIsFinalStep(true)} 
                    className="flex-1 py-6 bg-red-600 rounded-[30px] font-black uppercase tracking-widest text-[12px] shadow-2xl shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    Next <ArrowLeft className="rotate-180" size={18}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* PUBLISH FORM SCREEN */
          <div className="h-full w-full bg-zinc-950 flex flex-col p-8 pt-16 animate-in slide-in-from-right duration-500 z-[250]">
            <header className="flex items-center gap-6 mb-12">
              <button onClick={() => setIsFinalStep(false)} className="p-3 hover:bg-zinc-900 rounded-full transition-colors">
                <ArrowLeft size={32}/>
              </button>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Share Short</h2>
            </header>

            <div className="flex gap-6 mb-12 bg-zinc-900/40 p-5 rounded-[45px] border border-white/5">
              <div className="w-36 h-56 bg-zinc-900 rounded-[35px] overflow-hidden shadow-2xl border border-white/10 relative shrink-0">
                {renderVisualContent(false)}
                <div className="absolute inset-0 bg-black/30 pointer-events-none"/>
              </div>
              <div className="flex-1 pt-4">
                 <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)} 
                  placeholder="What's happening? #chiti #viral" 
                  className="w-full bg-transparent p-0 outline-none font-bold text-xl border-none resize-none h-48 placeholder:text-zinc-800 leading-relaxed" 
                 />
              </div>
            </div>

            {/* PROGRESS SECTION */}
            {isUploading && (
              <div className="mb-12 space-y-5 px-4 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Loader2 size={20} className="animate-spin text-blue-500"/>
                    <span className="text-[12px] font-black uppercase tracking-[0.2em] text-blue-500">
                      {compressionStatus}
                    </span>
                  </div>
                  <span className="text-sm font-black text-zinc-400">{uploadProgress}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 bg-[length:200%_auto] animate-gradient transition-all duration-700 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)]" 
                    style={{width: `${uploadProgress}%`}}
                  />
                </div>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-5">
              <div className="flex items-center gap-3 px-8 py-5 bg-zinc-900/30 rounded-[30px] border border-white/5">
                <ShieldCheck size={20} className="text-zinc-600"/>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-tight">
                  By publishing, you comply with Chiti Community Guidelines.
                </span>
              </div>
              
              <button 
                onClick={handlePublishPost} 
                disabled={isUploading} 
                className="w-full bg-red-600 py-7 rounded-[35px] font-black text-2xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 transition-all shadow-2xl shadow-red-600/20 group"
              >
                {isUploading ? <Loader2 className="animate-spin" size={28}/> : <Send size={28} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"/>} 
                {isUploading ? "PROCESS..." : "POST NOW"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FILTER DRAWER PANEL */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-10 pt-12 rounded-t-[60px] z-[300] border-t border-white/10 shadow-[0_-30px_100px_rgba(0,0,0,1)] animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-10 px-4">
            <div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Chiti Effects</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Professional Cinema Filters</p>
            </div>
            <button 
              onClick={() => setShowFilters(false)} 
              className="p-4 bg-white/5 rounded-full border border-white/10 active:scale-75 transition-transform"
            >
              <X size={24}/>
            </button>
          </div>
          
          <div className="flex gap-6 overflow-x-auto no-scrollbar pb-10 px-4 snap-x">
            {Object.keys(FILTERS_DATA).map(key => (
              <button 
                key={key} 
                onClick={() => setSelectedFilter(key)} 
                className="flex flex-col items-center gap-5 min-w-[90px] snap-center group"
              >
                <div className={`w-20 h-28 rounded-[28px] border-4 transition-all duration-300 relative ${
                  selectedFilter === key 
                  ? 'border-red-600 scale-110 rotate-2 shadow-[0_0_30px_rgba(220,38,38,0.4)]' 
                  : 'border-white/5 opacity-50 group-hover:opacity-100 group-hover:scale-105'
                }`}>
                  <img 
                    src={FILTERS_DATA[key].thumb} 
                    className="w-full h-full object-cover rounded-[22px]" 
                    style={{ filter: FILTERS_DATA[key].style }} 
                    alt={FILTERS_DATA[key].name}
                  />
                  {selectedFilter === key && (
                    <div className="absolute -top-3 -right-3 bg-red-600 rounded-full p-1.5 shadow-xl">
                      <Check size={14} strokeWidth={4}/>
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-black uppercase tracking-tighter ${
                  selectedFilter === key ? 'text-red-500' : 'text-zinc-600'
                }`}>
                  {FILTERS_DATA[key].name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MUSIC SELECTION PANEL (FULL OVERLAY) */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[400] p-8 pt-20 flex flex-col animate-in slide-in-from-right duration-500">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-5xl font-black italic text-pink-500 uppercase tracking-tighter">Music</h2>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.3em] mt-3">Trending Sounds for You</p>
            </div>
            <button 
              onClick={() => { setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null); }} 
              className="p-5 bg-white/5 rounded-full border border-white/10 active:scale-75 transition-all"
            >
              <X size={32}/>
            </button>
          </div>

          <div className="relative mb-12 group">
            <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-pink-500 transition-colors" size={26}/>
            <input 
              type="text" 
              placeholder="Search tracks, artists..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full bg-zinc-900 border border-white/5 rounded-[35px] py-7 pl-16 pr-8 font-bold outline-none focus:border-pink-500/50 transition-all placeholder:text-zinc-700 text-lg shadow-inner" 
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 no-scrollbar pb-32">
            {filteredMusic.map(music => (
              <div 
                key={music.id} 
                className={`p-6 rounded-[45px] flex items-center justify-between border transition-all duration-300 ${
                  selectedMusic?.id === music.id 
                  ? 'bg-pink-600/10 border-pink-500/50' 
                  : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                }`}
              >
                <div 
                  className="flex items-center gap-6 flex-1 cursor-pointer" 
                  onClick={() => {
                    if (playingMusicId === music.id) {
                        audioRef.current?.pause();
                        setPlayingMusicId(null);
                    } else {
                        if (audioRef.current) {
                            audioRef.current.src = music.audio_url;
                            audioRef.current.play();
                            setPlayingMusicId(music.id);
                        }
                    }
                  }}
                >
                   <div className="w-16 h-16 rounded-[24px] bg-black/60 flex items-center justify-center relative overflow-hidden shrink-0 border border-white/5">
                    {playingMusicId === music.id ? <Pause size={28} className="z-10 text-pink-500"/> : <Play size={28} className="ml-1 z-10 text-white"/>}
                    {playingMusicId === music.id && (
                      <div className="absolute inset-0 bg-pink-600/20 animate-pulse"/>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-black text-xl uppercase tracking-tighter truncate max-w-[180px]">
                      {music.title}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <Music2 size={12}/> {music.artist || 'Chiti Original'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => { setSelectedMusic(music); setShowMusic(false); }} 
                  className={`p-6 rounded-[25px] transition-all active:scale-75 ${
                    selectedMusic?.id === music.id 
                    ? 'bg-pink-600 text-white shadow-xl shadow-pink-600/30' 
                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                  }`}
                >
                  <Check size={28} strokeWidth={4}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HIDDEN UTILITIES */}
      <audio ref={audioRef} hidden onEnded={() => setPlayingMusicId(null)}/>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient { animation: gradient 3s ease infinite; }
      `}</style>
    </div>
  );
} 
