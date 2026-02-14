"use client";

import { 
  Upload, Video, Sparkles, Loader2, Send, X, Camera, 
  RefreshCw, Music, Check, Play, Pause, Zap, ArrowLeft,
  ShieldCheck, Search
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration
const R2_CONFIG = {
  endpoint: "https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com",
  accessKeyId: "bace896e3eba07cdbcb983394bd20da1", 
  secretAccessKey: "c38a89622fd343226dba534eedc26b8e8f3674c270651aba75e89206799a0acf",
  bucketName: "chiti-videos",
  publicDomain: "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev"
};

// Filter Data (CSS Based - No Lag)
const FILTERS_DATA: any = {
  none: { name: "Normal", style: "", thumb: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100" },
  crystal: { name: "Crystal", style: "brightness(1.3) contrast(1.1) saturate(1.2)", thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100" },
  angel: { name: "Angel", style: "brightness(1.5) saturate(1.1) contrast(0.9)", thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
  soft: { name: "Soft", style: "brightness(1.1) blur(0.4px)", thumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100" },
  retro: { name: "Vintage", style: "sepia(0.6) contrast(1.1)", thumb: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.5)", thumb: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100" },
  quad: { name: "4-Grid", style: "", isGrid: true, gridCount: 4, cols: 2, rows: 2, thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100" },
  sixer: { name: "6-Grid", style: "", isGrid: true, gridCount: 6, cols: 2, rows: 3, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100" }
};

export default function CreatePage() {
  const { user } = useAuth();
  
  // States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showFilters, setShowFilters] = useState(false);
  const [isFinalStep, setIsFinalStep] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');

  // Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);

  // Camera Management
  const startCamera = async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 720 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
      setIsCameraMode(true);
    } catch (err) {
      toast.error("Camera access failed");
    }
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    return () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCameraMode, facingMode]);

  // Recording Logic (Optimized for Small File Size)
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    // Low Bitrate (1.5Mbps) = Fast Upload on Slow Internet
    const recorder = new MediaRecorder(streamRef.current, { 
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 1500000 
    });

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], "vid.webm", { type: 'video/webm' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
      setIsCameraMode(false);
      setIsRecording(false);
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
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Publish Logic (Super Fast - No Baking)
  const handlePublish = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const fileName = `chiti_vids/${user.id}/${Date.now()}.webm`;
      const client = new S3Client({
        region: "auto",
        endpoint: R2_CONFIG.endpoint,
        credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
        forcePathStyle: true
      });

      // Upload Raw File (No heavy processing)
      await client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: selectedFile,
        ContentType: 'video/webm'
      }));

      setUploadProgress(80);
      const videoUrl = `${R2_CONFIG.publicDomain}/${fileName}`;

      // Save to Supabase with Filter Metadata
      const { error } = await supabase.from('posts').insert([{
        video_url: videoUrl,
        caption,
        user_id: user.id,
        user_name: user.user_metadata?.username || 'User',
        filter_name: selectedFilter // This tells the player which filter to show
      }]);

      if (error) throw error;

      setUploadProgress(100);
      toast.success("Video Published!");
      window.location.href = '/';
    } catch (err) {
      setIsUploading(false);
      toast.error("Upload failed. Check internet.");
    }
  };

  // Studio Renderer (Live Filter Preview)
  const renderDisplay = (url?: string) => {
    const filter = FILTERS_DATA[selectedFilter];
    const isGrid = filter.isGrid;
    const gridCount = isGrid ? filter.gridCount : 1;

    return (
      <div className={`w-full h-full ${isGrid ? 'grid' : ''}`} style={isGrid ? {
        gridTemplateColumns: `repeat(${filter.cols}, 1fr)`,
        gridTemplateRows: `repeat(${filter.rows}, 1fr)`
      } : {}}>
        {[...Array(gridCount)].map((_, i) => (
          <div key={i} className="relative w-full h-full overflow-hidden border-[0.2px] border-white/5">
            <video 
              ref={i === 0 ? videoPreviewRef : null}
              src={url}
              autoPlay playsInline muted loop
              className={`w-full h-full object-cover ${facingMode === 'user' && !url ? 'scale-x-[-1]' : ''}`}
              style={{ filter: filter.style }}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[999] overflow-hidden">
      {/* Header */}
      <div className="p-4 flex justify-between items-center z-50">
        <h1 className="text-xl font-black italic text-blue-600 flex items-center gap-1">
          CHITI <Zap size={18} fill="currentColor"/>
        </h1>
        {(isCameraMode || previewUrl) && (
          <button onClick={() => window.location.reload()} className="p-2 bg-white/10 rounded-full"><X/></button>
        )}
      </div>

      {!isCameraMode && !previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-10">
          <button onClick={() => setIsCameraMode(true)} className="w-40 h-40 bg-blue-600 rounded-[50px] flex items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Camera size={50} />
          </button>
          <label className="flex items-center gap-3 px-8 py-4 bg-zinc-900 rounded-full border border-white/10 cursor-pointer active:scale-95 transition-all">
            <Upload size={20} className="text-blue-500"/>
            <span className="text-xs font-bold uppercase italic">Upload from Gallery</span>
            <input type="file" hidden accept="video/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if(file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
            }} />
          </label>
        </div>
      ) : isCameraMode ? (
        <div className="relative flex-1 bg-black">
          {renderDisplay()}
          <div className="absolute right-4 top-20 flex flex-col gap-6">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl"><RefreshCw/></button>
            <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl text-blue-400"><Sparkles/></button>
          </div>
          <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-6">
            {!isRecording && (
              <div className="flex bg-black/50 rounded-full border border-white/10 p-1">
                {[15, 30].map(s => (
                  <button key={s} onClick={() => setRecordLimit(s)} className={`px-6 py-2 rounded-full text-[10px] font-bold ${recordLimit === s ? 'bg-white text-black' : ''}`}>{s}s</button>
                ))}
              </div>
            )}
            <button 
                onClick={isRecording ? stopRecording : startRecording} 
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${isRecording ? 'border-red-600' : 'border-white'}`}
            >
              <div className={isRecording ? 'w-8 h-8 bg-red-600 rounded-sm' : 'w-14 h-14 bg-white rounded-full'} />
            </button>
            {isRecording && <span className="text-red-500 font-bold animate-pulse">{timeLeft}s</span>}
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black flex flex-col">
          {!isFinalStep ? (
            <div className="flex-1 relative">
              {renderDisplay(previewUrl)}
              <div className="absolute bottom-10 inset-x-0 px-10 flex justify-between items-center">
                <button onClick={() => setShowFilters(true)} className="p-4 bg-black/40 rounded-full text-blue-400"><Sparkles/></button>
                <button onClick={() => setIsFinalStep(true)} className="px-10 py-4 bg-blue-600 rounded-full font-black text-xs italic">NEXT</button>
              </div>
            </div>
          ) : (
            <div className="p-6 flex flex-col h-full bg-zinc-950">
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setIsFinalStep(false)}><ArrowLeft/></button>
                <span className="font-bold italic">POST VIDEO</span>
              </div>
              <div className="flex gap-4 mb-10">
                <div className="w-24 h-36 bg-zinc-800 rounded-xl overflow-hidden">{renderDisplay(previewUrl)}</div>
                <textarea 
                  placeholder="Write a caption..." 
                  className="flex-1 bg-transparent border-b border-white/10 outline-none p-2 text-sm italic h-36"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
              {isUploading && (
                <div className="mb-6">
                  <div className="flex justify-between text-[10px] mb-2 font-bold text-blue-500 italic">
                    <span>UPLOADING...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
              <button 
                onClick={handlePublish}
                disabled={isUploading}
                className="mt-auto w-full bg-blue-600 py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : <Send />}
                PUBLISH
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Drawer */}
      {showFilters && (
        <div className="absolute bottom-0 inset-x-0 bg-zinc-900 p-6 rounded-t-3xl z-[1000] border-t border-white/5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-zinc-500 italic uppercase">Effects</span>
            <button onClick={() => setShowFilters(false)} className="p-1 bg-white/5 rounded-full"><X size={16}/></button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {Object.keys(FILTERS_DATA).map(key => (
              <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 ${selectedFilter === key ? 'border-blue-500 scale-105' : 'border-transparent opacity-50'}`}>
                  <img src={FILTERS_DATA[key].thumb} className="w-full h-full object-cover" style={{ filter: FILTERS_DATA[key].style }} />
                </div>
                <span className="text-[8px] font-bold uppercase">{FILTERS_DATA[key].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 
