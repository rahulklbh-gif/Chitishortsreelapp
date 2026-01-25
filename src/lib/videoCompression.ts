import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

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
  
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
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

    // Write input file
    const inputName = 'input.mp4';
    const outputName = 'output.mp4';
    
    await ffmpegInstance.writeFile(inputName, await fetchFile(file));

    // Compress to 480p with low bitrate (aiming for 2-5MB for 30sec video)
    // -vf scale=-2:480 ensures width is divisible by 2
    // -b:v 400k targets ~400kbps video bitrate
    // -maxrate 600k caps bitrate spikes
    // -bufsize 1200k sets buffer size
    // -preset fast balances speed and compression
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
      '-t', '30', // Limit to 30 seconds
      outputName
    ]);

    onProgress?.({ phase: 'complete', progress: 100, message: 'Compression complete!' });

    // Read output file
    const data = await ffmpegInstance.readFile(outputName);
    
    // Clean up
    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    return new Blob([data], { type: 'video/mp4' });
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
