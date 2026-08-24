import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        apply(theme)
        set({ theme })
      },
    }),
    {
      name: 'qa-dashboard-theme',
      onRehydrateStorage: () => (state) => {
        apply(state?.theme ?? 'system')
      },
    },
  ),
)

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  apply(useThemeStore.getState().theme)
})

apply(useThemeStore.getState().theme)
