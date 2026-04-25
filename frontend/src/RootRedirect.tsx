import { Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';

/** Point d’entrée `/` : tableau de bord pour les contribuables, admin sinon. */
export default function RootRedirect() {
    const { token, user, impersonating } = useAuthStore();
    if (!token) return <Navigate to="/login" replace />;
    if (user?.role === 'super_admin' && !impersonating) return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
}
