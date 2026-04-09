'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyApi, userApi, exerciceApi } from '@/lib/api'
import type { Company, User, ExerciceFiscal } from '@/types'
import toast from 'react-hot-toast'
import { Save, Building2, User as UserIcon, Lock, CalendarDays, PlusCircle, CheckCircle, AlertTriangle } from 'lucide-react'

type Tab = 'entreprise' | 'profil' | 'securite' | 'exercice'

export default function ParametresPage() {
    const qc = useQueryClient()
    const [tab, setTab] = useState<Tab>('entreprise')

    // ─── Entreprise ──────────────────────────────────────────
    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then(r => r.data),
    })
    const [companyForm, setCompanyForm] = useState<Partial<Company>>({})
    useEffect(() => { if (company) setCompanyForm(company) }, [company])

    const updateCompanyMut = useMutation({
        mutationFn: () => companyApi.update(companyForm),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); toast.success('Informations enregistrées') },
        onError: () => toast.error('Erreur lors de la sauvegarde'),
    })

    // ─── Profil ──────────────────────────────────────────────
    const { data: me } = useQuery<User>({
        queryKey: ['me'],
        queryFn: () => userApi.me().then(r => r.data),
    })
    const [email, setEmail] = useState('')
    useEffect(() => { if (me) setEmail(me.email) }, [me])

    const updateMeMut = useMutation({
        mutationFn: () => userApi.updateMe({ email }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Profil mis à jour') },
        onError: () => toast.error('Erreur lors de la mise à jour'),
    })

    // ─── Sécurité ────────────────────────────────────────────
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })

    // ─── Exercice fiscal ─────────────────────────────────────
    const { data: exercices = [] } = useQuery<ExerciceFiscal[]>({
        queryKey: ['exercices'],
        queryFn: () => exerciceApi.list().then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })
    const actif = exercices.find(e => e.statut === 'en_cours') ?? null
    const currentYear = new Date().getFullYear()
    const [exForm, setExForm] = useState({ annee: currentYear, date_debut: '', date_fin: '', note: '' })

    const createExerciceMut = useMutation({
        mutationFn: () => exerciceApi.create({
            annee: exForm.annee,
            date_debut: exForm.date_debut || undefined,
            date_fin: exForm.date_fin || undefined,
            note: exForm.note,
        }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['exercices'] }); toast.success('Exercice ouvert') },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'
            toast.error(msg)
        },
    })

    const cloturerMut = useMutation({
        mutationFn: (id: string) => exerciceApi.cloturer(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['exercices'] }); toast.success('Exercice clôturé') },
        onError: () => toast.error('Erreur lors de la clôture'),
    })

    const changePwMut = useMutation({
        mutationFn: () => {
            if (pwForm.new_password !== pwForm.confirm) throw new Error('Les mots de passe ne correspondent pas')
            if (pwForm.new_password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères')
            return userApi.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password })
        },
        onSuccess: () => {
            setPwForm({ current_password: '', new_password: '', confirm: '' })
            toast.success('Mot de passe modifié avec succès')
        },
        onError: (e: unknown) => {
            const msg = e instanceof Error
                ? e.message
                : (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'
            toast.error(msg)
        },
    })

    const tabStyle = (t: Tab) => ({
        padding: '8px 16px',
        border: 'none',
        borderBottom: tab === t ? '2px solid var(--prime)' : '2px solid transparent',
        background: 'none',
        cursor: 'pointer',
        fontWeight: tab === t ? 600 : 400,
        color: tab === t ? 'var(--prime)' : 'var(--gr6)',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    })

    return (
        <div style={{ maxWidth: 700 }}>
            {/* Onglets */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--gr2)', marginBottom: 20 }}>
                <button style={tabStyle('entreprise')} onClick={() => setTab('entreprise')}>
                    <Building2 size={14} /> Entreprise
                </button>
                <button style={tabStyle('profil')} onClick={() => setTab('profil')}>
                    <UserIcon size={14} /> Profil
                </button>
                <button style={tabStyle('securite')} onClick={() => setTab('securite')}>
                    <Lock size={14} /> Sécurité
                </button>
                <button style={tabStyle('exercice')} onClick={() => setTab('exercice')}>
                    <CalendarDays size={14} /> Exercice fiscal
                </button>
            </div>

            {/* Onglet Entreprise */}
            {tab === 'entreprise' && (
                <div className="card">
                    <div className="card-header">
                        <h3><Building2 size={15} style={{ marginRight: 6 }} />Informations de l'entreprise</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-grid">
                            {([
                                ['nom', 'Dénomination sociale'],
                                ['ifu', 'Numéro IFU'],
                                ['rc', 'Registre du Commerce (RC)'],
                                ['secteur', "Secteur d'activité"],
                                ['adresse', 'Adresse'],
                                ['tel', 'Téléphone'],
                            ] as [keyof Company, string][]).map(([key, label]) => (
                                <div key={key} className="form-group">
                                    <label>{label}</label>
                                    <input
                                        type="text"
                                        value={(companyForm[key] as string) || ''}
                                        onChange={e => setCompanyForm(f => ({ ...f, [key]: e.target.value }))}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex-end" style={{ marginTop: 16 }}>
                            <button className="btn btn-primary"
                                onClick={() => updateCompanyMut.mutate()} disabled={updateCompanyMut.isPending}>
                                <Save size={15} />
                                {updateCompanyMut.isPending ? 'Sauvegarde…' : 'Enregistrer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Onglet Profil */}
            {tab === 'profil' && (
                <div className="card">
                    <div className="card-header">
                        <h3><UserIcon size={15} style={{ marginRight: 6 }} />Mon profil</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Adresse e-mail</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        {me && (
                            <div style={{ fontSize: 12, color: 'var(--gr5)', marginBottom: 12 }}>
                                Plan actuel : <strong>{me.plan}</strong> · Membre depuis le {new Date(me.created_at).toLocaleDateString('fr-FR')}
                            </div>
                        )}
                        <div className="flex-end">
                            <button className="btn btn-primary"
                                onClick={() => updateMeMut.mutate()}
                                disabled={updateMeMut.isPending || !email}>
                                <Save size={15} />
                                {updateMeMut.isPending ? 'Sauvegarde…' : 'Mettre à jour'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Onglet Sécurité */}
            {tab === 'securite' && (
                <div className="card">
                    <div className="card-header">
                        <h3><Lock size={15} style={{ marginRight: 6 }} />Changer le mot de passe</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Mot de passe actuel</label>
                            <input
                                type="password"
                                value={pwForm.current_password}
                                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Nouveau mot de passe</label>
                            <input
                                type="password"
                                value={pwForm.new_password}
                                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirmer le nouveau mot de passe</label>
                            <input
                                type="password"
                                value={pwForm.confirm}
                                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                            />
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--gr5)', marginBottom: 12 }}>
                            Minimum 8 caractères. La modification déconnectera toutes vos autres sessions.
                        </p>
                        <div className="flex-end">
                            <button
                                className="btn btn-primary"
                                onClick={() => changePwMut.mutate()}
                                disabled={changePwMut.isPending || !pwForm.current_password || !pwForm.new_password}
                            >
                                <Lock size={15} />
                                {changePwMut.isPending ? 'Modification…' : 'Changer le mot de passe'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Onglet Exercice fiscal */}
            {tab === 'exercice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Exercice actif */}
                    {actif ? (
                        <div className="card">
                            <div className="card-header">
                                <h3><CheckCircle size={15} style={{ marginRight: 6, color: 'var(--prime)' }} />Exercice en cours</h3>
                                <span className="ch-right" style={{ color: 'var(--prime)', fontWeight: 600 }}>{actif.annee}</span>
                            </div>
                            <div className="card-body">
                                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
                                    <div>
                                        <p style={{ fontSize: 11, color: 'var(--gr5)', margin: 0 }}>Date de début</p>
                                        <p style={{ fontWeight: 600, margin: '2px 0 0' }}>{new Date(actif.date_debut).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 11, color: 'var(--gr5)', margin: 0 }}>Date de fin</p>
                                        <p style={{ fontWeight: 600, margin: '2px 0 0' }}>{new Date(actif.date_fin).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                </div>
                                {actif.note && (
                                    <p style={{ fontSize: 13, color: 'var(--gr6)', marginBottom: 12 }}>{actif.note}</p>
                                )}
                                <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                                    <p style={{ margin: 0, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <AlertTriangle size={14} />
                                        La clôture est irréversible. Tous les bilans de l&apos;exercice {actif.annee} seront figés.
                                        Assurez-vous que toutes les déclarations du mois de décembre sont validées.
                                    </p>
                                </div>
                                <div className="flex-end">
                                    <button
                                        className="btn"
                                        style={{ background: '#dc2626', color: '#fff' }}
                                        onClick={() => {
                                            if (window.confirm(`Clôturer l'exercice ${actif.annee} ? Cette action est irréversible.`)) {
                                                cloturerMut.mutate(actif.id)
                                            }
                                        }}
                                        disabled={cloturerMut.isPending}
                                    >
                                        <CalendarDays size={15} />
                                        {cloturerMut.isPending ? 'Clôture…' : `Clôturer l'exercice ${actif.annee}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-header">
                                <h3><PlusCircle size={15} style={{ marginRight: 6, color: 'var(--prime)' }} />Ouvrir un nouvel exercice</h3>
                            </div>
                            <div className="card-body">
                                <p style={{ fontSize: 13, color: 'var(--gr5)', marginBottom: 16 }}>
                                    Aucun exercice fiscal en cours. Définissez l&apos;année fiscale active pour commencer les saisies.
                                </p>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Année fiscale</label>
                                        <input
                                            type="number"
                                            min={2020} max={2050}
                                            value={exForm.annee}
                                            onChange={e => setExForm(f => ({ ...f, annee: +e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Date de début <span style={{ color: 'var(--gr4)', fontWeight: 400 }}>(optionnel)</span></label>
                                        <input
                                            type="date"
                                            value={exForm.date_debut}
                                            placeholder={`${exForm.annee}-01-01`}
                                            onChange={e => setExForm(f => ({ ...f, date_debut: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Date de fin <span style={{ color: 'var(--gr4)', fontWeight: 400 }}>(optionnel)</span></label>
                                        <input
                                            type="date"
                                            value={exForm.date_fin}
                                            placeholder={`${exForm.annee}-12-31`}
                                            onChange={e => setExForm(f => ({ ...f, date_fin: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Note <span style={{ color: 'var(--gr4)', fontWeight: 400 }}>(optionnel)</span></label>
                                        <input
                                            type="text"
                                            value={exForm.note}
                                            placeholder="Ex: Premier exercice — période de lancement"
                                            onChange={e => setExForm(f => ({ ...f, note: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="flex-end" style={{ marginTop: 12 }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => createExerciceMut.mutate()}
                                        disabled={createExerciceMut.isPending || !exForm.annee}
                                    >
                                        <PlusCircle size={15} />
                                        {createExerciceMut.isPending ? 'Ouverture…' : `Ouvrir l'exercice ${exForm.annee}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Historique des exercices clôturés */}
                    {exercices.filter(e => e.statut === 'cloture').length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h3>Exercices clôturés</h3>
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Année</th>
                                            <th>Période</th>
                                            <th>Date de clôture</th>
                                            <th>Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {exercices.filter(e => e.statut === 'cloture').map(e => (
                                            <tr key={e.id}>
                                                <td style={{ fontWeight: 600 }}>{e.annee}</td>
                                                <td style={{ fontSize: 12 }}>
                                                    {new Date(e.date_debut).toLocaleDateString('fr-FR')} → {new Date(e.date_fin).toLocaleDateString('fr-FR')}
                                                </td>
                                                <td style={{ fontSize: 12, color: 'var(--gr5)' }}>
                                                    {e.date_cloture ? new Date(e.date_cloture).toLocaleDateString('fr-FR') : '—'}
                                                </td>
                                                <td style={{ fontSize: 12, color: 'var(--gr5)' }}>{e.note || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
