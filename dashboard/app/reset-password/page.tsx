'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'

function ResetPasswordForm() {
    const router = useRouter()
    const params = useSearchParams()
    const [token, setToken] = useState(params.get('token') || '')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (password !== confirm) {
            toast.error('Les mots de passe ne correspondent pas')
            return
        }
        setLoading(true)
        try {
            await authApi.resetPassword(token, password)
            toast.success('Mot de passe réinitialisé !')
            router.push('/login')
        } catch {
            toast.error('Token invalide ou expiré')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {!params.get('token') && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Token de réinitialisation <span className="req">*</span></label>
                    <input type="text" required
                        value={token} onChange={(e) => setToken(e.target.value)}
                        placeholder="Collez le token reçu par email" />
                </div>
            )}
            <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Nouveau mot de passe <span className="req">*</span></label>
                <input type="password" required minLength={8}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                <p style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>Minimum 8 caractères</p>
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Confirmer le mot de passe <span className="req">*</span></label>
                <input type="password" required minLength={8}
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button type="submit" disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Enregistrement…' : 'Réinitialiser le mot de passe'}
            </button>
        </form>
    )
}

export default function ResetPasswordPage() {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--g900)',
        }}>
            <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
                <div className="card" style={{ padding: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                        <div className="logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>F</div>
                        <div>
                            <strong style={{ display: 'block', fontSize: 18, fontWeight: 800, color: 'var(--gr9)' }}>FISCA</strong>
                            <span style={{ fontSize: 12, color: 'var(--gr5)' }}>Nouveau mot de passe</span>
                        </div>
                    </div>
                    <div style={{ marginBottom: 22 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gr9)', marginBottom: 3 }}>Réinitialiser</h2>
                        <p style={{ fontSize: 12, color: 'var(--gr5)' }}>Choisissez un nouveau mot de passe pour votre compte</p>
                    </div>
                    <Suspense>
                        <ResetPasswordForm />
                    </Suspense>
                    <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--gr5)' }}>
                        <a href="/login" style={{ color: 'var(--g500)', fontWeight: 600 }}>Retour à la connexion</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
