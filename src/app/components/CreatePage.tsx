"use client";

import { Upload, Video, Sparkles, Loader2, Send, X, Camera, RefreshCw, Music, Check, Play, Pause } from 'lucide-react';
import { useState, useRef, useEffect } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- R2 Client Configuration ---
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

const FALLBACK_MUSIC = [
  { id: 'm1', title: 'Chiti Beats', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'm2', title: 'Viral Mood', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }
];

export function CreatePage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // --- CAMERA & RECORDING STATES ---
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [musicList, setMusicList] = useState<any[]>([]);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null); // Stream track ko track karne ke liye

  const filters = [
    { name: 'None', value: 'none', class: '' },
    { name: 'Warm', value: 'bright', class: 'brightness-110 sepia-[0.1]' },
    { name: 'Mono', value: 'gray', class: 'grayscale' },
    { name: 'Vibe', value: 'cine', class: 'contrast-125 saturate-125' },
  ];

  // --- 1. CLEANUP FUNCTION (Cures Camera Error) ---
  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // --- 2. CAMERA ENGINE ---
  const startCamera = async () => {
    try {
      stopAllTracks(); // Pehle sab band karo
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 }, // Ideal resolution taaki zoom na ho
          height: { ideal: 720 },
          aspectRatio: { ideal: 0.5625 } 
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
      console.error(err);
      toast.error("Camera Error: " + err.message);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopAllTracks(); // Unmount par band
  }, [facingMode]);

  // --- 3. RECORDING & AUTO-SAVE ---
  const startRecording = () => {
    if (!streamRef.current) return;

    if (selectedMusic && audioRef.current) {
      audioRef.current.src = selectedMusic.audio_url;
      audioRef.current.play();
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `chiti-${Date.now()}.webm`, { type: 'video/webm' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopAllTracks();
      setIsCameraMode(false);
      if (audioRef.current) audioRef.current.pause();
    };

    recorder.start();
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
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // --- UI RENDER ---
  return (
    // Fixed: h-[100dvh] use kiya hai taaki mobile browser mein icons na kutein
    <div className="fixed inset-0 h-[100dvh] bg-black text-white overflow-hidden flex flex-col">
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-lg font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {(isCameraMode || selectedFile) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full">
            <X size={18}/>
          </button>
        )}
      </div>

      {!isCameraMode && !selectedFile ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <button onClick={startCamera} className="w-full h-1/2 bg-blue-600 rounded-[40px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={40} className="mb-2" />
            <span className="text-xl font-black">RECORD</span>
          </button>
          <label className="w-full p-5 bg-gray-900 rounded-[25px] flex items-center justify-center gap-3 border border-gray-800">
            <Upload size={18} className="text-blue-500"/>
            <span className="font-bold">Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1 w-full bg-black">
          <video 
            ref={videoPreviewRef} 
            className={`h-full w-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} 
            playsInline muted 
          />
          
          {/* Sidebar (Medium Size) */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-50">
            <button onClick={toggleCamera} className="p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
              <RefreshCw size={20} />
            </button>
            <button onClick={() => setShowFilters(true)} className={`p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400' : ''}`}>
              <Sparkles size={20} />
            </button>
            <button onClick={() => setShowMusic(true)} className={`p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 ${selectedMusic ? 'text-blue-400' : ''}`}>
              <Music size={20} />
            </button>
          </div>

          {/* Bottom Controls - Margin bottom thoda badhaya hai taaki cut na ho */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 mb-safe">
            {!isRecording && (
              <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/10">
                {[15, 30].map(s => (
                  <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-5 py-1.5 rounded-full text-xs font-black ${recordLimit === s ? 'bg-white text-black' : 'text-gray-400'}`}>{s}s</button>
                ))}
              </div>
            )}
            
            <button 
              onClick={isRecording ? stopRecording : startRecording} 
              className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500' : 'border-white'}`}
            >
              <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-16 h-16 bg-white rounded-full'}`} />
            </button>
            <span className="font-black text-xl drop-shadow-lg">{timeLeft}s</span>
          </div>

          {/* Filters Sheet */}
          {showFilters && (
            <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 p-6 rounded-t-[30px] z-[70] animate-in slide-in-from-bottom">
              <div className="flex justify-between mb-4">
                <span className="font-black">FILTERS</span>
                <button onClick={() => setShowFilters(false)}><X size={18}/></button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {filters.map(f => (
                  <button key={f.value} onClick={() => setSelectedFilter(f.value)} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full border border-white/20 bg-gray-700" />
                    <span className="text-[10px]">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Preview UI */
        <div className="flex-1 flex flex-col p-4 pt-20 overflow-y-auto no-scrollbar">
          <div className="aspect-[9/16] w-full bg-gray-900 rounded-[30px] overflow-hidden mb-6 shadow-2xl">
            <video src={previewUrl} controls className="w-full h-full object-cover" />
          </div>
          <textarea 
            placeholder="Share your story... #chiti" 
            className="w-full bg-gray-900 rounded-2xl p-4 outline-none border border-gray-800 focus:border-blue-500 text-sm mb-4"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button className="w-full bg-blue-600 py-4 rounded-2xl font-black text-lg active:scale-95 transition-all">
            PUBLISH
          </button>
        </div>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
} 
