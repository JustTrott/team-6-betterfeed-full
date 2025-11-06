import { create } from 'zustand'
import { db } from '../lib/db'
import { createStorage } from '../lib/storage'

interface Profile {
  id: string
  email: string
  username: string
  avatar_url?: string
  created_at?: string
}

interface AuthState {
  user: Profile | null
  loading: boolean
  initialized: boolean
  hydrate: () => Promise<void>
  login: (email: string) => Promise<void>
  signup: (payload: { email: string; username: string }) => Promise<void>
  logout: () => void
  resetPassword: (email: string) => Promise<void>
}

const storage = createStorage('betterfeed-auth')

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  hydrate: async () => {
    if (get().initialized) return
    set({ loading: true })
    const record = storage.read() as { userId: string } | null
    if (record?.userId) {
      const profile = await db.getProfile(record.userId)
      set({ user: profile ?? null })
    }
    set({ initialized: true, loading: false })
  },

  login: async (email: string) => {
    set({ loading: true })
    const profile = await db.findProfileByEmail(email)
    if (!profile) {
      set({ loading: false })
      throw new Error('No account found for that email')
    }
    storage.write({ userId: profile.id })
    set({ user: profile, loading: false })
  },

  signup: async ({ email, username }: { email: string; username: string }) => {
    set({ loading: true })
    const profile = await db.createProfile({
      email,
      username,
      avatar_url: '/avatars/default.svg',
    })
    storage.write({ userId: profile.id })
    set({ user: profile, loading: false })
  },

  logout: () => {
    storage.write(null)
    set({ user: null })
  },

  resetPassword: async (email: string) => {
    set({ loading: true })
    await db.findProfileByEmail(email)
    await new Promise((resolve) => setTimeout(resolve, 500))
    set({ loading: false })
  },
}))

