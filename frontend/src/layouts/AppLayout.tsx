import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, useAppStore } from '../lib/store';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import NotifPanel from '../components/NotifPanel';
import { Toaster } from '../components/ui';
import { TOPBAR_TITLES } from '../contribuable/contribuableNav';
import { Eye, X, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../lib/useOnlineStatus';

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
    '/dashboard': { title: 'Tableau de bord', subtitle: 'Exercice fiscal en cours' },
    '/declarations': { title: 'Déclarations et annexes', subtitle: 'Saisie, génération PDF & obligations' },
    '/calendrier': { title: 'Calendrier fiscal', subtitle: 'Échéances et obligations' },
    '/checklist': { title: 'Checklist mensuelle', subtitle: 'Suivi des formalités' },
    '/saisie': { title: 'Ressources Humaines', subtitle: 'Rémunérations et cotisations' },
    '/calcul': { title: 'Calculateur Fiscal', subtitle: 'CGI 2025 : Burkina Faso' },
    '/rapport': { title: 'Rapport du mois', subtitle: 'Aperçu et génération du document' },
    '/bulletins': { title: 'Bulletins de paie', subtitle: 'Export PDF individuel' },
    '/simulateur': { title: 'Simulateur fiscal', subtitle: 'Scénarios et comparaison A/B' },
    '/tva': { title: 'Module TVA', subtitle: 'CGI 2025 - Art. 317 - 18 %' },
    '/irf': { title: 'IRF : Revenus Fonciers', subtitle: 'CGI 2025 - Art. 121-126' },
    '/ircm': { title: 'IRCM : Capitaux mobiliers', subtitle: 'CGI 2025 - Art. 140' },
    '/assistant': { title: 'Assistant IA Fiscal', subtitle: 'Conseils fiscaux intelligents' },
    '/societes': { title: 'Multi-Sociétés', subtitle: 'Gestion multi-entités' },
    '/workflow': { title: 'Workflow Approbation', subtitle: 'Validation des déclarations' },
    '/retenues': { title: 'Retenue à la source', subtitle: 'CGI 2025 : Art. 206-226' },
    '/cnss-patronal': { title: 'CNSS Patronal', subtitle: 'Cotisations patronales complètes' },
    '/cme': { title: 'CME : Micro-Entreprises', subtitle: 'CGI 2025 - Art. 533' },
    '/is': { title: 'IS / MFP', subtitle: 'CGI 2025 - Art. 42 - 27,5 %' },
    '/patente': { title: 'Patentes', subtitle: 'CGI 2025 - Art. 237-240' },
    '/historique': { title: 'Historique Fiscal', subtitle: 'Toutes les déclarations' },
    '/versements-iuts': { title: 'Versements IUTS / DIPE', subtitle: 'IUTS - TPA - CSS - téléchargement' },
    '/exercice': { title: 'Exercice fiscal', subtitle: 'Période et clôture' },
    '/bilan': { title: 'Bilan Annuel', subtitle: 'Synthèse de l\'exercice' },
    '/parametres': { title: 'Paramètres', subtitle: 'Informations de l\'entreprise' },
    '/org/info': { title: 'Mon Organisation', subtitle: 'Vue d\'ensemble & quotas' },
    '/org/membres': { title: 'Membres & Rôles', subtitle: 'Gérer les accès de l\'organisation' },
    '/org/societes': { title: 'Accès Sociétés', subtitle: 'Permissions par entité' },
    '/mentions-legales': { title: 'Mentions légales', subtitle: 'CGU - Licence - Confidentialité - Droit applicable' },
};

function resolvePageMeta(pathname: string): { title: string; subtitle?: string } {
    if (PAGE_META[pathname]) return PAGE_META[pathname];
    const m = pathname.match(/^\/declarations\/([^/]+)$/);
    if (m) {
        const title = TOPBAR_TITLES[m[1]];
        if (title) return { title, subtitle: 'Déclarations et annexes — CGI 2025 Burkina Faso' };
    }
    return { title: 'FISCA' };
}

export default function AppLayout() {
    const { token, user, impersonating, stopImpersonate } = useAuthStore();
    const { sidebarOpen } = useAppStore();
    const location = useLocation();
    const online = useOnlineStatus();

    if (!token) return <Navigate to="/login" replace />;
    if (user?.role === 'super_admin' && !impersonating) return <Navigate to="/admin" replace />;

    const meta = resolvePageMeta(location.pathname);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100">
            {/* Bannière mode hors-ligne */}
            {!online && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-gray-800 text-white flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium shadow-lg">
                    <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Vous êtes hors-ligne — les données affichées proviennent du cache local (lecture seule)</span>
                </div>
            )}
            {/* Bannière MODE INSPECTION (impersonation super_admin) */}
            {impersonating && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white flex items-center justify-between px-4 py-2 shadow-lg">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Eye className="w-4 h-4" />
                        <span>MODE INSPECTION - vous voyez l'app comme <strong>{user?.email}</strong> (lecture seule)</span>
                    </div>
                    <button
                        onClick={stopImpersonate}
                        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                    >
                        <X className="w-3.5 h-3.5" /> Quitter l'inspection
                    </button>
                </div>
            )}
            <Sidebar />
            <div
                className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'md:ml-[var(--sidebar-w)]' : 'ml-0'} ${!online && impersonating ? 'pt-20' : !online || impersonating ? 'pt-10' : ''}`}
            >
                <Topbar title={meta.title} subtitle={meta.subtitle} />
                <main className="fisca-main flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
                    <div className="mx-auto w-full max-w-[1280px]">
                        <Outlet />
                    </div>
                </main>
            </div>
            <NotifPanel />
            <Toaster />
        </div>
    );
}
