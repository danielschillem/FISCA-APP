'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { calculApi } from '@/lib/api'
import { fmtFCFA } from '@/lib/utils'
import { Calculator, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Zone = 'A' | 'B' | 'C' | 'D'

const ZONES: { value: Zone; label: string; desc: string }[] = [
    { value: 'A', label: 'Zone A', desc: 'Ouagadougou, Bobo-Dioulasso' },
    { value: 'B', label: 'Zone B', desc: 'Villes secondaires (Koudougou, Ouahigouya…)' },
    { value: 'C', label: 'Zone C', desc: 'Autres centres urbains' },
    { value: 'D', label: 'Zone D', desc: 'Zones rurales et périurbaines' },
]

const CME_TARIFS: Record<Zone, number[]> = {
    A: [200000, 160000, 120000, 80000, 60000, 30000, 20000, 10000],
    B: [160000, 120000, 80000, 60000, 42000, 20000, 12000, 6000],
    C: [120000, 80000, 54000, 42000, 30000, 12000, 9000, 2500],
    D: [80000, 48000, 30000, 18000, 14000, 6000, 3500, 2000],
}

const CME_TRANCHES = [
    { max: 1_500_000, classe: 8 }, { max: 3_000_000, classe: 7 }, { max: 5_000_000, classe: 6 },
    { max: 7_000_000, classe: 5 }, { max: 9_000_000, classe: 4 }, { max: 11_000_000, classe: 3 },
    { max: 13_000_000, classe: 2 }, { max: 15_000_000, classe: 1 },
]

const CLASS_LABELS = [
    'Classe 1 (< 15 M)', 'Classe 2 (13–15 M)', 'Classe 3 (11–13 M)',
    'Classe 4 (9–11 M)', 'Classe 5 (7–9 M)', 'Classe 6 (5–7 M)',
    'Classe 7 (3–5 M)', 'Classe 8 (< 3 M)',
]

function calcCME(ca: number, zone: Zone, cga: boolean) {
    let classe = 1
    for (const t of CME_TRANCHES) { if (ca <= t.max) { classe = t.classe; break } }
    const tarifs = CME_TARIFS[zone]
    const cme = tarifs[classe - 1]
    return { ca, zone, classe, cme, cmeNet: cga ? Math.round(cme * 0.75) : cme }
}

export default function CMEPage() {
    const [ca, setCa] = useState(8_000_000)
    const [zone, setZone] = useState<Zone>('A')
    const [cga, setCga] = useState(false)
    const [result, setResult] = useState<ReturnType<typeof calcCME> | null>(null)

    const saveMut = useMutation({
        mutationFn: () => calculApi.cme({ ca, zone, cga }),
        onSuccess: () => toast.success('CME enregistrée'),
        onError: () => toast.error('Erreur lors de l\'enregistrement'),
    })

    const compute = () => setResult(calcCME(ca, zone, cga))

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={18} /> CME — Contribution des Micro-Entreprises
                </h2>
                <p className="text-sm" style={{ color: 'var(--gr5)' }}>
                    CGI 2025 — Art. 533-542 · Régime simplifié pour CA ≤ 15 M FCFA
                </p>
            </div>

            <div className="grid-2">
                {/* Formulaire */}
                <div className="card">
                    <div className="card-header"><h3>Paramètres</h3></div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Chiffre d'affaires annuel HT (FCFA)</label>
                            <input type="number" value={ca}
                                onChange={(e) => setCa(+e.target.value)} />
                        </div>

                        <div className="form-group" style={{ marginTop: 12 }}>
                            <label>Zone d'activité</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                                {ZONES.map((z) => (
                                    <label key={z.value} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 8,
                                        padding: '10px 12px', borderRadius: 8,
                                        border: `2px solid ${zone === z.value ? 'var(--green)' : 'var(--gr2)'}`,
                                        background: zone === z.value ? 'var(--green-light)' : 'white',
                                        cursor: 'pointer', fontSize: 13,
                                    }}>
                                        <input type="radio" value={z.value} checked={zone === z.value}
                                            onChange={() => setZone(z.value)} style={{ marginTop: 2 }} />
                                        <div>
                                            <strong>{z.label}</strong>
                                            <p style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 2 }}>{z.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 14 }}>
                            <input type="checkbox" checked={cga} onChange={(e) => setCga(e.target.checked)} />
                            Adhérent CGA — réduction 25 %
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
                    <div className="card-header"><h3>Résultat CME</h3></div>
                    <div className="card-body">
                        {!result ? (
                            <p className="text-sm" style={{ color: 'var(--gr5)' }}>Renseignez les données et cliquez sur Calculer.</p>
                        ) : (
                            <>
                                <div className="recap-card">
                                    <div className="recap-line">
                                        <span className="recap-label">Classe tarifaire</span>
                                        <span className="recap-value">{CLASS_LABELS[result.classe - 1]}</span>
                                    </div>
                                    <div className="recap-line">
                                        <span className="recap-label">Zone</span>
                                        <span className="recap-value">{result.zone}</span>
                                    </div>
                                    <div className="recap-line">
                                        <span className="recap-label">CME brute</span>
                                        <span className="recap-value">{fmtFCFA(result.cme)}</span>
                                    </div>
                                    {cga && (
                                        <div className="recap-line">
                                            <span className="recap-label">Réduction CGA (−25 %)</span>
                                            <span className="recap-value" style={{ color: 'var(--green)' }}>
                                                − {fmtFCFA(result.cme - result.cmeNet)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    background: 'var(--gr9)', color: 'white', borderRadius: 10,
                                    padding: '14px 16px', marginTop: 12,
                                }}>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)' }}>CME finale à payer</p>
                                    <p style={{ fontSize: 24, fontWeight: 700 }}>{fmtFCFA(result.cmeNet)}</p>
                                    <p style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>
                                        CA : {fmtFCFA(result.ca)} — Zone {result.zone}
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
                        <li>• Art. 533 : CME applicable aux micro-entreprises (CA ≤ 15 M FCFA)</li>
                        <li>• 8 classes tarifaires selon CA et zone géographique (A, B, C, D)</li>
                        <li>• Art. 537 : Réduction de 25 % pour les adhérents d'un CGA agréé</li>
                        <li>• Paiement annuel avant le 30 avril</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
