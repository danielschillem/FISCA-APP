'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyApi } from '@/lib/api'
import type { Company } from '@/types'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'

export default function ParametresPage() {
    const qc = useQueryClient()
    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then(r => r.data),
    })
    const [form, setForm] = useState<Partial<Company>>({})

    useEffect(() => { if (company) setForm(company) }, [company])

    const updateMut = useMutation({
        mutationFn: () => companyApi.update(form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); toast.success('Informations enregistrées') },
        onError: () => toast.error('Erreur lors de la sauvegarde'),
    })

    const field = (key: keyof Company, label: string, type = 'text') => (
        <div className="form-group">
            <label>{label}</label>
            <input type={type}
                value={(form[key] as string) || ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        </div>
    )

    return (
        <div style={{ maxWidth: 700 }}>
            <div className="card">
                <div className="card-header">
                    <h3><Save size={15} style={{ marginRight: 6 }} />Entreprise</h3>
                </div>
                <div className="card-body">
                    <div className="form-grid">
                        {field('nom', 'Dénomination sociale')}
                        {field('ifu', 'Numéro IFU')}
                        {field('rc', 'Registre du Commerce (RC)')}
                        {field('secteur', "Secteur d'activité")}
                        {field('adresse', 'Adresse')}
                        {field('tel', 'Téléphone', 'tel')}
                    </div>
                    <div className="flex-end" style={{ marginTop: 16 }}>
                        <button className="btn btn-primary"
                            onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                            <Save size={15} />
                            {updateMut.isPending ? 'Sauvegarde…' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
