"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock 
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * IMPORTANT FOR VITE:
 * 1. process.env ki jagah import.meta.env use hota hai.
 * 2. NEXT_PUBLIC_ ki jagah VITE_ prefix lagana zaroori hai.
 */
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

// EXPORT DEFAULT zaroori hai taaki App.tsx ise pehchan sake
export default function CreatePage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [finalDuration, setFinalDuration] = useState(0);
  
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const [showMusic, setShowMusic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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

  const filterStyles: any = {
    none: "",
    bright: "brightness(1.1) contrast(1.1)",
    warm: "sepia(0.2) brightness(1.1)",
    mono: "grayscale(1)",
    cine: "contrast(1.3) saturate(1.2) brightness(0.9)"
  };

  // 1. Music Library Load
  useEffect(() => {
    const loadMusic = async () => {
      try {
        const { data } = await supabase.from('music_library').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) setMusicList([...data, ...PERMANENT_MUSIC]);
      } catch (e) { console.error("Music fetch error"); }
    };
    loadMusic();
  }, []);

  // 2. Resource Cleanup
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

  // 3. Camera Initializer
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
        videoPreviewRef.current.play().catch(() => {});
      }
      setIsCameraMode(true);
      setTimeLeft(recordLimit);
    } catch (err) {
      toast.error("Camera access denied or reset.");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  // 4. Audio Control
  const toggleMusicPreview = async (music: any) => {
    if (playingMusicId === music.id) {
      audioRef.current?.pause();
      setPlayingMusicId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = music.audio_url;
        audioRef.current.load();
        await audioRef.current.play();
        setPlayingMusicId(music.id);
      }
    }
  };

  // 5. Gallery Handler
  const handleGalleryVideo = (file: File) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (video.duration > 30.5) {
        toast.error("Video too long! (Max 30s)");
        return;
      }
      setFinalDuration(video.duration);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    };
    video.src = URL.createObjectURL(file);
  };

  // 6. Professional Recording & Audio Mixing Logic
  const startRecording = async () => {
    if (!streamRef.current || !user) return;
    chunksRef.current = [];
    let recordStream = streamRef.current;

    // Mixing Logic if Music is Selected
    if (selectedMusic && audioRef.current) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        const sourceMic = audioCtx.createMediaStreamSource(streamRef.current);
        const sourceMusic = audioCtx.createMediaElementSource(audioRef.current);
        const destination = audioCtx.createMediaStreamDestination();
        
        sourceMic.connect(destination);
        sourceMusic.connect(destination);
        sourceMusic.connect(audioCtx.destination);

        recordStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } catch (e) { console.error("Mixing Error:", e); }
    }

    const recorder = new MediaRecorder(recordStream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

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
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          mediaRecorderRef.current?.stop();
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 7. Robust R2 Upload
  const handleUpload = async () => {
    if (!selectedFile || !user || isUploading) return;
    setIsUploading(true);
    const tid = toast.loading("Uploading your Chiti...");

    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      await r2Client.send(new PutObjectCommand({
        Bucket: "chiti-videos",
        Key: fileName,
        Body: new Uint8Array(await selectedFile.arrayBuffer()),
        ContentType: "video/webm"
      }));

      const finalUrl = `${PUBLIC_R2_DOMAIN}/${fileName}`;

      // Insert to Posts
      await supabase.from('posts').insert([{
        video_url: finalUrl,
        thumbnail_url: `${finalUrl}#t=0.1`,
        caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || "Chiti User"
      }]);

      toast.success("Published Successfully!", { id: tid });
      setPreviewUrl('');
      setSelectedFile(null);
    } catch (err) {
      toast.error("Upload failed!", { id: tid });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 flex justify-between items-center z-[1010] bg-gradient-to-b from-black via-black/50 to-transparent">
        <h1 className="text-2xl font-black italic tracking-tighter text-blue-500">CHITI</h1>
        {(isCameraMode || selectedFile) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {/* Main UI Logic */}
      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <Lock className="text-blue-500 mb-6" size={60}/>
          <h2 className="text-2xl font-black mb-4 uppercase">Login Required</h2>
          <a href="/login" className="px-10 py-4 bg-blue-600 rounded-full font-bold shadow-lg">Login to Create</a>
        </div>
      ) : !isCameraMode && !selectedFile ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <button onClick={() => setIsCameraMode(true)} className="w-64 h-64 bg-blue-600 rounded-[80px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
             <Camera size={60} />
             <span className="mt-4 font-black italic text-xl">OPEN CAMERA</span>
          </button>
          <label className="w-64 py-5 bg-gray-900 rounded-[30px] flex items-center justify-center gap-3 border border-white/5 cursor-pointer active:bg-gray-800">
            <Upload size={20}/>
            <span className="font-bold uppercase text-sm">Upload Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => e.target.files?.[0] && handleGalleryVideo(e.target.files[0])}/>
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1">
          <video 
            ref={videoPreviewRef}
            className="w-full h-full object-cover"
            style={{ 
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              filter: filterStyles[selectedFilter]
            }}
            muted playsInline
          />

          {/* Right Controls */}
          <div className="absolute right-4 top-1/4 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10"><RefreshCw/></button>
            <button onClick={() => setShowMusic(true)} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 text-blue-400"><Music/></button>
            <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 text-yellow-400"><Sparkles/></button>
          </div>

          {/* Record Button */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-5">
            {!isRecording && (
              <div className="flex bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/10">
                {[15, 30].map(s => (
                  <button key={s} onClick={() => {setRecordLimit(s); setTimeLeft(s);}} className={`px-6 py-2 rounded-full text-xs font-black ${recordLimit === s ? 'bg-white text-black' : 'text-white/50'}`}>{s}S</button>
                ))}
              </div>
            )}
            <div className="flex flex-col items-center">
              <button 
                onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording}
                className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500' : 'border-white'}`}
              >
                <div className={`${isRecording ? 'w-10 h-10 bg-red-500 rounded-lg' : 'w-20 h-20 bg-white rounded-full'} transition-all`} />
              </button>
              <span className="mt-2 font-black text-2xl">{timeLeft}s</span>
            </div>
          </div>
        </div>
      ) : (
        /* Preview & Upload Mode */
        <div className="flex-1 flex flex-col bg-black">
          <div className="relative flex-1">
            <video 
              src={previewUrl} 
              autoPlay loop playsInline
              className="w-full h-full object-cover"
              style={{ filter: filterStyles[selectedFilter] }}
            />
            <button onClick={() => {setSelectedFile(null); setPreviewUrl('');}} className="absolute top-6 left-6 p-3 bg-black/40 backdrop-blur-md rounded-full"><X/></button>
          </div>
          
          <div className="p-6 bg-gray-900/50 backdrop-blur-xl rounded-t-[40px] border-t border-white/10">
            <textarea 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Give your Chiti a caption..." 
              className="w-full bg-transparent p-2 outline-none text-xl font-medium mb-6 no-scrollbar resize-none"
              rows={2}
            />
            <button 
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full py-5 bg-blue-600 rounded-[25px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isUploading ? <Loader2 className="animate-spin"/> : <Send/>}
              {isUploading ? "PUBLISHING..." : "POST CHITI"}
            </button>
          </div>
        </div>
      )}

      {/* Overlay Panels (Music & Filters) */}
      {showMusic && (
        <div className="absolute inset-0 bg-black/95 z-[1050] p-6 pt-20">
          <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black italic">SOUNDS</h2><button onClick={() => setShowMusic(false)} className="p-2"><X/></button></div>
          <div className="space-y-4">
            {musicList.map(m => (
              <div key={m.id} className="p-4 bg-white/5 rounded-[25px] flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1" onClick={() => toggleMusicPreview(m)}>
                  <div className="p-3 bg-blue-600 rounded-xl">{playingMusicId === m.id ? <Pause size={20}/> : <Play size={20}/>}</div>
                  <p className="font-bold text-sm truncate w-40">{m.title}</p>
                </div>
                <button onClick={() => {setSelectedMusic(m); setShowMusic(false);}} className={`p-3 rounded-full ${selectedMusic?.id === m.id ? 'bg-green-500' : 'bg-white/10'}`}><Check size={20}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
