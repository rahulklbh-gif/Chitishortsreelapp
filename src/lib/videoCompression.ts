import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export async function initFFmpeg() {
  if (ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  // ESM version mobile browsers ke liye zyada stable hai
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

export async function compressVideoTo480p(file: File, onProgress: any): Promise<Blob> {
  try {
    const ffmpegInstance = await initFFmpeg();
    
    // Check if headers are working
    if (!window.crossOriginIsolated) {
      throw new Error("Browser Security Block: Headers not active. Please clear cache.");
    }

    const inputName = 'input.mp4';
    const outputName = 'output.mp4';
    
    await ffmpegInstance.writeFile(inputName, await fetchFile(file));

    // Sabse simple command jo har mobile par chalti hai
    await ffmpegInstance.exec([
      '-i', inputName,
      '-vf', 'scale=-2:480',
      '-preset', 'ultafast', 
      '-crf', '30',
      outputName
    ]);

    const data = await ffmpegInstance.readFile(outputName);
    return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
  } catch (error: any) {
    console.error('Compression Detail:', error);
    // Agar headers ki wajah se fail hua toh user ko sahi info mile
    throw new Error(error.message || 'Compression failed');
  }
}

export function getVideoFileSizeInfo(blob: Blob) {
  return { sizeMB: blob.size / (1024 * 1024), isWithinLimit: true };
} 
