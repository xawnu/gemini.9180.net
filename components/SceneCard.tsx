import React from 'react';
import { Scene } from '../types';
import { formatTime } from '../utils/videoUtils';
import { RefreshCw, Copy, Check, Settings2, Trash2 } from 'lucide-react';

interface SceneCardProps {
  scene: Scene;
  onEdit: (scene: Scene) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
  onUpdate: (scene: Scene) => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, onEdit, onDelete, onRegenerate, onUpdate }) => {
  const [copied, setCopied] = React.useState<boolean>(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg flex flex-col h-full group/card transition-all hover:border-gray-300 dark:hover:border-gray-600">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center transition-colors">
        <span className="text-xs font-mono text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-transparent">
          {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
        </span>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onEdit(scene)}
            className="text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition-colors p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Adjust Start/End Frames"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDelete(scene.id)}
            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Delete Scene"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Visuals - Start and End frames side by side */}
      <div className="grid grid-cols-2 gap-0.5 bg-gray-200 dark:bg-gray-700 relative">
        <div className="relative group aspect-video">
          <img src={scene.startFrameUrl} alt="Start" className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 backdrop-blur-sm">Start</div>
        </div>
        <div className="relative group aspect-video">
          <img src={scene.endFrameUrl} alt="End" className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 backdrop-blur-sm">End</div>
        </div>
        
        {/* Overlay edit button for quick access */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
           <div className="pointer-events-auto flex gap-2">
             <button 
                onClick={() => onEdit(scene)}
                className="bg-white/90 dark:bg-black/70 hover:bg-blue-600 dark:hover:bg-blue-600 text-gray-900 dark:text-white hover:text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-all transform scale-95 group-hover/card:scale-100 shadow-xl"
             >
                <Settings2 className="w-3 h-3" /> Adjust
             </button>
           </div>
        </div>
      </div>

      {/* Unified Prompt */}
      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="space-y-1.5 flex-1 flex flex-col">
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
            <div className="flex items-center gap-2">
              <span>Video Scene Prompt</span>
              <button 
                onClick={() => onRegenerate(scene.id)}
                disabled={scene.isProcessing}
                className={`p-1 rounded transition-colors ${scene.isProcessing ? 'text-blue-500 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-500 dark:hover:text-blue-400 text-gray-400 dark:text-gray-500'}`}
                title="Regenerate Prompt"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scene.isProcessing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {scene.generatedPrompt && (
              <button 
                onClick={() => copyToClipboard(scene.generatedPrompt!)}
                className="hover:text-gray-900 dark:hover:text-white text-gray-400 dark:text-gray-500 transition-colors flex items-center gap-1"
                title="Copy Prompt"
              >
                {copied ? (
                  <>
                    <span className="text-[10px] text-green-600 dark:text-green-400">Copied</span>
                    <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700/50 flex-1 min-h-[100px] relative group/input transition-colors">
            {scene.isProcessing ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-blue-500 dark:text-blue-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </div>
            ) : scene.generatedPrompt !== undefined ? (
              <textarea
                className="w-full h-full bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-700 dark:text-gray-300 leading-relaxed resize-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                value={scene.generatedPrompt}
                onChange={(e) => onUpdate({ ...scene, generatedPrompt: e.target.value })}
                placeholder="Generated prompt will appear here..."
                spellCheck={false}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2">
                <span className="text-xs italic">Waiting to generate...</span>
              </div>
            )}
            
            {/* Visual indicator that it's editable */}
            {!scene.isProcessing && scene.generatedPrompt !== undefined && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover/input:opacity-100 transition-opacity pointer-events-none">
                     <span className="text-[10px] text-gray-500 bg-gray-200/80 dark:bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700">Editable</span>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneCard;