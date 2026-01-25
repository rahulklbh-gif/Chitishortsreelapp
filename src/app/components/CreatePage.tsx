import { Upload, Video, Music, Sparkles, Loader2, CheckCircle } from 'lucide-react';
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
  
  // Compression and upload states
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);

  // Fetch music library
  useEffect(() => {
    fetchMusic();
  }, []);

  const fetchMusic = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-d82a0f74/music`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      const data = await response.json();
      setMusicTracks(data.music || []);
    } catch (error) {
      console.error('Error fetching music:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if user is logged in
    if (!user) {
      toast.error('Please sign in to upload videos');
      return;
    }

    // Check file size before processing
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 100) {
      toast.error('Video file is too large. Please select a smaller file.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Start compression automatically
    toast.info('Starting video compression...');
    setIsCompressing(true);
    setCompressionProgress({ phase: 'loading', progress: 0, message: 'Preparing...' });

    try {
      const compressed = await compressVideoTo480p(file, (progress) => {
        setCompressionProgress(progress);
      });

      setCompressedBlob(compressed);
      const { sizeMB, isWithinLimit } = getVideoFileSizeInfo(compressed);
      
      if (isWithinLimit) {
        toast.success(`Video compressed to ${sizeMB.toFixed(2)}MB! Ready to upload.`);
      } else {
        toast.warning(`Video is ${sizeMB.toFixed(2)}MB. Try selecting a shorter clip.`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Compression failed');
      setSelectedFile(null);
      setPreviewUrl('');
    } finally {
      setIsCompressing(false);
      setCompressionProgress(null);
    }
  };

  const handleUpload = async () => {
    if (!compressedBlob || !user || !session) {
      toast.error('Please sign in to upload');
      return;
    }

    const { sizeMB, isWithinLimit } = getVideoFileSizeInfo(compressedBlob);
    if (!isWithinLimit) {
      toast.error(`Video is too large (${sizeMB.toFixed(2)}MB). Please use a shorter clip.`);
      return;
    }

    setIsUploading(true);
    toast.info('Uploading video...');

    try {
      const formData = new FormData();
      formData.append('video', compressedBlob, `video_${Date.now()}.mp4`);
      formData.append('caption', caption);
      formData.append('music', selectedMusic);
      formData.append('filter', selectedFilter);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-d82a0f74/upload-video`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      toast.success('Video uploaded successfully! 🎉');
      
      // Reset form
      setSelectedFile(null);
      setPreviewUrl('');
      setCompressedBlob(null);
      setCaption('');
      setSelectedMusic('');
      setSelectedFilter('none');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  const filters = [
    { name: 'Normal', value: 'none', class: '' },
    { name: 'Grayscale', value: 'grayscale', class: 'grayscale' },
    { name: 'Sepia', value: 'sepia', class: 'sepia' },
    { name: 'Brightness', value: 'brightness', class: 'brightness-125' },
    { name: 'Contrast', value: 'contrast', class: 'contrast-125' },
    { name: 'Saturate', value: 'saturate', class: 'saturate-150' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center pb-20">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-gray-400 mb-6">
            You need to be signed in to upload videos
          </p>
          <p className="text-sm text-gray-500">
            Public users can only watch the feed. Create an account to start sharing!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-center">Create Video</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Upload Section */}
        <section className="space-y-4">
          {!selectedFile ? (
            <div className="space-y-3">
              <label className="block">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isCompressing || isUploading}
                />
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8 rounded-2xl cursor-pointer hover:opacity-90 transition">
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-12 h-12" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg">Upload Video</h3>
                      <p className="text-sm opacity-90">From your gallery</p>
                      <p className="text-xs opacity-75 mt-2">Auto-compressed to 480p · Max 30s</p>
                    </div>
                  </div>
                </div>
              </label>

              <div className="bg-gray-900 p-4 rounded-xl text-sm text-gray-400 space-y-2">
                <h4 className="font-semibold text-white">📊 Data Saver Technology</h4>
                <ul className="space-y-1 text-xs">
                  <li>✓ Videos compressed to 480p (2-5MB per video)</li>
                  <li>✓ Smart bitrate control for quality</li>
                  <li>✓ Automatic 30-second trim</li>
                  <li>✓ Efficient storage and bandwidth</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Compression Progress */}
              {isCompressing && compressionProgress && (
                <div className="bg-purple-900/30 border border-purple-500/50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    <p className="font-semibold text-purple-200">{compressionProgress.message}</p>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                      style={{ width: `${compressionProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Message */}
              {compressedBlob && !isCompressing && (
                <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-200">
                    Compressed to {getVideoFileSizeInfo(compressedBlob).sizeMB.toFixed(2)}MB
                  </p>
                </div>
              )}

              {/* Video Preview */}
              <div className="relative aspect-[9/16] max-h-96 bg-gray-900 rounded-2xl overflow-hidden mx-auto">
                <video
                  src={previewUrl}
                  controls
                  className={`w-full h-full object-cover ${filters.find(f => f.value === selectedFilter)?.class}`}
                />
              </div>

              {/* Filters */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Filters
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {filters.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setSelectedFilter(filter.value)}
                      className={`flex-shrink-0 p-2 rounded-lg transition ${
                        selectedFilter === filter.value
                          ? 'bg-purple-600 ring-2 ring-purple-400'
                          : 'bg-gray-900 hover:bg-gray-800'
                      }`}
                    >
                      <div className={`w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded ${filter.class}`} />
                      <p className="text-xs mt-1 text-center">{filter.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Music Selection */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Add Music {musicTracks.length === 0 && '(Upload .mp3 to Supabase music bucket)'}
                </h3>
                {musicTracks.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {musicTracks.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => setSelectedMusic(track.name)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${
                          selectedMusic === track.name
                            ? 'bg-purple-600 ring-2 ring-purple-400'
                            : 'bg-gray-900 hover:bg-gray-800'
                        }`}
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                          <Music className="w-6 h-6" />
                        </div>
                        <p className="flex-1 text-left font-semibold">{track.name}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 bg-gray-900 p-3 rounded-lg">
                    No music available. Upload .mp3 files to your Supabase 'make-d82a0f74-music' bucket.
                  </p>
                )}
              </div>

              {/* Caption */}
              <div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption... Use #hashtags to reach more people!"
                  className="w-full p-4 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  maxLength={300}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{caption.length}/300</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                    setCompressedBlob(null);
                    setCaption('');
                    setSelectedMusic('');
                    setSelectedFilter('none');
                  }}
                  disabled={isUploading || isCompressing}
                  className="flex-1 py-3 bg-gray-900 rounded-full font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || isCompressing || !compressedBlob}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Post Video'
                  )}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Tips */}
        {!selectedFile && (
          <section className="bg-gray-900 p-4 rounded-2xl space-y-2">
            <h3 className="font-semibold">Tips for Great Videos</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Videos are automatically compressed to 480p</li>
              <li>• Keep videos under 30 seconds (auto-trimmed)</li>
              <li>• Use good lighting and clear audio</li>
              <li>• Add trending music and #hashtags</li>
              <li>• Target file size: 2-5MB per video</li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
