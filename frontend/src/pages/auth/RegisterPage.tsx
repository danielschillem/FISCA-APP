import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { AuthResponse } from '../../types';
import {
    User, Building2, ArrowRight, ArrowLeft, CheckCircle2,
    Briefcase, Users, Star, Zap, AlertCircle,
} from 'lucide-react';

// ─── Plans disponibles ────────────────────────────────────────

const PHYSIQUE_PLANS = [
    {
        id: 'physique_starter',
        label: 'Solo Starter',
        price: 'Gratuit 30 jours',
        description: 'Idéal pour démarrer',
        limits: '1 société · 3 employés max',
        icon: Star,
        color: 'from-slate-500 to-slate-700',
        features: ['IUTS, Rapport mensuel', 'Calcul fiscal CGI 2025', 'Calendrier des échéances'],
    },
    {
        id: 'physique_pro',
        label: 'Solo Pro',
        price: '9 900 FCFA / mois',
        description: 'Pour les auto-entrepreneurs actifs',
        limits: '1 société · 10 employés max',
        icon: Zap,
        color: 'from-green-500 to-emerald-700',
        features: ['Tout Solo Starter', 'Bulletins de paie', 'TVA, IRF, IRCM', 'Assistant IA fiscal'],
    },
];

const MORAL_PLANS = [
    {
        id: 'moral_team',
        label: 'Équipe',
        price: '29 900 FCFA / mois',
        description: 'Pour les PME et cabinets',
        limits: '2 sociétés · 5 utilisateurs · 200 employés',
        icon: Users,
        color: 'from-blue-500 to-blue-700',
        features: ['Toutes les fonctionnalités', 'Rôles internes (comptable, RH…)', 'Gestion multi-sociétés', 'Workflow approbation'],
    },
    {
        id: 'moral_enterprise',
        label: 'Entreprise',
        price: 'Sur devis',
        description: 'Pour les grandes structures',
        limits: 'Illimité · API · Support dédié',
        icon: Briefcase,
        color: 'from-orange-500 to-orange-700',
        features: ['Tout Équipe', 'Utilisateurs illimités', 'Sociétés illimitées', 'Intégration DGI (bêta)'],
    },
];

