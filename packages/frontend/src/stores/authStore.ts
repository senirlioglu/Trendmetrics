import { create } from 'zustand'
import type { UserProfile } from '@/types'
import { signInWithGoogle, signOutUser, onAuthChange, type FirebaseUser } from '@/services/firebase'
import { api } from '@/services/api'

interface AuthState {
  user: UserProfile | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  balance: number
  login: () => Promise<void>
  logout: () => Promise<void>
  refreshBalance: () => Promise<void>
  setUser: (user: UserProfile) => void
  initialize: () => () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  balance: 0,

  login: async () => {
    try {
      set({ loading: true })
      const fbUser = await signInWithGoogle()
      const token = await fbUser.getIdToken()
      const userProfile = await api.createSession(token)
      set({
        firebaseUser: fbUser,
        user: userProfile,
        balance: userProfile.balance,
        loading: false,
      })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  logout: async () => {
    try {
      await signOutUser()
      set({
        user: null,
        firebaseUser: null,
        balance: 0,
        loading: false,
      })
    } catch (error) {
      console.error('Logout failed:', error)
      throw error
    }
  },

  refreshBalance: async () => {
    try {
      const balance = await api.getBalance()
      set({ balance })
    } catch (error) {
      console.error('Failed to refresh balance:', error)
    }
  },

  setUser: (user: UserProfile) => {
    set({ user, balance: user.balance })
  },

  initialize: () => {
    set({ loading: true })

    const unsubscribe = onAuthChange(async (fbUser) => {
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken()
          const userProfile = await api.createSession(token)
          set({
            firebaseUser: fbUser,
            user: userProfile,
            balance: userProfile.balance,
            loading: false,
          })
        } catch (error) {
          console.error('Session restoration failed:', error)
          set({ firebaseUser: fbUser, loading: false })
        }
      } else {
        set({
          user: null,
          firebaseUser: null,
          balance: 0,
          loading: false,
        })
      }
    })

    return unsubscribe
  },
}))
