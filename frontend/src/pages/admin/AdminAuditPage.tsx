import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import type { AuditLog } from '../../types';
import { ChevronLeft, ChevronRight, Shield, UserX, UserCheck, Key, CreditCard, Building, ScrollText } from 'lucide-react';

// --- Action config ---------------------------------------------------------
const ACTION_CONFIG: Record<string, { icon: typeof Shield; dot: string; badge: string; label: string }> = {
    'user.suspend': { icon: UserX, dot: 'bg-red-400', badge: 'bg-red-50 text-red-700 border-red-200', label: 'Suspension' },
    'user.activate': { icon: UserCheck, dot: 'bg-green-400', badge: 'bg-green-50 text-green-700 border-green-200', label: 'Activation' },
    'user.plan_change': { icon: CreditCard, dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Changement plan' },
    'user.reset_password': { icon: Key, dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Reset mdp' },
    'license.upsert': { icon: Shield, dot: 'bg-purple-400', badge: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Licence' },
    'company.suspend': { icon: Building, dot: 'bg-red-400', badge: 'bg-red-50 text-red-700 border-red-200', label: 'Soc. suspendue' },
    'company.activate': { icon: Building, dot: 'bg-green-400', badge: 'bg-green-50 text-green-700 border-green-200', label: 'Soc. activee' },
};

const DEFAULT_CONFIG = { icon: ScrollText, dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Action' };

function fmt(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
}

export default function AdminAuditPage() {
    const [offset, setOffset] = useState(0);
    const limit = 30;

    const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
        queryKey: ['admin-audit', offset],
        queryFn: () => adminApi.listAudit(limit, offset).then(r => r.data),
        staleTime: 10_000,
    });

    const hasPrev = offset > 0;
    const hasNext = logs.length === limit;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Journal d'audit</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Toutes les actions effectuees par les administrateurs</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setOffset(o => Math.max(0, o - limit))}
                        disabled={!hasPrev}
                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 min-w-20 text-center">
                        {logs.length > 0 ? `${offset + 1}-${offset + logs.length}` : '0 resultat'}
                    </span>
                    <button
                        onClick={() => setOffset(o => o + limit)}
                        disabled={!hasNext}
                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-6 space-y-5">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2 pt-1">
                                    <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                                    <div className="h-2.5 w-32 bg-gray-100 rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-16 text-center">
                        <ScrollText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Aucun log d'audit</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {logs.map((log, idx) => {
                            const cfg = ACTION_CONFIG[log.action] ?? DEFAULT_CONFIG;
                            const Icon = cfg.icon;
                            const { date, time } = fmt(log.created_at);
                            const isFirst = idx === 0;
                            const prevDate = idx > 0 ? fmt(logs[idx - 1].created_at).date : null;
                            const showDate = isFirst || prevDate !== date;

                            return (
                                <div key={log.id}>
                                    {showDate && (
                                        <div className="px-6 py-2 bg-gray-50/60 border-b border-gray-100">
                                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{date}</span>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/40 transition-colors">
                                        {/* Timeline dot + icon */}
                                        <div className="shrink-0 flex flex-col items-center gap-1 mt-0.5">
                                            <div className={`w-7 h-7 rounded-full ${cfg.dot} flex items-center justify-center opacity-90`}>
                                                <Icon className="w-3.5 h-3.5 text-white" />
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${cfg.badge}`}>
                                                    {cfg.label}
                                                </span>
                                                <span className="text-xs font-mono text-gray-400 hidden sm:inline">{log.action}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                                                <span>
                                                    Par <span className="font-medium text-gray-700">{log.admin_email}</span>
                                                </span>
                                                {log.target_type && (
                                                    <span>
                                                        Sur <span className="font-medium text-gray-700">{log.target_type}</span>
                                                        {log.target_id && (
                                                            <span className="font-mono text-gray-400"> {log.target_id.slice(0, 8)}...</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            {log.details && Object.keys(log.details).length > 0 && (
                                                <div className="mt-1.5 text-xs text-gray-400 font-mono bg-gray-50 rounded px-2 py-1 max-w-lg truncate">
                                                    {JSON.stringify(log.details)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Time */}
                                        <span className="text-xs text-gray-400 shrink-0 pt-0.5">{time}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}