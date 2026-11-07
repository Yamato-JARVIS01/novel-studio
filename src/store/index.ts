import { create } from 'zustand';

export interface AppState {
  currentFile: string | null;
  setCurrentFile: (file: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentFile: null,
  setCurrentFile: (file) => set({ currentFile: file }),
}));
