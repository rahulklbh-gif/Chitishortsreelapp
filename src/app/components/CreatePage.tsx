"use client";

import { Upload, Video, Sparkles, Loader2, Send, X, Camera, RefreshCw, Music, Check, Play, Pause, Trash2 } from 'lucide-react';
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

// Royalty Free Music Fallback (Agar Supabase khali ho)
const FALLBACK_MUSIC = [
  { id: 'm1', title: 'Happy Upbeat', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', thumbnail_url: '' },
  { id: 'm2', title: 'Acoustic Vibe', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', thumbnail_url: '' },
  { id: 'm3', title: 'Chill Lo-Fi', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', thumbnail_url: '' }
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
  
  // Panels
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [musicList, setMusicList] = useState<any[]>([]);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const filters = [
    { name: 'None', value: 'none', class: '' },
    { name: 'Warm', value: 'bright', class: 'brightness-110 sepia-[0.2]' },
    { name: 'B&W', value: 'gray', class: 'grayscale' },
    { name: 'Deep', value: 'cine', class: 'contrast-125 saturate-150' },
  ];

  // --- 1. FETCH MUSIC ---
  useEffect(() => {
    const fetchMusic = async () => {
      const { data } = await supabase.from('music_library').select('*').limit(20);
      if (data && data.length > 0) {
        setMusicList(data);
      } else {
        setMusicList(FALLBACK_MUSIC);
      }
    };
    fetchMusic();
  }, []);

  // --- 2. CAMERA LOGIC (NO ZOOMING FIX) ---
  const startCamera = async () => {
    try {
      // Pehle purana stream clear karo permission error se bachne ke liye
      if (videoPreviewRef.current?.srcObject) {
        const tracks = (videoPreviewRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 0.5625 } // 9:16 portrait
        }, 
        audio: true 
      });

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(e => console.error("Play failed", e));
      }
      setIsCameraMode(true);
      setTimeLeft(recordLimit);
    } catch (err: any) {
      console.error(err);
      toast.error("Camera error: " + (err.message || "Please check permissions"));
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    // Camera restart logic handled in useEffect if needed, but manual for now
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
  }, [facingMode]);

  const stopCamera = () => {
    const stream = videoPreviewRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setIsCameraMode(false);
  };

  // --- 3. RECORDING & AUTO SAVE ---
  const startRecording = () => {
    const stream = videoPreviewRef.current?.srcObject as MediaStream;
    if (!stream) return;

    if (selectedMusic && audioRef.current) {
      audioRef.current.src = selectedMusic.audio_url;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `chiti-${Date.now()}.webm`, { type: 'video/webm' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
      if (audioRef.current) audioRef.current.pause();
      toast.success("Recording saved automatically!");
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopRecording(); // Automatically stops and triggers recorder.onstop
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

  // --- 4. UPLOAD LOGIC ---
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setProgress(10);
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
        user_name: user.user_metadata?.full_name || 'User'
      }]);

      toast.success('Shared successfully! 🚀', { id: toastId });
      setSelectedFile(null);
      setPreviewUrl('');
    } catch (err) {
      toast.error("Upload failed!");
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white touch-none overflow-hidden select-none">
      
      {/* Dynamic Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50">
        <h1 className="text-lg font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {(isCameraMode || selectedFile) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X size={18}/></button>
        )}
      </div>

      {!isCameraMode && !selectedFile ? (
        /* Welcome Selection */
        <div className="h-full flex flex-col items-center justify-center p-6 gap-5">
          <button onClick={startCamera} className="w-full h-72 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[40px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={40} className="mb-3" />
            <span className="text-xl font-bold">START CAMERA</span>
          </button>
          <label className="w-full p-5 bg-gray-900 rounded-[25px] flex items-center justify-center gap-3 border border-gray-800 cursor-pointer">
            <Upload size={18} className="text-blue-500"/>
            <span className="font-semibold text-sm">Upload from Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        /* Camera Interface */
        <div className="relative h-full w-full">
          <video 
            ref={videoPreviewRef} 
            className={`h-full w-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} 
            playsInline 
            muted 
          />
          
          {/* Progress Bar */}
          <div className="absolute top-14 left-4 right-4 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft/recordLimit)*100}%` }} />
          </div>

          {/* Right Sidebar Controls (Medium Size) */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-50">
            <button onClick={toggleCamera} className="p-2.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10">
              <RefreshCw size={22} />
            </button>
            <button onClick={() => { setShowFilters(true); setShowMusicLibrary(false); }} className={`p-2.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400' : ''}`}>
              <Sparkles size={22} />
            </button>
            <button onClick={() => { setShowMusicLibrary(true); setShowFilters(false); }} className={`p-2.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10 ${selectedMusic ? 'text-blue-400' : ''}`}>
              <Music size={22} />
            </button>
          </div>

          {/* Timing & Music Display */}
          <div className="absolute top-16 left-0 right-0 flex flex-col items-center pointer-events-none">
            {selectedMusic && <div className="bg-blue-600/60 px-3 py-1 rounded-full text-[10px] font-bold">🎵 {selectedMusic.title}</div>}
            <span className="text-2xl font-black mt-2 drop-shadow-md">{timeLeft}s</span>
          </div>

          {/* Bottom Record Controls */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6">
            {!isRecording && (
              <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/5">
                {[15, 30].map(s => (
                  <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-5 py-1.5 rounded-full text-xs font-bold ${recordLimit === s ? 'bg-white text-black' : 'text-gray-400'}`}>{s}s</button>
                ))}
              </div>
            )}
            <button onClick={isRecording ? stopRecording : startRecording} className={`w-18 h-18 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500' : 'border-white'}`}>
              <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-14 h-14 bg-white rounded-full'}`} />
            </button>
          </div>

          {/* Music Library Panel */}
          {showMusicLibrary && (
            <div className="absolute inset-0 bg-black/95 z-[60] p-6 pt-20 animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black">MUSIC</h2>
                <button onClick={() => setShowMusicLibrary(false)} className="p-2 bg-gray-800 rounded-full"><X size={18}/></button>
              </div>
              <div className="space-y-3 overflow-y-auto max-h-[70vh]">
                {musicList.map((m) => (
                  <div key={m.id} onClick={() => {setSelectedMusic(m); setShowMusicLibrary(false);}} className={`p-4 rounded-2xl flex justify-between items-center transition-all ${selectedMusic?.id === m.id ? 'bg-blue-600' : 'bg-gray-900 border border-gray-800'}`}>
                    <div><p className="font-bold text-sm">{m.title}</p><p className="text-[10px] opacity-50">Free to use</p></div>
                    {selectedMusic?.id === m.id ? <Check size={18}/> : <Play size={18}/>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-2xl z-[60] p-6 rounded-t-[30px] border-t border-white/10 animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black">FILTERS</h2>
                <button onClick={() => setShowFilters(false)}><X size={18}/></button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {filters.map(f => (
                  <button key={f.value} onClick={() => setSelectedFilter(f.value)} className="flex flex-col items-center gap-2">
                    <div className={`w-14 h-14 rounded-full border-2 ${selectedFilter === f.value ? 'border-blue-500' : 'border-gray-700'} bg-gray-800 flex items-center justify-center font-bold text-[10px]`}>
                      {f.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Preview & Publish */
        <div className="h-full flex flex-col p-5 pt-20 overflow-y-auto no-scrollbar">
          <div className="aspect-[9/16] w-full max-h-[440px] bg-gray-900 rounded-[30px] overflow-hidden mb-6 shadow-2xl relative">
            <video src={previewUrl} controls className="w-full h-full object-cover" />
          </div>
          <textarea 
            placeholder="Write a catchy caption... #chiti" 
            className="w-full bg-gray-900 rounded-2xl p-4 outline-none border border-gray-800 focus:border-blue-500 text-sm mb-5"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button onClick={handleUpload} disabled={isUploading} className="w-full bg-blue-600 py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95">
            {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20}/>}
            {isUploading ? 'PUBLISHING...' : 'POST REEL'}
          </button>
        </div>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
} 
