import { useState, useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyApi, authApi } from '../lib/api';
import { Card, Btn, Input, Select, Spinner } from '../components/ui';
import { useAuthStore } from '../lib/store';
import { REGIMES_INFO } from '../lib/regime';
import type { Company } from '../types';
import { CheckCircle2, AlertCircle, Building2, MapPin, FileText, UserCircle, Info, CalendarRange } from 'lucide-react';
import { useContribuableStore } from '../contribuable/contribuableStore';
import { MOIS_LABELS } from '../contribuable/contribuableNav';
import { isCompanyProfileComplete } from '../lib/companyProfile';

const FORMES_JURIDIQUES = [
    { value: '', label: ' - Sélectionner - ' },
    { value: 'SARL', label: 'SARL - Société à Responsabilité Limitée' },
    { value: 'SA', label: 'SA - Société Anonyme' },
    { value: 'SAS', label: 'SAS - Société par Actions Simplifiée' },
    { value: 'SNC', label: 'SNC - Société en Nom Collectif' },
    { value: 'GIE', label: 'GIE - Groupement d\'Intérêt Économique' },
    { value: 'EI', label: 'EI - Entreprise Individuelle' },
    { value: 'EURL', label: 'EURL - Entreprise Unipersonnelle à Responsabilité Limitée' },
    { value: 'SCS', label: 'SCS - Société en Commandite Simple' },
    { value: 'Association', label: 'Association / ONG' },
    { value: 'Autre', label: 'Autre' },
];

const REGIMES = [
    { value: '', label: ' - Sélectionner - ' },
    { value: 'RNI', label: 'RNI - Régime du Réel Normal d\'Imposition' },
    { value: 'RSI', label: 'RSI - Régime du Réel Simplifié d\'Imposition' },
    { value: 'CME', label: 'CME - Contribution des Micro-Entreprises' },
    { value: 'BNC', label: 'BNC - Bénéfices Non Commerciaux' },
];

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <span className="text-green-600">{icon}</span>
            <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
    );
}

