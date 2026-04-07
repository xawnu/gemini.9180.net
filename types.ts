export interface Scene {
  id: string;
  startTime: number;
  endTime: number;
  startFrameUrl: string; // Base64 data URL
  endFrameUrl: string;   // Base64 data URL
  generatedPrompt?: string; // Unified prompt for the whole scene
  isProcessing: boolean;
}

export interface ProcessingStatus {
  stage: 'idle' | 'analyzing_scenes' | 'generating_prompts' | 'complete';
  progress: number; // 0 to 100
  currentTask?: string;
}

export type SceneDetectionMethod = 'fast' | 'accurate'; // Fast = regular intervals, Accurate = pixel diff

export type VideoSource = File | string;