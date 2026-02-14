"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock, ArrowLeft 
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * 🛠️ HARDCODED R2 CONFIG (Using Your Keys)
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
  { id: 'p1', title: 'Chiti Viral Beats', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'p2', title: 'Romantic Lofi', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }
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

  // Filter Styles Mapping
  const filterStyles: any = {
    none: "",
    bright: "brightness(1.3) contrast(1.1)",
    warm: "sepia(0.4) saturate(1.4) brightness(1.1)",
    mono: "grayscale(1) contrast(1.2)",
    cine: "contrast(1.5) saturate(0.9) brightness(0.8)",
    retro: "sepia(0.6) hue-rotate(-20deg) saturate(1.4)",
    cool: "hue-rotate(160deg) brightness(1.1) saturate(1.2)",
    vivid: "saturate(2.2) contrast(1.1)",
    noir: "grayscale(1) contrast(2) brightness(0.6)",
    gold: "brightness(1.1) sepia(0.5) saturate(1.8)"
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
      toast.error("Please allow camera access.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  /**
   * 🎤 SYNCED RECORDING ENGINE (Plays Music + Captures Mic)
   */
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let finalStream = streamRef.current;

    // Mixed Audio Logic
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

        finalStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          dest.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play(); // 🎵 Play music while recording
      } catch (e) { console.error("Audio Playback Error", e); }
    }

    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp8,opus' });
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
   * 📤 PUBLISH & AUTO-SAVE MUSIC
   */
  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    const toastId = toast.loading('Sharing your Chiti...');
    
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      const arrayBuffer = await selectedFile.arrayBuffer();

      await r2Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: 'video/webm',
      }));

      const fileUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      const finalTitle = caption || "Original Sound by Chiti";
      
      // 1. Save to POSTS Table
      const { error: postError } = await supabase.from('posts').insert([{
        video_url: fileUrl,
        caption: finalTitle,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Anonymous',
        thumbnail_url: fileUrl + "#t=0.5"
      }]);
      if (postError) throw postError;

      // 2. Save to MUSIC_LIBRARY Table (Permanent)
      const { error: musicError } = await supabase.from('music_library').insert([{
        title: finalTitle,
        audio_url: fileUrl,
        creator_id: user.id
      }]);
      if (musicError) console.error("Music save failed, but video posted.");

      toast.success('Uploaded & Music Saved!', { id: toastId });
      setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-black/40 backdrop-blur-md">
        <div className="flex flex-col">
          <h1 className="text-xl font-black italic text-blue-500 tracking-tighter">CHITI</h1>
          <span className="text-[7px] font-bold tracking-[0.3em] uppercase text-white/50">Creator Studio</span>
        </div>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950">
          <Lock size={60} className="text-blue-600 mb-6" />
          <h2 className="text-2xl font-black mb-8">LOGIN TO CREATE</h2>
          <a href="/login" className="px-14 py-4 bg-blue-600 rounded-full font-black shadow-lg">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-12 bg-gradient-to-b from-blue-900/10 to-black">
          <button onClick={() => setIsCameraMode(true)} className="w-60 h-60 bg-blue-600 rounded-[60px] flex flex-col items-center justify-center shadow-2xl active:scale-90 transition-all">
            <Camera size={70} />
            <span className="text-lg font-black italic mt-4 uppercase">Shoot</span>
          </button>
          
          <label className="w-64 p-5 bg-zinc-900 rounded-[30px] flex items-center justify-center gap-3 border border-white/5 cursor-pointer active:scale-95 transition-all">
            <Upload size={24} className="text-blue-500"/>
            <span className="font-bold uppercase text-xs">Upload Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
               const file = e.target.files?.[0];
               if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); setRecordedFacingMode('environment'); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1 bg-black">
          <video 
            ref={videoPreviewRef} 
            className="h-full w-full object-cover" 
            style={{ filter: filterStyles[selectedFilter], transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
            autoPlay playsInline muted 
          />
          
          {/* CAMERA TOOLS */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/50 rounded-2xl border border-white/10"><RefreshCw/></button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-4 bg-black/50 rounded-2xl border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/50 rounded-2xl border border-white/10 ${selectedMusic ? 'text-pink-400 border-pink-500' : ''}`}><Music/></button>
          </div>

          {/* TIMER & RECORD BUTTON */}
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
                <div className="flex bg-black/50 p-1 rounded-full border border-white/10">
                    {[15, 30].map(s => (
                        <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-6 py-1.5 rounded-full text-[10px] font-black tracking-widest ${recordLimit === s ? 'bg-white text-black' : 'text-gray-500'}`}>{s}S</button>
                    ))}
                </div>
            )}
            <div className="relative flex items-center justify-center">
                <button 
                  onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} 
                  className={`w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}
                >
                    <div className={`${isRecording ? 'w-10 h-10 bg-red-500 rounded-lg animate-pulse' : 'w-18 h-18 bg-white rounded-full'}`} />
                </button>
                {isRecording && <div className="absolute -top-12 px-4 py-1 bg-red-600 rounded-full font-black text-xs">{timeLeft}s</div>}
            </div>
          </div>

          {/* REAL FILTER THUMBNAILS UI */}
          {showFilters && (
            <div className="absolute bottom-0 left-0 right-0 bg-zinc-950 z-[1060] p-6 pb-12 rounded-t-[40px] border-t border-white/10">
               <div className="flex justify-between items-center mb-6"><h3 className="font-black italic text-sm tracking-widest uppercase">Visual Filters</h3><button onClick={() => setShowFilters(false)}><X/></button></div>
               <div className="flex gap-4 overflow-x-auto no-scrollbar">
                  {Object.keys(filterStyles).map(f => (
                    <div key={f} className="flex flex-col items-center gap-2">
                        <button 
                           onClick={() => setSelectedFilter(f)} 
                           className={`w-20 h-28 rounded-2xl border-2 bg-gradient-to-tr from-zinc-800 to-zinc-700 overflow-hidden transition-all ${selectedFilter === f ? 'border-blue-500 scale-105 shadow-2xl shadow-blue-500/30' : 'border-white/5 opacity-60'}`}
                        >
                           <div style={{ filter: filterStyles[f] }} className="w-full h-full flex items-center justify-center">
                              {/* Thumbnail preview effect */}
                              <div className="w-12 h-12 rounded-full bg-blue-500 shadow-xl border border-white/20"></div>
                           </div>
                        </button>
                        <span className={`text-[9px] font-black uppercase ${selectedFilter === f ? 'text-blue-500' : 'text-gray-500'}`}>{f}</span>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* MUSIC LIBRARY PICKER */}
          {showMusic && (
            <div className="absolute inset-0 bg-black/95 z-[1100] p-6 pt-24 overflow-y-auto">
              <div className="flex justify-between items-center mb-10"><h2 className="text-3xl font-black italic">CHOOSE SOUND</h2><button onClick={() => setShowMusic(false)}><X/></button></div>
              {musicList.map(m => (
                <div key={m.id} className={`p-5 mb-4 rounded-3xl flex items-center justify-between border ${selectedMusic?.id === m.id ? 'bg-blue-600/20 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                  <div className="flex items-center gap-5 flex-1" onClick={() => {
                      if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                      else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                  }}>
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center">{playingMusicId === m.id ? <Pause/> : <Play/>}</div>
                    <div className="flex flex-col overflow-hidden">
                       <p className="font-black text-sm truncate w-40 tracking-tight">{m.title}</p>
                       <p className="text-[10px] text-zinc-500 font-bold">Trending Sound</p>
                    </div>
                  </div>
                  <button onClick={() => {setSelectedMusic(m); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className="p-4 bg-white/5 rounded-2xl active:bg-blue-600"><Check/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* POSTING SCREEN */
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1200]">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              <video 
                src={previewUrl} 
                style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                autoPlay loop playsInline className="w-full h-full object-cover" 
              />
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-3 bg-black/40 rounded-full"><ArrowLeft/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-10 py-3 bg-blue-600 rounded-full font-black text-sm tracking-widest shadow-xl">NEXT</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col bg-zinc-950">
              <div className="flex items-center gap-4 mb-10"><button onClick={() => setIsFinalStep(false)}><ArrowLeft/></button><h2 className="text-xl font-black uppercase">Post</h2></div>
              <div className="flex gap-6 mb-12">
                <div className="w-36 h-56 bg-zinc-900 rounded-[35px] overflow-hidden border border-white/10 relative">
                  <video src={previewUrl} style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} muted className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                   <p className="text-[10px] font-black text-blue-500 mb-2 uppercase">Caption / Music Title</p>
                   <textarea 
                    placeholder="Write a catchy title..." 
                    className="w-full bg-transparent border-b border-white/10 py-2 outline-none resize-none font-bold text-lg"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={handleUpload} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-6 rounded-[40px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 shadow-[0_20px_40px_rgba(37,99,235,0.3)]"
              >
                {isUploading ? <Loader2 className="animate-spin" size={28}/> : <Send size={28}/>}
                {isUploading ? 'SAVING DATA...' : 'SHARE VIDEO'}
              </button>
            </div>
          )}
        </div>
      )}

      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
