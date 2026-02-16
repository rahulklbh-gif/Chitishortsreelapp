import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util'; // 'toBlobURL' add kiya gaya hai

let ffmpeg: FFmpeg | null = null;

export interface CompressionProgress {
  phase: 'loading' | 'compressing' | 'complete';
  progress: number;
  message: string;
}

export async function initFFmpeg(onProgress?: (progress: CompressionProgress) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    console.log('FFmpeg:', message);
  });
  
  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.({
      phase: 'compressing',
      progress: Math.round(progress * 100),
      message: `Compressing... ${Math.round(progress * 100)}%`
    });
  });

  onProgress?.({ phase: 'loading', progress: 0, message: 'Loading compression engine...' });
  
  // ✅ FIX: Vercel/External URLs ke liye toBlobURL use karna best practice hai
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

export async function compressVideoTo480p(
  file: File,
  onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> {
  try {
    const ffmpegInstance = await initFFmpeg(onProgress);
    
    onProgress?.({ phase: 'compressing', progress: 0, message: 'Preparing video...' });

    const inputName = 'input.mp4';
    const outputName = 'output.mp4';
    
    await ffmpegInstance.writeFile(inputName, await fetchFile(file));

    // ✅ NOTE: Aapka original logic intact hai
    await ffmpegInstance.exec([
      '-i', inputName,
      '-vf', 'scale=-2:480',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-b:v', '400k',
      '-maxrate', '600k',
      '-bufsize', '1200k',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-movflags', '+faststart',
      '-t', '30', 
      outputName
    ]);

    onProgress?.({ phase: 'complete', progress: 100, message: 'Compression complete!' });

    const data = await ffmpegInstance.readFile(outputName);
    
    // Clean up
    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    // ✅ FIX: Readable array return karne ke liye Uint8Array use hota hai
    return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
  } catch (error) {
    console.error('Video compression failed:', error);
    throw new Error('Failed to compress video. Please try a different file.');
  }
}

export function getVideoFileSizeInfo(blob: Blob): { sizeMB: number; isWithinLimit: boolean } {
  const sizeMB = blob.size / (1024 * 1024);
  const isWithinLimit = sizeMB <= 10;
  return { sizeMB, isWithinLimit };
} 
