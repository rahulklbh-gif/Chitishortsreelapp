import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2.91.1";
import * as kv from "./kv_store.tsx";

const app = new Hono();

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
    
    // Generate signed URLs for each video
    const videosWithUrls = await Promise.all(
      videos.map(async (video: any) => {
        if (video.videoPath) {
          const { data } = await supabase.storage
            .from('make-d82a0f74-videos')
            .createSignedUrl(video.videoPath, 3600); // 1 hour expiry
          
          return {
            ...video,
            videoUrl: data?.signedUrl || null
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

// Upload video
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

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('make-d82a0f74-videos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: 'Upload failed: ' + uploadError.message }, 500);
    }

    // Save video metadata
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
      message: 'Video uploaded successfully',
      videoId 
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

    // Generate signed URLs
    const musicWithUrls = await Promise.all(
      (files || []).map(async (file) => {
        const { data } = await supabase.storage
          .from('make-d82a0f74-music')
          .createSignedUrl(file.name, 3600);
        
        return {
          id: file.name,
          name: file.name.replace('.mp3', '').replace(/_/g, ' '),
          url: data?.signedUrl || null
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