import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore, useAppStore } from '../lib/store';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import NotifPanel from '../components/NotifPanel';
import { useLocation } from 'react-router-dom';

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
    '/dashboard': { title: 'Tableau de bord', subtitle: 'Exercice fiscal en cours' },
    '/saisie': { title: 'Saisie mensuelle', subtitle: 'Rémunérations et cotisations' },
    '/calcul': { title: 'Calculateur Fiscal', subtitle: 'CGI 2025 : Burkina Faso' },
    '/rapport': { title: 'Rapport du mois', subtitle: 'Aperçu et génération du document' },
    '/bulletins': { title: 'Bulletins de paie', subtitle: 'Export PDF individuel' },
    '/simulateur': { title: 'Simulateur fiscal', subtitle: 'Scénarios et comparaison A/B' },
    '/tva': { title: 'Module TVA', subtitle: 'CGI 2025 · Art. 317 · 18 %' },
    '/irf': { title: 'IRF : Revenus Fonciers', subtitle: 'CGI 2025 · Art. 121–126' },
    '/ircm': { title: 'IRCM : Capitaux mobiliers', subtitle: 'CGI 2025 · Art. 140' },
    '/assistant': { title: 'Assistant IA Fiscal', subtitle: 'Conseils fiscaux intelligents' },
    '/societes': { title: 'Multi-Sociétés', subtitle: 'Gestion multi-entités' },
    '/workflow': { title: 'Workflow Approbation', subtitle: 'Validation des déclarations' },
    '/retenues': { title: 'Retenue à la source', subtitle: 'CGI 2025 : Art. 206–226' },
    '/cnss-patronal': { title: 'CNSS Patronal', subtitle: 'Cotisations patronales complètes' },
    '/cme': { title: 'CME : Micro-Entreprises', subtitle: 'CGI 2025 · Art. 533' },
    '/is': { title: 'IS / MFP', subtitle: 'CGI 2025 · Art. 42 · 27,5 %' },
    '/patente': { title: 'Patentes', subtitle: 'CGI 2025 · Art. 237–240' },
    '/historique': { title: 'Historique Fiscal', subtitle: 'Toutes les déclarations' },
    '/bilan': { title: 'Bilan Annuel', subtitle: 'Synthèse de l\'exercice' },
    '/abonnement': { title: 'Mon Abonnement', subtitle: 'Plans & fonctionnalités' },
    '/parametres': { title: 'Paramètres', subtitle: 'Informations de l\'entreprise' },
};

export default function AppLayout() {
    const { token } = useAuthStore();
    const { sidebarOpen } = useAppStore();
    const location = useLocation();

    if (!token) return <Navigate to="/login" replace />;

    const meta = PAGE_META[location.pathname] ?? { title: 'FISCA' };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar />
            <div
                className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'ml-0'
                    }`}
            >
                <Topbar title={meta.title} subtitle={meta.subtitle} />
                <main className="flex-1 p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>
            <NotifPanel />
        </div>
    );
}
