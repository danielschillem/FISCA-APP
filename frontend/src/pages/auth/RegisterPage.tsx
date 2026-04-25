import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { AuthResponse } from '../../types';
import {
    ArrowRight, AlertCircle,
} from 'lucide-react';

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
            const res = await authApi.register({
                email: form.email,
                password: form.password,
                nom: form.nom,
            });
            const data: AuthResponse = res.data;
            setAuth(data.token, data.user, data.refresh_token);
            navigate(data.user.role === 'super_admin' ? '/admin' : '/parametres');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg ?? "Erreur lors de l'inscription");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            <div
                className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between relative overflow-hidden"
                style={{ backgroundImage: "url('/register_bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 p-10 flex flex-col h-full justify-between">
                    <div className="flex items-center gap-3">
                        <span style={{ fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif', fontWeight: 900 }} className="text-white text-2xl tracking-widest">FISCA</span>
                    </div>
                    <div>
                        <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
                            Créez votre compte<br />et simplifiez<br />votre fiscalité
                        </h2>
                        <p className="text-white/75 text-sm leading-relaxed max-w-xs">
                            Déclarations, calculs CGI 2025 et annexes DGI — tout en un.
                        </p>
                    </div>
                    <p className="text-white/50 text-xs">Plateforme fiscale - Burkina Faso - CGI 2025</p>
                </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-start overflow-y-auto bg-gradient-to-br from-slate-50 via-slate-100/90 to-slate-200/40 py-12 px-4 sm:px-8">
                <div className="lg:hidden text-center mb-8">
                    <h1 style={{ fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif', fontWeight: 900 }} className="text-3xl text-green-700 tracking-widest mb-3">FISCA</h1>
                    <p className="text-gray-500 text-sm mt-1">Plateforme Fiscale - Burkina Faso</p>
                </div>

                <div className="w-full max-w-2xl">
                    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-[var(--card-shadow-hover)] backdrop-blur-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Créer votre compte Contribuable</h2>
                        <p className="text-xs text-gray-400 mb-6">
                            Une seule création de compte. Vous renseignerez ensuite vos informations d&apos;entreprise dans Paramètres.
                        </p>

                        {error && (
                            <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Nom de l&apos;entreprise</label>
                                <input type="text" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Ma Société SARL" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse email</label>
                                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="vous@entreprise.bf" required autoComplete="email" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
                                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="8 caractères minimum" required autoComplete="new-password" />
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                                {loading ? 'Création en cours...' : (<>Créer mon compte <ArrowRight className="w-4 h-4" /></>)}
                            </button>
                        </form>

                        <p className="text-center text-xs text-gray-500 mt-6">
                            Déjà un compte ?{' '}
                            <Link to="/login" className="text-green-600 font-medium hover:underline">Se connecter</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
