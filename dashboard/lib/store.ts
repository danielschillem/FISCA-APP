import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthStore {
    token: string | null
    user: User | null
    setAuth: (token: string, user: User) => void
    logout: () => void
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            setAuth: (token, user) => {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('fisca_token', token)
                }
                set({ token, user })
            },
            logout: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('fisca_token')
                }
                set({ token: null, user: null })
            },
        }),
        { name: 'fisca-auth' }
    )
)
