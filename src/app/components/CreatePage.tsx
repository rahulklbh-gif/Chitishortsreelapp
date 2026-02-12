"use client";

import { Upload, Video, Sparkles, Loader2, Send, X, Camera, RefreshCw, Music, Check, Play, Pause } from 'lucide-react';
import { useState, useRef, useEffect } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- R2 Config ---
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${import.meta.env.NEXT_PUBLIC_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

const PUBLIC_R2_DOMAIN = "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev";

export function CreatePage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Camera States
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // Effects & Music
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [musicList, setMusicList] = useState<any[]>([]);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Filter Styles Map
  const filterStyles: any = {
    none: "",
    bright: "brightness(1.2) contrast(1.1)",
    warm: "sepia(0.3) brightness(1.1)",
    mono: "grayscale(1)",
    cine: "contrast(1.4) saturate(1.4) hue-rotate(-10deg)"
  };

  // 1. Fetch Royalty Free Music from Database
  useEffect(() => {
    const loadMusic = async () => {
      const { data } = await supabase.from('music_library').select('*');
      if (data) setMusicList(data);
    };
    loadMusic();
  }, []);

  // 2. Navigation Hide/Show Logic
  useEffect(() => {
    const nav = document.querySelector('nav');
    if (isCameraMode) {
      if (nav) nav.style.visibility = 'hidden';
    } else {
      if (nav) nav.style.visibility = 'visible';
    }
  }, [isCameraMode]);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // 3. Robust Camera Logic
  const startCamera = async () => {
    try {
      stopTracks();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: 0.5625 
        }, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraMode(true);
      setTimeLeft(recordLimit);
    } catch (err: any) {
      toast.error("Camera reset ho raha hai, dobara click karein.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [facingMode]);

  // 4. Recording with Music Sync
  const startRecording = () => {
    if (!streamRef.current) return;

    // Play Music
    if (selectedMusic && audioRef.current) {
      audioRef.current.src = selectedMusic.audio_url;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setSelectedFile(new File([blob], "video.webm", { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
      if (audioRef.current) audioRef.current.pause();
    };

    recorder.start(100); // 100ms chunks for better safety
    mediaRecorderRef.current = recorder;
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden select-none z-[999]">
      
      {/* Header */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {(isCameraMode || selectedFile) && (
          <button onClick={() => { stopTracks(); setIsCameraMode(false); setSelectedFile(null); }} className="p-2 bg-white/10 rounded-full">
            <X size={20}/>
          </button>
        )}
      </div>

      {!isCameraMode && !selectedFile ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <button onClick={startCamera} className="w-full aspect-square max-w-[260px] bg-blue-600 rounded-[50px] flex flex-col items-center justify-center shadow-2xl">
            <Camera size={45} className="mb-2" />
            <span className="text-xl font-black">OPEN CAMERA</span>
          </button>
          <label className="w-full max-w-[260px] p-5 bg-gray-900 rounded-[25px] flex items-center justify-center gap-3 border border-gray-800">
            <Upload size={18} className="text-blue-500"/>
            <span className="font-bold">Gallery Upload</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1 bg-black">
          {/* Video with Real-time Filter */}
          <video 
            ref={videoPreviewRef} 
            className="h-full w-full object-cover" 
            style={{ filter: filterStyles[selectedFilter] }}
            playsInline muted 
          />
          
          {/* Controls - Sidebar */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
              <RefreshCw size={22} />
            </button>
            <button onClick={() => { setShowFilters(true); setShowMusic(false); }} className={`p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400' : ''}`}>
              <Sparkles size={22} />
            </button>
            <button onClick={() => { setShowMusic(true); setShowFilters(false); }} className={`p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 ${selectedMusic ? 'text-blue-400' : ''}`}>
              <Music size={22} />
            </button>
          </div>

          {/* Bottom Area: Timer + Record */}
          <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/10">
                {[15, 30].map(s => (
                  <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-5 py-1.5 rounded-full text-xs font-black transition-all ${recordLimit === s ? 'bg-white text-black' : 'text-gray-400'}`}>{s}s</button>
                ))}
              </div>
            )}
            
            <div className="flex flex-col items-center gap-2">
              <button onClick={isRecording ? stopRecording : startRecording} className={`w-18 h-18 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}>
                <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-14 h-14 bg-white rounded-full'}`} />
              </button>
              <span className="font-black text-xl drop-shadow-xl">{timeLeft}s</span>
            </div>
          </div>

          {/* Music Panel */}
          {showMusic && (
            <div className="absolute inset-0 bg-black/95 z-[1050] p-6 pt-20 animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black">MUSIC</h2>
                <button onClick={() => setShowMusic(false)}><X/></button>
              </div>
              <div className="space-y-4 overflow-y-auto max-h-[60vh]">
                {musicList.map(m => (
                  <div key={m.id} onClick={() => { setSelectedMusic(m); setShowMusic(false); }} className={`p-4 rounded-2xl flex justify-between items-center ${selectedMusic?.id === m.id ? 'bg-blue-600' : 'bg-gray-900 border border-white/5'}`}>
                    <span className="font-bold text-sm">{m.title}</span>
                    <Play size={18}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters Panel */}
          {showFilters && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-8 rounded-t-[40px] z-[1050] animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-6"><h2 className="font-black">FILTERS</h2><button onClick={() => setShowFilters(false)}><X/></button></div>
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4">
                {Object.keys(filterStyles).map(f => (
                  <button key={f} onClick={() => setSelectedFilter(f)} className="flex flex-col items-center gap-2">
                    <div className={`w-14 h-14 rounded-full border-2 ${selectedFilter === f ? 'border-blue-500' : 'border-gray-700'} bg-gray-800`} />
                    <span className="text-[10px] uppercase">{f}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Preview & Upload */
        <div className="flex-1 flex flex-col p-6 pt-20 overflow-y-auto no-scrollbar pb-32">
          <div className="aspect-[9/16] w-full bg-gray-900 rounded-[30px] overflow-hidden mb-6 shadow-2xl relative">
            <video src={previewUrl} style={{ filter: filterStyles[selectedFilter] }} controls className="w-full h-full object-cover" />
          </div>
          <textarea 
            placeholder="Kuch likhein... #chiti" 
            className="w-full bg-gray-900 rounded-2xl p-5 outline-none border border-gray-800 text-sm mb-6"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button onClick={() => toast.success("Publishing feature coming soon!")} className="w-full bg-blue-600 py-5 rounded-[25px] font-black text-xl active:scale-95 transition-all">
            POST CHITI
          </button>
        </div>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
} 