export default function ParametresPage() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const { user, setAuth } = useAuthStore();
    const period = useContribuableStore((s) => s.period);
    const setPeriod = useContribuableStore((s) => s.setPeriod);
    const [success, setSuccess] = useState('');
    const [saveError, setSaveError] = useState('');

    const IFU_RE = /^\d{10}[A-Z]{2}$/;
    const RC_RE = /^[A-Z]{2}-[A-Z0-9]{3}-\d{4}-[A-Z]-\d{4}$/;

    const { data: company, isLoading } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    const [form, setForm] = useState<Partial<Company>>({});

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (company) setForm(company);
    }, [company]);

    const update = useMutation({
        mutationFn: (data: Partial<Company>) => companyApi.update(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['company'] });
            setSaveError('');
            setSuccess('Paramètres mis à jour avec succès.');
            setTimeout(() => setSuccess(''), 3000);
            if (isCompanyProfileComplete(form as Company)) {
                navigate('/dashboard');
            }
        },
        onError: (err: { response?: { data?: { error?: string } } }) => {
            setSaveError(err?.response?.data?.error ?? 'Erreur lors de la sauvegarde.');
        },
    });

    // -- Compte utilisateur ------------------------------------
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

    const f = (key: keyof Company, label: string, placeholder?: string, type?: string) => {
        const val = String(form[key] ?? '');
        let error: string | undefined;
        if (key === 'ifu' && val && !IFU_RE.test(val))
            error = 'Format IFU invalide (ex : 0012345678BF - 10 chiffres + 2 lettres)';
        if (key === 'rc' && val && !RC_RE.test(val))
            error = 'Format RC invalide (ex : BF-OUA-2024-B-0001)';
        return (
            <Input
                label={label}
                type={type ?? 'text'}
                value={val}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                error={error}
            />
        );
    };

    return (
        <div className="max-w-3xl space-y-6">

            {/* -- Fiche contribuable DGI --------------------------- */}
            <Card title="Fiche contribuable - Informations DGI">
                <p className="text-xs text-gray-500 mb-5">
                    Ces informations sont pré-remplies automatiquement sur vos déclarations DGI (IUTS, TVA, IS, IRF, IRCM, retenues à la source…).
                    Complétez-les une fois, elles s'appliquent à tous vos formulaires.
                </p>

                {/* Section 1 : Identité fiscale */}
                <div className="mb-5">
                    <SectionTitle icon={<FileText className="w-4 h-4" />} title="Identité fiscale" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {f('nom', 'Raison sociale / Nom', 'Ma Société SARL')}
                        <Select
                            label="Forme juridique"
                            value={String(form.forme_juridique ?? '')}
                            options={FORMES_JURIDIQUES}
                            onChange={(e) => setForm((p) => ({ ...p, forme_juridique: e.target.value }))}
                        />
                        {f('ifu', 'Numéro IFU', '0012345678BF')}
                        {f('rc', 'Registre du commerce', 'BF-OUA-2024-B-0001')}
                        {f('secteur', 'Profession / Activité principale', 'Commerce général')}
                        {f('code_activite', 'Code activité DGI', 'ex : 4711')}
                    </div>
                </div>

                {/* Section 2 : Régime fiscal */}
                <div className="mb-5">
                    <SectionTitle icon={<Building2 className="w-4 h-4" />} title="Régime fiscal" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                            label="Régime d'imposition"
                            value={String(form.regime ?? '')}
                            options={REGIMES}
                            onChange={(e) => setForm((p) => ({ ...p, regime: e.target.value }))}
                        />
                        {f('centre_impots', 'Centre des impôts de rattachement', 'ex : CDI Ouaga I')}
                        {f('date_debut_activite', 'Date de début d\'activité', '', 'date')}
                    </div>
                    {/* Info box : obligations du régime sélectionné */}
                    {(() => {
                        const r = (form.regime ?? '') as keyof typeof REGIMES_INFO;
                        const info = REGIMES_INFO[r];
                        if (!info || !r) return (
                            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
                                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>Sélectionnez votre régime fiscal pour personnaliser votre calendrier fiscal et filtrer les modules applicables.</span>
                            </div>
                        );
                        return (
                            <div className="mt-3 rounded-lg px-4 py-3 text-xs" style={{ background: info.color + '11', border: `1px solid ${info.color}33` }}>
                                <p className="font-semibold mb-1" style={{ color: info.color }}>{info.label}</p>
                                <p className="text-gray-600 mb-2">{info.description}</p>
                                {info.obligations.length > 0 && (
                                    <ul className="space-y-0.5">
                                        {info.obligations.map((o) => (
                                            <li key={o} className="flex items-center gap-1.5 text-gray-700">
                                                <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: info.color }} />
                                                {o}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Section 3 : Coordonnées */}
                <div className="mb-5">
                    <SectionTitle icon={<MapPin className="w-4 h-4" />} title="Coordonnées et adresse du siège" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {f('adresse', 'Adresse (N° et rue)', 'ex : Avenue Kwame N\'Krumah')}
                        {f('ville', 'Localité / Ville', 'Ouagadougou')}
                        {f('quartier', 'Quartier / Secteur', 'ex : Secteur 04')}
                        {f('bp', 'Boîte postale (BP)', 'ex : BP 1234')}
                        {f('tel', 'Téléphone', '+226 70 00 00 00')}
                        {f('fax', 'Fax', '+226 25 00 00 00')}
                        {f('email_entreprise', 'Email de l\'entreprise', 'contact@masociete.bf', 'email')}
                    </div>
                </div>

                {saveError && (
                    <div className="mt-2 bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-100">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {saveError}
                        </div>
                    </div>
                )}
                {success && (
                    <div className="mt-2 bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg border border-green-100">
                        <div className="flex items-center gap-2 text-green-700 text-sm">
                            <CheckCircle2 className="w-4 h-4" /> {success}
                        </div>
                    </div>
                )}

                <div className="mt-4 flex justify-end">
                    <Btn
                        onClick={() => {
                            const ifu = String(form.ifu ?? '');
                            const rc = String(form.rc ?? '');
                            if (ifu && !IFU_RE.test(ifu)) { setSaveError('Format IFU invalide (ex : 0012345678BF)'); return; }
                            if (rc && !RC_RE.test(rc)) { setSaveError('Format RC invalide (ex : BF-OUA-2024-B-0001)'); return; }
                            setSaveError('');
                            update.mutate(form);
                        }}
                        disabled={update.isPending}
                    >
                        {update.isPending ? 'Sauvegarde…' : 'Sauvegarder la fiche contribuable'}
                    </Btn>
                </div>
            </Card>

            <Card title="Période de déclaration (annexes DGI)">
                <p className="text-xs text-gray-500 mb-4">
                    Mois et exercice utilisés pour IUTS, ROS, retenues, TVA annexes, etc. Modifiez-les ici avant la saisie dans{' '}
                    <Link to="/declarations/iuts" className="font-semibold text-green-700 underline">
                        Déclarations et annexes
                    </Link>
                    .
                </p>
                <div className="mb-2">
                    <SectionTitle icon={<CalendarRange className="w-4 h-4" />} title="Mois et exercice" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                            label="Mois"
                            value={String(period.month)}
                            options={MOIS_LABELS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))}
                            onChange={(e) => setPeriod({ month: +e.target.value })}
                        />
                        <Select
                            label="Exercice"
                            value={String(period.year)}
                            options={[2023, 2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))}
                            onChange={(e) => setPeriod({ year: +e.target.value })}
                        />
                    </div>
                </div>
            </Card>

            {/* -- Compte utilisateur ------------------------------ */}
            <Card title="Compte utilisateur">
                <div className="space-y-5">
                    <SectionTitle icon={<UserCircle className="w-4 h-4" />} title="Identifiants de connexion" />

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

                    {/* Mot de passe */}
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

                </div>
            </Card>
        </div>
    );
}


