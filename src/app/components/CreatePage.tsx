"use client";

import { Upload, Video, Sparkles, Loader2, Send, X, Camera, RefreshCw, Music, Check, Play, Pause } from 'lucide-react';
import { useState, useRef, useEffect } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- R2 Client (Direct Upload) ---
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
  
  // --- CAMERA & MUSIC STATES ---
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [musicList, setMusicList] = useState<any[]>([]);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // --- 1. FETCH MUSIC FROM SUPABASE ---
  useEffect(() => {
    const fetchMusic = async () => {
      const { data } = await supabase.from('music_library').select('*').limit(20);
      if (data) setMusicList(data);
    };
    fetchMusic();
  }, []);

  // --- 2. CAMERA LOGIC (FIXED ZOOM & SWITCHER) ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: 0.5625 // 9:16 Fix
        }, 
        audio: true 
      });
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraMode(true);
    } catch (err) {
      toast.error("Camera access failed. Check permissions!");
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    // Restart camera with new facing mode
    stopCamera();
    setTimeout(startCamera, 100);
  };

  const stopCamera = () => {
    const stream = videoPreviewRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
  };

  // --- 3. RECORDING LOGIC ---
  const startRecording = () => {
    const stream = videoPreviewRef.current?.srcObject as MediaStream;
    if (!stream) return;

    // Start selected music
    if (selectedMusic && audioRef.current) {
      audioRef.current.src = selectedMusic.audio_url;
      audioRef.current.play();
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `chiti-${Date.now()}.webm`, { type: 'video/webm' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
      if (audioRef.current) audioRef.current.pause();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setTimeLeft(recordLimit);

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
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  return (
    <div className="fixed inset-0 bg-black text-white touch-none overflow-hidden select-none">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/60 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {(isCameraMode || selectedFile) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X size={20}/></button>
        )}
      </div>

      {!isCameraMode && !selectedFile ? (
        /* Welcome Screen */
        <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
          <button onClick={startCamera} className="w-full h-64 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={50} className="mb-4" />
            <span className="text-2xl font-black">RECORD REEL</span>
          </button>
          <label className="w-full p-6 bg-gray-900 rounded-[30px] flex items-center justify-center gap-3 border border-gray-800">
            <Upload size={20}/>
            <span className="font-bold">Upload from Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* Camera Interface */
        <div className="relative h-full w-full bg-black">
          <video ref={videoPreviewRef} className="h-full w-full object-cover" playsInline muted />
          
          {/* Progress Bar */}
          <div className="absolute top-16 left-4 right-4 h-1 bg-white/20 rounded-full">
            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(timeLeft/recordLimit)*100}%` }} />
          </div>

          {/* Sidebar Controls */}
          <div className="absolute right-4 top-1/3 flex flex-col gap-6">
            <button onClick={toggleCamera} className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
              <RefreshCw size={24} />
            </button>
            <button onClick={() => setShowMusicLibrary(true)} className={`p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 ${selectedMusic ? 'text-blue-400' : ''}`}>
              <Music size={24} />
            </button>
          </div>

          {/* Music Display */}
          {selectedMusic && !isRecording && (
            <div className="absolute top-20 left-0 right-0 flex justify-center">
              <div className="bg-blue-600/80 px-4 py-1 rounded-full text-xs font-bold animate-pulse">
                🎵 {selectedMusic.title}
              </div>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6">
            {!isRecording && (
              <div className="flex bg-white/10 backdrop-blur-xl p-1 rounded-full">
                {[15, 30].map(s => (
                  <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-6 py-1.5 rounded-full text-sm font-bold ${recordLimit === s ? 'bg-white text-black' : ''}`}>{s}s</button>
                ))}
              </div>
            )}
            
            <button onClick={isRecording ? stopRecording : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500' : 'border-white'}`}>
              <div className={`transition-all ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-14 h-14 bg-white rounded-full'}`} />
            </button>
            <span className="font-mono text-xl">{timeLeft}s</span>
          </div>

          {/* Music Library Panel */}
          {showMusicLibrary && (
            <div className="absolute inset-0 bg-black/95 z-[60] p-6 pt-20 animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black">SELECT MUSIC</h2>
                <button onClick={() => setShowMusicLibrary(false)}><X/></button>
              </div>
              <div className="space-y-4 overflow-y-auto max-h-[70vh] no-scrollbar">
                {musicList.map((m) => (
                  <div key={m.id} onClick={() => {setSelectedMusic(m); setShowMusicLibrary(false);}} className={`p-4 rounded-2xl flex justify-between items-center ${selectedMusic?.id === m.id ? 'bg-blue-600' : 'bg-gray-900'}`}>
                    <div>
                      <p className="font-bold">{m.title}</p>
                      <p className="text-xs opacity-60">Original Audio</p>
                    </div>
                    {selectedMusic?.id === m.id ? <Check size={20}/> : <Play size={20}/>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Preview & Upload Interface */
        <div className="h-full flex flex-col p-4 pt-20 overflow-y-auto no-scrollbar">
          <div className="aspect-[9/16] w-full max-h-[450px] bg-gray-900 rounded-[30px] overflow-hidden mb-6 shadow-2xl">
            <video src={previewUrl} controls className="w-full h-full object-cover" />
          </div>
          <textarea 
            placeholder="Write a caption... #chiti" 
            className="w-full bg-gray-900 rounded-2xl p-4 outline-none border border-gray-800 focus:border-blue-500 mb-4"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button onClick={() => toast.success("Uploading logic is ready!")} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-xl shadow-lg shadow-blue-600/20">
            PUBLISH CHITI
          </button>
        </div>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
} 
