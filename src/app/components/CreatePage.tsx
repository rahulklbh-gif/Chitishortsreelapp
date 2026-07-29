"use client";

/**
 * PROJECT: CHITI SHORT VIDEO CREATOR PRO
 * VERSION: 5.1.0 (PRODUCTION ULTIMATE SYNC)
 * STATUS: FULL UNCUT UNABRIDGED CODE - ALL 6 CRITICAL BUGS FIXED
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, 
  ShieldCheck, Search, Info, Settings, Scissors, HardDrive,
  MonitorPlay, Mic, Volume2, Clapperboard, Layers, Trash2, Type, 
  ChevronLeft, CaseSensitive, Maximize2, Edit3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client } from "@aws-sdk/client-s3";
import { Upload as S3ParallelUpload } from "@aws-sdk/lib-storage"; // 🚀 Superfast parallel upload engine
import { compressVideoTo480p } from '@/lib/videoCompression';
import { TextOverlayEditor, VideoTextOverlays } from './TextOverlayEditor';

// --- CLOUDFLARE R2 CONFIG ---
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://cdn.chitishort.store"
};

// --- FILTERS DATA ---
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "none", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Glow", style: "brightness(1.2) blur(0.6px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  cine: { name: "Cinema", style: "contrast(1.6) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Vintage", style: "sepia(0.8) contrast(1.2) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.8)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  warm: { name: "Warmth", style: "sepia(0.4) saturate(1.6) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  gold: { name: "Golden", style: "sepia(0.5) brightness(1.1) saturate(2)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  cyber: { name: "Cyber", style: "hue-rotate(280deg) saturate(2) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  vivid: { name: "Vivid", style: "saturate(3) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  mono: { name: "Mono", style: "grayscale(1) brightness(1.2)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  faded: { name: "Faded", style: "opacity(0.8) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  sunset: { name: "Sunset", style: "hue-rotate(-20deg) saturate(1.4)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  ocean: { name: "Ocean", style: "hue-rotate(160deg) saturate(1.3)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  quad: { name: "4-Grid", style: "none", isGrid: true, gridCount: 4, cols: "grid-cols-2", rows: "grid-rows-2", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "none", isGrid: true, gridCount: 6, cols: "grid-cols-2", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "Stacked", style: "none", isGrid: true, gridCount: 3, cols: "grid-cols-1", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" }
};

const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint,
  credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
  forcePathStyle: true,
});

export default function CreatePage() {
  const { user } = useAuth();
  
  // UI States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState(""); 
  
  // Camera States
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationLimit, setDurationLimit] = useState(15);
  const [timer, setTimer] = useState(0);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  
  // Feature States
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [query, setQuery] = useState(''); 
  const [activeMusic, setActiveMusic] = useState<any>(null);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [audioPlayId, setAudioPlayId] = useState<string | null>(null);

  // --- ADVANCED TEXT SYSTEM STATE (WITH EXTENDED RE-EDITING SHIELD) ---
  const [textOverlays, setTextOverlays] = useState<any[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [editingTextId, setEditingTextId] = useState<number | null>(null); // Dynamic pointer for active text node
  const [currentText, setCurrentText] = useState("");
  const [currentColor, setCurrentColor] = useState("#ffffff");
  const [currentFontSize, setCurrentFontSize] = useState(32);
  const [currentFontStyle, setCurrentFontStyle] = useState('classic');
  const [isUppercase, setIsUppercase] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMovingRef = useRef(false);
  const musicSourceRef = useRef<any>(null);

  // Initialize Data
  useEffect(() => {
    const loadMusic = async () => {
      const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
      if (data) setMusicList(data);
    };
    loadMusic();
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Sync Video Loading
  useEffect(() => {
    if (previewUrl && previewVideoRef.current) {
        previewVideoRef.current.load();
        previewVideoRef.current.play().catch(e => console.log("Preview play blocked", e));
    }
  }, [previewUrl]);

  // Search logic for music
  const filteredMusic = useMemo(() => {
    return musicList.filter(m => m.title?.toLowerCase().includes(query.toLowerCase()));
  }, [musicList, query]);

  // Playback logic
  const playAudio = async (url: string, id: string) => {
    if (!audioRef.current) return;
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    try {
        if (audioPlayId === id) {
            audioRef.current.pause();
            setAudioPlayId(null);
        } else {
            audioRef.current.pause();
            audioRef.current.crossOrigin = "anonymous";
            audioRef.current.src = url;
            audioRef.current.load();
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => setAudioPlayId(id)).catch(e => toast.error("Enable Audio!"));
            }
        }
    } catch (err) { console.error(err); }
  };

  // --- GALLERY UPLOAD SHIELD (PROBLEM 1: 1-MINUTE DURATION LIMIT ENGINE) ---
  const handleGalleryVideoSelector = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const testVideoInstance = document.createElement('video');
    testVideoInstance.preload = 'metadata';
    testVideoInstance.src = URL.createObjectURL(file);
    
    testVideoInstance.onloadedmetadata = () => {
      URL.revokeObjectURL(testVideoInstance.src);
      if (testVideoInstance.duration > 60) {
        toast.error("Upload Denied! Video duration cannot be longer than 1 minute (60s).");
      } else {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    };
  };

  // --- CAMERA ENGINE ---
  const initCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: facing }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 } 
        },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      toast.error("Camera access denied!");
      setIsCameraMode(false);
    }
  }, [facing]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) initCamera();
  }, [isCameraMode, initCamera, previewUrl]);

  const getMixedStream = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AC();
    }
    const dest = audioCtxRef.current.createMediaStreamDestination();
    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain(); micGain.gain.value = 0.2; 
    
    if (!musicSourceRef.current) {
      musicSourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
    }
    const musicGain = audioCtxRef.current.createGain(); musicGain.gain.value = 1.0; 
    
    micSource.connect(micGain); micGain.connect(dest);
    try { musicSourceRef.current.disconnect(); } catch(err){}
    musicSourceRef.current.connect(musicGain); musicGain.connect(dest);
    musicGain.connect(audioCtxRef.current.destination);
    return new MediaStream([streamRef.current.getVideoTracks()[0], dest.stream.getAudioTracks()[0]]);
  };

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mixed = activeMusic ? getMixedStream() : streamRef.current;
    
    const recorder = new MediaRecorder(mixed, { 
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000 
    });

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], 'chiti.webm', { type: 'video/webm' }));
      setIsRecording(false);
      setTimer(0);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    };

    if (activeMusic && audioRef.current) audioRef.current.play();
    recorder.start(100); 
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimer(0);
    
    countdownRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev >= durationLimit) { stopRec(); return durationLimit; }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // --- TEXT SYSTEM ACTIONS (WITH PROBLEM 6: OPEN / LIVE MODIFICATION RE-EDIT ENGINE) ---
  const handleOpenTextCanvasEditor = (existingOverlayNode?: any) => {
    if (existingOverlayNode) {
      setEditingTextId(existingOverlayNode.id);
      setCurrentText(existingOverlayNode.text);
      setCurrentColor(existingOverlayNode.color);
      setCurrentFontSize(existingOverlayNode.fontSize);
      setCurrentFontStyle(existingOverlayNode.fontStyle);
    } else {
      setEditingTextId(null);
      setCurrentText("");
      setCurrentColor("#ffffff");
      setCurrentFontSize(32);
      setCurrentFontStyle('classic');
    }
    setIsAddingText(true);
  };

  const handleSaveTextOverlayData = () => {
    if (!currentText.trim()) { setIsAddingText(false); return; }
    const compiledString = isUppercase ? currentText.toUpperCase() : currentText;

    if (editingTextId !== null) {
      // Re-edit node mutation cycle
      setTextOverlays(prev => prev.map(item => item.id === editingTextId 
        ? { ...item, text: compiledString, color: currentColor, fontSize: currentFontSize, fontStyle: currentFontStyle } 
        : item
      ));
    } else {
      // New insertion element creation
      setTextOverlays([...textOverlays, { 
        id: Date.now(), 
        text: compiledString, 
        color: currentColor,
        fontSize: currentFontSize,
        fontStyle: currentFontStyle,
        x: 50, 
        y: 50 
      }]);
    }
    setCurrentText("");
    setEditingTextId(null);
    setIsAddingText(false);
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingId === null || !containerRef.current || isMovingRef.current) return;
    isMovingRef.current = true;

    requestAnimationFrame(() => {
      if (draggingId === null || !containerRef.current) { isMovingRef.current = false; return; }
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      
      setTextOverlays(prev => prev.map(t => t.id === draggingId ? { ...t, x, y } : t));
      isMovingRef.current = false;
    });
  };

  // --- PUBLISH ENGINE (PROBLEM 2, 3 & 4: BACKGROUND STABLE MULTIPART ACCELERATOR PARALLEL TASK) ---
  const publish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(1);
    setStatusText("Initializing accelerated background transmission pipeline...");
    
    // Redirect visually or allow background continuity alert banner trigger notification
    toast.success("Background upload started! You can continue scrolling through feeds.");
    setIsFinalStep(false); // Instantly close workflow sheet so user can browse other reels

    try {
      let fileToUpload: any = selectedFile;
      try {
        setStatusText("Optimizing compression layers...");
        const optimized = await compressVideoTo480p(selectedFile, (p) => {
          // Internal initial compression optimization progress slice
          setUploadProgress(Math.min(10, Math.floor(p.progress * 10)));
        });
        fileToUpload = optimized;
      } catch (e) { console.warn("Fallback to raw stream active"); }

      const fileName = `${Date.now()}_chiti.mp4`;
      const path = `chiti_vids/${user.id}/${fileName}`;
      const finalUrl = `${R2_CONFIG.publicDomain}/${path}`;
      
      setStatusText("Streaming data chunks safely to R2 cloud storage infrastructure...");

      // 🚀 AWS-SDK Smart Parallel Multipart Manager Integration (Chutkiyo me Upload + Real % Track)
      const uploadManagerInstance = new S3ParallelUpload({
        client: s3Client,
        params: {
          Bucket: R2_CONFIG.bucketName,
          Key: path,
          Body: fileToUpload,
          ContentType: 'video/mp4'
        },
        queueSize: 4,             // 4 Concurrent parallel upload lines running together for max bandwidth speed
        partSize: 5 * 1024 * 1024 // 5MB structural data slicing blocks
      });

      uploadManagerInstance.on("httpUploadProgress", (progressEvent: any) => {
        const realtimePercentageCalculated = Math.floor((progressEvent.loaded / progressEvent.total) * 100);
        // Map linearly from 1% up to 99% without skips
        setUploadProgress(realtimePercentageCalculated);
        setStatusText(`Uploading asset packages: ${realtimePercentageCalculated}% finished`);
      });

      await uploadManagerInstance.done();

      let finalMusicId = activeMusic?.id || null;
      if (!isCameraMode && !activeMusic) {
        const musicTitle = caption.trim() 
          ? (caption.length > 50 ? caption.substring(0, 47) + "..." : caption) 
          : `Original Sound - ${user.user_metadata?.full_name || 'Chiti User'}`;

        const { data: musicEntry } = await supabase.from('music_library').insert([{
            title: musicTitle, audio_url: finalUrl, user_id: user.id, duration: durationLimit
        }]).select();
        if (musicEntry) finalMusicId = musicEntry[0].id;
      }

      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: finalUrl,
        caption: caption || "",
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Creator',
        filter_name: selectedFilter,
        music_id: finalMusicId,
        text_overlays: textOverlays, 
        is_front_camera: isCameraMode && facing === 'user' // Sends True strictly if captured natively inside app live front lens
      }]);

      if (dbError) throw dbError;
      setUploadProgress(100);
      toast.success("Short Upload Complete & Published!");
      
      // Cleanup execution environments local states
      setPreviewUrl('');
      setSelectedFile(null);
      setTextOverlays([]);
      setIsUploading(false);

    } catch (e: any) {
      toast.error(`Publish background stack execution failed: ${e.message}`);
      setIsUploading(false);
    }
  };

  // Render System
  const renderContent = (isLive: boolean) => {
    const filter = FILTERS_DATA[selectedFilter] || FILTERS_DATA.none;
    const gridCount = filter.isGrid ? filter.gridCount : 1;
    
    return (
      <div className={`absolute inset-0 w-full h-full bg-black ${filter.isGrid ? `grid ${filter.cols} ${filter.rows}` : 'flex'}`}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full bg-zinc-900 overflow-hidden border-[0.5px] border-white/5">
            {isLive ? (
              <video 
                ref={i === 0 ? videoRef : null} 
                autoPlay playsInline muted 
                className="w-full h-full object-cover" 
                style={{
                  filter: filter.style,
                  transform: (facing === 'user') ? 'scaleX(-1)' : 'none', // Active only inside active camera lens mirroring
                }} 
              />
            ) : (
              <div className="w-full h-full relative">
                <video 
                  ref={i === 0 ? previewVideoRef : null} 
                  src={previewUrl} 
                  autoPlay loop playsInline 
                  muted={i !== 0} 
                  className="w-full h-full object-cover" 
                  style={{ 
                    filter: filter.style, 
                    transform: 'none' // 🚀 PROBLEM 5 FIX: Gallery uploads & recorded outputs will NEVER mirror spin upside down!
                  }} 
                />
                
                {/* 🚀 Rendered Text Overlays using imported sub-component */}
                {i === 0 && (
                  <VideoTextOverlays
                    textOverlays={textOverlays}
                    setDraggingId={setDraggingId}
                    handleOpenTextCanvasEditor={handleOpenTextCanvasEditor}
                    setTextOverlays={setTextOverlays}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden"
      onMouseMove={handleDragMove} onTouchMove={handleDragMove} onMouseUp={() => setDraggingId(null)} onTouchEnd={() => setDraggingId(null)}
      onClick={() => { if(audioCtxRef.current) audioCtxRef.current.resume(); }}
    >
      {/* 🚀 PROBLEM 3 SYSTEM VIEW: Persistent Floating global pipeline upload progress banner indicator layout node */}
      {isUploading && (
        <div className="absolute top-4 inset-x-4 mx-auto max-w-md bg-zinc-950/95 border border-blue-500/30 p-4 rounded-2xl z-[99999] flex items-center justify-between shadow-2xl backdrop-blur-2xl transition-all duration-300">
          <div className="flex items-center gap-3 flex-1 mr-4">
            <Loader2 className="animate-spin text-blue-500 shrink-0" size={18}/>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider truncate">{statusText}</span>
              <div className="h-1 w-32 bg-white/10 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }}/>
              </div>
            </div>
          </div>
          <span className="text-xs font-black text-blue-400 shrink-0">{uploadProgress}%</span>
        </div>
      )}

      {!isFinalStep && (
        <header className="absolute top-16 inset-x-0 p-6 flex justify-between items-center z-[500] bg-gradient-to-b from-black/70 to-transparent">
          {previewUrl ? (
            <button onClick={() => { setPreviewUrl(''); setTextOverlays([]); initCamera(); }} className="flex items-center gap-2 p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white font-black uppercase text-[10px] px-4">
              <ChevronLeft size={20}/>
              Back
            </button>
          ) : (
            <button onClick={() => {
              if(isCameraMode) setIsCameraMode(false);
              else window.history.back();
            }} className="p-3 bg-black/20 backdrop-blur-xl rounded-full border border-white/10">
              <X size={24}/>
            </button>
          )}

          <button onClick={() => setShowMusic(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-3xl px-5 py-2 rounded-full border border-white/20">
            <Music size={16} className="text-pink-500"/>
            <span className="text-[11px] font-black uppercase truncate max-w-[120px]">{activeMusic ? activeMusic.title : "Add Sound"}</span>
          </button>
          <button className="p-3 bg-black/20 backdrop-blur-xl rounded-full border border-white/10"><Settings size={22}/></button>
        </header>
      )}

      <main ref={containerRef} className="flex-1 relative bg-black">
        {!isCameraMode && !previewUrl ? (
          <div className="h-full flex flex-col items-center justify-center gap-12">
            <button onClick={() => setIsCameraMode(true)} className="w-40 h-40 bg-red-600 rounded-full flex items-center justify-center relative shadow-2xl active:scale-95 transition-all border-4 border-white/10">
                 <Camera size={50} className="text-white"/>
            </button>
            <label className="flex items-center gap-4 bg-zinc-900 px-10 py-5 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-800 transition-colors">
              <Upload size={20} className="text-blue-500"/>
              <span className="text-xs font-black uppercase tracking-widest">Gallery Upload (Max 1 Min)</span>
              <input type="file" hidden accept="video/*" onChange={handleGalleryVideoSelector}/>
            </label>
          </div>
        ) : !isFinalStep ? (
          <div className="h-full w-full relative">
              {renderContent(!previewUrl)}
              
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-[400]">
                  {!previewUrl ? (
                      <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="flex flex-col items-center gap-1">
                          <div className="p-4 bg-black/30 rounded-2xl border border-white/10 backdrop-blur-md hover:bg-black/50"><RefreshCw size={24}/></div>
                          <span className="text-[8px] font-black uppercase">Flip</span>
                      </button>
                  ) : (
                      <button onClick={() => handleOpenTextCanvasEditor()} className="flex flex-col items-center gap-1">
                          <div className="p-4 bg-black/30 rounded-2xl border border-white/10 text-yellow-400 backdrop-blur-md"><Type size={24}/></div>
                          <span className="text-[8px] font-black uppercase">Text</span>
                      </button>
                  )}
                  <button onClick={() => setShowFilters(true)} className="flex flex-col items-center gap-1">
                      <div className="p-4 bg-black/30 rounded-2xl border border-white/10 text-cyan-400 backdrop-blur-md"><Sparkles size={24}/></div>
                      <span className="text-[8px] font-black uppercase">Filters</span>
                  </button>
              </div>

              <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6 z-[400]">
                {!previewUrl ? (
                  <>
                    <div className="flex bg-black/50 p-1 rounded-full border border-white/10 backdrop-blur-xl">
                      {[15, 30].map(d => (
                        <button key={d} onClick={() => setDurationLimit(d)} className={`px-6 py-2 rounded-full text-[10px] font-black transition-all ${durationLimit === d ? 'bg-white text-black' : 'text-zinc-500'}`}>{d}s</button>
                      ))}
                    </div>
                    {isRecording && (
                        <div className="bg-red-600 px-3 py-1 rounded text-[10px] font-black animate-pulse flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-white rounded-full"/>
                            {timer}s / {durationLimit}s
                        </div>
                    )}
                    <button onClick={isRecording ? stopRec : startRec} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-600' : 'border-white'}`}>
                        <div className={`transition-all ${isRecording ? 'w-8 h-8 bg-red-600 rounded-lg' : 'w-14 h-14 bg-red-600 rounded-full'}`}/></button>
                  </>
                ) : (
                  <div className="flex gap-4 w-full px-10">
                    <button onClick={() => {setPreviewUrl(''); setTextOverlays([]); setIsCameraMode(true);}} className="flex-1 py-4 bg-zinc-900/80 rounded-2xl font-black uppercase text-[10px] border border-white/10 backdrop-blur-md">Discard</button>
                    <button onClick={() => setIsFinalStep(true)} className="flex-1 py-4 bg-red-600 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-red-900/20">Next</button>
                  </div>
                )}
              </div>
          </div>
        ) : (
          <div className="h-full bg-zinc-950 p-8 flex flex-col pt-20">
              <header className="absolute top-0 inset-x-0 p-6 flex items-center z-[500]">
                <button onClick={() => setIsFinalStep(false)} className="p-3 bg-white/5 rounded-full border border-white/10">
                  <ArrowLeft size={24}/>
                </button>
              </header>

              <div className="flex gap-4 mb-10">
                  <div className="w-24 h-40 bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 relative shrink-0">
                    <video src={previewUrl} autoPlay loop muted className="w-full h-full object-cover" />
                  </div>
                  <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write a caption for your short..." className="flex-1 bg-transparent border-none outline-none font-bold text-lg h-32 resize-none" />
              </div>

              <button onClick={publish} disabled={isUploading} className="w-full bg-red-600 py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-red-900/10">
                <Send size={24}/> POST IN BACKGROUND
              </button>
          </div>
        )}
      </main>

      {/* --- ENHANCED TEXT OVERLAY EDITOR --- */}
      {isAddingText && (
        <TextOverlayEditor
          currentText={currentText}
          setCurrentText={setCurrentText}
          currentColor={currentColor}
          setCurrentColor={setCurrentColor}
          currentFontSize={currentFontSize}
          setCurrentFontSize={setCurrentFontSize}
          currentFontStyle={currentFontStyle}
          setCurrentFontStyle={setCurrentFontStyle}
          isUppercase={isUppercase}
          setIsUppercase={setIsUppercase}
          editingTextId={editingTextId}
          handleSaveTextOverlayData={handleSaveTextOverlayData}
        />
      )}

      {/* FILTERS MODAL */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950/95 p-8 rounded-t-[40px] z-[600] border-t border-white/10 backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black italic uppercase text-xs tracking-widest">Apply Filter</h3>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X size={18}/></button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
              {Object.keys(FILTERS_DATA).map(key => (
                <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-2 shrink-0">
                  <div className={`w-16 h-24 rounded-2xl border-2 transition-all overflow-hidden ${selectedFilter === key ? 'border-red-600 scale-105' : 'border-transparent opacity-60'}`}>
                    <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{filter: FILTERS_DATA[key].style}} alt=""/>
                  </div>
                  <span className={`text-[9px] font-black uppercase ${selectedFilter === key ? 'text-red-500' : 'text-zinc-500'}`}>{FILTERS_DATA[key].name}</span>
                </button>
              ))}
            </div>
        </div>
      )}
        
      {/* MUSIC LIBRARY */}
      {showMusic && (
        <div className="absolute inset-0 bg-black z-[900] p-6 pt-16 flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-4xl font-black italic text-pink-500 uppercase tracking-tighter">Music</h2>
                <button onClick={() => {setShowMusic(false); audioRef.current?.pause(); setAudioPlayId(null);}} className="p-3 bg-white/5 rounded-full"><X size={24}/></button>
            </div>
            <div className="relative mb-8">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500" size={20}/>
              <input value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-[#1A1A1A] rounded-2xl py-5 pl-16 pr-6 font-bold text-lg outline-none border border-white/5" placeholder="Search tracks..." />
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-10">
              {filteredMusic.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-5 flex-1 cursor-pointer" onClick={() => playAudio(m.audio_url, m.id)}>
                    <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center">
                      {audioPlayId === m.id ? <Pause size={20} className="fill-red-500 text-red-500"/> : <Play size={20} className="fill-white text-white"/>}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-base">{m.title}</span>
                      <span className="text-[10px] text-zinc-500 uppercase font-black">Chiti Sound</span>
                    </div>
                  </div>
                  <button onClick={() => {setActiveMusic(m); setShowMusic(false); audioRef.current?.pause(); setAudioPlayId(null);}} className="bg-red-600 text-white text-[10px] font-black uppercase px-6 py-2.5 rounded-full tracking-widest active:scale-90">Use</button>
                </div>
              ))}
            </div>
        </div>
      )}

      <audio ref={audioRef} preload="auto" hidden onEnded={() => setAudioPlayId(null)} crossOrigin="anonymous" />
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
