import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '../lib/api';
import { Card, Badge, Btn, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import type { WorkflowEtape } from '../types';
import { MOIS_FR } from '../types';
import { MessageSquare, Check, X, Lock, History, ChevronUp } from 'lucide-react';

const STATUT_COLOR: Record<string, 'green' | 'orange' | 'blue' | 'red' | 'gray'> = {
    approuve: 'green',
    soumis: 'blue',
    en_revision: 'orange',
    rejete: 'red',
    brouillon: 'gray',
};

const ETAPE_LABEL: Record<string, string> = {
    soumis: 'Soumis',
    en_revision: 'En révision',
    approuve: 'Approuvé',
    rejete: 'Rejeté',
    brouillon: 'Brouillon',
};

function AuditTrail({ declId }: { declId: string }) {
    const { data: etapes = [], isLoading } = useQuery<WorkflowEtape[]>({
        queryKey: ['workflow-history', declId],
        queryFn: () => workflowApi.get(declId).then((r) => r.data),
    });

    if (isLoading) return <div className="text-xs text-gray-400 py-2 animate-pulse">Chargement de l'historique...</div>;
    if (etapes.length === 0) return <p className="text-xs text-gray-400 py-2">Aucune transition enregistrée.</p>;

    return (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Historique des transitions</p>
            {etapes.map((e, i) => (
                <div key={e.id ?? i} className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        e.etape === 'approuve' ? 'bg-green-400' :
                        e.etape === 'rejete' ? 'bg-red-400' :
                        e.etape === 'soumis' ? 'bg-blue-400' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-gray-700">{ETAPE_LABEL[e.etape] ?? e.etape}</span>
                        {e.commentaire && <span className="text-xs text-gray-500 ml-2 italic">— {e.commentaire}</span>}
                        <p className="text-[10px] text-gray-400">
                            {new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function WorkflowPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('workflow')) return <Locked />;
    return <WorkflowContent />;
}

function WorkflowContent() {
    const qc = useQueryClient();
    const [filterStatut, setFilterStatut] = useState('all');
    const [rejectModal, setRejectModal] = useState<{ id: string; comment: string } | null>(null);
    const [openHistory, setOpenHistory] = useState<string | null>(null);

    const { data: etapes = [], isLoading } = useQuery<WorkflowEtape[]>({
        queryKey: ['workflow', filterStatut],
        queryFn: () => workflowApi.list(filterStatut !== 'all' ? filterStatut : undefined).then((r) => r.data),
    });

    const transition = useMutation({
        mutationFn: ({ id, action, commentaire }: { id: string; action: string; commentaire?: string }) =>
            workflowApi.transition(id, action, commentaire ? { commentaire } : undefined),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['workflow'] });
            setRejectModal(null);
        },
    });

    if (isLoading) return <Spinner />;

    const counts = etapes.reduce((acc, e) => {
        acc[e.statut] = (acc[e.statut] ?? 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            {/* Counters */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { key: 'all', label: 'Toutes', color: 'bg-gray-50 text-gray-700' },
                    { key: 'soumis', label: 'À réviser', color: 'bg-blue-50 text-blue-700' },
                    { key: 'en_revision', label: 'En révision', color: 'bg-orange-50 text-orange-700' },
                    { key: 'approuve', label: 'Approuvées', color: 'bg-green-50 text-green-700' },
                ].map(({ key, label, color }) => (
                    <button
                        key={key}
                        onClick={() => setFilterStatut(key)}
                        className={`${color} rounded-xl p-3 text-left transition-all ${filterStatut === key ? 'ring-2 ring-offset-1 ring-green-400' : ''}`}
                    >
                        <p className="text-2xl font-bold">{key === 'all' ? etapes.length : (counts[key] ?? 0)}</p>
                        <p className="text-xs mt-0.5">{label}</p>
                    </button>
                ))}
            </div>

            {/* Cards */}
            <div className="space-y-3">
                {etapes.map((e) => (
                    <Card key={e.id}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge color={STATUT_COLOR[e.statut] ?? 'gray'}>{e.statut.replace('_', ' ')}</Badge>
                                    <span className="text-xs text-gray-400">{e.type_declaration}</span>
                                </div>
                                <p className="font-semibold text-gray-900 text-sm truncate">{e.titre}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {MOIS_FR[(e.mois ?? 1) - 1]} {e.annee} - Créé par {e.createur}
                                </p>
                                {e.commentaire && (
                                    <p className="text-xs text-orange-600 mt-1 italic flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {e.commentaire}</p>
                                )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {e.statut === 'soumis' && (
                                    <>
                                        <Btn size="sm" onClick={() => transition.mutate({ id: e.id, action: 'approuver' })}>
                                            <Check className="w-4 h-4" /> Approuver
                                        </Btn>
                                        <Btn size="sm" variant="outline" onClick={() => setRejectModal({ id: e.id, comment: '' })}>
                                            <X className="w-4 h-4" /> Rejeter
                                        </Btn>
                                    </>
                                )}
                                {e.statut === 'brouillon' && (
                                    <Btn size="sm" onClick={() => transition.mutate({ id: e.id, action: 'soumettre' })}>
                                        Soumettre
                                    </Btn>
                                )}
                                {e.statut === 'rejete' && (
                                    <Btn size="sm" variant="outline" onClick={() => transition.mutate({ id: e.id, action: 'reviser' })}>
                                        ↩ Réviser
                                    </Btn>
                                )}
                                <button
                                    onClick={() => setOpenHistory(openHistory === e.id ? null : e.id)}
                                    title="Historique des transitions"
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    {openHistory === e.id ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        {openHistory === e.id && <AuditTrail declId={e.id} />}
                    </Card>
                ))}
                {etapes.length === 0 && (
                    <Card>
                        <p className="text-center text-gray-400 py-8">Aucune declaration dans ce statut</p>
                    </Card>
                )}
            </div>

            {/* Modal rejet */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-1">Motif du rejet</h3>
                        <p className="text-xs text-gray-500 mb-3">Ce commentaire sera visible par le declarant.</p>
                        <textarea
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-red-400 focus:outline-none"
                            rows={4}
                            placeholder="Indiquer le motif du rejet..."
                            value={rejectModal.comment}
                            onChange={(e) => setRejectModal((prev) => prev ? { ...prev, comment: e.target.value } : null)}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-4 justify-end">
                            <Btn size="sm" variant="outline" onClick={() => setRejectModal(null)}>Annuler</Btn>
                            <Btn
                                size="sm"
                                disabled={!rejectModal.comment.trim() || transition.isPending}
                                onClick={() => transition.mutate({ id: rejectModal.id, action: 'rejeter', commentaire: rejectModal.comment })}
                            >
                                <X className="w-4 h-4" /> Confirmer le rejet
                            </Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-orange-600">Entreprise</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour le workflow d'approbation.</p>
            </div>
        </div>
    );
}

