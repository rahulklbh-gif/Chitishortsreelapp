"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Lock, ArrowLeft,
  Settings, Volume2, ShieldCheck, Search
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint, 
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
  forcePathStyle: true, 
});

const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=300&fit=crop" },
  bright: { name: "Bright", style: "brightness(1.3) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=300&fit=crop" },
  warm: { name: "Warm", style: "sepia(0.4) saturate(1.4) brightness(1.1)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=300&fit=crop" },
  mono: { name: "B&W", style: "grayscale(1) contrast(1.2)", thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=300&fit=crop" },
  cine: { name: "Cine", style: "contrast(1.5) saturate(0.8) brightness(0.9)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=300&fit=crop" },
  retro: { name: "Retro", style: "sepia(0.6) hue-rotate(-20deg) saturate(1.4)", thumb: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=300&fit=crop" },
  cool: { name: "Cool", style: "hue-rotate(160deg) brightness(1.1) saturate(1.2)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=300&fit=crop" },
  vivid: { name: "Vivid", style: "saturate(2.2) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=300&fit=crop" },
  noir: { name: "Noir", style: "grayscale(1) contrast(2) brightness(0.7)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=300&fit=crop" },
  gold: { name: "Gold", style: "brightness(1.1) sepia(0.5) saturate(1.8)", thumb: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=300&fit=crop" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
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
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('none');

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load Music with Error Handling
  useEffect(() => {
    const loadMusic = async () => {
      const { data, error } = await supabase
        .from('music_library')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setMusicList(data);
      if (error) console.error("DB Load Error:", error);
    };
    loadMusic();
  }, []);

  // Optimized Search Logic
  const filteredMusic = useMemo(() => {
    return musicList.filter(m => 
      m.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [musicList, searchTerm]);

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

  const handleGalleryVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      if (videoElement.duration > 30.8) {
        toast.error("Video is too long! Max 30 seconds.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRecordedFacingMode('environment');
    };
    videoElement.src = URL.createObjectURL(file);
  };

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

  const startRecording = async () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedFacingMode(facingMode);
    
    let mixedStream = streamRef.current;

    if (selectedMusic && audioRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const musicSource = ctx.createMediaElementSource(audioRef.current);
        const micSource = ctx.createMediaStreamSource(streamRef.current);
        const musicGain = ctx.createGain();
        const micGain = ctx.createGain();
        const destination = ctx.createMediaStreamDestination();

        musicGain.gain.value = 0.6;
        micGain.gain.value = 1.0;

        musicSource.connect(musicGain).connect(destination);
        micSource.connect(micGain).connect(destination);
        musicGain.connect(ctx.destination);

        mixedStream = new MediaStream([
          streamRef.current.getVideoTracks()[0],
          destination.stream.getAudioTracks()[0]
        ]);

        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (e) { console.error(e); }
    }

    const recorder = new MediaRecorder(mixedStream, { 
      mimeType: 'video/webm;codecs=vp8,opus',
      videoBitsPerSecond: 3000000 
    });

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(new File([blob], `vid_${Date.now()}.webm`, { type: 'video/webm' }));
      setIsCameraMode(false);
      setIsRecording(false);
      audioRef.current?.pause();
      stopTracks();
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
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

  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    const toastId = toast.loading('Publishing viral hit...');
    
    try {
      const timestamp = Date.now();
      const fileName = `chiti_vids/${user.id}/${timestamp}.webm`;
      const fileBuffer = await selectedFile.arrayBuffer();

      // 1. Upload to R2
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: 'video/webm',
      }));

      const videoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;
      const finalTitle = caption.trim() || "Chiti Original Sound";

      // 2. Database Transactions (Parallel for Speed)
      const postPromise = supabase.from('posts').insert([{
        video_url: videoUrl,
        caption: finalTitle,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Creator',
        thumbnail_url: `${videoUrl}#t=0.5`
      }]);

      const musicPromise = supabase.from('music_library').insert([{
        title: finalTitle,
        audio_url: videoUrl, // Video hi audio source hai
        creator_id: user.id,
        created_at: new Date().toISOString()
      }]);

      const [postRes, musicRes] = await Promise.all([postPromise, musicPromise]);

      if (postRes.error) throw postRes.error;
      if (musicRes.error) console.error("Music DB Sync Failed", musicRes.error);

      toast.success('Posted Successfully!', { id: toastId });
      setTimeout(() => window.location.href = '/', 1000);

    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden select-none">
      
      {/* Top Header */}
      <div className="p-4 flex justify-between items-center z-[1001] bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic text-blue-500">CHITI</h1>
          <p className="text-[8px] font-bold tracking-widest text-blue-300">ULTRA STUDIO</p>
        </div>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-3 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <ShieldCheck size={60} className="text-blue-500 mb-4" />
          <h2 className="text-xl font-bold mb-6">PLEASE LOGIN TO CREATE</h2>
          <a href="/login" className="px-12 py-4 bg-blue-600 rounded-full font-black">SIGN IN</a>
        </div>
      ) : !isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-10">
          <button onClick={() => setIsCameraMode(true)} className="w-56 h-56 bg-blue-600 rounded-[60px] flex flex-col items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.3)] active:scale-95 transition-all">
            <Camera size={70} className="mb-2" />
            <span className="font-black italic tracking-widest">SHOOT</span>
          </button>
          
          <label className="w-64 p-5 bg-zinc-900 rounded-[30px] flex items-center gap-4 border border-white/5 cursor-pointer active:opacity-60">
            <Upload className="text-blue-500"/>
            <div className="flex flex-col">
              <span className="font-black text-xs">GALLERY</span>
              <span className="text-[9px] text-gray-500 uppercase">Up to 30s</span>
            </div>
            <input type="file" hidden accept="video/*" onChange={handleGalleryVideo} />
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1 bg-black">
          <video ref={videoPreviewRef} className="h-full w-full object-cover" style={{ filter: FILTERS_DATA[selectedFilter].style, transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} autoPlay playsInline muted />
          
          <div className="absolute right-4 top-20 flex flex-col gap-5 z-[1010]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl"><RefreshCw/></button>
            <button onClick={() => setShowFilters(true)} className={`p-4 bg-black/40 backdrop-blur-md rounded-2xl ${selectedFilter !== 'none' ? 'text-blue-400' : ''}`}><Sparkles/></button>
            <button onClick={() => setShowMusic(true)} className={`p-4 bg-black/40 backdrop-blur-md rounded-2xl ${selectedMusic ? 'text-pink-400' : ''}`}><Music/></button>
          </div>

          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6 z-[1010]">
            {!isRecording && (
              <div className="flex bg-black/60 backdrop-blur-xl p-1 rounded-full border border-white/10">
                {[15, 30].map(sec => (
                  <button key={sec} onClick={() => {setRecordLimit(sec); setTimeLeft(sec);}} className={`px-8 py-2 rounded-full text-[10px] font-black ${recordLimit === sec ? 'bg-white text-black' : 'text-gray-400'}`}>{sec}S</button>
                ))}
              </div>
            )}
            <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording} className={`w-20 h-20 rounded-full border-[6px] flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}>
              <div className={`${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm animate-pulse' : 'w-14 h-14 bg-white rounded-full'}`} />
            </button>
            {isRecording && <span className="font-black text-red-500 bg-black/50 px-4 py-1 rounded-full">{timeLeft}s</span>}
          </div>

          {/* Filter Sheet */}
          {showFilters && (
            <div className="absolute bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur-2xl z-[1100] p-6 pb-12 rounded-t-[40px] animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-6">
                <span className="font-black uppercase tracking-tighter">Color Grading</span>
                <button onClick={() => setShowFilters(false)} className="p-2"><X/></button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar">
                {Object.keys(FILTERS_DATA).map(key => (
                  <button key={key} onClick={() => setSelectedFilter(key)} className={`flex-shrink-0 flex flex-col items-center gap-2`}>
                    <div className={`w-20 h-28 rounded-2xl overflow-hidden border-2 ${selectedFilter === key ? 'border-blue-500 scale-105' : 'border-transparent'}`}>
                      <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                    </div>
                    <span className="text-[9px] font-bold text-gray-500">{FILTERS_DATA[key].name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Music Sheet with Search */}
          {showMusic && (
            <div className="absolute inset-0 bg-zinc-950 z-[1200] p-6 pt-20 animate-in fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black italic">SOUNDS</h2>
                <button onClick={() => setShowMusic(false)} className="p-3 bg-white/5 rounded-full"><X/></button>
              </div>
              
              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20}/>
                <input 
                  type="text" 
                  placeholder="Search viral sounds..." 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-all font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-3 overflow-y-auto h-[70vh] no-scrollbar">
                {filteredMusic.map(music => (
                  <div key={music.id} className={`p-4 rounded-3xl flex items-center justify-between border transition-all ${selectedMusic?.id === music.id ? 'bg-blue-600/20 border-blue-500' : 'bg-zinc-900 border-white/5'}`}>
                    <div className="flex items-center gap-4 flex-1" onClick={() => {
                      if(playingMusicId === music.id) { audioRef.current?.pause(); setPlayingMusicId(null); }
                      else { audioRef.current!.src = music.audio_url; audioRef.current?.play(); setPlayingMusicId(music.id); }
                    }}>
                      <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center">
                        {playingMusicId === music.id ? <Pause fill="white"/> : <Play fill="white" className="ml-1"/>}
                      </div>
                      <p className="font-bold text-sm truncate max-w-[180px]">{music.title}</p>
                    </div>
                    <button onClick={() => {setSelectedMusic(music); setShowMusic(false); audioRef.current?.pause(); setPlayingMusicId(null);}} className="p-4 bg-blue-600 rounded-2xl"><Check/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Final Preview & Metadata Step */
        <div className="fixed inset-0 bg-zinc-950 flex flex-col z-[1300] animate-in slide-in-from-right">
          {!isFinalStep ? (
            <div className="flex-1 flex flex-col relative">
              <video src={previewUrl} style={{ filter: FILTERS_DATA[selectedFilter].style, transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} autoPlay loop playsInline className="w-full h-full object-cover" />
              <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={() => {setPreviewUrl(''); setSelectedFile(null);}} className="p-4 bg-black/40 rounded-full"><ArrowLeft/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-10 py-3 bg-blue-600 rounded-full font-black text-xs tracking-widest">NEXT</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-8 flex flex-col">
              <div className="flex items-center gap-4 mb-10">
                <button onClick={() => setIsFinalStep(false)} className="p-2 bg-white/5 rounded-full"><ArrowLeft/></button>
                <h2 className="text-xl font-black uppercase">Post Details</h2>
              </div>
              <div className="flex gap-6 mb-10">
                <div className="w-32 h-48 bg-zinc-900 rounded-3xl overflow-hidden border border-white/10">
                  <video src={previewUrl} style={{ filter: FILTERS_DATA[selectedFilter].style, transform: recordedFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} muted className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-blue-500 block mb-2">CAPTION / MUSIC TITLE</label>
                  <textarea 
                    placeholder="Write a catchy title..." 
                    className="w-full bg-transparent border-b border-white/10 py-2 outline-none font-bold text-lg resize-none h-32" 
                    value={caption} 
                    onChange={(e) => setCaption(e.target.value)} 
                  />
                </div>
              </div>
              <button 
                onClick={handlePublish} 
                disabled={isUploading} 
                className="mt-auto w-full bg-blue-600 py-5 rounded-[30px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin" size={28}/> : <Send size={28}/>}
                {isUploading ? 'UPLOADING...' : 'PUBLISH NOW'}
              </button>
            </div>
          )}
        </div>
      )}
      <audio ref={audioRef} hidden crossOrigin="anonymous" />
    </div>
  );
} 
