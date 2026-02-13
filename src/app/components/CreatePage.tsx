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
 * CLOUDFLARE R2 CLIENT SETUP
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

const PUBLIC_R2_DOMAIN = "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev";

const PERMANENT_MUSIC = [
  { id: 'p1', title: 'Chiti Beats Viral', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'p2', title: 'Lofi Chill Night', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'p3', title: 'Upbeat Summer', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'p4', title: 'Desi Hip Hop', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' }
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

  // -- Refs for Audio/Video Engine --
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // -- 12 Professional Filters --
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

  // Load Music Library
  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) setMusicList([...data, ...PERMANENT_MUSIC]);
      } catch (e) { console.error("Music fetch error"); }
    };
    loadMusic();
  }, []);

  // Cleanup Function
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

  // Camera Initialization
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
        audio: { echoCancellation: true, noiseSuppression: true }
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
      toast.error("Camera permissions check karein.");
      console.error(err);
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  // --- 🎤 ADVANCED AUDIO MIXING ENGINE ---
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let combinedStream = streamRef.current;

    // Mixing Music + Mic
    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        // Music element source
        const musicSource = ctx.createMediaElementSource(audioRef.current);
        // Mic stream source
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        
        const destination = ctx.createMediaStreamDestination();

        // Connect both to the destination
        musicSource.connect(destination);
        micSource.connect(destination);
        
        // Connect to speakers so user can hear the music
        destination.connect(ctx.destination);

        // Combine original video track with newly mixed audio track
        combinedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (e) {
        console.error("Audio Mixing Failed:", e);
      }
    }

    const recorder = new MediaRecorder(combinedStream, { 
      mimeType: 'video/webm;codecs=vp8,opus',
      videoBitsPerSecond: 2500000 // 2.5 Mbps for quality
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

  // --- ☁️ R2 UPLOAD LOGIC (FIXED FETCH) ---
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const tid = toast.loading('Publishing your Reel...');
    
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      // Convert to Uint8Array for browser-based S3 upload
      const arrayBuffer = await selectedFile.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      // Upload to Cloudflare R2
      await r2Client.send(new PutObjectCommand({
        Bucket: 'chiti-videos', 
        Key: fileName,
        Body: fileData,
        ContentType: 'video/webm'
      }));

      const url = `${PUBLIC_R2_DOMAIN}/${fileName}`;
      
      // Save metadata to Supabase
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: url, 
        caption, 
        user_id: user.id, 
        user_name: user.user_metadata?.full_name || 'Chiti Star',
        thumbnail_url: url + "#t=0.1"
      }]);

      if (dbError) throw dbError;

      toast.success('Successfully Posted! 🚀', { id: tid });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error("Detailed Upload Error:", err);
      toast.error(`Upload Fail: ${err.message}. Check Endpoint/CORS.`, { id: tid });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] touch-none overflow-hidden font-sans">
      
      {/* 1. TOP HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/90 to-transparent">
        <h1 className="text-2xl font-black italic tracking-tighter text-blue-500">CHITI</h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full active:scale-90 transition-transform">
            <X size={24}/>
          </button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Lock size={60} className="text-blue-500 mb-6 animate-pulse" />
          <h2 className="text-3xl font-black italic mb-6 uppercase">Login to Create</h2>
          <a href="/login" className="px-14 py-4 bg-blue-600 rounded-full font-black text-lg shadow-lg shadow-blue-600/30">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* 2. INITIAL SELECTION SCREEN */
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[80px] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <button onClick={() => setIsCameraMode(true)} className="relative w-64 h-64 bg-zinc-900 rounded-[70px] flex flex-col items-center justify-center border border-white/10 active:scale-95 transition-all">
              <Camera size={80} className="text-blue-500 mb-4" />
              <span className="text-xl font-black italic uppercase tracking-widest">Shoot Now</span>
            </button>
          </div>

          <label className="w-64 p-5 bg-white/5 backdrop-blur-xl rounded-[30px] flex items-center justify-center gap-3 border border-white/10 cursor-pointer hover:bg-white/10 active:scale-95 transition-all">
            <Upload size={24} className="text-blue-400"/>
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
        /* 3. CAMERA INTERFACE */
        <div className="relative flex-1 bg-black overflow-hidden">
          <video 
            ref={videoPreviewRef} 
            className="h-full w-full object-cover" 
            style={{ 
              filter: filterStyles[selectedFilter], 
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' 
            }} 
            playsInline muted 
          />
          
          {/* CAMERA SIDEBAR */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 active:bg-blue-600"><RefreshCw size={26}/></button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles size={26}/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 ${selectedMusic ? 'text-pink-400 border-pink-500' : ''}`}><Music size={26}/></button>
          </div>

          {/* RECORDING BUTTON & TIMER */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
               <div className="flex bg-zinc-900/80 backdrop-blur-3xl p-1.5 rounded-full border border-white/10 shadow-2xl">
                 {[15, 30].map(s => (
                   <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-8 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === s ? 'bg-white text-black' : 'text-zinc-500'}`}>{s}S</button>
                 ))}
               </div>
            )}
            
            <div className="relative flex items-center justify-center">
                <button 
                  onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} 
                  className={`w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all duration-500 ${isRecording ? 'border-red-500/50 scale-125' : 'border-white'}`}
                >
                    <div className={`${isRecording ? 'w-10 h-10 bg-red-500 rounded-xl animate-pulse' : 'w-18 h-18 bg-white rounded-full'}`} />
                </button>
                <div className="absolute -top-14 px-5 py-1.5 bg-red-600 rounded-full font-black text-xs shadow-lg shadow-red-600/40">{timeLeft}s</div>
            </div>
          </div>

          {/* MUSIC LIBRARY OVERLAY */}
          {showMusic && (
            <div className="absolute inset-0 bg-zinc-950 z-[1050] p-6 pt-24 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic tracking-tighter">SELECT MUSIC</h2>
                <button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full"><X size={24}/></button>
              </div>
              <div className="space-y-4">
                {musicList.map(m => (
                  <div key={m.id} className={`p-5 rounded-[35px] flex items-center justify-between border transition-all ${selectedMusic?.id === m.id ? 'bg-blue-600/20 border-blue-500' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex items-center gap-5 flex-1" onClick={() => {
                        if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                    }}>
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">{playingMusicId === m.id ? <Pause fill="white"/> : <Play fill="white" className="ml-1"/>}</div>
                      <div>
                        <p className="font-bold text-base truncate w-44">{m.title}</p>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Chiti Original</p>
                      </div>
                    </div>
                    <button onClick={() => {setSelectedMusic(m); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null); toast.success("Sound applied!");}} className={`p-4 rounded-full ${selectedMusic?.id === m.id ? 'bg-green-500 text-white' : 'bg-white/5 text-zinc-400'}`}><Check size={24}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 4. PREVIEW & POST SECTION */
        <div className="fixed inset-0 bg-black flex flex-col z-[1100] animate-in fade-in duration-500">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              <video 
                src={previewUrl} 
                style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                autoPlay loop playsInline className="w-full h-full object-cover" 
              />
              
              {/* FILTER QUICK SELECT */}
              <div className="absolute right-4 top-24 flex flex-col gap-4 z-[1110]">
                <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto no-scrollbar pb-10">
                  {Object.keys(filterStyles).map((f) => (
                    <button 
                      key={f} 
                      onClick={() => setSelectedFilter(f)} 
                      className={`w-14 h-14 rounded-2xl border-2 flex-shrink-0 transition-all ${selectedFilter === f ? 'border-blue-500 scale-110 shadow-xl shadow-blue-500/40' : 'border-white/10'}`}
                      style={{ filter: filterStyles[f], background: 'linear-gradient(45deg, #111, #222)' }}
                    />
                  ))}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-4 bg-white/5 backdrop-blur-xl rounded-full border border-white/10"><ArrowLeft size={24}/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-10 py-4 bg-blue-600 rounded-full font-black flex items-center gap-3 shadow-2xl shadow-blue-600/40 active:scale-95 transition-all">
                  NEXT <ChevronRight size={22}/>
                </button>
              </div>
            </div>
          ) : (
            /* 5. FINAL POST DETAILS */
            <div className="flex-1 p-6 flex flex-col bg-zinc-950">
              <div className="flex items-center gap-4 mb-10 pt-4">
                 <button onClick={() => setIsFinalStep(false)} className="p-3 bg-white/5 rounded-full"><ArrowLeft size={24}/></button>
                 <h2 className="text-2xl font-black italic tracking-tighter uppercase">Details</h2>
              </div>
              
              <div className="flex gap-6 mb-12">
                <div className="w-36 h-56 bg-zinc-900 rounded-[35px] overflow-hidden border border-white/10 shadow-2xl flex-shrink-0">
                  <video 
                    src={previewUrl} 
                    style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                    muted className="w-full h-full object-cover" 
                  />
                </div>
                <div className="flex-1">
                  <textarea 
                    placeholder="Write a catchy caption..." 
                    className="w-full bg-transparent border-b border-white/5 py-3 outline-none resize-none text-lg font-bold placeholder:text-zinc-700"
                    rows={6}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                  <div className="flex gap-2 mt-4">
                    <span className="px-4 py-1.5 bg-zinc-900 rounded-full text-[10px] font-black text-blue-500 border border-blue-500/20">#chiti</span>
                    <span className="px-4 py-1.5 bg-zinc-900 rounded-full text-[10px] font-black text-blue-500 border border-blue-500/20">#viral</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pb-10">
                <button 
                  onClick={handleUpload} 
                  disabled={isUploading} 
                  className="w-full h-20 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[35px] font-black text-xl flex items-center justify-center gap-4 shadow-2xl shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="animate-spin" size={28}/> : <Send size={28}/>}
                  {isUploading ? 'UPLOADING...' : 'POST TO CHITI'}
                </button>
                <p className="text-center text-zinc-600 text-[10px] mt-6 font-bold uppercase tracking-[4px]">Verified Creator Content</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BACKGROUND MEDIA ELEMENTS */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
      
      {/* FILTER BOTTOM DRAWER (Mobile Style) */}
      {showFilters && isCameraMode && (
         <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-3xl p-10 rounded-t-[55px] z-[1050] border-t border-white/10 animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black italic tracking-widest uppercase">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="p-3 bg-white/5 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6">
               {Object.keys(filterStyles).map(f => (
                 <div key={f} className="flex flex-col items-center gap-3">
                   <button 
                     onClick={() => setSelectedFilter(f)} 
                     className={`flex-shrink-0 w-20 h-20 rounded-3xl border-2 transition-all ${selectedFilter === f ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/40' : 'border-white/5'}`}
                     style={{ filter: filterStyles[f], background: '#111' }}
                   />
                   <span className="text-[10px] font-black uppercase text-zinc-500">{f}</span>
                 </div>
               ))}
            </div>
         </div>
      )}
    </div>
  );
} 
