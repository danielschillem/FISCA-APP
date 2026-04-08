'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, ClipboardList, Calculator,
    History, Settings, LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { PLAN_COLORS, PLAN_LABELS } from '@/types'

const NAV_MAIN = [
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/dashboard/saisie', label: 'Saisie mensuelle', icon: ClipboardList },
    { href: '/dashboard/calcul', label: 'Calcul IUTS / TPA', icon: Calculator },
    { href: '/dashboard/historique', label: 'Historique', icon: History },
]
const NAV_SETTINGS = [
    { href: '/dashboard/parametres', label: 'Paramètres', icon: Settings },
]

export default function Sidebar() {
    const pathname = usePathname()
    const { user, logout } = useAuthStore()
    const router = useRouter()

    function handleLogout() {
        logout()
        router.push('/login')
    }

    const planColor = user ? PLAN_COLORS[user.plan] : '#6b7280'
    const planLabel = user ? PLAN_LABELS[user.plan] : 'Starter'
    const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'AD'

    function isActive(href: string) {
        return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    }

    return (
        <aside className="fisca-sidebar">
            {/* Logo */}
            <div className="fisca-sidebar-logo">
                <div className="logo-mark">
                    <div className="logo-icon">F</div>
                    <div className="logo-text">
                        <strong>FISCA</strong>
                        <span>Plateforme Fiscale BF</span>
                    </div>
                </div>
            </div>

            {/* Nav principale */}
            <nav className="fisca-nav">
                <div className="nav-label">Navigation</div>
                {NAV_MAIN.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                        className={`nav-item${isActive(href) ? ' active' : ''}`}>
                        <Icon size={16} />
                        {label}
                    </Link>
                ))}

                <div className="nav-label" style={{ marginTop: 8 }}>Administration</div>
                {NAV_SETTINGS.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                        className={`nav-item${isActive(href) ? ' active' : ''}`}>
                        <Icon size={16} />
                        {label}
                    </Link>
                ))}
            </nav>

            {/* Pied de page — utilisateur */}
            <div className="fisca-sidebar-footer">
                <div className="user-card">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info" style={{ minWidth: 0 }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {user?.email?.split('@')[0] ?? 'Admin'}
                        </strong>
                        <span
                            className="plan-badge"
                            style={{ background: planColor, marginLeft: 0 }}>
                            {planLabel}
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Se déconnecter"
                        style={{
                            marginLeft: 'auto', background: 'none', border: 'none',
                            cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4,
                        }}>
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    )
}
