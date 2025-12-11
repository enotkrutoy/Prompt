export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  image?: string; // Base64 data string
  timestamp: number;
}

export interface IterationStatus {
  score: number;
  currentStep: string;
  isComplete: boolean;
}

// Global declaration for Telegram WebApp
declare global {
  interface Window {
    Telegram: {
      WebApp: any; // Using 'any' or specific types from @types/telegram-web-app
    };
  }
}