import { useState } from 'react';
import { authApi } from '../../lib/api';
import { Btn, Input, Card } from '../../components/ui';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await authApi.forgotPassword(email);
            setSent(true);
        } catch {
            setError('Email introuvable ou erreur serveur.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4"
                        style={{ background: '#24a05a' }}>F</div>
                    <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
                    <p className="text-sm text-gray-500 mt-1">Entrez votre email pour recevoir un lien de réinitialisation</p>
                </div>

                {sent ? (
                    <Card>
                        <div className="text-center py-4">
                            <Mail className="w-10 h-10 text-green-600 mx-auto mb-3" />
                            <p className="font-medium text-gray-900">Email envoyé !</p>
                            <p className="text-sm text-gray-500 mt-1">Vérifiez votre boîte mail et suivez le lien.</p>
                            <Link to="/login" className="block mt-4 text-sm text-green-600 hover:underline">
                                Retour à la connexion
                            </Link>
                        </div>
                    </Card>
                ) : (
                    <Card>
                        <form onSubmit={submit} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-100">{error}</div>
                            )}
                            <Input
                                label="Adresse email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="vous@exemple.com"
                                required
                            />
                            <Btn type="submit" className="w-full justify-center" disabled={loading}>
                                {loading ? 'Envoi…' : 'Envoyer le lien'}
                            </Btn>
                            <p className="text-center text-sm text-gray-500">
                                <Link to="/login" className="text-green-600 hover:underline">Retour à la connexion</Link>
                            </p>
                        </form>
                    </Card>
                )}
            </div>
        </div>
    );
}
