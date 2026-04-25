import { Link } from 'react-router-dom';
import { Download, ChevronRight } from 'lucide-react';
import FormIdentityBar from '../components/FormIdentityBar';
import { calcCNSS, calcCNSSPatronale } from '../contribuableCalc';
import { formatFc, useContribuableStore } from '../contribuableStore';

export default function ContribuableROSPage() {
    const rows = useContribuableStore((s) => s.annexes.iuts.rows);
    const year = useContribuableStore((s) => s.period.year);

    const lignes = rows.map((r) => {
        const cnss = calcCNSS(r.salaireB, year);
        const cnssPat = calcCNSSPatronale(r.salaireB, year);
        const net = (+r.salaireB || 0) - cnss - (+r.iutsDu || 0);
        return { ...r, cnss, cnssPat, net };
    });
    let totB = 0,
        totC = 0,
        totCP = 0,
        totI = 0,
        totN = 0;
    for (const r of lignes) {
        totB += +r.salaireB || 0;
        totC += r.cnss;
        totCP += r.cnssPat;
        totI += +r.iutsDu || 0;
        totN += r.net;
    }

    return (
        <div className="max-w-[1000px]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900">ANNEXE ROS</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Retenue Obligatoire sur Salaire — CNSS (5,5 %) + IUTS · Généré depuis IUTS
                    </p>
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-300 bg-white text-xs font-semibold text-gray-600"
                    disabled
                >
                    <Download className="w-3.5 h-3.5 opacity-70" />
                    PDF
                </button>
            </div>
            <FormIdentityBar />
            <div className="rounded-lg border-l-4 border-sky-500 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-900 mb-3.5">
                Ce tableau est <strong>généré automatiquement</strong> depuis les données IUTS.{' '}
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
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-center w-9 text-[11px] border-r border-white/10">
                                    N°
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-left min-w-[160px] text-[11px] border-r border-white/10">
                                    Nom et prénom
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right text-[11px] border-r border-white/10">
                                    Salaire brut
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right text-[11px] border-r border-white/10">
                                    CNSS (5,5 %)
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right text-[11px] border-r border-white/10">
                                    CNSS patronale (16,1 %)
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right text-[11px] border-r border-white/10">
                                    IUTS dû
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right text-[11px]">
                                    Salaire net
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {lignes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-gray-400">
                                        Aucun salarié — saisir d&apos;abord les données IUTS
                                    </td>
                                </tr>
                            ) : (
                                lignes.map((r, i) => (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                        <td className="text-center text-gray-400 py-1.5">{i + 1}</td>
                                        <td className="px-2.5 py-1.5 text-[13px]">{r.nom || '—'}</td>
                                        <td className="text-right tabular-nums font-semibold px-2 py-1.5">
                                            {formatFc(r.salaireB)}
                                        </td>
                                        <td className="text-right tabular-nums bg-green-600/[0.07] px-2 py-1.5">
                                            {formatFc(r.cnss)}
                                        </td>
                                        <td className="text-right tabular-nums bg-emerald-600/[0.08] px-2 py-1.5">
                                            {formatFc(r.cnssPat)}
                                        </td>
                                        <td className="text-right tabular-nums font-semibold text-green-700 bg-green-600/[0.07] px-2 py-1.5">
                                            {formatFc(r.iutsDu)}
                                        </td>
                                        <td className="text-right tabular-nums font-bold text-sky-600 px-2 py-1.5">
                                            {formatFc(r.net)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {lignes.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={2} className="text-left text-[11px] font-bold uppercase px-2.5 py-2 border-r border-white/10">
                                        TOTAL — {lignes.length} salarié{lignes.length > 1 ? 's' : ''}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-r border-white/10">
                                        {formatFc(totB)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-r border-white/10">
                                        {formatFc(totC)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold text-emerald-300 border-r border-white/10">
                                        {formatFc(totCP)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold text-green-300 border-r border-white/10">
                                        {formatFc(totI)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold text-sky-300">
                                        {formatFc(totN)}
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
                    <span className="text-gray-600">CNSS à reverser</span>{' '}
                    <strong className="text-green-600 tabular-nums">{formatFc(totC)} F</strong>
                </div>
                <div>
                    <span className="text-gray-600">CNSS patronale</span>{' '}
                    <strong className="text-emerald-600 tabular-nums">{formatFc(totCP)} F</strong>
                </div>
                <div>
                    <span className="text-gray-600">IUTS à reverser</span>{' '}
                    <strong className="text-green-600 tabular-nums">{formatFc(totI)} F</strong>
                </div>
                <div>
                    <span className="text-gray-600">Total net à payer</span>{' '}
                    <strong className="text-sky-600 tabular-nums">{formatFc(totN)} F</strong>
                </div>
            </div>
        </div>
    );
}
