import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patenteApi, companyApi } from '../lib/api';
import { calcPatente, fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Trash2, Download, Lock, CheckCircle, FileText } from 'lucide-react';
import type { PatenteDeclaration, Company } from '../types';
import { generatePatenteForm } from '../lib/pdfDGI';

export default function PatentePage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('patente')) return <Locked />;
    return <PatenteContent />;
}

function PatenteContent() {
    const qc = useQueryClient();
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [ca, setCa] = useState(100_000_000);
    const [valeurLocative, setValeurLocative] = useState(2_400_000);
    const [result, setResult] = useState<ReturnType<typeof calcPatente> | null>(null);

    const { data: history = [], isLoading } = useQuery<PatenteDeclaration[]>({
        queryKey: ['patente', annee],
        queryFn: () => patenteApi.list(annee).then((r) => r.data),
    });

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    const createMut = useMutation({
        mutationFn: () => patenteApi.create({ annee, ca, valeur_locative: valeurLocative }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['patente'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => patenteApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['patente'] }),
    });

    const validerMut = useMutation({
        mutationFn: (id: string) => patenteApi.valider(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['patente'] }),
    });

    const calc = () => setResult(calcPatente(ca, valeurLocative));

    const exportCSV = (id: string, yr: number) =>
        patenteApi.export(id).then((r) => {
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url; a.download = `Patente-${yr}.csv`; a.click();
            URL.revokeObjectURL(url);
        });

    // Tableau des droits fixes (Art. 238 CGI 2025)
    const DROITS_FIXES = [
        { tranche: 'CA < 30 M', droit: 30_000 },
        { tranche: '30 M – 60 M', droit: 75_000 },
        { tranche: '60 M – 100 M', droit: 150_000 },
        { tranche: '100 M – 200 M', droit: 250_000 },
        { tranche: '200 M – 500 M', droit: 500_000 },
        { tranche: '500 M – 1 Md', droit: 1_000_000 },
        { tranche: '> 1 Md', droit: 2_000_000 },
    ];

    return (
        <div className="max-w-3xl space-y-6">
            <Card title="Patente Professionnelle">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 : Art. 237-240 · Droit fixe + 1 % valeur locative professionnelle</p>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Année fiscale</label>
                        <input type="number" value={annee} onChange={(e) => setAnnee(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Chiffre d'affaires annuel HT (FCFA)</label>
                        <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Valeur locative annuelle des locaux (FCFA)</label>
                        <input type="number" value={valeurLocative} onChange={(e) => setValeurLocative(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                        <p className="text-[11px] text-gray-400 mt-1">= Loyer mensuel × 12 si locataire</p>
                    </div>
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
                <Card title="Résultat Patente">
                    <div className="space-y-2">
                        {[
                            { l: 'Droit fixe (tableau A)', v: result.droitFixe },
                            { l: 'Droit proportionnel (1 % VL)', v: result.droitProp },
                        ].map(({ l, v }) => (
                            <div key={l} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">{l}</span>
                                <span className="font-medium">{fmt(v)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">Patente totale</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.totalPatente)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">CA : {fmtN(result.ca)} FCFA</p>
                </Card>
            )}

            <Card title="Tableau des droits fixes (Art. 238 CGI 2025)">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-gray-500 border-b border-gray-100">
                                <th className="text-left py-2">Tranche de CA</th>
                                <th className="text-right py-2">Droit fixe (FCFA)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {DROITS_FIXES.map((d) => (
                                <tr key={d.tranche} className={`hover:bg-gray-50 ${ca >= 0 && calcPatente(ca, 0).droitFixe === d.droit ? 'bg-green-50 font-semibold' : ''}`}>
                                    <td className="py-2 text-gray-700">{d.tranche}</td>
                                    <td className="py-2 text-right font-mono">{fmtN(d.droit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="Historique Patentes">
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
                    <p className="text-xs text-gray-400 py-4 text-center">Aucune déclaration Patente pour {annee}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-100">
                                    <th className="text-left py-2">Réf.</th>
                                    <th className="text-right py-2">CA</th>
                                    <th className="text-right py-2">Droit fixe</th>
                                    <th className="text-right py-2">Total patente</th>
                                    <th className="text-center py-2">Statut</th>
                                    <th className="text-right py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((d) => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="py-2 font-mono text-gray-600">{d.ref ?? ':'}</td>
                                        <td className="py-2 text-right">{fmt(d.ca)}</td>
                                        <td className="py-2 text-right">{fmt(d.droit_fixe)}</td>
                                        <td className="py-2 text-right font-semibold text-red-700">{fmt(d.total_patente)}</td>
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
                                                <button onClick={() => generatePatenteForm(d, company)} title="Formulaire DGI"
                                                    className="p-1 text-purple-600 hover:bg-purple-50 rounded">
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
                    <li>• Art. 237 CGI 2025 : Toute personne physique ou morale exerçant une activité commerciale</li>
                    <li>• Art. 238 : Droit fixe selon le tableau A (fonction du CA)</li>
                    <li>• Art. 239 : Droit proportionnel = 1 % de la valeur locative des locaux professionnels</li>
                    <li>• Art. 240 : Paiement avant le 31 mars de l'année d'imposition</li>
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
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour accéder au module Patentes.</p>
            </div>
        </div>
    );
}
