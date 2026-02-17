export async function compressVideoTo480p(file: File, onProgress: any): Promise<Blob> {
  try {
    const ffmpegInstance = await initFFmpeg();
    
    if (!window.crossOriginIsolated) {
      throw new Error("Browser Security Block: Headers not active. Please clear cache.");
    }

    const inputName = 'input.mp4';
    const outputName = 'output.mp4';
    
    // File likhna
    await ffmpegInstance.writeFile(inputName, await fetchFile(file));

    // Command ko aur behtar kiya gaya hai (Chhota nahi, balki complete kiya gaya hai)
    await ffmpegInstance.exec([
      '-i', inputName,
      '-vf', 'scale=480:-2',      // 480p scaling logic
      '-c:v', 'libx264',          // Standard video codec
      '-preset', 'ultrafast',     // Spelling fixed
      '-crf', '28',               // Quality balance
      '-movflags', 'faststart',   // Streaming ke liye sabse zaruri
      '-pix_fmt', 'yuv420p',      // Sabhi devices ke liye support
      outputName
    ]);

    // Data read karna
    const data = await ffmpegInstance.readFile(outputName);
    
    // Memory se purani files delete karna (Good practice)
    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
  } catch (error: any) {
    console.error('Compression Detail:', error);
    throw new Error(error.message || 'Compression failed');
  }
} 
