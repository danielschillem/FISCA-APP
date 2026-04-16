import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import type { AdminStats } from '../../types';
import {
    Users, Building2, TrendingUp, AlertTriangle, UserCheck, Clock,
    DollarSign, Package, Activity, ArrowUp,
} from 'lucide-react';

interface KpiProps {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.FC<{ className?: string }>;
    borderColor: string;
    iconBg: string;
    iconColor: string;
    trend?: string;
}

function KpiCard({ label, value, sub, icon: Icon, borderColor, iconBg, iconColor, trend }: KpiProps) {
    return (
        <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow p-5`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
                </div>
                <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
            </div>
            {trend && (
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                    <ArrowUp className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">{trend}</span>
                </div>
            )}
        </div>
    );
}

function PlanBar({ label, count, total, color, dotColor }: {
    label: string; count: number; total: number; color: string; dotColor: string;
}) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-sm text-gray-700 font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{count} utilisateur{count > 1 ? 's' : ''}</span>
                    <span className="text-xs font-semibold text-gray-700 w-10 text-right">{pct}%</span>
                </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

export default function AdminDashboardPage() {
    const { data: stats, isLoading } = useQuery<AdminStats>({
        queryKey: ['admin-stats'],
        queryFn: () => adminApi.stats().then(r => r.data),
        refetchInterval: 60_000,
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div><Skeleton className="h-6 w-48 mb-2" /><Skeleton className="h-4 w-64" /></div>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const mrr = stats.estimated_mrr.toLocaleString('fr-FR');
    const totalPlanned = stats.plan_starter + stats.plan_pro + stats.plan_enterprise;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Vue d'ensemble</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Statistiques globales de la plateforme FISCA</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-1.5">
                    <Activity className="w-3.5 h-3.5 text-green-500 animate-pulse" />
                    Actualisation auto toutes les 60s
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <KpiCard label="Utilisateurs" value={stats.total_users} sub="comptes inscrits"
                    icon={Users} borderColor="border-l-blue-500" iconBg="bg-blue-50" iconColor="text-blue-600"
                    trend={`+${stats.new_users_last30d} ce mois-ci`} />
                <KpiCard label="Comptes actifs" value={stats.active_users} sub={`${stats.suspended_users} suspendu(s)`}
                    icon={UserCheck} borderColor="border-l-emerald-500" iconBg="bg-emerald-50" iconColor="text-emerald-600" />
                <KpiCard label="Periode d'essai" value={stats.trial_users} sub="utilisateurs en trial"
                    icon={Clock} borderColor="border-l-amber-400" iconBg="bg-amber-50" iconColor="text-amber-600" />
                <KpiCard label="Societes" value={stats.total_companies} sub={`${stats.active_companies} active(s)`}
                    icon={Building2} borderColor="border-l-purple-500" iconBg="bg-purple-50" iconColor="text-purple-600" />
                <KpiCard label="Inscriptions (30j)" value={stats.new_users_last30d} sub="nouveaux utilisateurs"
                    icon={TrendingUp} borderColor="border-l-indigo-500" iconBg="bg-indigo-50" iconColor="text-indigo-600" />
                <KpiCard label="Suspendus" value={stats.suspended_users} sub="acces bloque"
                    icon={AlertTriangle} borderColor="border-l-red-500" iconBg="bg-red-50" iconColor="text-red-600" />
                <KpiCard label="Plan Pro" value={stats.plan_pro} sub={`sur ${totalPlanned} utilisateurs`}
                    icon={Package} borderColor="border-l-sky-500" iconBg="bg-sky-50" iconColor="text-sky-600" />
                <KpiCard label="Plan Enterprise" value={stats.plan_enterprise} sub={`sur ${totalPlanned} utilisateurs`}
                    icon={Package} borderColor="border-l-green-600" iconBg="bg-green-50" iconColor="text-green-700" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <DollarSign className="w-4 h-4 text-green-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-300">Revenu mensuel estime</p>
                    </div>
                    <p className="text-4xl font-bold tabular-nums text-white">{mrr}</p>
                    <p className="text-sm text-slate-400 mt-1">FCFA / mois</p>
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-slate-500">Pro x 15 000 + Enterprise x 50 000 FCFA</p>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-semibold text-gray-800">Repartition par plan</h3>
                        <span className="text-xs text-gray-400">{totalPlanned} utilisateurs</span>
                    </div>
                    <div className="space-y-4">
                        <PlanBar label="Starter" count={stats.plan_starter} total={totalPlanned} color="bg-slate-400" dotColor="bg-slate-400" />
                        <PlanBar label="Pro" count={stats.plan_pro} total={totalPlanned} color="bg-sky-500" dotColor="bg-sky-500" />
                        <PlanBar label="Enterprise" count={stats.plan_enterprise} total={totalPlanned} color="bg-emerald-500" dotColor="bg-emerald-500" />
                    </div>
                    <div className="flex gap-6 mt-5 pt-4 border-t border-gray-50">
                        <div>
                            <p className="text-xs text-gray-400">Taux actifs</p>
                            <p className="text-sm font-bold text-gray-800">
                                {stats.total_users > 0 ? Math.round((stats.active_users / stats.total_users) * 100) : 0}%
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Taux trial</p>
                            <p className="text-sm font-bold text-amber-600">
                                {stats.total_users > 0 ? Math.round((stats.trial_users / stats.total_users) * 100) : 0}%
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Societes/User</p>
                            <p className="text-sm font-bold text-gray-800">
                                {stats.total_users > 0 ? (stats.total_companies / stats.total_users).toFixed(1) : '0'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}