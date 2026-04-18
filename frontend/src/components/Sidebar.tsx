import { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getEcheancesAnnee } from '../lib/fiscalCalendar';
import { useAuthStore, useAppStore } from '../lib/store';
import { usePermissions } from '../lib/permissions';
import { useRegime } from '../lib/regime';
import { PLAN_FEATURES, type Plan } from '../types';
import { authApi } from '../lib/api';
import { APP_VERSION, COPYRIGHT_YEAR_END, DEVELOPER_NAME } from '../lib/version';
import {
    LayoutDashboard, PenLine, Calculator, FileText, FileCheck,
    Sliders, Receipt, Home, TrendingUp, Bot, Building2, GitBranch,
    BarChart2, Users, Store, BookOpen, Scroll, History, BarChart,
    Star, Settings, Lock, LogOut, CalendarDays, ClipboardList, UserCog, type LucideIcon,
} from 'lucide-react';

const PLAN_COLORS: Record<Plan, string> = {
    physique_starter: '#94a3b8',
    physique_pro: '#34d399',
    moral_team: '#60a5fa',
    moral_enterprise: '#fb923c',
    starter: '#94a3b8',
    pro: '#34d399',
    enterprise: '#fb923c',
};

const PLAN_LABELS: Record<Plan, string> = {
    physique_starter: 'Solo Starter',
    physique_pro: 'Solo Pro',
    moral_team: 'Équipe',
    moral_enterprise: 'Entreprise',
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
            { to: '/checklist', label: 'Checklist mensuelle', Icon: ClipboardList, feat: null },
            { to: '/saisie', label: 'Ressources Humaines', Icon: PenLine, feat: 'saisie' },
            { to: '/calcul', label: 'Calculateur Fiscal', Icon: Calculator, feat: 'calcul' },
            { to: '/rapport', label: 'Rapport du mois', Icon: FileText, feat: 'rapport' },
            { to: '/declarations', label: 'Mes déclarations', Icon: FileCheck, feat: null },
        ],
    },
    {
        label: 'Pro',
        items: [
            { to: '/bulletins', label: 'Bulletins de paie', Icon: FileCheck, feat: 'bulletin' },
            { to: '/simulateur', label: 'Simulateur fiscal', Icon: Sliders, feat: 'simulateur' },
            { to: '/tva', label: 'Module TVA', Icon: Receipt, feat: 'tva' },
            { to: '/irf', label: 'IRF - Revenus fonciers', Icon: Home, feat: 'irf' },
            { to: '/ircm', label: 'IRCM - Capitaux mobiliers', Icon: TrendingUp, feat: 'ircm' },
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
    const { isAuditeur, roleLabel, roleBadgeColor } = usePermissions();
    const { regime, info: regimeInfo, routeApplies } = useRegime();

    const handleLogout = async () => {
        try { await authApi.logout(); } catch { /* ignore */ }
        logout();
        navigate('/login');
    };

    const alertCount = useMemo(() => {
        const now = new Date();
        return getEcheancesAnnee(now.getFullYear(), now)
            .filter(e => e.urgence === 'critique' || e.urgence === 'proche')
            .length;
    }, []);

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
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span style={{ fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif', fontWeight: 900 }} className="text-white text-lg tracking-wider">FISCA</span>
                            <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: planColor + '22', color: planColor, border: `1px solid ${planColor}44` }}
                            >
                                {PLAN_LABELS[plan]}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[11px] text-slate-500">Plateforme Fiscale BF</p>
                            {regime ? (
                                <span
                                    className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                    style={{ background: regimeInfo.color + '22', color: regimeInfo.color, border: `1px solid ${regimeInfo.color}44` }}
                                    title={regimeInfo.label}
                                >
                                    {regimeInfo.shortLabel}
                                </span>
                            ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium" title="Régime non défini">
                                    Régime ?
                                </span>
                            )}
                        </div>
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
                                const outOfRegime = !locked && regime !== '' && !routeApplies(to);
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
                                                    : outOfRegime
                                                        ? 'text-slate-600 hover:bg-white/5 hover:text-slate-400'
                                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                            }`
                                        }
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        <span className="flex-1 truncate">{label}</span>
                                        {to === '/calendrier' && alertCount > 0 && !locked && (
                                            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shrink-0">
                                                {alertCount > 9 ? '9+' : alertCount}
                                            </span>
                                        )}
                                        {locked && (
                                            <Lock className="w-3 h-3 text-slate-700 flex-shrink-0" />
                                        )}
                                        {outOfRegime && (
                                            <span
                                                className="text-[8px] px-1 py-0.5 rounded font-semibold shrink-0"
                                                style={{ background: regimeInfo.color + '22', color: regimeInfo.color }}
                                                title={`Non applicable au régime ${regimeInfo.shortLabel}`}
                                            >
                                                {regimeInfo.shortLabel}
                                            </span>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}

                    {/* Section Organisation : visible uniquement pour org_admin */}
                    {user?.org_role === 'org_admin' && (
                        <div className="mb-3">
                            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest px-2 mb-1.5">
                                Mon Organisation
                            </p>
                            {[
                                { to: '/org/info', label: 'Vue d\'ensemble', Icon: Building2 },
                                { to: '/org/membres', label: 'Membres & Rôles', Icon: Users },
                                { to: '/org/societes', label: 'Accès sociétés', Icon: UserCog },
                            ].map(({ to, label, Icon }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    onClick={() => { if (window.innerWidth < 768) toggleSidebar(); }}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${isActive
                                            ? 'bg-blue-500/15 text-blue-400 font-semibold'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                        }`
                                    }
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    <span className="flex-1 truncate">{label}</span>
                                </NavLink>
                            ))}
                        </div>
                    )}
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
                            {roleLabel ? (
                                <p className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold inline-block mt-0.5 border ${roleBadgeColor}`}>
                                    {isAuditeur ? 'Lecture seule' : roleLabel}
                                </p>
                            ) : (
                                <p className="text-[10px]" style={{ color: planColor }}>{PLAN_LABELS[plan]}</p>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded"
                            title="Déconnexion"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Version + Mentions légales */}
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-600 font-mono">
                            v{APP_VERSION} - © {COPYRIGHT_YEAR_END} {DEVELOPER_NAME}
                        </span>
                        <NavLink
                            to="/mentions-legales"
                            className="text-[10px] text-slate-600 hover:text-slate-400 underline transition-colors"
                        >
                            Mentions légales
                        </NavLink>
                    </div>
                </div>
            </aside>
        </>
    );
}
