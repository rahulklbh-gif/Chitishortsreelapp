"use client";

import { Upload, Video, Sparkles, Loader2, Send, X, CheckCircle2, AlertCircle, Camera, RefreshCw, StopCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${import.meta.env.NEXT_PUBLIC_R2_ACCOUNT_ID || ''}.r2.cloudflarestorage.com`,
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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');

  // --- CAMERA & RECORDING STATES ---
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLimit, setRecordLimit] = useState(15); // Default 15s
  const [timeLeft, setTimeLeft] = useState(15);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const filters = [
    { name: 'Normal', value: 'none', class: '' },
    { name: 'Bright', value: 'bright', class: 'brightness-125 contrast-110' },
    { name: 'Grayscale', value: 'gray', class: 'grayscale' },
    { name: 'Cinematic', value: 'cine', class: 'saturate-150 contrast-125 brightness-90' },
  ];

  // --- CAMERA CONTROL ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 720, height: 1280 }, 
        audio: true 
      });
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraMode(true);
      setTimeLeft(recordLimit);
    } catch (err) {
      toast.error("Camera access denied! Check permissions.");
    }
  };

  const stopCamera = () => {
    const stream = videoPreviewRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraMode(false);
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // --- RECORDING LOGIC ---
  const startRecording = () => {
    const stream = videoPreviewRef.current?.srcObject as MediaStream;
    if (!stream) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `recorded-video-${Date.now()}.webm`, { type: 'video/webm' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      generateThumbnail(file);
      stopCamera();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    
    // Timer Logic
    setTimeLeft(recordLimit);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
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
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const generateThumbnail = (file: File) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = 1;
    video.muted = true;
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => { if (blob) setThumbnailBlob(blob); }, 'image/jpeg', 0.8);
      URL.revokeObjectURL(video.src);
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (video.duration > 30.5) {
        toast.error("Video too long! Max 30s.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      generateThumbnail(file);
    };
    video.src = URL.createObjectURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return toast.error("File or Login missing!");
    setIsUploading(true);
    setProgress(10);
    const toastId = toast.loading('Publishing your Chiti...');

    try {
      const baseName = `${Math.random().toString(36).substring(2)}-${Date.now()}`;
      const videoFileName = `${baseName}.webm`;
      const thumbFileName = `${baseName}.jpg`;

      // Upload Video
      const videoBuffer = await selectedFile.arrayBuffer();
      await r2Client.send(new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: videoFileName,
        Body: new Uint8Array(videoBuffer),
        ContentType: 'video/webm',
      }));
      setProgress(50);

      // Upload Thumbnail
      let thumbUrl = '';
      if (thumbnailBlob) {
        const thumbBuffer = await thumbnailBlob.arrayBuffer();
        await r2Client.send(new PutObjectCommand({
          Bucket: 'chiti-videos',
          Key: thumbFileName,
          Body: new Uint8Array(thumbBuffer),
          ContentType: 'image/jpeg',
        }));
        thumbUrl = `${PUBLIC_R2_DOMAIN}/${thumbFileName}`;
      }

      const videoUrl = `${PUBLIC_R2_DOMAIN}/${videoFileName}`;
      
      // Save Post
      await supabase.from('posts').insert([{
        video_url: videoUrl,
        thumbnail_url: thumbUrl || videoUrl + "#t=0.1",
        caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'User',
        user_avatar: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
      }]);

      // Add to Music Library
      await supabase.from('music_library').insert([{
        title: caption.substring(0, 20) || "Original Audio",
        audio_url: videoUrl,
        duration: recordLimit,
        user_id: user.id,
        thumbnail_url: thumbUrl
      }]);

      toast.success('Uploaded successfully! 🚀', { id: toastId });
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
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {(selectedFile || isCameraMode) && (
          <button onClick={() => { setSelectedFile(null); stopCamera(); }} className="text-red-500 font-bold bg-red-500/10 px-4 py-1 rounded-full text-sm">Cancel</button>
        )}
      </header>

      {/* --- CAMERA UI --- */}
      {isCameraMode ? (
        <div className="relative aspect-[9/16] bg-gray-900 rounded-[32px] overflow-hidden shadow-2xl">
          <video ref={videoPreviewRef} className="w-full h-full object-cover" muted playsInline />
          
          {/* Progress Bar top */}
          <div className="absolute top-4 left-4 right-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
             <div 
               className="h-full bg-blue-500 transition-all duration-1000 ease-linear" 
               style={{ width: `${(timeLeft / recordLimit) * 100}%` }}
             />
          </div>

          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6">
            {/* 15s / 30s Switcher */}
            {!isRecording && (
              <div className="flex bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10">
                {[15, 30].map(s => (
                  <button 
                    key={s}
                    onClick={() => { setRecordLimit(s); setTimeLeft(s); }}
                    className={`px-6 py-1.5 rounded-full font-bold text-sm transition-all ${recordLimit === s ? 'bg-white text-black' : 'text-white'}`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            )}

            {/* Record Button */}
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}
            >
              <div className={`rounded-full transition-all ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-16 h-16 bg-white'}`} />
            </button>
            <p className="font-mono font-bold text-xl drop-shadow-lg">{timeLeft}s</p>
          </div>
        </div>
      ) : !selectedFile ? (
        /* --- SELECTION UI --- */
        <div className="grid grid-cols-1 gap-4">
          <button onClick={startCamera} className="flex flex-col items-center justify-center aspect-[9/16] bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] shadow-xl active:scale-95 transition-all">
            <Camera size={48} className="mb-4" />
            <span className="text-xl font-black">OPEN CAMERA</span>
            <span className="text-white/60 text-sm">Record 15s or 30s</span>
          </button>
          
          <label className="flex items-center justify-center p-8 bg-gray-900 border-2 border-dashed border-gray-700 rounded-[32px] cursor-pointer hover:border-blue-500 transition-all">
            <Upload size={24} className="mr-3 text-blue-500" />
            <span className="font-bold">Upload from Gallery</span>
            <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
          </label>
        </div>
      ) : (
        /* --- PREVIEW & PUBLISH UI --- */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="relative aspect-[9/16] rounded-[32px] overflow-hidden bg-gray-900 mx-auto max-h-[450px]">
             <video src={previewUrl} className={`w-full h-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} controls />
           </div>

           <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {filters.map(f => (
                <button key={f.value} onClick={() => setSelectedFilter(f.value)} className={`px-5 py-2 rounded-full font-bold whitespace-nowrap ${selectedFilter === f.value ? 'bg-white text-black' : 'bg-gray-800 text-gray-400'}`}>
                  {f.name}
                </button>
              ))}
           </div>

           <textarea 
             placeholder="What's happening? #chiti"
             className="w-full bg-gray-900 p-5 rounded-[24px] outline-none border border-gray-800 focus:border-blue-500 min-h-[100px]"
             value={caption}
             onChange={(e) => setCaption(e.target.value)}
           />

           <button onClick={handleUpload} disabled={isUploading} className="w-full bg-blue-600 py-5 rounded-[24px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
             {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
             {isUploading ? `PUBLISHING ${progress}%` : 'PUBLISH'}
           </button>
        </div>
      )}
    </div>
  );
} 
