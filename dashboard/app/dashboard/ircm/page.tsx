'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { calculApi } from '@/lib/api'
import { fmtFCFA } from '@/lib/utils'
import { Calculator, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'

type IRCMType = 'CREANCES' | 'OBLIGATIONS' | 'DIVIDENDES'

const TYPES: { value: IRCMType; label: string; taux: number; desc: string }[] = [
    { value: 'CREANCES', label: 'Créances & dépôts', taux: 25, desc: 'Intérêts de prêts, comptes courants, dépôts' },
    { value: 'OBLIGATIONS', label: 'Obligations & bons', taux: 6, desc: 'Intérêts d\'obligations, bons du trésor' },
    { value: 'DIVIDENDES', label: 'Dividendes & parts', taux: 12.5, desc: 'Distributions de bénéfices, parts sociales' },
]

const IRCM_TAUX: Record<IRCMType, number> = { CREANCES: 0.25, OBLIGATIONS: 0.06, DIVIDENDES: 0.125 }

function calcIRCM(brut: number, type: IRCMType) {
    const taux = IRCM_TAUX[type]
    const ircm = Math.round(brut * taux)
    return { brut, ircm, net: brut - ircm, taux }
}

export default function IRCMPage() {
    const [type, setType] = useState<IRCMType>('CREANCES')
    const [montant, setMontant] = useState(1_000_000)
    const [result, setResult] = useState<ReturnType<typeof calcIRCM> | null>(null)

    const saveMut = useMutation({
        mutationFn: () => calculApi.ircm({ montant_brut: montant, type_revenu: type }),
        onSuccess: () => toast.success('IRCM enregistré'),
        onError: () => toast.error('Erreur lors de l\'enregistrement'),
    })

    const compute = () => setResult(calcIRCM(montant, type))

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Landmark size={18} /> IRCM — Impôt sur les Revenus des Capitaux Mobiliers
                </h2>
                <p className="text-sm" style={{ color: 'var(--gr5)' }}>
                    CGI 2025 — Art. 140-156 · Retenue libératoire à la source
                </p>
            </div>

            <div className="grid-2">
                {/* Formulaire */}
                <div className="card">
                    <div className="card-header"><h3>Type de revenu</h3></div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {TYPES.map((t) => (
                                <label key={t.value} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    padding: '12px 14px', borderRadius: 10,
                                    border: `2px solid ${type === t.value ? 'var(--green)' : 'var(--gr2)'}`,
                                    background: type === t.value ? 'var(--green-light)' : 'white',
                                    cursor: 'pointer',
                                }}>
                                    <input type="radio" name="ircm-type" value={t.value}
                                        checked={type === t.value} onChange={() => setType(t.value)}
                                        style={{ marginTop: 3 }} />
                                    <div>
                                        <p style={{ fontWeight: 600, fontSize: 14 }}>
                                            {t.label} — <span style={{ color: 'var(--green)' }}>{t.taux} %</span>
                                        </p>
                                        <p style={{ fontSize: 12, color: 'var(--gr5)', marginTop: 2 }}>{t.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="form-group" style={{ marginTop: 16 }}>
                            <label>Montant brut des revenus (FCFA)</label>
                            <input type="number" value={montant}
                                onChange={(e) => setMontant(+e.target.value)} />
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
                    <div className="card-header"><h3>Résultat IRCM</h3></div>
                    <div className="card-body">
                        {!result ? (
                            <p className="text-sm" style={{ color: 'var(--gr5)' }}>Sélectionnez un type et cliquez sur Calculer.</p>
                        ) : (
                            <>
                                <div className="recap-card">
                                    <div className="recap-line">
                                        <span className="recap-label">Revenu brut</span>
                                        <span className="recap-value">{fmtFCFA(result.brut)}</span>
                                    </div>
                                    <div className="recap-line">
                                        <span className="recap-label">IRCM ({(result.taux * 100).toFixed(1)} %)</span>
                                        <span className="recap-value" style={{ color: '#dc2626' }}>
                                            − {fmtFCFA(result.ircm)}
                                        </span>
                                    </div>
                                    <div className="recap-line">
                                        <span className="recap-label">Net versé au bénéficiaire</span>
                                        <span className="recap-value">{fmtFCFA(result.net)}</span>
                                    </div>
                                </div>
                                <div style={{
                                    background: 'var(--gr9)', color: 'white', borderRadius: 10,
                                    padding: '14px 16px', marginTop: 12,
                                }}>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)' }}>IRCM à reverser au Trésor</p>
                                    <p style={{ fontSize: 24, fontWeight: 700 }}>{fmtFCFA(result.ircm)}</p>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>
                                        Taux : {(result.taux * 100).toFixed(1)} % · Retenue libératoire
                                    </p>
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
                        <li>• Art. 140 : Sont imposables les revenus des capitaux mobiliers de source burkinabè</li>
                        <li>• Art. 143 : Créances & dépôts — Taux 25 %</li>
                        <li>• Art. 144 : Obligations & bons du trésor — Taux 6 %</li>
                        <li>• Art. 145 : Dividendes & parts sociales — Taux 12,5 %</li>
                        <li>• Retenue à la source opérée par le débiteur lors du paiement</li>
                        <li>• Reversement avant le 15 du mois suivant le paiement</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
