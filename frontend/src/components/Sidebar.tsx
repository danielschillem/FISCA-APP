import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useAppStore } from '../lib/store';
import { PLAN_FEATURES, type Plan } from '../types';
import { authApi } from '../lib/api';
import {
    LayoutDashboard, PenLine, Calculator, FileText, FileCheck,
    Sliders, Receipt, Home, TrendingUp, Bot, Building2, GitBranch,
    BarChart2, Users, Store, BookOpen, Scroll, History, BarChart,
    Star, Settings, Lock, LogOut, type LucideIcon,
} from 'lucide-react';

const PLAN_COLORS: Record<Plan, string> = {
    starter: '#6b7280',
    pro: '#24a05a',
    enterprise: '#f97316',
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
            { to: '/saisie', label: 'Saisie mensuelle', Icon: PenLine, feat: 'saisie' },
            { to: '/calcul', label: 'Calcul IUTS / TPA', Icon: Calculator, feat: 'calcul' },
            { to: '/rapport', label: 'Rapport du mois', Icon: FileText, feat: 'rapport' },
        ],
    },
    {
        label: 'Pro',
        items: [
            { to: '/bulletins', label: 'Bulletins de paie', Icon: FileCheck, feat: 'bulletin' },
            { to: '/simulateur', label: 'Simulateur fiscal', Icon: Sliders, feat: 'simulateur' },
            { to: '/tva', label: 'Module TVA', Icon: Receipt, feat: 'tva' },
            { to: '/irf', label: 'IRF — Revenus fonciers', Icon: Home, feat: 'irf' },
            { to: '/ircm', label: 'IRCM — Capitaux mob.', Icon: TrendingUp, feat: 'ircm' },
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

    return (
        <>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-20 md:hidden"
                    onClick={toggleSidebar}
                />
            )}

            <aside
                className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 z-30
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    w-64`}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ background: planColor }}
                    >
                        F
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm">FISCA</span>
                            <span
                                className="text-[10px] px-1.5 py-0.5 rounded text-white font-semibold"
                                style={{ background: planColor }}
                            >
                                {PLAN_LABELS[plan]}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500">Plateforme Fiscale</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {navSections.map((section) => (
                        <div key={section.label} className="mb-3">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
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
                                            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                                ? 'bg-green-50 text-green-700 font-medium'
                                                : locked
                                                    ? 'text-gray-400 cursor-not-allowed hover:bg-gray-50'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                            }`
                                        }
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        <span className="flex-1 truncate">{label}</span>
                                        {locked && (
                                            <Lock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* User footer */}
                <div className="border-t border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {user?.email?.slice(0, 2).toUpperCase() ?? 'US'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900 truncate">{user?.email ?? 'Utilisateur'}</p>
                            <p className="text-[10px] text-gray-500">{PLAN_LABELS[plan]}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-gray-400 hover:text-red-500 transition-colors"
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
