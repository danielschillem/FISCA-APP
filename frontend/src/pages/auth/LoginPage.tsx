import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { AuthResponse } from '../../types';
import {
    ShieldCheck, BarChart2, FileCheck, Calculator,
    Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle,
} from 'lucide-react';

const FEATURES = [
    { Icon: BarChart2, text: 'Tableaux de bord fiscaux en temps réel' },
    { Icon: FileCheck, text: 'Bulletins de paie & déclarations IUTS' },
    { Icon: Calculator, text: 'Calculateur CGI 2025 — tous les impôts BF' },
    { Icon: ShieldCheck, text: 'Données sécurisées · Conforme OHADA' },
];

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
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

            {/* ── Panneau gauche — image + branding ──────────────────────── */}
            <div
                className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between p-12 relative overflow-hidden"
                style={{ backgroundImage: 'url(/login_bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                {/* Overlay dégradé */}
                <div className="absolute inset-0" style={{
                    background: 'linear-gradient(160deg, rgba(10,20,35,0.88) 0%, rgba(10,40,20,0.82) 55%, rgba(16,60,30,0.70) 100%)',
                }} />

                {/* Logo */}
                <div className="relative flex items-center gap-3 z-10">
                    <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}
                    >F</div>
                    <div>
                        <span className="font-extrabold text-white text-xl tracking-widest">FISCA</span>
                        <p className="text-green-400/70 text-[11px] tracking-wide">Plateforme Fiscale BF</p>
                    </div>
                </div>

                {/* Accroche + features */}
                <div className="relative z-10">
                    <div className="mb-6">
                        <span className="inline-block bg-green-500/20 text-green-300 text-xs font-semibold px-3 py-1 rounded-full tracking-wider mb-4">
                            CGI 2025 · Burkina Faso
                        </span>
                        <h2 className="text-4xl font-extrabold text-white leading-snug mb-3">
                            Gérez votre<br />
                            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #4ade80, #22d3ee)' }}>
                                fiscalité simplement
                            </span>
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                            La plateforme tout-en-un pour vos déclarations, bulletins de paie et calculs d'impôts.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {FEATURES.map(({ Icon, text }) => (
                            <div key={text} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-green-500/15 backdrop-blur-sm border border-green-500/20 flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-green-400" />
                                </div>
                                <span className="text-slate-300 text-sm">{text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pied */}
                <p className="relative z-10 text-slate-600 text-xs">© {new Date().getFullYear()} FISCA · Tous droits réservés</p>
            </div>

            {/* ── Panneau droit — formulaire ──────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-6 bg-[#f8fafc]">
                <div className="w-full max-w-[400px]">

                    {/* Logo mobile */}
                    <div className="lg:hidden text-center mb-8">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mx-auto mb-3 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}
                        >F</div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-wide">FISCA</h1>
                        <p className="text-gray-400 text-sm">Plateforme Fiscale · Burkina Faso</p>
                    </div>

                    {/* Carte formulaire */}
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100/80 px-8 py-10">

                        {/* En-tête */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Bon retour 👋</h2>
                            <p className="text-sm text-gray-400 mt-1.5">Connectez-vous à votre espace fiscal</p>
                        </div>

                        {/* Erreur */}
                        {error && (
                            <div className="flex items-start gap-2.5 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-2xl mb-6 border border-red-100">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* Champ e-mail */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    Adresse e-mail
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 bg-gray-50/60 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 focus:bg-white transition-all duration-150"
                                        placeholder="vous@entreprise.bf"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Champ mot de passe */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Mot de passe
                                    </label>
                                    <Link
                                        to="/forgot-password"
                                        className="text-xs text-green-600 hover:text-green-700 font-semibold hover:underline underline-offset-2"
                                    >
                                        Oublié ?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-11 py-3 border border-gray-200 bg-gray-50/60 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 focus:bg-white transition-all duration-150"
                                        placeholder="••••••••••"
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPwd(!showPwd)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        tabIndex={-1}
                                        aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                    >
                                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Bouton */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                style={{ background: loading ? '#16a34a88' : 'linear-gradient(135deg, #16a34a 0%, #059669 100%)' }}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Connexion en cours…
                                    </>
                                ) : (
                                    <>
                                        Se connecter
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Séparateur */}
                        <div className="flex items-center gap-3 my-6">
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="text-xs text-gray-400">ou</span>
                            <div className="flex-1 h-px bg-gray-100" />
                        </div>

                        {/* Inscription */}
                        <p className="text-center text-sm text-gray-500">
                            Pas encore de compte ?{' '}
                            <Link
                                to="/register"
                                className="text-green-600 font-bold hover:text-green-700 hover:underline underline-offset-2"
                            >
                                Créer un compte
                            </Link>
                        </p>
                    </div>

                    {/* Badges de confiance */}
                    <div className="flex items-center justify-center gap-4 mt-6">
                        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> SSL sécurisé
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-[11px] text-gray-400">CGI 2025</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-[11px] text-gray-400">Conforme OHADA</span>
                    </div>
                </div>
            </div>
        </div>
    );
}


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
