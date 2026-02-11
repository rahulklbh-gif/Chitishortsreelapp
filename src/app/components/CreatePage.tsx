"use client";
import { Upload, Video, Sparkles, Loader2, Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react'; // useRef add kiya
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- R2 Client Configuration ---
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com`,
  credentials: {
    // Vite ke liye VITE_ prefix check karein
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || "",
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
  
  // Naya state thumbnail ke liye
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const filters = [
    { name: 'Normal', value: 'none', class: '' },
    { name: 'Bright', value: 'bright', class: 'brightness-125 contrast-110' },
    { name: 'Grayscale', value: 'gray', class: 'grayscale' },
    { name: 'Cinematic', value: 'cine', class: 'saturate-150 contrast-125 brightness-90' },
  ];

  // --- THUMBNAIL GENERATOR FUNCTION ---
  const generateThumbnail = (file: File) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = 1; // 1 second par snapshot lega
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

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size too big! Keep it under 100MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    generateThumbnail(file); // Thumbnail generate karo
    toast.success("Video added! Thumbnail generated.");
  };

  // --- DIRECT R2 UPLOAD LOGIC ---
  const handleUpload = async () => {
    if (!selectedFile || !user) {
      toast.error("Please select a video and ensure you are logged in.");
      return;
    }

    setIsUploading(true);
    setProgress(10);
    const toastId = toast.loading('Preparing secure direct R2 upload...');

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const baseName = `${Math.random().toString(36).substring(2)}-${Date.now()}`;
      const videoFileName = `${baseName}.${fileExt}`;
      const thumbFileName = `${baseName}.jpg`;

      setProgress(20);
      toast.loading('Uploading Video & Thumbnail directly...', { id: toastId });

      // 1. Upload Video (Directly from Browser)
      const videoBuffer = await selectedFile.arrayBuffer();
      const videoCommand = new PutObjectCommand({
        Bucket: 'chiti-videos',
        Key: videoFileName,
        Body: new Uint8Array(videoBuffer),
        ContentType: selectedFile.type,
        CacheControl: 'public, max-age=31536000', // Browser caching for speed
      });
      await r2Client.send(videoCommand);

      setProgress(50);

      // 2. Upload Thumbnail (Directly from Browser)
      let finalThumbnailUrl = '';
      if (thumbnailBlob) {
        const thumbBuffer = await thumbnailBlob.arrayBuffer();
        const thumbCommand = new PutObjectCommand({
          Bucket: 'chiti-videos',
          Key: thumbFileName,
          Body: new Uint8Array(thumbBuffer),
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000',
        });
        await r2Client.send(thumbCommand);
        finalThumbnailUrl = `https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/${thumbFileName}`;
      }

      setProgress(80);
      const publicVideoUrl = `https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/${videoFileName}`;

      // --- USER PROFILE PIC FIX ---
      const userAvatar = user?.user_metadata?.avatar_url || 
                        user?.user_metadata?.picture || 
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

      // 3. Save Record to Supabase
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: publicVideoUrl,
        thumbnail_url: finalThumbnailUrl || publicVideoUrl + "#t=0.1", 
        caption: caption,
        user_id: user?.id,
        user_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Chiti User',
        user_avatar: userAvatar, // Ab profile pic blank nahi hogi
        likes_count: 0,
        views_count: 0
      }]);

      if (dbError) throw dbError;

      setProgress(100);
      toast.success('Short Published Successfully! 🚀', { id: toastId });

      // Reset State
      setSelectedFile(null);
      setPreviewUrl('');
      setCaption('');
      setThumbnailBlob(null);

    } catch (error: any) {
      console.error("Upload Error:", error);
      toast.error(error.message || "Something went wrong during upload", { id: toastId });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  // --- UI CODE ---
  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-10 text-center">
      <div className="p-6 bg-gray-900 rounded-full mb-4">
        <Video size={48} className="text-blue-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Please Login First</h2>
      <p className="text-gray-500">You need to sign in to create shorts.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black italic">CHITI CREATOR</h1>
        {selectedFile && <button onClick={() => setSelectedFile(null)} className="text-red-500 font-bold">Cancel</button>}
      </header>

      {!selectedFile ? (
        <label className="flex flex-col items-center justify-center aspect-[9/16] bg-gray-900 border-2 border-dashed border-gray-700 rounded-[40px] cursor-pointer transition-all hover:border-blue-500">
          <div className="bg-blue-600 p-5 rounded-full mb-4 shadow-lg shadow-blue-500/20">
            <Upload size={32} className="text-white" />
          </div>
          <p className="font-bold text-lg">Pick a Video</p>
          <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
        </label>
      ) : (
        <div className="space-y-6">
          <div className="relative aspect-[9/16] rounded-[32px] overflow-hidden bg-gray-900 ring-1 ring-white/10 mx-auto max-h-[450px]">
            <video 
              ref={videoRef}
              src={previewUrl} 
              className={`w-full h-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} 
              controls 
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Apply Filter</p>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {filters.map(f => (
                <button 
                  key={f.value}
                  onClick={() => setSelectedFilter(f.value)}
                  className={`px-5 py-2 rounded-full font-bold whitespace-nowrap transition-all ${selectedFilter === f.value ? 'bg-white text-black' : 'bg-gray-800 text-gray-400'}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <textarea 
            placeholder="Write a caption... #shorts"
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
            {isUploading ? `UPLOADING ${progress}%` : 'PUBLISH VIDEO'}
          </button>
        </div>
      )}
    </div>
  );
} 
