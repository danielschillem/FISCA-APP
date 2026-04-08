'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '@/lib/api'
import type { Employee } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'

const EMPTY: Omit<Employee, 'id' | 'company_id'> = {
    nom: '', categorie: 'Non-cadre', charges: 0,
    salaire_base: 0, anciennete: 0, heures_sup: 0,
    logement: 0, transport: 0, fonction: 0,
}

export default function SaisiePage() {
    const qc = useQueryClient()
    const { data: employees = [], isLoading } = useQuery<Employee[]>({
        queryKey: ['employees'],
        queryFn: () => employeesApi.list().then((r) => r.data),
    })

    const [form, setForm] = useState<Omit<Employee, 'id' | 'company_id'>>(EMPTY)
    const [editId, setEditId] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)

    const createMut = useMutation({
        mutationFn: (e: unknown) => employeesApi.create(e),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); reset(); toast.success('Employe ajoute') },
        onError: () => toast.error("Erreur lors de l'ajout"),
    })
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: unknown }) => employeesApi.update(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); reset(); toast.success('Employe modifie') },
        onError: () => toast.error('Erreur lors de la modification'),
    })
    const deleteMut = useMutation({
        mutationFn: (id: string) => employeesApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employe supprime') },
        onError: () => toast.error('Erreur lors de la suppression'),
    })

    function reset() { setForm(EMPTY); setEditId(null); setShowForm(false) }

    function handleEdit(e: Employee) {
        setForm({
            nom: e.nom, categorie: e.categorie, charges: e.charges,
            salaire_base: e.salaire_base, anciennete: e.anciennete, heures_sup: e.heures_sup,
            logement: e.logement, transport: e.transport, fonction: e.fonction,
        })
        setEditId(e.id!)
        setShowForm(true)
    }

    function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault()
        if (editId) updateMut.mutate({ id: editId, data: form })
        else createMut.mutate(form)
    }

    const numField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))

    return (
        <div>
            <div className="card">
                <div className="card-header">
                    <h3><Users size={15} style={{ marginRight: 6 }} />Gestion des employes</h3>
                    <button className="btn btn-primary btn-sm" onClick={() => { reset(); setShowForm(true) }}>
                        <Plus size={14} /> Ajouter
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="card-body" style={{ borderBottom: '1px solid var(--gr1)' }}>
                        <div className="r-section-title">{editId ? "Modifier l'employe" : 'Nouvel employe'}</div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid" style={{ marginBottom: 12 }}>
                                <div className="form-group" style={{ gridColumn: 'span 3' }}>
                                    <label>Nom complet <span className="req">*</span></label>
                                    <input required value={form.nom}
                                        onChange={(e) => setForm(f => ({ ...f, nom: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Categorie</label>
                                    <select value={form.categorie}
                                        onChange={(e) => setForm(f => ({ ...f, categorie: e.target.value as Employee['categorie'] }))}>
                                        <option value="Non-cadre">Non-cadre</option>
                                        <option value="Cadre">Cadre</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Charges familiales</label>
                                    <input type="number" min="0" max="6" value={form.charges}
                                        onChange={(e) => setForm(f => ({ ...f, charges: parseInt(e.target.value) || 0 }))} />
                                </div>
                                <div className="form-group">
                                    <label>Salaire de base (FCFA)</label>
                                    <input type="number" min="0" step="500" value={form.salaire_base} onChange={numField('salaire_base')} />
                                </div>
                                <div className="form-group">
                                    <label>Anciennete (FCFA)</label>
                                    <input type="number" min="0" step="500" value={form.anciennete} onChange={numField('anciennete')} />
                                </div>
                                <div className="form-group">
                                    <label>Heures supplementaires</label>
                                    <input type="number" min="0" step="500" value={form.heures_sup} onChange={numField('heures_sup')} />
                                </div>
                                <div className="form-group">
                                    <label>Logement (FCFA)</label>
                                    <input type="number" min="0" step="500" value={form.logement} onChange={numField('logement')} />
                                </div>
                                <div className="form-group">
                                    <label>Transport (FCFA)</label>
                                    <input type="number" min="0" step="500" value={form.transport} onChange={numField('transport')} />
                                </div>
                                <div className="form-group">
                                    <label>Fonction (FCFA)</label>
                                    <input type="number" min="0" step="500" value={form.fonction} onChange={numField('fonction')} />
                                </div>
                            </div>
                            <div className="flex-end">
                                <button type="button" className="btn btn-outline btn-sm" onClick={reset}>Annuler</button>
                                <button type="submit" className="btn btn-primary btn-sm"
                                    disabled={createMut.isPending || updateMut.isPending}>
                                    {editId ? 'Enregistrer' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tableau */}
                <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Categorie</th>
                                <th>Charges</th>
                                <th>Salaire base</th>
                                <th>Logement</th>
                                <th>Transport</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--gr5)' }}>Chargement…</td></tr>
                            ) : employees.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--gr5)' }}>Aucun employe. Ajoutez-en un.</td></tr>
                            ) : employees.map((e) => (
                                <tr key={e.id}>
                                    <td className="td-name">{e.nom}</td>
                                    <td><span className="tag tag-green">{e.categorie}</span></td>
                                    <td>{e.charges}</td>
                                    <td className="td-num">{fmtFCFA(e.salaire_base)}</td>
                                    <td className="td-num">{fmtFCFA(e.logement)}</td>
                                    <td className="td-num">{fmtFCFA(e.transport)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" onClick={() => handleEdit(e)} title="Modifier">
                                                <Pencil size={14} />
                                            </button>
                                            <button className="btn-icon btn-danger"
                                                onClick={() => { if (confirm('Supprimer cet employe ?')) deleteMut.mutate(e.id!) }}
                                                title="Supprimer">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
