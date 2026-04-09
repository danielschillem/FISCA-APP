'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tvaApi } from '@/lib/api'
import type { TVADeclaration, TVALigne } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { Receipt, Plus, Trash2, Download, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const now = new Date()

type NewLigne = { type_op: 'vente' | 'achat'; description: string; montant_ht: number; taux_tva: number }

export default function TVAPage() {
    const qc = useQueryClient()
    const [showCreate, setShowCreate] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [newDecl, setNewDecl] = useState({ mois: now.getMonth() + 1, annee: now.getFullYear() })
    const [newLigne, setNewLigne] = useState<NewLigne>({ type_op: 'vente', description: '', montant_ht: 0, taux_tva: 18 })

    const { data: declarations = [], isLoading } = useQuery<TVADeclaration[]>({
        queryKey: ['tva'],
        queryFn: () => tvaApi.list().then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })

    const { data: detailDecl } = useQuery<TVADeclaration>({
        queryKey: ['tva', expandedId],
        queryFn: () => tvaApi.get(expandedId!).then(r => r.data),
        enabled: !!expandedId,
        staleTime: 10_000,
    })

    const createMut = useMutation({
        mutationFn: () => tvaApi.create(newDecl),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tva'] })
            setShowCreate(false)
            toast.success('Déclaration TVA créée')
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Erreur lors de la création')
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => tvaApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['tva'] }); toast.success('Déclaration supprimée') },
        onError: () => toast.error('Erreur lors de la suppression'),
    })

    const addLigneMut = useMutation({
        mutationFn: ({ id, ligne }: { id: string; ligne: NewLigne }) => tvaApi.addLigne(id, ligne),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: ['tva', id] })
            qc.invalidateQueries({ queryKey: ['tva'] })
            setNewLigne({ type_op: 'vente', description: '', montant_ht: 0, taux_tva: 18 })
            toast.success('Ligne ajoutée')
        },
        onError: () => toast.error('Erreur lors de l\'ajout'),
    })

    const deleteLigneMut = useMutation({
        mutationFn: ({ id, lid }: { id: string; lid: string }) => tvaApi.deleteLigne(id, lid),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: ['tva', id] })
            qc.invalidateQueries({ queryKey: ['tva'] })
        },
        onError: () => toast.error('Erreur'),
    })

    const montantTVA = newLigne.montant_ht * (newLigne.taux_tva / 100)
    const montantTTC = newLigne.montant_ht + montantTVA

    return (
        <div>
            {/* En-tête + bouton créer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div />
                <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
                    <Plus size={14} /> Nouvelle déclaration TVA
                </button>
            </div>

            {/* Formulaire création */}
            {showCreate && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header"><h3>Nouvelle déclaration TVA</h3></div>
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
                                <label>Mois</label>
                                <select value={newDecl.mois} onChange={e => setNewDecl(d => ({ ...d, mois: +e.target.value }))}>
                                    {MOIS_LABELS.slice(1).map((m, i) => (
                                        <option key={i + 1} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 120px' }}>
                                <label>Année</label>
                                <input type="number" min="2020" max="2099"
                                    value={newDecl.annee}
                                    onChange={e => setNewDecl(d => ({ ...d, annee: +e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                                <button className="btn btn-primary" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                                    {createMut.isPending ? 'Création…' : 'Créer'}
                                </button>
                                <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Annuler</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Liste des déclarations */}
            <div className="card">
                <div className="card-header">
                    <h3><Receipt size={15} style={{ marginRight: 6 }} />Déclarations TVA</h3>
                    <span className="ch-right">{declarations.length} déclaration{declarations.length !== 1 ? 's' : ''}</span>
                </div>
                {isLoading ? (
                    <div className="card-body">
                        <p className="text-sm" style={{ color: 'var(--gr5)' }}>Chargement…</p>
                    </div>
                ) : declarations.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', paddingTop: 32 }}>
                        <Receipt size={32} style={{ color: 'var(--gr3)', marginBottom: 8 }} />
                        <p style={{ color: 'var(--gr5)', fontSize: 13 }}>
                            Aucune déclaration TVA. Créez votre première déclaration.
                        </p>
                    </div>
                ) : (
                    <div>
                        {declarations.map((d) => (
                            <div key={d.id} style={{ borderBottom: '1px solid var(--gr2)' }}>
                                {/* Ligne résumé */}
                                <div
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '12px 16px', cursor: 'pointer',
                                    }}
                                    onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                                >
                                    {expandedId === d.id
                                        ? <ChevronDown size={14} style={{ color: 'var(--gr5)', flexShrink: 0 }} />
                                        : <ChevronRight size={14} style={{ color: 'var(--gr5)', flexShrink: 0 }} />
                                    }
                                    <span style={{ flex: 1, fontWeight: 500 }}>
                                        {MOIS_LABELS[d.mois]} {d.annee}
                                    </span>
                                    <span style={{ fontSize: 12, color: 'var(--gr5)', width: 130 }}>
                                        TVA nette : <strong style={{ color: d.tva_nette >= 0 ? 'var(--prime)' : 'var(--red)' }}>
                                            {fmtFCFA(d.tva_nette)}
                                        </strong>
                                    </span>
                                    <span style={{ fontSize: 12, color: 'var(--gr5)', width: 130 }}>
                                        CA TTC : {fmtFCFA(d.ca_ttc)}
                                    </span>
                                    <span
                                        className="badge"
                                        style={{
                                            background: d.statut === 'valide' ? 'var(--gr-badge)' : 'var(--or-badge)',
                                            color: d.statut === 'valide' ? 'var(--prime)' : 'var(--or)',
                                            fontSize: 11,
                                        }}
                                    >
                                        {d.statut}
                                    </span>
                                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                        <a
                                            href={tvaApi.exportUrl(d.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline btn-sm"
                                            title="Exporter CSV"
                                        >
                                            <Download size={12} />
                                        </a>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            style={{ color: 'var(--red)' }}
                                            onClick={() => { if (confirm('Supprimer cette déclaration TVA ?')) deleteMut.mutate(d.id) }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                {/* Détail lignes */}
                                {expandedId === d.id && (
                                    <div style={{ padding: '0 16px 16px 40px' }}>
                                        {/* Totaux */}
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                            gap: 12, marginBottom: 16,
                                        }}>
                                            {[
                                                ['CA HT', fmtFCFA(d.ca_ht)],
                                                ['TVA collectée', fmtFCFA(d.tva_collectee)],
                                                ['TVA déductible', fmtFCFA(d.tva_deductible)],
                                                ['TVA nette à payer', fmtFCFA(d.tva_nette)],
                                            ].map(([label, val]) => (
                                                <div key={label} style={{
                                                    background: 'var(--gr1)', borderRadius: 8,
                                                    padding: '10px 14px',
                                                }}>
                                                    <p style={{ fontSize: 11, color: 'var(--gr5)', margin: 0 }}>{label}</p>
                                                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--gr9)', margin: '4px 0 0' }}>{val}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Lignes existantes */}
                                        <div className="table-wrap" style={{ marginBottom: 16 }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Type</th>
                                                        <th>Description</th>
                                                        <th className="text-right">HT</th>
                                                        <th className="text-right">Taux TVA</th>
                                                        <th className="text-right">TVA</th>
                                                        <th className="text-right">TTC</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(detailDecl?.lignes ?? []).length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--gr5)', padding: '12px 0' }}>
                                                                Aucune ligne. Ajoutez des opérations ci-dessous.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        (detailDecl?.lignes ?? []).map((l: TVALigne) => (
                                                            <tr key={l.id}>
                                                                <td>
                                                                    <span className="badge" style={{
                                                                        background: l.type_op === 'vente' ? 'var(--gr-badge)' : 'var(--or-badge)',
                                                                        color: l.type_op === 'vente' ? 'var(--prime)' : 'var(--or)',
                                                                    }}>
                                                                        {l.type_op}
                                                                    </span>
                                                                </td>
                                                                <td>{l.description}</td>
                                                                <td className="text-right">{fmtFCFA(l.montant_ht)}</td>
                                                                <td className="text-right">{l.taux_tva} %</td>
                                                                <td className="text-right">{fmtFCFA(l.montant_tva)}</td>
                                                                <td className="text-right">{fmtFCFA(l.montant_ttc)}</td>
                                                                <td>
                                                                    <button
                                                                        className="btn btn-outline btn-sm"
                                                                        style={{ color: 'var(--red)' }}
                                                                        onClick={() => deleteLigneMut.mutate({ id: d.id, lid: l.id })}
                                                                    >
                                                                        <Trash2 size={11} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Ajout ligne */}
                                        <div style={{
                                            display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
                                            background: 'var(--gr1)', borderRadius: 8, padding: 12,
                                        }}>
                                            <div className="form-group" style={{ margin: 0, flex: '0 0 110px' }}>
                                                <label style={{ fontSize: 11 }}>Type</label>
                                                <select value={newLigne.type_op}
                                                    onChange={e => setNewLigne(l => ({ ...l, type_op: e.target.value as 'vente' | 'achat' }))}>
                                                    <option value="vente">Vente</option>
                                                    <option value="achat">Achat</option>
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0, flex: '1 1 180px' }}>
                                                <label style={{ fontSize: 11 }}>Description</label>
                                                <input type="text" placeholder="Description de l'opération"
                                                    value={newLigne.description}
                                                    onChange={e => setNewLigne(l => ({ ...l, description: e.target.value }))} />
                                            </div>
                                            <div className="form-group" style={{ margin: 0, flex: '0 0 130px' }}>
                                                <label style={{ fontSize: 11 }}>Montant HT (F CFA)</label>
                                                <input type="number" min="0" step="1000"
                                                    value={newLigne.montant_ht}
                                                    onChange={e => setNewLigne(l => ({ ...l, montant_ht: +e.target.value }))} />
                                            </div>
                                            <div className="form-group" style={{ margin: 0, flex: '0 0 100px' }}>
                                                <label style={{ fontSize: 11 }}>Taux TVA (%)</label>
                                                <select value={newLigne.taux_tva}
                                                    onChange={e => setNewLigne(l => ({ ...l, taux_tva: +e.target.value }))}>
                                                    <option value={18}>18 %</option>
                                                    <option value={10}>10 %</option>
                                                    <option value={0}>0 %</option>
                                                </select>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--gr5)', flex: '0 0 auto', marginBottom: 6 }}>
                                                TVA : {fmtFCFA(montantTVA)} · TTC : {fmtFCFA(montantTTC)}
                                            </div>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                style={{ marginBottom: 2 }}
                                                disabled={addLigneMut.isPending || !newLigne.description}
                                                onClick={() => addLigneMut.mutate({ id: d.id, ligne: newLigne })}
                                            >
                                                <Plus size={13} /> Ajouter
                                            </button>
                                        </div>
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
