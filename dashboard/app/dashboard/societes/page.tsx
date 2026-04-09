'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi, setActiveCompany } from '@/lib/api'
import type { Company } from '@/types'
import { Building2, Plus, Edit2, Trash2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type CompanyForm = Omit<Company, 'id' | 'user_id'>

const EMPTY_FORM: CompanyForm = { nom: '', ifu: '', rc: '', secteur: '', adresse: '', tel: '' }

export default function SocietesPage() {
    const qc = useQueryClient()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState<CompanyForm>(EMPTY_FORM)
    const [activeId, setActiveId] = useState<string | null>(
        typeof window !== 'undefined' ? localStorage.getItem('fisca_company_id') : null
    )

    const { data: companies = [], isLoading } = useQuery<Company[]>({
        queryKey: ['companies'],
        queryFn: () => companiesApi.list().then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })

    const createMut = useMutation({
        mutationFn: () => companiesApi.create(form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['companies'] })
            setShowCreate(false)
            setForm(EMPTY_FORM)
            toast.success('Société créée')
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Erreur lors de la création')
        },
    })

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CompanyForm }) => companiesApi.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['companies'] })
            setEditingId(null)
            toast.success('Société mise à jour')
        },
        onError: () => toast.error('Erreur lors de la mise à jour'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => companiesApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Société supprimée') },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Impossible de supprimer')
        },
    })

    function switchCompany(id: string) {
        setActiveId(id)
        setActiveCompany(id)
        if (typeof window !== 'undefined') localStorage.setItem('fisca_company_id', id)
        toast.success('Société active modifiée')
    }

    function startEdit(c: Company) {
        setEditingId(c.id)
        setForm({ nom: c.nom, ifu: c.ifu, rc: c.rc, secteur: c.secteur, adresse: c.adresse, tel: c.tel })
        setShowCreate(false)
    }

    function startCreate() {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setShowCreate(true)
    }

    const formFields: [keyof CompanyForm, string, string?][] = [
        ['nom', 'Dénomination sociale'],
        ['ifu', 'Numéro IFU'],
        ['rc', 'Registre du Commerce (RC)'],
        ['secteur', "Secteur d'activité"],
        ['adresse', 'Adresse'],
        ['tel', 'Téléphone', 'tel'],
    ]

    function renderForm(onSave: () => void, onCancel: () => void, loading: boolean) {
        return (
            <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-header">
                    <h3>{editingId ? 'Modifier la société' : 'Nouvelle société'}</h3>
                </div>
                <div className="card-body">
                    <div className="form-grid">
                        {formFields.map(([key, label, type]) => (
                            <div key={key} className="form-group">
                                <label>{label}</label>
                                <input
                                    type={type ?? 'text'}
                                    value={form[key]}
                                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                />
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={onCancel}>Annuler</button>
                        <button className="btn btn-primary" onClick={onSave} disabled={loading || !form.nom}>
                            {loading ? 'Sauvegarde…' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 900 }}>
            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--gr5)', margin: 0 }}>
                    Gérez plusieurs sociétés et basculez d'un contexte à l'autre.
                </p>
                <button className="btn btn-primary" onClick={startCreate} disabled={showCreate}>
                    <Plus size={14} /> Nouvelle société
                </button>
            </div>

            {/* Formulaire création */}
            {showCreate && renderForm(
                () => createMut.mutate(),
                () => setShowCreate(false),
                createMut.isPending,
            )}

            {/* Formulaire édition */}
            {editingId && companies.find(c => c.id === editingId) && renderForm(
                () => updateMut.mutate({ id: editingId, data: form }),
                () => setEditingId(null),
                updateMut.isPending,
            )}

            {/* Liste */}
            <div className="card">
                <div className="card-header">
                    <h3><Building2 size={15} style={{ marginRight: 6 }} />Mes sociétés</h3>
                    <span className="ch-right">{companies.length} société{companies.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="table-wrap">
                    {isLoading ? (
                        <p style={{ padding: '20px 16px', color: 'var(--gr5)', fontSize: 13 }}>Chargement…</p>
                    ) : companies.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                            <Building2 size={32} style={{ color: 'var(--gr3)', marginBottom: 8 }} />
                            <p style={{ color: 'var(--gr5)', fontSize: 13 }}>Aucune société trouvée.</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Statut</th>
                                    <th>Dénomination</th>
                                    <th>IFU</th>
                                    <th>RC</th>
                                    <th>Secteur</th>
                                    <th>Téléphone</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {companies.map((c) => (
                                    <tr key={c.id} style={{ background: c.id === activeId ? 'var(--gr1)' : undefined }}>
                                        <td>
                                            {c.id === activeId ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--prime)', fontSize: 12, fontWeight: 600 }}>
                                                    <Check size={13} /> Active
                                                </span>
                                            ) : (
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => switchCompany(c.id)}
                                                    style={{ fontSize: 11 }}
                                                >
                                                    Activer
                                                </button>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{c.nom}</td>
                                        <td style={{ color: 'var(--gr6)' }}>{c.ifu || '—'}</td>
                                        <td style={{ color: 'var(--gr6)' }}>{c.rc || '—'}</td>
                                        <td>{c.secteur || '—'}</td>
                                        <td>{c.tel || '—'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => startEdit(c)}
                                                    title="Modifier"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ color: 'var(--red)' }}
                                                    title="Supprimer"
                                                    onClick={() => {
                                                        if (confirm(`Supprimer « ${c.nom} » ? Cette action est irréversible.`))
                                                            deleteMut.mutate(c.id)
                                                    }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
