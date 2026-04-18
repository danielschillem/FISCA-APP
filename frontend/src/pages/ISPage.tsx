import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isApi, companyApi } from '../lib/api';
import { calcIS, calcMFP, fmt } from '../lib/fiscalCalc';
import { Card, Btn, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Trash2, Download, Lock, CheckCircle, FileText } from 'lucide-react';
import type { ISDeclaration, Company } from '../types';
import { generateISForm } from '../lib/pdfDGI';
import { usePaymentGate } from '../components/PaymentModal';

type Regime = 'reel' | 'simplifie';

export default function ISPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('is')) return <Locked />;
    return <ISContent />;
}

function ISContent() {
    const qc = useQueryClient();
    const { requestPayment, PaymentModalComponent } = usePaymentGate();
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [ca, setCa] = useState(500_000_000);
    const [benefice, setBenefice] = useState(50_000_000);
    const [regime, setRegime] = useState<Regime>('reel');
    const [cga, setCga] = useState(false);
    const [result, setResult] = useState<{
        isTheorique: number; mfpDu: number; mfpMinimum: number; dû: number; mode: string;
    } | null>(null);

    const { data: history = [], isLoading } = useQuery<ISDeclaration[]>({
        queryKey: ['is', annee],
        queryFn: () => isApi.list(annee).then((r) => r.data),
    });

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    const createMut = useMutation({
        mutationFn: () => isApi.create({ annee, ca, benefice, regime, adhesion_cga: cga }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['is'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => isApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['is'] }),
    });

    const validerMut = useMutation({
        mutationFn: (id: string) => isApi.valider(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['is'] }),
    });

    const calc = () => {
        const isRes = calcIS(benefice, cga);
        const mfpRes = calcMFP(ca, regime, cga);
        const dû = Math.max(isRes.is, mfpRes.mfpDu);
        setResult({
            isTheorique: isRes.is,
            mfpDu: mfpRes.mfpDu,
            mfpMinimum: mfpRes.mfpMinimum,
            dû,
            mode: isRes.is >= mfpRes.mfpDu ? 'IS théorique' : 'MFP (minimum)',
        });
    };

    const exportCSV = (id: string, yr: number) =>
        isApi.export(id).then((r) => {
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url; a.download = `IS-${yr}.csv`; a.click();
            URL.revokeObjectURL(url);
        });

    return (
        <div className="max-w-3xl space-y-6">
            {PaymentModalComponent}
            <Card title="IS / MFP : Impôt sur les Sociétés / Minimum Forfaitaire Patronal">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 : Art. 42 (IS 27,5 %) - Art. 40 (MFP 0,5 % du CA)</p>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Année fiscale</label>
                        <input type="number" value={annee} onChange={(e) => setAnnee(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-2">Régime fiscal</label>
                        <div className="flex gap-3">
                            {[
                                { v: 'reel', l: 'Régime du réel' },
                                { v: 'simplifie', l: 'Régime simplifié' },
                            ].map(({ v, l }) => (
                                <label key={v} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="regime" value={v} checked={regime === v}
                                        onChange={() => setRegime(v as Regime)} className="accent-green-600" />
                                    <span className="text-sm text-gray-700">{l}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Chiffre d'affaires HT (FCFA)</label>
                        <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Bénéfice imposable (FCFA)</label>
                        <input type="number" value={benefice} onChange={(e) => setBenefice(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={cga} onChange={(e) => setCga(e.target.checked)} className="accent-green-600" />
                        <span className="text-sm text-gray-700">Adhérent CGA (réduction IS)</span>
                    </label>
                </div>

                <div className="flex gap-2 mt-4">
                    <Btn onClick={calc}>Calculer</Btn>
                    {result && (
                        <Btn variant="outline" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                            {createMut.isPending ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Enregistrer</>}
                        </Btn>
                    )}
                </div>
                {createMut.isError && <p className="text-xs text-red-600 mt-2">Erreur lors de l'enregistrement</p>}
                {createMut.isSuccess && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Déclaration enregistrée</p>}
            </Card>

            {result && (
                <Card title="Résultat IS / MFP">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-blue-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500">IS théorique (27,5 %)</p>
                            <p className="text-lg font-bold text-blue-700">{fmt(result.isTheorique)}</p>
                            {cga && <p className="text-xs text-green-600 mt-1">Après réduction CGA (−30 %)</p>}
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500">MFP minimum (0,5 % CA)</p>
                            <p className="text-lg font-bold text-orange-700">{fmt(result.mfpDu)}</p>
                            <p className="text-xs text-gray-400">Plancher : {fmt(result.mfpMinimum)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-900 text-white rounded-xl p-4">
                        <p className="text-xs text-gray-400">Impôt dû ({result.mode})</p>
                        <p className="text-2xl font-bold">{fmt(result.dû)}</p>
                        <p className="text-xs text-gray-400 mt-1">= max(IS théorique, MFP minimum)</p>
                    </div>
                </Card>
            )}

            <Card title="Historique IS / MFP">
                <div className="flex items-center gap-3 mb-3">
                    <label className="text-xs text-gray-600">Année :</label>
                    <select value={annee} onChange={(e) => setAnnee(+e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none">
                        {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                {isLoading ? <Spinner /> : history.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">Aucune déclaration IS pour {annee}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-100">
                                    <th className="text-left py-2">Réf.</th>
                                    <th className="text-right py-2">CA</th>
                                    <th className="text-right py-2">IS théorique</th>
                                    <th className="text-right py-2">IS dû</th>
                                    <th className="text-center py-2">Statut</th>
                                    <th className="text-right py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((d) => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="py-2 font-mono text-gray-600">{d.ref ?? ':'}</td>
                                        <td className="py-2 text-right">{fmt(d.ca)}</td>
                                        <td className="py-2 text-right">{fmt(d.is_theorique)}</td>
                                        <td className="py-2 text-right font-semibold text-red-700">{fmt(d.is_du)}</td>
                                        <td className="py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${d.statut === 'declare' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {d.statut === 'declare' ? 'Déclaré' : 'Brouillon'}
                                            </span>
                                        </td>
                                        <td className="py-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                {d.statut === 'brouillon' && (
                                                    <button onClick={() => validerMut.mutate(d.id)} title="Valider"
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded">
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button onClick={() => exportCSV(d.id, d.annee)} title="Exporter CSV"
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => requestPayment('is', d.id, () => generateISForm(d, company))} title="Formulaire DGI"
                                                    className="p-1 text-orange-500 hover:bg-orange-50 rounded">
                                                    <FileText className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => deleteMut.mutate(d.id)} title="Supprimer"
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card title="Base légale">
                <ul className="text-xs text-gray-500 space-y-1">
                    <li>- Art. 42 CGI 2025 : IS au taux de 27,5 % du bénéfice net imposable</li>
                    <li>- Art. 40 : MFP = 0,5 % du chiffre d'affaires (minimum garanti)</li>
                    <li>- L'impôt dû est le maximum entre IS théorique et MFP</li>
                    <li>- Déclaration et paiement : avant le 30 avril de l'année suivante</li>
                    <li>- Acomptes trimestriels de 25 % du dernier IS payé</li>
                </ul>
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
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour accéder au module IS / MFP.</p>
            </div>
        </div>
    );
}
