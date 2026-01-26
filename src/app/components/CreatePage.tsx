import { Upload, Video, Sparkles, Loader2, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function CreatePage() {
  const { user, session } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { toast.error('Please sign in first'); return; }

    // No Compression - Direct Selection to avoid "Compression Fail"
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    toast.success("Video ready to upload!");
  };

  const handleUpload = async () => {
    // Session se token nikalna (Provider token is must for YouTube)
    const token = (session as any)?.provider_token;
    
    if (!selectedFile) return;
    if (!token) {
      toast.error('Please Logout & Login with Google again to enable YouTube.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Publishing to YouTube Shorts...');

    try {
      const metadata = {
        snippet: {
          title: caption.substring(0, 90) || "Chiti Short",
          description: `${caption}\n\n#shorts #chitishorts`,
          categoryId: "22"
        },
        status: { privacyStatus: "public" }
      };

      const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      const uploadUrl = res.headers.get('Location');
      if (!uploadUrl) throw new Error("YouTube Permission missing or token expired.");

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile
      });

      if (uploadRes.ok) {
        toast.success('Short Published! 🚀', { id: toastId });
        setSelectedFile(null);
        setPreviewUrl('');
        setCaption('');
      } else {
        throw new Error("YouTube Upload failed.");
      }
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) return <div className="p-20 text-center font-bold">Please Login to Create</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-24 p-4">
      <h1 className="text-2xl font-black mb-6">Create Short</h1>
      
      {!selectedFile ? (
        <label className="flex flex-col items-center justify-center aspect-[9/16] bg-gray-900 border-2 border-dashed border-gray-700 rounded-3xl cursor-pointer">
          <Upload size={48} className="text-gray-600 mb-4" />
          <p className="font-bold">Select Video</p>
          <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-3xl overflow-hidden">
            <video src={previewUrl} className="w-full h-full object-cover" controls />
            <button onClick={() => setSelectedFile(null)} className="absolute top-2 right-2 bg-black/50 p-2 rounded-full"><X size={20}/></button>
          </div>
          
          <textarea 
            placeholder="Write a caption... #shorts"
            className="w-full bg-gray-900 p-4 rounded-2xl outline-none"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-blue-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            {isUploading ? 'Uploading...' : 'Post to YouTube'}
          </button>
        </div>
      )}
    </div>
  );
      }
