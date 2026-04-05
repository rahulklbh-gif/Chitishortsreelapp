"use client";
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Music, Sparkles, Type, Send, Loader2, 
  Check, Search, Play, Pause, Trash2, Maximize2 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// --- STORY FILTERS (15 Custom Styles) ---
const STORY_FILTERS: any = {
  none: { name: "Normal", style: "none" },
  remini: { name: "Remini Pro", style: "contrast(1.2) saturate(1.3) brightness(1.1) sharpen" },
  crystal: { name: "Crystal", style: "brightness(1.4) contrast(1.1) saturate(1.1)" },
  vintage: { name: "Vintage", style: "sepia(0.6) contrast(1.2)" },
  noir: { name: "Noir", style: "grayscale(1) contrast(1.5)" },
  glow: { name: "Gold Glow", style: "sepia(0.3) saturate(1.8) brightness(1.1)" },
  cyber: { name: "Cyber", style: "hue-rotate(180deg) saturate(2)" },
  vivid: { name: "Vivid", style: "saturate(2.5) contrast(1.2)" },
  cool: { name: "Cool Ice", style: "hue-rotate(30deg) brightness(1.1)" },
  soft: { name: "Soft Dream", style: "blur(0.5px) brightness(1.1)" },
  hdr: { name: "HDR Mode", style: "contrast(1.4) saturate(1.2)" },
  warm: { name: "Warmth", style: "sepia(0.4) saturate(1.5)" },
  faded: { name: "Faded", style: "opacity(0.8) contrast(0.9)" },
  sunset: { name: "Sunset", style: "hue-rotate(-20deg) saturate(1.6)" },
  ocean: { name: "Ocean", style: "hue-rotate(160deg) saturate(1.2)" }
};

interface StoryEditorProps {
  videoUrl: string;
  onCancel: () => void;
  user: any;
}

export default function StoryEditor({ videoUrl, onCancel, user }: StoryEditorProps) {
  // States
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [isUploading, setIsUploading] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [activeMusic, setActiveMusic] = useState<any>(null);
  const [musicList, setMusicList] = useState<any[]>([]);
  const [audioPlayId, setAudioPlayId] = useState<string | null>(null);
  
  // Text Overlay States
  const [textOverlays, setTextOverlays] = useState<any[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [currentColor, setCurrentColor] = useState("#ffffff");
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load Music Library
  useEffect(() => {
    const fetchMusic = async () => {
      const { data } = await supabase.from('music_library').select('*');
      if (data) setMusicList(data);
    };
    fetchMusic();
  }, []);

  // --- STORY PUBLISH LOGIC ---
  const handlePublishStory = async () => {
    if (!user) return toast.error("Login required!");
    setIsUploading(true);

    try {
      // 24 Hour Expiry Calculation
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase.from('stories').insert([{
        user_id: user.id,
        media_url: videoUrl, // Gallery/Feed ka direct link
        filter_name: selectedFilter,
        music_url: activeMusic?.audio_url || null,
        text_content: textOverlays, // JSON metadata
        expires_at: expiresAt.toISOString()
      }]);

      if (error) throw error;

      toast.success("Story shared to Chiti! 🔥");
      onCancel(); // Close Editor
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Draggable Text Logic (Simplified from your CreatePage)
  const addText = () => {
    if (!currentText.trim()) return setIsAddingText(false);
    setTextOverlays([...textOverlays, { 
      id: Date.now(), text: currentText, color: currentColor, x: 50, y: 50 
    }]);
    setCurrentText("");
    setIsAddingText(false);
  };

  return (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col font-sans">
      {/* Top Header */}
      <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-[50] bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={onCancel} className="p-3 bg-black/20 backdrop-blur-xl rounded-full border border-white/10 text-white">
          <X size={24} />
        </button>
        <div className="flex gap-4">
          <button onClick={() => setShowMusic(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/20">
            <Music size={18} className="text-pink-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">{activeMusic ? 'Music Added' : 'Add Sound'}</span>
          </button>
          <button onClick={() => setIsAddingText(true)} className="p-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 text-yellow-400">
            <Type size={20} />
          </button>
        </div>
      </div>

      {/* Main Video Preview */}
      <div className="flex-1 relative flex items-center justify-center bg-zinc-950">
        <video 
          ref={videoRef}
          src={videoUrl} 
          autoPlay loop muted playsInline
          className="w-full h-full object-cover"
          style={{ filter: STORY_FILTERS[selectedFilter].style }}
        />

        {/* Render Draggable Text Overlays */}
        {textOverlays.map(t => (
          <div 
            key={t.id}
            className="absolute text-center cursor-move select-none z-[100]"
            style={{ top: `${t.y}%`, left: `${t.x}%`, transform: 'translate(-50%, -50%)', color: t.color, fontSize: '32px' }}
          >
            <span className="font-black drop-shadow-2xl px-4">{t.text}</span>
          </div>
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 inset-x-0 p-8 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-8">
        {/* Filter Picker */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {Object.keys(STORY_FILTERS).map(key => (
            <button key={key} onClick={() => setSelectedFilter(key)} className="flex flex-col items-center gap-2 shrink-0">
              <div className={`w-14 h-14 rounded-2xl border-2 transition-all overflow-hidden ${selectedFilter === key ? 'border-pink-500 scale-110' : 'border-transparent opacity-50'}`}>
                 <div className="w-full h-full bg-zinc-800" style={{ filter: STORY_FILTERS[key].style }} />
              </div>
              <span className={`text-[8px] font-black uppercase ${selectedFilter === key ? 'text-pink-500' : 'text-zinc-500'}`}>{STORY_FILTERS[key].name}</span>
            </button>
          ))}
        </div>

        {/* Share Button */}
        <button 
          onClick={handlePublishStory}
          disabled={isUploading}
          className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl font-black text-white flex items-center justify-center gap-3 active:scale-95 transition-all shadow-2xl shadow-pink-900/20"
        >
          {isUploading ? <Loader2 className="animate-spin" /> : <Send size={22} />}
          {isUploading ? 'SHARING TO CHITI...' : 'SHARE STORY'}
        </button>
      </div>

      {/* Text Editor Modal */}
      {isAddingText && (
        <div className="fixed inset-0 z-[1100] bg-black/95 flex flex-col p-8 items-center justify-center">
           <input 
             autoFocus
             value={currentText}
             onChange={e => setCurrentText(e.target.value)}
             className="bg-transparent text-center text-4xl font-black outline-none w-full"
             style={{ color: currentColor }}
             placeholder="Type Story Text..."
           />
           <div className="flex gap-4 mt-10">
              {['#ffffff', '#ff0000', '#00ff00', '#0088ff', '#ffff00'].map(c => (
                <button key={c} onClick={() => setCurrentColor(c)} className="w-10 h-10 rounded-full border-2 border-white/20" style={{ backgroundColor: c }} />
              ))}
           </div>
           <button onClick={addText} className="mt-10 bg-white text-black px-10 py-3 rounded-full font-black uppercase text-xs">Done</button>
        </div>
      )}

      {/* Music Library (Reuse Logic) */}
      <audio ref={audioRef} hidden />
    </div>
  );
}
