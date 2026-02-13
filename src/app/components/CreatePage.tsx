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
 * 🛠️ R2 CLIENT CONFIGURATION
 * Region 'auto' aur forcePathStyle true hona zaroori hai
 */
const r2Client = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // R2 ke liye mandatory hai
});

const PUBLIC_R2_DOMAIN = import.meta.env.VITE_R2_PUBLIC_URL || "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev";

const PERMANENT_MUSIC = [
  { id: 'p1', title: 'Chiti Beats Viral', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'p2', title: 'Lofi Chill Night', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'p3', title: 'Upbeat Summer', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

export default function CreatePage() {
  const { user } = useAuth();
  
  // -- State Management --
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

  // -- Refs --
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

  // Load Music
  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data } = await supabase.from('music_library').select('*');
        if (data && data.length > 0) setMusicList([...data, ...PERMANENT_MUSIC]);
      } catch (e) { console.error("Music load error", e); }
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
      const constraints = {
        video: { facingMode: { ideal: facingMode }, width: 1280, height: 720 },
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
      toast.error("Camera permissions denied. Check settings.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  // --- AUDIO MIXING & RECORDING ---
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let trackToRecord = streamRef.current;

    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        // Use anonymous crossOrigin to prevent CORS issues with audio
        audioRef.current.crossOrigin = "anonymous";
        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        const destination = ctx.createMediaStreamDestination();

        musicSource.connect(destination);
        micSource.connect(destination);
        destination.connect(ctx.destination); // Hear while recording

        trackToRecord = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (e) {
        console.warn("Audio mixing skipped due to browser policy", e);
      }
    }

    const recorder = new MediaRecorder(trackToRecord, { 
      mimeType: 'video/webm;codecs=vp8,opus',
      videoBitsPerSecond: 2500000 
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
      if (audioRef.current) audioRef.current.pause();
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

  // --- 🔥 FIXED R2 UPLOAD FUNCTION ---
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const toastId = toast.loading('Uploading to Chiti...');
    
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      // Step 1: File Preparation (Robust way)
      const arrayBuffer = await selectedFile.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      console.log("Starting Upload:", {
        bucket: 'chiti-videos',
        key: fileName,
        size: selectedFile.size
      });

      // Step 2: Send to R2
      const command = new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: fileName,
        Body: fileData,
        ContentType: 'video/webm',
        // CacheControl removed to prevent potential header conflict on some networks
      });

      await r2Client.send(command);

      // Step 3: Save to Supabase
      const url = `${PUBLIC_R2_DOMAIN}/${fileName}`;
      
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: url, 
        caption, 
        user_id: user.id, 
        user_name: user.user_metadata?.full_name || 'Chiti Star',
        thumbnail_url: url // WebM can often be used as thumb, or process later
      }]);

      if (dbError) throw dbError;

      toast.success('Posted Successfully!', { id: toastId });
      setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
      console.error("FULL UPLOAD ERROR:", err);
      // Specific error messaging
      let msg = err.message;
      if (err.name === 'TypeError' && msg === 'Failed to fetch') {
        msg = "Network Blocked. Check CORS ExposeHeaders in R2.";
      }
      toast.error(`Error: ${msg}`, { id: toastId });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] touch-none overflow-hidden font-sans">
      
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-black/50 backdrop-blur-md">
        <h1 className="text-xl font-black italic tracking-tighter text-blue-500">CHITI</h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full active:scale-90"><X size={24}/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in">
          <Lock size={64} className="text-blue-600 mb-6" />
          <h2 className="text-2xl font-black mb-4 uppercase">Login Required</h2>
          <a href="/login" className="px-12 py-4 bg-blue-600 rounded-full font-black shadow-lg shadow-blue-600/50">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* SELECTION MENU */
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 animate-in slide-in-from-bottom duration-500">
          <button onClick={() => setIsCameraMode(true)} className="w-64 h-64 bg-blue-600 rounded-[50px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all group relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity"/>
            <Camera size={70} className="mb-4 drop-shadow-md"/>
            <span className="text-xl font-black italic uppercase tracking-wider">Start Camera</span>
          </button>
          
          <label className="w-64 p-5 bg-zinc-900 rounded-3xl flex items-center justify-center gap-3 border border-white/5 cursor-pointer active:scale-95 transition-transform hover:bg-zinc-800">
            <Upload size={24} className="text-blue-500"/>
            <span className="font-bold uppercase tracking-widest text-sm">Gallery Upload</span>
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
        /* CAMERA UI */
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
          
          {/* Controls Side */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 active:bg-blue-600 transition-colors"><RefreshCw size={24}/></button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles size={24}/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 ${selectedMusic ? 'text-pink-400 border-pink-500' : ''}`}><Music size={24}/></button>
          </div>

          {/* Record Button */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
               <div className="flex bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                 {[15, 30].map(s => (
                   <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-6 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === s ? 'bg-white text-black' : 'text-gray-400'}`}>{s}S</button>
                 ))}
               </div>
            )}
            <div className="relative flex items-center justify-center">
                <button 
                  onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} 
                  className={`w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all duration-300 ${isRecording ? 'border-red-500 scale-110' : 'border-white hover:scale-105'}`}
                >
                    <div className={`transition-all duration-300 ${isRecording ? 'w-10 h-10 bg-red-500 rounded-lg animate-pulse' : 'w-18 h-18 bg-white rounded-full'}`} />
                </button>
                <div className="absolute -top-12 px-4 py-1 bg-red-600 rounded-full font-black text-sm shadow-lg">{timeLeft}s</div>
            </div>
          </div>

          {/* Music Modal */}
          {showMusic && (
            <div className="absolute inset-0 bg-zinc-950 z-[1050] p-6 pt-24 overflow-y-auto animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black italic text-white">SELECT SOUND</h2><button onClick={() => setShowMusic(false)} className="p-2 bg-white/10 rounded-full"><X/></button></div>
              <div className="space-y-4">
                {musicList.map(m => (
                  <div key={m.id} className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${selectedMusic?.id === m.id ? 'bg-blue-900/30 border-blue-500' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex items-center gap-4 flex-1" onClick={() => {
                        if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                    }}>
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">{playingMusicId === m.id ? <Pause fill="white"/> : <Play fill="white" className="ml-1"/>}</div>
                      <div><p className="font-bold text-sm truncate w-40">{m.title}</p></div>
                    </div>
                    <button onClick={() => {setSelectedMusic(m); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className={`p-3 rounded-full ${selectedMusic?.id === m.id ? 'bg-green-500 text-black' : 'bg-white/10'}`}><Check size={20}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PREVIEW & UPLOAD */
        <div className="fixed inset-0 bg-black flex flex-col z-[1100] animate-in fade-in">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              <video 
                src={previewUrl} 
                style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                autoPlay loop playsInline className="w-full h-full object-cover" 
              />
              {/* Filter List */}
              <div className="absolute right-4 top-20 flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar py-4">
                  {Object.keys(filterStyles).map((f) => (
                    <button key={f} onClick={() => setSelectedFilter(f)} className={`w-12 h-12 rounded-xl border-2 flex-shrink-0 transition-transform ${selectedFilter === f ? 'border-blue-500 scale-110' : 'border-white/30'}`} style={{ filter: filterStyles[f], background: '#222' }} />
                  ))}
              </div>
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-3 bg-white/10 backdrop-blur-md rounded-full"><ArrowLeft/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-8 py-3 bg-blue-600 rounded-full font-black shadow-lg shadow-blue-600/40">NEXT <ChevronRight className="inline" size={20}/></button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col bg-zinc-950 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-8">
                 <button onClick={() => setIsFinalStep(false)} className="p-2 bg-white/10 rounded-full"><ArrowLeft/></button>
                 <h2 className="text-xl font-black uppercase tracking-wider">New Post</h2>
              </div>
              
              <div className="flex gap-5 mb-10">
                <div className="w-28 h-44 bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <video src={previewUrl} style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} muted className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <textarea 
                    placeholder="Write a caption..." 
                    className="w-full h-32 bg-transparent border-b border-white/10 py-2 outline-none resize-none font-bold text-lg placeholder:text-zinc-700"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleUpload} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-5 rounded-[30px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-900/20"
              >
                {isUploading ? <Loader2 className="animate-spin" size={24}/> : <Send size={24}/>}
                {isUploading ? 'UPLOADING...' : 'SHARE NOW'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Background Audio Element */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
}
