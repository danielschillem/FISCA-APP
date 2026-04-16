'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { declarationsApi } from '@/lib/api'
import type { Declaration } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { BookOpen, Printer, ChevronDown, ChevronUp } from 'lucide-react'

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const STATUT_STYLE: Record<string, { bg: string; color: string }> = {
    ok: { bg: '#dcfce7', color: '#15803d' },
    approuvee: { bg: '#dcfce7', color: '#15803d' },
    soumise: { bg: '#dbeafe', color: '#1d4ed8' },
    en_cours: { bg: '#f1f5f9', color: '#475569' },
    retard: { bg: '#fee2e2', color: '#dc2626' },
    en_retard: { bg: '#fee2e2', color: '#dc2626' },
    rejetee: { bg: '#ffedd5', color: '#c2410c' },
}

function getStatutStyle(s: string) {
    return STATUT_STYLE[s] ?? { bg: '#f1f5f9', color: '#475569' }
}

export default function BilanPage() {
    const currentYear = new Date().getFullYear()
    const [annee, setAnnee] = useState(currentYear)

    const { data: declarations = [], isLoading } = useQuery<Declaration[]>({
        queryKey: ['declarations-bilan', annee],
        queryFn: () => declarationsApi.list(1, 200).then((r) => {
            const all: Declaration[] = r.data?.data ?? r.data ?? []
            return all.filter((d) => d.annee === annee)
        }),
        staleTime: 30_000,
    })

    const totaux = declarations.reduce(
        (acc, d) => ({
            brut: acc.brut + (d.brut_total ?? 0),
            iuts: acc.iuts + (d.iuts_total ?? 0),
            tpa: acc.tpa + (d.tpa_total ?? 0),
            css: acc.css + (d.css_total ?? 0),
            total: acc.total + (d.total ?? 0),
        }),
        { brut: 0, iuts: 0, tpa: 0, css: 0, total: 0 }
    )

    const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18 }}>
                    <BookOpen size={18} /> Bilan Fiscal Annuel {annee}
                </h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select value={annee} onChange={(e) => setAnnee(+e.target.value)}
                        style={{ border: '1px solid var(--gr2)', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="btn btn-outline" onClick={() => window.print()}>
                        <Printer size={14} /> Imprimer
                    </button>
                </div>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Masse salariale brute', value: totaux.brut, color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'IUTS versé', value: totaux.iuts, color: '#15803d', bg: '#dcfce7' },
                    { label: 'TPA (patronal)', value: totaux.tpa, color: '#7c3aed', bg: '#f5f3ff' },
                    { label: 'CSS salarié', value: totaux.css, color: '#c2410c', bg: '#ffedd5' },
                    { label: 'Total obligations', value: totaux.total, color: '#1e293b', bg: '#f1f5f9' },
                ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: 12, padding: '14px 16px' }}>
                        <p style={{ fontSize: 11, color: 'var(--gr5)', marginBottom: 4 }}>{label}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color }}>{fmtFCFA(value)}</p>
                    </div>
                ))}
            </div>

            {/* Table mensuelle */}
            <div className="card">
                <div className="card-header">
                    <h3>Récapitulatif mensuel — exercice {annee}</h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    {isLoading ? (
                        <p style={{ padding: 24, textAlign: 'center', color: 'var(--gr5)' }}>Chargement…</p>
                    ) : (
                        <table style={{ width: '100%', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gr2)', background: 'var(--gr1)' }}>
                                    {['Mois', 'Nb salariés', 'Brut total', 'IUTS', 'TPA', 'CSS', 'Total', 'Statut'].map((h) => (
                                        <th key={h} style={{
                                            padding: '10px 12px', textAlign: h === 'Mois' ? 'left' : 'right',
                                            fontSize: 11, fontWeight: 600, color: 'var(--gr5)', textTransform: 'uppercase',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {declarations.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--gr5)' }}>
                                            Aucune déclaration pour {annee}
                                        </td>
                                    </tr>
                                ) : declarations.map((d) => {
                                    const style = getStatutStyle(d.statut)
                                    return (
                                        <tr key={d.id} style={{ borderBottom: '1px solid var(--gr1)' }}
                                            className="hover:bg-gray-50">
                                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                                                {MOIS_NOMS[d.mois]} {d.annee}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--gr6)' }}>
                                                {d.nb_salaries}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                                {fmtFCFA(d.brut_total)}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                                {fmtFCFA(d.iuts_total)}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                                {fmtFCFA(d.tpa_total)}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                                {fmtFCFA(d.css_total)}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                                                {fmtFCFA(d.total)}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                <span style={{
                                                    fontSize: 11, padding: '3px 8px', borderRadius: 99,
                                                    background: style.bg, color: style.color, fontWeight: 500,
                                                }}>
                                                    {d.statut}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            {declarations.length > 0 && (
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--gr2)', background: 'var(--gr1)', fontWeight: 700 }}>
                                        <td style={{ padding: '10px 12px' }}>TOTAL {annee}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                            {declarations.reduce((s, d) => s + d.nb_salaries, 0) / declarations.length | 0} moy.
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                            {fmtFCFA(totaux.brut)}
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                            {fmtFCFA(totaux.iuts)}
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                            {fmtFCFA(totaux.tpa)}
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                                            {fmtFCFA(totaux.css)}
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--green)' }}>
                                            {fmtFCFA(totaux.total)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
