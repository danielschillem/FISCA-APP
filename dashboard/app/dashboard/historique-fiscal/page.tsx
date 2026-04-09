'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { historiqueFiscalApi } from '@/lib/api'
import type { HistoriqueFiscalAnnee } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { History, ChevronDown, ChevronRight } from 'lucide-react'

const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default function HistoriqueFiscalPage() {
    const [annee, setAnnee] = useState(new Date().getFullYear())
    const [expanded, setExpanded] = useState(false)

    const { data: annees = [] } = useQuery<number[]>({
        queryKey: ['historique-fiscal-annees'],
        queryFn: () => historiqueFiscalApi.annees().then(r => r.data?.data ?? r.data ?? []),
        staleTime: 60_000,
    })

    const { data: histo, isLoading } = useQuery<HistoriqueFiscalAnnee>({
        queryKey: ['historique-fiscal', annee],
        queryFn: () => historiqueFiscalApi.get(annee).then(r => r.data),
        staleTime: 30_000,
    })

    const chartData = (histo?.mois ?? []).map((m, i) => ({
        name: MOIS_COURT[i],
        IUTS: m.iuts_total,
        TPA: m.tpa_total,
        CNSS: m.css_total + m.cnss_patronal,
        TVA: m.tva_nette,
        Retenues: m.retenue_total,
    }))

    const kpis = histo ? [
        { label: 'IUTS total', val: histo.iuts_total, color: '#24a05a' },
        { label: 'TPA total', val: histo.tpa_total, color: '#f97316' },
        { label: 'CSS salarial', val: histo.css_total, color: '#3b82f6' },
        { label: 'CNSS patronal', val: histo.cnss_patronal, color: '#8b5cf6' },
        { label: 'TVA nette', val: histo.tva_nette, color: '#06b6d4' },
        { label: 'Retenues source', val: histo.retenue_total, color: '#ef4444' },
    ] : []

    return (
        <div>
            {/* Sélecteur d'année */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Année fiscale :</label>
                <select
                    value={annee}
                    onChange={e => setAnnee(+e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--gr2)', fontSize: 14 }}
                >
                    {annees.length > 0
                        ? annees.map(a => <option key={a} value={a}>{a}</option>)
                        : <option value={annee}>{annee}</option>
                    }
                </select>
            </div>

            {isLoading ? (
                <div className="card card-body">
                    <p style={{ color: 'var(--gr5)', fontSize: 13 }}>Chargement…</p>
                </div>
            ) : (
                <>
                    {/* KPIs annuels */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 12, marginBottom: 16,
                    }}>
                        {kpis.map(({ label, val, color }) => (
                            <div key={label} className="card" style={{ padding: '14px 16px' }}>
                                <p style={{ fontSize: 11, color: 'var(--gr5)', margin: 0 }}>{label}</p>
                                <p style={{ fontSize: 18, fontWeight: 700, color, margin: '4px 0 0' }}>
                                    {fmtFCFA(val)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Total obligations */}
                    {histo && (
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                <div>
                                    <p style={{ fontSize: 12, color: 'var(--gr5)', margin: 0 }}>Total obligations fiscales & sociales {annee}</p>
                                    <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--gr9)', margin: '4px 0 0' }}>
                                        {fmtFCFA(histo.total_obligations)}
                                    </p>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--gr5)', textAlign: 'right' }}>
                                    <p style={{ margin: 0 }}>IUTS + TPA + CNSS + TVA + Retenues</p>
                                    <p style={{ margin: '2px 0 0' }}>Source : déclarations validées dans FISCA</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Graphique */}
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-header">
                            <h3>Évolution mensuelle {annee}</h3>
                            <span className="ch-right">toutes obligations</span>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={chartData} barCategoryGap="30%">
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} FCFA`} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="IUTS" fill="#24a05a" radius={[3, 3, 0, 0]} stackId="a" />
                                    <Bar dataKey="TPA" fill="#f97316" radius={[0, 0, 0, 0]} stackId="a" />
                                    <Bar dataKey="CNSS" fill="#3b82f6" radius={[0, 0, 0, 0]} stackId="a" />
                                    <Bar dataKey="TVA" fill="#06b6d4" radius={[0, 0, 0, 0]} stackId="a" />
                                    <Bar dataKey="Retenues" fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tableau mensuel détaillé */}
                    <div className="card">
                        <div
                            className="card-header"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setExpanded(v => !v)}
                        >
                            <h3>
                                {expanded ? <ChevronDown size={14} style={{ marginRight: 6 }} /> : <ChevronRight size={14} style={{ marginRight: 6 }} />}
                                <History size={14} style={{ marginRight: 6 }} />
                                Détail mensuel
                            </h3>
                        </div>
                        {expanded && (
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Mois</th>
                                            <th className="text-right">IUTS</th>
                                            <th className="text-right">TPA</th>
                                            <th className="text-right">CSS sal.</th>
                                            <th className="text-right">CNSS pat.</th>
                                            <th className="text-right">TVA nette</th>
                                            <th className="text-right">Retenues</th>
                                            <th className="text-right" style={{ fontWeight: 700 }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(histo?.mois ?? []).map(m => (
                                            <tr key={m.mois} style={{
                                                background: m.total_obligations === 0 ? 'var(--gr1)' : undefined,
                                                color: m.total_obligations === 0 ? 'var(--gr4)' : undefined,
                                            }}>
                                                <td>{m.periode}</td>
                                                <td className="text-right">{fmtFCFA(m.iuts_total)}</td>
                                                <td className="text-right">{fmtFCFA(m.tpa_total)}</td>
                                                <td className="text-right">{fmtFCFA(m.css_total)}</td>
                                                <td className="text-right">{fmtFCFA(m.cnss_patronal)}</td>
                                                <td className="text-right">{fmtFCFA(m.tva_nette)}</td>
                                                <td className="text-right">{fmtFCFA(m.retenue_total)}</td>
                                                <td className="text-right" style={{ fontWeight: 600, color: m.total_obligations > 0 ? 'var(--prime)' : undefined }}>
                                                    {fmtFCFA(m.total_obligations)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'var(--gr1)', fontWeight: 700 }}>
                                            <td>TOTAL {annee}</td>
                                            <td className="text-right">{fmtFCFA(histo?.iuts_total ?? 0)}</td>
                                            <td className="text-right">{fmtFCFA(histo?.tpa_total ?? 0)}</td>
                                            <td className="text-right">{fmtFCFA(histo?.css_total ?? 0)}</td>
                                            <td className="text-right">{fmtFCFA(histo?.cnss_patronal ?? 0)}</td>
                                            <td className="text-right">{fmtFCFA(histo?.tva_nette ?? 0)}</td>
                                            <td className="text-right">{fmtFCFA(histo?.retenue_total ?? 0)}</td>
                                            <td className="text-right" style={{ color: 'var(--prime)' }}>
                                                {fmtFCFA(histo?.total_obligations ?? 0)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
