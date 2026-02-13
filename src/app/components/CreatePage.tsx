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

// --- R2 Client Configuration ---
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${import.meta.env.VITE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [finalDuration, setFinalDuration] = useState(0);
  
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
  const [isFinalStep, setIsFinalStep] = useState(false); // Next button toggle
  
  // Customization States
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [musicList, setMusicList] = useState<any[]>(PERMANENT_MUSIC);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 12 Professional Filters
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

  // 1. Load Music
  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) setMusicList([...data, ...PERMANENT_MUSIC]);
      } catch (e) { console.error("Music fetch error"); }
    };
    loadMusic();
  }, []);

  // 2. Stop Camera & Cleanup
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

  // 3. Start Camera
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
      toast.error("Camera access denied");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  // 4. Recording Logic
  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode); // Store facing mode for mirroring fix
    let finalStream = streamRef.current;

    if (selectedMusic && audioRef.current) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const sourceMic = audioCtx.createMediaStreamSource(streamRef.current);
      const sourceMusic = audioCtx.createMediaElementSource(audioRef.current);
      const destination = audioCtx.createMediaStreamDestination();
      sourceMic.connect(destination);
      sourceMusic.connect(destination);
      finalStream = new MediaStream([streamRef.current.getVideoTracks()[0], destination.stream.getAudioTracks()[0]]);
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], `chiti-${Date.now()}.webm`, { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
      stopTracks();
    };

    recorder.start();
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

  // 5. Final Upload
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const toastId = toast.loading('Publishing to Chiti...');
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      await r2Client.send(new PutObjectCommand({
        Bucket: 'chiti-videos', Key: fileName,
        Body: new Uint8Array(await selectedFile.arrayBuffer()),
        ContentType: 'video/webm'
      }));
      const url = `${PUBLIC_R2_DOMAIN}/${fileName}`;
      await supabase.from('posts').insert([{
        video_url: url, caption, user_id: user.id, user_name: user.user_metadata?.full_name || 'Chiti User',
        thumbnail_url: url + "#t=0.1"
      }]);
      toast.success('Video Live! 🚀', { id: toastId });
      window.location.reload();
    } catch (err) {
      toast.error("Upload failed");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] touch-none overflow-hidden">
      
      {/* Header */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/90 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Lock size={60} className="text-blue-500 mb-4" />
          <h2 className="text-2xl font-black italic uppercase">Login Required</h2>
          <a href="/login" className="mt-6 px-10 py-4 bg-blue-600 rounded-full font-black">LOGIN NOW</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        /* Selection Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <button onClick={() => setIsCameraMode(true)} className="w-64 h-64 bg-blue-600 rounded-[60px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={60} />
            <span className="text-xl font-black italic mt-2">OPEN CAMERA</span>
          </button>
          <label className="w-64 p-5 bg-gray-900 rounded-[30px] flex items-center justify-center gap-3 border border-white/10 cursor-pointer active:scale-95">
            <Upload size={20} className="text-blue-500"/>
            <span className="font-bold">GALLERY</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
               const file = e.target.files?.[0];
               if(file) {
                 setSelectedFile(file);
                 setPreviewUrl(URL.createObjectURL(file));
                 setRecordedFacingMode('environment'); // Gallery videos don't mirror
               }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* Camera Screen */
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
          
          <div className="absolute right-4 top-1/4 flex flex-col gap-6">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-md rounded-full border border-white/10"><RefreshCw/></button>
            <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-blue-400"><Sparkles/></button>
            <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-pink-400"><Music/></button>
          </div>

          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6">
            {!isRecording && (
               <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/10">
                 {[15, 30].map(s => (
                   <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-6 py-2 rounded-full text-xs font-black ${recordLimit === s ? 'bg-white text-black' : 'text-gray-400'}`}>{s}s</button>
                 ))}
               </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500' : 'border-white'}`}>
                <div className={`${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-16 h-16 bg-white rounded-full'} transition-all`} />
            </button>
            <span className="font-black text-2xl">{timeLeft}s</span>
          </div>

          {/* Music Picker */}
          {showMusic && (
            <div className="absolute inset-0 bg-black/95 z-[1050] p-6 pt-20 overflow-y-auto">
              <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black italic">CHOOSE SOUND</h2><button onClick={() => setShowMusic(false)}><X/></button></div>
              {musicList.map(m => (
                <div key={m.id} className="p-4 mb-4 bg-gray-900 rounded-3xl flex items-center justify-between border border-white/5">
                  <div className="flex items-center gap-4" onClick={() => {
                     if(playingMusicId === m.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                     else { audioRef.current!.src = m.audio_url; audioRef.current?.play(); setPlayingMusicId(m.id); }
                  }}>
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">{playingMusicId === m.id ? <Pause/> : <Play/>}</div>
                    <p className="font-bold truncate w-40">{m.title}</p>
                  </div>
                  <button onClick={() => {setSelectedMusic(m); setShowMusic(false); audioRef.current?.pause();}} className="p-3 bg-white/10 rounded-full"><Check className="text-green-500"/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Preview & Post Screen */
        <div className="fixed inset-0 bg-black flex flex-col z-[1100]">
          {!isFinalStep ? (
            /* Step 1: Filters & Preview */
            <div className="flex-1 flex flex-col">
              <div className="relative flex-1">
                <video 
                  src={previewUrl} 
                  style={{ 
                    filter: filterStyles[selectedFilter],
                    // MIRRORING FIX: Agar front camera se record kiya tha toh yahan bhi mirror rakho
                    transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' 
                  }} 
                  autoPlay loop muted playsInline
                  className="w-full h-full object-cover" 
                />
                <button onClick={() => setIsFinalStep(true)} className="absolute top-6 right-6 px-8 py-3 bg-blue-600 rounded-full font-black flex items-center gap-2 shadow-xl shadow-blue-600/30">
                  NEXT <ChevronRight size={20}/>
                </button>
                <button onClick={() => setPreviewUrl('')} className="absolute top-6 left-6 p-3 bg-black/40 rounded-full"><ArrowLeft/></button>
              </div>

              {/* 12 Filter Selection List */}
              <div className="p-6 bg-black border-t border-white/10">
                <p className="text-xs font-black text-gray-500 mb-4 uppercase tracking-widest">Select Visual Filter</p>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {Object.keys(filterStyles).map((f) => (
                    <button key={f} onClick={() => setSelectedFilter(f)} className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className={`w-16 h-16 rounded-2xl border-2 ${selectedFilter === f ? 'border-blue-500 scale-110' : 'border-white/10'} bg-gray-800 transition-all overflow-hidden`}>
                         <div className="w-full h-full" style={{ filter: filterStyles[f], background: 'linear-gradient(45deg, #333, #666)' }} />
                      </div>
                      <span className="text-[10px] font-bold uppercase">{f}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Caption & Upload */
            <div className="flex-1 p-6 flex flex-col">
              <div className="flex items-center gap-4 mb-8">
                 <button onClick={() => setIsFinalStep(false)} className="p-2 bg-white/10 rounded-full"><ArrowLeft/></button>
                 <h2 className="text-xl font-black italic">POST VIDEO</h2>
              </div>
              
              <div className="flex gap-4 mb-8">
                <div className="w-24 h-36 bg-gray-900 rounded-xl overflow-hidden border border-white/10">
                  <video 
                    src={previewUrl} 
                    style={{ filter: filterStyles[selectedFilter], transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} 
                    muted className="w-full h-full object-cover" 
                  />
                </div>
                <textarea 
                  placeholder="Describe your chiti video..." 
                  className="flex-1 bg-transparent border-b border-white/10 py-2 outline-none resize-none text-lg font-medium"
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-900 rounded-2xl flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-400">Audio:</span>
                  <span className="text-sm font-black text-blue-400">{selectedMusic ? selectedMusic.title : 'Original Sound'}</span>
                </div>
                <div className="p-4 bg-gray-900 rounded-2xl flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-400">Visuals:</span>
                  <span className="text-sm font-black text-pink-400 capitalize">{selectedFilter} Filter</span>
                </div>
              </div>

              <div className="mt-auto pb-10">
                <button 
                  onClick={handleUpload} 
                  disabled={isUploading} 
                  className="w-full bg-blue-600 py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl shadow-blue-600/40 active:scale-95 transition-all"
                >
                  {isUploading ? <Loader2 className="animate-spin"/> : <Send size={24}/>}
                  {isUploading ? 'UPLOADING...' : 'PUBLISH NOW'}
                </button>
                <p className="text-center text-[10px] text-gray-500 mt-4 uppercase">By posting, you agree to Chiti Community Guidelines</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ghost Audio for mixing */}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
      
      {/* Show Filters Popup in Camera Mode */}
      {showFilters && isCameraMode && (
         <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-8 rounded-t-[40px] z-[1050] border-t border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-black italic">VISUAL FILTERS</h2>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar">
               {Object.keys(filterStyles).map(f => (
                 <button key={f} onClick={() => setSelectedFilter(f)} className={`flex-shrink-0 w-16 h-16 rounded-full border-2 ${selectedFilter === f ? 'border-blue-500' : 'border-gray-700'} bg-gray-800`} />
               ))}
            </div>
         </div>
      )}
    </div>
  );
} 
