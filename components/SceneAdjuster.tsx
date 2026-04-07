import React, { useRef, useState, useEffect } from 'react';
import { Scene, VideoSource } from '../types';
import { X, Camera, Save, Play, Pause, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { formatTime } from '../utils/videoUtils';

interface SceneAdjusterProps {
  videoSource: VideoSource;
  scene: Scene;
  onClose: () => void;
  onSave: (updatedScene: Scene) => void;
}

const SceneAdjuster: React.FC<SceneAdjusterProps> = ({ videoSource, scene, onClose, onSave }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(scene.startTime);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  
  const [newStartTime, setNewStartTime] = useState(scene.startTime);
  const [newEndTime, setNewEndTime] = useState(scene.endTime);
  const [newStartFrame, setNewStartFrame] = useState(scene.startFrameUrl);
  const [newEndFrame, setNewEndFrame] = useState(scene.endFrameUrl);
  const [videoUrl, setVideoUrl] = useState<string>("");

  // Setup video source
  useEffect(() => {
    let url = "";
    if (videoSource instanceof File) {
      url = URL.createObjectURL(videoSource);
    } else {
      url = videoSource;
    }
    setVideoUrl(url);

    return () => {
      if (videoSource instanceof File) URL.revokeObjectURL(url);
    };
  }, [videoSource]);

  // Sync video time to state
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Ensure duration is set
      if (!duration && videoRef.current.duration) {
        setDuration(videoRef.current.duration);
      }
    }
  };
  
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const captureCurrentFrame = (): string | null => {
    if (!videoRef.current) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoRef.current, 0, 0);
    // Resize to reasonable processing size (similar to detection logic)
    const displayCanvas = document.createElement('canvas');
    const width = 320;
    const height = Math.floor(width * (canvas.height / canvas.width));
    displayCanvas.width = width;
    displayCanvas.height = height;
    
    const displayCtx = displayCanvas.getContext('2d');
    if (!displayCtx) return null;
    
    displayCtx.drawImage(canvas, 0, 0, width, height);
    return displayCanvas.toDataURL('image/jpeg', 0.8);
  };

  const captureFrame = (isStart: boolean) => {
    const dataUrl = captureCurrentFrame();
    if (!dataUrl || !videoRef.current) return;
       
    if (isStart) {
      setNewStartFrame(dataUrl);
      setNewStartTime(videoRef.current.currentTime);
    } else {
      setNewEndFrame(dataUrl);
      setNewEndTime(videoRef.current.currentTime);
    }
  };

  // Capture frame at a specific time - returns a Promise that resolves with the data URL
  const captureFrameAtTime = (time: number): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) { resolve(null); return; }
      
      videoRef.current.currentTime = time;
      
      const onSeeked = () => {
        videoRef.current?.removeEventListener('seeked', onSeeked);
        // Small delay to ensure frame is rendered
        setTimeout(() => {
          resolve(captureCurrentFrame());
        }, 50);
      };
      
      videoRef.current.addEventListener('seeked', onSeeked);
    });
  };

  const adjustBound = async (isStart: boolean, delta: number) => {
    let targetTime = isStart ? (newStartTime + delta) : (newEndTime + delta);
    targetTime = Math.max(0, Math.min(duration || videoRef.current?.duration || 100, targetTime));
    
    // Seek so user sees what is being captured
    seek(targetTime);
    
    const frame = await captureFrameAtTime(targetTime);
    if (!frame) return;
    
    if (isStart) {
      setNewStartTime(targetTime);
      setNewStartFrame(frame);
    } else {
      setNewEndTime(targetTime);
      setNewEndFrame(frame);
    }
  };

  const handleSave = async () => {
    let finalStartFrame = newStartFrame;
    let finalEndFrame = newEndFrame;

    // If start time changed but user didn't manually capture a new frame, auto-capture
    if (Math.abs(newStartTime - scene.startTime) > 0.05 && newStartFrame === scene.startFrameUrl) {
      const frame = await captureFrameAtTime(newStartTime);
      if (frame) finalStartFrame = frame;
    }

    // If end time changed but user didn't manually capture a new frame, auto-capture
    if (Math.abs(newEndTime - scene.endTime) > 0.05 && newEndFrame === scene.endFrameUrl) {
      const frame = await captureFrameAtTime(newEndTime);
      if (frame) finalEndFrame = frame;
    }

    onSave({
      ...scene,
      startTime: newStartTime,
      endTime: newEndTime,
      startFrameUrl: finalStartFrame,
      endFrameUrl: finalEndFrame,
      // Clear generated prompt if frames changed so user knows to regenerate
      generatedPrompt: (finalStartFrame !== scene.startFrameUrl || finalEndFrame !== scene.endFrameUrl) 
        ? undefined 
        : scene.generatedPrompt
    });
    onClose();
  };

  const seek = (seconds: number) => {
    if (videoRef.current) {
      const t = Math.max(0, Math.min(videoRef.current.duration || duration, seconds));
      videoRef.current.currentTime = t;
    }
  };

  const getPercent = (time: number) => {
    if (!duration || duration === 0) return 0;
    return (time / duration) * 100;
  };
  
  const isLocalFile = videoSource instanceof File;
  const needsCrossOrigin = !isLocalFile && typeof videoSource === 'string' && (videoSource.startsWith('http://') || videoSource.startsWith('https://'));

  // Auto-scroll timeline to keep playhead in view when zooming or playing
  useEffect(() => {
    if (zoom > 1 && timelineScrollRef.current) {
        // Calculate position of playhead in pixels
        const containerWidth = timelineScrollRef.current.clientWidth;
        const contentWidth = timelineScrollRef.current.scrollWidth;
        const playheadPos = (currentTime / duration) * contentWidth;
        
        // If playhead is out of view or close to edges, scroll
        const currentScroll = timelineScrollRef.current.scrollLeft;
        
        // Simple centering logic if we are "lost"
        if (playheadPos < currentScroll || playheadPos > currentScroll + containerWidth) {
             timelineScrollRef.current.scrollLeft = playheadPos - containerWidth / 2;
        }
    }
  }, [zoom, currentTime, duration]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh] transition-colors">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-500" /> Adjust Scene
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          
          {/* Main Player & Timeline Column */}
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto min-h-0 bg-white dark:bg-gray-900 custom-scrollbar">
             
             {/* Player - Always Dark for viewing */}
             <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl shrink-0">
                <video 
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  crossOrigin={needsCrossOrigin ? "anonymous" : undefined}
                  onClick={togglePlay}
                />
                
                {/* Play/Pause Center Overlay */}
                <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/30 transition-colors cursor-pointer"
                    onClick={togglePlay}
                >
                    {!isPlaying && (
                        <div className="p-4 bg-black/50 backdrop-blur-sm rounded-full animate-in zoom-in duration-200">
                             <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                    )}
                </div>
                
                {/* Time Display Overlay */}
                <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur px-3 py-1 rounded-md text-xs font-mono text-white border border-white/10 pointer-events-none">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>
             </div>

             {/* Zoomable Timeline Section */}
             <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4 shrink-0 flex flex-col gap-2 transition-colors">
                <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        Timeline 
                        <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 font-mono">
                            {zoom.toFixed(1)}x
                        </span>
                    </span>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                         <button 
                            onClick={() => setZoom(z => Math.max(1, z - 1))} 
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            title="Zoom Out"
                         >
                            <ZoomOut className="w-3.5 h-3.5" />
                         </button>
                         <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(zoom / 10) * 100}%` }} />
                         </div>
                         <button 
                            onClick={() => setZoom(z => Math.min(10, z + 1))} 
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            title="Zoom In"
                         >
                            <ZoomIn className="w-3.5 h-3.5" />
                         </button>
                    </div>
                </div>

                {/* Timeline Container - Keep Dark theme for timeline track contrast */}
                <div 
                    ref={timelineScrollRef}
                    className="relative w-full h-14 bg-gray-200 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700 overflow-x-auto overflow-y-hidden custom-scrollbar select-none"
                >
                    <div 
                        className="relative h-full transition-[width] duration-300 ease-out"
                        style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
                    >
                         {/* Input Layer - Full Size */}
                        <input 
                          type="range" 
                          min={0} 
                          max={duration || 100} 
                          step={0.01}
                          value={currentTime} 
                          onChange={(e) => seek(parseFloat(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-crosshair z-20"
                        />

                        {/* Visual Layer */}
                        <div className="absolute top-0 bottom-0 left-4 right-4 flex items-center pointer-events-none">
                            {/* Track Base */}
                            <div className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                {/* Selected Range */}
                                <div 
                                    className="absolute top-0 bottom-0 bg-blue-500/30 border-l border-r border-blue-500/50"
                                    style={{
                                        left: `${getPercent(newStartTime)}%`,
                                        width: `${Math.max(0, getPercent(newEndTime) - getPercent(newStartTime))}%`
                                    }}
                                />
                            </div>

                            {/* Start Marker */}
                            <div 
                                className="absolute h-8 w-0.5 bg-blue-500 z-10 flex flex-col items-center justify-end pb-4"
                                style={{ left: `${getPercent(newStartTime)}%` }}
                            >
                                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                            </div>

                            {/* End Marker */}
                            <div 
                                className="absolute h-8 w-0.5 bg-purple-500 z-10 flex flex-col items-center justify-end pb-4"
                                style={{ left: `${getPercent(newEndTime)}%` }}
                            >
                                <div className="w-3 h-3 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                            </div>

                            {/* Playhead */}
                            <div 
                                className="absolute h-full w-0.5 bg-gray-900 dark:bg-white z-30 flex flex-col items-center"
                                style={{ left: `${getPercent(currentTime)}%` }}
                            >
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900 dark:border-t-white" />
                                <div className="absolute bottom-0 text-[9px] font-mono bg-gray-900 text-white dark:bg-white dark:text-black px-1 rounded-sm transform translate-y-full mt-1">
                                    {formatTime(currentTime)}
                                </div>
                            </div>
                        </div>
                        
                        {/* Time Ticks */}
                        <div className="absolute bottom-1 left-4 right-4 h-1 flex justify-between pointer-events-none opacity-50">
                            {[...Array(Math.floor(zoom * 10))].map((_, i) => (
                                <div key={i} className="w-px h-full bg-gray-400 dark:bg-gray-600" />
                            ))}
                        </div>
                    </div>
                </div>
             </div>

             {/* Frame Controls */}
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 flex flex-col items-center gap-2 transition-colors">
                  <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">Start Frame</span>
                  <div className="flex items-center gap-2 w-full justify-center">
                    <button onClick={() => adjustBound(true, -0.1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300" title="-0.1s"><ChevronLeft className="w-3 h-3" /></button>
                    <button 
                      onClick={() => captureFrame(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-lg active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" /> Capture
                    </button>
                    <button onClick={() => adjustBound(true, 0.1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300" title="+0.1s"><ChevronRight className="w-3 h-3" /></button>
                  </div>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 flex flex-col items-center gap-2 transition-colors">
                  <span className="text-xs font-semibold text-purple-500 dark:text-purple-400 uppercase tracking-wider">End Frame</span>
                  <div className="flex items-center gap-2 w-full justify-center">
                    <button onClick={() => adjustBound(false, -0.1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300" title="-0.1s"><ChevronLeft className="w-3 h-3" /></button>
                    <button 
                      onClick={() => captureFrame(false)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-lg active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" /> Capture
                    </button>
                    <button onClick={() => adjustBound(false, 0.1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300" title="+0.1s"><ChevronRight className="w-3 h-3" /></button>
                  </div>
                </div>
             </div>
          </div>

          {/* Sidebar - Preview & Save */}
          <div className="w-full lg:w-80 bg-gray-50 dark:bg-gray-800/30 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto transition-colors">
            <div className="space-y-4">
              <div className="space-y-2 group">
                <div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <span className="group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">Start ({formatTime(newStartTime)})</span>
                </div>
                <div 
                  className="aspect-video bg-black rounded-lg border-2 border-blue-500/50 overflow-hidden cursor-pointer hover:border-blue-400 transition-all shadow-lg relative group-hover:ring-2 ring-blue-500/20"
                  onClick={() => seek(newStartTime)}
                  title="Jump to Start"
                >
                  <img src={newStartFrame} className="w-full h-full object-cover" alt="Start Preview" />
                  <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-8 h-8 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all" />
                  </div>
                </div>
                <button 
                  onClick={() => captureFrame(true)}
                  className="w-full py-1.5 mt-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 border border-blue-200/50 dark:border-blue-800/50"
                  title="Capture current video frame as Start"
                >
                  <Camera className="w-3.5 h-3.5" /> Set Current as Start
                </button>
              </div>

              <div className="flex items-center gap-4 opacity-50">
                  <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1"></div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-500 font-mono">DURATION: {((newEndTime - newStartTime) || 0).toFixed(1)}s</span>
                  <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1"></div>
              </div>

              <div className="space-y-2 group">
                <div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <span className="group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">End ({formatTime(newEndTime)})</span>
                </div>
                <div 
                  className="aspect-video bg-black rounded-lg border-2 border-purple-500/50 overflow-hidden cursor-pointer hover:border-purple-400 transition-all shadow-lg relative group-hover:ring-2 ring-purple-500/20"
                  onClick={() => seek(newEndTime)}
                  title="Jump to End"
                >
                  <img src={newEndFrame} className="w-full h-full object-cover" alt="End Preview" />
                  <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-8 h-8 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all" />
                  </div>
                </div>
                <button 
                  onClick={() => captureFrame(false)}
                  className="w-full py-1.5 mt-1 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 border border-purple-200/50 dark:border-purple-800/50"
                  title="Capture current video frame as End"
                >
                  <Camera className="w-3.5 h-3.5" /> Set Current as End
                </button>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-800 space-y-3">
               <button 
                 onClick={handleSave}
                 className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
               >
                 <Save className="w-5 h-5" /> Update Scene
               </button>
               <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                 Applying changes will reset the generated prompt for this scene.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneAdjuster;