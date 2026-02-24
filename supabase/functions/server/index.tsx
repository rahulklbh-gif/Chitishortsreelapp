import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2.91.1";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Aapka Custom R2 Domain
const R2_DOMAIN = "https://cdn.chitishort.store";

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-d82a0f74/health", (c) => {
  return c.json({ status: "ok" });
});

// Initialize buckets on startup
async function initializeBuckets() {
  const { data: buckets } = await supabase.storage.listBuckets();
  
  const videoBucketName = 'make-d82a0f74-videos';
  const musicBucketName = 'make-d82a0f74-music';
  
  const videoBucketExists = buckets?.some(bucket => bucket.name === videoBucketName);
  const musicBucketExists = buckets?.some(bucket => bucket.name === musicBucketName);
  
  if (!videoBucketExists) {
    await supabase.storage.createBucket(videoBucketName, { public: false });
    console.log('Created videos bucket');
  }
  
  if (!musicBucketExists) {
    await supabase.storage.createBucket(musicBucketName, { public: false });
    console.log('Created music bucket');
  }
}

// Call initialization
initializeBuckets().catch(console.error);

// Get all videos
app.get("/make-server-d82a0f74/videos", async (c) => {
  try {
    const videos = await kv.getByPrefix('video:');
    
    // 🔥 UPDATED: Signed URLs replaced with your R2 Domain URLs
    const videosWithUrls = await Promise.all(
      videos.map(async (video: any) => {
        if (video.videoPath) {
          // Hum purana path use kar rahe hain jo aapke R2 "chiti-videos" bucket me hai
          const videoUrl = `${R2_DOMAIN}/${video.videoPath}`;
          
          return {
            ...video,
            videoUrl: videoUrl
          };
        }
        return video;
      })
    );
    
    return c.json({ videos: videosWithUrls });
  } catch (error: any) {
    console.error('Error fetching videos:', error);
    return c.json({ error: 'Failed to fetch videos: ' + error.message }, 500);
  }
});

// Upload video metadata
app.post("/make-server-d82a0f74/upload-video", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return c.json({ error: 'Unauthorized: ' + (authError?.message || 'Invalid token') }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('video') as File;
    const caption = formData.get('caption') as string;
    const music = formData.get('music') as string;
    const filter = formData.get('filter') as string;

    if (!file) {
      return c.json({ error: 'No video file provided' }, 400);
    }

    // Generate path matching your R2 structure
    const fileExt = file.name.split('.').pop();
    const fileName = `chiti_vids/${user.id}/${Date.now()}.${fileExt}`;

    // Note: Frontend directly uploads to R2, we save the metadata here
    const videoId = `video:${Date.now()}_${user.id}`;
    const videoData = {
      id: videoId,
      userId: user.id,
      username: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      videoPath: fileName,
      caption: caption || '',
      music: music || '',
      filter: filter || 'none',
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: new Date().toISOString()
    };

    await kv.set(videoId, videoData);

    return c.json({ 
      success: true, 
      message: 'Video metadata saved successfully',
      videoId,
      url: `${R2_DOMAIN}/${fileName}`
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed: ' + error.message }, 500);
  }
});

// Get music library
app.get("/make-server-d82a0f74/music", async (c) => {
  try {
    const { data: files, error } = await supabase.storage
      .from('make-d82a0f74-music')
      .list('', {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error('Error listing music:', error);
      return c.json({ music: [] });
    }

    // Generate direct R2 URLs for music
    const musicWithUrls = await Promise.all(
      (files || []).map(async (file) => {
        return {
          id: file.name,
          name: file.name.replace('.mp3', '').replace(/_/g, ' '),
          url: `${R2_DOMAIN}/music/${file.name}`
        };
      })
    );

    return c.json({ music: musicWithUrls.filter(m => m.url) });
  } catch (error: any) {
    console.error('Error fetching music:', error);
    return c.json({ error: 'Failed to fetch music: ' + error.message }, 500);
  }
});

// Like/Unlike video
app.post("/make-server-d82a0f74/videos/:videoId/like", async (c) => {
  try {
    const videoId = c.req.param('videoId');
    const { action } = await c.req.json(); // 'like' or 'unlike'
    
    const video = await kv.get(videoId);
    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    video.likes = action === 'like' ? (video.likes || 0) + 1 : Math.max(0, (video.likes || 0) - 1);
    await kv.set(videoId, video);

    return c.json({ success: true, likes: video.likes });
  } catch (error: any) {
    console.error('Error updating like:', error);
    return c.json({ error: 'Failed to update like: ' + error.message }, 500);
  }
});

// Add comment
app.post("/make-server-d82a0f74/videos/:videoId/comments", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user } } = accessToken 
      ? await supabase.auth.getUser(accessToken) 
      : { data: { user: null } };

    const videoId = c.req.param('videoId');
    const { text } = await c.req.json();

    if (!text?.trim()) {
      return c.json({ error: 'Comment text is required' }, 400);
    }

    const commentId = `comment:${videoId}:${Date.now()}`;
    const comment = {
      id: commentId,
      videoId,
      userId: user?.id || 'anonymous',
      username: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Anonymous',
      text: text.trim(),
      likes: 0,
      createdAt: new Date().toISOString()
    };

    await kv.set(commentId, comment);

    // Update video comment count
    const video = await kv.get(videoId);
    if (video) {
      video.comments = (video.comments || 0) + 1;
      await kv.set(videoId, video);
    }

    return c.json({ success: true, comment });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return c.json({ error: 'Failed to add comment: ' + error.message }, 500);
  }
});

// Get comments for a video
app.get("/make-server-d82a0f74/videos/:videoId/comments", async (c) => {
  try {
    const videoId = c.req.param('videoId');
    const allComments = await kv.getByPrefix(`comment:${videoId}:`);
    
    // Sort by newest first
    const comments = allComments.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({ comments });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return c.json({ error: 'Failed to fetch comments: ' + error.message }, 500);
  }
});

Deno.serve(app.fetch); 
