import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { AuthResponse } from '../../types';

export default function RegisterPage() {
    const [form, setForm] = useState({ email: '', password: '', nom: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const res = await authApi.register(form);
            const data: AuthResponse = res.data;
            setAuth(data.token, data.user);
            navigate('/dashboard');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg ?? 'Erreur lors de l\'inscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">F</div>
                    <h1 className="text-2xl font-bold text-gray-900">FISCA</h1>
                    <p className="text-gray-500 text-sm mt-1">Créer votre compte</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Inscription</h2>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100">{error}</div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
                            <input
                                type="text"
                                value={form.nom}
                                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Ma Société SARL"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="vous@entreprise.bf"
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="8 caractères minimum"
                                required
                                autoComplete="new-password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
                        >
                            {loading ? 'Création…' : 'Créer mon compte'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-500 mt-6">
                        Déjà un compte ?{' '}
                        <Link to="/login" className="text-green-600 font-medium hover:underline">Se connecter</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
