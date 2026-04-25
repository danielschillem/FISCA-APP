import { Navigate, useLocation } from 'react-router-dom';

/** Anciennes URLs `/contribuable/*` → `/declarations/*`. */
export default function ContribuableLegacyRedirect() {
    const { pathname } = useLocation();
    const tail = pathname.replace(/^\/contribuable\/?/, '') || 'generer';
    return <Navigate to={`/declarations/${tail}`} replace />;
}
