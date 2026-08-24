import type { StateStorage } from 'zustand/middleware'

// Persistence is abstracted behind zustand's StateStorage contract so the app
// state can later be backed by a remote store without touching the stores or
// UI. Swap `createDriver()` to return a remote driver when one exists.

export const localDriver: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}

export function createDriver(): StateStorage {
  return localDriver
}
