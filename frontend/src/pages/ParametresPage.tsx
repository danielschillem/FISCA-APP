import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyApi, authApi } from '../lib/api';
import { Card, Btn, Input, Spinner } from '../components/ui';
import { useAuthStore } from '../lib/store';
import type { Company } from '../types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function ParametresPage() {
    const qc = useQueryClient();
    const { user, setAuth } = useAuthStore();
    const [success, setSuccess] = useState('');

    const { data: company, isLoading } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    const [form, setForm] = useState<Partial<Company>>({});

    useEffect(() => {
        if (company) setForm(company);
    }, [company]);

    const update = useMutation({
        mutationFn: (data: Partial<Company>) => companyApi.update(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['company'] });
            setSuccess('Paramètres mis à jour.');
            setTimeout(() => setSuccess(''), 3000);
        },
    });

    // ── Compte utilisateur ────────────────────────────────────
    const [email, setEmail] = useState(user?.email ?? '');
    const [emailSuccess, setEmailSuccess] = useState('');
    const [emailError, setEmailError] = useState('');

    const updateEmail = useMutation({
        mutationFn: (newEmail: string) => authApi.updateMe({ email: newEmail }),
        onSuccess: (res) => {
            const { token } = useAuthStore.getState();
            setAuth(token ?? '', res.data);
            setEmailSuccess('Email mis à jour.');
            setEmailError('');
            setTimeout(() => setEmailSuccess(''), 3000);
        },
        onError: () => setEmailError('Email déjà utilisé ou invalide.'),
    });

    const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
    const [pwdSuccess, setPwdSuccess] = useState('');
    const [pwdError, setPwdError] = useState('');

    const changePwd = useMutation({
        mutationFn: () => authApi.changePassword({ current_password: pwd.current, new_password: pwd.next }),
        onSuccess: () => {
            setPwd({ current: '', next: '', confirm: '' });
            setPwdSuccess('Mot de passe modifié avec succès.');
            setPwdError('');
            setTimeout(() => setPwdSuccess(''), 4000);
        },
        onError: (err: { response?: { data?: { error?: string } } }) => {
            setPwdError(err?.response?.data?.error ?? 'Erreur : vérifiez votre mot de passe actuel.');
        },
    });

    const handleChangePwd = () => {
        setPwdError('');
        if (pwd.next.length < 8) { setPwdError('Nouveau mot de passe : 8 caractères minimum.'); return; }
        if (pwd.next !== pwd.confirm) { setPwdError('Les mots de passe ne correspondent pas.'); return; }
        changePwd.mutate();
    };

    if (isLoading) return <Spinner />;

    const f = (key: keyof Company, label: string, placeholder?: string) => (
        <Input
            label={label}
            value={String(form[key] ?? '')}
            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            placeholder={placeholder}
        />
    );

    return (
        <div className="max-w-2xl space-y-6">
            <Card title="Informations de l'entreprise">
                <div className="grid grid-cols-2 gap-4">
                    {f('nom', 'Nom de l\'entreprise', 'Ma Société SARL')}
                    {f('ifu', 'Numéro IFU', '0012345BF')}
                    {f('rc', 'Registre du commerce', 'BF-OUA-2024-B-0001')}
                    {f('secteur', 'Secteur d\'activité', 'Commerce général')}
                    {f('tel', 'Téléphone', '+226 70 00 00 00')}
                    {f('adresse', 'Adresse', 'Ouagadougou, Burkina Faso')}
                </div>

                {success && (
                    <div className="mt-4 bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg border border-green-100">
                        <div className="flex items-center gap-2 text-green-700 text-sm"><CheckCircle2 className="w-4 h-4" /> {success}</div>
                    </div>
                )}

                <div className="mt-4 flex justify-end">
                    <Btn
                        onClick={() => update.mutate(form)}
                        disabled={update.isPending}
                    >
                        {update.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
                    </Btn>
                </div>
            </Card>

            <Card title="Compte utilisateur">
                <div className="space-y-5">
                    {/* Email */}
                    <div>
                        <Input
                            label="Adresse email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        {emailSuccess && (
                            <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />{emailSuccess}
                            </p>
                        )}
                        {emailError && (
                            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />{emailError}
                            </p>
                        )}
                        <div className="mt-2 flex justify-end">
                            <Btn
                                size="sm"
                                variant="outline"
                                disabled={updateEmail.isPending || email === user?.email}
                                onClick={() => updateEmail.mutate(email)}
                            >
                                {updateEmail.isPending ? 'Sauvegarde…' : 'Mettre à jour l\'email'}
                            </Btn>
                        </div>
                    </div>

                    {/* Password change */}
                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-sm font-medium text-gray-700 mb-3">Changer le mot de passe</p>
                        <div className="space-y-3">
                            <Input
                                label="Mot de passe actuel"
                                type="password"
                                value={pwd.current}
                                onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
                                autoComplete="current-password"
                            />
                            <Input
                                label="Nouveau mot de passe"
                                type="password"
                                value={pwd.next}
                                onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                                autoComplete="new-password"
                            />
                            <Input
                                label="Confirmer le nouveau mot de passe"
                                type="password"
                                value={pwd.confirm}
                                onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                                autoComplete="new-password"
                            />
                        </div>
                        {pwdSuccess && (
                            <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />{pwdSuccess}
                            </p>
                        )}
                        {pwdError && (
                            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />{pwdError}
                            </p>
                        )}
                        <div className="mt-3 flex justify-end">
                            <Btn
                                size="sm"
                                disabled={changePwd.isPending || !pwd.current || !pwd.next}
                                onClick={handleChangePwd}
                            >
                                {changePwd.isPending ? 'Modification…' : 'Changer le mot de passe'}
                            </Btn>
                        </div>
                    </div>

                    {/* Plan */}
                    <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                        <span className="text-sm text-gray-500">Plan actuel</span>
                        <span className="text-sm font-semibold text-green-700 capitalize">{user?.plan}</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}

