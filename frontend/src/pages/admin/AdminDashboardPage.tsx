import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import type { AdminOpsOverview, AdminStats } from '../../types';
import {
    Users, Building2, TrendingUp, AlertTriangle, UserCheck,
    DollarSign, Activity, ArrowUp, Receipt, ShieldAlert, FileClock,
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
    onClick?: () => void;
}

function KpiCard({ label, value, sub, icon: Icon, borderColor, iconBg, iconColor, trend, onClick }: KpiProps) {
    const clickable = Boolean(onClick);
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left bg-white rounded-xl border border-gray-100 border-l-4 ${borderColor} shadow-sm transition-shadow p-5 ${clickable ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
        >
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
        </button>
    );
}

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function AdminDashboardPage() {
    const [windowDays, setWindowDays] = useState<7 | 30 | 90 | 180>(30);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed' | 'expired'>('all');
    const { data: stats, isLoading, isError: statsError } = useQuery<AdminStats>({
        queryKey: ['admin-stats'],
        queryFn: () => adminApi.stats().then(r => r.data),
        refetchInterval: 60_000,
    });
    const { data: ops, isError: opsError } = useQuery<AdminOpsOverview>({
        queryKey: ['admin-ops-overview', windowDays],
        queryFn: () => adminApi.opsOverview(windowDays).then(r => r.data),
        refetchInterval: 60_000,
    });
    const filteredPayments = useMemo(() => {
        const list = ops?.recent_payments ?? [];
        if (paymentStatusFilter === 'all') return list;
        return list.filter((p) => p.statut === paymentStatusFilter);
    }, [ops?.recent_payments, paymentStatusFilter]);

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

    if (statsError) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">Impossible de charger le dashboard super_admin.</p>
                <p>Vérifie que le backend API est démarré et accessible, puis recharge la page.</p>
            </div>
        );
    }
    if (!stats) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Données admin indisponibles pour le moment.
            </div>
        );
    }

    const fmt = (n: number) => Math.round(n || 0).toLocaleString('fr-FR');
    const growth = Number(ops?.payments_growth_pct ?? 0);
    const failCount = (ops?.payments_failed_count ?? 0) + (ops?.payments_expired_count ?? 0);
    const failRate = (ops?.payments_total_count ?? 0) > 0 ? (failCount / (ops?.payments_total_count ?? 0)) * 100 : 0;

    const exportFinanceCsv = () => {
        downloadCsv(`fisca-finance-${windowDays}j.csv`, [
            ['Mois', 'Transactions', 'Total FCFA', 'Frais FCFA'],
            ...((ops?.monthly_revenue ?? []).map((m) => [m.month, m.count, Math.round(m.total), Math.round(m.frais)])),
        ]);
    };
    const exportPaymentsCsv = () => {
        downloadCsv(`fisca-transactions-om-${windowDays}j.csv`, [
            ['Date', 'Société', 'Email', 'Document', 'Statut', 'Montant FCFA', 'Frais FCFA', 'Téléphone'],
            ...filteredPayments.map((p) => [
                new Date(p.created_at).toLocaleString('fr-FR'),
                p.company_name,
                p.user_email,
                p.document_type,
                p.statut,
                Math.round(p.total),
                Math.round(p.frais),
                p.telephone,
            ]),
        ]);
    };
    const exportAuditCsv = () => {
        downloadCsv(`fisca-audit-${windowDays}j.csv`, [
            ['Date', 'Admin', 'Action', 'Target Type', 'Target ID'],
            ...((ops?.recent_audits ?? []).map((a) => [
                new Date(a.created_at).toLocaleString('fr-FR'),
                a.admin_email,
                a.action,
                a.target_type,
                a.target_id ?? '-',
            ])),
        ]);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">FISCA Gestion - Vue d'ensemble</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Compteurs, métriques, traçabilité, transactions OM, finance et croissance</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={windowDays}
                        onChange={(e) => setWindowDays(Number(e.target.value) as 7 | 30 | 90 | 180)}
                        className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5"
                    >
                        <option value={7}>Fenêtre 7 jours</option>
                        <option value={30}>Fenêtre 30 jours</option>
                        <option value={90}>Fenêtre 90 jours</option>
                        <option value={180}>Fenêtre 180 jours</option>
                    </select>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-1.5">
                        <Activity className="w-3.5 h-3.5 text-green-500 animate-pulse" />
                        Actualisation auto toutes les 60s
                    </div>
                </div>
            </div>
            {opsError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Les métriques opérationnelles ne sont pas disponibles pour le moment (transactions/audit).
                </div>
            )}

            {(failRate > 10 || growth < 0 || (ops?.payments_pending_count ?? 0) > 50) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {failRate > 10 && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            <p className="font-semibold">Alerte taux d’échec OM</p>
                            <p>{failRate.toFixed(1)}% des transactions sont échouées/expirées.</p>
                        </div>
                    )}
                    {growth < 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                            <p className="font-semibold">Alerte croissance</p>
                            <p>La croissance des transactions est négative ({growth.toFixed(1)}%).</p>
                        </div>
                    )}
                    {(ops?.payments_pending_count ?? 0) > 50 && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                            <p className="font-semibold">Alerte transactions en attente</p>
                            <p>{ops?.payments_pending_count ?? 0} paiements OM sont encore pending.</p>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <KpiCard label="Utilisateurs" value={stats.total_users} sub="comptes inscrits"
                    icon={Users} borderColor="border-l-blue-500" iconBg="bg-blue-50" iconColor="text-blue-600"
                    trend={`+${stats.new_users_last30d} ce mois-ci`} />
                <KpiCard label="Comptes actifs" value={stats.active_users} sub={`${stats.suspended_users} suspendu(s)`}
                    icon={UserCheck} borderColor="border-l-emerald-500" iconBg="bg-emerald-50" iconColor="text-emerald-600" />
                <KpiCard label="Societes" value={stats.total_companies} sub={`${stats.active_companies} active(s)`}
                    icon={Building2} borderColor="border-l-purple-500" iconBg="bg-purple-50" iconColor="text-purple-600" />
                <KpiCard label="Inscriptions (30j)" value={stats.new_users_last30d} sub="nouveaux utilisateurs"
                    icon={TrendingUp} borderColor="border-l-indigo-500" iconBg="bg-indigo-50" iconColor="text-indigo-600" />
                <KpiCard label="Suspendus" value={stats.suspended_users} sub="acces bloque"
                    icon={AlertTriangle} borderColor="border-l-red-500" iconBg="bg-red-50" iconColor="text-red-600" />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-slate-500">Taux actifs</p>
                        <p className="text-sm font-bold text-slate-800">
                            {stats.total_users > 0 ? Math.round((stats.active_users / stats.total_users) * 100) : 0}%
                        </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-slate-500">Taux suspendus</p>
                        <p className="text-sm font-bold text-slate-800">
                            {stats.total_users > 0 ? Math.round((stats.suspended_users / stats.total_users) * 100) : 0}%
                        </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-slate-500">Sociétés actives</p>
                        <p className="text-sm font-bold text-slate-800">
                            {stats.total_companies > 0 ? Math.round((stats.active_companies / stats.total_companies) * 100) : 0}%
                        </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-slate-500">Sociétés / utilisateur</p>
                        <p className="text-sm font-bold text-slate-800">
                            {stats.total_users > 0 ? (stats.total_companies / stats.total_users).toFixed(1) : '0'}
                        </p>
                    </div>
                </div>
            </div>

            {/* FISCA Gestion: paiements + traçabilité + croissance */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Transactions OM" value={ops?.payments_total_count ?? 0} sub="volume total"
                    icon={Receipt} borderColor="border-l-cyan-500" iconBg="bg-cyan-50" iconColor="text-cyan-700"
                    onClick={() => setPaymentStatusFilter('all')} />
                <KpiCard label="Transactions réussies" value={ops?.payments_completed_count ?? 0}
                    sub={`${ops?.payments_pending_count ?? 0} en attente`}
                    icon={UserCheck} borderColor="border-l-emerald-500" iconBg="bg-emerald-50" iconColor="text-emerald-700"
                    onClick={() => setPaymentStatusFilter('completed')} />
                <KpiCard label="Encaissements OM" value={`${fmt(ops?.payments_volume ?? 0)} FCFA`}
                    sub={`Frais collectés: ${fmt(ops?.fees_collected ?? 0)} FCFA`}
                    icon={DollarSign} borderColor="border-l-lime-600" iconBg="bg-lime-50" iconColor="text-lime-700" />
                <KpiCard label={`Croissance transactions (${windowDays}j)`} value={`${growth.toFixed(1)} %`}
                    sub={`${ops?.payments_last30d_count ?? 0} vs ${ops?.payments_prev30d_count ?? 0}`}
                    icon={TrendingUp} borderColor="border-l-indigo-600" iconBg="bg-indigo-50" iconColor="text-indigo-700" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-800">Finance & comptabilité</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={exportFinanceCsv} className="text-xs border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50">Exporter CSV</button>
                            <span className="text-xs text-gray-400">6 derniers mois</span>
                        </div>
                    </div>
                    <div className="space-y-2 mb-4">
                        {(ops?.monthly_revenue ?? []).map((m) => (
                            <div key={m.month} className="grid grid-cols-4 text-sm border-b border-gray-50 pb-1">
                                <span className="text-gray-600">{m.month}</span>
                                <span className="text-right text-gray-700">{m.count} tx</span>
                                <span className="text-right font-medium text-gray-900">{fmt(m.total)} FCFA</span>
                                <span className="text-right text-emerald-700">+{fmt(m.frais)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-gray-50 p-3">
                            <p className="text-gray-500">Panier moyen</p>
                            <p className="text-sm font-bold text-gray-900">{fmt(ops?.avg_ticket ?? 0)} FCFA</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                            <p className="text-gray-500">Échecs/expirés</p>
                            <p className="text-sm font-bold text-red-700">{(ops?.payments_failed_count ?? 0) + (ops?.payments_expired_count ?? 0)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-800">Traçabilité & journalisation</h3>
                        <ShieldAlert className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                        <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-slate-500">24h</p>
                            <p className="text-base font-bold text-slate-800">{ops?.audit_last24h ?? 0}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-slate-500">7 jours</p>
                            <p className="text-base font-bold text-slate-800">{ops?.audit_last7d ?? 0}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-slate-500">30 jours</p>
                            <p className="text-base font-bold text-slate-800">{ops?.audit_last30d ?? 0}</p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        {(ops?.top_document_types ?? []).map((t) => (
                            <div key={t.document_type} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{t.document_type}</span>
                                <span className="text-gray-500">{t.count} tx</span>
                                <span className="font-medium text-gray-900">{fmt(t.total)} FCFA</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-800">Transactions OM récentes</h3>
                        <div className="flex items-center gap-2">
                            <select
                                value={paymentStatusFilter}
                                onChange={(e) => setPaymentStatusFilter(e.target.value as 'all' | 'completed' | 'pending' | 'failed' | 'expired')}
                                className="text-xs border border-gray-200 rounded-md px-2 py-1"
                            >
                                <option value="all">Tous statuts</option>
                                <option value="completed">completed</option>
                                <option value="pending">pending</option>
                                <option value="failed">failed</option>
                                <option value="expired">expired</option>
                            </select>
                            <button onClick={exportPaymentsCsv} className="text-xs border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50">Exporter CSV</button>
                            <FileClock className="w-4 h-4 text-gray-500" />
                        </div>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-auto pr-1">
                        {filteredPayments.map((p) => (
                            <div key={p.id} className="rounded-lg border border-gray-100 p-2.5 text-xs">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-gray-900">{p.company_name}</p>
                                    <span className={`px-2 py-0.5 rounded-full ${p.statut === 'completed' ? 'bg-emerald-100 text-emerald-700' : p.statut === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        {p.statut}
                                    </span>
                                </div>
                                <p className="text-gray-500">{p.document_type} - {p.user_email}</p>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-gray-500">{new Date(p.created_at).toLocaleString('fr-FR')}</span>
                                    <span className="font-semibold text-gray-900">{fmt(p.total)} FCFA</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-800">Journal d’audit récent</h3>
                        <button onClick={exportAuditCsv} className="text-xs border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50">Exporter CSV</button>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-auto pr-1">
                        {(ops?.recent_audits ?? []).map((a) => (
                            <div key={a.id} className="rounded-lg border border-gray-100 p-2.5 text-xs">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-gray-900">{a.action}</p>
                                    <span className="text-gray-400">{new Date(a.created_at).toLocaleString('fr-FR')}</span>
                                </div>
                                <p className="text-gray-500">{a.admin_email} - {a.target_type}:{a.target_id ?? '-'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}