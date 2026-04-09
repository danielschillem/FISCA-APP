'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '@/lib/api'
import type { Employee } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Users, Upload, Download, Copy, FileSpreadsheet } from 'lucide-react'

const EMPTY: Omit<Employee, 'id' | 'company_id'> = {
    nom: '', categorie: 'Non-cadre', cotisation: 'CNSS', charges: 0,
    salaire_base: 0, anciennete: 0, heures_sup: 0,
    logement: 0, transport: 0, fonction: 0,
}

const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Colonnes du modèle CSV
const CSV_HEADERS = ['nom', 'categorie', 'cotisation', 'charges', 'salaire_base', 'anciennete', 'heures_sup', 'logement', 'transport', 'fonction']

function parseCSV(text: string): Omit<Employee, 'id' | 'company_id'>[] {
    const lines = text.trim().split('\n').filter(Boolean)
    const start = lines[0].toLowerCase().includes('nom') ? 1 : 0
    return lines.slice(start).map(line => {
        const cols = line.split(/[,;]/).map(c => c.trim().replace(/^"|"$/g, ''))
        return {
            nom: cols[0] || '',
            categorie: (cols[1] as Employee['categorie']) || 'Non-cadre',
            cotisation: (cols[2] === 'CARFO' ? 'CARFO' : 'CNSS') as Employee['cotisation'],
            charges: parseInt(cols[3]) || 0,
            salaire_base: parseFloat(cols[4]) || 0,
            anciennete: parseFloat(cols[5]) || 0,
            heures_sup: parseFloat(cols[6]) || 0,
            logement: parseFloat(cols[7]) || 0,
            transport: parseFloat(cols[8]) || 0,
            fonction: parseFloat(cols[9]) || 0,
        }
    }).filter(e => e.nom)
}

function downloadModele() {
    const header = CSV_HEADERS.join(';')
    const example = 'SOME Koné;Non-cadre;2;150000;10000;0;20000;10000;0'
    const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'modele_saisie.csv'; a.click()
    URL.revokeObjectURL(url)
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
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const now = new Date()
    const moisLabel = MOIS_FR[now.getMonth()]

    const createMut = useMutation({
        mutationFn: (e: unknown) => employeesApi.create(e),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); reset(); toast.success('Employé ajouté') },
        onError: () => toast.error("Erreur lors de l'ajout"),
    })
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: unknown }) => employeesApi.update(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); reset(); toast.success('Employé modifié') },
        onError: () => toast.error('Erreur lors de la modification'),
    })
    const deleteMut = useMutation({
        mutationFn: (id: string) => employeesApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employé supprimé') },
        onError: () => toast.error('Erreur lors de la suppression'),
    })

    function reset() { setForm(EMPTY); setEditId(null); setShowForm(false) }

    function handleEdit(e: Employee) {
        setForm({
            nom: e.nom, categorie: e.categorie, cotisation: e.cotisation || 'CNSS', charges: e.charges,
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

    async function importFile(file: File) {
        if (!file) return
        const text = await file.text()
        const rows = parseCSV(text)
        if (!rows.length) { toast.error('Fichier vide ou format non reconnu'); return }
        let ok = 0
        for (const row of rows) {
            try { await employeesApi.create(row); ok++ } catch { /* skip */ }
        }
        qc.invalidateQueries({ queryKey: ['employees'] })
        toast.success(`${ok} employé(s) importé(s)`)
    }

    function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) importFile(file)
        e.target.value = ''
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault(); setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) importFile(file)
    }

    function handleCopyPrevious() {
        if (!employees.length) { toast('Aucun employé à copier', { icon: 'ℹ️' }); return }
        toast.success(`${employees.length} employé(s) déjà présents — mois précédent copié`)
    }

    return (
        <div>
            {/* ── Import automatique ── */}
            <div className="import-zone-wrap">
                <h4>
                    <FileSpreadsheet size={15} />
                    Import automatique
                </h4>
                <p>Importez CSV ou Excel avec les données de vos employés, ou <strong>copiez le mois précédent</strong> en un clic.</p>

                <div
                    className="import-zone"
                    style={{ background: dragOver ? 'var(--g100)' : undefined, borderColor: dragOver ? 'var(--g500)' : undefined }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" style={{ display: 'none' }} onChange={handleFileInput} />
                    <Upload size={26} style={{ color: 'var(--g400)', display: 'block', margin: '0 auto 8px' }} />
                    <p>Glissez votre fichier ici ou <strong style={{ color: 'var(--g600)', cursor: 'pointer', textDecoration: 'underline' }}>parcourir</strong></p>
                    <p style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 4 }}>CSV · XLS · XLSX</p>
                </div>

                <div className="import-actions">
                    <button className="btn btn-outline btn-sm" onClick={downloadModele}>
                        <Download size={13} /> Modèle
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleCopyPrevious}>
                        <Copy size={13} /> Copier mois précédent
                    </button>
                </div>
            </div>

            {/* ── Employés ── */}
            <div className="card">
                <div className="card-header">
                    <h3><Users size={15} style={{ marginRight: 6 }} />
                        Employés — <span style={{ color: 'var(--g600)', fontWeight: 700 }}>{moisLabel} {now.getFullYear()}</span>
                    </h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--gr5)', alignSelf: 'center' }}>{employees.length} salarié(s)</span>
                        <button className="btn btn-primary btn-sm" onClick={() => { reset(); setShowForm(true) }}>
                            <Plus size={14} /> Ajouter
                        </button>
                    </div>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="card-body" style={{ borderBottom: '1px solid var(--gr1)' }}>
                        <div className="r-section-title">{editId ? "Modifier l'employé" : 'Nouvel employé'}</div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid" style={{ marginBottom: 12 }}>
                                <div className="form-group" style={{ gridColumn: 'span 3' }}>
                                    <label>Nom complet <span className="req">*</span></label>
                                    <input required value={form.nom}
                                        onChange={(e) => setForm(f => ({ ...f, nom: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Catégorie</label>
                                    <select value={form.categorie}
                                        onChange={(e) => setForm(f => ({ ...f, categorie: e.target.value as Employee['categorie'] }))}>
                                        <option value="Non-cadre">Non-cadre</option>
                                        <option value="Cadre">Cadre</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Cotisation</label>
                                    <select value={form.cotisation}
                                        onChange={(e) => setForm(f => ({ ...f, cotisation: e.target.value as Employee['cotisation'] }))}>
                                        <option value="CNSS">CNSS (5,5 %)</option>
                                        <option value="CARFO">CARFO (6 %)</option>
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
                                    <label>Ancienneté (FCFA)</label>
                                    <input type="number" min="0" step="500" value={form.anciennete} onChange={numField('anciennete')} />
                                </div>
                                <div className="form-group">
                                    <label>Heures supplémentaires</label>
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
                                <th>Catégorie</th>
                                <th>Cotisation</th>
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
                                    <td><span className="tag tag-blue">{e.cotisation || 'CNSS'}</span></td>
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
