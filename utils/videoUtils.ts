import { Scene, VideoSource } from "../types";

// Helper to get average color/brightness of a frame to detect cuts
const getFrameSignature = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
  try {
    const frame = ctx.getImageData(0, 0, width, height);
    const data = frame.data;
    let sum = 0;
    // Simple sampling: check every 100th pixel
    for (let i = 0; i < data.length; i += 4 * 100) {
      sum += data[i] + data[i + 1] + data[i + 2];
    }
    return sum;
  } catch (e) {
    // Canvas tainted or other error
    throw new Error("CORS_BLOCK");
  }
};

export const detectScenes = async (
  videoSource: VideoSource,
  threshold: number = 0.15, // Sensitivity 0-1
  onProgress: (progress: number) => void,
  signal?: AbortSignal
): Promise<Scene[]> => {
  return new Promise((resolve, reject) => {
    // 1. Pre-check for YouTube URLs to give immediate, clear feedback
    if (typeof videoSource === 'string') {
      const url = videoSource.toLowerCase();
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        reject("IS_YOUTUBE_URL");
        return;
      }
    }

    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    let url = '';
    let isFile = false;

    if (videoSource instanceof File) {
      url = URL.createObjectURL(videoSource);
      isFile = true;
    } else {
      url = videoSource;
    }
    
    // CRITICAL FIX: Only set crossOrigin for remote http/https URLs.
    // Setting it for 'blob:' URLs (local files) causes CORS errors in many browsers.
    if (!isFile && (url.startsWith('http://') || url.startsWith('https://'))) {
      video.crossOrigin = "anonymous";
    }
    
    video.src = url;

    const cleanup = () => {
      if (isFile) {
        URL.revokeObjectURL(url);
      }
      video.removeAttribute('src');
      video.load();
    };

    if (signal) {
        signal.addEventListener('abort', () => {
            cleanup();
            reject(new DOMException('Aborted', 'AbortError'));
        });
    }

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!isFinite(duration)) {
        cleanup();
        reject("Could not determine video duration. Stream might be live or inaccessible.");
        return;
      }

      const width = 320; // Lower resolution for processing speed
      const height = Math.floor(width * (video.videoHeight / video.videoWidth));
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        cleanup();
        reject("Could not create canvas context");
        return;
      }

      const scenes: Scene[] = [];
      const interval = 1.0; // Check every 1 second
      let currentTime = 0;
      
      let prevSignature = -1;
      let sceneStartTime = 0;
      let sceneStartFrame = "";
      
      // Store the visual of the previous interval to use as the "End Frame" of a scene
      let lastFrameUrl = "";

      const processFrame = async () => {
        if (signal?.aborted) return;

        if (currentTime >= duration) {
          // Finish last scene
          if (scenes.length === 0 || scenes[scenes.length - 1].endTime !== duration) {
             // Ensure we capture the very end
             video.currentTime = duration;
             // Wait a tick for seek
             await new Promise(r => setTimeout(r, 100));
             
             if (signal?.aborted) return;

             try {
                ctx.drawImage(video, 0, 0, width, height);
                const endFrame = canvas.toDataURL('image/jpeg', 0.7);
                
                // If we had a pending scene
                if (sceneStartTime < duration) {
                    scenes.push({
                      id: crypto.randomUUID(),
                      startTime: sceneStartTime,
                      endTime: duration,
                      startFrameUrl: sceneStartFrame || endFrame,
                      endFrameUrl: endFrame,
                      isProcessing: false
                    });
                }
             } catch (e) {
                console.warn("Could not capture final frame:", e);
             }
          }
          
          cleanup();
          onProgress(100);
          resolve(scenes);
          return;
        }

        // Seek
        video.currentTime = currentTime;
      };

      video.onseeked = () => {
        if (signal?.aborted) return;

        try {
          // Draw
          ctx.drawImage(video, 0, 0, width, height);
          const currentSignature = getFrameSignature(ctx, width, height);
          const currentFrameUrl = canvas.toDataURL('image/jpeg', 0.7);

          // Init first frame
          if (currentTime === 0) {
            sceneStartFrame = currentFrameUrl;
            sceneStartTime = 0;
            prevSignature = currentSignature;
            lastFrameUrl = currentFrameUrl;
          } else {
            // Detect change
            // Calculate percent difference roughly
            const diff = Math.abs(currentSignature - prevSignature) / (prevSignature + 1);
            
            const timeSinceCut = currentTime - sceneStartTime;
            const isForcedCut = timeSinceCut > 15; 
            
            if ((diff > threshold && timeSinceCut > 2) || isForcedCut) {
              scenes.push({
                id: crypto.randomUUID(),
                startTime: sceneStartTime,
                endTime: currentTime, // Use continuous timeline
                startFrameUrl: sceneStartFrame,
                endFrameUrl: lastFrameUrl, // Use the frame from the previous second as the visual end
                isProcessing: false
              });

              sceneStartTime = currentTime;
              sceneStartFrame = currentFrameUrl; // The current frame starts the NEXT scene
            }

            // Update history
            lastFrameUrl = currentFrameUrl;
          }

          prevSignature = currentSignature;
          onProgress(Math.min(99, Math.round((currentTime / duration) * 100)));
          
          currentTime += interval;
          processFrame(); // Next loop
        } catch (e) {
           cleanup();
           if (e instanceof Error && e.message === "CORS_BLOCK") {
              reject("CORS_BLOCK");
           } else {
              reject(e instanceof Error ? e.message : "Error processing frame");
           }
        }
      };
      
      // Start processing
      processFrame();
    };
    
    video.onerror = () => {
      cleanup();
      // Provide more detailed error if possible
      const err = video.error;
      let msg = "LOAD_ERROR";
      if (err) {
         if (err.code === 3) msg = "DECODE_ERROR"; // MEDIA_ERR_DECODE
         if (err.code === 4) msg = "SRC_NOT_SUPPORTED"; // MEDIA_ERR_SRC_NOT_SUPPORTED
      }
      reject(msg);
    };
  });
};

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};