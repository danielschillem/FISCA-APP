'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { retenuesApi } from '@/lib/api'
import type { RetenueSource, TypeRetenue } from '@/types'
import { TYPE_RETENUE_LABELS, TAUX_RETENUE_DEFAULT } from '@/types'
import { fmtFCFA } from '@/lib/utils'
import { FileCheck, Plus, Download, Trash2, Edit2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const now = new Date()
const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

type Form = {
    mois: number; annee: number; beneficiaire: string
    type_retenue: TypeRetenue; montant_brut: number; taux_retenue: number; ref: string
}

const EMPTY: Form = {
    mois: now.getMonth() + 1, annee: now.getFullYear(),
    beneficiaire: '', type_retenue: 'services',
    montant_brut: 0, taux_retenue: TAUX_RETENUE_DEFAULT.services, ref: '',
}

export default function RetenuesPage() {
    const qc = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState<Form>(EMPTY)

    const { data: retenues = [], isLoading } = useQuery<RetenueSource[]>({
        queryKey: ['retenues'],
        queryFn: () => retenuesApi.list().then(r => r.data?.data ?? r.data ?? []),
        staleTime: 30_000,
    })

    const createMut = useMutation({
        mutationFn: () => retenuesApi.create(form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['retenues'] })
            setShowForm(false)
            setForm(EMPTY)
            toast.success('Retenue enregistrée')
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
            toast.error(msg ?? 'Erreur')
        },
    })

    const updateMut = useMutation({
        mutationFn: ({ id, statut, ref }: { id: string; statut: string; ref: string }) =>
            retenuesApi.update(id, { statut, ref }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['retenues'] })
            setEditId(null)
            toast.success('Mise à jour effectuée')
        },
        onError: () => toast.error('Erreur'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => retenuesApi.delete(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['retenues'] }); toast.success('Retenue supprimée') },
        onError: () => toast.error('Erreur'),
    })

    const montantRetenue = Math.round(form.montant_brut * form.taux_retenue / 100 * 100) / 100
    const montantNet = Math.round((form.montant_brut - montantRetenue) * 100) / 100
    const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

    function handleTypeChange(t: TypeRetenue) {
        setForm(f => ({ ...f, type_retenue: t, taux_retenue: TAUX_RETENUE_DEFAULT[t] }))
    }

    // Totaux
    const totalBrut = retenues.reduce((s, r) => s + r.montant_brut, 0)
    const totalRetenue = retenues.reduce((s, r) => s + r.montant_retenue, 0)
    const totalNet = retenues.reduce((s, r) => s + r.montant_net, 0)

    return (
        <div>
            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--gr5)', margin: 0 }}>
                    Saisez les paiements soumis à la retenue à la source (art. 139-141 CGI-BF).
                </p>
                <button className="btn btn-primary" onClick={() => { setShowForm(v => !v); setForm(EMPTY) }}>
                    <Plus size={14} /> Nouvelle retenue
                </button>
            </div>

            {/* Formulaire */}
            {showForm && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header"><h3>Nouvelle retenue à la source</h3></div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Bénéficiaire *</label>
                                <input type="text" placeholder="Nom du prestataire / bailleur…"
                                    value={form.beneficiaire}
                                    onChange={e => setForm(f => ({ ...f, beneficiaire: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label>Type de prestation</label>
                                <select value={form.type_retenue} onChange={e => handleTypeChange(e.target.value as TypeRetenue)}>
                                    {(Object.entries(TYPE_RETENUE_LABELS) as [TypeRetenue, string][]).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Mois</label>
                                <select value={form.mois} onChange={e => setForm(f => ({ ...f, mois: +e.target.value }))}>
                                    {MOIS_LABELS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Année</label>
                                <select value={form.annee} onChange={e => setForm(f => ({ ...f, annee: +e.target.value }))}>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Montant brut versé (F CFA)</label>
                                <input type="number" min="0" step="1000"
                                    value={form.montant_brut}
                                    onChange={e => setForm(f => ({ ...f, montant_brut: +e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label>Taux de retenue (%)</label>
                                <input type="number" min="0" max="100" step="0.5"
                                    value={form.taux_retenue}
                                    onChange={e => setForm(f => ({ ...f, taux_retenue: +e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label>Référence (optionnel)</label>
                                <input type="text" placeholder="N° facture / contrat"
                                    value={form.ref}
                                    onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} />
                            </div>
                        </div>

                        {/* Calcul temps réel */}
                        {form.montant_brut > 0 && (
                            <div style={{
                                display: 'flex', gap: 24, padding: '10px 14px',
                                background: 'var(--gr1)', borderRadius: 8, marginTop: 8, flexWrap: 'wrap',
                            }}>
                                <span style={{ fontSize: 13 }}>Retenue : <strong style={{ color: 'var(--red)' }}>{fmtFCFA(montantRetenue)}</strong></span>
                                <span style={{ fontSize: 13 }}>Net versé : <strong style={{ color: 'var(--prime)' }}>{fmtFCFA(montantNet)}</strong></span>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
                            <button className="btn btn-primary"
                                onClick={() => createMut.mutate()}
                                disabled={createMut.isPending || !form.beneficiaire || form.montant_brut <= 0}>
                                {createMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tableau */}
            <div className="card">
                <div className="card-header">
                    <h3><FileCheck size={15} style={{ marginRight: 6 }} />Retenues à la source</h3>
                    <span className="ch-right">{retenues.length} opération{retenues.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="table-wrap">
                    {isLoading ? (
                        <p style={{ padding: '20px 16px', color: 'var(--gr5)', fontSize: 13 }}>Chargement…</p>
                    ) : retenues.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                            <AlertCircle size={32} style={{ color: 'var(--gr3)', marginBottom: 8 }} />
                            <p style={{ color: 'var(--gr5)', fontSize: 13 }}>
                                Aucune retenue enregistrée. Cliquez sur « Nouvelle retenue » pour commencer.
                            </p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Période</th>
                                    <th>Bénéficiaire</th>
                                    <th>Type</th>
                                    <th className="text-right">Brut</th>
                                    <th className="text-right">Taux</th>
                                    <th className="text-right">Retenue</th>
                                    <th className="text-right">Net versé</th>
                                    <th>Statut</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {retenues.map(ret => (
                                    <tr key={ret.id}>
                                        <td style={{ color: 'var(--gr6)', fontSize: 12 }}>{ret.periode}</td>
                                        <td style={{ fontWeight: 500 }}>{ret.beneficiaire}</td>
                                        <td style={{ fontSize: 12 }}>{TYPE_RETENUE_LABELS[ret.type_retenue]}</td>
                                        <td className="text-right">{fmtFCFA(ret.montant_brut)}</td>
                                        <td className="text-right">{ret.taux_retenue} %</td>
                                        <td className="text-right" style={{ color: 'var(--red)', fontWeight: 600 }}>
                                            {fmtFCFA(ret.montant_retenue)}
                                        </td>
                                        <td className="text-right" style={{ color: 'var(--prime)', fontWeight: 600 }}>
                                            {fmtFCFA(ret.montant_net)}
                                        </td>
                                        <td>
                                            {editId === ret.id ? (
                                                <select
                                                    style={{ fontSize: 12 }}
                                                    defaultValue={ret.statut}
                                                    onChange={e => updateMut.mutate({ id: ret.id, statut: e.target.value, ref: ret.ref ?? '' })}
                                                >
                                                    <option value="en_cours">En cours</option>
                                                    <option value="declare">Déclaré</option>
                                                </select>
                                            ) : (
                                                <span className="badge" style={{
                                                    background: ret.statut === 'declare' ? 'var(--gr-badge)' : 'var(--or-badge)',
                                                    color: ret.statut === 'declare' ? 'var(--prime)' : 'var(--or)',
                                                    fontSize: 11,
                                                }}>
                                                    {ret.statut === 'declare' ? 'Déclaré' : 'En cours'}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                <button className="btn btn-outline btn-sm" title="Modifier statut"
                                                    onClick={() => setEditId(editId === ret.id ? null : ret.id)}>
                                                    <Edit2 size={11} />
                                                </button>
                                                <a className="btn btn-outline btn-sm"
                                                    href={retenuesApi.exportUrl(ret.id)}
                                                    target="_blank" rel="noopener noreferrer" title="Exporter CSV">
                                                    <Download size={11} />
                                                </a>
                                                <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)' }}
                                                    onClick={() => { if (confirm('Supprimer cette retenue ?')) deleteMut.mutate(ret.id) }}>
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'var(--gr1)', fontWeight: 600 }}>
                                    <td colSpan={3}>Totaux</td>
                                    <td className="text-right">{fmtFCFA(totalBrut)}</td>
                                    <td></td>
                                    <td className="text-right" style={{ color: 'var(--red)' }}>{fmtFCFA(totalRetenue)}</td>
                                    <td className="text-right" style={{ color: 'var(--prime)' }}>{fmtFCFA(totalNet)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>

            {/* Info réglementaire */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header"><h3>Taux légaux BF (CGI art. 139-141)</h3></div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                        {(Object.entries(TYPE_RETENUE_LABELS) as [TypeRetenue, string][]).map(([type, label]) => (
                            <div key={type} style={{ background: 'var(--gr1)', borderRadius: 8, padding: '10px 14px' }}>
                                <p style={{ fontSize: 11, color: 'var(--gr5)', margin: 0 }}>{label}</p>
                                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--gr9)', margin: '4px 0 0' }}>
                                    {TAUX_RETENUE_DEFAULT[type]} %
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
