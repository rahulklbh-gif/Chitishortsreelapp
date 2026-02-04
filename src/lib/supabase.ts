import { createClient } from '@supabase/supabase-js';

// White screen se bachne ke liye humne default khali string rakhi hai
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Supabase Client Initialization
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * AUTH FUNCTIONS: Dono Google aur Email login support karne ke liye
 */
export const authActions = {
  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'openid email profile https://www.googleapis.com/auth/youtube.upload'
      }
    });
    return { error };
  },

  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }
};

// --- AAPKA PURANA VIDEO CACHING CODE (STRICTLY KEPT AS IS) ---
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
      const video = videos.find((v: CachedVideo) => v.id === videoId);
      if (video) {
        video.timestamp = Date.now();
        localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(videos));
        return video.url;
      }
      return null;
    } catch { return null; }
  },
  set: (videoId: string, url: string) => {
    try {
      const cache = localStorage.getItem(VIDEO_CACHE_KEY);
      let videos: CachedVideo[] = cache ? JSON.parse(cache) : [];
      videos = videos.filter((v: CachedVideo) => v.id !== videoId);
      videos.push({ id: videoId, url, timestamp: Date.now() });
      if (videos.length > MAX_CACHE_SIZE) {
        videos.sort((a, b) => b.timestamp - a.timestamp);
        videos = videos.slice(0, MAX_CACHE_SIZE);
      }
      localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(videos));
    } catch (error) { console.error('Error caching video:', error); }
  },
  clear: () => { localStorage.removeItem(VIDEO_CACHE_KEY); }
};
