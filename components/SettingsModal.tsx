import React, { useState, useEffect } from 'react';
import { X, Key, Check, AlertTriangle, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customApiKey: string;
  onSaveApiKey: (key: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, customApiKey, onSaveApiKey }) => {
  const [inputValue, setInputValue] = useState(customApiKey);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setInputValue(customApiKey);
  }, [customApiKey, isOpen]);

  const handleSave = () => {
    onSaveApiKey(inputValue.trim());
    setShowSuccess(true);
    setTimeout(() => {
        setShowSuccess(false);
        onClose();
    }, 1000);
  };

  const handleClear = () => {
      setInputValue("");
      onSaveApiKey("");
      onClose();
  };
  

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden transition-colors">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-500" /> API Key Settings
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
            
            {/* Custom Key Section */}
            <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                    Personal Override Key <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                    <input 
                        type="password" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Paste your Kie.ai API key"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-600 font-mono text-sm transition-colors"
                    />
                </div>
                <p className="text-xs text-gray-500">
                    If left blank, the application will use the default shared Team API Key from the server.
                    <a href="https://kie.ai/market" target="_blank" rel="noreferrer" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 ml-1 inline-flex items-center gap-0.5">
                        Get your own <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                 <button 
                    onClick={handleClear}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    disabled={!inputValue}
                >
                    Clear
                </button>
                <button 
                    onClick={handleSave}
                    className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                    {showSuccess ? <Check className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                    {showSuccess ? "Saved" : "Save Key"}
                </button>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-lg flex gap-3 items-start">
               <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
               <p className="text-xs text-amber-800 dark:text-amber-200/70">
                 Your key is stored locally in your browser. API calls are made directly from your browser to Kie.ai's servers.
               </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;