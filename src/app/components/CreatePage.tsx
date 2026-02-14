"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock, ArrowLeft,
  Settings, Volume2, ShieldCheck
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
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

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint, 
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
  forcePathStyle: true, 
});

/**
 * 🎨 FILTERS WITH REAL GIRL THUMBNAILS
 */
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=300&fit=crop" },
  bright: { name: "Bright", style: "brightness(1.3) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=300&fit=crop" },
  warm: { name: "Warm", style: "sepia(0.4) saturate(1.4) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=300&fit=crop" },
  mono: { name: "B&W", style: "grayscale(1) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=300&fit=crop" },
  cine: { name: "Cine", style: "contrast(1.5) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=300&fit=crop" },
  retro: { name: "Retro", style: "sepia(0.6) hue-rotate(-20deg) saturate(1.4)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=300&fit=crop" },
  cool: { name: "Cool", style: "hue-rotate(160deg) brightness(1.1) saturate(1.2)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=300&fit=crop" },
  vivid: { name: "Vivid", style: "saturate(2.2) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=300&fit=crop" },
  noir: { name: "Noir", style: "grayscale(1) contrast(2) brightness(0.7)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=300&fit=crop" },
  gold: { name: "Gold", style: "brightness(1.1) sepia(0.5) saturate(1.8)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=300&fit=crop" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- BASIC STATES --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [recordedFacingMode, setRecordedFacingMode] = useState<'user' | 'environment'>('user');
  
  // -- UI OVERLAY STATES --
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFinalStep, setIsFinalStep] = useState(false);
  
  // -- MUSIC STATES --
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('none');

  // -- REFS FOR MEDIA --
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  /**
   * 🎵 LOAD MUSIC FROM DATABASE
   */
  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data, error } = await supabase
          .from('music_library')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setMusicList(data);
      } catch (e) {
        console.error("Music loading error:", e);
      }
    };
    loadMusic();
  }, []);

  /**
   * 🛑 STOP ALL MEDIA TRACKS
   */
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  /**
   * 🛡️ GALLERY UPLOAD WITH STRICT 30S LIMIT
   */
  const handleGalleryVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      // Strict 30 second check
      if (videoElement.duration > 30.8) {
        toast.error("Video is too long! Max 30 seconds allowed.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRecordedFacingMode('environment'); // Gallery usually doesn't need flip
    };
    videoElement.src = URL.createObjectURL(file);
  };

  /**
   * 📸 START CAMERA ENGINE
   */
  const startCamera = async () => {
    if (!user) return;
    try {
      stopTracks();
      const constraints = {
        video: { 
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraMode(true);
      setTimeLeft(recordLimit);
    } catch (err) {
      console.error("Camera Error:", err);
      toast.error("Camera access denied. Please check permissions.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  /**
   * 🎙️ PRO AUDIO & VIDEO MIXING ENGINE
   */
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let mixedStream = streamRef.current;

    // Advanced Audio Mixing Logic
    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        
        if (ctx.state === 'suspended') await ctx.resume();

        audioRef.current.crossOrigin = "anonymous";
        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        
        const musicGain = ctx.createGain();
        const micGain = ctx.createGain();
        const destination = ctx.createMediaStreamDestination();

        // Balanced Levels: Mic 100%, Music 50%
        musicGain.gain.value = 0.5;
        micGain.gain.value = 1.0;

        musicSource.connect(musicGain).connect(destination);
        micSource.connect(micGain).connect(destination);
        
        // Output to device speakers so user hears the beat
        musicGain.connect(ctx.destination);

        const mixedAudioTrack = destination.stream.getAudioTracks()[0];
        mixedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          mixedAudioTrack
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (audioErr) {
        console.error("Audio Mix Failed:", audioErr);
      }
    }

    const recorder = new MediaRecorder(mixedStream, { 
      mimeType: 'video/webm;codecs=vp8,opus',
      videoBitsPerSecond: 2500000 
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], `chiti-rec-${Date.now()}.webm`, { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
      audioRef.current?.pause();
      stopTracks();
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          mediaRecorderRef.current?.stop();
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /**
   * 📤 FINAL UPLOAD LOGIC (Saves Video + Auto Music)
   */
  const handlePublish = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    const toastId = toast.loading('Publishing your viral hit...');
    
    try {
      const fileName = `chiti_vids/${user.id}/${Date.now()}.webm`;
      const fileBuffer = await selectedFile.arrayBuffer();

      // 1. Upload to Cloudflare R2
      const uploadCommand = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: 'video/webm',
      });

      await r2Client.send(uploadCommand);
      const videoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      const finalTitle = caption || "Original Sound by Chiti Star";

      // 2. Insert into POSTS table
      const { error: postError } = await supabase.from('posts').insert([{
        video_url: videoUrl,
        caption: finalTitle,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Anonymous Creator',
        thumbnail_url: videoUrl + "#t=0.5"
      }]);

      if (postError) throw postError;

      // 3. AUTO-SAVE TO MUSIC LIBRARY (User title = Music title)
      // Logic: Hitting the separate music table so it stays forever
      await supabase.from('music_library').insert([{
        title: finalTitle,
        audio_url: videoUrl,
        creator_id: user.id
      }]);

      toast.success('Successfully Posted!', { id: toastId });
      setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
      console.error("Upload Error:", err);
      toast.error(`Upload failed: ${err.message}`, { id: toastId });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] font-sans overflow-hidden">
      
      {/* 🟢 TOP NAVIGATION */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic tracking-tighter text-blue-500 leading-none">CHITI</h1>
          <p className="text-[8px] font-bold tracking-[0.2em] text-blue-300 uppercase mt-1">Studio Mode</p>
        </div>
        {(isCameraMode || previewUrl) && (
          <button 
            onClick={() => window.location.reload()} 
            className="p-3 bg-white/10 rounded-full backdrop-blur-md active:scale-75 transition-transform"
          >
            <X size={24}/>
          </button>
        )}
      </div>

      {!user ? (
        /* LOGIN WALL */
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950">
          <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <ShieldCheck size={40} className="text-blue-500" />
          </div>
          <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Login Required</h2>
          <p className="text-gray-500 text-sm mb-8 text-center">Join the Chiti community to start creating and sharing videos.</p>
          <a href="/login" className="px-16 py-4 bg-blue-600 rounded-full font-black text-lg shadow-xl shadow-blue-900/20">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* 🔵 INITIAL VIEW: RECORD OR UPLOAD */
        <div className="flex-1 flex flex-col items-center justify-center gap-14 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
          <div className="relative group">
            <div className="absolute -inset-6 bg-blue-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <button 
              onClick={() => setIsCameraMode(true)} 
              className="relative w-64 h-64 bg-blue-600 rounded-[70px] flex flex-col items-center justify-center shadow-2xl active:scale-90 transition-all"
            >
              <Camera size={80} className="text-white mb-2" />
              <span className="text-xl font-black italic uppercase tracking-widest">Shoot</span>
            </button>
          </div>
          
          <label className="w-72 p-6 bg-zinc-900/40 rounded-[35px] flex items-center justify-center gap-4 border border-white/5 cursor-pointer active:scale-95 transition-all backdrop-blur-xl">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <Upload size={24} className="text-blue-500"/>
            </div>
            <div className="flex flex-col">
              <span className="font-black uppercase tracking-wider text-xs">Gallery</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase">Max 30 Seconds</span>
            </div>
            <input type="file" hidden accept="video/*" onChange={handleGalleryVideo} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* 🔴 ACTIVE CAMERA RECORDING SCREEN */
        <div className="relative flex-1 bg-black">
          <video 
            ref={videoPreviewRef} 
            className="h-full w-full object-cover" 
            style={{ 
              filter: FILTERS_DATA[selectedFilter].style, 
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' 
            }} 
            autoPlay playsInline muted 
          />
          
          {/* CAMERA ACTIONS BAR */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 active:scale-75"><RefreshCw size={26}/></button>
            <button onClick={() => setShowFilters(true)} className={`p-4 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 active:scale-75 ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles size={26}/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 active:scale-75 ${selectedMusic ? 'text-pink-400 border-pink-500' : ''}`}><Music size={26}/></button>
            <button className="p-4 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10"><Settings size={26}/></button>
          </div>

          {/* BOTTOM CONTROLS */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/40 backdrop-blur-2xl p-1.5 rounded-full border border-white/10">
                {[15, 30].map(sec => (
                  <button 
                    key={sec} 
                    onClick={() => {setRecordLimit(sec); setTimeLeft(sec);}} 
                    className={`px-8 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === sec ? 'bg-white text-black' : 'text-gray-500'}`}
                  >
                    {sec}S
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex items-center justify-center">
              <button 
                onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} 
                className={`w-24 h-24 rounded-full border-[8px] flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}
              >
                <div className={`${isRecording ? 'w-10 h-10 bg-red-500 rounded-lg animate-pulse' : 'w-16 h-16 bg-white rounded-full'}`} />
              </button>
              {isRecording && (
                <div className="absolute -top-16 px-6 py-2 bg-red-600 rounded-full font-black text-xs animate-bounce shadow-xl">
                  {timeLeft}s RECORDING
                </div>
              )}
            </div>
          </div>

          {/* 🎭 GIRLS FILTER THUMBNAILS MODAL */}
          {showFilters && (
            <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-3xl z-[1100] p-6 pb-14 rounded-t-[50px] border-t border-white/10 animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-blue-500"/>
                  <h3 className="font-black italic text-lg uppercase tracking-tighter">Visual Filters</h3>
                </div>
                <button onClick={() => setShowFilters(false)} className="p-2 bg-white/5 rounded-full"><X/></button>
              </div>
              
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                {Object.keys(FILTERS_DATA).map(key => (
                  <div key={key} className="flex flex-col items-center gap-3">
                    <button 
                      onClick={() => setSelectedFilter(key)} 
                      className={`relative w-24 h-32 rounded-[25px] overflow-hidden border-2 transition-all ${selectedFilter === key ? 'border-blue-500 scale-110 shadow-2xl shadow-blue-500/40' : 'border-transparent opacity-50'}`}
                    >
                      <img 
                        src={FILTERS_DATA[key].thumb} 
                        className="w-full h-full object-cover" 
                        style={{ filter: FILTERS_DATA[key].style }}
                        alt={key}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <Check className={`absolute top-2 right-2 text-blue-500 ${selectedFilter === key ? 'opacity-100' : 'opacity-0'}`} size={16}/>
                    </button>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${selectedFilter === key ? 'text-blue-500' : 'text-zinc-600'}`}>
                      {FILTERS_DATA[key].name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🎵 MUSIC LIBRARY PICKER */}
          {showMusic && (
            <div className="absolute inset-0 bg-black/98 z-[1200] p-6 pt-24 overflow-y-auto animate-in fade-in">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black italic tracking-tighter">SOUNDS</h2>
                <button onClick={() => setShowMusic(false)} className="p-4 bg-white/5 rounded-full"><X/></button>
              </div>
              
              <div className="space-y-4">
                {musicList.length === 0 && <p className="text-center text-zinc-600 py-10 font-bold uppercase tracking-widest">No music found. Be the first to post!</p>}
                {musicList.map(music => (
                  <div 
                    key={music.id} 
                    className={`p-5 rounded-[30px] flex items-center justify-between border transition-all ${selectedMusic?.id === music.id ? 'bg-blue-600/20 border-blue-500' : 'bg-zinc-900 border-white/5'}`}
                  >
                    <div className="flex items-center gap-5 flex-1" onClick={() => {
                        if(playingMusicId === music.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = music.audio_url; audioRef.current?.play(); setPlayingMusicId(music.id); }
                    }}>
                      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                        {playingMusicId === music.id ? <Pause fill="white"/> : <Play fill="white" className="ml-1"/>}
                      </div>
                      <div className="flex flex-col">
                        <p className="font-black text-sm truncate w-40 tracking-tight">{music.title}</p>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Chiti Original Audio</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {setSelectedMusic(music); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} 
                      className={`p-5 rounded-2xl transition-all ${selectedMusic?.id === music.id ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400'}`}
                    >
                      <Check size={20}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 🏁 POST-PRODUCTION / FINAL STEP SCREEN */
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1300]">
          {!isFinalStep ? (
            /* PREVIEW VIDEO */
            <div className="flex-1 flex flex-col relative">
              <video 
                src={previewUrl} 
                style={{ 
                  filter: FILTERS_DATA[selectedFilter].style, 
                  transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' 
                }} 
                autoPlay loop playsInline className="w-full h-full object-cover" 
              />
              <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-4 bg-black/40 backdrop-blur-xl rounded-full border border-white/10"><ArrowLeft/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-14 py-4 bg-blue-600 rounded-full font-black text-sm tracking-[0.2em] shadow-2xl active:scale-95 transition-all">NEXT</button>
              </div>
            </div>
          ) : (
            /* DETAILS & PUBLISH */
            <div className="flex-1 p-8 flex flex-col bg-zinc-950">
              <div className="flex items-center gap-4 mb-14">
                <button onClick={() => setIsFinalStep(false)} className="p-3 bg-white/5 rounded-full"><ArrowLeft/></button>
                <h2 className="text-2xl font-black italic tracking-tighter uppercase">Final Details</h2>
              </div>
              
              <div className="flex gap-8 mb-16">
                <div className="w-40 h-60 bg-zinc-900 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative">
                  <video 
                    src={previewUrl} 
                    style={{ filter: FILTERS_DATA[selectedFilter].style, transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                    muted className="w-full h-full object-cover" 
                  />
                  <div className="absolute bottom-3 left-3 bg-black/50 p-1.5 rounded-lg"><Volume2 size={12}/></div>
                </div>
                <div className="flex-1 pt-4">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Caption & Audio Title</span>
                  <textarea 
                    placeholder="Enter music title or caption..." 
                    className="w-full h-44 bg-transparent border-b border-white/5 py-4 outline-none resize-none font-bold text-xl placeholder:text-zinc-800"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="mt-auto space-y-4">
                <button 
                  onClick={handlePublish} 
                  disabled={isUploading} 
                  className="w-full bg-blue-600 py-6 rounded-[45px] font-black text-2xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 transition-all shadow-[0_20px_60px_rgba(37,99,235,0.3)]"
                >
                  {isUploading ? <Loader2 className="animate-spin" size={30}/> : <Send size={30}/>}
                  {isUploading ? 'SAVING AUDIO...' : 'POST VIDEO'}
                </button>
                <p className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Music will be saved automatically to library</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🧬 GLOBAL ELEMENTS */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
