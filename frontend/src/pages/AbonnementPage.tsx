import { useState } from 'react';
import { useAuthStore, useAppStore } from '../lib/store';
import { usePermissions } from '../lib/permissions';
import { Card } from '../components/ui';
import {
    Check, X, ArrowUpRight, Users, User, Building2, Lock, Zap, Star,
    Smartphone, CreditCard, Copy, CheckCircle2,
} from 'lucide-react';

// ─── Plan definitions ─────────────────────────────────────────

const PHYSIQUE_PLANS = [
    {
        id: 'physique_starter',
        label: 'Solo Starter',
        price: 'Gratuit',
        priceDetail: 'Toujours gratuit',
        color: '#64748b',
        accent: 'border-slate-300',
        icon: User,
        desc: 'Pour les auto-entrepreneurs et travailleurs indépendants.',
        features: [
            { label: 'Tableau de bord fiscal', ok: true },
            { label: '3 employés maximum', ok: true },
            { label: 'Calcul IUTS / TPA (CGI 2025)', ok: true },
            { label: 'Rapport mensuel', ok: true },
            { label: 'Export CSV', ok: true },
            { label: 'Historique 3 mois', ok: true },
            { label: 'Bulletins de paie PDF', ok: false },
            { label: 'Simulateur fiscal A/B', ok: false },
            { label: 'Assistant IA fiscal', ok: false },
            { label: 'TVA / IRF / IS', ok: false },
        ],
    },
    {
        id: 'physique_pro',
        label: 'Solo Pro',
        price: '10 000 FCFA',
        priceDetail: '/ mois · engagement mensuel',
        color: '#16a34a',
        accent: 'border-green-400',
        icon: Zap,
        recommended: true,
        desc: 'Pour les professionnels et les petites entreprises en croissance.',
        features: [
            { label: 'Tableau de bord fiscal', ok: true },
            { label: '10 employés maximum', ok: true },
            { label: 'Calcul IUTS / TPA / CNSS (CGI 2025)', ok: true },
            { label: 'Bulletins de paie PDF', ok: true },
            { label: 'Simulateur fiscal A/B', ok: true },
            { label: 'Module TVA complet', ok: true },
            { label: 'IRF / IRCM', ok: true },
            { label: 'Assistant IA fiscal', ok: true },
            { label: 'Historique 12 mois', ok: true },
            { label: 'Multi-sociétés', ok: false },
        ],
    },
];

const MORAL_PLANS = [
    {
        id: 'moral_team',
        label: 'Équipe',
        price: '25 000 FCFA',
        priceDetail: '/ mois · jusqu\'à 5 utilisateurs',
        color: '#2563eb',
        accent: 'border-blue-400',
        icon: Users,
        desc: 'Pour les équipes, cabinets comptables et PME multi-entités.',
        features: [
            { label: '5 utilisateurs internes', ok: true },
            { label: '2 sociétés maximum', ok: true },
            { label: '200 employés maximum', ok: true },
            { label: 'Rôles : comptable, RH, auditeur', ok: true },
            { label: 'Toutes les fonctions fiscales', ok: true },
            { label: 'Workflow approbation', ok: true },
            { label: 'Retenue à la source', ok: true },
            { label: 'IS / CME / Patentes', ok: true },
            { label: 'Historique 24 mois', ok: true },
            { label: 'Sociétés / utilisateurs illimités', ok: false },
        ],
    },
    {
        id: 'moral_enterprise',
        label: 'Entreprise',
        price: 'Sur devis',
        priceDetail: 'engagement annuel · SLA garanti',
        color: '#ea580c',
        accent: 'border-orange-400',
        icon: Building2,
        desc: 'Pour les grands comptes, groupes multi-entités et intégrateurs.',
        features: [
            { label: 'Utilisateurs illimités', ok: true },
            { label: 'Sociétés illimitées', ok: true },
            { label: 'Employés illimités', ok: true },
            { label: 'Rôles personnalisés', ok: true },
            { label: 'API & Webhooks', ok: true },
            { label: 'Archivage 10 ans', ok: true },
            { label: 'Connexion DGI (beta)', ok: true },
            { label: 'SLA 99,9 % garanti', ok: true },
            { label: 'Support dédié', ok: true },
            { label: 'Historique illimité', ok: true },
        ],
    },
];

const UPGRADE_ORDER: Record<string, string> = {
    physique_starter: 'physique_pro',
    physique_pro: 'moral_team',
    moral_team: 'moral_enterprise',
    starter: 'physique_pro',
    pro: 'moral_team',
    enterprise: 'moral_enterprise',
};

