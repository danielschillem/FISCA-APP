'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calculApi, simulationsApi } from '@/lib/api'
import type { CalculResult, Simulation } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { BarChart2, Save, Trash2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SimulateurPage() {
    const qc = useQueryClient()
    const [form, setForm] = useState({
        label: '',
        salaire_base: 0, anciennete: 0, heures_sup: 0,
        logement: 0, transport: 0, fonction: 0,
        charges: 0, cotisation: 'CNSS' as 'CNSS' | 'CARFO',
    })
    const [result, setResult] = useState<CalculResult | null>(null)

    const { data: simulations = [] } = useQuery<Simulation[]>({
        queryKey: ['simulations'],
        queryFn: () => simulationsApi.list().then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })

    const calcMut = useMutation({
        mutationFn: () => {
            const { label, ...calcData } = form
            return calculApi.calcul(calcData).then(r => r.data as CalculResult)
        },
        onSuccess: setResult,
        onError: () => toast.error('Erreur lors du calcul'),
    })

    const saveMut = useMutation({
        mutationFn: () => {
            if (!result) throw new Error('Aucun résultat à sauvegarder')
            const { label, ...calcData } = form
            return simulationsApi.create({ label: label || 'Simulation sans titre', input: calcData })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['simulations'] })
            toast.success('Simulation sauvegardée')
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Erreur lors de la sauvegarde')
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => simulationsApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['simulations'] }); toast.success('Simulation supprimée') },
        onError: () => toast.error('Erreur'),
    })

    const numField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))

    return (
        <div>
            <div className="grid-2">
                {/* Formulaire */}
                <div className="card">
                    <div className="card-header">
                        <h3><BarChart2 size={15} style={{ marginRight: 6 }} />Paramètres de simulation</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Libellé de la simulation</label>
                            <input
                                type="text"
                                placeholder="Ex : Scénario augmentation Q3"
                                value={form.label}
                                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                            />
                        </div>
                        <div className="form-grid">
                            {([
                                ['salaire_base', 'Salaire de base'],
                                ['anciennete', 'Ancienneté'],
                                ['heures_sup', 'Heures supp.'],
                                ['logement', 'Logement'],
                                ['transport', 'Transport'],
                                ['fonction', 'Fonction'],
                            ] as const).map(([key, label]) => (
                                <div key={key} className="form-group">
                                    <label>{label}</label>
                                    <input type="number" min="0" step="500"
                                        value={form[key]} onChange={numField(key)} />
                                </div>
                            ))}
                            <div className="form-group">
                                <label>Charges familiales</label>
                                <input type="number" min="0" max="6"
                                    value={form.charges}
                                    onChange={e => setForm(f => ({ ...f, charges: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="form-group">
                                <label>Cotisation</label>
                                <select value={form.cotisation}
                                    onChange={e => setForm(f => ({ ...f, cotisation: e.target.value as 'CNSS' | 'CARFO' }))}>
                                    <option value="CNSS">CNSS (5,5 %)</option>
                                    <option value="CARFO">CARFO (6 %)</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={() => calcMut.mutate()} disabled={calcMut.isPending}>
                                <BarChart2 size={14} /> {calcMut.isPending ? 'Calcul…' : 'Simuler'}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => saveMut.mutate()}
                                disabled={saveMut.isPending || !result}
                                title={!result ? 'Simulez d\'abord pour sauvegarder' : ''}
                            >
                                <Save size={14} /> {saveMut.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Résultats */}
                <div className="card">
                    <div className="card-header"><h3>Résultat</h3></div>
                    <div className="card-body">
                        {!result ? (
                            <p className="text-sm" style={{ color: 'var(--gr5)' }}>
                                Renseignez les données et cliquez sur « Simuler ».
                            </p>
                        ) : (
                            <div className="recap-card">
                                {[
                                    ['Salaire brut total', result.brut_total],
                                    ['Base imposable', result.base_imposable],
                                    ['IUTS brut', result.iuts_brut],
                                    ['IUTS net (après charges)', result.iuts_net],
                                    ['Cotisation sociale', result.cotisation_sociale],
                                    ['TPA (patronale)', result.tpa],
                                ].map(([label, val]) => (
                                    <div key={label as string} className="recap-line">
                                        <span className="recap-label">{label}</span>
                                        <span className="rv">{fmtFCFA(val as number)}</span>
                                    </div>
                                ))}
                                <div className="recap-line recap-total">
                                    <span>Salaire net</span>
                                    <span className="rv">{fmtFCFA(result.salaire_net)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Historique des simulations */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <h3><Clock size={15} style={{ marginRight: 6 }} />Historique des simulations</h3>
                    <span className="ch-right">{simulations.length} simulation{simulations.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="table-wrap">
                    {simulations.length === 0 ? (
                        <p style={{ padding: '20px 16px', color: 'var(--gr5)', fontSize: 13 }}>
                            Aucune simulation sauvegardée. Effectuez une simulation et cliquez sur « Sauvegarder ».
                        </p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Libellé</th>
                                    <th>Cotisation</th>
                                    <th className="text-right">Brut total</th>
                                    <th className="text-right">IUTS net</th>
                                    <th className="text-right">Salaire net</th>
                                    <th>Date</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {simulations.map((s) => (
                                    <tr key={s.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setForm(f => ({ ...f, ...s.input_data, label: s.label }))
                                            setResult(s.result_data)
                                        }}
                                    >
                                        <td style={{ fontWeight: 500 }}>{s.label}</td>
                                        <td>{s.input_data?.cotisation ?? '—'}</td>
                                        <td className="text-right">{fmtFCFA(s.result_data?.brut_total ?? 0)}</td>
                                        <td className="text-right">{fmtFCFA(s.result_data?.iuts_net ?? 0)}</td>
                                        <td className="text-right" style={{ color: 'var(--prime)', fontWeight: 600 }}>
                                            {fmtFCFA(s.result_data?.salaire_net ?? 0)}
                                        </td>
                                        <td style={{ color: 'var(--gr5)', fontSize: 12 }}>
                                            {new Date(s.created_at).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                style={{ color: 'var(--red)' }}
                                                onClick={() => { if (confirm('Supprimer ?')) deleteMut.mutate(s.id) }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
