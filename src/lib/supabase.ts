import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseAnonKey = publicAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Video cache for local storage
const VIDEO_CACHE_KEY = 'chiti_video_cache';
const MAX_CACHE_SIZE = 50; // Maximum number of videos to cache

interface CachedVideo {
  id: string;
  url: string;
  timestamp: number;
}

export const videoCacheManager = {
  get: (videoId: string): string | null => {
    try {
      const cache = localStorage.getItem(VIDEO_CACHE_KEY);
      if (!cache) return null;
      
      const videos: CachedVideo[] = JSON.parse(cache);
      const video = videos.find(v => v.id === videoId);
      
      if (video) {
        // Update timestamp
        video.timestamp = Date.now();
        localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(videos));
        return video.url;
      }
      return null;
    } catch {
      return null;
    }
  },

  set: (videoId: string, url: string) => {
    try {
      const cache = localStorage.getItem(VIDEO_CACHE_KEY);
      let videos: CachedVideo[] = cache ? JSON.parse(cache) : [];
      
      // Remove existing entry if present
      videos = videos.filter(v => v.id !== videoId);
      
      // Add new entry
      videos.push({ id: videoId, url, timestamp: Date.now() });
      
      // Keep only the most recent MAX_CACHE_SIZE videos
      if (videos.length > MAX_CACHE_SIZE) {
        videos.sort((a, b) => b.timestamp - a.timestamp);
        videos = videos.slice(0, MAX_CACHE_SIZE);
      }
      
      localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(videos));
    } catch (error) {
      console.error('Error caching video:', error);
    }
  },

  clear: () => {
    localStorage.removeItem(VIDEO_CACHE_KEY);
  }
};
