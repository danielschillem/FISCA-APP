import { useQuery } from '@tanstack/react-query';
import { orgApi } from '../../lib/api';
import type { OrgInfo } from '../../types';
import { Building2, Users, Briefcase, UserCheck, Globe2, FileText } from 'lucide-react';

// --- Helpers ------------------------------------------------------------------
const PLAN_LABELS: Record<string, { label: string; color: string }> = {
    physique_starter: { label: 'Physique Starter', color: 'bg-slate-100 text-slate-600 border border-slate-200' },
    physique_pro: { label: 'Physique Pro', color: 'bg-sky-100 text-sky-700 border border-sky-200' },
    moral_team: { label: 'Morale Team', color: 'bg-violet-100 text-violet-700 border border-violet-200' },
    moral_enterprise: { label: 'Morale Enterprise', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    starter: { label: 'Starter', color: 'bg-slate-100 text-slate-600 border border-slate-200' },
    pro: { label: 'Pro', color: 'bg-sky-100 text-sky-700 border border-sky-200' },
    enterprise: { label: 'Enterprise', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
};

interface QuotaCardProps {
    label: string;
    used: number;
    max: number;
    Icon: React.ElementType;
}

function QuotaCard({ label, used, max, Icon }: QuotaCardProps) {
    const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
    const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-500">
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-900">{used}</span>
                <span className="text-sm text-slate-400">/ {max > 0 ? max : '∞'}</span>
            </div>
            {max > 0 && (
                <div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{pct}% utilisé</p>
                </div>
            )}
        </div>
    );
}

// --- Page ---------------------------------------------------------------------
export default function OrgInfoPage() {
    const { data, isLoading, isError } = useQuery<OrgInfo>({
        queryKey: ['org-info'],
        queryFn: () => orgApi.getInfo().then(r => r.data),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Chargement…
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500 text-sm">
                Impossible de charger les informations de l'organisation.
            </div>
        );
    }

    const { organization: org, stats } = data;
    const plan = PLAN_LABELS[org.plan] ?? { label: org.plan, color: 'bg-gray-100 text-gray-600' };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Header card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
                        <Building2 className="w-7 h-7 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl font-bold text-slate-900 truncate">{org.nom}</h1>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${plan.color}`}>
                                {plan.label}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                            Créée le {new Date(org.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* Details grid */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {org.ifu && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">IFU</p>
                                <p className="text-sm font-medium text-slate-700">{org.ifu}</p>
                            </div>
                        </div>
                    )}
                    {org.rccm && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">RCCM</p>
                                <p className="text-sm font-medium text-slate-700">{org.rccm}</p>
                            </div>
                        </div>
                    )}
                    {org.secteur && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                <Globe2 className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Secteur</p>
                                <p className="text-sm font-medium text-slate-700">{org.secteur}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quotas */}
            <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Quotas de votre plan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <QuotaCard
                        label="Membres"
                        used={stats.member_count}
                        max={stats.max_users}
                        Icon={Users}
                    />
                    <QuotaCard
                        label="Sociétés"
                        used={stats.company_count}
                        max={stats.max_companies}
                        Icon={Building2}
                    />
                    <QuotaCard
                        label="Employés max"
                        used={0}
                        max={stats.max_employees}
                        Icon={UserCheck}
                    />
                </div>
            </div>

            {/* Plan upgrade CTA */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-violet-900">Besoin de plus de capacité ?</p>
                    <p className="text-xs text-violet-600 mt-0.5">Contactez-nous pour mettre à niveau votre plan.</p>
                </div>
                <a
                    href="mailto:contact@fisca.bf?subject=Demande%20upgrade%20plan"
                    className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                >
                    <Briefcase className="w-4 h-4" />
                    Nous contacter
                </a>
            </div>
        </div>
    );
}
