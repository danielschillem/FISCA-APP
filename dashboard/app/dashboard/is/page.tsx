'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { calculApi } from '@/lib/api'
import { fmtFCFA } from '@/lib/utils'
import { Calculator, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

type Regime = 'reel' | 'simplifie'

function calcIS(benefice: number, cga: boolean) {
    let is = Math.round(benefice * 0.275)
    if (cga) is = Math.round(is * 0.70)
    return { benefice, is }
}

function calcMFP(ca: number, regime: Regime, cga: boolean) {
    const calc = Math.round(ca * 0.005)
    const minimum = regime === 'simplifie' ? 300_000 : 1_000_000
    let mfpDu = Math.max(calc, minimum)
    if (cga) mfpDu = Math.round(mfpDu * 0.50)
    return { ca, mfpCalcule: calc, mfpMinimum: minimum, mfpDu }
}

export default function ISPage() {
    const [ca, setCa] = useState(500_000_000)
    const [benefice, setBenefice] = useState(50_000_000)
    const [regime, setRegime] = useState<Regime>('reel')
    const [cga, setCga] = useState(false)
    const [result, setResult] = useState<{
        isTheorique: number; mfpDu: number; mfpMinimum: number; dû: number; mode: string
    } | null>(null)

    const saveMut = useMutation({
        mutationFn: async () => {
            await calculApi.is({ ca, benefice, regime, cga })
            await calculApi.mfp({ ca, regime })
        },
        onSuccess: () => toast.success('IS / MFP enregistré'),
        onError: () => toast.error('Erreur lors de l\'enregistrement'),
    })

    const compute = () => {
        const isRes = calcIS(benefice, cga)
        const mfpRes = calcMFP(ca, regime, cga)
        const dû = Math.max(isRes.is, mfpRes.mfpDu)
        setResult({
            isTheorique: isRes.is,
            mfpDu: mfpRes.mfpDu,
            mfpMinimum: mfpRes.mfpMinimum,
            dû,
            mode: isRes.is >= mfpRes.mfpDu ? 'IS théorique' : 'MFP (minimum)',
        })
    }

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} /> IS / MFP — Impôt sur les Sociétés / Minimum Forfaitaire Patronal
                </h2>
                <p className="text-sm" style={{ color: 'var(--gr5)' }}>
                    CGI 2025 — Art. 42 (IS 27,5 %) · Art. 40 (MFP 0,5 % du CA)
                </p>
            </div>

            <div className="grid-2">
                {/* Formulaire */}
                <div className="card">
                    <div className="card-header"><h3>Paramètres</h3></div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Régime fiscal</label>
                            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                                {[
                                    { v: 'reel', l: 'Régime du réel' },
                                    { v: 'simplifie', l: 'Régime simplifié' },
                                ].map(({ v, l }) => (
                                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                                        <input type="radio" name="regime" value={v}
                                            checked={regime === v} onChange={() => setRegime(v as Regime)} />
                                        {l}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="form-grid" style={{ marginTop: 12 }}>
                            <div className="form-group">
                                <label>Chiffre d'affaires HT (FCFA)</label>
                                <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Bénéfice imposable (FCFA)</label>
                                <input type="number" value={benefice} onChange={(e) => setBenefice(+e.target.value)} />
                            </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 14 }}>
                            <input type="checkbox" checked={cga} onChange={(e) => setCga(e.target.checked)} />
                            Adhérent CGA (réduction IS −30 %, MFP −50 %)
                        </label>
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
                    <div className="card-header"><h3>Résultat IS / MFP</h3></div>
                    <div className="card-body">
                        {!result ? (
                            <p className="text-sm" style={{ color: 'var(--gr5)' }}>Renseignez les données et cliquez sur Calculer.</p>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                    <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 14px' }}>
                                        <p style={{ fontSize: 11, color: 'var(--gr5)' }}>IS théorique (27,5 %)</p>
                                        <p style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>{fmtFCFA(result.isTheorique)}</p>
                                        {cga && <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>Après réduction CGA (−30 %)</p>}
                                    </div>
                                    <div style={{ background: '#fff7ed', borderRadius: 10, padding: '12px 14px' }}>
                                        <p style={{ fontSize: 11, color: 'var(--gr5)' }}>MFP minimum (0,5 % CA)</p>
                                        <p style={{ fontSize: 18, fontWeight: 700, color: '#c2410c' }}>{fmtFCFA(result.mfpDu)}</p>
                                        <p style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 4 }}>
                                            Plancher : {fmtFCFA(result.mfpMinimum)}
                                        </p>
                                    </div>
                                </div>
                                <div style={{
                                    background: 'var(--gr9)', color: 'white', borderRadius: 10,
                                    padding: '14px 16px',
                                }}>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)' }}>Impôt dû ({result.mode})</p>
                                    <p style={{ fontSize: 24, fontWeight: 700 }}>{fmtFCFA(result.dû)}</p>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>
                                        = max(IS théorique, MFP minimum)
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
                        <li>• Art. 42 : IS au taux de 27,5 % du bénéfice net imposable</li>
                        <li>• Art. 40 : MFP = 0,5 % du chiffre d'affaires (minimum garanti)</li>
                        <li>• L'impôt dû est le maximum entre IS théorique et MFP</li>
                        <li>• Déclaration et paiement : avant le 30 avril de l'année suivante</li>
                        <li>• Acomptes trimestriels de 25 % du dernier IS payé</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
