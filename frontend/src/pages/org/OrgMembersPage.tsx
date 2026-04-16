import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '../../lib/api';
import type { OrgMember } from '../../types';
import { UserPlus, Trash2, Shield, AlertCircle, X, CheckCircle2, Users } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
    org_admin: 'Admin structure',
    comptable: 'Comptable',
    gestionnaire_rh: 'Gestionnaire RH',
    auditeur: 'Auditeur',
};
const ROLE_COLORS: Record<string, string> = {
    org_admin: 'bg-purple-100 text-purple-700',
    comptable: 'bg-blue-100 text-blue-700',
    gestionnaire_rh: 'bg-green-100 text-green-700',
    auditeur: 'bg-amber-100 text-amber-700',
};

export default function OrgMembersPage() {
    const qc = useQueryClient();
    const [showInvite, setShowInvite] = useState(false);
    const [invite, setInvite] = useState({ email: '', password: '', org_role: 'comptable' });
    const [inviteError, setInviteError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const { data: members = [], isLoading } = useQuery<OrgMember[]>({
        queryKey: ['org-members'],
        queryFn: () => orgApi.listMembers().then((r) => r.data),
    });

    const { data: infoData } = useQuery({
        queryKey: ['org-info'],
        queryFn: () => orgApi.getInfo().then((r) => r.data),
    });

    const inviteMut = useMutation({
        mutationFn: () => orgApi.inviteMember(invite),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['org-members'] });
            qc.invalidateQueries({ queryKey: ['org-info'] });
            setShowInvite(false);
            setInvite({ email: '', password: '', org_role: 'comptable' });
            setInviteError('');
            setSuccessMsg('Utilisateur ajouté avec succès.');
            setTimeout(() => setSuccessMsg(''), 3000);
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setInviteError(msg ?? 'Erreur lors de l\'invitation');
        },
    });

    const roleMut = useMutation({
        mutationFn: ({ id, org_role }: { id: string; org_role: string }) =>
            orgApi.setMemberRole(id, org_role),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
    });

    const removeMut = useMutation({
        mutationFn: (id: string) => orgApi.removeMember(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['org-members'] });
            qc.invalidateQueries({ queryKey: ['org-info'] });
        },
    });

    const org = infoData?.organization;
    const stats = infoData?.stats;
    const atLimit = stats && org && org.max_users > 0 && stats.member_count >= org.max_users;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" /> Membres de l'organisation
                    </h1>
                    {stats && (
                        <p className="text-sm text-gray-500 mt-1">
                            {stats.member_count} membre{stats.member_count > 1 ? 's' : ''}
                            {org && org.max_users > 0 ? ` / ${org.max_users} max (plan ${org.plan})` : ' (illimités)'}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => { setShowInvite(true); setInviteError(''); }}
                    disabled={!!atLimit}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={atLimit ? 'Limite d\'utilisateurs atteinte' : ''}
                >
                    <UserPlus className="w-4 h-4" /> Ajouter un membre
                </button>
            </div>

            {successMsg && (
                <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4 border border-green-200">
                    <CheckCircle2 className="w-4 h-4" /> {successMsg}
                </div>
            )}
            {atLimit && (
                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-lg mb-4 border border-amber-200">
                    <AlertCircle className="w-4 h-4" />
                    Limite d'utilisateurs atteinte pour votre plan. Passez à un plan supérieur pour en ajouter.
                </div>
            )}

            {/* Tableau des membres */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : members.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>Aucun membre pour l'instant</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">Rôle</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {members.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{m.email}</td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={m.org_role}
                                            onChange={(e) => roleMut.mutate({ id: m.id, org_role: e.target.value })}
                                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ROLE_COLORS[m.org_role] ?? 'bg-gray-100 text-gray-600'}`}
                                        >
                                            {Object.entries(ROLE_LABELS).map(([val, label]) => (
                                                <option key={val} value={val}>{label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                            {m.is_active ? 'Actif' : 'Suspendu'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => { if (confirm(`Retirer ${m.email} de l'organisation ?`)) removeMut.mutate(m.id); }}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Retirer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal invitation */}
            {showInvite && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-600" /> Ajouter un membre
                            </h2>
                            <button onClick={() => setShowInvite(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {inviteError && (
                            <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-4 border border-red-100">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {inviteError}
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={invite.email}
                                    onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="collaborateur@structure.bf"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe temporaire</label>
                                <input
                                    type="text"
                                    value={invite.password}
                                    onChange={(e) => setInvite((v) => ({ ...v, password: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="8 caractères minimum"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                                <select
                                    value={invite.org_role}
                                    onChange={(e) => setInvite((v) => ({ ...v, org_role: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Object.entries(ROLE_LABELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                    {invite.org_role === 'org_admin' && 'Accès complet : gestion des users et de toutes les fonctions'}
                                    {invite.org_role === 'comptable' && 'Saisie, bulletins, déclarations, TVA, RAS, IS, CME, Patente'}
                                    {invite.org_role === 'gestionnaire_rh' && 'Employés, bulletins, CNSS, IUTS : rapports RH'}
                                    {invite.org_role === 'auditeur' && 'Lecture seule sur tout : aucune modification possible'}
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowInvite(false)}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => inviteMut.mutate()}
                                    disabled={inviteMut.isPending || !invite.email || invite.password.length < 8}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                                >
                                    {inviteMut.isPending ? 'Création…' : 'Ajouter'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
