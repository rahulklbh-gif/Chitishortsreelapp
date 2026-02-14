"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock, ChevronRight, ArrowLeft 
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * 🛠️ HARDCODED R2 CONFIG (Your Keys - 100% Bypass)
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

const PERMANENT_MUSIC = [
  { id: 'p1', title: 'Chiti Viral Tone', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'p2', title: 'Lofi Night', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }
];

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- STATES --
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
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [musicList, setMusicList] = useState<any[]>(PERMANENT_MUSIC);

  // -- REFS --
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const filterStyles: any = {
    none: "",
    bright: "brightness(1.2) contrast(1.1)",
    warm: "sepia(0.3) brightness(1.1) saturate(1.2)",
    mono: "grayscale(1) contrast(1.2)",
    cine: "contrast(1.4) saturate(1.1) brightness(0.8)",
    retro: "sepia(0.5) hue-rotate(-30deg) saturate(1.4)",
    cool: "hue-rotate(180deg) brightness(1.1) saturate(1.2)",
    vivid: "saturate(2) contrast(1.2)",
    noir: "grayscale(1) contrast(1.8) brightness(0.7)",
    faded: "opacity(0.8) brightness(1.2)",
    rosy: "hue-rotate(320deg) saturate(1.2)",
    gold: "brightness(1.1) sepia(0.4) saturate(1.6)"
  };

  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
        if (data) setMusicList([...data, ...PERMANENT_MUSIC]);
      } catch (e) { console.error("Music fetch error", e); }
    };
    loadMusic();
  }, []);

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

  const startCamera = async () => {
    if (!user) return;
    try {
      stopTracks();
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
      setTimeLeft(recordLimit);
    } catch (err) {
      toast.error("Camera access denied.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  /**
   * 🎤 PRO AUDIO/VIDEO MIXING ENGINE
   */
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let mixedStream = streamRef.current;

    // Mixing Logic
    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        
        if (ctx.state === 'suspended') await ctx.resume();

        audioRef.current.crossOrigin = "anonymous";
        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        const dest = ctx.createMediaStreamDestination();

        musicSource.connect(dest);
        micSource.connect(dest);
        dest.connect(ctx.destination); 

        const mixedAudioTrack = dest.stream.getAudioTracks()[0];
        mixedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          mixedAudioTrack
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (e) { console.warn("Mixing error:", e); }
    }

    const recorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], `chiti-${Date.now()}.webm`, { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
      audioRef.current?.pause();
      stopTracks();
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { mediaRecorderRef.current?.stop(); clearInterval(timerRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  };

  /**
   * 📤 UPLOAD & AUTO-SAVE MUSIC LOGIC
   */
  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    const toastId = toast.loading('Publishing Star Video...');
    
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      const arrayBuffer = await selectedFile.arrayBuffer();

      const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: 'video/webm',
      });

      await r2Client.send(command);

      const finalUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      const postCaption = caption || "Original Sound by Chiti";
      
      // 1. Save Post
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: finalUrl,
        caption: postCaption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Chiti User',
        thumbnail_url: finalUrl + "#t=0.5"
      }]);

      if (dbError) throw dbError;

      // 2. AUTO-SAVE TO MUSIC LIBRARY (Won't delete if post is deleted)
      await supabase.from('music_library').insert([{
        title: postCaption,
        audio_url: finalUrl,
        creator_id: user.id
      }]);

      toast.success('Posted & Music Saved!', { id: toastId });
      setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden font-sans">
      
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-black/60 backdrop-blur-lg border-b border-white/5">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic tracking-tighter text-blue-500 leading-none">CHITI</h1>
          <span className="text-[8px] font-bold tracking-[0.2em] text-white/40 uppercase">Creator Studio</span>
        </div>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full active:scale-75 transition-transform"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
          <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mb-6">
            <Lock size={40} className="text-blue-500" />
          </div>
          <h2 className="text-3xl font-black mb-4 tracking-tighter">JOIN THE SQUAD</h2>
          <p className="text-gray-400 mb-8 text-sm">Sign in to start creating viral videos.</p>
          <a href="/login" className="px-16 py-4 bg-blue-600 rounded-full font-black shadow-[0_0_30px_rgba(37,99,235,0.4)]">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* HOME START */
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-12 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
          <div className="relative">
             <div className="absolute -inset-4 bg-blue-600 rounded-full blur-3xl opacity-20 animate-pulse"></div>
             <button onClick={() => setIsCameraMode(true)} className="relative w-64 h-64 bg-blue-600 rounded-[70px] flex flex-col items-center justify-center shadow-2xl active:scale-90 transition-all">
                <Camera size={80} />
                <span className="text-xl font-black italic mt-4 uppercase tracking-widest">Shoot</span>
             </button>
          </div>
          
          <label className="w-72 p-6 bg-zinc-900/50 rounded-[35px] flex items-center justify-center gap-4 border border-white/5 cursor-pointer active:scale-95 transition-all backdrop-blur-md">
            <div className="p-3 bg-blue-500/10 rounded-2xl"><Upload size={24} className="text-blue-500"/></div>
            <span className="font-black uppercase tracking-wider text-xs">From Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
               const file = e.target.files?.[0];
               if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); setRecordedFacingMode('environment'); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* RECORDING SCREEN */
        <div className="relative flex-1 bg-black">
          <video 
            ref={videoPreviewRef} 
            className="h-full w-full object-cover" 
            style={{ filter: filterStyles[selectedFilter], transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
            autoPlay playsInline muted 
          />
          
          {/* SIDEBAR TOOLS */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/50 backdrop-blur-xl rounded-3xl border border-white/10 active:scale-75 transition-all"><RefreshCw size={26}/></button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-4 bg-black/50 backdrop-blur-xl rounded-3xl border border-white/10 active:scale-75 transition-all ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles size={26}/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/50 backdrop-blur-xl rounded-3xl border border-white/10 active:scale-75 transition-all ${selectedMusic ? 'text-pink-400 border-pink-500' : ''}`}><Music size={26}/></button>
          </div>

          {/* RECORD BUTTON AREA */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
                <div className="flex bg-black/50 backdrop-blur-xl p-1.5 rounded-full border border-white/10">
                    {[15, 30, 60].map(s => (
                        <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-6 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === s ? 'bg-white text-black' : 'text-gray-500'}`}>{s}S</button>
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
                {isRecording && <div className="absolute -top-14 px-5 py-1.5 bg-red-600 rounded-full font-black text-sm animate-bounce shadow-2xl">{timeLeft}s</div>}
            </div>
          </div>

          {/* FILTERS OVERLAY (Thumbnails) */}
          {showFilters && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl z-[1060] p-6 pb-12 border-t border-white/10 rounded-t-[40px] animate-in slide-in-from-bottom">
               <div className="flex justify-between items-center mb-6"><h3 className="font-black italic text-lg">FILTERS</h3><button onClick={() => setShowFilters(false)}><X/></button></div>
               <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {Object.keys(filterStyles).map(f => (
                    <div key={f} className="flex flex-col items-center gap-2">
                        <button 
                           onClick={() => setSelectedFilter(f)} 
                           style={{ filter: filterStyles[f] }}
                           className={`w-20 h-28 rounded-2xl border-2 overflow-hidden bg-zinc-800 transition-all ${selectedFilter === f ? 'border-blue-500 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'border-white/10 opacity-60'}`}
                        >
                           <div className="w-full h-full bg-gradient-to-tr from-zinc-700 to-zinc-500 flex items-center justify-center text-[10px] font-black text-white/30 uppercase tracking-tighter">PREVIEW</div>
                        </button>
                        <span className={`text-[9px] font-black uppercase ${selectedFilter === f ? 'text-blue-500' : 'text-gray-500'}`}>{f}</span>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* MUSIC PICKER */}
          {showMusic && (
            <div className="absolute inset-0 bg-black/95 z-[1100] p-6 pt-24 overflow-y-auto">
              <div className="flex justify-between items-center mb-10"><h2 className="text-3xl font-black italic tracking-tighter">SELECT SOUND</h2><button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full"><X/></button></div>
              <div className="space-y-4">
                {musicList.map(m => (
                  <div key={m.id} className={`p-5 rounded-3xl flex items-center justify-between border transition-all ${selectedMusic?.id === m.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-zinc-900/50 border-white/5'}`}>
                    <div className="flex items-center gap-5 flex-1" onClick={() => {
                        if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                    }}>
                      <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">{playingMusicId === m.id ? <Pause/> : <Play className="ml-1"/>}</div>
                      <div className="flex flex-col"><p className="font-black text-sm truncate w-40 tracking-tight">{m.title}</p><span className="text-[10px] text-gray-500 font-bold uppercase">Original Audio</span></div>
                    </div>
                    <button onClick={() => {setSelectedMusic(m); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className={`p-4 rounded-2xl transition-all ${selectedMusic?.id === m.id ? 'bg-blue-500 text-white shadow-xl scale-110' : 'bg-white/5 text-gray-400'}`}><Check/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PREVIEW & FINAL STEP */
        <div className="fixed inset-0 bg-black flex flex-col z-[1200]">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              <video 
                src={previewUrl} 
                style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                autoPlay loop playsInline className="w-full h-full object-cover" 
              />
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-4 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 active:scale-75 transition-all"><ArrowLeft/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-12 py-4 bg-blue-600 rounded-full font-black text-sm tracking-widest shadow-2xl active:scale-95 transition-all">NEXT</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col bg-zinc-950">
              <div className="flex items-center gap-4 mb-12">
                 <button onClick={() => setIsFinalStep(false)} className="p-3 bg-white/5 rounded-full"><ArrowLeft size={20}/></button>
                 <h2 className="text-2xl font-black italic tracking-tighter">FINISH POST</h2>
              </div>
              
              <div className="flex gap-6 mb-12">
                <div className="w-36 h-56 bg-zinc-900 rounded-[35px] overflow-hidden border border-white/10 shadow-2xl relative">
                  <video 
                    src={previewUrl} 
                    style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                    muted className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/20"></div>
                </div>
                <div className="flex-1 pt-2">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Caption</span>
                  <textarea 
                    placeholder="Describe your vibe..." 
                    className="w-full h-40 bg-transparent border-b border-white/5 py-3 outline-none resize-none font-bold text-lg placeholder:text-zinc-700"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleUpload} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-6 rounded-[40px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)]"
              >
                {isUploading ? <Loader2 className="animate-spin" size={28}/> : <Send size={28}/>}
                {isUploading ? 'PUBLISHING...' : 'POST TO CHITI'}
              </button>
              <p className="text-center text-[10px] text-zinc-500 mt-6 font-bold uppercase tracking-widest">By posting you agree to Chiti Creator Terms</p>
            </div>
          )}
        </div>
      )}

      {/* GLOBAL AUDIO TAG */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
