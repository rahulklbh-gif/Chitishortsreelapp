import { createClient } from '@supabase/supabase-js';

// Humne yahan direct details daal di hain taaki error khatam ho jaye
const supabaseUrl = 'https://fuhbqtatyixpqrsyuozu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aGJxdGF0eWl4cHFyc3l1b3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNjAzMTUsImV4cCI6MjA4NDczNjMxNX0.ds8Ap039dQm2LYUv0-79_1AtddeZ3-AO6czG6OuoTVM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Video cache for local storage
const VIDEO_CACHE_KEY = 'chiti_video_cache';
const MAX_CACHE_SIZE = 50; 

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
      
      videos = videos.filter(v => v.id !== videoId);
      videos.push({ id: videoId, url, timestamp: Date.now() });
      
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
