import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { AuthResponse } from '../../types';
import { ShieldCheck, BarChart2, FileCheck, Calculator } from 'lucide-react';

const FEATURES = [
    { Icon: BarChart2, text: 'Tableaux de bord fiscaux en temps réel' },
    { Icon: FileCheck, text: 'Bulletins de paie & déclarations IUTS' },
    { Icon: Calculator, text: 'Calculateur CGI 2025 - tous les impôts BF' },
    { Icon: ShieldCheck, text: 'Données sécurisées · Conforme OHADA' },
];

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
        <div className="min-h-screen flex">
            {/* Left panel - brand / features (desktop only) */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col justify-between p-10 relative overflow-hidden"
                style={{
                    backgroundImage: 'url(/login_bg.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}>
                {/* Dark overlay for readability */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, rgba(15,23,42,0.82) 0%, rgba(13,40,24,0.78) 60%, rgba(20,83,45,0.72) 100%)' }} />

                {/* Logo */}
                <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}>
                        F
                    </div>
                    <div>
                        <span className="font-bold text-white text-lg tracking-wide">FISCA</span>
                        <p className="text-green-400/70 text-xs">Plateforme Fiscale</p>
                    </div>
                </div>

                {/* Hero */}
                <div className="relative">
                    <h2 className="text-3xl font-bold text-white leading-tight mb-3">
                        Gérez votre fiscalité<br />
                        <span className="text-green-400">en toute simplicité</span>
                    </h2>
                    <p className="text-slate-400 text-sm mb-8">
                        Conforme au Code Général des Impôts 2025 - Burkina Faso
                    </p>
                    <div className="space-y-3">
                        {FEATURES.map(({ Icon, text }) => (
                            <div key={text} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-green-400" />
                                </div>
                                <span className="text-slate-300 text-sm">{text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <p className="relative text-slate-600 text-xs">
                    © 2025 FISCA · CGI 2025 · Burkina Faso
                </p>
            </div>

            {/* Right panel - form */}
            <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3 shadow"
                            style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}>
                            F
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">FISCA</h1>
                        <p className="text-gray-500 text-sm">Plateforme Fiscale Burkina Faso</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Connexion</h2>
                            <p className="text-sm text-gray-400 mt-1">Bienvenue, entrez vos identifiants</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100 flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold flex-shrink-0">!</span>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">E-mail</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent focus:bg-white transition-all"
                                    placeholder="vous@entreprise.bf"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mot de passe</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent focus:bg-white transition-all"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="flex justify-end">
                                <Link to="/forgot-password" className="text-xs text-green-600 hover:text-green-700 hover:underline font-medium">
                                    Mot de passe oublié ?
                                </Link>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full text-white font-semibold py-2.5 rounded-xl text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm hover:shadow-md"
                                style={{ background: loading ? '#16a34a99' : 'linear-gradient(135deg, #16a34a, #059669)' }}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Connexion...
                                    </span>
                                ) : 'Se connecter'}
                            </button>
                        </form>

                        <p className="text-center text-xs text-gray-400 mt-6">
                            Pas encore de compte ?{' '}
                            <Link to="/register" className="text-green-600 font-semibold hover:underline">
                                S'inscrire
                            </Link>
                        </p>
                    </div>

                    <p className="text-center text-[11px] text-gray-400 mt-5">
                        CGI 2025 · Burkina Faso · Données sécurisées
                    </p>
                </div>
            </div>
        </div>
    );
}
