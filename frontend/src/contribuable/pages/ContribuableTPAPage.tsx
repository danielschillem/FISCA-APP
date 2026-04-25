import { Link } from 'react-router-dom';
import { Download, ChevronRight } from 'lucide-react';
import FormIdentityBar from '../components/FormIdentityBar';
import { calcTPA } from '../contribuableCalc';
import { formatFc, totalTPA, useContribuableStore } from '../contribuableStore';

export default function ContribuableTPAPage() {
    const rows = useContribuableStore((s) => s.annexes.iuts.rows);
    const year = useContribuableStore((s) => s.period.year);
    const totB = rows.reduce((s, r) => s + (+r.salaireB || 0), 0);
    const totT = totalTPA(rows, year);

    return (
        <div className="max-w-[900px]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900">ANNEXE TPA</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Taxe Patronale et d&apos;Apprentissage — 3 % sur masse salariale · CGI 2025 Art. 229
                    </p>
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-semibold opacity-50"
                    disabled
                >
                    <Download className="w-3.5 h-3.5 opacity-70" />
                    PDF
                </button>
            </div>
            <FormIdentityBar />
            <div className="rounded-lg border-l-4 border-sky-500 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-900 mb-3.5">
                Généré automatiquement depuis IUTS. TPA = Salaire brut × <strong>3 %</strong>.{' '}
                <Link to="/declarations/iuts" className="inline-flex items-center gap-0.5 font-bold underline">
                    Gérer les salariés
                    <ChevronRight className="w-3.5 h-3.5" />
                </Link>
            </div>
            <div className="bg-white rounded-lg shadow mb-4 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="bg-[#111] text-white w-9 px-1 py-2 text-[11px] border-r border-white/10">N°</th>
                                <th className="bg-gray-800 text-white text-left px-2 py-2 text-[11px] border-r border-white/10">
                                    Nom et prénom
                                </th>
                                <th className="bg-gray-800 text-white text-right px-2 py-2 text-[11px] border-r border-white/10">
                                    Salaire brut
                                </th>
                                <th className="bg-gray-800 text-white text-right px-2 py-2 text-[11px] border-r border-white/10">
                                    Base TPA
                                </th>
                                <th className="bg-gray-800 text-white text-right px-2 py-2 text-[11px]">TPA due (3 %)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-gray-400">
                                        Aucun salarié — saisir d&apos;abord les données IUTS
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r, i) => (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                        <td className="text-center text-gray-400 py-1.5">{i + 1}</td>
                                        <td className="px-2 py-1.5 text-[13px]">{r.nom || '—'}</td>
                                        <td className="text-right tabular-nums font-semibold px-2">
                                            {formatFc(r.salaireB)}
                                        </td>
                                        <td className="text-right tabular-nums px-2">{formatFc(r.salaireB)}</td>
                                        <td className="text-right tabular-nums font-bold text-green-700 bg-green-600/[0.07] px-2">
                                            {formatFc(calcTPA(r.salaireB, year))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={2} className="text-left text-[11px] font-bold uppercase px-2 py-2 border-r border-white/10">
                                        TOTAL — {rows.length} salarié{rows.length > 1 ? 's' : ''}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-r border-white/10">
                                        {formatFc(totB)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-r border-white/10">
                                        {formatFc(totB)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold text-green-300">
                                        {formatFc(totT)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
            <div className="flex flex-wrap gap-6 bg-white rounded-lg shadow px-5 py-3 text-[13px]">
                <div>
                    <span className="text-gray-600">Masse salariale brute</span>{' '}
                    <strong className="text-green-600 tabular-nums">{formatFc(totB)} F</strong>
                </div>
                <div>
                    <span className="text-gray-600">TPA à reverser (3 %)</span>{' '}
                    <strong className="text-green-600 tabular-nums">{formatFc(totT)} F</strong>
                </div>
            </div>
        </div>
    );
}
