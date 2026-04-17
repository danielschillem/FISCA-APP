import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="text-[96px] font-black text-gray-200 leading-none select-none">404</div>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">Page introuvable</h1>
                <p className="text-gray-500 text-sm mt-2 mb-8">
                    La page que vous recherchez n'existe pas ou a été déplacée.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Retour
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{ background: '#16a34a' }}
                    >
                        <Home className="w-4 h-4" /> Tableau de bord
                    </button>
                </div>
            </div>
        </div>
    );
}
