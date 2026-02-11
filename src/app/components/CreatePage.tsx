"use client";
import { Upload, Video, Sparkles, Loader2, Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- R2 Client Config (Direct Browser Upload) ---
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${import.meta.env.VITE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// IMPORTANT: Apna Public R2 Domain yahan dalein (Cloudflare Settings se)
// Agar aapke paas custom domain nahi hai, toh ye format hota hai: 
// https://pub-<bucket_id>.r2.dev
const PUBLIC_R2_DOMAIN = "https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev";

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

  const filters = [
    { name: 'Normal', value: 'none', class: '' },
    { name: 'Bright', value: 'bright', class: 'brightness-125 contrast-110' },
    { name: 'Grayscale', value: 'gray', class: 'grayscale' },
    { name: 'Cinematic', value: 'cine', class: 'saturate-150 contrast-125 brightness-90' },
  ];

  // --- THUMBNAIL GENERATOR (Same as before) ---
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 100MB Limit Check
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size too big! Please upload under 100MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    generateThumbnail(file);
    toast.success("Video added! Ready to upload.");
  };

  // --- MAIN UPLOAD LOGIC (FIXED: Direct R2 + Profile Pic Fallback) ---
  const handleUpload = async () => {
    if (!selectedFile || !user) {
      toast.error("Please select a video first.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Initializing Secure Upload...');

    try {
      setProgress(10);
      const fileExt = selectedFile.name.split('.').pop();
      const baseName = `${Math.random().toString(36).substring(2)}-${Date.now()}`;
      const videoFileName = `${baseName}.${fileExt}`;
      const thumbFileName = `${baseName}.jpg`;

      // PHASE 1: VIDEO UPLOAD (Direct R2)
      toast.loading('Uploading Video to Cloud...', { id: toastId });
      const videoBuffer = await selectedFile.arrayBuffer();
      
      const videoCommand = new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: videoFileName,
        Body: new Uint8Array(videoBuffer),
        ContentType: selectedFile.type, // Important for playback
        CacheControl: 'public, max-age=31536000, immutable', 
      });

      await r2Client.send(videoCommand);
      setProgress(60);

      // PHASE 2: THUMBNAIL UPLOAD
      let finalThumbnailUrl = '';
      if (thumbnailBlob) {
        toast.loading('Uploading Thumbnail...', { id: toastId });
        const thumbBuffer = await thumbnailBlob.arrayBuffer();
        const thumbCommand = new PutObjectCommand({
          Bucket: 'chiti-videos',
          Key: thumbFileName,
          Body: new Uint8Array(thumbBuffer),
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        });
        await r2Client.send(thumbCommand);
        finalThumbnailUrl = `${PUBLIC_R2_DOMAIN}/${thumbFileName}`;
      }

      const publicVideoUrl = `${PUBLIC_R2_DOMAIN}/${videoFileName}`;
      setProgress(85);

      // PHASE 3: DATABASE SAVE (With Profile Pic Fix)
      toast.loading('Finalizing Post...', { id: toastId });
      
      // Ye logic ensure karega ki agar user ka avatar null hai, toh Dicebear se generate ho
      const userAvatar = user.user_metadata?.avatar_url 
        || user.user_metadata?.picture 
        || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: publicVideoUrl,
        thumbnail_url: finalThumbnailUrl || publicVideoUrl + "#t=0.1",
        caption: caption,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Chiti User',
        user_avatar: userAvatar, // Ab profile pic blank nahi hogi
        likes_count: 0,
        views_count: 0
      }]);

      if (dbError) throw dbError;

      setProgress(100);
      toast.success('Your Short is Live! 🚀', { id: toastId });

      // Clean Reset
      setSelectedFile(null);
      setPreviewUrl('');
      setCaption('');
      setThumbnailBlob(null);

    } catch (error: any) {
      console.error("Upload Error:", error);
      toast.error(`Upload failed: ${error.message}`, { id: toastId });
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  // --- UI RENDER (FULL CODE - NO CHANGES) ---
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
          <p className="text-gray-500 text-sm mt-1 text-center px-4">Fast Direct-to-R2 Upload</p>
          <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
        </label>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative aspect-[9/16] rounded-[32px] overflow-hidden bg-gray-900 ring-1 ring-white/10 mx-auto max-h-[450px] shadow-2xl">
            <video 
              ref={videoRef}
              src={previewUrl} 
              className={`w-full h-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} 
              controls 
            />
          </div>

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

          <textarea 
            placeholder="Share the story behind this short... #chiti"
            className="w-full bg-gray-900 p-5 rounded-[24px] outline-none border border-gray-800 focus:border-blue-500 min-h-[120px]"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-5 rounded-[24px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-blue-600/20"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            {isUploading ? `UPLOADING ${progress}%` : 'PUBLISH NOW'}
          </button>
        </div>
      )}
    </div>
  );
} 
