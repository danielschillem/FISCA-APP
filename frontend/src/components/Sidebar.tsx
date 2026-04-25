import { useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEcheancesAnnee } from '../lib/fiscalCalendar';
import { useAuthStore, useAppStore } from '../lib/store';
import { usePermissions } from '../lib/permissions';
import { useRegime } from '../lib/regime';
import { PLAN_FEATURES, type Plan, type Company, MOIS_FR } from '../types';
import { authApi, companyApi } from '../lib/api';
import { APP_VERSION, COPYRIGHT_YEAR_END, DEVELOPER_NAME } from '../lib/version';
import { useContribuableStore } from '../contribuable/contribuableStore';
import {
    LayoutDashboard, Calculator, FileCheck, Bot, Building2, Users,
    History, Settings, Lock, LogOut, CalendarDays, UserCog, type LucideIcon,
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

type NavItem = { to: string; label: string; Icon: LucideIcon; feat: string | null; badge?: 'alerts' };

const navSections: { label: string; items: NavItem[] }[] = [
    {
        label: 'Menu principal',
        items: [
            { to: '/dashboard', label: 'Tableau de bord', Icon: LayoutDashboard, feat: null },
            { to: '/calendrier', label: 'Calendrier fiscal', Icon: CalendarDays, feat: null, badge: 'alerts' },
            { to: '/declarations', label: 'Déclarations et annexes', Icon: FileCheck, feat: null },
            { to: '/calcul', label: 'Calculateur fiscal', Icon: Calculator, feat: null },
            { to: '/historique', label: 'Historique fiscal', Icon: History, feat: null },
            { to: '/assistant', label: 'Assistant IA', Icon: Bot, feat: null },
            { to: '/parametres', label: 'Paramètres', Icon: Settings, feat: null },
        ],
    },
    /* Modules complémentaires — décommenter pour réafficher ; réimporter les icônes lucide utilisées dans ce bloc.
    {
        label: 'Modules complémentaires',
        items: [
            { to: '/checklist', label: 'Checklist mensuelle', Icon: ClipboardList, feat: null },
            { to: '/saisie', label: 'Ressources humaines', Icon: PenLine, feat: 'saisie' },
            { to: '/versements-iuts', label: 'Versements IUTS / DIPE', Icon: FileText, feat: null },
            { to: '/bulletins', label: 'Bulletins de paie', Icon: FileCheck, feat: 'bulletin' },
            { to: '/rapport', label: 'Rapport du mois', Icon: FileText, feat: 'rapport' },
            { to: '/tva', label: 'TVA', Icon: Receipt, feat: 'tva' },
            { to: '/retenues', label: 'Retenue à la source', Icon: BarChart2, feat: 'ras' },
            { to: '/irf', label: 'IRF (revenus fonciers)', Icon: Home, feat: 'irf' },
            { to: '/ircm', label: 'IRCM', Icon: TrendingUp, feat: 'ircm' },
            { to: '/cnss-patronal', label: 'CNSS patronal', Icon: Users, feat: 'cnss-patronal' },
            { to: '/cme', label: 'CME', Icon: Store, feat: 'cme' },
            { to: '/is', label: 'IS / MFP', Icon: BookOpen, feat: 'is' },
            { to: '/patente', label: 'Patente', Icon: Scroll, feat: 'patente' },
            { to: '/simulateur', label: 'Simulateur', Icon: Sliders, feat: 'simulateur' },
            { to: '/societes', label: 'Multi-sociétés', Icon: Building2, feat: 'multi-company' },
            { to: '/workflow', label: 'Workflow', Icon: GitBranch, feat: 'workflow' },
            { to: '/bilan', label: 'Bilan annuel', Icon: BarChart, feat: 'bilan' },
            { to: '/exercice', label: 'Exercice fiscal', Icon: BookOpen, feat: null },
        ],
    },
    */
];

function navClasses(isActive: boolean, locked: boolean, outOfRegime: boolean): string {
    const base =
        'mr-2 flex items-center gap-2.5 rounded-r-lg border-l-[3px] py-2.5 pl-[14px] pr-3 text-[13px] transition-all duration-200';
    if (locked) {
        return `${base} cursor-not-allowed border-l-transparent text-white/35`;
    }
    if (isActive) {
        return `${base} border-l-emerald-400 bg-emerald-500/15 font-semibold text-white shadow-sm shadow-black/10`;
    }
    if (outOfRegime) {
        return `${base} border-l-transparent text-white/45 hover:bg-white/[0.07] hover:text-white/85`;
    }
    return `${base} border-l-transparent text-white/70 hover:bg-white/[0.07] hover:text-white`;
}

export default function Sidebar() {
    const { user, logout, impersonating } = useAuthStore();
    const { plan, sidebarOpen, toggleSidebar } = useAppStore();
    const navigate = useNavigate();
    const planFeatures = PLAN_FEATURES[plan];
    const { isAuditeur, roleLabel, roleBadgeColor } = usePermissions();
    const { regime, info: regimeInfo, routeApplies } = useRegime();

    const canUseCompanyScopedApis = !!user && (user.role !== 'super_admin' || impersonating);
    const { data: company } = useQuery<Company>({
        queryKey: ['company', 'sidebar'],
        queryFn: () => companyApi.get().then((r) => r.data),
        enabled: canUseCompanyScopedApis,
        staleTime: 60_000,
    });
    const ensureContribuableScope = useContribuableStore((s) => s.ensureScope);

    useEffect(() => {
        if (user?.id && company?.id) {
            ensureContribuableScope(user.id, company.id);
        }
    }, [company?.id, ensureContribuableScope, user?.id]);

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch {
            /* ignore */
        }
        logout();
        navigate('/login');
    };

    const alertCount = useMemo(() => {
        const now = new Date();
        return getEcheancesAnnee(now.getFullYear(), now).filter(
            (e) => e.urgence === 'critique' || e.urgence === 'proche',
        ).length;
    }, []);

    const planColor = PLAN_COLORS[plan];
    const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'US';

    const periodLabel = useMemo(() => {
        const d = new Date();
        return `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
    }, []);

    const companyName = company?.nom?.trim() || '— Contribuable —';
    const ifuLabel = company?.ifu?.trim() ? `IFU : ${company.ifu}` : 'IFU : —';

    return (
        <>
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-slate-900/45 backdrop-blur-[2px] md:hidden"
                    onClick={toggleSidebar}
                    aria-hidden
                />
            )}

            <aside
                className={`fixed left-0 top-0 z-30 flex h-screen flex-col overflow-hidden border-r border-slate-700/40 shadow-2xl shadow-black/25 transition-transform duration-300 ease-out ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                style={{
                    width: 'var(--sidebar-w)',
                    minWidth: 'var(--sidebar-w)',
                    background: 'linear-gradient(180deg, var(--shell-sidebar) 0%, #0c1222 100%)',
                }}
            >
                {/* Logo — charte FISCA */}
                <div className="shrink-0 border-b border-white/[0.07] px-[18px] pb-3.5 pt-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div
                                className="text-[22px] font-extrabold tracking-wide text-white"
                                style={{ fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif' }}
                            >
                                FISCA
                            </div>
                            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                                Déclarations fiscales
                                <br />
                                <span className="text-slate-500">Burkina Faso · CGI 2025</span>
                            </p>
                        </div>
                        <span
                            className="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                                background: `${planColor}22`,
                                color: planColor,
                                borderColor: `${planColor}44`,
                            }}
                            title="Formule"
                        >
                            {PLAN_LABELS[plan]}
                        </span>
                    </div>
                </div>

                {/* Bloc société — comme prototype */}
                <div className="shrink-0 border-b border-white/[0.07] px-[18px] py-3">
                    <p className="truncate text-xs font-semibold text-white" title={companyName}>
                        {companyName}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{ifuLabel}</p>
                    <p className="mt-1 text-[11px] font-medium text-amber-400/95">{periodLabel}</p>
                    {regime ? (
                        <p
                            className="mt-1.5 inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold"
                            style={{
                                background: `${regimeInfo.color}22`,
                                color: regimeInfo.color,
                                borderColor: `${regimeInfo.color}44`,
                            }}
                            title={regimeInfo.label}
                        >
                            {regimeInfo.shortLabel}
                        </p>
                    ) : null}
                </div>

                <nav className="scrollbar-thin flex-1 overflow-y-auto px-0 py-2">
                    {navSections.map((section) => (
                        <div key={section.label} className="mb-1">
                            <p className="px-[18px] pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {section.label}
                            </p>
                            <ul className="list-none space-y-0.5">
                                {section.items.map(({ to, label, Icon, feat, badge }) => {
                                    const locked = feat ? !planFeatures.has(feat) : false;
                                    const outOfRegime = !locked && regime !== '' && !routeApplies(to);
                                    return (
                                        <li key={to}>
                                            <NavLink
                                                to={to}
                                                onClick={(e) => {
                                                    if (locked) e.preventDefault();
                                                    if (window.innerWidth < 768) toggleSidebar();
                                                }}
                                                className={({ isActive }) =>
                                                    navClasses(isActive, locked, outOfRegime)
                                                }
                                            >
                                                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                                                <span className="min-w-0 flex-1 truncate">{label}</span>
                                                {badge === 'alerts' && alertCount > 0 && !locked && (
                                                    <span className="min-w-[18px] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10">
                                                        {alertCount > 9 ? '9+' : alertCount}
                                                    </span>
                                                )}
                                                {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-white/30" />}
                                                {outOfRegime && (
                                                    <span
                                                        className="shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold"
                                                        style={{
                                                            background: `${regimeInfo.color}22`,
                                                            color: regimeInfo.color,
                                                        }}
                                                        title={`Non applicable au régime ${regimeInfo.shortLabel}`}
                                                    >
                                                        {regimeInfo.shortLabel}
                                                    </span>
                                                )}
                                            </NavLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}

                    {user?.org_role === 'org_admin' && (
                        <div className="mb-1">
                            <p className="px-[18px] pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-400/80">
                                Organisation
                            </p>
                            <ul className="list-none space-y-0.5">
                                {[
                                    { to: '/org/info', label: "Vue d'ensemble", Icon: Building2 },
                                    { to: '/org/membres', label: 'Membres & rôles', Icon: Users },
                                    { to: '/org/societes', label: 'Accès sociétés', Icon: UserCog },
                                ].map(({ to, label, Icon }) => (
                                    <li key={to}>
                                        <NavLink
                                            to={to}
                                            onClick={() => {
                                                if (window.innerWidth < 768) toggleSidebar();
                                            }}
                                            className={({ isActive }) => {
                                                const base =
                                                    'mr-2 flex items-center gap-2.5 rounded-r-lg border-l-[3px] py-2.5 pl-[14px] pr-3 text-[13px] transition-all duration-200';
                                                if (isActive) {
                                                    return `${base} border-l-sky-400 bg-sky-500/15 font-semibold text-white shadow-sm shadow-black/10`;
                                                }
                                                return `${base} border-l-transparent text-white/70 hover:bg-white/[0.07] hover:text-white`;
                                            }}
                                        >
                                            <Icon className="h-4 w-4 shrink-0 opacity-80" />
                                            <span className="min-w-0 flex-1 truncate">{label}</span>
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </nav>

                <div className="shrink-0 border-t border-white/[0.07] bg-black/10 p-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                            style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
                        >
                            {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-white/80">{user?.email ?? 'Utilisateur'}</p>
                            {roleLabel ? (
                                <p
                                    className={`mt-0.5 inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${roleBadgeColor}`}
                                >
                                    {isAuditeur ? 'Lecture seule' : roleLabel}
                                </p>
                            ) : (
                                <p className="mt-0.5 text-[10px]" style={{ color: planColor }}>
                                    {PLAN_LABELS[plan]}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="rounded-lg p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-red-400"
                            title="Déconnexion"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                        <span className="font-mono text-[10px] leading-snug text-white/30">
                            v{APP_VERSION}
                            <br />© {COPYRIGHT_YEAR_END} {DEVELOPER_NAME}
                        </span>
                        <NavLink
                            to="/mentions-legales"
                            className="text-[10px] text-white/35 underline transition-colors hover:text-white/55"
                        >
                            Mentions légales
                        </NavLink>
                    </div>
                </div>
            </aside>
        </>
    );
}
