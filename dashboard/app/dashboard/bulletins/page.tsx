'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bulletinsApi } from '@/lib/api'
import type { Bulletin } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { FileText, RefreshCw, Download, Trash2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const now = new Date()

export default function BulletinsPage() {
    const qc = useQueryClient()
    const [mois, setMois] = useState(now.getMonth() + 1)
    const [annee, setAnnee] = useState(now.getFullYear())
    const [cotisation, setCotisation] = useState('CNSS')

    const { data: bulletins = [], isLoading } = useQuery<Bulletin[]>({
        queryKey: ['bulletins', mois, annee],
        queryFn: () => bulletinsApi.list(mois, annee).then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })

    const generateMut = useMutation({
        mutationFn: () => bulletinsApi.generate({ mois, annee, cotisation }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bulletins'] })
            toast.success('Bulletins générés avec succès')
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Erreur lors de la génération')
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => bulletinsApi.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bulletins'] })
            toast.success('Bulletin supprimé')
        },
        onError: () => toast.error('Erreur lors de la suppression'),
    })

    const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

    return (
        <div>
            {/* Filtres + génération */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
                            <label>Mois</label>
                            <select value={mois} onChange={e => setMois(+e.target.value)}>
                                {MOIS_LABELS.slice(1).map((m, i) => (
                                    <option key={i + 1} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ margin: 0, flex: '0 0 120px' }}>
                            <label>Année</label>
                            <select value={annee} onChange={e => setAnnee(+e.target.value)}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ margin: 0, flex: '0 0 180px' }}>
                            <label>Cotisation par défaut</label>
                            <select value={cotisation} onChange={e => setCotisation(e.target.value)}>
                                <option value="CNSS">CNSS (5,5 %)</option>
                                <option value="CARFO">CARFO (6 %)</option>
                            </select>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => generateMut.mutate()}
                            disabled={generateMut.isPending}
                            style={{ marginBottom: 2 }}
                        >
                            <RefreshCw size={14} />
                            {generateMut.isPending ? 'Génération…' : 'Générer les bulletins'}
                        </button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--gr5)', marginTop: 8, marginBottom: 0 }}>
                        La génération recrée les bulletins pour la période sélectionnée à partir des données salariales actuelles.
                    </p>
                </div>
            </div>

            {/* Tableau */}
            <div className="card">
                <div className="card-header">
                    <h3><FileText size={15} style={{ marginRight: 6 }} />
                        Bulletins — {MOIS_LABELS[mois]} {annee}
                    </h3>
                    <span className="ch-right">{bulletins.length} bulletin{bulletins.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="table-wrap">
                    {isLoading ? (
                        <p className="text-sm" style={{ padding: '24px 16px', color: 'var(--gr5)' }}>Chargement…</p>
                    ) : bulletins.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                            <AlertCircle size={32} style={{ color: 'var(--gr3)', marginBottom: 8 }} />
                            <p style={{ color: 'var(--gr5)', fontSize: 13 }}>
                                Aucun bulletin pour cette période. Cliquez sur « Générer les bulletins » pour les créer.
                            </p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Employé</th>
                                    <th>Catégorie</th>
                                    <th>Cotisation</th>
                                    <th className="text-right">Brut total</th>
                                    <th className="text-right">IUTS net</th>
                                    <th className="text-right">TPA</th>
                                    <th className="text-right">Salaire net</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {bulletins.map((b) => (
                                    <tr key={b.id}>
                                        <td style={{ fontWeight: 500 }}>{b.nom_employe}</td>
                                        <td>{b.categorie}</td>
                                        <td>{b.cotisation}</td>
                                        <td className="text-right">{fmtFCFA(b.brut_total)}</td>
                                        <td className="text-right">{fmtFCFA(b.iuts_net)}</td>
                                        <td className="text-right">{fmtFCFA(b.tpa)}</td>
                                        <td className="text-right" style={{ fontWeight: 600, color: 'var(--prime)' }}>
                                            {fmtFCFA(b.salaire_net)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                <a
                                                    href={bulletinsApi.exportUrl(b.id)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-outline btn-sm"
                                                    title="Imprimer / Exporter"
                                                >
                                                    <Download size={12} />
                                                </a>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ color: 'var(--red)' }}
                                                    title="Supprimer"
                                                    onClick={() => {
                                                        if (confirm(`Supprimer le bulletin de ${b.nom_employe} ?`))
                                                            deleteMut.mutate(b.id)
                                                    }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'var(--gr1)', fontWeight: 600 }}>
                                    <td colSpan={3}>Total période</td>
                                    <td className="text-right">{fmtFCFA(bulletins.reduce((s, b) => s + b.brut_total, 0))}</td>
                                    <td className="text-right">{fmtFCFA(bulletins.reduce((s, b) => s + b.iuts_net, 0))}</td>
                                    <td className="text-right">{fmtFCFA(bulletins.reduce((s, b) => s + b.tpa, 0))}</td>
                                    <td className="text-right" style={{ color: 'var(--prime)' }}>
                                        {fmtFCFA(bulletins.reduce((s, b) => s + b.salaire_net, 0))}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
