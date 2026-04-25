import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import type { AuditLog, PaginatedResponse } from '../../types';

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function formatDetails(details: unknown): string {
    if (details == null) return '-';
    if (typeof details === 'string') return details || '-';
    try {
        return JSON.stringify(details);
    } catch {
        return '[details non affichables]';
    }
}

export default function AdminObservabilityPage() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [action, setAction] = useState('');
    const [targetType, setTargetType] = useState('all');
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const { data, isLoading } = useQuery<PaginatedResponse<AuditLog>>({
        queryKey: ['admin-observability', page, limit, action, targetType, search, from, to],
        queryFn: () =>
            adminApi.observability({
                page,
                limit,
                action: action || undefined,
                target_type: targetType,
                search: search || undefined,
                from: from || undefined,
                to: to || undefined,
            }).then((r) => r.data),
    });

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
                <div className="lg:col-span-2">
                    <label className="text-xs text-gray-500">Recherche</label>
                    <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Action</label>
                    <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Target</label>
                    <input value={targetType === 'all' ? '' : targetType} onChange={(e) => { setTargetType(e.target.value || 'all'); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Du</label>
                    <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Au</label>
                    <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Taille</label>
                    <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm">
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
                <button
                    onClick={async () => {
                        const res = await adminApi.exportObservability({
                            action: action || undefined,
                            target_type: targetType,
                            search: search || undefined,
                            from: from || undefined,
                            to: to || undefined,
                        });
                        downloadBlob(res.data, 'admin-observability.csv');
                    }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                    Export CSV
                </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl overflow-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-gray-500 text-xs">
                            <th className="text-left px-3 py-2">Date</th>
                            <th className="text-left px-3 py-2">Admin</th>
                            <th className="text-left px-3 py-2">Action</th>
                            <th className="text-left px-3 py-2">Target</th>
                            <th className="text-left px-3 py-2">ID cible</th>
                            <th className="text-left px-3 py-2">Détails</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && (data?.items ?? []).map((l) => (
                            <tr key={l.id} className="border-t border-gray-50">
                                <td className="px-3 py-2 text-xs text-gray-500">{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                                <td className="px-3 py-2">{l.admin_email}</td>
                                <td className="px-3 py-2">{l.action}</td>
                                <td className="px-3 py-2">{l.target_type}</td>
                                <td className="px-3 py-2 text-xs">{l.target_id || '-'}</td>
                                <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[280px]">{formatDetails(l.details)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{data?.total ?? 0} événement(s)</span>
                <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40">Préc.</button>
                    <span>Page {data?.page ?? page} / {data?.pages ?? 1}</span>
                    <button disabled={(data?.page ?? page) >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)} className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40">Suiv.</button>
                </div>
            </div>
        </div>
    );
}

