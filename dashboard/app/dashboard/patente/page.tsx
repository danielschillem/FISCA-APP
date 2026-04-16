'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { calculApi } from '@/lib/api'
import { fmtFCFA, fmtN } from '@/lib/utils'
import { Calculator, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'

const PATENTE_A = [
    { max: 5_000_000, droit: 10_000 }, { max: 7_000_000, droit: 15_000 },
    { max: 10_000_000, droit: 25_000 }, { max: 15_000_000, droit: 40_000 },
    { max: 20_000_000, droit: 60_000 }, { max: 30_000_000, droit: 85_000 },
    { max: 50_000_000, droit: 120_000 }, { max: 75_000_000, droit: 170_000 },
    { max: 100_000_000, droit: 220_000 }, { max: 150_000_000, droit: 280_000 },
    { max: 200_000_000, droit: 350_000 }, { max: 300_000_000, droit: 430_000 },
    { max: 500_000_000, droit: 530_000 }, { max: Infinity, droit: 660_000 },
]

const DROITS_FIXES_DISPLAY = [
    { tranche: 'CA < 5 M', droit: 10_000 },
    { tranche: '5 M – 7 M', droit: 15_000 },
    { tranche: '7 M – 10 M', droit: 25_000 },
    { tranche: '10 M – 15 M', droit: 40_000 },
    { tranche: '15 M – 20 M', droit: 60_000 },
    { tranche: '20 M – 30 M', droit: 85_000 },
    { tranche: '30 M – 50 M', droit: 120_000 },
    { tranche: '50 M – 75 M', droit: 170_000 },
    { tranche: '75 M – 100 M', droit: 220_000 },
    { tranche: '100 M – 150 M', droit: 280_000 },
    { tranche: '150 M – 200 M', droit: 350_000 },
    { tranche: '200 M – 300 M', droit: 430_000 },
    { tranche: '300 M – 500 M', droit: 530_000 },
    { tranche: '> 500 M', droit: 660_000 },
]

function calcPatente(ca: number, valeurLocative: number) {
    let droitFixe = 0
    for (const t of PATENTE_A) { if (ca <= t.max) { droitFixe = t.droit; break } }
    const droitProp = Math.round(valeurLocative * 0.01)
    return { ca, droitFixe, valeurLocative, droitProp, totalPatente: droitFixe + droitProp }
}

export default function PatentePage() {
    const [ca, setCa] = useState(100_000_000)
    const [valeurLocative, setValeurLocative] = useState(2_400_000)
    const [result, setResult] = useState<ReturnType<typeof calcPatente> | null>(null)

    const saveMut = useMutation({
        mutationFn: () => calculApi.patente({ ca, valeur_locative: valeurLocative }),
        onSuccess: () => toast.success('Patente enregistrée'),
        onError: () => toast.error('Erreur lors de l\'enregistrement'),
    })

    const compute = () => setResult(calcPatente(ca, valeurLocative))
    const currentDroit = calcPatente(ca, 0).droitFixe

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Briefcase size={18} /> Patente Professionnelle
                </h2>
                <p className="text-sm" style={{ color: 'var(--gr5)' }}>
                    CGI 2025 — Art. 237-240 · Droit fixe (tableau A) + 1 % valeur locative
                </p>
            </div>

            <div className="grid-2">
                {/* Formulaire */}
                <div className="card">
                    <div className="card-header"><h3>Paramètres</h3></div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Chiffre d'affaires annuel HT (FCFA)</label>
                                <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Valeur locative annuelle des locaux (FCFA)</label>
                                <input type="number" value={valeurLocative} onChange={(e) => setValeurLocative(+e.target.value)} />
                                <p style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 4 }}>= Loyer mensuel × 12 si locataire</p>
                            </div>
                        </div>
                        <div className="flex-end" style={{ marginTop: 16, gap: 8 }}>
                            <button className="btn btn-primary" onClick={compute}>
                                <Calculator size={14} /> Calculer
                            </button>
                            {result && (
                                <button className="btn btn-outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                                    {saveMut.isPending ? 'Enregistrement…' : '💾 Enregistrer'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Résultats */}
                <div className="card">
                    <div className="card-header"><h3>Résultat Patente</h3></div>
                    <div className="card-body">
                        {!result ? (
                            <p className="text-sm" style={{ color: 'var(--gr5)' }}>Renseignez les données et cliquez sur Calculer.</p>
                        ) : (
                            <>
                                <div className="recap-card">
                                    <div className="recap-line">
                                        <span className="recap-label">Droit fixe (tableau A)</span>
                                        <span className="recap-value">{fmtFCFA(result.droitFixe)}</span>
                                    </div>
                                    <div className="recap-line">
                                        <span className="recap-label">Droit proportionnel (1 % VL)</span>
                                        <span className="recap-value">{fmtFCFA(result.droitProp)}</span>
                                    </div>
                                </div>
                                <div style={{
                                    background: 'var(--gr9)', color: 'white', borderRadius: 10,
                                    padding: '14px 16px', marginTop: 12,
                                }}>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)' }}>Patente totale à payer</p>
                                    <p style={{ fontSize: 24, fontWeight: 700 }}>{fmtFCFA(result.totalPatente)}</p>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>
                                        CA : {fmtN(result.ca)} FCFA
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Tableau des droits fixes */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header"><h3>Tableau A — Droits fixes (Art. 238 CGI 2025)</h3></div>
                <div className="card-body">
                    <table style={{ width: '100%', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--gr2)', color: 'var(--gr5)', fontSize: 11 }}>
                                <th style={{ textAlign: 'left', paddingBottom: 8 }}>Tranche de CA</th>
                                <th style={{ textAlign: 'right', paddingBottom: 8 }}>Droit fixe (FCFA)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DROITS_FIXES_DISPLAY.map((d) => (
                                <tr key={d.tranche} style={{
                                    borderBottom: '1px solid var(--gr1)',
                                    background: currentDroit === d.droit ? 'var(--green-light)' : 'transparent',
                                    fontWeight: currentDroit === d.droit ? 600 : 400,
                                }}>
                                    <td style={{ padding: '7px 0', color: 'var(--gr7)' }}>{d.tranche}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtN(d.droit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <ul style={{ fontSize: 12, color: 'var(--gr5)', lineHeight: 1.8, marginTop: 12 }}>
                        <li>• Art. 237 : Toute personne physique ou morale exerçant une activité commerciale</li>
                        <li>• Art. 239 : Droit proportionnel = 1 % de la valeur locative des locaux professionnels</li>
                        <li>• Art. 240 : Paiement avant le 31 mars de l'année d'imposition</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
