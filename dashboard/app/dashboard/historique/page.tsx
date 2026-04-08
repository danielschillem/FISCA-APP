'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { declarationsApi } from '@/lib/api'
import type { Declaration } from '@/types'
import { fmtFCFA, MOIS_NOMS } from '@/lib/utils'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle2, AlertTriangle, Clock, Trash2, FilePlus } from 'lucide-react'

export default function HistoriquePage() {
    const qc = useQueryClient()
    const { data: decls = [], isLoading } = useQuery<Declaration[]>({
        queryKey: ['declarations'],
        queryFn: () => declarationsApi.list().then(r => r.data),
    })

    const now = new Date()
    const [mois, setMois] = useState(now.getMonth() + 1)
    const [annee, setAnnee] = useState(now.getFullYear())
    const [cotisation, setCotis] = useState<'CNSS' | 'CARFO'>('CNSS')

    const createMut = useMutation({
        mutationFn: () => declarationsApi.create({ mois, annee, cotisation }).then(r => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['declarations'] }); toast.success('Declaration enregistree') },
        onError: () => toast.error('Erreur lors de la declaration'),
    })
    const deleteMut = useMutation({
        mutationFn: (id: string) => declarationsApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['declarations'] }); toast.success('Declaration supprimee') },
    })

    return (
        <div>
            {/* Nouvelle declaration */}
            <div className="card">
                <div className="card-header">
                    <h3><FilePlus size={15} style={{ marginRight: 6 }} />Nouvelle declaration</h3>
                </div>
                <div className="card-body">
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Mois</label>
                            <select value={mois} onChange={e => setMois(Number(e.target.value))}>
                                {MOIS_NOMS.slice(1).map((m, i) => (
                                    <option key={i + 1} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Annee</label>
                            <input type="number" value={annee} onChange={e => setAnnee(Number(e.target.value))} />
                        </div>
                        <div className="form-group">
                            <label>Cotisation</label>
                            <select value={cotisation} onChange={e => setCotis(e.target.value as 'CNSS' | 'CARFO')}>
                                <option value="CNSS">CNSS (5,5 %)</option>
                                <option value="CARFO">CARFO (6 %)</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex-end" style={{ marginTop: 12 }}>
                        <button className="btn btn-primary"
                            onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                            <FilePlus size={15} />
                            {createMut.isPending ? 'Declaration…' : 'Declarer le mois'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tableau declarations */}
            <div className="card">
                <div className="card-header">
                    <h3>Historique des declarations</h3>
                    <span className="ch-right">{decls.length} declaration(s)</span>
                </div>
                <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Periode</th>
                                <th>Salaries</th>
                                <th>Brut total</th>
                                <th>IUTS</th>
                                <th>TPA</th>
                                <th>Total DGI</th>
                                <th>Statut</th>
                                <th>Reference</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--gr5)' }}>Chargement…</td></tr>
                            ) : decls.length === 0 ? (
                                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--gr5)' }}>Aucune declaration enregistree.</td></tr>
                            ) : decls.map((d) => (
                                <tr key={d.id}>
                                    <td className="td-name">{d.periode}</td>
                                    <td>{d.nb_salaries}</td>
                                    <td className="td-num">{fmtFCFA(d.brut_total)}</td>
                                    <td className="td-num">{fmtFCFA(d.iuts_total)}</td>
                                    <td className="td-num">{fmtFCFA(d.tpa_total)}</td>
                                    <td className="td-num bold">{fmtFCFA(d.total)}</td>
                                    <td>
                                        {d.statut === 'ok'       && <span className="badge badge-ok"><CheckCircle2 size={11} />OK</span>}
                                        {d.statut === 'retard'   && <span className="badge badge-red"><AlertTriangle size={11} />Retard</span>}
                                        {d.statut === 'en_cours' && <span className="badge badge-blue"><Clock size={11} />En cours</span>}
                                    </td>
                                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--gr5)' }}>{d.ref || '—'}</td>
                                    <td>
                                        <button className="btn-icon btn-danger"
                                            onClick={() => { if (confirm('Supprimer cette declaration ?')) deleteMut.mutate(d.id) }}
                                            title="Supprimer">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
