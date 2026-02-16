"use client";

/**
 * ------------------------------------------------------------------
 * PROJECT: CHITI CREATOR STUDIO - ULTIMATE EDITION
 * ------------------------------------------------------------------
 * FEATURES:
 * 1. Smart Mirror Engine: Mirrors Front Cam, Straightens Previews.
 * 2. Universal Filter System: Works on Live, Recorded & Gallery.
 * 3. Audio Core: 20% Mic / 100% Music Mixing.
 * 4. Clean UI: Minimal icons, Small text (User Requested).
 * 5. Full 20+ Filter Database.
 * ------------------------------------------------------------------
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  X,               // Close
  Music,           // Add Sound
  RefreshCw,       // Flip Camera
  Sparkles,        // Effects/Filters
  Zap,             // Flash
  Upload,          // Gallery
  Check,           // Confirm
  Play, 
  Pause, 
  Search, 
  Loader2, 
  Send, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Disc
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p } from '@/lib/videoCompression';

// ==========================================
// 1. CLOUDFLARE R2 CONFIGURATION
// ==========================================
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

// ==========================================
// 2. EXTENSIVE FILTER DATABASE (20+ ITEMS)
// ==========================================
const FILTERS_DATA: any = {
  // --- Standard Looks ---
  none: { 
    name: "Normal", 
    style: "none", 
    thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&q=80" 
  },
  bright: { 
    name: "Bright", 
    style: "brightness(1.2) contrast(1.1)", 
    thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" 
  },
  warm: { 
    name: "Warmth", 
    style: "sepia(0.3) saturate(1.4)", 
    thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100&q=80" 
  },
  cool: { 
    name: "Cool Blue", 
    style: "hue-rotate(180deg) brightness(1.1) opacity(0.9)", 
    thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80" 
  },
  sunset: { 
    name: "Sunset", 
    style: "contrast(1.2) saturate(1.8) hue-rotate(-10deg)", 
    thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80" 
  },
  
  // --- Cinematic ---
  cinema: { 
    name: "Cinema", 
    style: "contrast(1.5) saturate(0.8) brightness(0.9)", 
    thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100&q=80" 
  },
  noir: { 
    name: "Noir B&W", 
    style: "grayscale(1) contrast(1.5) brightness(0.9)", 
    thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&q=80" 
  },
  fade: { 
    name: "Faded", 
    style: "brightness(1.1) contrast(0.8) saturate(0.8)", 
    thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" 
  },
  vivid: { 
    name: "Vivid", 
    style: "saturate(2.5) contrast(1.1)", 
    thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&q=80" 
  },
  
  // --- Artistic ---
  dream: { 
    name: "Dreamy", 
    style: "blur(0.5px) brightness(1.2) saturate(1.2)", 
    thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100&q=80" 
  },
  retro: { 
    name: "1990 Retro", 
    style: "sepia(0.8) contrast(1.2) brightness(0.8)", 
    thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100&q=80" 
  },
  cyber: { 
    name: "Cyberpunk", 
    style: "hue-rotate(290deg) saturate(2) contrast(1.3)", 
    thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&q=80" 
  },
  invert: { 
    name: "X-Ray", 
    style: "invert(0.8) hue-rotate(180deg)", 
    thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&q=80" 
  },
  
  // --- Beauty ---
  soft: { 
    name: "Soft Skin", 
    style: "brightness(1.1) blur(0.3px) contrast(1.05)", 
    thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" 
  },
  glow: { 
    name: "Angel Glow", 
    style: "brightness(1.3) contrast(0.9) saturate(1.1)", 
    thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100&q=80" 
  },
  ivory: { 
    name: "Ivory", 
    style: "sepia(0.2) brightness(1.15) contrast(1.1)", 
    thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80" 
  },

  // --- Grid Layouts (Advanced) ---
  duo: { 
    name: "Split V", 
    style: "none", 
    isGrid: true, gridCount: 2, cols: "grid-cols-1", rows: "grid-rows-2", 
    thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100&q=80" 
  },
  side: { 
    name: "Split H", 
    style: "none", 
    isGrid: true, gridCount: 2, cols: "grid-cols-2", rows: "grid-rows-1", 
    thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&q=80" 
  },
  triple: { 
    name: "Stack 3", 
    style: "none", 
    isGrid: true, gridCount: 3, cols: "grid-cols-1", rows: "grid-rows-3", 
    thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" 
  },
  quad: { 
    name: "4-Grid", 
    style: "none", 
    isGrid: true, gridCount: 4, cols: "grid-cols-2", rows: "grid-rows-2", 
    thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&q=80" 
  }
};

// ==========================================
// 3. MAIN COMPONENT START
// ==========================================
export default function CreateShortsPage() {
  const { user } = useAuth();
  
  // -- State: Files & Progress --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState(""); 
  
  // -- State: Camera & Recording --
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationLimit, setDurationLimit] = useState(15);
  const [timer, setTimer] = useState(15);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  
  // -- State: Effects & Music --
  const [activeFilter, setActiveFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [musicQuery, setMusicQuery] = useState(''); 
  const [activeMusic, setActiveMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [audioPlayId, setAudioPlayId] = useState<string | null>(null);

  // -- Refs for DOM Elements --
  const videoRef = useRef<HTMLVideoElement>(null);        // Live Camera
  const previewVideoRef = useRef<HTMLVideoElement>(null); // Playback
  const audioRef = useRef<HTMLAudioElement | null>(null); // Music Player
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- S3 Initialization ---
  const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_CONFIG.endpoint,
    credentials: { 
      accessKeyId: R2_CONFIG.accessKeyId, 
      secretAccessKey: R2_CONFIG.secretAccessKey 
    },
    forcePathStyle: true,
  });

  // ==========================================
  // 4. DATA FETCHING & CLEANUP
  // ==========================================
  useEffect(() => {
    // Check Flash Capability
    const checkFlash = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            // Basic assumption, real check requires stream
            if (videoDevices.length > 0) setHasFlash(true);
        } catch(e) {}
    };
    checkFlash();

    // Fetch Music
    const loadMusic = async () => {
      const { data } = await supabase.from('music_library').select('*');
      if (data) setMusicList(data);
    };
    loadMusic();

    // Cleanup Function
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      clearInterval(countdownRef.current);
    };
  }, []);

  // Filter Music Search
  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(musicQuery.toLowerCase()));
  }, [musicList, musicQuery]);

  // ==========================================
  // 5. CAMERA LOGIC & MIRRORING
  // ==========================================
  const initCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      
      const constraints: MediaStreamConstraints = {
        video: { 
            facingMode: { ideal: facing }, 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            advanced: flashOn ? [{ torch: true } as any] : [] 
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Apply Flash if supported and requested (Chrome/Android mostly)
      const track = stream.getVideoTracks()[0];
      if (flashOn) {
        try { await track.applyConstraints({ advanced: [{ torch: true } as any] }); } catch(e) {}
      }

    } catch (e) {
      toast.error("Camera access denied");
      setIsCameraMode(false);
    }
  }, [facing, flashOn]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) initCamera();
  }, [isCameraMode, initCamera, previewUrl]);

  // ==========================================
  // 6. AUDIO MIXING (20% MIC FIX)
  // ==========================================
  const getMixedStream = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;
    
    // New Context
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AC();
    const dest = audioCtxRef.current.createMediaStreamDestination();

    // 1. Microphone Source (20% Volume)
    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain();
    micGain.gain.value = 0.2; // <-- MIC LOWERED
    micSource.connect(micGain);
    micGain.connect(dest);

    // 2. Music Source (100% Volume)
    const musicSource = audioCtxRef.current.createMediaElementSource(audioRef.current);
    const musicGain = audioCtxRef.current.createGain();
    musicGain.gain.value = 1.0; // <-- MUSIC FULL
    musicSource.connect(musicGain);
    musicGain.connect(dest);
    
    // Connect Music to Speakers too (so user hears it)
    musicGain.connect(audioCtxRef.current.destination);

    // Combine Video + Mixed Audio
    return new MediaStream([
        streamRef.current.getVideoTracks()[0], 
        dest.stream.getAudioTracks()[0]
    ]);
  };

  // ==========================================
  // 7. RECORDING HANDLERS
  // ==========================================
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    const streamToRecord = activeMusic ? getMixedStream() : streamRef.current;
    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
                     ? 'video/webm; codecs=vp9' 
                     : 'video/webm';

    const recorder = new MediaRecorder(streamToRecord, { mimeType });

    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url); // <-- Sets Preview Mode
      setSelectedFile(new File([blob], 'captured.webm', { type: 'video/webm' }));
      setIsRecording(false);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };

    // Play music if selected
    if (activeMusic && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
    }

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimer(durationLimit);

    // Countdown Timer
    countdownRef.current = setInterval(() => {
      setTimer((prev) => {
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
    clearInterval(countdownRef.current);
  };

  // ==========================================
  // 8. GALLERY UPLOAD (WITH FILTER SUPPORT)
  // ==========================================
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('video/')) {
        toast.error("Invalid file type");
        return;
    }

    // Set as if recorded
    const url = URL.createObjectURL(file);
    setPreviewUrl(url); // <-- Sets Preview Mode
    setSelectedFile(file);
    setIsCameraMode(false); // Hide camera UI
  };

  // ==========================================
  // 9. PUBLISH (COMPRESS + R2)
  // ==========================================
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setStatusText("Preparing...");

    try {
      // 1. Compress
      const compressed = await compressVideoTo480p(selectedFile, (p) => {
        setUploadProgress(10 + Math.floor(p.progress * 60));
        setStatusText(p.message);
      });

      // 2. Upload R2
      const key = `shorts/${user.id}/${Date.now()}.mp4`;
      setStatusText("Uploading...");
      
      const buf = await compressed.arrayBuffer();
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        Body: new Uint8Array(buf),
        ContentType: 'video/mp4'
      }));

      // 3. Database
      const publicUrl = `${R2_CONFIG.publicDomain}/${key}`;
      await supabase.from('posts').insert([{
        video_url: publicUrl,
        caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Creator',
        user_image: user.user_metadata?.avatar_url,
        filter_name: activeFilter,
        music_id: activeMusic?.id
      }]);

      toast.success("Uploaded!");
      window.location.href = '/'; // Redirect

    } catch (e: any) {
      toast.error(e.message);
      setIsUploading(false);
    }
  };

  // ==========================================
  // 10. RENDER ENGINE (CRITICAL FIXES)
  // ==========================================
  const renderViewfinder = (isLive: boolean) => {
    const filterData = FILTERS_DATA[activeFilter];
    const gridCount = filterData.isGrid ? filterData.gridCount : 1;
    
    // --- MIRRORING LOGIC (THE FIX) ---
    // Rule 1: Live Camera + User Facing = Mirror (scaleX -1)
    // Rule 2: Live Camera + Environment Facing = Normal (scaleX 1)
    // Rule 3: Preview (Recording/Gallery) = Normal (scaleX 1) <-- This fixes the "ulta" issue in preview
    
    let transformStyle = 'scaleX(1)';
    if (isLive && facing === 'user') {
        transformStyle = 'scaleX(-1)';
    }

    // Common Styles
    const videoStyles: React.CSSProperties = {
        filter: filterData.style,       // Apply Filter to EVERYTHING
        transform: transformStyle,      // Apply Mirror Logic
        objectFit: 'cover',
        width: '100%',
        height: '100%'
    };

    return (
      <div className={`w-full h-full bg-black overflow-hidden ${
        filterData.isGrid ? `grid ${filterData.cols} ${filterData.rows} gap-0.5` : 'flex'
      }`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full bg-zinc-900">
            {isLive ? (
              <video 
                ref={i === 0 ? videoRef : null} 
                autoPlay playsInline muted={i !== 0} 
                className="block"
                style={videoStyles}
              />
            ) : (
              <video 
                ref={i === 0 ? previewVideoRef : null} 
                src={previewUrl} 
                autoPlay loop playsInline 
                className="block"
                style={videoStyles}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ==========================================
  // 11. UI RENDERING
  // ==========================================
  return (
    <div className="fixed inset-0 bg-black text-white z-[999] flex flex-col font-sans select-none">
      
      {/* -------------------------------------
         HEADER (Clean: Close, Music, etc.)
         ------------------------------------- */}
      {!isFinalStep && (
        <div className="absolute top-0 inset-x-0 z-[20] p-4 pt-6 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
            {/* Left: Close */}
            <button 
                onClick={() => previewUrl ? (setPreviewUrl(''), initCamera()) : window.history.back()}
                className="p-2 bg-black/30 backdrop-blur-md rounded-full border border-white/10 active:scale-90 transition"
            >
                <X size={24} />
            </button>

            {/* Center: Music Pill */}
            <button 
                onClick={() => setShowMusic(true)}
                className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-5 py-2 rounded-full border border-white/15 active:scale-95 transition"
            >
                <Music size={14} className="text-white" />
                <span className="text-[11px] font-bold uppercase tracking-wider truncate max-w-[100px]">
                    {activeMusic ? activeMusic.title : "Add Sound"}
                </span>
            </button>

            {/* Right: Empty spacer to balance or Settings if needed */}
            <div className="w-10"></div> 
        </div>
      )}

      {/* -------------------------------------
         MAIN CONTENT (Camera / Preview)
         ------------------------------------- */}
      <div className="flex-1 relative bg-zinc-900 overflow-hidden rounded-b-[20px]">
        
        {/* State: Initial "Open Camera" Screen */}
        {!isCameraMode && !previewUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 bg-zinc-950">
                <button onClick={() => setIsCameraMode(true)} className="group relative">
                    <div className="absolute inset-0 bg-blue-500 blur-[40px] opacity-20 group-hover:opacity-40 transition"/>
                    <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center border border-white/10 shadow-2xl relative z-10 active:scale-95 transition">
                        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
                            <div className="w-3 h-3 bg-white rounded-full"/>
                        </div>
                    </div>
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-widest text-zinc-500">Camera</span>
                </button>

                <label className="flex flex-col items-center gap-3 cursor-pointer group">
                    <div className="w-16 h-16 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center group-active:scale-90 transition">
                        <Upload size={24} className="text-zinc-400"/>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-zinc-600">Upload</span>
                    <input type="file" hidden accept="video/*" onChange={handleGalleryUpload}/>
                </label>
            </div>
        )}

        {/* State: Viewfinder (Live or Preview) */}
        {(isCameraMode || previewUrl) && !isFinalStep && (
            <div className="absolute inset-0">
                {renderViewfinder(!previewUrl)}

                {/* RIGHT SIDEBAR (Essential Icons Only) */}
                {!previewUrl && (
                    <div className="absolute top-20 right-4 flex flex-col gap-6 items-center z-[30]">
                        {/* Flip */}
                        <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="flex flex-col items-center gap-1 group">
                            <div className="p-2.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 group-active:bg-white/20">
                                <RefreshCw size={20} strokeWidth={1.5}/>
                            </div>
                            <span className="text-[9px] font-bold shadow-sm">Flip</span>
                        </button>
                        
                        {/* Filters */}
                        <button onClick={() => setShowFilters(true)} className="flex flex-col items-center gap-1 group">
                            <div className="p-2.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-cyan-400 group-active:bg-cyan-900/40">
                                <Sparkles size={20} strokeWidth={1.5}/>
                            </div>
                            <span className="text-[9px] font-bold shadow-sm">Effects</span>
                        </button>

                        {/* Flash (Toggle) */}
                        <button onClick={() => setFlashOn(!flashOn)} className="flex flex-col items-center gap-1 group">
                            <div className={`p-2.5 backdrop-blur-md rounded-full border border-white/10 transition-colors ${flashOn ? 'bg-yellow-500/80 text-black' : 'bg-black/20 text-white'}`}>
                                <Zap size={20} strokeWidth={1.5} fill={flashOn ? "currentColor" : "none"}/>
                            </div>
                            <span className="text-[9px] font-bold shadow-sm">Flash</span>
                        </button>
                    </div>
                )}

                {/* BOTTOM CONTROL BAR */}
                <div className="absolute bottom-0 inset-x-0 pb-10 pt-20 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col items-center gap-6 z-[30]">
                    {!previewUrl ? (
                        <>
                            {/* Timer Selection */}
                            <div className="flex gap-6 mb-2">
                                {[15, 30, 60].map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => setDurationLimit(s)}
                                        className={`text-[11px] font-black transition-colors ${durationLimit === s ? 'text-white bg-white/10 px-3 py-1 rounded-full' : 'text-zinc-500'}`}
                                    >
                                        {s}s
                                    </button>
                                ))}
                            </div>

                            {/* Record Button */}
                            <div className="flex items-center gap-8">
                                {/* Upload Button Left of Record */}
                                <label className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition">
                                    <div className="w-10 h-10 rounded-lg border-2 border-white/20 bg-black/40 flex items-center justify-center">
                                        <Upload size={18}/>
                                    </div>
                                    <span className="text-[9px] font-bold">Upload</span>
                                    <input type="file" hidden accept="video/*" onChange={handleGalleryUpload}/>
                                </label>

                                {/* Main Shutter */}
                                <button 
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`rounded-full border-[5px] flex items-center justify-center transition-all duration-300 ${
                                        isRecording 
                                        ? 'w-20 h-20 border-red-500/30' 
                                        : 'w-20 h-20 border-white/30'
                                    }`}
                                >
                                    <div className={`bg-red-500 transition-all duration-200 ${
                                        isRecording ? 'w-8 h-8 rounded-md animate-pulse' : 'w-16 h-16 rounded-full'
                                    }`}/>
                                </button>
                                
                                {/* Placeholder for balance (can be templates) */}
                                <div className="w-10 opacity-0"></div>
                            </div>
                            
                            {isRecording && <div className="text-[10px] font-bold mt-2 text-red-500 animate-pulse">{timer}s Remaining</div>}
                        </>
                    ) : (
                        /* Preview Actions (Discard / Next) */
                        <div className="flex items-center justify-between w-full px-12 animate-in slide-in-from-bottom-10">
                            <button 
                                onClick={() => { setPreviewUrl(''); setIsCameraMode(true); }}
                                className="flex flex-col items-center gap-2 group"
                            >
                                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 group-active:scale-90 transition">
                                    <X size={20}/>
                                </div>
                                <span className="text-[10px] font-bold uppercase">Reshoot</span>
                            </button>

                            <button 
                                onClick={() => setIsFinalStep(true)}
                                className="flex items-center gap-2 bg-red-600 px-8 py-3.5 rounded-full font-black text-xs uppercase shadow-lg shadow-red-600/20 active:scale-95 transition"
                            >
                                Next <ChevronRight size={16}/>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* State: Final Publishing Screen */}
        {isFinalStep && (
            <div className="absolute inset-0 bg-zinc-950 z-[50] flex flex-col animate-in slide-in-from-right">
                {/* Header */}
                <div className="p-6 flex items-center gap-4 border-b border-white/5">
                    <button onClick={() => setIsFinalStep(false)} className="p-2"><ArrowLeft size={24}/></button>
                    <h2 className="text-lg font-black uppercase italic tracking-tighter">Post Video</h2>
                </div>

                <div className="p-6 flex gap-4">
                    {/* Thumbnail Preview */}
                    <div className="w-28 h-40 bg-zinc-900 rounded-lg overflow-hidden border border-white/10 shrink-0">
                         {/* Re-use renderer for thumbnail fidelity */}
                         {renderViewfinder(false)}
                    </div>
                    
                    {/* Caption Input */}
                    <div className="flex-1">
                        <textarea 
                            value={caption}
                            onChange={e => setCaption(e.target.value)}
                            placeholder="Describe your video... #Hashtags"
                            className="w-full h-full bg-transparent outline-none text-sm font-medium resize-none placeholder:text-zinc-600"
                        />
                    </div>
                </div>

                {/* Progress Bar */}
                {isUploading && (
                    <div className="px-6 py-4">
                        <div className="flex justify-between text-[10px] font-bold uppercase mb-2 text-blue-400">
                            <span>{statusText}</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-300" 
                                style={{width: `${uploadProgress}%`}}
                            />
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="mt-auto p-6 border-t border-white/5 space-y-4">
                    <div className="flex items-center gap-3 text-zinc-500">
                        <ShieldCheck size={16}/>
                        <span className="text-[10px] uppercase font-bold">Community Guidelines Apply</span>
                    </div>
                    <button 
                        onClick={handlePublish}
                        disabled={isUploading}
                        className="w-full bg-red-600 py-4 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                        {isUploading ? "Uploading..." : "Post Now"}
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* -------------------------------------
         OVERLAYS (Filters & Music)
         ------------------------------------- */}

      {/* 1. FILTER DRAWER (Bottom Sheet) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-900 z-[100] rounded-t-3xl border-t border-white/10 animate-in slide-in-from-bottom duration-300">
            <div className="p-4 flex justify-between items-center border-b border-white/5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">Filters</span>
                <button onClick={() => setShowFilters(false)} className="p-1"><X size={18}/></button>
            </div>
            <div className="p-4 overflow-x-auto no-scrollbar flex gap-3 pb-8">
                {Object.keys(FILTERS_DATA).map((key) => (
                    <button 
                        key={key}
                        onClick={() => setActiveFilter(key)}
                        className="flex flex-col items-center gap-2 min-w-[60px] group"
                    >
                        <div className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${activeFilter === key ? 'border-red-500 scale-110' : 'border-transparent opacity-60'}`}>
                            <img 
                                src={FILTERS_DATA[key].thumb} 
                                className="w-full h-full object-cover" 
                                style={{filter: FILTERS_DATA[key].style}}
                            />
                        </div>
                        <span className={`text-[9px] font-bold uppercase ${activeFilter === key ? 'text-white' : 'text-zinc-600'}`}>
                            {FILTERS_DATA[key].name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
      )}

      {/* 2. MUSIC SHEET (Full Screen) */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[150] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="p-6 flex items-center gap-4">
                <button onClick={() => { setShowMusic(false); audioRef.current?.pause(); setAudioPlayId(null); }}><X size={24}/></button>
                <div className="flex-1 bg-zinc-900 rounded-full flex items-center px-4 py-3 border border-white/5">
                    <Search size={16} className="text-zinc-500"/>
                    <input 
                        className="bg-transparent flex-1 ml-3 text-sm font-bold outline-none placeholder:text-zinc-600"
                        placeholder="Search sounds..."
                        value={musicQuery}
                        onChange={e => setMusicQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredMusic.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition">
                        <div className="flex items-center gap-4 flex-1" onClick={() => {
                             if (audioRef.current) {
                                 if (audioPlayId === m.id) { audioRef.current.pause(); setAudioPlayId(null); }
                                 else { audioRef.current.src = m.audio_url; audioRef.current.play(); setAudioPlayId(m.id); }
                             }
                        }}>
                            <div className="w-10 h-10 bg-zinc-800 rounded-md flex items-center justify-center relative">
                                {audioPlayId === m.id ? <Pause size={16} className="text-red-500"/> : <Play size={16}/>}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold truncate max-w-[200px]">{m.title}</h4>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold">{m.artist}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => { setActiveMusic(m); setShowMusic(false); }}
                            className="px-4 py-1.5 bg-red-600 rounded-full text-[10px] font-bold uppercase"
                        >
                            Use
                        </button>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Audio Element for Music */}
      <audio ref={audioRef} hidden onEnded={() => setAudioPlayId(null)}/>

      {/* Utility Styles */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
} 
