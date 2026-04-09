'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { declarationsApi, workflowApi } from '@/lib/api'
import type { Declaration, WorkflowEtape } from '@/types'
import { GitBranch, ChevronDown, ChevronRight, Send, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

const MOIS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const STATUT_LABELS: Record<string, string> = {
    ok: 'OK',
    retard: 'Retard',
    en_cours: 'En cours',
    soumise: 'Soumise',
    approuvee: 'Approuvée',
    rejetee: 'Rejetée',
}

const STATUT_COLORS: Record<string, string> = {
    ok: 'var(--prime)',
    retard: 'var(--red)',
    en_cours: 'var(--or)',
    soumise: '#3b82f6',
    approuvee: 'var(--prime)',
    rejetee: 'var(--red)',
}

const ETAPE_LABELS: Record<string, string> = {
    soumise: 'Soumission',
    approuvee: 'Approbation',
    rejetee: 'Rejet',
    en_cours: 'En cours',
}

export default function WorkflowPage() {
    const qc = useQueryClient()
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [commentaire, setCommentaire] = useState('')
    const [actionModal, setActionModal] = useState<{ declId: string; action: 'soumettre' | 'approuver' | 'rejeter' } | null>(null)

    const { data: declarations = [], isLoading } = useQuery<Declaration[]>({
        queryKey: ['declarations', 'workflow'],
        queryFn: () => declarationsApi.list(1, 50).then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })

    const { data: history = [] } = useQuery<WorkflowEtape[]>({
        queryKey: ['workflow', expandedId],
        queryFn: () => workflowApi.history(expandedId!).then(r => r.data?.data ?? r.data ?? []),
        enabled: !!expandedId,
        staleTime: 15_000,
    })

    const actionMut = useMutation({
        mutationFn: ({ declId, action, com }: { declId: string; action: 'soumettre' | 'approuver' | 'rejeter'; com: string }) => {
            if (action === 'soumettre') return workflowApi.soumettre(declId, com)
            if (action === 'approuver') return workflowApi.approuver(declId, com)
            return workflowApi.rejeter(declId, com)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['declarations'] })
            qc.invalidateQueries({ queryKey: ['workflow'] })
            setActionModal(null)
            setCommentaire('')
            toast.success('Action effectuée')
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Erreur lors de l\'action')
        },
    })

    function openAction(declId: string, action: 'soumettre' | 'approuver' | 'rejeter') {
        setCommentaire('')
        setActionModal({ declId, action })
    }

    return (
        <div>
            {/* Modal d'action */}
            {actionModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        background: 'var(--white)', borderRadius: 12, padding: 24, width: 420,
                        boxShadow: '0 16px 40px rgba(0,0,0,.15)',
                    }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
                            {actionModal.action === 'soumettre' && 'Soumettre la déclaration'}
                            {actionModal.action === 'approuver' && 'Approuver la déclaration'}
                            {actionModal.action === 'rejeter' && 'Rejeter la déclaration'}
                        </h3>
                        <div className="form-group">
                            <label>Commentaire (optionnel)</label>
                            <textarea
                                rows={3}
                                value={commentaire}
                                onChange={e => setCommentaire(e.target.value)}
                                placeholder="Ajoutez un commentaire pour cette étape…"
                                style={{
                                    width: '100%', border: '1px solid var(--gr2)',
                                    borderRadius: 8, padding: '8px 12px', fontSize: 13,
                                    fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                            <button className="btn btn-outline" onClick={() => setActionModal(null)}>Annuler</button>
                            <button
                                className="btn btn-primary"
                                style={{ background: actionModal.action === 'rejeter' ? 'var(--red)' : undefined }}
                                disabled={actionMut.isPending}
                                onClick={() => actionMut.mutate({
                                    declId: actionModal.declId,
                                    action: actionModal.action,
                                    com: commentaire,
                                })}
                            >
                                {actionMut.isPending ? 'En cours…' : 'Confirmer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Liste des déclarations */}
            <div className="card">
                <div className="card-header">
                    <h3><GitBranch size={15} style={{ marginRight: 6 }} />Workflow d'approbation</h3>
                    <span className="ch-right">{declarations.length} déclaration{declarations.length !== 1 ? 's' : ''}</span>
                </div>
                {isLoading ? (
                    <div className="card-body">
                        <p className="text-sm" style={{ color: 'var(--gr5)' }}>Chargement…</p>
                    </div>
                ) : declarations.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', paddingTop: 32 }}>
                        <GitBranch size={32} style={{ color: 'var(--gr3)', marginBottom: 8 }} />
                        <p style={{ color: 'var(--gr5)', fontSize: 13 }}>Aucune déclaration. Créez d'abord une saisie mensuelle.</p>
                    </div>
                ) : (
                    <div>
                        {declarations.map((d) => (
                            <div key={d.id} style={{ borderBottom: '1px solid var(--gr2)' }}>
                                <div
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '14px 16px', cursor: 'pointer',
                                    }}
                                    onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                                >
                                    {expandedId === d.id
                                        ? <ChevronDown size={14} style={{ color: 'var(--gr5)', flexShrink: 0 }} />
                                        : <ChevronRight size={14} style={{ color: 'var(--gr5)', flexShrink: 0 }} />
                                    }
                                    <span style={{ flex: 1, fontWeight: 500 }}>
                                        {MOIS[d.mois]} {d.annee}
                                        {d.ref && <span style={{ color: 'var(--gr5)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>#{d.ref}</span>}
                                    </span>
                                    <span style={{
                                        fontSize: 12, fontWeight: 600,
                                        color: STATUT_COLORS[d.statut] ?? 'var(--gr5)',
                                        width: 90,
                                    }}>
                                        {STATUT_LABELS[d.statut] ?? d.statut}
                                    </span>

                                    {/* Actions workflow */}
                                    <div
                                        style={{ display: 'flex', gap: 6 }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {(d.statut === 'ok' || d.statut === 'en_cours') && (
                                            <button
                                                className="btn btn-outline btn-sm"
                                                style={{ color: '#3b82f6', borderColor: '#3b82f6' }}
                                                onClick={() => openAction(d.id, 'soumettre')}
                                                title="Soumettre pour approbation"
                                            >
                                                <Send size={12} /> Soumettre
                                            </button>
                                        )}
                                        {d.statut === 'soumise' && (
                                            <>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ color: 'var(--prime)', borderColor: 'var(--prime)' }}
                                                    onClick={() => openAction(d.id, 'approuver')}
                                                    title="Approuver"
                                                >
                                                    <Check size={12} /> Approuver
                                                </button>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                                                    onClick={() => openAction(d.id, 'rejeter')}
                                                    title="Rejeter"
                                                >
                                                    <X size={12} /> Rejeter
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Historique workflow */}
                                {expandedId === d.id && (
                                    <div style={{ padding: '0 16px 16px 40px' }}>
                                        {history.length === 0 ? (
                                            <p style={{ color: 'var(--gr5)', fontSize: 13 }}>
                                                Aucune action de workflow pour cette déclaration.
                                            </p>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                {/* Ligne timeline */}
                                                <div style={{
                                                    position: 'absolute', left: 10, top: 0, bottom: 0,
                                                    width: 2, background: 'var(--gr2)',
                                                }} />
                                                {history.map((e, idx) => (
                                                    <div key={e.id} style={{
                                                        display: 'flex', gap: 14, marginBottom: 16,
                                                        position: 'relative',
                                                    }}>
                                                        {/* Dot */}
                                                        <div style={{
                                                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                                            background: e.etape === 'approuvee' ? 'var(--prime)' :
                                                                e.etape === 'rejetee' ? 'var(--red)' : '#3b82f6',
                                                            border: '2px solid var(--white)',
                                                            zIndex: 1,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                            {e.etape === 'approuvee' && <Check size={10} color="white" />}
                                                            {e.etape === 'rejetee' && <X size={10} color="white" />}
                                                            {e.etape === 'soumise' && <Send size={9} color="white" />}
                                                        </div>
                                                        <div>
                                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--gr9)' }}>
                                                                {ETAPE_LABELS[e.etape] ?? e.etape}
                                                            </p>
                                                            {e.commentaire && (
                                                                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--gr6)', fontStyle: 'italic' }}>
                                                                    « {e.commentaire} »
                                                                </p>
                                                            )}
                                                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--gr4)' }}>
                                                                {new Date(e.created_at).toLocaleDateString('fr-FR', {
                                                                    day: '2-digit', month: 'long', year: 'numeric',
                                                                    hour: '2-digit', minute: '2-digit',
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
