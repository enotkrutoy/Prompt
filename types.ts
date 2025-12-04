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