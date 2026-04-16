import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { BarChart3, Users, Building2, ScrollText, ShieldCheck, LogOut, ChevronRight, Activity } from 'lucide-react';

const NAV = [
    { to: '/admin', label: 'Vue d\'ensemble', icon: BarChart3, end: true },
    { to: '/admin/users', label: 'Utilisateurs', icon: Users },
    { to: '/admin/companies', label: 'Sociétés', icon: Building2 },
    { to: '/admin/audit', label: 'Journal d\'audit', icon: ScrollText },
];

const PAGE_TITLES: Record<string, string> = {
    '/admin': 'Vue d\'ensemble',
    '/admin/users': 'Gestion des utilisateurs',
    '/admin/companies': 'Gestion des sociétés',
    '/admin/audit': 'Journal d\'audit',
};

export default function AdminLayout() {
    const { token, user, logout } = useAuthStore();
    const location = useLocation();
    const pageTitle = PAGE_TITLES[location.pathname] ?? 'Admin';

    if (!token || user?.role !== 'super_admin') {
        return <Navigate to="/login" replace />;
    }

    const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'SA';

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            {/* Sidebar Admin */}
            <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
                {/* Logo */}
                <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-800">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}>
                        <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-sm text-white tracking-wide">FISCA</span>
                        <span className="block text-[10px] text-slate-400 leading-none -mt-0.5">Super Admin</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 py-2">Navigation</p>
                    {NAV.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group ${isActive
                                    ? 'bg-green-500/15 text-green-400 font-medium'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-green-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                    <span>{label}</span>
                                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
                                </>
                            )}
                        </NavLink>
                    ))}

                    <div className="mt-4 border-t border-slate-800 pt-4">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 py-2">Activité</p>
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500">
                            <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                            <span className="text-xs">Système actif</span>
                        </div>
                    </div>
                </nav>

                {/* Footer */}
                <div className="px-3 py-3 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg mb-1">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: 'linear-gradient(135deg, #16a34a, #0d9488)' }}>
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-white font-medium truncate">{user?.email?.split('@')[0]}</p>
                            <p className="text-[10px] text-slate-500 truncate">{user?.email?.split('@')[1]}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white w-full transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Déconnexion
                    </button>
                </div>
            </aside>

            {/* Content area */}
            <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="text-gray-400">Admin</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <span className="font-semibold text-gray-800">{pageTitle}</span>
                    </div>
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                        super_admin
                    </span>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
