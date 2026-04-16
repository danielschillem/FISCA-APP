import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import type { AdminCompany } from '../../types';
import { Search, ChevronDown, X, ShieldOff, ShieldCheck, Building2 } from 'lucide-react';

function CompanyAvatar({ name }: { name: string }) {
    const initials = name.slice(0, 2).toUpperCase();
    const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500', 'bg-pink-500'];
    const color = colors[name.charCodeAt(0) % colors.length];
    return (
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
            {initials}
        </div>
    );
}

export default function AdminCompaniesPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [reason, setReason] = useState('');
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const { data: companies = [], isLoading } = useQuery<AdminCompany[]>({
        queryKey: ['admin-companies', search, status],
        queryFn: () => adminApi.listCompanies({ search, status }).then(r => r.data),
        staleTime: 10_000,
    });

    const toggleStatus = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
            adminApi.setCompanyStatus(id, is_active, reason),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-companies'] });
            setReason('');
            setConfirmId(null);
        },
    });

    const hasFilters = search || status;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Societes</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{companies.length} resultat(s)</p>
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-wrap gap-2 shadow-sm">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Nom, email ou IFU..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors"
                    />
                </div>
                <div className="relative">
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
                        <option value="">Tous statuts</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspendue</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
                {hasFilters && (
                    <button onClick={() => { setSearch(''); setStatus(''); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <X className="w-3.5 h-3.5" />
                        Effacer
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Societe</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">IFU</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Secteur</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Proprietaire</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Statut</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} className="border-b border-gray-50">
                                    <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" /><div className="h-3 w-36 bg-gray-100 rounded animate-pulse" /></div></td>
                                    <td className="px-4 py-4"><div className="h-3 w-20 bg-gray-100 rounded animate-pulse" /></td>
                                    <td className="px-4 py-4"><div className="h-3 w-24 bg-gray-100 rounded animate-pulse" /></td>
                                    <td className="px-4 py-4"><div className="h-3 w-32 bg-gray-100 rounded animate-pulse" /></td>
                                    <td className="px-4 py-4"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" /></td>
                                    <td className="px-4 py-4" />
                                </tr>
                            ))
                        ) : companies.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-16 text-center">
                                    <Building2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                    <p className="text-gray-400 text-sm">Aucune societe trouvee</p>
                                </td>
                            </tr>
                        ) : (
                            companies.map(c => (
                                <tr key={c.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <CompanyAvatar name={c.nom} />
                                            <span className="font-medium text-gray-800 text-sm">{c.nom}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                            {c.ifu || ':'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{c.secteur || ':'}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-gray-600 truncate max-w-40 block">{c.user_email}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${c.is_active
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                            {c.is_active ? 'Active' : 'Suspendue'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {confirmId === c.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Motif..."
                                                    value={reason}
                                                    onChange={e => setReason(e.target.value)}
                                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-green-500"
                                                />
                                                <button
                                                    onClick={() => toggleStatus.mutate({ id: c.id, is_active: !c.is_active })}
                                                    disabled={toggleStatus.isPending}
                                                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 ${c.is_active
                                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        }`}
                                                >
                                                    {c.is_active ? <ShieldOff className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                                                    {c.is_active ? 'Suspendre' : 'Activer'}
                                                </button>
                                                <button onClick={() => setConfirmId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmId(c.id)}
                                                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors opacity-0 group-hover:opacity-100 ${c.is_active
                                                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                                        : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                                                    }`}
                                            >
                                                {c.is_active ? 'Suspendre' : 'Activer'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}