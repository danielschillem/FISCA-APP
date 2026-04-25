import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import type { AdminFinanceOverview } from '../../types';

function fmt(n: number) {
    return Math.round(n || 0).toLocaleString('fr-FR');
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function AdminFinancePage() {
    const [windowDays, setWindowDays] = useState<30 | 90 | 180 | 365>(180);
    const { data, isLoading } = useQuery<AdminFinanceOverview>({
        queryKey: ['admin-finance', windowDays],
        queryFn: () => adminApi.finance({ window_days: windowDays }).then((r) => r.data),
    });

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Fenêtre</label>
                    <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value) as 30 | 90 | 180 | 365)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm">
                        <option value={30}>30 jours</option>
                        <option value={90}>90 jours</option>
                        <option value={180}>180 jours</option>
                        <option value={365}>365 jours</option>
                    </select>
                </div>
                <button
                    onClick={async () => {
                        const res = await adminApi.exportFinance({ window_days: windowDays });
                        downloadBlob(res.data, `admin-finance-${windowDays}j.csv`);
                    }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                    Export CSV
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Encaissements</p>
                    <p className="text-xl font-bold text-gray-900">{fmt(data?.total_revenue ?? 0)} FCFA</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Frais collectés</p>
                    <p className="text-xl font-bold text-emerald-700">{fmt(data?.total_fees ?? 0)} FCFA</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Transactions</p>
                    <p className="text-xl font-bold text-gray-900">{data?.tx_count ?? 0}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Panier moyen</p>
                    <p className="text-xl font-bold text-gray-900">{fmt(data?.avg_ticket ?? 0)} FCFA</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Évolution mensuelle</h3>
                    {isLoading ? <p className="text-sm text-gray-400">Chargement…</p> : (
                        <div className="space-y-2">
                            {(data?.monthly ?? []).map((m) => (
                                <div key={m.month} className="grid grid-cols-4 text-sm border-b border-gray-50 pb-1">
                                    <span>{m.month}</span>
                                    <span className="text-right text-gray-600">{m.count} tx</span>
                                    <span className="text-right">{fmt(m.total)} FCFA</span>
                                    <span className="text-right text-emerald-700">+{fmt(m.frais)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Répartition par document</h3>
                    {isLoading ? <p className="text-sm text-gray-400">Chargement…</p> : (
                        <div className="space-y-2">
                            {(data?.by_document ?? []).map((d) => (
                                <div key={d.document_type} className="grid grid-cols-3 text-sm border-b border-gray-50 pb-1">
                                    <span>{d.document_type}</span>
                                    <span className="text-right text-gray-600">{d.count} tx</span>
                                    <span className="text-right">{fmt(d.total)} FCFA</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

