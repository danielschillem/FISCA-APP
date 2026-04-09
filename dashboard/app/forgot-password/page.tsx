'use client'
import { useState } from 'react'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            await authApi.forgotPassword(email)
            setSent(true)
        } catch {
            toast.error('Erreur lors de la demande')
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                        <div className="logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>F</div>
                        <div>
                            <strong style={{ display: 'block', fontSize: 18, fontWeight: 800, color: 'var(--gr9)' }}>FISCA</strong>
                            <span style={{ fontSize: 12, color: 'var(--gr5)' }}>Réinitialisation du mot de passe</span>
                        </div>
                    </div>

                    {sent ? (
                        <div>
                            <div style={{
                                background: 'var(--g50)', border: '1.5px solid var(--g400)',
                                borderRadius: 8, padding: '14px 16px', marginBottom: 20
                            }}>
                                <p style={{ fontSize: 14, color: 'var(--g700)', margin: 0 }}>
                                    <strong>Email envoyé.</strong> Si votre adresse est enregistrée, vous recevrez un lien de réinitialisation sous peu.
                                </p>
                            </div>
                            <a href="/login" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
                                Retour à la connexion
                            </a>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 22 }}>
                                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gr9)', marginBottom: 3 }}>Mot de passe oublié</h2>
                                <p style={{ fontSize: 12, color: 'var(--gr5)' }}>Entrez votre email pour recevoir un lien de réinitialisation</p>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group" style={{ marginBottom: 20 }}>
                                    <label>Email <span className="req">*</span></label>
                                    <input type="email" required
                                        value={email} onChange={(e) => setEmail(e.target.value)} />
                                </div>
                                <button type="submit" disabled={loading}
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}>
                                    {loading ? 'Envoi…' : 'Envoyer le lien'}
                                </button>
                            </form>
                            <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--gr5)' }}>
                                <a href="/login" style={{ color: 'var(--g500)', fontWeight: 600 }}>Retour à la connexion</a>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
