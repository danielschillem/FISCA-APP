import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthStore {
    token: string | null
    refreshToken: string | null
    user: User | null
    setAuth: (token: string, user: User, refreshToken?: string) => void
    logout: () => void
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            token: null,
            refreshToken: null,
            user: null,
            setAuth: (token, user, refreshToken) => {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('fisca_token', token)
                    if (refreshToken) localStorage.setItem('fisca_refresh_token', refreshToken)
                }
                set({ token, refreshToken: refreshToken ?? null, user })
            },
            logout: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('fisca_token')
                    localStorage.removeItem('fisca_refresh_token')
                }
                set({ token: null, refreshToken: null, user: null })
            },
        }),
        { name: 'fisca-auth' }
    )
)
