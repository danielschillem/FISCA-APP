'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cnssApi } from '@/lib/api'
import type { CNSSPatronal } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { Users, RefreshCw, Download, CheckCircle, Trash2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const now = new Date()
const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Taux légaux BF
const TAUX_PATRONAL_CNSS = 16
const TAUX_SALARIAL_CNSS = 5.5
const TAUX_PATRONAL_CARFO = 7
const TAUX_SALARIAL_CARFO = 6

export default function CNSSPatronalPage() {
    const qc = useQueryClient()
    const [genMois, setGenMois] = useState(now.getMonth() + 1)
    const [genAnnee, setGenAnnee] = useState(now.getFullYear())

    const { data: fiches = [], isLoading } = useQuery<CNSSPatronal[]>({
        queryKey: ['cnss'],
        queryFn: () => cnssApi.list().then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })

    const genMut = useMutation({
        mutationFn: () => cnssApi.generer({ mois: genMois, annee: genAnnee }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cnss'] })
            toast.success('Fiche CNSS générée')
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Erreur lors de la génération')
        },
    })

    const validerMut = useMutation({
        mutationFn: (id: string) => cnssApi.valider(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cnss'] }); toast.success('Fiche validée') },
        onError: () => toast.error('Erreur'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => cnssApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cnss'] }); toast.success('Fiche supprimée') },
        onError: () => toast.error('Erreur'),
    })

    const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

    return (
        <div>
            {/* Génération */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                    <h3><RefreshCw size={15} style={{ marginRight: 6 }} />Générer une fiche CNSS patronal</h3>
                </div>
                <div className="card-body">
                    <p style={{ fontSize: 13, color: 'var(--gr5)', marginBottom: 12 }}>
                        La fiche est calculée automatiquement depuis les bulletins de paie de la période sélectionnée.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
                            <label>Mois</label>
                            <select value={genMois} onChange={e => setGenMois(+e.target.value)}>
                                {MOIS_LABELS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ margin: 0, flex: '0 0 120px' }}>
                            <label>Année</label>
                            <select value={genAnnee} onChange={e => setGenAnnee(+e.target.value)}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-primary" style={{ marginBottom: 2 }}
                            onClick={() => genMut.mutate()} disabled={genMut.isPending}>
                            <RefreshCw size={14} />
                            {genMut.isPending ? 'Génération…' : 'Générer'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table de référence des taux */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header"><h3>Taux BF en vigueur</h3></div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {[
                            ['CNSS Patronal', `${TAUX_PATRONAL_CNSS} %`, 'var(--prime)'],
                            ['CNSS Salarial', `${TAUX_SALARIAL_CNSS} %`, 'var(--gr6)'],
                            ['CARFO Patronal', `${TAUX_PATRONAL_CARFO} %`, 'var(--or)'],
                            ['CARFO Salarial', `${TAUX_SALARIAL_CARFO} %`, 'var(--gr6)'],
                        ].map(([label, val, color]) => (
                            <div key={label} style={{ background: 'var(--gr1)', borderRadius: 8, padding: '10px 14px' }}>
                                <p style={{ fontSize: 11, color: 'var(--gr5)', margin: 0 }}>{label}</p>
                                <p style={{ fontSize: 22, fontWeight: 700, color, margin: '4px 0 0' }}>{val}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fiches */}
            <div className="card">
                <div className="card-header">
                    <h3><Users size={15} style={{ marginRight: 6 }} />Fiches CNSS Patronal</h3>
                    <span className="ch-right">{fiches.length} fiche{fiches.length !== 1 ? 's' : ''}</span>
                </div>
                {isLoading ? (
                    <div className="card-body">
                        <p style={{ color: 'var(--gr5)', fontSize: 13 }}>Chargement…</p>
                    </div>
                ) : fiches.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', padding: '32px 16px' }}>
                        <AlertCircle size={32} style={{ color: 'var(--gr3)', marginBottom: 8 }} />
                        <p style={{ color: 'var(--gr5)', fontSize: 13 }}>
                            Aucune fiche générée. Sélectionnez une période et cliquez sur « Générer ».
                        </p>
                    </div>
                ) : (
                    <div>
                        {fiches.map(f => (
                            <div key={f.id} style={{ borderBottom: '1px solid var(--gr2)' }}>
                                {/* Ligne principale */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                                    <span style={{ flex: 1, fontWeight: 500 }}>{f.periode}</span>
                                    <span style={{ fontSize: 12, color: 'var(--gr5)', width: 140 }}>
                                        CNSS : {f.nb_salaries_cnss} sal. · CARFO : {f.nb_salaries_carfo} sal.
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--prime)', width: 140, textAlign: 'right' }}>
                                        {fmtFCFA(f.total_general)}
                                    </span>
                                    <span className="badge" style={{
                                        background: f.statut === 'valide' ? 'var(--gr-badge)' : 'var(--or-badge)',
                                        color: f.statut === 'valide' ? 'var(--prime)' : 'var(--or)',
                                        fontSize: 11, width: 70, textAlign: 'center',
                                    }}>
                                        {f.statut === 'valide' ? 'Validé' : 'Brouillon'}
                                    </span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {f.statut !== 'valide' && (
                                            <button className="btn btn-outline btn-sm"
                                                style={{ color: 'var(--prime)', borderColor: 'var(--prime)' }}
                                                onClick={() => validerMut.mutate(f.id)}
                                                title="Valider">
                                                <CheckCircle size={12} />
                                            </button>
                                        )}
                                        <a className="btn btn-outline btn-sm"
                                            href={cnssApi.exportUrl(f.id)}
                                            target="_blank" rel="noopener noreferrer" title="Export CSV">
                                            <Download size={12} />
                                        </a>
                                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)' }}
                                            onClick={() => { if (confirm('Supprimer cette fiche CNSS ?')) deleteMut.mutate(f.id) }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                {/* Détail CNSS + CARFO */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                                    padding: '0 16px 14px 16px',
                                }}>
                                    {/* CNSS */}
                                    <div style={{ background: 'var(--gr1)', borderRadius: 8, padding: '10px 14px' }}>
                                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr6)', margin: '0 0 8px' }}>CNSS (Régime général)</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                            <span>Base cotisable</span><strong>{fmtFCFA(f.base_cnss)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                            <span>Part salariale ({TAUX_SALARIAL_CNSS} %)</span>
                                            <strong>{fmtFCFA(f.cotisation_sal_cnss)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                            <span>Part patronale ({TAUX_PATRONAL_CNSS} %)</span>
                                            <strong>{fmtFCFA(f.cotisation_pat_cnss)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid var(--gr2)', paddingTop: 6, color: 'var(--prime)' }}>
                                            <span>Total CNSS</span><span>{fmtFCFA(f.total_cnss)}</span>
                                        </div>
                                    </div>
                                    {/* CARFO */}
                                    <div style={{ background: 'var(--gr1)', borderRadius: 8, padding: '10px 14px' }}>
                                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr6)', margin: '0 0 8px' }}>CARFO (Fonctionnaires)</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                            <span>Base cotisable</span><strong>{fmtFCFA(f.base_carfo)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                            <span>Part salariale ({TAUX_SALARIAL_CARFO} %)</span>
                                            <strong>{fmtFCFA(f.cotisation_sal_carfo)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                            <span>Part patronale ({TAUX_PATRONAL_CARFO} %)</span>
                                            <strong>{fmtFCFA(f.cotisation_pat_carfo)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid var(--gr2)', paddingTop: 6, color: 'var(--or)' }}>
                                            <span>Total CARFO</span><span>{fmtFCFA(f.total_carfo)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
