import React, { useState, useRef, useEffect } from 'react';
import VideoUploader from './components/VideoUploader';
import SceneCard from './components/SceneCard';
import SceneAdjuster from './components/SceneAdjuster';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import { detectScenes } from './utils/videoUtils';
import { generateScenePrompt } from './services/geminiService';
import { Scene, ProcessingStatus, VideoSource } from './types';
import { Clapperboard, Sparkles, AlertTriangle, Play, Wand2, Download, ChevronDown, Square, Loader2, Save, Plus, Info, Key, Trash2, Undo, Redo, Sun, Moon, LogOut } from 'lucide-react';

const DEFAULT_TEMPLATE = "A cinematic shot of [subject], [action], lighting is [lighting], mood is [mood], style of [style]";

// Simplified initial templates - effectively treated as user content now
const INITIAL_TEMPLATES = [
  {
    name: "Cinematic (Default)",
    value: "A cinematic shot of [subject], [action], lighting is [lighting], mood is [mood], style of [style]"
  },
  {
    name: "Midjourney Style",
    value: "/imagine prompt: [subject] performing [action], highly detailed, 8k resolution, cinematic lighting, style of [style] --ar 16:9"
  }
];

function App() {
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ stage: 'idle', progress: 0 });
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('app_auth_token') === 'valid';
  });

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('gemini_custom_api_key') || "";
  });

  // Template State with Persistence
  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem('custom_templates');
    return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
  });

  const [template, setTemplate] = useState(() => {
    return localStorage.getItem('current_template') || DEFAULT_TEMPLATE;
  });

  // History State for Undo/Redo
  const [historyPast, setHistoryPast] = useState<string[]>([]);
  const [historyFuture, setHistoryFuture] = useState<string[]>([]);
  const lastCommittedRef = useRef(template);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");

  // Scene Editing State
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  // Ref to hold the current abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Theme Effect
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogin = async (password: string) => {
    try {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3026' : '';
      const response = await fetch(`${baseUrl}/api/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('app_auth_token', 'valid');
        setIsAuthenticated(true);
        return true;
      }
    } catch(e) {
      console.error("Login Error:", e);
    }
    return false;
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.removeItem('app_auth_token');
      setIsAuthenticated(false);
      // Reset app state
      setScenes([]);
      setVideoSource(null);
      setStatus({ stage: 'idle', progress: 0 });
    }
  };

  // Save template text automatically on change
  useEffect(() => {
    localStorage.setItem('current_template', template);
  }, [template]);

  // Save templates list automatically on change
  useEffect(() => {
    localStorage.setItem('custom_templates', JSON.stringify(templates));
  }, [templates]);

  // Save API Key automatically
  useEffect(() => {
    if (customApiKey) {
      localStorage.setItem('gemini_custom_api_key', customApiKey);
    } else {
      localStorage.removeItem('gemini_custom_api_key');
    }
  }, [customApiKey]);

  const handleVideoSelect = (source: VideoSource) => {
    setVideoSource(source);
    setScenes([]);
    setStatus({ stage: 'idle', progress: 0 });
    setErrorCode(null);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    // Push current state to history before switching
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Always snapshot the state we are leaving
    setHistoryPast(prev => [...prev, template]);
    setHistoryFuture([]);

    setTemplate(val);
    lastCommittedRef.current = val;

    const found = templates.find((t: any) => t.value === val);
    setSelectedTemplateName(found ? found.name : "");
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setTemplate(newVal);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Only commit if different from what we last committed
      if (newVal !== lastCommittedRef.current) {
        setHistoryPast(prev => [...prev, lastCommittedRef.current]);
        setHistoryFuture([]);
        lastCommittedRef.current = newVal;
      }
    }, 750); // 750ms debounce
  };

  const handleUndo = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Soft Undo: If we have unsaved changes (user was typing but debounce didn't fire), 
    // revert to the last committed state first.
    if (template !== lastCommittedRef.current) {
      setHistoryFuture(prev => [template, ...prev]);
      setTemplate(lastCommittedRef.current);
      // We do NOT pop from past here, we just revert the uncommitted changes
      return;
    }

    if (historyPast.length === 0) return;

    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);

    setHistoryFuture(prev => [template, ...prev]);
    setHistoryPast(newPast);
    setTemplate(previous);
    lastCommittedRef.current = previous;
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);

    setHistoryPast(prev => [...prev, template]);
    setTemplate(next);
    setHistoryFuture(newFuture);
    lastCommittedRef.current = next;
  };

  const saveCurrentTemplate = () => {
    const defaultName = selectedTemplateName || "";
    const name = prompt("Enter template name to save (keep same name to overwrite):", defaultName);

    if (!name) return; // User cancelled

    const existingIndex = templates.findIndex((t: any) => t.name === name);

    if (existingIndex >= 0) {
      // Overwrite existing
      const newTemplates = [...templates];
      newTemplates[existingIndex] = { name, value: template };
      setTemplates(newTemplates);
      setSelectedTemplateName(name);
    } else {
      // Create new
      const newTemplate = { name, value: template };
      setTemplates([...templates, newTemplate]);
      setSelectedTemplateName(name);
    }
  };

  const deleteCurrentTemplate = () => {
    if (!selectedTemplateName) return;

    if (confirm(`Are you sure you want to delete the template "${selectedTemplateName}"?`)) {
      const newTemplates = templates.filter((t: any) => t.name !== selectedTemplateName);
      setTemplates(newTemplates);
      setSelectedTemplateName("");
      setTemplate(DEFAULT_TEMPLATE);
      // Reset history on major change to avoid confusion
      setHistoryPast([]);
      setHistoryFuture([]);
      lastCommittedRef.current = DEFAULT_TEMPLATE;
    }
  };

  const handleSceneUpdate = (updatedScene: Scene) => {
    setScenes(prev => prev.map(s => s.id === updatedScene.id ? updatedScene : s));
  };

  const handleSceneDelete = (id: string) => {
    setScenes(prev => prev.filter(s => s.id !== id));
  };

  const handleRegeneratePrompt = async (id: string) => {
    const sceneIndex = scenes.findIndex(s => s.id === id);
    if (sceneIndex === -1) return;

    // Set processing state for specific scene
    setScenes(prev => prev.map(s => s.id === id ? { ...s, isProcessing: true } : s));

    try {
      const scene = scenes[sceneIndex];
      const prompt = await generateScenePrompt(
        scene.startFrameUrl,
        scene.endFrameUrl,
        template,
        customApiKey
      );

      setScenes(prev => prev.map(s => s.id === id ? {
        ...s,
        isProcessing: false,
        generatedPrompt: prompt
      } : s));
    } catch (e: any) {
      console.error("Error regenerating prompt", e);
      setScenes(prev => prev.map(s => s.id === id ? { ...s, isProcessing: false } : s));
    }
  };

  const stopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus(prev => ({ ...prev, stage: 'idle' }));
    }
  };

  const startSceneDetection = async () => {
    if (!videoSource) return;
    setErrorCode(null);
    setStatus({ stage: 'analyzing_scenes', progress: 0 });

    // Create new controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const detectedScenes = await detectScenes(
        videoSource,
        0.2,
        (prog) => {
          // Only update if not aborted
          if (!controller.signal.aborted) {
            setStatus(prev => ({ ...prev, progress: prog }));
          }
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        setScenes(detectedScenes);
        setStatus({ stage: 'idle', progress: 100 });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Scene detection aborted by user");
        setStatus({ stage: 'idle', progress: 0 });
      } else {
        // Filter known operational errors from console noise
        const errorMessage = typeof err === 'string' ? err : (err.message || "GENERIC_ERROR");
        const knownErrors = ["IS_YOUTUBE_URL", "LOAD_ERROR", "CORS_BLOCK", "SRC_NOT_SUPPORTED", "DECODE_ERROR"];

        if (!knownErrors.includes(errorMessage)) {
          console.error("Scene detection error:", err);
        }

        setErrorCode(errorMessage);
        setStatus({ stage: 'idle', progress: 0 });
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const generatePrompts = async () => {
    if (scenes.length === 0) return;

    setStatus({ stage: 'generating_prompts', progress: 0 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for (let i = 0; i < scenes.length; i++) {
        if (controller.signal.aborted) break;

        const scene = scenes[i];

        setScenes(current => current.map((s, idx) => idx === i ? { ...s, isProcessing: true } : s));

        try {
          const prompt = await generateScenePrompt(
            scene.startFrameUrl,
            scene.endFrameUrl,
            template,
            customApiKey
          );

          if (controller.signal.aborted) {
            setScenes(current => current.map((s, idx) => idx === i ? { ...s, isProcessing: false } : s));
            break;
          }

          setScenes(current => current.map((s, idx) => idx === i ? {
            ...s,
            isProcessing: false,
            generatedPrompt: prompt
          } : s));

        } catch (e: any) {
          console.error("Error generating prompt for scene " + i, e);
          setScenes(current => current.map((s, idx) => idx === i ? { ...s, isProcessing: false } : s));
        }

        setStatus(prev => ({ ...prev, progress: Math.round(((i + 1) / scenes.length) * 100) }));
      }

      if (!controller.signal.aborted) {
        setStatus({ stage: 'complete', progress: 100 });
      } else {
        setStatus(prev => ({ ...prev, stage: 'idle' }));
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const reset = () => {
    stopProcessing();
    setVideoSource(null);
    setScenes([]);
    setStatus({ stage: 'idle', progress: 0 });
  };

  const isUrlSource = typeof videoSource === 'string';
  const sourceName = videoSource instanceof File ? videoSource.name : videoSource;
  const isProcessing = status.stage === 'analyzing_scenes' || status.stage === 'generating_prompts';

  // Is custom template check not really needed now that everything is editable, but kept for logic if needed
  const isTemplateSelected = !!selectedTemplateName;

  // Helper to render friendly error messages
  const renderError = () => {
    if (!errorCode) return null;

    let title = "Unable to Process Video";
    let description = "An unexpected error occurred while loading the video.";
    let showYoutubeHelp = false;
    let isWarning = false;

    if (errorCode === "IS_YOUTUBE_URL") {
      title = "YouTube Links Not Supported";
      description = "Browsers block web apps from directly accessing YouTube video data.";
      showYoutubeHelp = true;
      isWarning = true;
    } else if (errorCode === "CORS_BLOCK") {
      title = "Access Blocked";
      description = "The server hosting this video file blocks 'Cross-Origin' access, so we cannot capture frames.";
      showYoutubeHelp = true;
    } else if (errorCode === "LOAD_ERROR" || errorCode === "SRC_NOT_SUPPORTED" || errorCode === "DECODE_ERROR") {
      title = "Cannot Load Video File";
      description = "The video format or codec might not be supported by your browser (e.g. MKV, HEVC).";
      showYoutubeHelp = true;
    }

    return (
      <div className={`mb-6 p-4 border rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2
        ${isWarning
          ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-500/50 dark:text-amber-100'
          : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-100'}
      `}>
        <div className={`p-2 rounded-lg shrink-0 ${isWarning ? 'bg-amber-200 dark:bg-amber-900/50' : 'bg-red-200 dark:bg-red-900/50'}`}>
          {isWarning ? <Info className="w-6 h-6 text-amber-600 dark:text-amber-400" /> : <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className={`font-semibold text-lg ${isWarning ? 'text-amber-800 dark:text-amber-200' : 'text-red-800 dark:text-red-200'}`}>{title}</h3>
            <p className={`${isWarning ? 'text-amber-700 dark:text-amber-200/80' : 'text-red-700 dark:text-red-200/80'} leading-relaxed mt-1`}>{description}</p>
          </div>

          {showYoutubeHelp && (
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-white/10">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-blue-500 dark:text-blue-400" /> How to fix this
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <li>
                  <span className="font-medium">Download the video</span> to your computer first.
                  <span className="text-gray-500 text-xs ml-2">(Save as .MP4)</span>
                </li>
                <li>
                  Click <strong>Start Over</strong> and upload the file directly.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------------------------
  // RENDER: Login Screen if not authenticated
  // ----------------------------------------------------------------------
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ----------------------------------------------------------------------
  // RENDER: Main App
  // ----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 font-sans selection:bg-blue-500/30 transition-colors duration-200">

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        customApiKey={customApiKey}
        onSaveApiKey={setCustomApiKey}
      />

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-80 dark:bg-opacity-80 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg shadow-md">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
              Gemini Scene Analyst
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* API Key Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white dark:hover:border-gray-600`}
              title="Configure API Key"
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {videoSource && (
              <button
                onClick={reset}
                className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors border-l border-gray-300 dark:border-gray-700 pl-3 ml-1"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">


        {/* Error Display */}
        {renderError()}

        {/* Phase 1: Upload */}
        {!videoSource && (
          <div className="py-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Transform Video to Prompts</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto text-lg">
                Extract scenes, capture keyframes, and generate AI art prompts using Gemini Vision.
              </p>
            </div>
            <VideoUploader onVideoSelect={handleVideoSelect} />
          </div>
        )}

        {/* Phase 2: Processing & Results */}
        {videoSource && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">

            {/* Control Panel */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xl sticky top-20 z-40 transition-colors duration-200">
              <div className="mb-4 text-xs text-gray-500 dark:text-gray-500 font-mono truncate flex items-center gap-2">
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">Source</span>
                <span className="truncate">{sourceName}</span>
              </div>
              <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">

                <div className="flex-1 w-full">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prompt Template</h3>

                    {/* Controls Row */}
                    <div className="flex items-center gap-3">

                      {/* History Controls */}
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                        <button
                          onClick={handleUndo}
                          disabled={historyPast.length === 0 && template === lastCommittedRef.current}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Undo"
                        >
                          <Undo className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleRedo}
                          disabled={historyFuture.length === 0}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Redo"
                        >
                          <Redo className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>

                      {/* Template Dropdown */}
                      <div className="relative">
                        <select
                          onChange={handleTemplateChange}
                          disabled={isProcessing}
                          className="appearance-none bg-gray-100 dark:bg-gray-800 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500/50 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[150px] md:max-w-xs truncate"
                          value={templates.find((t: any) => t.value === template)?.value || ""}
                        >
                          <option value="" disabled>Load Preset...</option>
                          {templates.map((t: any) => (
                            <option key={t.name} value={t.value}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                      </div>

                      {/* Save Template Button */}
                      <button
                        onClick={saveCurrentTemplate}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                        title={selectedTemplateName ? `Update "${selectedTemplateName}"` : "Save as new preset"}
                      >
                        <Save className="w-4 h-4" />
                      </button>

                      {/* Delete Template Button - Always available now */}
                      {isTemplateSelected && (
                        <button
                          onClick={deleteCurrentTemplate}
                          disabled={isProcessing}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
                          title="Delete current preset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative group">
                    <textarea
                      value={template}
                      onChange={handleTextAreaChange}
                      disabled={isProcessing}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px] resize-y disabled:opacity-50 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="Enter a template for Gemini to follow..."
                    />
                    <Sparkles className="absolute right-3 bottom-3 w-4 h-4 text-yellow-500/50 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px] w-full md:w-auto">
                  {scenes.length === 0 ? (
                    // Detection State
                    isProcessing ? (
                      <button
                        onClick={stopProcessing}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg bg-red-600 hover:bg-red-500 transition-all hover:scale-105 active:scale-95"
                      >
                        <Square className="w-4 h-4 fill-current" /> Stop Analysis
                      </button>
                    ) : (
                      <button
                        onClick={startSceneDetection}
                        disabled={!!errorCode}
                        className={`
                            flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all
                            ${!!errorCode
                            ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-700'
                            : 'bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95'
                          }
                          `}
                      >
                        <Play className="w-4 h-4 fill-current" /> Detect Scenes
                      </button>
                    )
                  ) : (
                    // Generation State
                    isProcessing ? (
                      <button
                        onClick={stopProcessing}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg bg-red-600 hover:bg-red-500 transition-all hover:scale-105 active:scale-95"
                      >
                        <Square className="w-4 h-4 fill-current" /> Stop Generating
                      </button>
                    ) : (
                      <button
                        onClick={generatePrompts}
                        disabled={status.stage === 'complete'}
                        className={`
                            flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all
                            ${status.stage === 'complete'
                            ? 'bg-green-600 hover:bg-green-500'
                            : 'bg-purple-600 hover:bg-purple-500 hover:scale-105 active:scale-95'
                          }
                          `}
                      >
                        {status.stage === 'complete' ? (
                          <><Download className="w-4 h-4" /> Done</>
                        ) : (
                          <><Wand2 className="w-4 h-4" /> Generate Prompts</>
                        )}
                      </button>
                    )
                  )}

                  {/* Status Text under button */}
                  {isProcessing && (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400 font-mono animate-pulse">
                      {status.stage === 'analyzing_scenes' ? `Analyzing... ${status.progress}%` : `Generating... ${status.progress}%`}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {isProcessing && (
                <div className="mt-4 h-1 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${status.stage === 'analyzing_scenes' ? 'bg-blue-500' : 'bg-purple-500'}`}
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Scenes Grid */}
            {scenes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Detected Scenes <span className="text-gray-500 text-sm font-normal">({scenes.length})</span></h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {scenes.map((scene) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      onEdit={(s) => setEditingScene(s)}
                      onDelete={handleSceneDelete}
                      onRegenerate={handleRegeneratePrompt}
                      onUpdate={handleSceneUpdate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Adjust Modal */}
        {editingScene && videoSource && (
          <SceneAdjuster
            videoSource={videoSource}
            scene={editingScene}
            onClose={() => setEditingScene(null)}
            onSave={handleSceneUpdate}
          />
        )}
      </main>
    </div>
  );
}

export default App;