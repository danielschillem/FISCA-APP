import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { AuthResponse } from '../../types';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authApi.login({ email, password });
            const data: AuthResponse = res.data;
            setAuth(data.token, data.user);
            navigate('/dashboard');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg ?? 'Identifiants invalides');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                        F
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">FISCA</h1>
                    <p className="text-gray-500 text-sm mt-1">Plateforme Fiscale Burkina Faso</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Connexion</h2>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Link to="/forgot-password" className="text-xs text-green-600 hover:underline">
                                Mot de passe oublié ?
                            </Link>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
                        >
                            {loading ? 'Connexion…' : 'Se connecter'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-500 mt-6">
                        Pas encore de compte ?{' '}
                        <Link to="/register" className="text-green-600 font-medium hover:underline">
                            S'inscrire
                        </Link>
                    </p>
                </div>

                <p className="text-center text-[11px] text-gray-400 mt-6">
                    CGI 2025 · Burkina Faso · Données sécurisées
                </p>
            </div>
        </div>
    );
}
