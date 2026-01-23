import { Upload, Video, Music, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

export function CreatePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const musicTracks = [
    { id: '1', title: 'Summer Vibes', artist: 'DJ Cool', duration: '2:30' },
    { id: '2', title: 'Chill Beats', artist: 'Lo-Fi Master', duration: '3:15' },
    { id: '3', title: 'Dance Party', artist: 'Beat Maker', duration: '2:45' },
    { id: '4', title: 'Acoustic Dreams', artist: 'Guitar Pro', duration: '3:00' },
  ];

  const filters = [
    { name: 'Normal', class: '' },
    { name: 'Grayscale', class: 'grayscale' },
    { name: 'Sepia', class: 'sepia' },
    { name: 'Brightness', class: 'brightness-125' },
    { name: 'Contrast', class: 'contrast-125' },
    { name: 'Saturate', class: 'saturate-150' },
  ];

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
                />
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8 rounded-2xl cursor-pointer hover:opacity-90 transition">
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-12 h-12" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg">Upload Video</h3>
                      <p className="text-sm opacity-90">From your gallery</p>
                      <p className="text-xs opacity-75 mt-2">Max 30s · Up to 10MB</p>
                    </div>
                  </div>
                </div>
              </label>

              <button className="w-full bg-gray-900 p-8 rounded-2xl hover:bg-gray-800 transition">
                <div className="flex flex-col items-center gap-3">
                  <Video className="w-12 h-12" />
                  <div className="text-center">
                    <h3 className="font-bold text-lg">Record Video</h3>
                    <p className="text-sm text-gray-400">Use your camera</p>
                    <p className="text-xs text-gray-500 mt-2">15s or 30s options</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Video Preview */}
              <div className="relative aspect-[9/16] max-h-96 bg-gray-900 rounded-2xl overflow-hidden mx-auto">
                <video src={previewUrl} controls className="w-full h-full object-cover" />
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
                      key={filter.name}
                      className="flex-shrink-0 p-2 bg-gray-900 rounded-lg hover:bg-gray-800"
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
                  Add Music
                </h3>
                <div className="space-y-2">
                  {musicTracks.map((track) => (
                    <button
                      key={track.id}
                      className="w-full flex items-center gap-3 p-3 bg-gray-900 rounded-xl hover:bg-gray-800"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                        <Music className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold">{track.title}</p>
                        <p className="text-sm text-gray-400">{track.artist}</p>
                      </div>
                      <span className="text-sm text-gray-400">{track.duration}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <textarea
                  placeholder="Add a caption... Use hashtags to reach more people!"
                  className="w-full p-4 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                  }}
                  className="flex-1 py-3 bg-gray-900 rounded-full font-semibold hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90">
                  Post Video
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
              <li>• Keep videos under 30 seconds for better engagement</li>
              <li>• Use good lighting and clear audio</li>
              <li>• Add trending music and hashtags</li>
              <li>• Videos are compressed to 480p/720p automatically</li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
