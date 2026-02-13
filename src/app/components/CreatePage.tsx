"use client";

import { Upload, Video, Sparkles, Loader2, Send, X, Camera, RefreshCw, Music, Check, Play, Pause } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'; 
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

const PERMANENT_MUSIC = [
  { id: 'p1', title: 'Chiti Beats Viral', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'p2', title: 'Lofi Chill Night', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'p3', title: 'Upbeat Summer', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

export function CreatePage() {
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

  // --- Music Fetch ---
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

  // --- 1. Fixed Audio Play Logic ---
  const toggleMusicPreview = async (music: any) => {
    if (playingMusicId === music.id) {
      audioRef.current?.pause();
      setPlayingMusicId(null);
    } else {
      if (audioRef.current) {
        try {
          audioRef.current.src = music.audio_url;
          audioRef.current.load(); // Force load
          await audioRef.current.play();
          setPlayingMusicId(music.id);
        } catch (err) {
          console.error("Audio Play Error:", err);
          toast.error("Audio play nahi ho raha, dobara try karein");
        }
      }
    }
  };

  const selectMusicFinal = (music: any) => {
    setSelectedMusic(music);
    audioRef.current?.pause();
    setPlayingMusicId(null);
    setShowMusic(false);
    toast.success(`Sound Selected!`);
  };

  // --- 2. Fixed Camera Launch ---
  const startCamera = async () => {
    try {
      stopTracks();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: 1280, height: 720 },
        audio: true
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraMode(true);
      setTimeLeft(recordLimit);
    } catch (err) {
      toast.error("Camera access denied!");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => stopTracks();
  }, [isCameraMode, facingMode]);

  // --- 3. Gallery & Recording (30s limit) ---
  const handleGalleryVideo = (file: File) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (video.duration > 30.5) {
        toast.error("Video 30s se zyada hai!");
        return;
      }
      setFinalDuration(video.duration);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    };
    video.src = URL.createObjectURL(file);
  };

  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    let finalStream = streamRef.current;

    if (selectedMusic && audioRef.current) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const sourceMic = audioCtx.createMediaStreamSource(streamRef.current);
      const sourceMusic = audioCtx.createMediaElementSource(audioRef.current);
      const destination = audioCtx.createMediaStreamDestination();
      
      sourceMic.connect(destination);
      sourceMusic.connect(destination);
      sourceMusic.connect(audioCtx.destination);
      
      finalStream = new MediaStream([
        streamRef.current.getVideoTracks()[0],
        destination.stream.getAudioTracks()[0]
      ]);

      audioRef.current.src = selectedMusic.audio_url;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    }

    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setFinalDuration(recordLimit - timeLeft);
      setSelectedFile(new File([blob], `chiti.webm`, { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
      stopTracks();
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          clearInterval(timerRef.current);
          mediaRecorderRef.current?.stop();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  };

  // --- 4. Final Upload with Automatic Music Title ---
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const toastId = toast.loading('Posting Chiti...');

    try {
      const videoFileName = `${user.id}/${Date.now()}.webm`;
      await r2Client.send(new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: videoFileName,
        Body: new Uint8Array(await selectedFile.arrayBuffer()),
        ContentType: 'video/webm',
      }));

      const videoUrl = `${PUBLIC_R2_DOMAIN}/${videoFileName}`;

      // 1. Post Video
      await supabase.from('posts').insert([{
        video_url: videoUrl,
        thumbnail_url: videoUrl + "#t=0.1",
        caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'User'
      }]);

      // 2. Add Audio to Library using the Caption as Title
      const audioTitle = caption.trim() !== "" ? caption : `Sound by ${user.user_metadata?.full_name || 'User'}`;
      await supabase.from('music_library').insert([{
        title: audioTitle,
        audio_url: videoUrl, // Extract sound from video URL
        user_id: user.id
      }]);

      toast.success('Shared! Audio added to library.', { id: toastId });
      setSelectedFile(null);
      setPreviewUrl('');
      setCaption('');
    } catch (err) {
      toast.error("Upload failed!", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden z-[999] touch-none">
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/90 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter">CHITI <span className="text-blue-500 uppercase">Creator</span></h1>
        {(isCameraMode || selectedFile) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!isCameraMode && !selectedFile ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <button onClick={() => setIsCameraMode(true)} className="w-full aspect-square max-w-[260px] bg-blue-600 rounded-[60px] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={50} className="mb-2" />
            <span className="text-xl font-black italic">OPEN CAMERA</span>
          </button>
          <label className="w-full max-w-[260px] p-5 bg-gray-900/50 rounded-[30px] flex items-center justify-center gap-3 border border-gray-800 cursor-pointer">
            <Upload size={20} className="text-blue-500"/>
            <span className="font-bold">Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if(file) handleGalleryVideo(file);
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1 bg-black">
          <video ref={videoPreviewRef} className="h-full w-full object-cover" style={{ filter: filterStyles[selectedFilter] }} playsInline muted />
          <div className="absolute right-4 top-1/4 flex flex-col gap-6 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-3 bg-black/40 rounded-full border border-white/10"><RefreshCw size={24} /></button>
            <button onClick={() => { setShowFilters(true); setShowMusic(false); }} className={`p-3 bg-black/40 rounded-full border border-white/10 ${selectedFilter !== 'none' ? 'text-blue-400 border-blue-500' : ''}`}><Sparkles size={24} /></button>
            <button onClick={() => { setShowMusic(true); setShowFilters(false); }} className={`p-3 bg-black/40 rounded-full border border-white/10 ${selectedMusic ? 'text-blue-400 border-blue-500' : ''}`}><Music size={24} /></button>
          </div>
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            <div className="flex flex-col items-center gap-2">
              <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}>
                <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-16 h-16 bg-white rounded-full'}`} />
              </button>
              <span className="font-black text-2xl">{timeLeft}s</span>
            </div>
          </div>
          {/* Music Panel */}
          {showMusic && (
            <div className="absolute inset-0 bg-black/95 z-[1050] p-6 pt-20 animate-in slide-in-from-bottom overflow-y-auto">
              <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black">SELECT SOUND</h2><button onClick={() => setShowMusic(false)}><X/></button></div>
              <div className="space-y-4 pb-20">
                {musicList.map(m => (
                  <div key={m.id} className={`p-5 rounded-[30px] flex justify-between items-center transition-all ${selectedMusic?.id === m.id ? 'bg-blue-600/20 border border-blue-600' : 'bg-gray-900'}`}>
                    <div className="flex items-center gap-4 flex-1" onClick={() => toggleMusicPreview(m)}>
                      <div className="p-3 bg-blue-600 rounded-2xl">
                        {playingMusicId === m.id ? <Pause size={20}/> : <Play size={20} fill="white"/>}
                      </div>
                      <span className="font-bold text-sm truncate max-w-[150px]">{m.title}</span>
                    </div>
                    <button onClick={() => selectMusicFinal(m)} className="p-3 bg-white/10 rounded-full"><Check/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-6 pt-16 overflow-y-auto no-scrollbar pb-32">
          <div className="aspect-[9/16] w-full bg-gray-900 rounded-[45px] overflow-hidden mb-4 relative">
            <video src={previewUrl} style={{ filter: filterStyles[selectedFilter] }} controls className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 bg-black/60 px-4 py-1 rounded-full text-xs font-black uppercase">
              {finalDuration.toFixed(1)}s Video
            </div>
          </div>
          <textarea 
            placeholder="Write a caption... (This will also be your Audio Title)" 
            className="w-full bg-gray-900/50 rounded-[25px] p-6 outline-none border border-gray-800 text-lg mb-6"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button onClick={handleUpload} disabled={isUploading} className="w-full bg-blue-600 py-5 rounded-[30px] font-black text-xl flex items-center justify-center gap-3">
            {isUploading ? <Loader2 className="animate-spin"/> : <Send size={22}/>}
            {isUploading ? 'SHARING...' : 'POST CHITI'}
          </button>
        </div>
      )}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
}
