'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, ClipboardList, Calculator,
    History, Settings, LogOut, FileText, BarChart2,
    Receipt, Bot, Building2, GitBranch, Lock,
    FileCheck, Users, BookOpen, Home, Landmark,
    Briefcase, TrendingUp, Building, CreditCard,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { PLAN_COLORS, PLAN_LABELS } from '@/types'

const NAV_MAIN = [
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/dashboard/saisie', label: 'Saisie mensuelle', icon: ClipboardList },
    { href: '/dashboard/calcul', label: 'Calcul IUTS / TPA', icon: Calculator },
    { href: '/dashboard/historique', label: 'Rapport du mois', icon: History },
]

const NAV_PRO = [
    { href: '/dashboard/bulletins', label: 'Bulletins de paie', icon: FileText, plan: 'pro' },
    { href: '/dashboard/simulateur', label: 'Simulateur fiscal', icon: BarChart2, plan: 'pro' },
    { href: '/dashboard/tva', label: 'Module TVA', icon: Receipt, plan: 'pro' },
    { href: '/dashboard/irf', label: 'IRF — Revenus fonciers', icon: Home, plan: 'pro' },
    { href: '/dashboard/ircm', label: 'IRCM — Capitaux mob.', icon: Landmark, plan: 'pro' },
    { href: '/dashboard/assistant', label: 'Assistant IA', icon: Bot, plan: 'pro' },
]

const NAV_ENTERPRISE = [
    { href: '/dashboard/societes', label: 'Multi-sociétés', icon: Building2, plan: 'enterprise' },
    { href: '/dashboard/workflow', label: 'Workflow approbation', icon: GitBranch, plan: 'enterprise' },
    { href: '/dashboard/retenues', label: 'Retenue à la source', icon: FileCheck, plan: 'enterprise' },
    { href: '/dashboard/cnss-patronal', label: 'CNSS Patronal', icon: Users, plan: 'enterprise' },
    { href: '/dashboard/cme', label: 'CME — Micro-Entreprises', icon: Building, plan: 'enterprise' },
    { href: '/dashboard/is', label: 'IS / MFP', icon: TrendingUp, plan: 'enterprise' },
    { href: '/dashboard/patente', label: 'Patente professionnelle', icon: Briefcase, plan: 'enterprise' },
]

const NAV_COMPTE = [
    { href: '/dashboard/bilan', label: 'Bilan fiscal annuel', icon: BookOpen },
    { href: '/dashboard/historique-fiscal', label: 'Historique fiscal', icon: BarChart2 },
]

const NAV_SETTINGS = [
    { href: '/dashboard/abonnement', label: 'Abonnement', icon: CreditCard },
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
    const userPlan = user?.plan ?? 'starter'

    function isActive(href: string) {
        return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    }

    function hasAccess(plan: string) {
        if (plan === 'pro') return userPlan === 'pro' || userPlan === 'enterprise'
        if (plan === 'enterprise') return userPlan === 'enterprise'
        return true
    }

    return (
        <aside className="fisca-sidebar">
            <div className="fisca-sidebar-logo">
                <div className="logo-mark">
                    <div className="logo-icon">F</div>
                    <div className="logo-text">
                        <strong>FISCA</strong>
                        <span>Plateforme Fiscale BF</span>
                    </div>
                </div>
            </div>

            <nav className="fisca-nav">
                <div className="nav-label">Principal</div>
                {NAV_MAIN.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                        className={`nav-item${isActive(href) ? ' active' : ''}`}>
                        <Icon size={16} />{label}
                    </Link>
                ))}

                <div className="nav-label" style={{ marginTop: 8 }}>Pro</div>
                {NAV_PRO.map(({ href, label, icon: Icon, plan }) => {
                    const ok = hasAccess(plan)
                    if (ok) {
                        return (
                            <Link key={href} href={href}
                                className={`nav-item${isActive(href) ? ' active' : ''}`}>
                                <Icon size={16} />{label}
                            </Link>
                        )
                    }
                    return (
                        <div key={href} className="nav-item nav-locked" title="Nécessite le plan Pro">
                            <Icon size={16} />{label}<Lock size={11} style={{ marginLeft: 'auto', opacity: .5 }} />
                        </div>
                    )
                })}

                <div className="nav-label" style={{ marginTop: 8 }}>Entreprise</div>
                {NAV_ENTERPRISE.map(({ href, label, icon: Icon, plan }) => {
                    const ok = hasAccess(plan)
                    if (ok) {
                        return (
                            <Link key={href} href={href}
                                className={`nav-item${isActive(href) ? ' active' : ''}`}>
                                <Icon size={16} />{label}
                            </Link>
                        )
                    }
                    return (
                        <div key={href} className="nav-item nav-locked" title="Nécessite le plan Entreprise">
                            <Icon size={16} />{label}<Lock size={11} style={{ marginLeft: 'auto', opacity: .5 }} />
                        </div>
                    )
                })}

                <div className="nav-label" style={{ marginTop: 8 }}>Compte</div>
                {NAV_COMPTE.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                        className={`nav-item${isActive(href) ? ' active' : ''}`}>
                        <Icon size={16} />{label}
                    </Link>
                ))}

                <div className="nav-label" style={{ marginTop: 8 }}>Administration</div>
                {NAV_SETTINGS.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                        className={`nav-item${isActive(href) ? ' active' : ''}`}>
                        <Icon size={16} />{label}
                    </Link>
                ))}
            </nav>

            <div className="fisca-sidebar-footer">
                <div className="user-card">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info" style={{ minWidth: 0 }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {user?.email?.split('@')[0] ?? 'Admin'}
                        </strong>
                        <span className="plan-badge" style={{ background: planColor, marginLeft: 0 }}>{planLabel}</span>
                    </div>
                    <button onClick={handleLogout} title="Se déconnecter"
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4 }}>
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    )
}

