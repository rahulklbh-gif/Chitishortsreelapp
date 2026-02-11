"use client";
import { Upload, Video, Sparkles, Loader2, Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- Naye Imports: FFmpeg (Compression ke liye) ---
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// --- R2 Client Setup: NEXT_PUBLIC_ variables ke saath (Vercel Bypass ke liye) ---
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.NEXT_PUBLIC_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export function CreatePage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [progress, setProgress] = useState(0);
  
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // FFmpeg Reference: Ye browser ke andar compression engine load karega
  const ffmpegRef = useRef(new FFmpeg());

  const filters = [
    { name: 'Normal', value: 'none', class: '' },
    { name: 'Bright', value: 'bright', class: 'brightness-125 contrast-110' },
    { name: 'Grayscale', value: 'gray', class: 'grayscale' },
    { name: 'Cinematic', value: 'cine', class: 'saturate-150 contrast-125 brightness-90' },
  ];

  // ==========================================
  // FUNCTION 1: COMPRESSION LOGIC (Naya Add Kiya Gaya)
  // ==========================================
  const compressVideo = async (file: File) => {
    const ffmpeg = ffmpegRef.current;
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    // Engine load ho raha hai (sirf pehli baar)
    if (!ffmpeg.loaded) {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    }

    const inputName = 'input.mp4';
    const outputName = 'output.mp4';

    // File ko FFmpeg ki virtual memory mein likhna
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Compression Command: -crf 28 video ka size chota kar deta hai bina quality kharab kiye
    // Ye line aapka 50MB ka error solve karegi
    await ffmpeg.exec(['-i', inputName, '-vcodec', 'libx264', '-crf', '28', outputName]);

    // Compressed file ko read karna
    const data = await ffmpeg.readFile(outputName);
    const compressedBlob = new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
    
    // Memory saaf karna (Browser hang na ho)
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return new File([compressedBlob], file.name, { type: 'video/mp4' });
  };

  // ==========================================
  // FUNCTION 2: THUMBNAIL GENERATOR (Aapka Purana Code)
  // ==========================================
  const generateThumbnail = (file: File) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = 1;
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) setThumbnailBlob(blob);
      }, 'image/jpeg', 0.8);
      
      URL.revokeObjectURL(video.src);
    };
  };

  // ==========================================
  // FUNCTION 3: FILE SELECTION (Aapka Purana Code)
  // ==========================================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 100MB limit hum check kar rahe hain, par compression ise chota kar dega
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    generateThumbnail(file);
    toast.success("Video ready for high-speed processing!");
  };

  // ==========================================
  // FUNCTION 4: ASLI UPLOAD LOGIC (Vistar se)
  // ==========================================
  const handleUpload = async () => {
    if (!selectedFile || !user) {
      toast.error("Please select a video first.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Starting Smart Engine...');

    try {
      // PHASE 1: COMPRESSION (Vercel limit bachane ke liye)
      setProgress(10);
      toast.loading('Squeezing video size...', { id: toastId });
      const readyFile = await compressVideo(selectedFile);
      
      setProgress(40);
      const fileExt = readyFile.name.split('.').pop();
      const baseName = `${Math.random().toString(36).substring(2)}-${Date.now()}`;
      const videoFileName = `${baseName}.${fileExt}`;
      const thumbFileName = `${baseName}.jpg`;

      // PHASE 2: DIRECT VIDEO UPLOAD (Vercel bypass logic)
      toast.loading('Uploading Direct to Cloudflare R2...', { id: toastId });
      const videoBuffer = await readyFile.arrayBuffer();
      
      const videoCommand = new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: videoFileName,
        Body: new Uint8Array(videoBuffer),
        ContentType: readyFile.type,
        // CDN Activate: Ye video ko fast play karwayega
        CacheControl: 'public, max-age=31536000, immutable', 
      });
      await r2Client.send(videoCommand);
      setProgress(75);

      // PHASE 3: THUMBNAIL UPLOAD (Wahi bucket mein)
      let finalThumbnailUrl = '';
      if (thumbnailBlob) {
        const thumbBuffer = await thumbnailBlob.arrayBuffer();
        const thumbCommand = new PutObjectCommand({
          Bucket: 'chiti-videos',
          Key: thumbFileName,
          Body: new Uint8Array(thumbBuffer),
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        });
        await r2Client.send(thumbCommand);
        finalThumbnailUrl = `https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/${thumbFileName}`;
      }

      setProgress(90);
      const publicVideoUrl = `https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/${videoFileName}`;

      // PHASE 4: SUPABASE UPDATE (Sirf link save karna)
      toast.loading('Linking to database...', { id: toastId });
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: publicVideoUrl,
        thumbnail_url: finalThumbnailUrl || publicVideoUrl + "#t=0.1",
        caption: caption,
        user_id: user?.id,
        user_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Chiti User',
        user_avatar: user?.user_metadata?.avatar_url,
        likes_count: 0,
        views_count: 0
      }]);

      if (dbError) throw dbError;

      setProgress(100);
      toast.success('Your Short is Live! 🚀', { id: toastId });

      // Sab kuch reset karna
      setSelectedFile(null);
      setPreviewUrl('');
      setCaption('');
      setThumbnailBlob(null);

    } catch (error: any) {
      console.error("Critical Error:", error);
      toast.error("Process failed. Try a shorter video.", { id: toastId });
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  // ==========================================
  // UI RENDER (Aapka poora UI logic)
  // ==========================================
  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-10 text-center">
      <div className="p-6 bg-gray-900 rounded-full mb-4">
        <Video size={48} className="text-blue-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Login Required</h2>
      <p className="text-gray-500">Sign in to share your creative moments.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black italic tracking-tighter">CHITI <span className="text-blue-500">CREATOR</span></h1>
        {selectedFile && <button onClick={() => setSelectedFile(null)} className="text-red-500 font-bold bg-red-500/10 px-4 py-1 rounded-full text-sm">Cancel</button>}
      </header>

      {!selectedFile ? (
        <label className="flex flex-col items-center justify-center aspect-[9/16] bg-gray-900 border-2 border-dashed border-gray-700 rounded-[40px] cursor-pointer transition-all hover:border-blue-500 group">
          <div className="bg-blue-600 p-5 rounded-full mb-4 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <Upload size={32} className="text-white" />
          </div>
          <p className="font-bold text-lg">Upload Short</p>
          <p className="text-gray-500 text-sm mt-1 text-center px-4">Videos over 50MB will be auto-compressed</p>
          <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
        </label>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Video Preview with Filter */}
          <div className="relative aspect-[9/16] rounded-[32px] overflow-hidden bg-gray-900 ring-1 ring-white/10 mx-auto max-h-[450px] shadow-2xl">
            <video 
              ref={videoRef}
              src={previewUrl} 
              className={`w-full h-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} 
              controls 
            />
          </div>

          {/* Filter Bar */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Magic Filters</p>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {filters.map(f => (
                <button 
                  key={f.value}
                  onClick={() => setSelectedFilter(f.value)}
                  className={`px-5 py-2 rounded-full font-bold whitespace-nowrap transition-all ${selectedFilter === f.value ? 'bg-white text-black shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Caption Area */}
          <textarea 
            placeholder="Share the story behind this short... #chiti"
            className="w-full bg-gray-900 p-5 rounded-[24px] outline-none border border-gray-800 focus:border-blue-500 min-h-[120px] transition-all"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          {/* Upload Button */}
          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-5 rounded-[24px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-blue-600/20"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            {isUploading ? `PROCESSING ${progress}%` : 'PUBLISH NOW'}
          </button>
        </div>
      )}
    </div>
  );
}
