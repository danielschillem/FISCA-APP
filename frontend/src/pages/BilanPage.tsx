import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { companyApi } from '../lib/api';
import { fmt } from '../lib/fiscalCalc';
import { Card } from '../components/ui';
import { useAppStore, PLAN_FEATURES, Btn } from '../components/ui';
import { Printer, Lock, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import type { BilanData, Company } from '../types';
import { exportBilanPDF, exportBilanXLSX, exportBilanDOCX } from '../lib/exportBilan';
import { computeBilanFromAnnexes } from '../lib/declarationAnalytics';
import { useContribuableStore } from '../contribuable/contribuableStore';
import { calcFSP } from '../contribuable/contribuableCalc';

export default function BilanPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('bilan')) return <Locked />;
    return <BilanContent />;
}

const LIGNES: { label: string; key: keyof Omit<BilanData, 'annee' | 'total'>; color: string }[] = [
    { label: 'IUTS (retenues salariales)', key: 'iuts', color: 'green' },
    { label: 'TPA (taxe professionnelle)', key: 'tpa', color: 'blue' },
    { label: 'CSS / Cotisations salariales', key: 'css', color: 'indigo' },
    { label: 'CNSS Patronal', key: 'cnss_patronal', color: 'purple' },
    { label: 'TVA nette collectée', key: 'tva', color: 'orange' },
    { label: 'Retenues à la source (RAS)', key: 'ras', color: 'yellow' },
    { label: 'IRF : Revenus Fonciers', key: 'irf', color: 'pink' },
    { label: 'IRCM : Capitaux Mobiliers', key: 'ircm', color: 'red' },
    { label: 'IS : Impôt sur les Sociétés', key: 'is', color: 'emerald' },
    { label: 'CME : Contribution Micro-Entreprises', key: 'cme', color: 'teal' },
    { label: 'Patente Professionnelle', key: 'patente', color: 'cyan' },
];

function BilanContent() {
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [exportingDocx, setExportingDocx] = useState(false);
    const period = useContribuableStore((s) => s.period);
    const annexes = useContribuableStore((s) => s.annexes);

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
        staleTime: Infinity,
    });

    const b: BilanData = computeBilanFromAnnexes(annexes, period, annee);
    const fspTotal =
        period.year === annee
            ? annexes.iuts.rows.reduce(
                  (s, r) => s + calcFSP(r.salaireB || 0, r.cnss || 0, r.iutsDu || 0),
                  0
              )
            : 0;

    const nonZero = LIGNES.filter((l) => b[l.key] > 0);

    return (
        <div className="space-y-6 print:m-0">
            <div className="flex items-center gap-4 print:hidden">
                <select
                    value={annee}
                    onChange={(e) => setAnnee(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                    {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                <div className="flex items-center gap-2 flex-wrap">
                    <Btn variant="outline" onClick={() => window.print()} title="Imprimer">
                        <Printer className="w-4 h-4" /> Imprimer
                    </Btn>
                    <Btn
                        variant="outline"
                        onClick={() => exportBilanPDF(b, company)}
                        title="Exporter le bilan en PDF"
                    >
                        <FileDown className="w-4 h-4" /> Exporter PDF
                    </Btn>
                    <Btn
                        variant="outline"
                        onClick={() => exportBilanXLSX(b, company)}
                        title="Télécharger Excel"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </Btn>
                    <Btn
                        variant="outline"
                        onClick={async () => {
                            setExportingDocx(true);
                            try { await exportBilanDOCX(b, company); }
                            finally { setExportingDocx(false); }
                        }}
                        disabled={exportingDocx}
                        title="Télécharger Word (.docx)"
                    >
                        <FileText className="w-4 h-4" />
                        {exportingDocx ? 'Génération…' : 'Word'}
                    </Btn>
                </div>
            </div>

            {/* KPI summary cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">IUTS versé</p>
                    <p className="text-lg font-bold text-green-700">{fmt(b.iuts)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">TVA collectée</p>
                    <p className="text-lg font-bold text-orange-700">{fmt(b.tva)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Retenues source</p>
                    <p className="text-lg font-bold text-blue-700">{fmt(b.ras)}</p>
                </div>
                <div className="bg-violet-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">FSP (1% net salarial)</p>
                    <p className="text-lg font-bold text-violet-700">{fmt(fspTotal)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Total des obligations fiscales a reverser (CGI) {annee}</p>
                    <p className="text-lg font-bold text-gray-900">{fmt(b.total)}</p>
                </div>
            </div>

            {/* Module breakdown */}
            <Card title={`Récapitulatif fiscal : exercice ${annee}`}>
                {nonZero.length === 0 && fspTotal <= 0 ? (
                    <p className="text-sm text-gray-400 py-8 text-center">
                        Aucune déclaration enregistrée pour l'exercice {annee}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                    <th className="py-2 px-3 text-left">Module fiscal</th>
                                    <th className="py-2 px-3 text-right">Montant (FCFA)</th>
                                    <th className="py-2 px-3 text-right">% du total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {LIGNES.map(({ label, key }) => {
                                    const v = b[key];
                                    const pct = b.total > 0 ? ((v / b.total) * 100).toFixed(1) : ':';
                                    return (
                                        <tr key={key} className={`hover:bg-gray-50 ${v === 0 ? 'opacity-40' : ''}`}>
                                            <td className="py-2.5 px-3 text-gray-800">{label}</td>
                                            <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                                {fmt(v)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-gray-500 text-xs">
                                                {v > 0 ? `${pct} %` : ':'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className={`hover:bg-gray-50 ${fspTotal === 0 ? 'opacity-40' : ''}`}>
                                    <td className="py-2.5 px-3 text-gray-800">FSP (1% net salarial)</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">{fmt(fspTotal)}</td>
                                    <td className="py-2.5 px-3 text-right text-gray-500 text-xs">
                                        {fspTotal > 0 && b.total > 0 ? `${((fspTotal / b.total) * 100).toFixed(1)} %` : ':'}
                                    </td>
                                </tr>
                                <tr className="border-t-2 border-gray-300 font-bold">
                                    <td className="py-3 px-3 text-gray-900">TOTAL OBLIGATIONS CGI</td>
                                    <td className="py-3 px-3 text-right font-mono text-red-700 text-base">
                                        {fmt(b.total)}
                                    </td>
                                    <td className="py-3 px-3 text-right text-gray-500 text-xs">100 %</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Bilan <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour le bilan fiscal annuel complet.</p>
            </div>
        </div>
    );
}

