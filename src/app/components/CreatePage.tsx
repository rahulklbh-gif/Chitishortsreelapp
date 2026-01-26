import { Upload, Video, Music, Sparkles, Loader2, CheckCircle, Send, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { compressVideoTo480p, CompressionProgress, getVideoFileSizeInfo } from '@/lib/videoCompression';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

export function CreatePage() {
  const { user, session } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [selectedMusic, setSelectedMusic] = useState('');
  const [caption, setCaption] = useState('');
  const [musicTracks, setMusicTracks] = useState<any[]>([]);
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);

  useEffect(() => { fetchMusic(); }, []);

  const fetchMusic = async () => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-d82a0f74/music`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const data = await response.json();
      setMusicTracks(data.music || []);
    } catch (error) { console.error('Error fetching music:', error); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { toast.error('Please sign in first'); return; }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    setIsCompressing(true);
    setCompressionProgress({ phase: 'loading', progress: 0, message: 'Compressing for YouTube...' });

    try {
      const compressed = await compressVideoTo480p(file, (progress) => {
        setCompressionProgress(progress);
      });
      setCompressedBlob(compressed);
      toast.success("Compression Complete! Ready to Publish.");
    } catch (error: any) {
      toast.error('Compression failed');
    } finally {
      setIsCompressing(false);
      setCompressionProgress(null);
    }
  };

  // --- ASLI YOUTUBE UPLOAD LOGIC ---
  const handleUpload = async () => {
    const token = (session as any)?.provider_token;
    
    if (!compressedBlob || !token) {
      toast.error('Please Logout and Login again with Google to enable YouTube upload.');
      return;
    }

    setIsUploading(true);
    toast.info('Publishing to YouTube Shorts...');

    try {
      // 1. YouTube Metadata
      const metadata = {
        snippet: {
          title: caption.substring(0, 90) || "My Chiti Short",
          description: `${caption}\n\n#shorts #chitishorts #viral`,
          categoryId: "22"
        },
        status: { privacyStatus: "public" }
      };

      // 2. Start Resumable Session
      const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      const uploadUrl = res.headers.get('Location');
      if (!uploadUrl) throw new Error("YouTube Permission Missing");

      // 3. Upload File
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: compressedBlob
      });

      if (uploadRes.ok) {
        toast.success('Short Published Successfully! 🚀');
        setSelectedFile(null);
        setPreviewUrl('');
        setCaption('');
      } else {
        throw new Error("YouTube Upload Failed");
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload to YouTube');
    } finally {
      setIsUploading(false);
    }
  };

  const filters = [
    { name: 'Normal', value: 'none', class: '' },
    { name: 'Grayscale', value: 'grayscale', class: 'grayscale' },
    { name: 'Sepia', value: 'sepia', class: 'sepia' },
    { name: 'Cold', value: 'contrast', class: 'contrast-125' },
  ];

  if (!user) return <div className="p-10 text-center">Please Sign In</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="p-4 border-b border-gray-800 sticky top-0 bg-black z-50">
        <h1 className="text-xl font-bold text-center">Create Short</h1>
      </div>

      <div className="p-4 space-y-6">
        {!selectedFile ? (
          <label className="block bg-gray-900 border-2 border-dashed border-gray-700 rounded-3xl p-12 text-center cursor-pointer">
            <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
            <Upload className="mx-auto w-12 h-12 text-gray-500 mb-4" />
            <p className="font-bold text-lg">Select Video</p>
            <p className="text-sm text-gray-500">Auto-compress to 480p</p>
          </label>
        ) : (
          <div className="space-y-6">
            {isCompressing && (
              <div className="bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30 animate-pulse">
                <p className="text-sm font-bold text-blue-400">Processing: {compressionProgress?.progress}%</p>
              </div>
            )}

            <div className="relative aspect-[9/16] max-h-[450px] mx-auto rounded-3xl overflow-hidden bg-gray-900 shadow-2xl">
              <video src={previewUrl} controls className={`w-full h-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`} />
              <button onClick={() => setSelectedFile(null)} className="absolute top-4 right-4 bg-black/60 p-2 rounded-full"><X size={20}/></button>
            </div>

            <div className="flex gap-2 overflow-x-auto py-2">
              {filters.map(f => (
                <button key={f.value} onClick={() => setSelectedFilter(f.value)} className={`px-4 py-2 rounded-full text-xs font-bold ${selectedFilter === f.value ? 'bg-white text-black' : 'bg-gray-800 text-white'}`}>
                  {f.name}
                </button>
              ))}
            </div>

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's on your mind? #shorts"
              className="w-full bg-gray-900 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none h-24"
            />

            <button
              onClick={handleUpload}
              disabled={isUploading || isCompressing || !compressedBlob}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
              {isUploading ? 'Publishing...' : 'Publish to YouTube'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
