import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SaisiePage from './pages/SaisiePage';
import CalculPage from './pages/CalculPage';
import RapportPage from './pages/RapportPage';
import BulletinsPage from './pages/BulletinsPage';
import SimulateurPage from './pages/SimulateurPage';
import TVAPage from './pages/TVAPage';
import AssistantPage from './pages/AssistantPage';
import BilanPage from './pages/BilanPage';
import SocietesPage from './pages/SocietesPage';
import WorkflowPage from './pages/WorkflowPage';
import RetenuesPage from './pages/RetenuesPage';
import CNSSPatronalPage from './pages/CNSSPatronalPage';
import HistoriquePage from './pages/HistoriquePage';
import ParametresPage from './pages/ParametresPage';
import AbonnementPage from './pages/AbonnementPage';
import ExercicePage from './pages/ExercicePage';
import IRFPage from './pages/IRFPage';
import IRCMPage from './pages/IRCMPage';
import CMEPage from './pages/CMEPage';
import ISPage from './pages/ISPage';
import PatentePage from './pages/PatentePage';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
