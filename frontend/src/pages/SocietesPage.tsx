import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyApi } from '../lib/api';
import { Card, Btn, Input, Spinner, Badge } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { useAuthStore } from '../lib/store';
import type { Company } from '../types';
import { X, Lock } from 'lucide-react';

export default function SocietesPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('multi-company')) return <Locked />;
    return <SocietesContent />;
}

function SocietesContent() {
    const qc = useQueryClient();
    const { setCompanyId, companyId } = useAuthStore();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ nom: '', ifu: '', rc: '', secteur: '', adresse: '', tel: '' });

    const { data: companies = [], isLoading } = useQuery<Company[]>({
        queryKey: ['companies'],
        queryFn: () => companyApi.list().then((r) => r.data),
    });

    const create = useMutation({
        mutationFn: (data: object) => companyApi.create(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setShowAdd(false); setForm({ nom: '', ifu: '', rc: '', secteur: '', adresse: '', tel: '' }); },
    });

    const del = useMutation({
        mutationFn: (id: string) => companyApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
    });

    if (isLoading) return <Spinner />;

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Btn onClick={() => setShowAdd(!showAdd)}>+ Ajouter société</Btn>
            </div>

            {showAdd && (
                <Card title="Nouvelle société">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Raison sociale *" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
                        <Input label="IFU" value={form.ifu} onChange={(e) => setForm((f) => ({ ...f, ifu: e.target.value }))} />
                        <Input label="Registre commerce" value={form.rc} onChange={(e) => setForm((f) => ({ ...f, rc: e.target.value }))} />
                        <Input label="Secteur" value={form.secteur} onChange={(e) => setForm((f) => ({ ...f, secteur: e.target.value }))} />
                        <Input label="Téléphone" value={form.tel} onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))} />
                        <Input label="Adresse" value={form.adresse} onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} />
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Btn onClick={() => create.mutate(form)} disabled={!form.nom || create.isPending}>Créer</Btn>
                        <Btn variant="outline" onClick={() => setShowAdd(false)}>Annuler</Btn>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companies.map((c) => (
                    <Card key={c.id}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-gray-900 truncate">{c.nom}</p>
                                    {c.id === companyId && <Badge color="green">Active</Badge>}
                                </div>
                                {c.ifu && <p className="text-xs text-gray-500">IFU: {c.ifu}</p>}
                                {c.secteur && <p className="text-xs text-gray-500">{c.secteur}</p>}
                                {c.adresse && <p className="text-xs text-gray-400">{c.adresse}</p>}
                            </div>
                            <div className="flex gap-2 shrink-0 ml-3">
                                {c.id !== companyId && (
                                    <Btn size="sm" onClick={() => setCompanyId(c.id)}>Activer</Btn>
                                )}
                                <button
                                    onClick={() => del.mutate(c.id)}
                                    disabled={c.id === companyId}
                                    className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-30"
                                ><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </Card>
                ))}
                {companies.length === 0 && (
                    <div className="col-span-2">
                        <Card><p className="text-center text-gray-400 py-8">Aucune société enregistrée</p></Card>
                    </div>
                )}
            </div>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-orange-600">Entreprise</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour la gestion multi-sociétés.</p>
            </div>
        </div>
    );
}

