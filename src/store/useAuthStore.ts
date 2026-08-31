import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, isApiConfigured, setToken, clearToken } from '@/services/apiClient'

// Two modes, picked by whether VITE_API_URL is set:
//
//   configured  → real login against the standalone Postgres API (server/).
//                 Accounts are created on the server with
//                 scripts/create-user.js — there is no public sign-up.
//   unset       → the original local demo credential, so `npm run dev` and
//                 the test suite still work with no backend running.
//
// The demo branch is guarded by `import.meta.env.DEV`, which Vite statically
// replaces with `false` in a production build — the branch and the
// credential constants below are then dead code and get dropped from the
// bundle. A deployed build with no API configured cannot be signed into.
const DEMO_EMAIL = 'abhishek@sav.money'
const DEMO_PASSWORD = 'Sav@12345'

export interface AuthUser {
  email: string
  name: string
}

interface AuthState {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<boolean>
  loginError: string | null
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loginError: null,

      login: async (email, password) => {
        set({ loginError: null })

        if (isApiConfigured()) {
          try {
            const { token, user } = await api.login(email, password)
            setToken(token)
            set({ user })
            return true
          } catch (e: unknown) {
            set({ loginError: e instanceof Error ? e.message : 'Invalid email or password.' })
            return false
          }
        }

        if (
          import.meta.env.DEV &&
          email.trim().toLowerCase() === DEMO_EMAIL &&
          password === DEMO_PASSWORD
        ) {
          set({ user: { email: DEMO_EMAIL, name: 'Abhishek' } })
          return true
        }
        set({ loginError: 'Invalid email or password.' })
        return false
      },

      logout: () => {
        clearToken()
        set({ user: null })
      },
    }),
    { name: 'qa-dashboard-auth', partialize: (s) => ({ user: s.user }) },
  ),
)
