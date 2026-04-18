import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmeApi, companyApi } from '../lib/api';
import { calcCME, fmt, fmtN, CME_CA_PLAFOND } from '../lib/fiscalCalc';
import { Card, Btn, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Trash2, Download, Lock, CheckCircle, FileText, AlertTriangle } from 'lucide-react';
import type { CMEDeclaration, Company } from '../types';
import { generateCMEForm } from '../lib/pdfDGI';
import { usePaymentGate } from '../components/PaymentModal';

type Zone = 'A' | 'B' | 'C' | 'D';
const ZONES: { value: Zone; label: string; desc: string }[] = [
    { value: 'A', label: 'Zone A', desc: 'Ouagadougou, Bobo-Dioulasso' },
    { value: 'B', label: 'Zone B', desc: 'Villes secondaires (Koudougou, Ouahigouya…)' },
    { value: 'C', label: 'Zone C', desc: 'Autres centres urbains' },
    { value: 'D', label: 'Zone D', desc: 'Zones rurales et périurbaines' },
];

// Correspond aux tranches CME CGI 2025 Art. 533-542 (CA ≤ 15 M FCFA)
const CLASSES = [
    { label: 'Classe 1 : CA 13-15 M FCFA' },
    { label: 'Classe 2 : CA 11-13 M FCFA' },
    { label: 'Classe 3 : CA 9-11 M FCFA' },
    { label: 'Classe 4 : CA 7-9 M FCFA' },
    { label: 'Classe 5 : CA 5-7 M FCFA' },
    { label: 'Classe 6 : CA 3-5 M FCFA' },
    { label: 'Classe 7 : CA 1,5-3 M FCFA' },
    { label: 'Classe 8 : CA ≤ 1,5 M FCFA' },
];

export default function CMEPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('cme')) return <Locked />;
    return <CMEContent />;
}

function CMEContent() {
    const qc = useQueryClient();
    const { requestPayment, PaymentModalComponent } = usePaymentGate();
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [ca, setCa] = useState(5_000_000);
    const [zone, setZone] = useState<Zone>('A');
    const [cga, setCga] = useState(false);
    const [result, setResult] = useState<NonNullable<ReturnType<typeof calcCME>> | null>(null);

    const { data: history = [], isLoading } = useQuery<CMEDeclaration[]>({
        queryKey: ['cme', annee],
        queryFn: () => cmeApi.list(annee).then((r) => r.data),
    });

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    const createMut = useMutation({
        mutationFn: () => cmeApi.create({ annee, ca, zone, adhesion_cga: cga }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['cme'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => cmeApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['cme'] }),
    });

    const validerMut = useMutation({
        mutationFn: (id: string) => cmeApi.valider(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['cme'] }),
    });

    const horsRegime = ca > CME_CA_PLAFOND;
    const calc = () => {
        if (horsRegime) return;
        setResult(calcCME(ca, zone, cga));
    };

    const exportCSV = (id: string, yr: number) =>
        cmeApi.export(id).then((r) => {
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url; a.download = `CME-${yr}.csv`; a.click();
            URL.revokeObjectURL(url);
        });

    return (
        <div className="max-w-3xl space-y-6">
            {PaymentModalComponent}
            <Card title="CME : Contribution des Micro-Entreprises">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 : Art. 533-542 - Régime simplifié pour CA ≤ 150 M FCFA</p>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Année fiscale</label>
                        <input type="number" value={annee} onChange={(e) => setAnnee(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Chiffre d'affaires annuel HT (FCFA)</label>
                        <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${horsRegime ? 'border-red-400 focus:ring-2 focus:ring-red-400' : 'border-gray-300 focus:ring-2 focus:ring-green-500'}`} />
                        {horsRegime && (
                            <div className="flex items-start gap-2 mt-1.5 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-700 leading-snug">
                                    <strong>CA hors régime CME.</strong> Le plafond légal est de {fmtN(CME_CA_PLAFOND)} FCFA
                                    (CGI 2025 Art. 533). Au-delà, votre entreprise relève du régime RSI/RNI
                                  - utilisez le module <strong>IS / MFP</strong> pour votre déclaration.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-2">Zone d'activité</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ZONES.map((z) => (
                                <label key={z.value} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${zone === z.value ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                    <input type="radio" value={z.value} checked={zone === z.value}
                                        onChange={() => setZone(z.value)} className="mt-0.5 accent-green-600" />
                                    <div>
                                        <p className="text-xs font-semibold text-gray-900">{z.label}</p>
                                        <p className="text-[11px] text-gray-500">{z.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={cga} onChange={(e) => setCga(e.target.checked)} className="accent-green-600" />
                        <span className="text-sm text-gray-700">Adhérent CGA (réduction 25 %)</span>
                    </label>
                </div>

                <div className="flex gap-2 mt-4">
                    <Btn onClick={calc} disabled={horsRegime}>Calculer</Btn>
                    {result && !horsRegime && (
                        <Btn variant="outline" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                            {createMut.isPending ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Enregistrer</>}
                        </Btn>
                    )}
                </div>
                {createMut.isError && <p className="text-xs text-red-600 mt-2">Erreur lors de l'enregistrement</p>}
                {createMut.isSuccess && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Déclaration enregistrée</p>}
            </Card>

            {result && (
                <Card title="Résultat CME">
                    <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                            <span className="text-gray-600">Classe tarifaire</span>
                            <span className="font-medium">{CLASSES[result.classe - 1]?.label ?? `Classe ${result.classe}`}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                            <span className="text-gray-600">CME brute</span>
                            <span className="font-medium">{fmt(result.cme)}</span>
                        </div>
                        {cga && (
                            <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">Réduction CGA (−25 %)</span>
                                <span className="font-medium text-green-700">− {fmt(result.cme - result.cmeNet)}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">CME finale</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.cmeNet)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Zone {result.zone} - CA : {fmtN(result.ca)} FCFA</p>
                </Card>
            )}

            <Card title="Historique CME">
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
                    <p className="text-xs text-gray-400 py-4 text-center">Aucune déclaration CME pour {annee}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-100">
                                    <th className="text-left py-2">Réf.</th>
                                    <th className="text-left py-2">Zone</th>
                                    <th className="text-right py-2">CA</th>
                                    <th className="text-right py-2">CME nette</th>
                                    <th className="text-center py-2">Statut</th>
                                    <th className="text-right py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((d) => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="py-2 font-mono text-gray-600">{d.ref ?? ':'}</td>
                                        <td className="py-2">Zone {d.zone}</td>
                                        <td className="py-2 text-right">{fmt(d.ca)}</td>
                                        <td className="py-2 text-right font-semibold text-red-700">{fmt(d.cme_net)}</td>
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
                                                <button onClick={() => requestPayment('cme', d.id, () => generateCMEForm(d, company))} title="Formulaire DGI"
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
                    <li>- Art. 533 CGI 2025 : CME applicable aux micro-entreprises (CA ≤ 150 M)</li>
                    <li>- 8 classes tarifaires selon CA et zone géographique (A, B, C, D)</li>
                    <li>- Art. 537 : Réduction de 25 % pour les adhérents d'un CGA agréé</li>
                    <li>- Paiement annuel avant le 30 avril</li>
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
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour accéder au module CME.</p>
            </div>
        </div>
    );
}
