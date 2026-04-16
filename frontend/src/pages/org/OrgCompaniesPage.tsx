import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '../../lib/api';
import type { OrgMember, OrgCompany } from '../../types';
import { Building2, Shield, ShieldOff, ChevronDown, ChevronRight } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
    org_admin: 'Admin',
    comptable: 'Comptable',
    gestionnaire_rh: 'Gestionnaire RH',
    auditeur: 'Auditeur',
};

export default function OrgCompaniesPage() {
    const qc = useQueryClient();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [grantUserId, setGrantUserId] = useState<Record<string, string>>({});

    const { data: companies = [], isLoading: loadingCompanies } = useQuery<OrgCompany[]>({
        queryKey: ['org-companies'],
        queryFn: () => orgApi.listCompanies().then((r) => r.data),
    });

    const { data: members = [] } = useQuery<OrgMember[]>({
        queryKey: ['org-members'],
        queryFn: () => orgApi.listMembers().then((r) => r.data),
    });

    const grantMut = useMutation({
        mutationFn: ({ companyId, userId }: { companyId: string; userId: string }) =>
            orgApi.grantAccess(companyId, userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['org-companies'] }),
    });

    const revokeMut = useMutation({
        mutationFn: ({ companyId, userId }: { companyId: string; userId: string }) =>
            orgApi.revokeAccess(companyId, userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['org-companies'] }),
    });

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" /> Sociétés & Accès
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Gérez l'accès de vos membres à chaque société de l'organisation
                </p>
            </div>

            {loadingCompanies ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : companies.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-400">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Aucune société enregistrée</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {companies.map((company) => {
                        const isExpanded = expanded === company.id;
                        const memberIds = new Set(company.members.map((m) => m.user_id));
                        const available = members.filter((m) => !memberIds.has(m.id));

                        return (
                            <div key={company.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                {/* En-tête société */}
                                <button
                                    onClick={() => setExpanded(isExpanded ? null : company.id)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <Building2 className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-gray-900">{company.nom}</p>
                                            <p className="text-xs text-gray-400">
                                                {company.ifu ? `IFU : ${company.ifu} · ` : ''}
                                                {company.members.length} membre{company.members.length > 1 ? 's' : ''} avec accès
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${company.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                            {company.is_active ? 'Active' : 'Suspendue'}
                                        </span>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {/* Détails accès */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 px-5 py-4">
                                        {/* Membres avec accès */}
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Membres avec accès</p>
                                        {company.members.length === 0 ? (
                                            <p className="text-sm text-gray-400 mb-4">Aucun membre n'a encore accès à cette société</p>
                                        ) : (
                                            <div className="space-y-2 mb-4">
                                                {company.members.map((m) => (
                                                    <div key={m.user_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-gray-700">{m.email}</span>
                                                            <span className="text-xs text-gray-400">· {ROLE_LABELS[m.org_role] ?? m.org_role}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => revokeMut.mutate({ companyId: company.id, userId: m.user_id })}
                                                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                                        >
                                                            <ShieldOff className="w-3.5 h-3.5" /> Révoquer
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Accorder accès */}
                                        {available.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accorder l'accès</p>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={grantUserId[company.id] ?? ''}
                                                        onChange={(e) => setGrantUserId((prev) => ({ ...prev, [company.id]: e.target.value }))}
                                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Sélectionner un membre…</option>
                                                        {available.map((m) => (
                                                            <option key={m.id} value={m.id}>
                                                                {m.email} ({ROLE_LABELS[m.org_role] ?? m.org_role})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            const uid = grantUserId[company.id];
                                                            if (uid) {
                                                                grantMut.mutate({ companyId: company.id, userId: uid });
                                                                setGrantUserId((prev) => ({ ...prev, [company.id]: '' }));
                                                            }
                                                        }}
                                                        disabled={!grantUserId[company.id] || grantMut.isPending}
                                                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                                                    >
                                                        <Shield className="w-4 h-4" /> Accorder
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {available.length === 0 && company.members.length > 0 && (
                                            <p className="text-xs text-gray-400">Tous les membres ont accès à cette société.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
