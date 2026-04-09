'use client'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, declarationsApi } from '@/lib/api'
import { fmtFCFA } from '@/lib/utils'
import type { DashboardData, Declaration } from '@/types'
import StatCard from '@/components/StatCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
    AlertTriangle, CheckCircle2, Clock,
    ClipboardList, Calculator, FileText,
    Users, TrendingUp, Send, RefreshCw, BarChart2,
    Banknote, Receipt, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import Link from 'next/link'
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function EvoBadge({ pct }: { pct: number }) {
    if (!pct) return null
    const up = pct > 0
    return (
        <span style={{ fontSize: 11, color: up ? '#22c55e' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(pct).toFixed(1)}%
        </span>
    )
}

export default function DashboardPage() {
    const { data: dash } = useQuery<DashboardData>({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.get().then(r => r.data),
        staleTime: 30_000,
    })
    const { data: decls = [] } = useQuery<Declaration[]>({
        queryKey: ['declarations'],
        queryFn: () => declarationsApi.list().then((r) => r.data),
    })

    const mc = dash?.mois_courant
    const ta = dash?.total_annee
    const alertes = dash?.alertes_retard ?? []
    const plan = dash?.plan

    const chartData = decls.slice(0, 6).reverse()
        .map(d => ({ name: d.periode.split(' ')[0], iuts: d.iuts_total, tpa: d.tpa_total }))

    const nowM = new Date().getMonth()
    const calMonths = MOIS.map((m, i) => {
        const has = decls.some(d => d.mois === i + 1 && d.annee === new Date().getFullYear())
        return { label: m, cls: i < nowM ? (has ? 'done' : 'missed') : i === nowM ? 'current' : 'pending' }
    })

    return (
        <div>
            {alertes.length > 0 && (
                <div className="alert alert-red">
                    <AlertTriangle size={17} />
                    <div>
                        <strong>Déclaration(s) en retard — </strong>
                        {alertes.map(a => a.periode).join(', ')} · Déclarez dès que possible pour éviter les pénalités.
                    </div>
                </div>
            )}

            <div className="stats-grid">
                <StatCard label={`IUTS ${mc?.periode ?? 'mois courant'}`}
                    value={fmtFCFA(mc?.iuts_total ?? 0)}
                    sub={<>vs préc. {fmtFCFA(dash?.mois_precedent?.iuts_total ?? 0)}<EvoBadge pct={dash?.evolution_iuts_pct ?? 0} /></>}
                    color="green" icon={<Banknote size={48} />} />
                <StatCard label={`TPA ${mc?.periode ?? ''}`}
                    value={fmtFCFA(mc?.tpa_total ?? 0)}
                    sub="Taxe patronale apprentissage" color="orange" icon={<Receipt size={48} />} />
                <StatCard label="Masse salariale annuelle"
                    value={fmtFCFA(ta?.brut_total ?? 0)}
                    sub={`IUTS annuel : ${fmtFCFA(ta?.iuts_total ?? 0)}`}
                    color="blue" icon={<TrendingUp size={48} />} />
                <StatCard label="Effectif"
                    value={String(dash?.nb_employes ?? 0)}
                    sub={plan ? (plan.limite_employes === -1 ? 'Illimité' : `Limite : ${plan.limite_employes}`) : 'Employés actifs'}
                    color="green" icon={<Users size={48} />} />
            </div>

            <div className="card">
                <div className="card-header"><h3>Actions rapides</h3></div>
                <div className="card-body">
                    <div className="quick-actions">
                        <Link href="/dashboard/saisie" className="qa-btn"><ClipboardList size={22} />Saisir</Link>
                        <Link href="/dashboard/calcul" className="qa-btn"><Calculator size={22} />Calculer</Link>
                        <Link href="/dashboard/historique" className="qa-btn"><FileText size={22} />Historique</Link>
                        <Link href="/dashboard/saisie" className="qa-btn"><Users size={22} />Employés</Link>
                        <Link href="/dashboard/historique" className="qa-btn"><BarChart2 size={22} />Rapport</Link>
                        <Link href="/dashboard/historique" className="qa-btn"><Send size={22} />Télédéclarer</Link>
                        <Link href="/dashboard/simulateur" className="qa-btn"><RefreshCw size={22} />Simuler</Link>
                        <Link href="/dashboard/bulletins" className="qa-btn"><TrendingUp size={22} />Bulletins</Link>
                    </div>
                </div>
            </div>

            <div className="grid-3">
                <div>
                    {chartData.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h3>Évolution IUTS &amp; TPA</h3>
                                <span className="ch-right">6 dernières périodes</span>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={chartData} barCategoryGap="35%">
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} FCFA`} />
                                        <Bar dataKey="iuts" name="IUTS" fill="#24a05a" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="tpa" name="TPA" fill="#f97316" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    <div className="card">
                        <div className="card-header">
                            <h3>Historique récent</h3>
                            <Link href="/dashboard/historique" className="btn btn-sm btn-outline">Tout voir</Link>
                        </div>
                        {decls.length === 0 ? (
                            <div className="card-body"><p className="text-sm" style={{ color: 'var(--gr5)' }}>Aucune déclaration enregistrée.</p></div>
                        ) : (
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead><tr><th>Période</th><th>IUTS</th><th>TPA</th><th>Total</th><th>Statut</th></tr></thead>
                                    <tbody>
                                        {decls.slice(0, 5).map((d) => (
                                            <tr key={d.id}>
                                                <td className="td-name">{d.periode}</td>
                                                <td className="td-num">{fmtFCFA(d.iuts_total)}</td>
                                                <td className="td-num">{fmtFCFA(d.tpa_total)}</td>
                                                <td className="td-num bold">{fmtFCFA(d.total)}</td>
                                                <td>
                                                    {['ok', 'approuvee'].includes(d.statut) && <span className="badge badge-ok"><CheckCircle2 size={11} />{d.statut === 'approuvee' ? 'Approuvé' : 'OK'}</span>}
                                                    {d.statut === 'retard' && <span className="badge badge-red"><AlertTriangle size={11} />Retard</span>}
                                                    {!['ok', 'approuvee', 'retard'].includes(d.statut) && <span className="badge badge-blue"><Clock size={11} />{d.statut}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <div className="card">
                        <div className="card-header">
                            <h3>Calendrier fiscal</h3>
                            <span className="ch-right">{new Date().getFullYear()}</span>
                        </div>
                        <div className="card-body">
                            <div className="cal-grid">
                                {calMonths.map(({ label, cls }) => (
                                    <div key={label} className={`cal-m ${cls}`}>
                                        {label}
                                        <span className="cal-badge">{cls === 'done' ? '✓' : cls === 'missed' ? '!' : cls === 'current' ? '↻' : '·'}</span>
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 8 }}>Échéance : 20 du mois suivant</p>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><h3>Activité récente</h3></div>
                        <div className="card-body">
                            <div className="activity-list">
                                {decls.slice(0, 5).map(d => (
                                    <div key={d.id} className="act-item">
                                        <div className={`act-dot ${['ok', 'approuve'].includes(d.statut) ? 'g' : d.statut === 'retard' ? 'r' : 'b'}`}>
                                            {['ok', 'approuve'].includes(d.statut) ? <CheckCircle2 size={14} /> : d.statut === 'retard' ? <AlertTriangle size={14} /> : <Clock size={14} />}
                                        </div>
                                        <div className="act-text">
                                            <strong>{d.periode}</strong>
                                            <p>IUTS {fmtFCFA(d.iuts_total)} · TPA {fmtFCFA(d.tpa_total)}</p>
                                        </div>
                                    </div>
                                ))}
                                {decls.length === 0 && <p className="text-sm" style={{ color: 'var(--gr5)' }}>Aucune activité.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
