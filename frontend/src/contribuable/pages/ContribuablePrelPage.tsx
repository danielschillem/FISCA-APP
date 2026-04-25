import { Plus, Trash2, Download } from 'lucide-react';
import FormIdentityBar from '../components/FormIdentityBar';
import { formatFc, useContribuableStore } from '../contribuableStore';
import { invalidPrelRows, prelFieldErrors } from '../contribuableValidation';

const cellIn =
    'w-full min-w-[80px] px-1.5 py-1 text-xs border border-transparent rounded hover:border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600/15 outline-none';
const cellNum = `${cellIn} text-right tabular-nums`;

export default function ContribuablePrelPage() {
    const rows = useContribuableStore((s) => s.annexes.prel.rows);
    const addPrelRow = useContribuableStore((s) => s.addPrelRow);
    const updatePrelRow = useContribuableStore((s) => s.updatePrelRow);
    const removePrelRow = useContribuableStore((s) => s.removePrelRow);

    const totH = rows.reduce((s, r) => s + (+r.montantHT || 0), 0);
    const totB = rows.reduce((s, r) => s + (+r.base || 0), 0);
    const totP = rows.reduce((s, r) => s + (+r.prelevement || 0), 0);
    const invalidRows = invalidPrelRows(rows);

    return (
        <div className="max-w-[1000px]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900">ANNEXE PREL</h2>
                    <p className="text-xs text-gray-500 mt-1">Prélèvements Supportés — État des acomptes subis par l&apos;entreprise</p>
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-semibold opacity-50"
                    disabled
                >
                    <Download className="w-3.5 h-3.5 opacity-70" />
                    PDF
                </button>
            </div>
            <FormIdentityBar />
            {rows.length > 0 && invalidRows > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 mb-3">
                    {invalidRows} ligne(s) non conforme(s) (IFU/date, base &lt;= montant HT, prélèvement &lt;= base).
                </div>
            )}
            <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 mb-3.5">
                Saisissez les prélèvements subis lors de vos ventes ou importations. Ces montants sont imputables sur vos
                impôts sur bénéfices.
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="bg-[#111] text-white w-8 py-2 text-[11px]">N°</th>
                                <th className="bg-gray-800 text-white text-left min-w-[140px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Nom / Raison sociale
                                </th>
                                <th className="bg-gray-800 text-white min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    IFU client
                                </th>
                                <th className="bg-gray-800 text-white min-w-[100px] px-2 py-2 border-l border-white/10 text-[11px]">Date</th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Montant HT
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Base imposable
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Prélèvement
                                </th>
                                <th className="bg-[#111] text-white w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-gray-400">
                                        Aucune ligne
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r, i) => (
                                    (() => {
                                        const errs = prelFieldErrors(r);
                                        const has = (k: string) => Boolean(errs[k]);
                                        return (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                        <td className="text-center text-gray-400">{i + 1}</td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('nom') ? 'border-red-300 bg-red-50' : ''}`} value={r.nom} onChange={(e) => updatePrelRow(r.id, { nom: e.target.value })} title={errs.nom} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('ifu') ? 'border-red-300 bg-red-50' : ''}`} maxLength={12} inputMode="text" placeholder="0012345678BF" pattern="\d{10}[A-Z]{2}" title={errs.ifu ?? 'Format IFU attendu : 10 chiffres + 2 lettres (ex: 0012345678BF)'} value={r.ifu} onChange={(e) => updatePrelRow(r.id, { ifu: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('date') ? 'border-red-300 bg-red-50' : ''}`} placeholder="jj/mm/aaaa" inputMode="numeric" pattern="(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/[0-9]{4}" title={errs.date ?? 'Format jj/mm/aaaa'} value={r.date} onChange={(e) => updatePrelRow(r.id, { date: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input type="number" min={0} step={1} className={`${cellNum} ${has('montantHT') ? 'border-red-300 bg-red-50' : ''}`} value={r.montantHT || ''} onChange={(e) => updatePrelRow(r.id, { montantHT: +e.target.value || 0 })} title={errs.montantHT} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input type="number" min={0} step={1} max={r.montantHT} className={`${cellNum} ${has('base') ? 'border-red-300 bg-red-50' : ''}`} value={r.base || ''} onChange={(e) => updatePrelRow(r.id, { base: +e.target.value || 0 })} title={errs.base} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input type="number" min={0} step={1} max={r.base} className={`${cellNum} ${has('prelevement') ? 'border-red-300 bg-red-50' : ''}`} value={r.prelevement || ''} onChange={(e) => updatePrelRow(r.id, { prelevement: +e.target.value || 0 })} title={errs.prelevement} />
                                        </td>
                                        <td className="text-center">
                                            <button type="button" className="p-1 text-gray-400 hover:text-red-600" onClick={() => removePrelRow(r.id)}>
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
                                    <td colSpan={4} className="text-left text-[11px] font-bold uppercase px-2 py-2 opacity-90">
                                        TOTAL
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">{formatFc(totH)}</td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">{formatFc(totB)}</td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">{formatFc(totP)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                <button
                    type="button"
                    onClick={() => addPrelRow()}
                    className="flex w-full items-center gap-2 px-4 py-2 border-t border-dashed border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 hover:bg-green-50 hover:text-green-700"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un prélèvement
                </button>
            </div>
        </div>
    );
}
