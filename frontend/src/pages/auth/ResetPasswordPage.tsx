import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { Btn, Input, Card } from '../../components/ui';
import { Link } from 'react-router-dom';

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
        if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
        setLoading(true);
        setError('');
        try {
            await authApi.resetPassword(token, password);
            navigate('/login?reset=1');
        } catch {
            setError('Token invalide ou expiré. Demandez un nouveau lien.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card><p className="text-gray-500 text-sm">Lien invalide. <Link to="/forgot-password" className="text-green-600 underline">Demander un nouveau lien</Link>.</p></Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4"
                        style={{ background: '#24a05a' }}>F</div>
                    <h1 className="text-2xl font-bold text-gray-900">Nouveau mot de passe</h1>
                    <p className="text-sm text-gray-500 mt-1">Choisissez un mot de passe sécurisé</p>
                </div>

                <Card>
                    <form onSubmit={submit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-100">{error}</div>
                        )}
                        <Input
                            label="Nouveau mot de passe"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 8 caractères"
                            required
                        />
                        <Input
                            label="Confirmer le mot de passe"
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Répéter le mot de passe"
                            required
                        />
                        <Btn type="submit" className="w-full justify-center" disabled={loading}>
                            {loading ? 'Mise à jour…' : 'Réinitialiser'}
                        </Btn>
                    </form>
                </Card>
            </div>
        </div>
    );
}
