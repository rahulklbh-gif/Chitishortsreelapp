"use client";

import { useRef, useEffect, useState, useMemo } from 'react';
import { VideoActions } from './VideoActions';
import { Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { toast } from 'sonner';

const FILTERS_STYLE: any = {
  none: { style: "" },
  crystal: { style: "brightness(1.4) contrast(1.1) saturate(1.1)" },
  angel: { style: "brightness(1.6) saturate(1.2) contrast(0.9)" },
  ivory: { style: "brightness(1.3) sepia(0.1) contrast(1.1)" },
  soft: { style: "brightness(1.2) blur(0.5px)" },
  storm: { style: "contrast(1.3) brightness(1.1)", vfx: 'lightning' },
  pulse: { style: "", vfx: 'pulse' },
  quad: { isGrid: true, cols: 2, rows: 2, count: 4 },
  sixer: { isGrid: true, cols: 2, rows: 3, count: 6 },
  triple: { isGrid: true, cols: 1, rows: 3, count: 3 },
  cine: { style: "contrast(1.6) saturate(0.8) brightness(0.9)" },
  teal: { style: "hue-rotate(-10deg) saturate(1.8) contrast(1.2)" },
  retro: { style: "sepia(0.8) contrast(1.2) brightness(0.9)" },
  noir: { style: "grayscale(1) contrast(1.8)" },
  warm: { style: "sepia(0.4) saturate(1.6) brightness(1.1)" },
  gold: { style: "sepia(0.5) brightness(1.1) saturate(2)" },
  cyber: { style: "hue-rotate(280deg) saturate(2) contrast(1.2)" },
  dream: { style: "blur(1.2px) brightness(1.2)" },
  mono: { style: "grayscale(1) contrast(1.1)" },
  vivid: { style: "saturate(3) contrast(1.2)" },
  ocean: { style: "hue-rotate(180deg) brightness(1.1)" }
};

export interface Video {
  id: string;
  video_url: string; 
  url?: string;     
  thumbnail: string;
  username: string;
  avatar: string;
  caption: string;
  musicTitle: string;
  likes: number;
  comments: number;
  shares: number;
  hashtags: string[];
  user_id?: string; 
  filter_name?: string; 
}

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
  onComment: () => void;
}

export function VideoPlayer({ video, isActive, onComment }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user: currentUser } = useAuth(); 
  const [isMuted, setIsMuted] = useState(true);

  // ✅ SMART LINK FIX: Ensuring CDN domain is used here too
  const actualVideoUrl = useMemo(() => {
    const rawUrl = video.video_url || video.url || "";
    return rawUrl.replace(
      /pub-[a-zA-Z0-9]+\.r2\.dev/g, 
      'cdn.chitishort.store'
    );
  }, [video.video_url, video.url]);

  const currentFilter = useMemo(() => {
    return FILTERS_STYLE[video.filter_name || 'none'] || FILTERS_STYLE.none;
  }, [video.filter_name]);

  useEffect(() => {
    if (isActive && video.id) {
      supabase.rpc('increment_views', { post_id: video.id });
    }
  }, [isActive, video.id]);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => console.log("Play blocked"));
        }
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  const handleFollow = async () => {
    if (!currentUser) { toast.error("Login please!"); return; }
    if (!video.user_id || currentUser.id === video.user_id) return;
    try {
      const { error } = await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: video.user_id }]);
      if (error) { if (error.code === '23505') toast.info("Already following"); else throw error; }
      else {
        await supabase.rpc('increment_followers', { user_id: video.user_id });
        await supabase.from('notifications').insert([{ type: 'follow', sender_id: currentUser.id, sender_name: currentUser.user_metadata.username || "User", receiver_id: video.user_id, content: 'followed you' }]);
        toast.success(`Followed @${video.username}`);
      }
    } catch (err) { toast.error("Follow failed"); }
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const handleShare = () => {
    if (navigator.share) navigator.share({ title: video.username, text: video.caption, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); toast.success("Copied!"); }
  };

  const renderVideo = () => {
    if (currentFilter.isGrid) {
      return (
        <div className="w-full h-full grid" style={{ gridTemplateColumns: `repeat(${currentFilter.cols}, 1fr)`, gridTemplateRows: `repeat(${currentFilter.rows}, 1fr)` }}>
          {[...Array(currentFilter.count)].map((_, i) => (
            <div key={i} className="relative w-full h-full border-[0.2px] border-white/5">
              <video 
                ref={i === 0 ? videoRef : null} 
                src={actualVideoUrl} 
                loop 
                muted={isMuted || i !== 0} 
                playsInline 
                className="w-full h-full object-cover" 
                style={{ filter: currentFilter.style }} 
              />
            </div>
          ))}
        </div>
      );
    }
    return (
      <video 
        ref={videoRef} 
        src={actualVideoUrl} 
        poster={video.thumbnail} 
        loop 
        muted={isMuted} 
        playsInline 
        preload="auto" 
        className="relative z-10 w-full h-full object-contain md:object-cover" 
        style={{ filter: currentFilter.style }} 
        onClick={toggleMute} 
      />
    );
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <img src={video.thumbnail} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30" />
      <div className="relative z-10 w-full h-full">
        {renderVideo()}
        {currentFilter.vfx === 'lightning' && <div className="absolute inset-0 bg-blue-400/10 animate-pulse pointer-events-none z-20" />}
      </div>
      <button onClick={toggleMute} className="absolute top-20 right-3 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center z-30 border border-white/10">
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>
      <div className="absolute bottom-24 left-3 right-20 z-20 pointer-events-none">
        <div className="space-y-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <img 
              src={video.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.username}`} 
              className="w-10 h-10 rounded-full border border-white object-cover shadow-lg" 
              alt={video.username}
            />
            <h3 className="text-white font-bold text-lg italic">@{video.username || 'user'}</h3>
          </div>
          <p className="text-white text-sm line-clamp-2">{video.caption}</p>
          <div className="flex items-center gap-2 text-white/90 text-xs bg-black/20 w-fit px-3 py-1 rounded-full">
            <span>🎵 {video.musicTitle || 'Original Audio'}</span>
          </div>
        </div>
      </div>
      <VideoActions 
        videoId={video.id} 
        initialLikes={video.likes} 
        videoOwnerId={video.user_id} 
        videoUrl={actualVideoUrl} 
        onComment={onComment} 
        onShare={handleShare} 
        onFollow={handleFollow} 
      />
    </div>
  );
}
