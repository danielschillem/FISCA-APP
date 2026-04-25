import { Plus, Trash2, Download, Zap } from 'lucide-react';
import FormIdentityBar from '../components/FormIdentityBar';
import { formatFc, useContribuableStore } from '../contribuableStore';
import { invalidRsfonRows, rsfonFieldErrors } from '../contribuableValidation';

const cellIn =
    'w-full min-w-[72px] px-1.5 py-1 text-xs border border-transparent rounded hover:border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600/15 outline-none';
const cellNum = `${cellIn} text-right tabular-nums`;

export default function ContribuableRSFONPage() {
    const rows = useContribuableStore((s) => s.annexes.rsfon.rows);
    const addRsfonRow = useContribuableStore((s) => s.addRsfonRow);
    const updateRsfonRow = useContribuableStore((s) => s.updateRsfonRow);
    const removeRsfonRow = useContribuableStore((s) => s.removeRsfonRow);

    const totL = rows.reduce((s, r) => s + (+r.loyer || 0), 0);
    const totR = rows.reduce((s, r) => s + (+r.retenue || 0), 0);
    const invalidRows = invalidRsfonRows(rows);

    return (
        <div className="max-w-[1200px]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900">ANNEXE RSFON</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Retenues sur Revenus Fonciers (Loyers) — CGI 2025 Art. 124–126
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-semibold opacity-50"
                        disabled
                    >
                        <Download className="w-3.5 h-3.5 opacity-70" />
                        PDF
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-green-600 text-white text-xs font-semibold opacity-50"
                        disabled
                    >
                        <Download className="w-3.5 h-3.5 opacity-90" />
                        XML EDI
                    </button>
                </div>
            </div>
            <FormIdentityBar />
            {rows.length > 0 && invalidRows > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 mb-3">
                    {invalidRows} ligne(s) non conforme(s) (identité, IFU valide, loyer &gt; 0).
                </div>
            )}
            <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 mb-3.5">
                Abattement <strong>50 %</strong> sur le loyer brut · Barème : <strong>18 %</strong> (base ≤ 100 000 F) +{' '}
                <strong>25 %</strong> (au-delà) · Retenue calculée automatiquement.
            </div>
            <div className="overflow-x-auto mb-4">
                <div className="bg-white rounded-lg shadow overflow-hidden min-w-[720px]">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="bg-[#111] text-white w-9 py-2 text-[11px]">N°</th>
                                <th className="bg-gray-800 text-white text-left min-w-[140px] px-2 py-2 text-[11px] border-l border-white/10">
                                    Identité du bailleur
                                </th>
                                <th className="bg-gray-800 text-white min-w-[90px] px-2 py-2 text-[11px] border-l border-white/10">
                                    IFU bailleur
                                </th>
                                <th className="bg-gray-800 text-white min-w-[90px] px-2 py-2 text-[11px] border-l border-white/10">
                                    Localité
                                </th>
                                <th className="bg-gray-800 text-white w-16 px-1 py-2 text-[11px] border-l border-white/10">Secteur</th>
                                <th className="bg-gray-800 text-white w-16 px-1 py-2 text-[11px] border-l border-white/10">Section</th>
                                <th className="bg-gray-800 text-white w-14 px-1 py-2 text-[11px] border-l border-white/10">Lot</th>
                                <th className="bg-gray-800 text-white w-16 px-1 py-2 text-[11px] border-l border-white/10">Parcelle</th>
                                <th className="bg-gray-800 text-white text-right min-w-[100px] px-2 py-2 text-[11px] border-l border-white/10">
                                    Montant loyer
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 text-[11px] border-l border-white/10 bg-green-900/30">
                                    <span className="inline-flex items-center justify-end gap-1 w-full">
                                        Retenue
                                        <Zap className="w-3 h-3 text-amber-300 shrink-0" aria-hidden />
                                    </span>
                                </th>
                                <th className="bg-[#111] text-white w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="text-center py-8 text-gray-400">
                                        Aucune ligne — ajoutez un bail
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r, i) => (
                                    (() => {
                                        const errs = rsfonFieldErrors(r);
                                        const has = (k: string) => Boolean(errs[k]);
                                        return (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                        <td className="text-center text-gray-400 py-1">{i + 1}</td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                className={`${cellIn} ${has('identite') ? 'border-red-300 bg-red-50' : ''}`}
                                                value={r.identite}
                                                onChange={(e) => updateRsfonRow(r.id, { identite: e.target.value })}
                                                title={errs.identite}
                                            />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                className={`${cellIn} ${has('ifu') ? 'border-red-300 bg-red-50' : ''}`}
                                                maxLength={12}
                                                inputMode="text"
                                                placeholder="0012345678BF"
                                                pattern="\d{10}[A-Z]{2}"
                                                title="Format IFU attendu : 10 chiffres + 2 lettres (ex: 0012345678BF)"
                                                value={r.ifu}
                                                onChange={(e) => updateRsfonRow(r.id, { ifu: e.target.value })}
                                                title={errs.ifu}
                                            />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                className={cellIn}
                                                value={r.localite}
                                                onChange={(e) => updateRsfonRow(r.id, { localite: e.target.value })}
                                            />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                className={cellIn}
                                                value={r.secteur}
                                                onChange={(e) => updateRsfonRow(r.id, { secteur: e.target.value })}
                                            />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                className={cellIn}
                                                value={r.section}
                                                onChange={(e) => updateRsfonRow(r.id, { section: e.target.value })}
                                            />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                className={cellIn}
                                                value={r.lot}
                                                onChange={(e) => updateRsfonRow(r.id, { lot: e.target.value })}
                                            />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                className={cellIn}
                                                value={r.parcelle}
                                                onChange={(e) => updateRsfonRow(r.id, { parcelle: e.target.value })}
                                            />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                className={`${cellNum} ${has('loyer') ? 'border-red-300 bg-red-50' : ''}`}
                                                value={r.loyer || ''}
                                                onChange={(e) => updateRsfonRow(r.id, { loyer: +e.target.value || 0 })}
                                                title={errs.loyer}
                                            />
                                        </td>
                                        <td className="p-1.5 text-right tabular-nums font-semibold text-green-800 bg-green-600/[0.08] border-l border-gray-100">
                                            {formatFc(r.retenue)}
                                        </td>
                                        <td className="text-center p-0">
                                            <button
                                                type="button"
                                                className="p-1 text-gray-400 hover:text-red-600"
                                                onClick={() => removeRsfonRow(r.id)}
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
                                    <td colSpan={8} className="text-left text-[11px] font-bold uppercase px-2 py-2 opacity-90">
                                        TOTAL
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">
                                        <strong>{formatFc(totL)}</strong>
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold text-green-200 bg-white/5 border-l border-white/10">
                                        <strong>{formatFc(totR)}</strong>
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                    <button
                        type="button"
                        onClick={() => addRsfonRow()}
                        className="flex w-full items-center gap-2 px-4 py-2 border-t border-dashed border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 hover:bg-green-50 hover:text-green-700"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un bail
                    </button>
                </div>
            </div>
        </div>
    );
}
