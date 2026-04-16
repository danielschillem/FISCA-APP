import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { irfApi } from '../lib/api';
import { calcIRF, fmt } from '../lib/fiscalCalc';
import { Card, Btn, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Trash2, Download, Lock, CheckCircle } from 'lucide-react';
import type { IRFDeclaration } from '../types';

export default function IRFPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('irf')) return <Locked />;
    return <IRFContent />;
}

function IRFContent() {
    const qc = useQueryClient();
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [loyerBrut, setLoyerBrut] = useState(6_000_000);
    const [result, setResult] = useState<ReturnType<typeof calcIRF> | null>(null);

    const { data: history = [], isLoading } = useQuery<IRFDeclaration[]>({
        queryKey: ['irf', annee],
        queryFn: () => irfApi.list(annee).then((r) => r.data),
    });

    const createMut = useMutation({
        mutationFn: () => irfApi.create({ annee, loyer_brut: loyerBrut }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['irf'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => irfApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['irf'] }),
    });

    const validerMut = useMutation({
        mutationFn: (id: string) => irfApi.valider(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['irf'] }),
    });

    const calc = () => setResult(calcIRF(loyerBrut));

    const exportCSV = (id: string, yr: number) =>
        irfApi.export(id).then((r) => {
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url; a.download = `IRF-${yr}.csv`; a.click();
            URL.revokeObjectURL(url);
        });

    return (
        <div className="max-w-3xl space-y-6">
            <Card title="IRF — Impôt sur les Revenus Fonciers">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 — Art. 121-126 · Abattement 50 % · Taux progressif 18 % / 25 %</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Année fiscale</label>
                        <input type="number" value={annee} onChange={(e) => setAnnee(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Loyer brut annuel (FCFA)</label>
                        <input type="number" value={loyerBrut} onChange={(e) => setLoyerBrut(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                </div>
                <div className="flex gap-2">
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
                <Card title="Résultat IRF">
                    <div className="space-y-2">
                        {[
                            { l: 'Loyer brut', v: fmt(result.loyerBrut) },
                            { l: 'Abattement 50 %', v: fmt(result.abattement) },
                            { l: 'Base nette imposable', v: fmt(result.baseNette) },
                            { l: 'IRF tranche 18 % (= 100 000)', v: fmt(result.irf1) },
                            { l: 'IRF tranche 25 % (> 100 000)', v: fmt(result.irf2) },
                            { l: 'Loyer net', v: fmt(result.loyerNet) },
                        ].map(({ l, v }) => (
                            <div key={l} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">{l}</span><span className="font-medium">{v}</span>
                            </div>
                        ))}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">IRF total ({result.tauxEffectif} % effectif)</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.irfTotal)}</span>
                        </div>
                    </div>
                </Card>
            )}

            <Card title={`Historique IRF`}>
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
                    <p className="text-xs text-gray-400 py-4 text-center">Aucune déclaration IRF pour {annee}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-100">
                                    <th className="text-left py-2">Réf.</th>
                                    <th className="text-right py-2">Loyer brut</th>
                                    <th className="text-right py-2">IRF dû</th>
                                    <th className="text-center py-2">Statut</th>
                                    <th className="text-right py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((d) => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="py-2 font-mono text-gray-600">{d.ref ?? '—'}</td>
                                        <td className="py-2 text-right">{fmt(d.loyer_brut)}</td>
                                        <td className="py-2 text-right font-semibold text-red-700">{fmt(d.irf_total)}</td>
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
                    <li>• Art. 121 CGI 2025 : revenus provenant de la location d'immeubles</li>
                    <li>• Art. 122 : Abattement forfaitaire de 50 % sur le loyer brut</li>
                    <li>• Art. 124 : Taux progressif 18 % jusqu'à 100 000 FCFA base nette, 25 % au-delà</li>
                    <li>• Déclaration annuelle avant le 30 avril</li>
                </ul>
            </Card>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour accéder au module IRF.</p>
            </div>
        </div>
    );
}
