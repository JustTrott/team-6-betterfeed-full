import { create } from 'zustand'
import { createStorage } from '../lib/storage'
import { Profile } from '../lib/db/schema'
import { LoginResponse } from '../lib/auth/types'

interface AuthState {
  user: Profile | null
  accessToken: string | null
  loading: boolean
  initialized: boolean
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (payload: { email: string; password: string; username: string }) => Promise<void>
  logout: () => void
  resetPassword: (email: string) => Promise<void>
}

const storage = createStorage('betterfeed-auth')

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  loading: false,
  initialized: false,

  hydrate: async () => {
    if (get().initialized) return
    set({ loading: true })
    
    try {
      const record = storage.read() as { accessToken: string; userId: string } | null
      if (record?.accessToken && record?.userId) {
        // Verify token is still valid by fetching user profile from backend
        const response = await fetch('/api/auth/profile', {
          headers: {
            Authorization: `Bearer ${record.accessToken}`,
          },
        })

        if (response.ok) {
          const profile: Profile = await response.json()
          set({ 
            user: profile, 
            accessToken: record.accessToken,
            initialized: true,
            loading: false 
          })
          return
        }
      }
    } catch (error) {
      console.error('Error hydrating auth:', error)
      // Clear invalid session
      storage.write(null)
    }
    
    set({ initialized: true, loading: false })
  },

  login: async (email: string, password: string) => {
    set({ loading: true })
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sign in')
      }

      const data: LoginResponse = await response.json()
      
      // Store session
      storage.write({ 
        accessToken: data.access_token,
        userId: data.user.id,
      })

      set({ 
        user: data.profile, 
        accessToken: data.access_token,
        loading: false 
      })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  signup: async ({ email, password, username }: { email: string; password: string; username: string }) => {
    set({ loading: true })
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, username }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create account')
      }

      const data = await response.json()
      
      // Store session if we have auth data
      if (data.auth && data.profile) {
        // For signup, we need to sign in to get a session
        // The backend creates the user but doesn't return a session
        // So we'll need to sign in after signup
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        if (!loginResponse.ok) {
          throw new Error('Account created but failed to sign in')
        }

        const loginData: LoginResponse = await loginResponse.json()

        storage.write({ 
          accessToken: loginData.access_token,
          userId: data.auth.id,
        })

        set({ 
          user: data.profile as Profile, 
          accessToken: loginData.access_token,
          loading: false 
        })
      } else {
        set({ loading: false })
        throw new Error('Failed to create account')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  logout: () => {
    storage.write(null)
    set({ user: null, accessToken: null })
  },

  resetPassword: async () => {
    set({ loading: true })
    // TODO: Implement password reset API endpoint
    await new Promise((resolve) => setTimeout(resolve, 500))
    set({ loading: false })
  },
}))