type PlanDef = typeof PHYSIQUE_PLANS[0];

export default function AbonnementPage() {
    const { user } = useAuthStore();
    const { plan } = useAppStore();
    const { isAuditeur, roleLabel } = usePermissions();

    const currentPlan = user?.plan ?? plan;
    const nextPlan = UPGRADE_ORDER[currentPlan];

    const allPlans: PlanDef[] = [...PHYSIQUE_PLANS, ...MORAL_PLANS];
    const currentDef = allPlans.find((p) => p.id === currentPlan);

    const [payModal, setPayModal] = useState<{ planId: string; label: string; price: string; color: string } | null>(null);
    const [copied, setCopied] = useState('');

    const copyText = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(''), 2000);
    };

    const handleUpgrade = (planId: string) => {
        if (planId === 'moral_enterprise') {
            window.open('mailto:contact@fisca.bf?subject=Devis%20Plan%20Entreprise&body=Bonjour%2C%20je%20souhaite%20un%20devis%20pour%20le%20plan%20Entreprise.', '_blank');
            return;
        }
        const p = allPlans.find((x) => x.id === planId);
        if (p) setPayModal({ planId: p.id, label: p.label, price: p.price, color: p.color });
    };

    const PlanCard = ({ p, isActive }: { p: PlanDef; isActive: boolean }) => {
        const Icon = p.icon;
        const isNextUpgrade = p.id === nextPlan;
        const recommended = (p as { recommended?: boolean }).recommended;
        return (
            <div className={`relative rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all ${isActive ? p.accent + ' shadow-lg' : 'border-gray-200'} ${recommended && !isActive ? 'ring-2 ring-green-300' : ''}`}>
                {recommended && !isActive && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" /> Recommandé
                        </span>
                    </div>
                )}
                {isActive && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 text-white" style={{ background: p.color }}>
                            <Check className="w-3 h-3" /> Plan actif
                        </span>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: p.color }}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-base">{p.label}</h3>
                        <p className="text-[11px] text-gray-400">{p.desc}</p>
                    </div>
                </div>
                {/* Prix */}
                <div>
                    <p className="text-2xl font-black" style={{ color: p.color }}>{p.price}</p>
                    <p className="text-xs text-gray-400">{p.priceDetail}</p>
                </div>
                {/* Features */}
                <ul className="space-y-1.5 flex-1">
                    {p.features.map((f) => (
                        <li key={f.label} className={`flex items-center gap-2 text-xs ${f.ok ? 'text-gray-700' : 'text-gray-300'}`}>
                            {f.ok
                                ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                : <X className="w-3.5 h-3.5 text-gray-200 flex-shrink-0" />
                            }
                            {f.label}
                        </li>
                    ))}
                </ul>
                {/* CTA */}
                {isActive ? (
                    <div className="text-center text-sm font-semibold py-2 rounded-xl" style={{ background: p.color + '18', color: p.color }}>
                        Votre plan actuel
                    </div>
                ) : isAuditeur ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-2 rounded-xl bg-gray-50 border border-gray-100">
                        <Lock className="w-3.5 h-3.5" /> Contactez votre administrateur
                    </div>
                ) : (
                    <button
                        onClick={() => handleUpgrade(p.id)}
                        className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
                        style={{ background: isNextUpgrade ? p.color : '#94a3b8' }}
                    >
                        {p.id === 'moral_enterprise' ? 'Demander un devis' : `Passer à ${p.label}`}
                        <ArrowUpRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8 max-w-5xl">
            {/* Modal paiement */}
            {payModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Passer au plan <span style={{ color: payModal.color }}>{payModal.label}</span></h3>
                                <p className="text-sm text-gray-500">{payModal.price} / mois</p>
                            </div>
                            <button onClick={() => setPayModal(null)} className="p-1 rounded-full hover:bg-gray-100">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Orange Money */}
                            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Smartphone className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm font-semibold text-orange-700">Orange Money</span>
                                </div>
                                <p className="text-xs text-gray-600 mb-2">Envoyez le montant au numéro :</p>
                                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
                                    <span className="font-mono font-bold text-gray-900">+226 70 00 00 00</span>
                                    <button onClick={() => copyText('+22670000000', 'orange')} className="text-orange-500 hover:text-orange-700">
                                        {copied === 'orange' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Nom : FISCA SARL · Motif : <strong>{payModal.planId} – {user?.email}</strong></p>
                            </div>

                            {/* Moov Money */}
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Smartphone className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-semibold text-blue-700">Moov Money</span>
                                </div>
                                <p className="text-xs text-gray-600 mb-2">Envoyez le montant au numéro :</p>
                                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                                    <span className="font-mono font-bold text-gray-900">+226 70 11 11 11</span>
                                    <button onClick={() => copyText('+22670111111', 'moov')} className="text-blue-500 hover:text-blue-700">
                                        {copied === 'moov' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Nom : FISCA SARL · Motif : <strong>{payModal.planId} – {user?.email}</strong></p>
                            </div>

                            {/* Virement */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CreditCard className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-semibold text-gray-700">Virement bancaire</span>
                                </div>
                                <div className="space-y-1 text-xs text-gray-600">
                                    <div className="flex justify-between"><span>Banque</span><span className="font-medium">CBAO Burkina</span></div>
                                    <div className="flex justify-between"><span>Titulaire</span><span className="font-medium">FISCA SARL</span></div>
                                    <div className="flex items-center justify-between">
                                        <span>IBAN</span>
                                        <div className="flex items-center gap-1">
                                            <span className="font-mono font-medium">BF00 0000 0000 0000 0000 00</span>
                                            <button onClick={() => copyText('BF00000000000000000000', 'iban')} className="text-gray-400 hover:text-gray-700">
                                                {copied === 'iban' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 bg-green-50 rounded-xl p-3 text-xs text-green-700">
                            Après paiement, envoyez la preuve à <strong>contact@fisca.bf</strong> avec en objet votre email. Activation sous 24h.
                        </div>
                        <button
                            onClick={() => window.open(`mailto:contact@fisca.bf?subject=Paiement%20${payModal.planId}&body=Bonjour%2C%20je%20viens%20d%27effectuer%20le%20paiement%20pour%20le%20plan%20${payModal.label}.%20Mon%20email%20: ${user?.email}`, '_blank')}
                            className="mt-3 w-full text-center text-sm font-semibold py-2.5 rounded-xl text-white transition-all hover:opacity-90"
                            style={{ background: payModal.color }}
                        >
                            Confirmer le paiement par email
                        </button>
                    </div>
                </div>
            )}
            {/* Plan actuel résumé */}
            <div className="rounded-2xl border-2 p-5 flex items-center gap-4" style={{ borderColor: currentDef?.color ?? '#94a3b8' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: currentDef?.color ?? '#94a3b8' }}>
                    {currentDef && (() => { const Icon = currentDef.icon; return <Icon className="w-6 h-6" />; })()}
                </div>
                <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">Plan actif</p>
                    <p className="font-bold text-gray-900 text-lg">{currentDef?.label ?? currentPlan}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
                {roleLabel && (
                    <div className="text-right">
                        <p className="text-xs text-gray-400 mb-1">Votre rôle</p>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600">{roleLabel}</span>
                    </div>
                )}
                {nextPlan && !isAuditeur && (
                    <button
                        onClick={() => handleUpgrade(nextPlan)}
                        className="ml-4 flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 flex-shrink-0"
                        style={{ background: allPlans.find((p) => p.id === nextPlan)?.color ?? '#16a34a' }}
                    >
                        Upgrader <ArrowUpRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Personne Physique */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <User className="w-5 h-5 text-gray-400" />
                    <h2 className="text-base font-bold text-gray-900">Personne Physique — Solo</h2>
                    <span className="text-xs text-gray-400 hidden sm:block">Auto-entrepreneur, indépendant</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {PHYSIQUE_PLANS.map((p) => (
                        <PlanCard key={p.id} p={p} isActive={currentPlan === p.id} />
                    ))}
                </div>
            </div>

            {/* Personne Morale */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <h2 className="text-base font-bold text-gray-900">Personne Morale — Organisation</h2>
                    <span className="text-xs text-gray-400 hidden sm:block">Entreprise, cabinet, groupe multi-entités</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {MORAL_PLANS.map((p) => (
                        <PlanCard key={p.id} p={p} isActive={currentPlan === p.id} />
                    ))}
                </div>
            </div>

            {/* Note légale */}
            <Card>
                <p className="text-xs text-gray-400 leading-relaxed">
                    Tous les prix sont en <strong>FCFA</strong> et s'entendent hors taxes. Les paiements sont traités via
                    Mobile Money (Orange Money, Moov) ou virement bancaire. Pour toute question ou devis personnalisé, contactez{' '}
                    <a href="mailto:contact@fisca.bf" className="text-green-600 hover:underline font-medium">contact@fisca.bf</a>.
                    FISCA est conforme au <strong>CGI 2025</strong> (Burkina Faso) et aux normes <strong>OHADA</strong>.
                </p>
            </Card>
        </div>
    );
}

