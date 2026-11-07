import { invoke } from '@tauri-apps/api/core';

export async function pingBackend(): Promise<string> {
  try {
    return await invoke<string>('ping');
  } catch (err) {
    return `Error: ${err}`;
  }
}
