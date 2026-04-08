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
            setAuth(data.token, data.user)
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="card w-full max-w-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-lg">F</div>
                    <div>
                        <p className="font-semibold text-gray-900">FISCA</p>
                        <p className="text-xs text-gray-500">Plateforme Fiscale</p>
                    </div>
                </div>

                <h1 className="text-xl font-semibold mb-1">Créer un compte</h1>
                <p className="text-sm text-gray-500 mb-6">Commencez gratuitement avec le plan Starter</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom entreprise</label>
                        <input className="input" type="text" required
                            value={nom} onChange={(e) => setNom(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input className="input" type="email" required
                            value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                        <input className="input" type="password" required minLength={8}
                            value={password} onChange={(e) => setPassword(e.target.value)} />
                        <p className="text-xs text-gray-400 mt-1">Minimum 8 caractères</p>
                    </div>
                    <button type="submit" disabled={loading} className="btn-primary w-full">
                        {loading ? 'Création…' : 'Créer mon compte'}
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-500">
                    Déjà un compte ?{' '}
                    <a href="/login" className="text-brand font-medium hover:underline">Se connecter</a>
                </p>
            </div>
        </div>
    )
}
