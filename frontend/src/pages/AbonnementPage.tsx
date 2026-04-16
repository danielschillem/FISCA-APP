import { useAuthStore, useAppStore } from '../lib/store';
import { usePermissions } from '../lib/permissions';
import { Card } from '../components/ui';
import {
    Check, X, ArrowUpRight, Users, User, Building2, Lock, Zap, Star,
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
    const userType = user?.user_type ?? 'physique';
    const nextPlan = UPGRADE_ORDER[currentPlan];

    const allPlans: PlanDef[] = [...PHYSIQUE_PLANS, ...MORAL_PLANS];
    const currentDef = allPlans.find((p) => p.id === currentPlan);

    const handleUpgrade = (planId: string) => {
        const subject = planId === 'moral_enterprise'
            ? 'Devis%20Plan%20Entreprise'
            : `Upgrade%20vers%20${planId}`;
        const body = planId === 'moral_enterprise'
            ? 'Bonjour%2C%20je%20souhaite%20obtenir%20un%20devis%20pour%20le%20plan%20Entreprise.'
            : `Bonjour%2C%20je%20souhaite%20passer%20au%20plan%20${planId}.`;
        window.open(`mailto:contact@fisca.bf?subject=${subject}&body=${body}`, '_blank');
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

