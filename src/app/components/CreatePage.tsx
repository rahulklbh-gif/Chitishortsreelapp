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

// --- R2 Configuration ---
// Dhyan dein: VITE_R2_ENDPOINT me 'https://ACCOUNT_ID.r2.cloudflarestorage.com' hona chahiye
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
  { id: 'p3', title: 'Upbeat Summer', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

export default function CreatePage() {
  const { user } = useAuth();
  
  // Base States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Camera & Recording States
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [recordedFacingMode, setRecordedFacingMode] = useState<'user' | 'environment'>('user');
  
  // UI Flow States
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFinalStep, setIsFinalStep] = useState(false);
  
  // Music & Effects States
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [musicList, setMusicList] = useState<any[]>(PERMANENT_MUSIC);

  // Refs for Media
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

  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) setMusicList([...data, ...PERMANENT_MUSIC]);
      } catch (e) { console.error("Music fetch error"); }
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
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      toast.error("Camera access denied.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  // --- 🎤 AUDIO MIXING FIX ---
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let trackToRecord = streamRef.current;

    // Mixing Logic
    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        const destination = ctx.createMediaStreamDestination();

        musicSource.connect(destination);
        micSource.connect(destination);
        destination.connect(ctx.destination); // Hearing while recording

        trackToRecord = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (e) {
        console.error("Mixing Error:", e);
      }
    }

    const recorder = new MediaRecorder(trackToRecord, { mimeType: 'video/webm;codecs=vp8,opus' });
    
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

  // --- ☁️ UPLOAD FIX (FAILED TO FETCH SOLUTION) ---
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const toastId = toast.loading('Publishing Chiti...');
    
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      // Fix: Use arrayBuffer instead of Buffer
      const arrayBuffer = await selectedFile.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      await r2Client.send(new PutObjectCommand({
        Bucket: 'chiti-videos', 
        Key: fileName,
        Body: fileData,
        ContentType: 'video/webm'
      }));

      const url = `${PUBLIC_R2_DOMAIN}/${fileName}`;
      
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: url, 
        caption, 
        user_id: user.id, 
        user_name: user.user_metadata?.full_name || 'Chiti User',
        thumbnail_url: url + "#t=0.1"
      }]);

      if (dbError) throw dbError;

      toast.success('Your Chiti is live!', { id: toastId });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message}. Bucket CORS settings check karein.`, { id: toastId });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] touch-none overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/90 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter">CHITI <span className="text-blue-500 uppercase">Creator</span></h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Lock size={64} className="text-blue-600 mb-6" />
          <h2 className="text-3xl font-black italic mb-4 uppercase">Login First</h2>
          <a href="/login" className="px-12 py-4 bg-blue-600 rounded-full font-black text-lg">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* START SCREEN */
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <button onClick={() => setIsCameraMode(true)} className="w-64 h-64 bg-blue-600 rounded-[70px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={70} />
            <span className="text-xl font-black italic mt-4 uppercase">Start Camera</span>
          </button>
          <label className="w-64 p-5 bg-gray-900/80 backdrop-blur-md rounded-[30px] flex items-center justify-center gap-3 border border-white/5 cursor-pointer">
            <Upload size={24} className="text-blue-500"/>
            <span className="font-bold uppercase tracking-widest text-sm">Upload Video</span>
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
        /* CAMERA SCREEN */
        <div className="relative flex-1 bg-black">
          <video 
            ref={videoPreviewRef} 
            className="h-full w-full object-cover" 
            style={{ 
              filter: filterStyles[selectedFilter], 
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' 
            }} 
            playsInline muted 
          />
          
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10"><RefreshCw/></button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-4 bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10 ${selectedMusic ? 'text-pink-400 border-pink-500' : ''}`}><Music/></button>
          </div>

          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
               <div className="flex bg-black/50 backdrop-blur-2xl p-1.5 rounded-full border border-white/10">
                 {[15, 30].map(s => (
                   <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-8 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all ${recordLimit === s ? 'bg-white text-black' : 'text-gray-400'}`}>{s}S</button>
                 ))}
               </div>
            )}
            <div className="relative flex items-center justify-center">
                <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all ${isRecording ? 'border-red-500/50 scale-110' : 'border-white'}`}>
                    <div className={`${isRecording ? 'w-10 h-10 bg-red-500 rounded-lg animate-pulse' : 'w-18 h-18 bg-white rounded-full'} transition-all`} />
                </button>
                <div className="absolute -top-12 px-4 py-1 bg-red-600 rounded-full font-black text-sm">{timeLeft}s</div>
            </div>
          </div>

          {showMusic && (
            <div className="absolute inset-0 bg-black/95 z-[1050] p-6 pt-24 overflow-y-auto no-scrollbar">
              <div className="flex justify-between items-center mb-10"><h2 className="text-3xl font-black italic tracking-tighter text-white">SOUNDS</h2><button onClick={() => setShowMusic(false)} className="p-2 bg-white/10 rounded-full"><X/></button></div>
              <div className="space-y-4">
                {musicList.map(m => (
                  <div key={m.id} className={`p-5 rounded-[30px] flex items-center justify-between border transition-all ${selectedMusic?.id === m.id ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-900/50 border-white/5'}`}>
                    <div className="flex items-center gap-5 flex-1" onClick={() => {
                        if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                        else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                    }}>
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">{playingMusicId === m.id ? <Pause fill="white"/> : <Play fill="white" className="ml-1"/>}</div>
                      <div>
                        <p className="font-bold text-base truncate w-40">{m.title}</p>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Chiti Original</p>
                      </div>
                    </div>
                    <button onClick={() => {setSelectedMusic(m); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null); toast.success("Sound applied!");}} className={`p-4 rounded-full transition-colors ${selectedMusic?.id === m.id ? 'bg-green-500' : 'bg-white/5'}`}><Check size={24}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PREVIEW SCREEN */
        <div className="fixed inset-0 bg-black flex flex-col z-[1100]">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              <video 
                src={previewUrl} 
                style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                autoPlay loop playsInline className="w-full h-full object-cover" 
              />
              
              <div className="absolute right-4 top-20 flex flex-col gap-4 z-[1110]">
                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pb-10">
                  {Object.keys(filterStyles).map((f) => (
                    <button 
                      key={f} 
                      onClick={() => setSelectedFilter(f)} 
                      className={`w-14 h-14 rounded-2xl border-2 flex-shrink-0 transition-all ${selectedFilter === f ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/40' : 'border-white/20'}`}
                      style={{ filter: filterStyles[f], background: 'linear-gradient(45deg, #222, #444)' }}
                    />
                  ))}
                </div>
              </div>

              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-3 bg-black/40 backdrop-blur-md rounded-full"><ArrowLeft/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-10 py-3.5 bg-blue-600 rounded-full font-black flex items-center gap-3">
                  NEXT <ChevronRight size={20}/>
                </button>
              </div>
            </div>
          ) : (
            /* POST DETAILS SCREEN */
            <div className="flex-1 p-6 flex flex-col bg-black">
              <div className="flex items-center gap-4 mb-10">
                 <button onClick={() => setIsFinalStep(false)} className="p-2 bg-white/10 rounded-full"><ArrowLeft/></button>
                 <h2 className="text-2xl font-black italic tracking-tighter uppercase">Share Video</h2>
              </div>
              
              <div className="flex gap-5 mb-10">
                <div className="w-32 h-48 bg-gray-900 rounded-[30px] overflow-hidden border-2 border-white/5 shadow-2xl">
                  <video src={previewUrl} style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} muted className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <textarea 
                    placeholder="Describe your video..." 
                    className="w-full bg-transparent border-b border-white/10 py-2 outline-none resize-none text-lg font-bold"
                    rows={5}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-auto pb-12">
                <button 
                  onClick={handleUpload} 
                  disabled={isUploading} 
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 py-5 rounded-[30px] font-black text-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="animate-spin"/> : <Send size={24}/>}
                  {isUploading ? 'UPLOADING...' : 'PUBLISH'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <audio ref={audioRef} hidden crossOrigin="anonymous" />
      
      {showFilters && isCameraMode && (
         <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-2xl p-8 rounded-t-[50px] z-[1050] border-t border-white/10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black italic uppercase">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="p-3 bg-white/10 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4">
               {Object.keys(filterStyles).map(f => (
                 <button 
                   key={f} 
                   onClick={() => setSelectedFilter(f)} 
                   className={`flex-shrink-0 w-20 h-20 rounded-3xl border-2 transition-all ${selectedFilter === f ? 'border-blue-500 scale-110' : 'border-white/10'}`}
                   style={{ filter: filterStyles[f], background: '#111' }}
                 />
               ))}
            </div>
         </div>
      )}
    </div>
  );
}
