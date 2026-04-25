import { Link } from 'react-router-dom';
import { Plus, Trash2, Download, Zap, ChevronRight } from 'lucide-react';
import FormIdentityBar from '../components/FormIdentityBar';
import { formatFc, useContribuableStore } from '../contribuableStore';
import { invalidIutsRows, iutsFieldErrors } from '../contribuableValidation';

const cellIn =
    'w-full min-w-[80px] px-1.5 py-1 text-xs border border-transparent rounded bg-transparent hover:border-gray-300 hover:bg-white focus:border-green-600 focus:bg-white focus:ring-2 focus:ring-green-600/15 outline-none';
const cellNum = `${cellIn} text-right tabular-nums min-w-[90px]`;

export default function ContribuableIUTSPage() {
    const rows = useContribuableStore((s) => s.annexes.iuts.rows);
    const addIutsRow = useContribuableStore((s) => s.addIutsRow);
    const updateIutsRow = useContribuableStore((s) => s.updateIutsRow);
    const removeIutsRow = useContribuableStore((s) => s.removeIutsRow);

    const totB = rows.reduce((s, r) => s + (+r.salaireB || 0), 0);
    const totI = rows.reduce((s, r) => s + (+r.baseImp || 0), 0);
    const totD = rows.reduce((s, r) => s + (+r.iutsDu || 0), 0);
    const totCNSS = rows.reduce((s, r) => s + (+r.cnss || 0), 0);
    const invalidRows = invalidIutsRows(rows);

    return (
        <div className="max-w-[1100px]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900 leading-tight">ANNEXE IUTS</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Impôt Unique sur les Traitements et Salaires — CGI 2025 Art. 111–113
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50"
                        disabled
                        title="Bientôt"
                    >
                        <Download className="w-3.5 h-3.5 opacity-70" />
                        PDF
                    </button>
                </div>
            </div>

            <FormIdentityBar />
            {rows.length > 0 && invalidRows > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 mb-3">
                    {invalidRows} ligne(s) non conforme(s) (nom, salaire brut &gt; 0, charges 0-4). Corrigez avant génération.
                </div>
            )}

            <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 mb-3.5 leading-relaxed">
                Saisir : <strong>Nom</strong> · <strong>Salaire brut</strong> · <strong>Catégorie</strong> ·{' '}
                <strong>Nb charges</strong> — CNSS, base imposable et IUTS sont calculés automatiquement (CGI Art.
                111 &amp; 113).
            </div>

            <div className="bg-white rounded-lg shadow mb-4 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="bg-[#111] text-white px-2.5 py-2 text-center w-9 text-[11px] font-semibold border-r border-white/10">
                                    N°
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-left min-w-[180px] text-[11px] font-semibold border-r border-white/10">
                                    Nom et prénom
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-left min-w-[145px] text-[11px] font-semibold border-r border-white/10">
                                    Catégorie
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right min-w-[115px] text-[11px] font-semibold border-r border-white/10">
                                    Salaire brut
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right min-w-[100px] text-[11px] font-semibold border-r border-white/10">
                                    CNSS (5,5 %)
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right min-w-[100px] text-[11px] font-semibold border-r border-white/10">
                                    Base imposable
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-center w-[72px] text-[11px] font-semibold border-r border-white/10">
                                    Charges
                                </th>
                                <th className="bg-gray-800 text-white px-2.5 py-2 text-right min-w-[90px] text-[11px] font-semibold border-r border-white/10">
                                    IUTS dû
                                </th>
                                <th className="bg-[#111] text-white w-9" />
                            </tr>
                            <tr className="bg-[#1c1c2e]">
                                <td colSpan={3} className="border-0 p-0" />
                                <td className="text-[10px] text-white/40 px-2.5 py-1 border-0" />
                                <td className="text-[10px] text-white/40 px-2.5 py-1 border-0">
                                    <span className="inline-flex items-center gap-0.5">
                                        auto
                                        <Zap className="w-2.5 h-2.5 text-amber-400/90 shrink-0" aria-hidden />
                                    </span>
                                </td>
                                <td className="text-[10px] text-white/40 px-2.5 py-1 border-0">
                                    <span className="inline-flex items-center gap-0.5 flex-wrap">
                                        <span className="inline-flex items-center gap-0.5">
                                            auto
                                            <Zap className="w-2.5 h-2.5 text-amber-400/90 shrink-0" aria-hidden />
                                        </span>
                                        <span>· Brut − CNSS − Abatt.</span>
                                    </span>
                                </td>
                                <td className="text-[10px] text-white/40 px-2.5 py-1 border-0 text-center">
                                    0 – 4
                                </td>
                                <td className="text-[10px] text-white/40 px-2.5 py-1 border-0">
                                    <span className="inline-flex items-center gap-0.5">
                                        auto
                                        <Zap className="w-2.5 h-2.5 text-amber-400/90 shrink-0" aria-hidden />
                                    </span>
                                </td>
                                <td className="border-0" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                                        Aucun salarié — cliquez sur « Ajouter un salarié »
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r, i) => (
                                    (() => {
                                        const errs = iutsFieldErrors(r);
                                        const has = (k: string) => Boolean(errs[k]);
                                        return (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                        <td className="text-center text-gray-400 text-[11px] py-1 px-1 border-r border-gray-100">
                                            {i + 1}
                                        </td>
                                        <td className="p-1 border-r border-gray-100">
                                            <input
                                                type="text"
                                                className={`${cellIn} min-w-[160px] ${has('nom') ? 'border-red-300 bg-red-50' : ''}`}
                                                placeholder="Nom Prénom"
                                                value={r.nom}
                                                onChange={(e) => updateIutsRow(r.id, { nom: e.target.value })}
                                                title={errs.nom}
                                            />
                                        </td>
                                        <td className="p-1 border-r border-gray-100">
                                            <select
                                                className={`${cellIn} min-w-[140px] cursor-pointer`}
                                                value={r.categorie}
                                                onChange={(e) =>
                                                    updateIutsRow(r.id, {
                                                        categorie: e.target.value as 'CADRE' | 'NON_CADRE',
                                                    })
                                                }
                                            >
                                                <option value="NON_CADRE">Non-cadre — 25 %</option>
                                                <option value="CADRE">Cadre — 20 %</option>
                                            </select>
                                        </td>
                                        <td className="p-1 border-r border-gray-100 text-right">
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                className={`${cellNum} ${has('salaireB') ? 'border-red-300 bg-red-50' : ''}`}
                                                value={r.salaireB || ''}
                                                onChange={(e) =>
                                                    updateIutsRow(r.id, { salaireB: +e.target.value || 0 })
                                                }
                                                title={errs.salaireB}
                                            />
                                        </td>
                                        <td className="p-1.5 text-right tabular-nums text-xs font-semibold bg-green-600/[0.07] text-gray-700 border-r border-gray-100">
                                            {formatFc(r.cnss)}
                                        </td>
                                        <td className="p-1.5 text-right tabular-nums text-xs font-semibold bg-green-600/[0.07] text-gray-700 border-r border-gray-100">
                                            {formatFc(r.baseImp)}
                                        </td>
                                        <td className="p-1 border-r border-gray-100 text-center">
                                            <input
                                                type="number"
                                                min={0}
                                                max={4}
                                                step={1}
                                                className={`${cellNum} max-w-[64px] mx-auto ${has('charges') ? 'border-red-300 bg-red-50' : ''}`}
                                                value={r.charges}
                                                onChange={(e) =>
                                                    updateIutsRow(r.id, { charges: +e.target.value || 0 })
                                                }
                                                title={errs.charges}
                                            />
                                        </td>
                                        <td className="p-1.5 text-right tabular-nums text-xs font-bold text-green-700 bg-green-600/[0.07] border-r border-gray-100">
                                            {formatFc(r.iutsDu)}
                                        </td>
                                        <td className="p-0 text-center">
                                            <button
                                                type="button"
                                                title="Supprimer"
                                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                onClick={() => removeIutsRow(r.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                        );
                                    })()
                                ))
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td
                                        colSpan={3}
                                        className="text-left text-[11px] font-bold uppercase tracking-wide opacity-80 px-2.5 py-2 border-r border-white/10"
                                    >
                                        TOTAL — {rows.length} salarié{rows.length > 1 ? 's' : ''}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold px-2 py-2 border-r border-white/10">
                                        {formatFc(totB)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold px-2 py-2 border-r border-white/10">
                                        {formatFc(totCNSS)}
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold px-2 py-2 border-r border-white/10">
                                        {formatFc(totI)}
                                    </td>
                                    <td className="border-r border-white/10" />
                                    <td className="text-right tabular-nums text-xs font-bold text-green-300 px-2 py-2 border-r border-white/10">
                                        {formatFc(totD)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                <button
                    type="button"
                    onClick={() => addIutsRow()}
                    className="flex w-full items-center gap-2 px-4 py-2 bg-gray-50 border-t border-dashed border-gray-200 text-left text-xs font-semibold text-gray-500 hover:bg-green-50 hover:border-green-600 hover:text-green-700 rounded-b-lg"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un salarié
                </button>
            </div>

            <div className="flex flex-wrap gap-7 items-center bg-white rounded-lg shadow px-5 py-3.5 text-[13px] mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-gray-600">Masse salariale brute</span>
                    <strong className="text-[15px] font-extrabold text-green-600 tabular-nums">
                        {formatFc(totB)} F
                    </strong>
                </div>
                <div className="hidden sm:block w-px h-9 bg-gray-200" />
                <div className="flex items-center gap-2">
                    <span className="text-gray-600">CNSS salariale totale</span>
                    <strong className="text-[15px] font-extrabold text-green-600 tabular-nums">
                        {formatFc(totCNSS)} F
                    </strong>
                </div>
                <div className="hidden sm:block w-px h-9 bg-gray-200" />
                <div className="flex items-center gap-2">
                    <span className="text-gray-600">IUTS à reverser</span>
                    <strong className="text-[15px] font-extrabold text-green-600 tabular-nums">
                        {formatFc(totD)} F
                    </strong>
                </div>
                <div className="hidden sm:block w-px h-9 bg-gray-200" />
                <div className="flex items-center gap-2">
                    <span className="text-gray-600">Salariés</span>
                    <strong className="text-[15px] font-extrabold text-green-600">{rows.length}</strong>
                </div>
            </div>

            <p className="text-xs text-gray-500">
                <Link to="/declarations/ros" className="inline-flex items-center gap-0.5 text-green-700 font-semibold hover:underline">
                    Voir ROS / CNSS
                    <ChevronRight className="w-3.5 h-3.5" />
                </Link>
            </p>
        </div>
    );
}