export default function RegisterPage() {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [userType, setUserType] = useState<'physique' | 'morale' | ''>('');
    const [plan, setPlan] = useState('');
    const [form, setForm] = useState({ email: '', password: '', nom: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const nomLabel = userType === 'morale' ? 'Nom de la structure' : 'Nom de votre entreprise';
    const nomPlaceholder = userType === 'morale' ? 'Cabinet ALPHA SARL' : 'Mon Entreprise';

    const planLabel = plan
        .replace('physique_starter', 'Solo Starter')
        .replace('physique_pro', 'Solo Pro')
        .replace('moral_team', 'Équipe')
        .replace('moral_enterprise', 'Entreprise');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const res = await authApi.register({
                email: form.email,
                password: form.password,
                nom: form.nom,
                plan,
                user_type: userType,
            });
            const data: AuthResponse = res.data;
            setAuth(data.token, data.user);
            navigate('/dashboard');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg ?? "Erreur lors de l'inscription");
        } finally {
            setLoading(false);
        }
    };

    const StepIndicator = () => (
        <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${s < step ? 'bg-green-600 text-white' :
                        s === step ? 'bg-green-600 text-white ring-4 ring-green-100' :
                            'bg-gray-200 text-gray-400'
                        }`}>
                        {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
                    </div>
                    {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-green-600' : 'bg-gray-200'}`} />}
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen flex">
            {/* ── Panneau gauche : background image ── */}
            <div
                className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between relative overflow-hidden"
                style={{ backgroundImage: "url('/register_bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                {/* Overlay sombre pour lisibilité */}
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 p-10 flex flex-col h-full justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white text-lg font-extrabold">F</div>
                        <span className="text-white text-xl font-extrabold tracking-wide">FISCA</span>
                    </div>
                    {/* Accroche centrale */}
                    <div>
                        <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
                            Créez votre compte<br />et simplifiez<br />votre fiscalité
                        </h2>
                        <p className="text-white/75 text-sm leading-relaxed max-w-xs">
                            Déclarations, calculs CGI 2025, bulletins de paie et gestion multi-sociétés — tout en un.
                        </p>
                    </div>
                    {/* Badge bas */}
                    <p className="text-white/50 text-xs">Plateforme fiscale · Burkina Faso · CGI 2025</p>
                </div>
            </div>

            {/* ── Panneau droit : formulaire multi-étapes ── */}
            <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto bg-gray-50 py-12 px-4 sm:px-8">
                {/* Logo mobile */}
                <div className="lg:hidden text-center mb-8">
                    <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-3 shadow-lg">F</div>
                    <h1 className="text-2xl font-extrabold text-gray-900">FISCA</h1>
                    <p className="text-gray-500 text-sm mt-1">Plateforme Fiscale · Burkina Faso</p>
                </div>

                <div className="w-full max-w-2xl">
                    <StepIndicator />

                    {/* ── Étape 1 : Type de compte ── */}
                    {step === 1 && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Quel est votre profil ?</h2>
                            <p className="text-gray-500 text-sm text-center mb-8">Choisissez le type de compte qui correspond à votre situation</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => { setUserType('physique'); setPlan(''); setStep(2); }}
                                    className="group bg-white border-2 border-gray-200 hover:border-green-500 rounded-2xl p-6 text-left transition-all hover:shadow-md"
                                >
                                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-600 transition-colors">
                                        <User className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">Personne Physique</h3>
                                    <p className="text-sm text-gray-500 mb-3">Auto-entrepreneur, profession libérale, gérant unique</p>
                                    <ul className="text-xs text-gray-400 space-y-1">
                                        <li>✓ Compte solo : vous seul</li>
                                        <li>✓ Toutes les déclarations fiscales</li>
                                        <li>✓ Calculateur CGI 2025</li>
                                    </ul>
                                </button>
                                <button
                                    onClick={() => { setUserType('morale'); setPlan(''); setStep(2); }}
                                    className="group bg-white border-2 border-gray-200 hover:border-blue-500 rounded-2xl p-6 text-left transition-all hover:shadow-md"
                                >
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                                        <Building2 className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">Personne Morale</h3>
                                    <p className="text-sm text-gray-500 mb-3">Entreprise, cabinet, structure avec plusieurs utilisateurs</p>
                                    <ul className="text-xs text-gray-400 space-y-1">
                                        <li>✓ Multi-utilisateurs avec rôles</li>
                                        <li>✓ Plusieurs sociétés gérées</li>
                                        <li>✓ Admin interne + workflow</li>
                                    </ul>
                                </button>
                            </div>
                            <p className="text-center text-xs text-gray-500 mt-8">
                                Déjà un compte ?{' '}
                                <Link to="/login" className="text-green-600 font-medium hover:underline">Se connecter</Link>
                            </p>
                        </div>
                    )}

                    {/* ── Étape 2 : Plan ── */}
                    {step === 2 && (
                        <div>
                            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
                                <ArrowLeft className="w-4 h-4" /> Retour
                            </button>
                            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Choisissez votre plan</h2>
                            <p className="text-gray-500 text-sm text-center mb-8">
                                {userType === 'physique' ? 'Compte solo · personne physique' : 'Structure multi-utilisateurs · personne morale'}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(userType === 'physique' ? PHYSIQUE_PLANS : MORAL_PLANS).map((p) => {
                                    const Icon = p.icon;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => { setPlan(p.id); setStep(3); }}
                                            className="bg-white border-2 border-gray-200 hover:border-green-500 rounded-2xl p-6 text-left transition-all hover:shadow-md"
                                        >
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-4`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex items-start justify-between mb-1">
                                                <h3 className="font-bold text-gray-900">{p.label}</h3>
                                                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">{p.price}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-1">{p.description}</p>
                                            <p className="text-xs text-gray-400 mb-3 font-medium">{p.limits}</p>
                                            <ul className="text-xs text-gray-500 space-y-1">
                                                {p.features.map((f, i) => (
                                                    <li key={i} className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Étape 3 : Informations ── */}
                    {step === 3 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                            <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
                                <ArrowLeft className="w-4 h-4" /> Retour
                            </button>
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Créer votre compte</h2>
                            <p className="text-xs text-gray-400 mb-6">
                                Plan : <span className="font-semibold text-green-700">{planLabel}</span>
                                {' · '}
                                {userType === 'physique' ? 'Personne physique' : 'Personne morale'}
                            </p>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">{nomLabel}</label>
                                    <input
                                        type="text"
                                        value={form.nom}
                                        onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder={nomPlaceholder}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse email</label>
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
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Création en cours…' : (<>Créer mon compte <ArrowRight className="w-4 h-4" /></>)}
                                </button>
                            </form>

                            <p className="text-center text-xs text-gray-500 mt-6">
                                Déjà un compte ?{' '}
                                <Link to="/login" className="text-green-600 font-medium hover:underline">Se connecter</Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}