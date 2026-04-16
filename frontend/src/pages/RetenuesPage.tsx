import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { retenueApi } from '../lib/api';
import { fmt, fmtN } from '../lib/fiscalCalc';
import type { RetenueSource } from '../types';
import { Card, Btn, Spinner, Table } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { X, Lock } from 'lucide-react';

// Types retenue : CGI 2025 Art. 206-207 (RAS) et Art. 121-126/140 (IRF/IRCM)
const RETENUE_TYPES: Record<string, { label: string; taux: number }> = {
    services: { label: 'Prestations de services : Résident IFU (5 %)', taux: 5 },
    loyer: { label: 'Loyers : IRF min. 9 % (utiliser calculateur IRF pour montants importants)', taux: 9 },
    dividendes: { label: 'Dividendes : IRCM (12,5 %)', taux: 12.5 },
    interets: { label: 'Intérêts/Créances : IRCM (25 %)', taux: 25 },
    autre: { label: 'Autre / Résident sans IFU / Non-résident (25 %)', taux: 25 },
};

export default function RetenuesPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('ras')) {
        return <Locked />;
    }
    return <RetenuesContent />;
}

function RetenuesContent() {
    const qc = useQueryClient();
    const now = new Date();
    const [showAdd, setShowAdd] = useState(false);
    const [mois, setMois] = useState(now.getMonth() + 1);
    const [annee, setAnnee] = useState(now.getFullYear());
    const [form, setForm] = useState({
        beneficiaire: '',
        type_retenue: 'services',
        montant_brut: 0,
        ref: '',
    });

    const { data: retenues = [], isLoading } = useQuery<RetenueSource[]>({
        queryKey: ['retenues', mois, annee],
        queryFn: () => retenueApi.list(mois, annee).then((r) => r.data),
    });

    const create = useMutation({
        mutationFn: (data: object) => retenueApi.create(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['retenues', mois, annee] }); setShowAdd(false); },
    });

    const del = useMutation({
        mutationFn: (id: string) => retenueApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['retenues', mois, annee] }),
    });

    const typeInfo = RETENUE_TYPES[form.type_retenue] ?? RETENUE_TYPES.services;
    const previewRas = Math.round(form.montant_brut * typeInfo.taux / 100);
    const previewNet = form.montant_brut - previewRas;

    const totaux = retenues.reduce(
        (acc, r) => ({ brut: acc.brut + r.montant_brut, ras: acc.ras + r.montant_retenue, net: acc.net + r.montant_net }),
        { brut: 0, ras: 0, net: 0 }
    );

    if (isLoading) return <Spinner />;

    return (
        <div className="space-y-6">
            {/* Period filter */}
            <div className="flex items-center gap-3">
                <select
                    value={mois}
                    onChange={(e) => setMois(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                    {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                    ))}
                </select>
                <input
                    type="number" min={2020} max={2030} value={annee}
                    onChange={(e) => setAnnee(+e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
            </div>

            {/* Totaux */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs text-gray-500">Montant brut total</p><p className="text-xl font-bold text-gray-900">{fmt(totaux.brut)}</p></div>
                <div className="bg-red-50 rounded-xl p-4"><p className="text-xs text-gray-500">RAS totale</p><p className="text-xl font-bold text-red-700">{fmt(totaux.ras)}</p></div>
                <div className="bg-green-50 rounded-xl p-4"><p className="text-xs text-gray-500">Net versé</p><p className="text-xl font-bold text-green-700">{fmt(totaux.net)}</p></div>
            </div>

            <div className="flex justify-end">
                <Btn onClick={() => setShowAdd(!showAdd)}>+ Ajouter prestation</Btn>
            </div>

            {/* Add form */}
            {showAdd && (
                <Card title="Nouvelle retenue à la source">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Bénéficiaire</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                                value={form.beneficiaire}
                                onChange={(e) => setForm((f) => ({ ...f, beneficiaire: e.target.value }))}
                                placeholder="Nom du prestataire"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Type de prestation</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                                value={form.type_retenue}
                                onChange={(e) => setForm((f) => ({ ...f, type_retenue: e.target.value }))}
                            >
                                {Object.entries(RETENUE_TYPES).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Montant brut HT (FCFA)</label>
                            <input
                                type="number"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                                value={form.montant_brut}
                                onChange={(e) => setForm((f) => ({ ...f, montant_brut: +e.target.value }))}
                            />
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500">RAS calculée ({typeInfo.taux} %)</p>
                            <p className="text-lg font-bold text-red-700">{fmt(previewRas)}</p>
                            <p className="text-xs text-gray-400">Net versé : {fmt(previewNet)}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Btn
                            onClick={() => create.mutate({
                                mois, annee,
                                beneficiaire: form.beneficiaire,
                                type_retenue: form.type_retenue,
                                montant_brut: form.montant_brut,
                                ref: form.ref || undefined,
                            })}
                            disabled={!form.beneficiaire || form.montant_brut <= 0 || create.isPending}
                        >
                            {create.isPending ? 'Enregistrement…' : 'Enregistrer'}
                        </Btn>
                        <Btn variant="outline" onClick={() => setShowAdd(false)}>Annuler</Btn>
                    </div>
                </Card>
            )}

            {/* Table */}
            <Card title={`Prestations : ${retenues.length} ligne(s)`}>
                <Table columns={['Bénéficiaire', 'Type', 'Taux', 'Brut HT', 'RAS', 'Net', '']}>
                    {retenues.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-medium text-gray-900">{r.beneficiaire}</td>
                            <td className="py-3 px-4 text-xs text-gray-500">{RETENUE_TYPES[r.type_retenue]?.label ?? r.type_retenue}</td>
                            <td className="py-3 px-4 text-sm">{r.taux_retenue.toFixed(0)} %</td>
                            <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(r.montant_brut)}</td>
                            <td className="py-3 px-4 text-sm text-right font-mono text-red-600 font-medium">{fmtN(r.montant_retenue)}</td>
                            <td className="py-3 px-4 text-sm text-right font-mono text-green-700 font-medium">{fmtN(r.montant_net)}</td>
                            <td className="py-3 px-4">
                                <button onClick={() => del.mutate(r.id)} className="text-xs text-gray-400 hover:text-red-500 p-1"><X className="w-3.5 h-3.5" /></button>
                            </td>
                        </tr>
                    ))}
                    {retenues.length === 0 && (
                        <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-sm">Aucune retenue enregistrée</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-orange-600">Entreprise</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour la retenue à la source complète.</p>
            </div>
        </div>
    );
}

