import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './layouts/AppLayout';

// Auth pages — chargées immédiatement (point d'entrée)
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// App pages — lazy loaded (un chunk par page)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SaisiePage = lazy(() => import('./pages/SaisiePage'));
const CalculPage = lazy(() => import('./pages/CalculPage'));
const RapportPage = lazy(() => import('./pages/RapportPage'));
const BulletinsPage = lazy(() => import('./pages/BulletinsPage'));
const SimulateurPage = lazy(() => import('./pages/SimulateurPage'));
const TVAPage = lazy(() => import('./pages/TVAPage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const BilanPage = lazy(() => import('./pages/BilanPage'));
const SocietesPage = lazy(() => import('./pages/SocietesPage'));
const WorkflowPage = lazy(() => import('./pages/WorkflowPage'));
const RetenuesPage = lazy(() => import('./pages/RetenuesPage'));
const CNSSPatronalPage = lazy(() => import('./pages/CNSSPatronalPage'));
const HistoriquePage = lazy(() => import('./pages/HistoriquePage'));
const ParametresPage = lazy(() => import('./pages/ParametresPage'));
const AbonnementPage = lazy(() => import('./pages/AbonnementPage'));
const ExercicePage = lazy(() => import('./pages/ExercicePage'));
const IRFPage = lazy(() => import('./pages/IRFPage'));
const IRCMPage = lazy(() => import('./pages/IRCMPage'));
const CMEPage = lazy(() => import('./pages/CMEPage'));
const ISPage = lazy(() => import('./pages/ISPage'));
const PatentePage = lazy(() => import('./pages/PatentePage'));

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Suspense fallback={
          <div className="flex items-center justify-center h-screen bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Chargement…</p>
            </div>
          </div>
        }>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/saisie" element={<SaisiePage />} />
              <Route path="/calcul" element={<CalculPage />} />
              <Route path="/rapport" element={<RapportPage />} />
              <Route path="/bulletins" element={<BulletinsPage />} />
              <Route path="/simulateur" element={<SimulateurPage />} />
              <Route path="/tva" element={<TVAPage />} />
              <Route path="/irf" element={<IRFPage />} />
              <Route path="/ircm" element={<IRCMPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/bilan" element={<BilanPage />} />
              <Route path="/societes" element={<SocietesPage />} />
              <Route path="/workflow" element={<WorkflowPage />} />
              <Route path="/retenues" element={<RetenuesPage />} />
              <Route path="/cnss-patronal" element={<CNSSPatronalPage />} />
              <Route path="/cme" element={<CMEPage />} />
              <Route path="/is" element={<ISPage />} />
              <Route path="/patente" element={<PatentePage />} />
              <Route path="/historique" element={<HistoriquePage />} />
              <Route path="/exercice" element={<ExercicePage />} />
              <Route path="/parametres" element={<ParametresPage />} />
              <Route path="/abonnement" element={<AbonnementPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
