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
 * 🛠️ AWS SDK CONFIG FOR CLOUDFLARE R2
 * Ye configuration aapke Vercel variables se connect hogi
 */
const r2Client = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT, 
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, 
});

const PUBLIC_R2_DOMAIN = import.meta.env.VITE_R2_PUBLIC_URL || "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev";

const PERMANENT_MUSIC = [
  { id: 'p1', title: 'Chiti Beats Viral', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'p2', title: 'Lofi Chill Night', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'p3', title: 'Upbeat Summer', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- SARE STATES (FOR UI AND LOGIC) --
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

  // -- REFS (FOR CAMERA AND AUDIO MIXING) --
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
    faded: "opacity(0.9) brightness(1.2) contrast(0.8)",
    rosy: "hue-rotate(320deg) saturate(1.2) brightness(1.1)",
    gold: "brightness(1.1) sepia(0.4) saturate(1.5)"
  };

  // Music loading from Supabase
  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data } = await supabase.from('music_library').select('*');
        if (data && data.length > 0) setMusicList([...data, ...PERMANENT_MUSIC]);
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
      toast.error("Camera permissions missing.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  // --- RECORDING & AUDIO MIXING ENGINE ---
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let mixedStream = streamRef.current;

    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        audioRef.current.crossOrigin = "anonymous";
        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        const dest = ctx.createMediaStreamDestination();

        musicSource.connect(dest);
        micSource.connect(dest);
        dest.connect(ctx.destination); 

        mixedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          dest.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (e) {
        console.warn("Audio mixing blocked by browser policies", e);
      }
    }

    const recorder = new MediaRecorder(mixedStream, { 
      mimeType: 'video/webm;codecs=vp8,opus' 
    });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

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
        if (p <= 1) {
          mediaRecorderRef.current?.stop();
          clearInterval(timerRef.current);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  };

  // --- 🔥 FINAL R2 UPLOAD ENGINE (FIXED) ---
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const toastId = toast.loading('Publishing to Chiti...');
    
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      // Converting File to ArrayBuffer for reliable R2 upload
      const arrayBuffer = await selectedFile.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      console.log("Upload Start:", { bucket: 'chiti-videos', fileName });

      const command = new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: fileName,
        Body: body,
        ContentType: 'video/webm',
      });

      // Sending to Cloudflare
      await r2Client.send(command);

      const url = `${PUBLIC_R2_DOMAIN}/${fileName}`;
      
      // Saving to Supabase Database
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: url, 
        caption: caption, 
        user_id: user.id, 
        user_name: user.user_metadata?.full_name || 'Chiti Star',
        thumbnail_url: url + "#t=0.5"
      }]);

      if (dbError) throw dbError;

      toast.success('Successfully Posted!', { id: toastId });
      setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
      console.error("SDK UPLOAD ERROR:", err);
      // Detailed error for debugging "Failed to fetch"
      const errorDetail = err.message || "Network issue or CORS block";
      toast.error(`Upload Failed: ${errorDetail}`, { id: toastId });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-black/50 backdrop-blur-md border-b border-white/5">
        <h1 className="text-xl font-black italic tracking-tighter text-blue-500">CHITI</h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full active:scale-90"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-pulse">
          <Lock size={60} className="text-blue-600 mb-6" />
          <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter">Sign in to share</h2>
          <a href="/login" className="px-14 py-4 bg-blue-600 rounded-full font-black shadow-lg shadow-blue-600/50">LOGIN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* CHOICE SCREEN */
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
          <button 
            onClick={() => setIsCameraMode(true)} 
            className="w-64 h-64 bg-blue-600 rounded-[60px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all"
          >
            <Camera size={70} />
            <span className="text-xl font-black italic mt-4 uppercase">Camera</span>
          </button>
          
          <label className="w-64 p-5 bg-zinc-900 rounded-[30px] flex items-center justify-center gap-3 border border-white/5 cursor-pointer active:scale-95 transition-all">
            <Upload size={24} className="text-blue-500"/>
            <span className="font-bold uppercase tracking-widest text-xs">Gallery Upload</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
               const file = e.target.files?.[0];
               if(file) {
                 setSelectedFile(file);
                 setPreviewUrl(URL.createObjectURL(file));
                 setRecordedFacingMode('environment'); 
               }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* ACTIVE CAMERA INTERFACE */
        <div className="relative flex-1 bg-black">
          <video 
            ref={videoPreviewRef} 
            className="h-full w-full object-cover" 
            style={{ 
              filter: filterStyles[selectedFilter], 
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' 
            }} 
            autoPlay playsInline muted 
          />
          
          {/* Controls Right Side */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 active:bg-blue-600"><RefreshCw size={24}/></button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles size={24}/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 ${selectedMusic ? 'text-pink-400 border-pink-500' : ''}`}><Music size={24}/></button>
          </div>

          {/* Record Controls Bottom */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
               <div className="flex bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                 {[15, 30].map(s => (
                   <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-8 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === s ? 'bg-white text-black' : 'text-gray-400'}`}>{s}S</button>
                 ))}
               </div>
            )}
            <div className="relative flex items-center justify-center">
                <button 
                  onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} 
                  className={`w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all duration-300 ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}
                >
                    <div className={`${isRecording ? 'w-10 h-10 bg-red-500 rounded-lg animate-pulse' : 'w-18 h-18 bg-white rounded-full'}`} />
                </button>
                <div className="absolute -top-12 px-4 py-1 bg-red-600 rounded-full font-black text-sm shadow-xl">{timeLeft}s</div>
            </div>
          </div>

          {/* Music Overlay */}
          {showMusic && (
            <div className="absolute inset-0 bg-black/95 z-[1050] p-6 pt-24 overflow-y-auto animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black italic">LIBRARY</h2><button onClick={() => setShowMusic(false)} className="p-2 bg-white/10 rounded-full"><X/></button></div>
              <div className="space-y-4">
                {musicList.map(m => (
                  <div key={m.id} className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${selectedMusic?.id === m.id ? 'bg-blue-600/20 border-blue-500' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex items-center gap-4 flex-1" onClick={() => {
                        if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                    }}>
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">{playingMusicId === m.id ? <Pause fill="white"/> : <Play fill="white" className="ml-1"/>}</div>
                      <div><p className="font-bold text-sm truncate w-40">{m.title}</p></div>
                    </div>
                    <button onClick={() => {setSelectedMusic(m); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className={`p-3 rounded-full ${selectedMusic?.id === m.id ? 'bg-green-500 text-black' : 'bg-white/10'}`}><Check/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PREVIEW AND POST SCREEN */
        <div className="fixed inset-0 bg-black flex flex-col z-[1100]">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              <video 
                src={previewUrl} 
                style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                autoPlay loop playsInline className="w-full h-full object-cover" 
              />
              {/* Filter Selection */}
              <div className="absolute right-4 top-20 flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar py-4">
                  {Object.keys(filterStyles).map((f) => (
                    <button key={f} onClick={() => setSelectedFilter(f)} className={`w-12 h-12 rounded-xl border-2 flex-shrink-0 transition-transform ${selectedFilter === f ? 'border-blue-500 scale-110' : 'border-white/20'}`} style={{ filter: filterStyles[f], background: '#222' }} />
                  ))}
              </div>
              {/* Top Controls */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-3 bg-white/10 backdrop-blur-md rounded-full active:scale-90"><ArrowLeft/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-10 py-3 bg-blue-600 rounded-full font-black shadow-lg shadow-blue-600/40">NEXT</button>
              </div>
            </div>
          ) : (
            /* FINAL STEP: CAPTION & PUBLISH */
            <div className="flex-1 p-6 flex flex-col bg-zinc-950">
              <div className="flex items-center gap-4 mb-10">
                 <button onClick={() => setIsFinalStep(false)} className="p-2 bg-white/10 rounded-full"><ArrowLeft/></button>
                 <h2 className="text-xl font-black uppercase tracking-widest">Share Post</h2>
              </div>
              
              <div className="flex gap-5 mb-10">
                <div className="w-32 h-48 bg-zinc-900 rounded-[25px] overflow-hidden shadow-2xl border border-white/5">
                  <video 
                    src={previewUrl} 
                    style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                    muted className="w-full h-full object-cover" 
                  />
                </div>
                <div className="flex-1">
                  <textarea 
                    placeholder="Enter a catchy caption..." 
                    className="w-full h-32 bg-transparent border-b border-white/10 py-2 outline-none resize-none font-bold text-lg placeholder:text-zinc-700"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleUpload} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-5 rounded-[35px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-blue-900/20"
              >
                {isUploading ? <Loader2 className="animate-spin" size={24}/> : <Send size={24}/>}
                {isUploading ? 'UPLOADING...' : 'POST TO CHITI'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden Audio for mixing */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
