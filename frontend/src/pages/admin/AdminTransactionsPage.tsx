import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import type { AdminTransactionItem, PaginatedResponse } from '../../types';

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

export default function AdminTransactionsPage() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [status, setStatus] = useState('all');
    const [docType, setDocType] = useState('all');
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const { data, isLoading } = useQuery<PaginatedResponse<AdminTransactionItem>>({
        queryKey: ['admin-transactions', page, limit, status, docType, search, from, to],
        queryFn: () =>
            adminApi.transactions({
                page,
                limit,
                status,
                document_type: docType,
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
                    <label className="text-xs text-gray-500">Statut</label>
                    <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm">
                        <option value="all">Tous</option>
                        <option value="completed">completed</option>
                        <option value="pending">pending</option>
                        <option value="failed">failed</option>
                        <option value="expired">expired</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500">Document</label>
                    <input value={docType === 'all' ? '' : docType} onChange={(e) => { setDocType(e.target.value || 'all'); setPage(1); }} placeholder="iuts, tva..." className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
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
                        const res = await adminApi.exportTransactions({
                            status,
                            document_type: docType,
                            search: search || undefined,
                            from: from || undefined,
                            to: to || undefined,
                        });
                        downloadBlob(res.data, 'admin-transactions.csv');
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
                            <th className="text-left px-3 py-2">Société</th>
                            <th className="text-left px-3 py-2">Document</th>
                            <th className="text-left px-3 py-2">Statut</th>
                            <th className="text-right px-3 py-2">Montant</th>
                            <th className="text-right px-3 py-2">Frais</th>
                            <th className="text-left px-3 py-2">Téléphone</th>
                            <th className="text-left px-3 py-2">OM Réf.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && (data?.items ?? []).map((p) => (
                            <tr key={p.id} className="border-t border-gray-50">
                                <td className="px-3 py-2 text-xs text-gray-500">{new Date(p.created_at).toLocaleString('fr-FR')}</td>
                                <td className="px-3 py-2">{p.company_name}</td>
                                <td className="px-3 py-2 text-xs">{p.document_type} / {p.document_id}</td>
                                <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.statut === 'completed' ? 'bg-emerald-100 text-emerald-700' : p.statut === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{p.statut}</span>
                                </td>
                                <td className="px-3 py-2 text-right font-medium">{fmt(p.total)} FCFA</td>
                                <td className="px-3 py-2 text-right text-gray-600">{fmt(p.frais)} FCFA</td>
                                <td className="px-3 py-2">{p.telephone}</td>
                                <td className="px-3 py-2 text-xs text-gray-500">{p.om_reference || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{data?.total ?? 0} résultat(s)</span>
                <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40">Préc.</button>
                    <span>Page {data?.page ?? page} / {data?.pages ?? 1}</span>
                    <button disabled={(data?.page ?? page) >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)} className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40">Suiv.</button>
                </div>
            </div>
        </div>
    );
}

