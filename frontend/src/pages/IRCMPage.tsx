import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ircmApi, companyApi } from '../lib/api';
import { calcIRCM, fmt } from '../lib/fiscalCalc';
import { Card, Btn, Spinner, NumericInput } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Trash2, Download, Lock, CheckCircle, FileText } from 'lucide-react';
import type { IRCMDeclaration, Company } from '../types';
import { generateIRCMForm } from '../lib/pdfDGI';
import { usePaymentGate } from '../components/PaymentModal';

type IRCMType = 'CREANCES' | 'OBLIGATIONS' | 'DIVIDENDES';

const TYPES: { value: IRCMType; label: string; taux: number; desc: string }[] = [
    { value: 'CREANCES', label: 'Créances & dépôts', taux: 25, desc: 'Intérêts de prêts, comptes courants, dépôts' },
    { value: 'OBLIGATIONS', label: 'Obligations & bons', taux: 6, desc: "Intérêts d'obligations, bons du trésor" },
    { value: 'DIVIDENDES', label: 'Dividendes & parts', taux: 12.5, desc: 'Distributions de bénéfices, parts sociales' },
];

export default function IRCMPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('ircm')) return <Locked />;
    return <IRCMContent />;
}

function IRCMContent() {
    const qc = useQueryClient();
    const { requestPayment, PaymentModalComponent } = usePaymentGate();
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [type, setType] = useState<IRCMType>('CREANCES');
    const [montant, setMontant] = useState(1_000_000);
    const [result, setResult] = useState<ReturnType<typeof calcIRCM> | null>(null);

    const { data: history = [], isLoading } = useQuery<IRCMDeclaration[]>({
        queryKey: ['ircm', annee],
        queryFn: () => ircmApi.list(annee).then((r) => r.data),
    });

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    const createMut = useMutation({
        mutationFn: () => ircmApi.create({ annee, montant_brut: montant, type_revenu: type }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ircm'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => ircmApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ircm'] }),
    });

    const validerMut = useMutation({
        mutationFn: (id: string) => ircmApi.valider(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ircm'] }),
    });

    const calc = () => setResult(calcIRCM(montant, type));

    const exportCSV = (id: string, yr: number) =>
        ircmApi.export(id).then((r) => {
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url; a.download = `IRCM-${yr}.csv`; a.click();
            URL.revokeObjectURL(url);
        });

    return (
        <div className="max-w-3xl space-y-6">
            {PaymentModalComponent}
            <Card title="IRCM : Impôt sur les Revenus des Capitaux Mobiliers">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 : Art. 140-156 - Retenue libératoire à la source</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Année fiscale</label>
                        <input type="number" value={annee} onChange={(e) => setAnnee(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Montant brut des revenus (FCFA)</label>
                        <NumericInput value={montant} onChange={setMontant} />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-2 mb-4">
                    {TYPES.map((t) => (
                        <label key={t.value}
                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${type === t.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" name="ircm-type" value={t.value}
                                checked={type === t.value} onChange={() => setType(t.value)}
                                className="mt-0.5 accent-green-600" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">{t.label} : <span className="text-green-700">{t.taux} %</span></p>
                                <p className="text-xs text-gray-500">{t.desc}</p>
                            </div>
                        </label>
                    ))}
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
                <Card title="Résultat IRCM">
                    <div className="space-y-2">
                        {[
                            { l: 'Revenu brut', v: result.brut, neg: false },
                            { l: `IRCM (${(result.taux * 100).toFixed(1)} %)`, v: result.ircm, neg: true },
                            { l: 'Net versé', v: result.net, neg: false },
                        ].map(({ l, v, neg }) => (
                            <div key={l} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">{l}</span>
                                <span className={`font-medium ${neg ? 'text-red-600' : 'text-gray-900'}`}>
                                    {neg ? `- ${fmt(v)}` : fmt(v)}
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">IRCM dû</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.ircm)}</span>
                        </div>
                    </div>
                </Card>
            )}

            <Card title="Historique IRCM">
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
                    <p className="text-xs text-gray-400 py-4 text-center">Aucune déclaration IRCM pour {annee}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-100">
                                    <th className="text-left py-2">Réf.</th>
                                    <th className="text-left py-2">Type</th>
                                    <th className="text-right py-2">Brut</th>
                                    <th className="text-right py-2">IRCM dû</th>
                                    <th className="text-center py-2">Statut</th>
                                    <th className="text-right py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((d) => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="py-2 font-mono text-gray-600">{d.ref ?? ':'}</td>
                                        <td className="py-2">{d.type_revenu}</td>
                                        <td className="py-2 text-right">{fmt(d.montant_brut)}</td>
                                        <td className="py-2 text-right font-semibold text-red-700">{fmt(d.ircm_total)}</td>
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
                                                <button onClick={() => requestPayment('ircm', d.id, () => generateIRCMForm(d, company))} title="Formulaire DGI"
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
                    <li>- Art. 140 CGI 2025 : IRCM : retenue libératoire à la source</li>
                    <li>- Créances &amp; dépôts : 25 % - Obligations &amp; bons : 6 % - Dividendes : 12,5 %</li>
                    <li>- Art. 150 : Déclaration et versement mensuel (avant le 15 du mois suivant)</li>
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
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour accéder au module IRCM.</p>
            </div>
        </div>
    );
}
