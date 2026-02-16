"use client";

/**
 * CREATOR PAGE - CHITI SHORT VIDEO PLATFORM
 * Features: 
 * - 20+ Pro Filters & Multi-Grid Layouts
 * - 20% Mic + 100% Music Audio Mixing Engine
 * - Mirroring Fix (Live vs Preview)
 * - Cloudflare R2 + Supabase Integration
 * - Video Compression (480p Optimization)
 */

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft, 
  ShieldCheck, Search, Info, Settings, Scissors
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressVideoTo480p } from '@/lib/videoCompression'; 

// --- Configuration Constants ---
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

// --- Filters & Grids Database ---
// In-depth filter configurations for cinema-quality output
const FILTERS_DATA: any = {
  none: { name: "Natural", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal Glow", style: "brightness(1.4) contrast(1.1) saturate(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel White", style: "brightness(1.6) saturate(1.2) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  ivory: { name: "Ivory", style: "brightness(1.3) sepia(0.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" },
  soft: { name: "Soft Skin", style: "brightness(1.2) blur(0.6px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  cine: { name: "CineMax", style: "contrast(1.6) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100" },
  teal: { name: "Teal&Orange", style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
  retro: { name: "Vintage 1990", style: "sepia(0.8) contrast(1.2) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "B&W Noir", style: "grayscale(1) contrast(1.8)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  warm: { name: "Golden Hour", style: "sepia(0.4) saturate(1.6) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  gold: { name: "Royal Gold", style: "sepia(0.5) brightness(1.1) saturate(2)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  cyber: { name: "Cyberpunk", style: "hue-rotate(280deg) saturate(2) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  dream: { name: "Dreamy", style: "blur(1.5px) brightness(1.2) saturate(1.4)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  vivid: { name: "Ultra Vivid", style: "saturate(3) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100" },
  ocean: { name: "Deep Ocean", style: "hue-rotate(180deg) brightness(1.1) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  mono: { name: "Mono Chrome", style: "grayscale(1) brightness(1.1) contrast(1.3)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  quad: { name: "4-Grid Layout", style: "", isGrid: true, gridCount: 4, cols: "grid-cols-2", rows: "grid-rows-2", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid Layout", style: "", isGrid: true, gridCount: 6, cols: "grid-cols-2", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" },
  triple: { name: "3-Column Stack", style: "", isGrid: true, gridCount: 3, cols: "grid-cols-1", rows: "grid-rows-3", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  storm: { name: "Lightning", style: "contrast(1.5) brightness(1.2) saturate(0.5)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" }
};

// --- S3 Client Initialization ---
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
  
  // --- Detailed State Management ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionStatus, setCompressionStatus] = useState(""); 
  
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

  // --- Component Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- Initialization Logic ---
  useEffect(() => {
    const fetchMusic = async () => {
      try {
        const { data, error } = await supabase
          .from('music_library')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setMusicList(data);
      } catch (err) {
        console.error("Music Fetch Error:", err);
      }
    };
    fetchMusic();

    return () => {
      // Cleanup on unmount
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const filteredMusic = useMemo(() => {
    return musicList.filter(m => 
      m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.artist?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [musicList, searchQuery]);

  // --- Camera & Stream Management ---
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      
      const constraints = {
        video: { 
          facingMode: { ideal: facingMode }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      toast.error("Camera access denied or device not found.");
      setIsCameraMode(false);
    }
  }, [facingMode]);

  useEffect(() => {
    if (isCameraMode && !previewUrl) {
      startCamera();
    }
  }, [isCameraMode, startCamera, previewUrl]);

  // --- Professional Audio Mixing Engine (Mic 20% Fix) ---
  const createMixedStream = () => {
    if (!streamRef.current || !audioRef.current) return streamRef.current;

    // Reset Audio Context to prevent duplicate playback or overlaps
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContext();
    const dest = audioCtxRef.current.createMediaStreamDestination();

    // MIC NODE: Set to 20% volume as requested
    const micSource = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    const micGain = audioCtxRef.current.createGain();
    micGain.gain.value = 0.2; 

    // MUSIC NODE: 100% volume
    const musicSource = audioCtxRef.current.createMediaElementSource(audioRef.current);
    const musicGain = audioCtxRef.current.createGain();
    musicGain.gain.value = 1.0;

    // Connect everything to the destination
    micSource.connect(micGain);
    micGain.connect(dest);
    
    musicSource.connect(musicGain);
    musicGain.connect(dest);
    
    // Also connect music to speakers so user can hear it while recording
    musicGain.connect(audioCtxRef.current.destination);

    const videoTrack = streamRef.current.getVideoTracks()[0];
    const mixedAudioTrack = dest.stream.getAudioTracks()[0];
    
    return new MediaStream([videoTrack, mixedAudioTrack]);
  };

  // --- Recording Logic ---
  const handleStartRecording = async () => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    const recordingStream = selectedMusic ? createMixedStream() : streamRef.current;

    const options = { mimeType: 'video/webm;codecs=vp8,opus' };
    const recorder = new MediaRecorder(recordingStream, options);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // Black Preview Fix: Reset stream ref
      if (videoRef.current) videoRef.current.srcObject = null;
      
      setPreviewUrl(url);
      setSelectedFile(new File([blob], `chiti_${Date.now()}.webm`, { type: 'video/webm' }));
      setIsRecording(false);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };

    // Start audio if selected
    if (selectedMusic && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordLimit);

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

  // --- Gallery & File Logic ---
  const handleGalleryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error("Please select a valid video file.");
      return;
    }

    const videoElement = document.createElement('video');
    videoElement.src = URL.createObjectURL(file);
    videoElement.onloadedmetadata = () => {
      if (videoElement.duration > 31) {
        toast.error("Video too long! Max 30 seconds allowed.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(videoElement.src);
      setIsCameraMode(false);
    };
  };

  // --- Music Playback UI Support ---
  const toggleMusicPreview = (music: any) => {
    if (!audioRef.current) return;

    if (playingMusicId === music.id) {
      audioRef.current.pause();
      setPlayingMusicId(null);
    } else {
      audioRef.current.src = music.audio_url;
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.play()
        .then(() => setPlayingMusicId(music.id))
        .catch(() => toast.error("Wait... Audio loading."));
    }
  };

  // --- Final Publish Integration ---
  const handleFinalPublish = async () => {
    if (!selectedFile || !user) {
      toast.error("Session expired or no file selected.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setCompressionStatus("Analysing Video...");

    try {
      // Step 1: Compress to 480p (Native Optimization)
      const optimizedBlob = await compressVideoTo480p(selectedFile, (progressData) => {
        setUploadProgress(10 + Math.floor(progressData.progress * 60));
        setCompressionStatus(progressData.message);
      });

      // Step 2: R2 Upload
      const timestamp = Date.now();
      const path = `shorts/${user.id}/${timestamp}.mp4`;
      
      setCompressionStatus("Uploading to Chiti Cloud...");
      const arrayBuffer = await optimizedBlob.arrayBuffer();
      
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: path,
        Body: new Uint8Array(arrayBuffer),
        ContentType: 'video/mp4',
      }));

      const publicUrl = `${R2_CONFIG.publicDomain}/${path}`;

      // Step 3: Database Sync
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: publicUrl,
        caption: caption || "",
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Anonymous Creator',
        user_image: user.user_metadata?.avatar_url || null,
        filter_name: selectedFilter,
        music_id: selectedMusic?.id || null,
        created_at: new Date().toISOString()
      }]);

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success("Short Uploaded Successfully!");
      setTimeout(() => window.location.href = '/', 1200);

    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // --- Dynamic Renderer (Fixed Mirroring & Grids) ---
  const renderVisualContent = (isLive: boolean, source?: string) => {
    const filter = FILTERS_DATA[selectedFilter];
    const gridCount = filter.isGrid ? filter.gridCount : 1;

    return (
      <div 
        className={`h-full w-full bg-black overflow-hidden ${
          filter.isGrid ? `grid ${filter.cols} ${filter.rows} gap-0.5` : 'flex'
        }`}
      >
        {[...Array(gridCount)].map((_, index) => (
          <div key={index} className="relative w-full h-full overflow-hidden bg-zinc-900">
            <video 
              ref={index === 0 && isLive ? videoRef : null}
              src={!isLive ? source : undefined}
              autoPlay 
              playsInline 
              muted={isLive ? (index !== 0) : false} 
              loop
              className="w-full h-full object-cover"
              style={{ 
                filter: filter.style,
                // MIRROR FIX: Only scaleX(-1) if it is LIVE front camera. 
                // Recorded preview should be scaleX(1)
                transform: (isLive && facingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)'
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  // --- Main UI ---
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden font-sans select-none">
      
      {/* 1. HEADER SECTION */}
      {!isFinalStep && (
        <header className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[110] bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <button 
            onClick={() => window.history.back()} 
            className="p-2.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 active:scale-90 transition-transform"
          >
            <X size={26}/>
          </button>

          <button 
            onClick={() => setShowMusic(true)} 
            className="flex items-center gap-3 bg-white/10 backdrop-blur-2xl px-6 py-2.5 rounded-full border border-white/20 hover:bg-white/20 transition-all"
          >
            <Music size={18} className="text-pink-500 animate-pulse"/>
            <span className="text-[12px] font-black uppercase tracking-tighter max-w-[140px] truncate">
              {selectedMusic ? selectedMusic.title : "Pick a Sound"}
            </span>
          </button>

          <button className="p-2.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
            <Settings size={22}/>
          </button>
        </header>
      )}

      {/* 2. CORE VIEWPORT */}
      <main className="flex-1 relative flex flex-col items-center justify-center bg-zinc-950 h-full w-full">
        {!user ? (
          <div className="flex flex-col items-center p-12 text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mb-8">
               <ShieldCheck size={48} className="text-blue-500"/>
            </div>
            <h2 className="text-3xl font-black mb-4 uppercase italic tracking-tighter">Creator Access Only</h2>
            <p className="text-zinc-500 mb-10 text-sm font-medium leading-relaxed">Sign in to share your talent with millions <br/> of people on Chiti.</p>
            <a href="/login" className="bg-blue-600 px-16 py-5 rounded-full font-black uppercase text-sm tracking-widest shadow-2xl shadow-blue-600/40 active:scale-95 transition-all">Log In Now</a>
          </div>
        ) : !isCameraMode && !previewUrl ? (
          <div className="flex flex-col items-center gap-16 animate-in zoom-in-95 duration-500">
            <div className="relative group">
              <div className="absolute -inset-8 bg-blue-600 blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity"/>
              <button 
                onClick={() => setIsCameraMode(true)} 
                className="w-44 h-44 bg-blue-600 rounded-[56px] flex items-center justify-center relative shadow-2xl active:scale-90 transition-all cursor-pointer"
              >
                <Camera size={60} strokeWidth={2.5} className="text-white"/>
              </button>
            </div>
            
            <label className="flex items-center gap-4 bg-zinc-900/80 hover:bg-zinc-800 px-12 py-6 rounded-[32px] border border-white/5 cursor-pointer backdrop-blur-xl transition-all active:scale-95">
              <Upload size={24} className="text-blue-500"/>
              <span className="text-sm font-black uppercase italic tracking-widest">Select from Gallery</span>
              <input type="file" hidden accept="video/*" onChange={handleGalleryInput}/>
            </label>
          </div>
        ) : !isFinalStep ? (
          <div className="relative w-full h-full overflow-hidden">
            {/* The Dynamic Video Feed */}
            <div className="h-full w-full flex items-center justify-center">
               {renderVisualContent(!previewUrl, previewUrl)}
            </div>

            {/* Right Side Sidebar Controls */}
            {!previewUrl && (
              <nav className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-[120]">
                <button 
                  onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} 
                  className="flex flex-col items-center gap-2"
                >
                  <div className="p-4 bg-black/40 rounded-[22px] backdrop-blur-md border border-white/10 active:bg-blue-600/40 transition-colors">
                    <RefreshCw size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter shadow-sm">Flip</span>
                </button>

                <button 
                  onClick={() => setShowFilters(true)} 
                  className="flex flex-col items-center gap-2"
                >
                  <div className="p-4 bg-black/40 rounded-[22px] backdrop-blur-md border border-white/10 text-cyan-400 active:bg-cyan-600/40 transition-colors">
                    <Sparkles size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter shadow-sm">Effects</span>
                </button>

                <button className="flex flex-col items-center gap-2">
                  <div className="p-4 bg-black/40 rounded-[22px] backdrop-blur-md border border-white/10 text-yellow-400">
                    <Zap size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter shadow-sm">Flash</span>
                </button>

                <button className="flex flex-col items-center gap-2">
                  <div className="p-4 bg-black/40 rounded-[22px] backdrop-blur-md border border-white/10 text-white">
                    <Scissors size={26}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter shadow-sm">Trim</span>
                </button>
              </nav>
            )}

            {/* Bottom Capture / Action Buttons */}
            <div className="absolute bottom-0 inset-x-0 p-10 pb-14 flex flex-col items-center gap-10 bg-gradient-to-t from-black via-black/60 to-transparent z-[120]">
              {!previewUrl ? (
                <>
                  <div className="flex bg-black/40 p-1.5 rounded-full border border-white/10 backdrop-blur-2xl">
                      {[15, 30, 60].map(duration => (
                        <button 
                          key={duration} 
                          onClick={() => setRecordLimit(duration)} 
                          className={`px-8 py-2.5 rounded-full text-[11px] font-black transition-all ${recordLimit === duration ? 'bg-white text-black scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          {duration}S
                        </button>
                      ))}
                  </div>

                  <div className="relative flex items-center justify-center">
                     <button 
                        onClick={isRecording ? handleStopRecording : handleStartRecording} 
                        className={`w-24 h-24 rounded-full border-[6px] transition-all duration-500 flex items-center justify-center ${
                          isRecording ? 'border-red-600/20 scale-110' : 'border-white/30 hover:border-white/60'
                        }`}
                      >
                        <div className={`transition-all duration-300 ${
                          isRecording ? 'w-10 h-10 bg-red-600 rounded-[8px] animate-pulse' : 'w-16 h-16 bg-red-600 rounded-full'
                        }`} />
                      </button>
                      {isRecording && (
                        <div className="absolute -top-12 px-4 py-1.5 bg-red-600 rounded-full text-[12px] font-black tracking-widest animate-bounce">
                          {timeLeft}S REMAINING
                        </div>
                      )}
                  </div>
                </>
              ) : (
                <div className="flex gap-5 w-full max-w-md animate-in slide-in-from-bottom duration-500">
                  <button 
                    onClick={() => { setPreviewUrl(''); startCamera(); }} 
                    className="flex-1 py-5 bg-zinc-900/90 rounded-[28px] font-black uppercase tracking-widest text-[12px] border border-white/10 backdrop-blur-md active:scale-95 transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={() => setIsFinalStep(true)} 
                    className="flex-1 py-5 bg-red-600 rounded-[28px] font-black uppercase tracking-widest text-[12px] shadow-2xl shadow-red-600/40 active:scale-95 transition-all"
                  >
                    Next Step
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 3. POST DETAILS SCREEN */
          <div className="h-full w-full bg-zinc-950 flex flex-col p-8 pt-12 animate-in slide-in-from-right duration-500 z-[150]">
            <header className="flex items-center gap-6 mb-12">
              <button onClick={() => setIsFinalStep(false)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
                <ArrowLeft size={32}/>
              </button>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Publish Short</h2>
            </header>

            <div className="flex gap-6 mb-12 items-start bg-zinc-900/30 p-4 rounded-[40px] border border-white/5">
              <div className="w-36 h-56 bg-zinc-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 relative shrink-0">
                {renderVisualContent(false, previewUrl)}
                <div className="absolute inset-0 bg-black/20 pointer-events-none"/>
              </div>
              <div className="flex-1 pt-4">
                 <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)} 
                  placeholder="Tell your story... #trending #chiti" 
                  className="w-full bg-transparent p-0 outline-none font-bold text-lg border-none resize-none h-48 placeholder:text-zinc-700 leading-relaxed" 
                 />
              </div>
            </div>

            {/* Advanced Progress Feedback */}
            {isUploading && (
              <div className="mb-12 space-y-5 px-4 animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-blue-500"/>
                    <span className="text-[12px] font-black uppercase tracking-widest text-blue-500">
                      {compressionStatus}
                    </span>
                  </div>
                  <span className="text-sm font-black text-zinc-400">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,0.4)]" 
                    style={{width: `${uploadProgress}%`}}
                  />
                </div>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-4">
              <div className="flex items-center gap-2 px-6 py-4 bg-zinc-900/50 rounded-3xl border border-white/5 mb-4">
                <Info size={16} className="text-zinc-500"/>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">
                  By posting, you agree to Chiti's Creator Terms.
                </span>
              </div>
              
              <button 
                onClick={handleFinalPublish} 
                disabled={isUploading} 
                className="w-full bg-red-600 py-6 rounded-[32px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 transition-all shadow-2xl shadow-red-600/20 group"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"/>} 
                {isUploading ? "OPTIMIZING..." : "POST NOW"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 4. FILTERS DRAWER (FIXED HEIGHT) */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-950 p-10 pt-12 rounded-t-[50px] z-[200] border-t border-white/10 shadow-[0_-30px_100px_rgba(0,0,0,1)] animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-10 px-2">
            <div>
              <h3 className="text-lg font-black uppercase italic leading-none">Visual Effects</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Swipe to explore styles</p>
            </div>
            <button 
              onClick={() => setShowFilters(false)} 
              className="p-3 bg-white/5 rounded-full border border-white/10 active:scale-75 transition-transform"
            >
              <X size={20}/>
            </button>
          </div>
          
          <div className="flex gap-6 overflow-x-auto no-scrollbar pb-10 px-2 snap-x">
            {Object.keys(FILTERS_DATA).map(key => (
              <button 
                key={key} 
                onClick={() => setSelectedFilter(key)} 
                className="flex flex-col items-center gap-4 min-w-[85px] snap-center group"
              >
                <div className={`w-20 h-28 rounded-[24px] border-4 transition-all duration-300 ${
                  selectedFilter === key 
                  ? 'border-red-600 scale-110 rotate-2 shadow-[0_0_30px_rgba(220,38,38,0.3)]' 
                  : 'border-white/5 opacity-40 group-hover:opacity-100 group-hover:scale-105'
                }`}>
                  <img 
                    src={FILTERS_DATA[key].thumb} 
                    className="w-full h-full object-cover rounded-[18px]" 
                    style={{ filter: FILTERS_DATA[key].style }} 
                    alt={FILTERS_DATA[key].name}
                  />
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

      {/* 5. MUSIC SELECTOR SCREEN (FULL COVER) */}
      {showMusic && (
        <div className="absolute inset-0 bg-zinc-950 z-[300] p-8 pt-20 flex flex-col animate-in slide-in-from-right duration-500">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-4xl font-black italic text-pink-500 uppercase tracking-tighter leading-none">Sounds</h2>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2">Discover your vibe</p>
            </div>
            <button 
              onClick={() => { setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null); }} 
              className="p-4 bg-white/5 rounded-full border border-white/10 active:scale-75 transition-all"
            >
              <X size={28}/>
            </button>
          </div>

          <div className="relative mb-10 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-pink-500 transition-colors" size={24}/>
            <input 
              type="text" 
              placeholder="Search by track, artist or genre..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full bg-zinc-900 border border-white/10 rounded-[30px] py-6 pl-16 pr-8 font-bold outline-none focus:border-pink-500/50 transition-all placeholder:text-zinc-700 text-lg shadow-inner" 
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-32">
            {filteredMusic.length > 0 ? filteredMusic.map(music => (
              <div 
                key={music.id} 
                className={`p-6 rounded-[40px] flex items-center justify-between border transition-all duration-300 ${
                  selectedMusic?.id === music.id 
                  ? 'bg-pink-600/10 border-pink-500/50 shadow-lg shadow-pink-600/5' 
                  : 'bg-zinc-900/40 border-white/5 hover:border-white/20'
                }`}
              >
                <div 
                  className="flex items-center gap-6 flex-1 cursor-pointer" 
                  onClick={() => toggleMusicPreview(music)}
                >
                   <div className="w-16 h-16 rounded-[22px] bg-black/60 flex items-center justify-center relative overflow-hidden shrink-0 shadow-2xl border border-white/5">
                    {playingMusicId === music.id ? <Pause size={28} className="z-10 text-pink-500"/> : <Play size={28} className="ml-1 z-10 text-white"/>}
                    {playingMusicId === music.id && (
                      <div className="absolute inset-0 bg-pink-600/20 animate-pulse"/>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-lg uppercase tracking-tighter truncate max-w-[180px]">
                      {music.title}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <Music size={10}/> {music.artist || 'Trending Audio'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => { setSelectedMusic(music); setShowMusic(false); }} 
                  className={`p-5 rounded-[22px] transition-all active:scale-75 ${
                    selectedMusic?.id === music.id 
                    ? 'bg-pink-600 text-white shadow-xl shadow-pink-600/40' 
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <Check size={24} strokeWidth={4}/>
                </button>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <Music size={60} className="mb-4"/>
                <p className="font-black uppercase italic tracking-widest">No Sounds Found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. HIDDEN AUDIO UTILITY */}
      <audio 
        ref={audioRef} 
        hidden 
        crossOrigin="anonymous" 
        preload="auto" 
        onEnded={() => setPlayingMusicId(null)}
      />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes pulse-ring {
          0% { transform: scale(.33); }
          80%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
} 
