'use client'
import { useQuery } from '@tanstack/react-query'
import { declarationsApi, employeesApi } from '@/lib/api'
import { fmtFCFA } from '@/lib/utils'
import type { Declaration, Employee } from '@/types'
import StatCard from '@/components/StatCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
    AlertTriangle, CheckCircle2, Clock,
    ClipboardList, Calculator, FileText,
    Users, TrendingUp, Send, RefreshCw, BarChart2,
    Banknote, Receipt,
} from 'lucide-react'
import Link from 'next/link'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default function DashboardPage() {
    const { data: decls = [] } = useQuery<Declaration[]>({
        queryKey: ['declarations'],
        queryFn: () => declarationsApi.list().then((r) => r.data),
    })
    const { data: employees = [] } = useQuery<Employee[]>({
        queryKey: ['employees'],
        queryFn: () => employeesApi.list().then((r) => r.data),
    })

    const ok = decls.filter(d => d.statut === 'ok')
    const totalIUTS = ok.reduce((s, d) => s + d.iuts_total, 0)
    const totalTPA = ok.reduce((s, d) => s + d.tpa_total, 0)
    const totalCSS = ok.reduce((s, d) => s + d.css_total, 0)
    const enRetard = decls.filter(d => d.statut === 'retard')

    const chartData = ok.slice(0, 6).reverse()
        .map(d => ({ name: d.periode.split(' ')[0], iuts: d.iuts_total, tpa: d.tpa_total }))

    const nowM = new Date().getMonth()
    const calMonths = MOIS.map((m, i) => ({
        label: m,
        cls: i < nowM ? 'done' : i === nowM ? 'current' : 'pending',
    }))

    return (
        <div>
            {/* Alerte retards */}
            {enRetard.length > 0 && (
                <div className="alert alert-red">
                    <AlertTriangle size={17} />
                    <div>
                        <strong>Déclaration(s) en retard — </strong>
                        {enRetard.map(d => d.periode).join(', ')} · Déclarez dès que possible pour éviter les pénalités.
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="stats-grid">
                <StatCard label="Total IUTS versé" value={fmtFCFA(totalIUTS)} sub={`${ok.length} déclaration(s)`} color="green" icon={<Banknote size={48} />} />
                <StatCard label="Total TPA" value={fmtFCFA(totalTPA)} sub="Taxe patronale apprentissage" color="orange" icon={<Receipt size={48} />} />
                <StatCard label="CNSS / CARFO" value={fmtFCFA(totalCSS)} sub="Cotisations sociales" color="blue" icon={<TrendingUp size={48} />} />
                <StatCard label="Effectif" value={String(employees.length)} sub="Employés actifs" color="green" icon={<Users size={48} />} />
            </div>

            {/* Actions rapides */}
            <div className="card">
                <div className="card-header">
                    <h3>Actions rapides</h3>
                </div>
                <div className="card-body">
                    <div className="quick-actions">
                        <Link href="/dashboard/saisie" className="qa-btn">
                            <ClipboardList size={22} />Saisir
                        </Link>
                        <Link href="/dashboard/calcul" className="qa-btn">
                            <Calculator size={22} />Calculer
                        </Link>
                        <Link href="/dashboard/historique" className="qa-btn">
                            <FileText size={22} />Historique
                        </Link>
                        <Link href="/dashboard/parametres" className="qa-btn">
                            <Users size={22} />Employés
                        </Link>
                        <button className="qa-btn">
                            <BarChart2 size={22} />Rapport
                        </button>
                        <button className="qa-btn">
                            <Send size={22} />Télédéclarer
                        </button>
                        <button className="qa-btn">
                            <RefreshCw size={22} />Simuler
                        </button>
                        <button className="qa-btn">
                            <TrendingUp size={22} />Bilan
                        </button>
                    </div>
                </div>
            </div>

            {/* Corps principal */}
            <div className="grid-3">
                {/* Graphique */}
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

                    {/* Dernières déclarations */}
                    <div className="card">
                        <div className="card-header">
                            <h3>Historique récent</h3>
                            <Link href="/dashboard/historique" className="btn btn-sm btn-outline">Tout voir</Link>
                        </div>
                        {decls.length === 0 ? (
                            <div className="card-body">
                                <p className="text-sm" style={{ color: 'var(--gr5)' }}>Aucune déclaration enregistrée.</p>
                            </div>
                        ) : (
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Période</th><th>IUTS</th><th>TPA</th><th>Total</th><th>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {decls.slice(0, 5).map((d) => (
                                            <tr key={d.id}>
                                                <td className="td-name">{d.periode}</td>
                                                <td className="td-num">{fmtFCFA(d.iuts_total)}</td>
                                                <td className="td-num">{fmtFCFA(d.tpa_total)}</td>
                                                <td className="td-num bold">{fmtFCFA(d.total)}</td>
                                                <td>
                                                    {d.statut === 'ok' && <span className="badge badge-ok"><CheckCircle2 size={11} />OK</span>}
                                                    {d.statut === 'retard' && <span className="badge badge-red"><AlertTriangle size={11} />Retard</span>}
                                                    {d.statut === 'en_cours' && <span className="badge badge-blue"><Clock size={11} />En cours</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Colonne droite */}
                <div>
                    {/* Calendrier fiscal */}
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
                                        <span className="cal-badge">{cls === 'done' ? '✓' : cls === 'current' ? '↻' : '·'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Activité récente */}
                    <div className="card">
                        <div className="card-header"><h3>Activité récente</h3></div>
                        <div className="card-body">
                            <div className="activity-list">
                                {ok.slice(0, 4).map(d => (
                                    <div key={d.id} className="act-item">
                                        <div className="act-dot g"><CheckCircle2 size={14} /></div>
                                        <div className="act-text">
                                            <strong>Déclaration {d.periode}</strong>
                                            <p>IUTS {fmtFCFA(d.iuts_total)} · TPA {fmtFCFA(d.tpa_total)}</p>
                                        </div>
                                    </div>
                                ))}
                                {enRetard.slice(0, 2).map(d => (
                                    <div key={d.id} className="act-item">
                                        <div className="act-dot r"><AlertTriangle size={14} /></div>
                                        <div className="act-text">
                                            <strong>Retard — {d.periode}</strong>
                                            <p>Déclaration non finalisée</p>
                                        </div>
                                    </div>
                                ))}
                                {decls.length === 0 && (
                                    <p className="text-sm" style={{ color: 'var(--gr5)' }}>Aucune activité récente.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
