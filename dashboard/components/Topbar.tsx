'use client'
import { usePathname } from 'next/navigation'
import { Bell, HelpCircle } from 'lucide-react'

const TITLES: Record<string, [string, string]> = {
    '/dashboard': ['Tableau de bord', 'Exercice fiscal en cours · Burkina Faso LF 2020'],
    '/dashboard/saisie': ['Saisie mensuelle', 'Rémunérations et cotisations sociales'],
    '/dashboard/calcul': ['Calcul IUTS / TPA', 'Loi de Finances 2020 — Burkina Faso'],
    '/dashboard/historique': ['Historique', 'Toutes les déclarations fiscales'],
    '/dashboard/parametres': ['Paramètres', 'Informations de votre entreprise'],
}

export default function Topbar() {
    const pathname = usePathname()
    const [title, sub] = TITLES[pathname] ?? ['FISCA', 'Plateforme de gestion fiscale']

    return (
        <header className="fisca-topbar">
            <div className="topbar-left">
                <h2>{title}</h2>
                {sub && <p>{sub}</p>}
            </div>
            <div className="topbar-right">
                <button className="notif-btn" title="Notifications">
                    <Bell size={16} style={{ color: 'var(--gr6)' }} />
                    <span className="notif-count-badge">2</span>
                </button>
                <button className="btn btn-outline btn-sm" title="Aide">
                    <HelpCircle size={14} /> Aide
                </button>
            </div>
        </header>
    )
}
