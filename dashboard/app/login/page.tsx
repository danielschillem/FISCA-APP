'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import type { AuthResponse } from '@/types'

export default function LoginPage() {
    const router = useRouter()
    const setAuth = useAuthStore((s) => s.setAuth)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await authApi.login({ email, password })
            const data = res.data as AuthResponse
            setAuth(data.token, data.user)
            router.push('/dashboard')
        } catch {
            toast.error('Identifiants invalides')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--g900)',
        }}>
            <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
                <div className="card" style={{ padding: 32 }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                        <div className="logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>F</div>
                        <div>
                            <strong style={{ display: 'block', fontSize: 18, fontWeight: 800, color: 'var(--gr9)' }}>FISCA</strong>
                            <span style={{ fontSize: 12, color: 'var(--gr5)' }}>Plateforme Fiscale — Burkina Faso</span>
                        </div>
                    </div>

                    <div style={{ marginBottom: 22 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gr9)', marginBottom: 3 }}>Connexion</h2>
                        <p style={{ fontSize: 12, color: 'var(--gr5)' }}>Connectez-vous à votre espace fiscal</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label>Email <span className="req">*</span></label>
                            <input type="email" required
                                value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label>Mot de passe <span className="req">*</span></label>
                            <input type="password" required minLength={8}
                                value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        <button type="submit" disabled={loading}
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}>
                            {loading ? 'Connexion…' : 'Se connecter'}
                        </button>
                    </form>

                    <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--gr5)' }}>
                        Pas de compte ?{' '}
                        <a href="/register" style={{ color: 'var(--g500)', fontWeight: 600 }}>Créer un compte</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
