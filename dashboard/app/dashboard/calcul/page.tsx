'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { calculApi } from '@/lib/api'
import type { CalculResult } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { Calculator } from 'lucide-react'

const IUTS_TRANCHES = [
    { plafond: 30000, taux: '0 %' },
    { plafond: 50000, taux: '12 %' },
    { plafond: 80000, taux: '14 %' },
    { plafond: 120000, taux: '16 %' },
    { plafond: 170000, taux: '18 %' },
    { plafond: 250000, taux: '20 %' },
    { plafond: 400000, taux: '24 %' },
    { plafond: 600000, taux: '28 %' },
    { plafond: Infinity, taux: '30 %' },
]

export default function CalculPage() {
    const [form, setForm] = useState({
        salaire_base: 0, anciennete: 0, heures_sup: 0,
        logement: 0, transport: 0, fonction: 0,
        charges: 0, cotisation: 'CNSS' as 'CNSS' | 'CARFO',
    })
    const [result, setResult] = useState<CalculResult | null>(null)

    const mut = useMutation({
        mutationFn: () => calculApi.calcul(form).then(r => r.data as CalculResult),
        onSuccess: setResult,
    })

    const numField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))

    return (
        <div>
            <div className="grid-2">
                {/* Formulaire */}
                <div className="card">
                    <div className="card-header">
                        <h3><Calculator size={15} style={{ marginRight: 6 }} />Données du salarié</h3>
                    </div>
                    <div className="card-body">
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
                                    value={form.charges} onChange={(e) => setForm(f => ({ ...f, charges: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="form-group">
                                <label>Cotisation</label>
                                <select value={form.cotisation}
                                    onChange={(e) => setForm(f => ({ ...f, cotisation: e.target.value as 'CNSS' | 'CARFO' }))}>
                                    <option value="CNSS">CNSS (5,5 %)</option>
                                    <option value="CARFO">CARFO (6 %)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex-end" style={{ marginTop: 14 }}>
                            <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
                                <Calculator size={15} /> {mut.isPending ? 'Calcul…' : 'Calculer'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Résultats */}
                <div className="card">
                    <div className="card-header"><h3>Résultat du calcul</h3></div>
                    <div className="card-body">
                        {!result ? (
                            <p className="text-sm" style={{ color: 'var(--gr5)' }}>Renseignez les données et cliquez sur Calculer.</p>
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

            {/* Barème IUTS */}
            <div className="card">
                <div className="card-header">
                    <h3>Barème IUTS mensuel (LF 2020)</h3>
                    <span className="ch-right">9 tranches progressives</span>
                </div>
                <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tranche (jusqu&apos;à)</th>
                                <th>Taux</th>
                            </tr>
                        </thead>
                        <tbody>
                            {IUTS_TRANCHES.map((t, i) => (
                                <tr key={i}>
                                    <td>{t.plafond === Infinity ? 'Au-delà de 600 000 FCFA' : `≤ ${t.plafond.toLocaleString('fr-FR')} FCFA`}</td>
                                    <td><span className="tag tag-green">{t.taux}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
