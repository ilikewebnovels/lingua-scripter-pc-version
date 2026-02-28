export interface GlossaryEntry {
  original: string;
  translation: string;
}

export interface Settings {
  provider: 'gemini' | 'deepseek' | 'openrouter' | 'openai';
  apiKey: string; // Gemini API Key
  deepseekApiKey: string;
  openRouterApiKey: string;
  openaiApiKey: string;
  openaiEndpoint: string;
  openRouterModelProviders: string; // Comma-separated list
  model: string;
  theme: 'light' | 'dark' | 'blue';
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  temperature: number;
  sourceLanguage: string;
  targetLanguage: string;
  systemInstruction: string;
  isStreamingEnabled: boolean;
  isTranslationMemoryEnabled: boolean;
  isAutoCharacterDetectionEnabled: boolean;
  reasoningEffort: 'auto' | 'minimum' | 'low' | 'medium' | 'high' | 'maximum';
  // Batch translation settings
  batchSkipTranslated: boolean;
  batchSize: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  profilePic?: string;
  lastChapterId?: string;
  lastChapterTitle?: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string;
  originalText: string;
  translatedText: string;
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  name: string;
  translatedName: string;
  gender: string;
  pronouns: string;
}

export interface CharacterDBHook {
  characterDBs: Record<string, Character[]>;
  addCharacter: (projectId: string, character: Omit<Character, 'id'>) => void;
  addCharacters: (projectId: string, characters: Omit<Character, 'id'>[]) => void;
  removeCharacter: (projectId: string, id: string) => void;
  updateCharacter: (projectId: string, id: string, updatedCharacter: Character) => void;
  deleteCharacterDB: (projectId: string) => void;
  updateCharacterEntryWithGenderInfo: (projectId: string, characterName: string, newGender: string, newPronouns: string) => void;
}

// Settings that can be part of a preset
export type PresetSettings = Pick<Settings, 'model' | 'sourceLanguage' | 'targetLanguage' | 'provider'>;

export interface Preset {
  id: string;
  name: string;
  settings: PresetSettings;
}