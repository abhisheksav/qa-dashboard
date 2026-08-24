import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Demo credential check for QA access. This is client-side gating only — for
// real security, swap this store for Supabase Auth (supabase.auth.signInWithPassword)
// behind the same login/logout interface.
const VALID_EMAIL = 'abhishek@sav.money'
const VALID_PASSWORD = 'Sav@12345'

export interface AuthUser {
  email: string
  name: string
}

interface AuthState {
  user: AuthUser | null
  login: (email: string, password: string) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (email, password) => {
        const ok = email.trim().toLowerCase() === VALID_EMAIL && password === VALID_PASSWORD
        if (ok) {
          set({ user: { email: VALID_EMAIL, name: 'Abhishek' } })
        }
        return ok
      },
      logout: () => set({ user: null }),
    }),
    { name: 'qa-dashboard-auth' },
  ),
)
