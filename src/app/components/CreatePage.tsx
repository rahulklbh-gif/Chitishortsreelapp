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

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const filters = [
    { name: 'None', value: 'none', class: '' },
    { name: 'Warm', value: 'bright', class: 'brightness-110 sepia-[0.1]' },
    { name: 'Mono', value: 'gray', class: 'grayscale' },
    { name: 'Vibe', value: 'cine', class: 'contrast-125 saturate-125' },
  ];

  // --- 1. NAVIGATION HIDER LOGIC ---
  // Is logic se hum poore app ki bottom navigation bar ko control karenge
  useEffect(() => {
    const bottomNav = document.querySelector('nav'); // Assuming your nav is in a <nav> tag
    if (isCameraMode) {
      if (bottomNav) bottomNav.style.display = 'none';
    } else {
      if (bottomNav) bottomNav.style.display = 'flex';
    }
    
    // Cleanup on unmount
    return () => { if (bottomNav) bottomNav.style.display = 'flex'; };
  }, [isCameraMode]);

  // --- 2. CAMERA CONTROLS ---
  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      stopAllTracks();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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
    } catch (err: any) {
      toast.error("Camera Error: " + err.message);
    }
  };

  const toggleCamera = () => setFacingMode(prev => prev === 'user' ? 'environment' : 'user');

  useEffect(() => {
    if (isCameraMode) startCamera();
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
      setIsCameraMode(false); // Ye navigation wapas le aayega
      if (audioRef.current) audioRef.current.pause();
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { stopRecording(); return 0; }
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

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const toastId = toast.loading('Publishing...');
    try {
      const baseName = `${Math.random().toString(36).substring(2)}-${Date.now()}`;
      const videoFileName = `${baseName}.webm`;
      const videoBuffer = await selectedFile.arrayBuffer();
      await r2Client.send(new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: videoFileName,
        Body: new Uint8Array(videoBuffer),
        ContentType: 'video/webm',
      }));
      const videoUrl = `${PUBLIC_R2_DOMAIN}/${videoFileName}`;
      await supabase.from('posts').insert([{
        video_url: videoUrl,
        thumbnail_url: videoUrl + "#t=0.1",
        caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Chiti User'
      }]);
      toast.success('Shared successfully! 🚀', { id: toastId });
      setSelectedFile(null);
      setPreviewUrl('');
    } catch (err) { toast.error("Upload failed!"); } finally { setIsUploading(false); }
  };

  return (
    // Fixed: h-[100dvh] ensures full mobile screen without cutting
    <div className="fixed inset-0 h-[100dvh] bg-black text-white overflow-hidden flex flex-col z-[100]">
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-[110] bg-gradient-to-b from-black/60 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {(isCameraMode || selectedFile) && (
          <button onClick={() => { stopAllTracks(); setIsCameraMode(false); setSelectedFile(null); }} className="p-2 bg-white/10 rounded-full">
            <X size={20}/>
          </button>
        )}
      </div>

      {!isCameraMode && !selectedFile ? (
        /* Welcome Selection */
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <button onClick={startCamera} className="w-full aspect-square max-w-[280px] bg-gradient-to-br from-blue-600 to-blue-800 rounded-[60px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={50} className="mb-3" />
            <span className="text-2xl font-black italic">START CAMERA</span>
          </button>
          <label className="w-full max-w-[280px] p-5 bg-gray-900 rounded-[30px] flex items-center justify-center gap-3 border border-gray-800 active:bg-gray-800">
            <Upload size={20} className="text-blue-500"/>
            <span className="font-bold">From Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* Full Screen Camera */
        <div className="relative flex-1 w-full h-full bg-black">
          <video 
            ref={videoPreviewRef} 
            className={`h-full w-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} 
            playsInline muted 
          />
          
          {/* Controls Sidebar (Medium Size) */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-8 z-[120]">
            <button onClick={toggleCamera} className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 active:scale-90">
              <RefreshCw size={24} />
            </button>
            <button onClick={() => setShowFilters(true)} className={`p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400' : ''}`}>
              <Sparkles size={24} />
            </button>
            <button onClick={() => setShowMusic(true)} className={`p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10`}>
              <Music size={24} />
            </button>
          </div>

          {/* Bottom Recording Section - Now much clearer without Nav buttons */}
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6">
            {!isRecording && (
              <div className="flex bg-black/40 backdrop-blur-2xl p-1 rounded-full border border-white/10">
                {[15, 30].map(s => (
                  <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-6 py-1.5 rounded-full text-sm font-black transition-all ${recordLimit === s ? 'bg-white text-black shadow-lg' : 'text-gray-400'}`}>{s}s</button>
                ))}
              </div>
            )}
            
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={isRecording ? stopRecording : startRecording} 
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}
              >
                <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-16 h-16 bg-white rounded-full'}`} />
              </button>
              <span className="font-black text-2xl drop-shadow-2xl">{timeLeft}s</span>
            </div>
          </div>
        </div>
      ) : (
        /* Preview & Upload Section (Nav Buttons will reappear here) */
        <div className="flex-1 flex flex-col p-5 pt-20 overflow-y-auto no-scrollbar pb-24">
          <div className="aspect-[9/16] w-full max-h-[460px] bg-gray-900 rounded-[40px] overflow-hidden mb-6 shadow-2xl border border-gray-800">
            <video src={previewUrl} controls className="w-full h-full object-cover" />
          </div>
          <textarea 
            placeholder="What's on your mind? #chiti" 
            className="w-full bg-gray-900 rounded-2xl p-5 outline-none border border-gray-800 focus:border-blue-500 text-base mb-6"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button 
            onClick={handleUpload} 
            disabled={isUploading} 
            className="w-full bg-blue-600 py-5 rounded-[25px] font-black text-xl shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Send size={22}/>}
            {isUploading ? 'SHARING...' : 'POST CHITI'}
          </button>
        </div>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
} 
