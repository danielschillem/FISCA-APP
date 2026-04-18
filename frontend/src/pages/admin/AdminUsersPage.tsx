import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { AdminUser, License, User } from '../../types';
import {
    Search, X, ChevronDown, MoreHorizontal,
    ShieldOff, ShieldCheck, KeyRound, Edit3,
    Building2, Calendar, User as UserIcon, RefreshCw, Eye,
} from 'lucide-react';

// --- Constants ----------------------------------------------------------------
const PLAN_STYLES: Record<string, { label: string; badge: string }> = {
    starter: { label: 'Starter', badge: 'bg-slate-100 text-slate-600 border border-slate-200' },
    pro: { label: 'Pro', badge: 'bg-sky-100 text-sky-700 border border-sky-200' },
    enterprise: { label: 'Enterprise', badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    custom: { label: 'Custom', badge: 'bg-purple-100 text-purple-700 border border-purple-200' },
};

const STATUS_STYLES: Record<string, string> = {
    trial: 'bg-amber-50 text-amber-700 border border-amber-200',
    active: 'bg-green-50 text-green-700 border border-green-200',
    suspended: 'bg-red-50 text-red-700 border border-red-200',
    expired: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
    trial: 'Essai', active: 'Actif', suspended: 'Suspendu', expired: 'Expire',
};

// --- Avatar -------------------------------------------------------------------
function Avatar({ email }: { email: string }) {
    const initials = email.slice(0, 2).toUpperCase();
    const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
    const color = colors[email.charCodeAt(0) % colors.length];
    return (
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
            {initials}
        </div>
    );
}

// --- License Form Modal -------------------------------------------------------
function LicenseModal({ userId, license, onClose }: { userId: string; license?: License; onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        plan: license?.plan ?? 'starter',
        status: license?.status ?? 'trial',
        max_companies: license?.max_companies ?? 1,
        max_employees: license?.max_employees ?? 50,
        expires_at: license?.expires_at ? license.expires_at.slice(0, 10) : '',
        notes: license?.notes ?? '',
    });

    const save = useMutation({
        mutationFn: () => adminApi.upsertLicense(userId, {
            ...form,
            expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Gestion de la licence</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Plan</label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                                {Object.entries(PLAN_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Statut</label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as License['status'] }))}>
                                <option value="trial">Essai</option>
                                <option value="active">Actif</option>
                                <option value="suspended">Suspendu</option>
                                <option value="expired">Expire</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Max societes</label>
                            <input type="number" min={1} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                value={form.max_companies} onChange={e => setForm(f => ({ ...f, max_companies: +e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Max employes</label>
                            <input type="number" min={1} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                value={form.max_employees} onChange={e => setForm(f => ({ ...f, max_employees: +e.target.value }))} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Expiration</label>
                        <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
                        <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" rows={2}
                            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                </div>
                <div className="flex gap-2 p-6 pt-0 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
                    <button onClick={() => save.mutate()} disabled={save.isPending}
                        className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                        {save.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- User Detail Slide-Over ---------------------------------------------------
function UserDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const { startImpersonate } = useAuthStore();
    const [licenseOpen, setLicenseOpen] = useState(false);
    const [reason, setReason] = useState('');

    const toggleStatus = useMutation({
        mutationFn: () => adminApi.setUserStatus(user.id, !user.is_active, reason),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
    });

    const resetPwd = useMutation({
        mutationFn: () => adminApi.resetUserPassword(user.id),
    });

    const impersonate = useMutation({
        mutationFn: () => adminApi.impersonate(user.id),
        onSuccess: (res: { data: { token: string; user: User } }) => {
            startImpersonate(res.data.token, res.data.user as unknown as import('../../types').User);
            navigate('/dashboard');
        },
    });

    return (
        <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Detail utilisateur</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* User info */}
                    <div className="flex items-center gap-3">
                        <Avatar email={user.email} />
                        <div>
                            <p className="font-medium text-gray-900 text-sm">{user.email}</p>
                            <p className="text-xs text-gray-400">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2">
                        {user.license && (
                            <>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PLAN_STYLES[user.plan]?.badge ?? 'bg-gray-100 text-gray-600'}`}>
                                    {PLAN_STYLES[user.plan]?.label ?? user.plan}
                                </span>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[user.license.status] ?? 'bg-gray-100 text-gray-500'}`}>
                                    {STATUS_LABELS[user.license.status] ?? user.license.status}
                                </span>
                            </>
                        )}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${user.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {user.is_active ? 'Compte actif' : 'Compte suspendu'}
                        </span>
                    </div>

                    {/* Info grid */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Inscrit le</span>
                            <span className="ml-auto font-medium text-gray-700">
                                {new Date(user.created_at).toLocaleDateString('fr-FR')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Societes</span>
                            <span className="ml-auto font-medium text-gray-700">{user.company_count}</span>
                        </div>
                        {user.license && (
                            <>
                                <div className="flex items-center gap-2 text-sm">
                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-500">Max employes</span>
                                    <span className="ml-auto font-medium text-gray-700">{user.license.max_employees}</span>
                                </div>
                                {user.license.expires_at && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-500">Expiration</span>
                                        <span className="ml-auto font-medium text-gray-700">
                                            {new Date(user.license.expires_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                )}
                                {user.license.notes && (
                                    <div className="pt-2 border-t border-gray-200">
                                        <p className="text-xs text-gray-400 mb-1">Notes</p>
                                        <p className="text-xs text-gray-600">{user.license.notes}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</p>
                        <button
                            onClick={() => impersonate.mutate()}
                            disabled={impersonate.isPending}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                            {impersonate.isPending
                                ? <RefreshCw className="w-4 h-4 animate-spin" />
                                : <Eye className="w-4 h-4" />
                            }
                            Inspecter (vue utilisateur)
                        </button>
                        <button
                            onClick={() => setLicenseOpen(true)}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Edit3 className="w-4 h-4 text-blue-500" />
                            Modifier la licence
                        </button>
                        <button
                            onClick={() => resetPwd.mutate()}
                            disabled={resetPwd.isPending}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            {resetPwd.isPending
                                ? <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                                : <KeyRound className="w-4 h-4 text-amber-500" />
                            }
                            {resetPwd.isSuccess ? 'Lien envoye !' : 'Reinitialiser mot de passe'}
                        </button>
                        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                            <input
                                type="text"
                                placeholder="Motif (optionnel)..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <button
                                onClick={() => toggleStatus.mutate()}
                                disabled={toggleStatus.isPending}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${user.is_active
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                    }`}
                            >
                                {user.is_active
                                    ? <ShieldOff className="w-4 h-4" />
                                    : <ShieldCheck className="w-4 h-4" />
                                }
                                {user.is_active ? 'Suspendre le compte' : 'Activer le compte'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {licenseOpen && (
                <LicenseModal userId={user.id} license={user.license} onClose={() => setLicenseOpen(false)} />
            )}
        </>
    );
}

// --- Table Row ----------------------------------------------------------------
function UserRow({ user, onSelect }: { user: AdminUser; onSelect: () => void }) {
    const plan = PLAN_STYLES[user.plan] ?? { label: user.plan, badge: 'bg-gray-100 text-gray-600' };
    const licStatus = user.license?.status;

    return (
        <tr className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors group">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar email={user.email} />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate max-w-48">{user.email}</p>
                        <p className="text-xs text-gray-400">{new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${plan.badge}`}>
                    {plan.label}
                </span>
            </td>
            <td className="px-4 py-3">
                {licStatus ? (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[licStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[licStatus] ?? licStatus}
                    </span>
                ) : (
                    <span className="text-xs text-gray-300">:</span>
                )}
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Building2 className="w-3.5 h-3.5 text-gray-300" />
                    {user.company_count}
                </div>
            </td>
            <td className="px-4 py-3">
                <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} title={user.is_active ? 'Actif' : 'Suspendu'} />
            </td>
            <td className="px-4 py-3">
                <button
                    onClick={onSelect}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700 hover:bg-green-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    Actions
                </button>
            </td>
        </tr>
    );
}

// --- Main Page ----------------------------------------------------------------
export default function AdminUsersPage() {
    const [search, setSearch] = useState('');
    const [plan, setPlan] = useState('');
    const [status, setStatus] = useState('');
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    const { data: users = [], isLoading } = useQuery<AdminUser[]>({
        queryKey: ['admin-users', search, plan, status],
        queryFn: () => adminApi.listUsers({ search, plan, status }).then(r => r.data),
        staleTime: 10_000,
    });

    const hasFilters = search || plan || status;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Utilisateurs</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{users.length} resultat(s)</p>
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-wrap gap-2 shadow-sm">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors"
                    />
                </div>
                <div className="relative">
                    <select value={plan} onChange={e => setPlan(e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
                        <option value="">Tous les plans</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative">
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
                        <option value="">Tous statuts</option>
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                        <option value="trial">Essai</option>
                        <option value="expired">Expire</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
                {hasFilters && (
                    <button onClick={() => { setSearch(''); setPlan(''); setStatus(''); }}
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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Utilisateur</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Licence</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Societes</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Etat</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-20"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} className="border-b border-gray-50">
                                    <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" /><div className="space-y-1.5"><div className="h-3 w-40 bg-gray-100 rounded animate-pulse" /><div className="h-2.5 w-24 bg-gray-100 rounded animate-pulse" /></div></div></td>
                                    <td className="px-4 py-4"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" /></td>
                                    <td className="px-4 py-4"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" /></td>
                                    <td className="px-4 py-4"><div className="h-3 w-8 bg-gray-100 rounded animate-pulse" /></td>
                                    <td className="px-4 py-4"><div className="w-2 h-2 rounded-full bg-gray-100 animate-pulse" /></td>
                                    <td className="px-4 py-4" />
                                </tr>
                            ))
                        ) : users.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400 text-sm">Aucun utilisateur trouve</td></tr>
                        ) : (
                            users.map(u => (
                                <UserRow key={u.id} user={u} onSelect={() => setSelectedUser(u)} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Slide-over drawer */}
            {selectedUser && (
                <UserDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
            )}
        </div>
    );
}