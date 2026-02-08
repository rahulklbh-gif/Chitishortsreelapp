"use client";
import { Upload, Video, Sparkles, Loader2, Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
// Naya Import: S3 Client for Cloudflare R2
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// 1. R2 Client Setup (Ise component ke bahar rakho)
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://0b25a09adcbd3ebc61ee73f2e958da9a.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
});

export function CreatePage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [progress, setProgress] = useState(0);

  const filters = [
    { name: 'Normal', value: 'none', class: '' },
    { name: 'Bright', value: 'bright', class: 'brightness-125 contrast-110' },
    { name: 'Grayscale', value: 'gray', class: 'grayscale' },
    { name: 'Cinematic', value: 'cine', class: 'saturate-150 contrast-125 brightness-90' },
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size too big! Keep it under 100MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    toast.success("Video added! Ready to post.");
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) {
      toast.error("Please select a video and ensure you are logged in.");
      return;
    }

    setIsUploading(true);
    setProgress(10);
    const toastId = toast.loading('Connecting to Cloudflare R2...');

    try {
      // 1. File Name and Path Generation
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;

      setProgress(30);
      toast.loading('Streaming video to R2 Bucket...', { id: toastId });

      // 2. Direct Upload to Cloudflare R2 using AWS SDK
      const uploadCommand = new PutObjectCommand({
        Bucket: "chiti-videos",
        Key: fileName,
        Body: selectedFile,
        ContentType: selectedFile.type,
      });

      // Uploading Process
      await r2Client.send(uploadCommand);

      setProgress(70);
      toast.loading('Generating Public Link...', { id: toastId });

      // 3. Generate the Public URL (Using your R2 Public Domain)
      const publicUrl = `https://pub-6ed99329d86c4069a604b3418b584ca2.r2.dev/${fileName}`;

      if (!publicUrl) throw new Error("Could not generate public URL");

      setProgress(90);
      toast.loading('Publishing to Chiti Feed...', { id: toastId });

      // 4. Save Record to Supabase 'posts' Table
      const { error: dbError } = await supabase.from('posts').insert([{
        video_url: publicUrl, // Link from R2
        caption: caption,
        user_id: user?.id,
        user_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Chiti User',
        user_avatar: user?.user_metadata?.avatar_url,
        likes_count: 0,
        views_count: 0
      }]);

      if (dbError) throw dbError;

      setProgress(100);
      toast.success('Short Published Successfully! 🚀', { id: toastId });

      // Reset form on success
      setSelectedFile(null);
      setPreviewUrl('');
      setCaption('');

    } catch (error: any) {
      console.error("Critical Upload Error:", error);
      toast.error(error.message || "Cloudflare R2 Connection Failed", { id: toastId });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

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
