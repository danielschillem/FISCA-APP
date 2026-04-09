'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import type { AuthResponse } from '@/types'

export default function RegisterPage() {
    const router = useRouter()
    const setAuth = useAuthStore((s) => s.setAuth)
    const [nom, setNom] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await authApi.register({ email, password, nom })
            const data = res.data as AuthResponse
            setAuth(data.token, data.user, data.refresh_token)
            router.push('/dashboard')
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })
                ?.response?.data?.error ?? 'Erreur lors de l\'inscription'
            toast.error(msg)
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
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gr9)', marginBottom: 3 }}>Créer un compte</h2>
                        <p style={{ fontSize: 12, color: 'var(--gr5)' }}>Commencez gratuitement avec le plan Starter</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label>Nom entreprise <span className="req">*</span></label>
                            <input type="text" required
                                value={nom} onChange={(e) => setNom(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label>Email <span className="req">*</span></label>
                            <input type="email" required
                                value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label>Mot de passe <span className="req">*</span></label>
                            <input type="password" required minLength={8}
                                value={password} onChange={(e) => setPassword(e.target.value)} />
                            <p style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>Minimum 8 caractères</p>
                        </div>
                        <button type="submit" disabled={loading}
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}>
                            {loading ? 'Création…' : 'Créer mon compte'}
                        </button>
                    </form>

                    <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--gr5)' }}>
                        Déjà un compte ?{' '}
                        <a href="/login" style={{ color: 'var(--g500)', fontWeight: 600 }}>Se connecter</a>
                    </p>

                    <p style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: 'var(--gr4)' }}>
                        En créant un compte, vous acceptez nos{' '}
                        <a href="/cgu" style={{ color: 'var(--gr5)' }}>CGU</a>{' '}
                        et notre{' '}
                        <a href="/mentions-legales" style={{ color: 'var(--gr5)' }}>politique de confidentialité</a>.
                    </p>
                </div>
            </div>
        </div>
    )
}
