'use client'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import OnboardingBanner from '@/components/OnboardingBanner'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const token = useAuthStore((s) => s.token)
    const router = useRouter()

    useEffect(() => {
        if (!token) router.replace('/login')
    }, [token, router])

    if (!token) return null

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--gr0)' }}>
            <Sidebar />
            <div style={{ marginLeft: 'var(--sw)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Topbar />
                <main style={{ flex: 1, padding: '22px 24px', overflowY: 'auto' }} className="view-enter">
                    <OnboardingBanner />
                    {children}
                </main>
            </div>
        </div>
    )
}
