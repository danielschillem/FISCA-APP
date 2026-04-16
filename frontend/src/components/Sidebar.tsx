import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useAppStore } from '../lib/store';
import { PLAN_FEATURES, type Plan } from '../types';
import { authApi } from '../lib/api';
import {
    LayoutDashboard, PenLine, Calculator, FileText, FileCheck,
    Sliders, Receipt, Home, TrendingUp, Bot, Building2, GitBranch,
    BarChart2, Users, Store, BookOpen, Scroll, History, BarChart,
    Star, Settings, Lock, LogOut, CalendarDays, type LucideIcon,
} from 'lucide-react';

const PLAN_COLORS: Record<Plan, string> = {
    starter: '#94a3b8',
    pro: '#34d399',
    enterprise: '#fb923c',
};

const PLAN_LABELS: Record<Plan, string> = {
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Entreprise',
};

type NavItem = { to: string; label: string; Icon: LucideIcon; feat: string | null };

const navSections: { label: string; items: NavItem[] }[] = [
    {
        label: 'Principal',
        items: [
            { to: '/dashboard', label: 'Tableau de bord', Icon: LayoutDashboard, feat: null },
            { to: '/calendrier', label: 'Calendrier fiscal', Icon: CalendarDays, feat: null },
            { to: '/saisie', label: 'Saisie mensuelle', Icon: PenLine, feat: 'saisie' },
            { to: '/calcul', label: 'Calculateur Fiscal', Icon: Calculator, feat: 'calcul' },
            { to: '/rapport', label: 'Rapport du mois', Icon: FileText, feat: 'rapport' },
        ],
    },
    {
        label: 'Pro',
        items: [
            { to: '/bulletins', label: 'Bulletins de paie', Icon: FileCheck, feat: 'bulletin' },
            { to: '/simulateur', label: 'Simulateur fiscal', Icon: Sliders, feat: 'simulateur' },
            { to: '/tva', label: 'Module TVA', Icon: Receipt, feat: 'tva' },
            { to: '/irf', label: 'IRF - Revenus fonciers', Icon: Home, feat: 'irf' },
            { to: '/ircm', label: 'IRCM - Capitaux mob.', Icon: TrendingUp, feat: 'ircm' },
            { to: '/assistant', label: 'Assistant IA', Icon: Bot, feat: 'assistant' },
        ],
    },
    {
        label: 'Entreprise',
        items: [
            { to: '/societes', label: 'Multi-sociétés', Icon: Building2, feat: 'multi-company' },
            { to: '/workflow', label: 'Workflow approbation', Icon: GitBranch, feat: 'workflow' },
            { to: '/retenues', label: 'Retenue à la source', Icon: BarChart2, feat: 'ras' },
            { to: '/cnss-patronal', label: 'CNSS Patronal', Icon: Users, feat: 'cnss-patronal' },
            { to: '/cme', label: 'CME Micro-Entreprises', Icon: Store, feat: 'cme' },
            { to: '/is', label: 'IS / MFP', Icon: BookOpen, feat: 'is' },
            { to: '/patente', label: 'Patentes', Icon: Scroll, feat: 'patente' },
        ],
    },
    {
        label: 'Compte',
        items: [
            { to: '/historique', label: 'Historique fiscal', Icon: History, feat: null },
            { to: '/bilan', label: 'Bilan annuel', Icon: BarChart, feat: 'bilan' },
            { to: '/exercice', label: 'Exercice fiscal', Icon: BookOpen, feat: null },
            { to: '/abonnement', label: 'Mon abonnement', Icon: Star, feat: null },
            { to: '/parametres', label: 'Paramètres', Icon: Settings, feat: null },
        ],
    },
];

export default function Sidebar() {
    const { user, logout } = useAuthStore();
    const { plan, sidebarOpen, toggleSidebar } = useAppStore();
    const navigate = useNavigate();
    const planFeatures = PLAN_FEATURES[plan];

    const handleLogout = async () => {
        try { await authApi.logout(); } catch { /* ignore */ }
        logout();
        navigate('/login');
    };

    const planColor = PLAN_COLORS[plan];
    const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'US';

    return (
        <>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={toggleSidebar}
                />
            )}

            <aside
                className={`fixed top-0 left-0 h-screen bg-slate-900 flex flex-col transition-transform duration-300 z-30
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    w-64`}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}
                    >
                        F
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm tracking-wide">FISCA</span>
                            <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: planColor + '22', color: planColor, border: `1px solid ${planColor}44` }}
                            >
                                {PLAN_LABELS[plan]}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500">Plateforme Fiscale BF</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
                    {navSections.map((section) => (
                        <div key={section.label} className="mb-3">
                            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1.5">
                                {section.label}
                            </p>
                            {section.items.map(({ to, label, Icon, feat }) => {
                                const locked = feat ? !planFeatures.has(feat) : false;
                                return (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        onClick={() => { if (window.innerWidth < 768) toggleSidebar(); }}
                                        className={({ isActive }) =>
                                            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${isActive
                                                ? 'bg-green-500/15 text-green-400 font-semibold'
                                                : locked
                                                    ? 'text-slate-600 cursor-not-allowed'
                                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                            }`
                                        }
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        <span className="flex-1 truncate">{label}</span>
                                        {locked && (
                                            <Lock className="w-3 h-3 text-slate-700 flex-shrink-0" />
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* User footer */}
                <div className="border-t border-slate-800 p-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow"
                            style={{ background: 'linear-gradient(135deg, #16a34a, #0d9488)' }}
                        >
                            {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-300 truncate">{user?.email ?? 'Utilisateur'}</p>
                            <p className="text-[10px]" style={{ color: planColor }}>{PLAN_LABELS[plan]}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded"
                            title="Déconnexion"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
