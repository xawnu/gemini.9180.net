import React, { useRef, useState } from 'react';
import { Upload, FileVideo, Info } from 'lucide-react';
import { VideoSource } from '../types';

interface VideoUploaderProps {
  onVideoSelect: (source: VideoSource) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        onVideoSelect(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onVideoSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      
      {/* File Drop Zone */}
      <div 
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer
          ${dragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
          }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept="video/*" 
          className="hidden" 
          onChange={handleChange}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 shadow-inner group transition-colors">
            <FileVideo className="w-8 h-8 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="text-xl font-medium text-gray-900 dark:text-white mb-1">
              Upload Video File
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Drag & drop or click to browse (MP4, WEBM, MOV)
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
         <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5">
             <Info className="w-3.5 h-3.5" />
             Files are processed locally in your browser.
          </p>
      </div>
    </div>
  );
};

export default VideoUploader;