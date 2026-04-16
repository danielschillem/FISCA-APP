'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { calculApi } from '@/lib/api'
import { fmtFCFA } from '@/lib/utils'
import { Calculator, Home } from 'lucide-react'
import toast from 'react-hot-toast'

function calcIRF(loyerBrut: number) {
    const abatt = Math.round(loyerBrut * 0.50)
    const base = loyerBrut - abatt
    const seuil = 100_000
    let irf1 = 0, irf2 = 0
    if (base <= seuil) {
        irf1 = Math.round(base * 0.18)
    } else {
        irf1 = Math.round(seuil * 0.18)
        irf2 = Math.round((base - seuil) * 0.25)
    }
    const irfTotal = irf1 + irf2
    return {
        loyerBrut, abattement: abatt, baseNette: base,
        irf1, irf2, irfTotal, loyerNet: loyerBrut - irfTotal,
        tauxEffectif: loyerBrut > 0 ? (irfTotal / loyerBrut * 100).toFixed(2) : '0',
    }
}

export default function IRFPage() {
    const [loyerBrut, setLoyerBrut] = useState(500_000)
    const [result, setResult] = useState<ReturnType<typeof calcIRF> | null>(null)

    const saveMut = useMutation({
        mutationFn: () => calculApi.irf({ loyer_brut: loyerBrut }),
        onSuccess: () => toast.success('IRF enregistré'),
        onError: () => toast.error('Erreur lors de l\'enregistrement'),
    })

    const compute = () => setResult(calcIRF(loyerBrut))

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Home size={18} /> IRF — Impôt sur les Revenus Fonciers
                </h2>
                <p className="text-sm" style={{ color: 'var(--gr5)' }}>
                    CGI 2025 — Art. 121-126 · Abattement 50 % · Taux progressif 18 % / 25 %
                </p>
            </div>

            <div className="grid-2">
                {/* Formulaire */}
                <div className="card">
                    <div className="card-header"><h3>Paramètres</h3></div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Loyer brut annuel (FCFA)</label>
                            <input type="number" value={loyerBrut}
                                onChange={(e) => setLoyerBrut(+e.target.value)} />
                            <p style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 4 }}>
                                = loyer mensuel × 12 mois
                            </p>
                        </div>
                        <div style={{
                            background: 'var(--gr1)', borderRadius: 8, padding: '10px 14px',
                            marginTop: 12, fontSize: 13, color: 'var(--gr6)', lineHeight: 1.7,
                        }}>
                            <strong>Mode de calcul :</strong>
                            <br />• Abattement forfaitaire de 50 % sur le loyer brut
                            <br />• Tranche 0–100 000 FCFA (base nette) : 18 %
                            <br />• Au-delà de 100 000 FCFA : 25 %
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
                    <div className="card-header"><h3>Résultat IRF</h3></div>
                    <div className="card-body">
                        {!result ? (
                            <p className="text-sm" style={{ color: 'var(--gr5)' }}>Renseignez le loyer brut et cliquez sur Calculer.</p>
                        ) : (
                            <>
                                <div className="recap-card">
                                    {[
                                        { l: 'Loyer brut', v: fmtFCFA(result.loyerBrut) },
                                        { l: 'Abattement 50 %', v: fmtFCFA(result.abattement) },
                                        { l: 'Base nette imposable', v: fmtFCFA(result.baseNette) },
                                        { l: 'IRF tranche 18 % (≤ 100 000)', v: fmtFCFA(result.irf1) },
                                        { l: 'IRF tranche 25 % (> 100 000)', v: fmtFCFA(result.irf2) },
                                        { l: 'Loyer net après impôt', v: fmtFCFA(result.loyerNet) },
                                    ].map(({ l, v }) => (
                                        <div key={l} className="recap-line">
                                            <span className="recap-label">{l}</span>
                                            <span className="recap-value">{v}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{
                                    background: 'var(--gr9)', color: 'white', borderRadius: 10,
                                    padding: '14px 16px', marginTop: 12,
                                }}>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)' }}>
                                        IRF total dû (taux effectif : {result.tauxEffectif} %)
                                    </p>
                                    <p style={{ fontSize: 24, fontWeight: 700 }}>{fmtFCFA(result.irfTotal)}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Base légale */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header"><h3>Base légale — CGI 2025</h3></div>
                <div className="card-body">
                    <ul style={{ fontSize: 13, color: 'var(--gr6)', lineHeight: 1.8 }}>
                        <li>• Art. 121 : Revenus provenant de la location d'immeubles bâtis et non bâtis</li>
                        <li>• Art. 122 : Abattement forfaitaire de 50 % sur le loyer brut annuel</li>
                        <li>• Art. 124 : Taux progressif — 18 % jusqu'à 100 000 FCFA de base nette, 25 % au-delà</li>
                        <li>• Déclaration annuelle avant le 30 avril de l'année suivante</li>
                        <li>• Retenue à la source opérée par le locataire (personne morale)</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
