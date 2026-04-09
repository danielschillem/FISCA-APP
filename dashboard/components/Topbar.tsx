'use client'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { Bell, AlertTriangle, Info, CheckCircle, X, CalendarDays } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi, exerciceApi } from '@/lib/api'
import type { Notification, ExerciceFiscal } from '@/types'

const TITLES: Record<string, [string, string]> = {
    '/dashboard': ['Tableau de bord', 'Exercice fiscal en cours · Burkina Faso LF 2020'],
    '/dashboard/saisie': ['Saisie mensuelle', 'Rémunérations et cotisations sociales'],
    '/dashboard/calcul': ['Calcul IUTS / TPA', 'Loi de Finances 2020 — Burkina Faso'],
    '/dashboard/historique': ['Historique', 'Toutes les déclarations fiscales'],
    '/dashboard/parametres': ['Paramètres', 'Informations de votre entreprise'],
    '/dashboard/bulletins': ['Bulletins de paie', 'Bulletins individuels de salaire'],
    '/dashboard/simulateur': ['Simulateur fiscal', 'Simulations de calcul IUTS/TPA'],
    '/dashboard/tva': ['Module TVA', 'Déclarations de TVA'],
    '/dashboard/assistant': ['Assistant IA', 'Assistant fiscal intelligent'],
    '/dashboard/societes': ['Multi-sociétés', 'Gestion de plusieurs entités'],
    '/dashboard/workflow': ['Workflow', "Approbation des déclarations"],
    '/dashboard/retenues': ['Retenue à la source', 'Retenues sur paiements à des tiers'],
    '/dashboard/cnss-patronal': ['CNSS Patronal', 'Cotisations patronales CNSS / CARFO'],
    '/dashboard/historique-fiscal': ['Historique fiscal', 'Synthèse annuelle des obligations fiscales'],
}

const NIVEAU_ICON: Record<string, React.ReactNode> = {
    warning: <AlertTriangle size={14} style={{ color: 'var(--ora)', flexShrink: 0, marginTop: 1 }} />,
    error: <AlertTriangle size={14} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />,
    info: <Info size={14} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />,
    success: <CheckCircle size={14} style={{ color: 'var(--prime)', flexShrink: 0, marginTop: 1 }} />,
}

export default function Topbar() {
    const pathname = usePathname()
    const [title, sub] = TITLES[pathname] ?? ['FISCA', 'Plateforme de gestion fiscale']
    const [open, setOpen] = useState(false)
    const btnRef = useRef<HTMLButtonElement>(null)

    const { data: notifications = [] } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await notificationsApi.list()
            return res.data?.data ?? res.data ?? []
        },
        staleTime: 60_000,
        retry: false,
    })

    const urgentCount = notifications.filter(n => n.niveau === 'error' || n.niveau === 'warning').length

    const { data: exerciceActif } = useQuery<ExerciceFiscal | null>({
        queryKey: ['exercice-actif'],
        queryFn: () => exerciceApi.actif().then(r => r.data?.data ?? r.data ?? null),
        staleTime: 60_000,
        retry: false,
    })

    return (
        <header className="fisca-topbar">
            <div className="topbar-left">
                <h2>{title}</h2>
                {sub && <p>{sub}</p>}
            </div>
            <div className="topbar-right" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Badge exercice actif */}
                {exerciceActif ? (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(36,160,90,.08)', border: '1px solid rgba(36,160,90,.2)',
                        borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                        color: 'var(--prime)',
                    }}>
                        <CalendarDays size={13} />
                        Exercice {exerciceActif.annee}
                    </div>
                ) : (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.15)',
                        borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                        color: '#dc2626',
                    }}>
                        <CalendarDays size={13} />
                        Aucun exercice
                    </div>
                )}
                <button
                    ref={btnRef}
                    className="notif-btn"
                    title="Notifications"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-haspopup="true"
                >
                    <Bell size={16} style={{ color: 'var(--gr6)' }} />
                    {urgentCount > 0 && (
                        <span className="notif-count-badge">{urgentCount}</span>
                    )}
                </button>

                {open && (
                    <div
                        role="dialog"
                        aria-label="Notifications"
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            width: 340,
                            background: 'var(--white)',
                            border: '1px solid var(--gr2)',
                            borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,.10)',
                            zIndex: 200,
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--gr2)',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gr9)' }}>
                                Notifications {notifications.length > 0 && `(${notifications.length})`}
                            </span>
                            <button
                                onClick={() => setOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--gr5)' }}
                                title="Fermer"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <p style={{ padding: '20px 16px', color: 'var(--gr5)', fontSize: 13, textAlign: 'center' }}>
                                    Aucune notification 🎉
                                </p>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 10,
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--gr1)',
                                            background: n.niveau === 'error' ? 'rgba(239,68,68,.04)' : undefined,
                                        }}
                                    >
                                        {NIVEAU_ICON[n.niveau] ?? NIVEAU_ICON.info}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--gr9)', margin: 0 }}>
                                                {n.titre}
                                            </p>
                                            <p style={{ fontSize: 12, color: 'var(--gr5)', margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>
                                                {n.message}
                                            </p>
                                            {n.periode && (
                                                <p style={{ fontSize: 11, color: 'var(--gr4)', margin: '2px 0 0' }}>
                                                    {n.periode}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {open && (
                    <div
                        onClick={() => setOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                        aria-hidden="true"
                    />
                )}

                <button className="btn btn-outline btn-sm" title="Aide" style={{ fontSize: 12 }}>
                    Aide
                </button>
            </div>
        </header>
    )
}
