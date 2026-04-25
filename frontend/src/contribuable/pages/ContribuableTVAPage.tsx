import { Plus, Trash2, Download, Zap } from 'lucide-react';
import FormIdentityBar from '../components/FormIdentityBar';
import { formatFc, TVA_TYPE_OPTIONS, useContribuableStore } from '../contribuableStore';
import { invalidTvaAvRows, invalidTvaDedRows, tvaAvFieldErrors, tvaDedFieldErrors } from '../contribuableValidation';

const cellIn =
    'w-full min-w-[70px] px-1.5 py-1 text-xs border border-transparent rounded hover:border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600/15 outline-none';
const cellNum = `${cellIn} text-right tabular-nums`;

export default function ContribuableTVAPage() {
    const ded = useContribuableStore((s) => s.annexes.tva.deductible);
    const av = useContribuableStore((s) => s.annexes.tva.avances);
    const addDed = useContribuableStore((s) => s.addTvaDeductible);
    const updDed = useContribuableStore((s) => s.updateTvaDeductible);
    const remDed = useContribuableStore((s) => s.removeTvaDeductible);
    const addAv = useContribuableStore((s) => s.addTvaAvance);
    const updAv = useContribuableStore((s) => s.updateTvaAvance);
    const remAv = useContribuableStore((s) => s.removeTvaAvance);

    const totHT = ded.reduce((s, r) => s + (+r.ht || 0), 0);
    const totTVA = ded.reduce((s, r) => s + (+r.tvaFacturee || 0), 0);
    const totDed = ded.reduce((s, r) => s + (+r.tvaDed || 0), 0);
    const totTTC = av.reduce((s, r) => s + (+r.ttc || 0), 0);
    const totHTVA = av.reduce((s, r) => s + (+r.htva || 0), 0);
    const invalidDedRows = invalidTvaDedRows(ded);
    const invalidAvRows = invalidTvaAvRows(av);

    return (
        <div className="max-w-[1200px]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900">ANNEXE TVA</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        TVA Déductible + Avances / Acomptes sur Marchés — CGI 2025 Art. 317
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
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-green-600 text-white text-xs opacity-50"
                        disabled
                    >
                        <Download className="w-3.5 h-3.5 opacity-90" />
                        XML EDI
                    </button>
                </div>
            </div>
            <FormIdentityBar />
            {(invalidDedRows > 0 || invalidAvRows > 0) && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 mb-3">
                    {invalidDedRows + invalidAvRows} ligne(s) non conforme(s) (IFU/date, montants, plafonds TVA). Corrigez avant génération.
                </div>
            )}
            <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 mb-4">
                TVA calculée automatiquement à <strong>18 %</strong> sur le prix HT. Le montant déductible peut être ajusté
                manuellement si nécessaire.
            </div>

            <h3 className="text-[13px] font-bold text-gray-700 mb-2.5 pb-1.5 border-b-2 border-gray-200">
                Tableau 1 — TVA Déductible sur achats
            </h3>
            <div className="overflow-x-auto mb-7">
                <div className="bg-white rounded-lg shadow overflow-hidden min-w-[720px]">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="bg-[#111] text-white w-8 py-2 text-[11px]">N°</th>
                                <th className="bg-gray-800 text-white text-left min-w-[200px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Type de biens / services
                                </th>
                                <th className="bg-gray-800 text-white min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    IFU fournisseur
                                </th>
                                <th className="bg-gray-800 text-white min-w-[120px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Nom / Raison sociale
                                </th>
                                <th className="bg-gray-800 text-white min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">Date</th>
                                <th className="bg-gray-800 text-white min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">Référence</th>
                                <th className="bg-gray-800 text-white text-right min-w-[80px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Prix HT
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[80px] px-2 py-2 border-l border-white/10 text-[11px] bg-green-900/25">
                                    <span className="inline-flex items-center justify-end gap-1 w-full">
                                        TVA 18%
                                        <Zap className="w-3 h-3 text-amber-300 shrink-0" aria-hidden />
                                    </span>
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    TVA déductible
                                </th>
                                <th className="bg-[#111] text-white w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {ded.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-8 text-gray-400">
                                        Aucune ligne — ajoutez un achat
                                    </td>
                                </tr>
                            ) : (
                                ded.map((r, i) => (
                                    (() => {
                                        const errs = tvaDedFieldErrors(r);
                                        const has = (k: string) => Boolean(errs[k]);
                                        return (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                        <td className="text-center text-gray-400">{i + 1}</td>
                                        <td className="p-1 border-l border-gray-100">
                                            <select
                                                className={`${cellIn} min-w-[190px] cursor-pointer`}
                                                value={r.type}
                                                onChange={(e) => updDed(r.id, { type: e.target.value })}
                                            >
                                                {TVA_TYPE_OPTIONS.map((t) => (
                                                    <option key={t} value={t}>
                                                        {t}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('ifu') ? 'border-red-300 bg-red-50' : ''}`} maxLength={12} inputMode="text" placeholder="0012345678BF" pattern="\d{10}[A-Z]{2}" title={errs.ifu ?? 'Format IFU attendu : 10 chiffres + 2 lettres (ex: 0012345678BF)'} value={r.ifu} onChange={(e) => updDed(r.id, { ifu: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('nom') ? 'border-red-300 bg-red-50' : ''}`} value={r.nom} onChange={(e) => updDed(r.id, { nom: e.target.value })} title={errs.nom} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('date') ? 'border-red-300 bg-red-50' : ''}`} placeholder="jj/mm/aaaa" inputMode="numeric" pattern="(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/[0-9]{4}" title={errs.date ?? 'Format jj/mm/aaaa'} value={r.date} onChange={(e) => updDed(r.id, { date: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={cellIn} value={r.ref} onChange={(e) => updDed(r.id, { ref: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input type="number" min={0} step={1} className={`${cellNum} ${has('ht') ? 'border-red-300 bg-red-50' : ''}`} value={r.ht || ''} onChange={(e) => updDed(r.id, { ht: +e.target.value || 0 })} title={errs.ht} />
                                        </td>
                                        <td className="p-1.5 text-right tabular-nums font-semibold bg-green-600/[0.08] text-green-900 border-l border-gray-100">
                                            {formatFc(r.tvaFacturee)}
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input type="number" min={0} step={1} max={r.tvaFacturee} className={`${cellNum} ${has('tvaDed') ? 'border-red-300 bg-red-50' : ''}`} value={r.tvaDed || ''} onChange={(e) => updDed(r.id, { tvaDed: +e.target.value || 0 })} title={errs.tvaDed} />
                                        </td>
                                        <td className="text-center">
                                            <button type="button" className="p-1 text-gray-400 hover:text-red-600" onClick={() => remDed(r.id)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                        );
                                    })()
                                ))
                            )}
                        </tbody>
                        {ded.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={6} className="text-left text-[11px] font-bold uppercase px-2 py-2 opacity-90">
                                        TOTAL
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">{formatFc(totHT)}</td>
                                    <td className="text-right tabular-nums text-xs font-bold text-green-200 border-l border-white/10">{formatFc(totTVA)}</td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">{formatFc(totDed)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                    <button
                        type="button"
                        onClick={() => addDed()}
                        className="flex w-full items-center gap-2 px-4 py-2 border-t border-dashed border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 hover:bg-green-50 hover:text-green-700"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un achat
                    </button>
                </div>
            </div>

            <h3 className="text-[13px] font-bold text-gray-700 mb-2.5 pb-1.5 border-b-2 border-gray-200 mt-7">
                Tableau 2 — Avances, Acomptes et Décomptes sur marchés
            </h3>
            <div className="overflow-x-auto">
                <div className="bg-white rounded-lg shadow overflow-hidden min-w-[720px]">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="bg-[#111] text-white w-8 py-2 text-[11px]">N°</th>
                                <th className="bg-gray-800 text-white min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    IFU commanditaire
                                </th>
                                <th className="bg-gray-800 text-white min-w-[120px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Nom / Raison sociale
                                </th>
                                <th className="bg-gray-800 text-white min-w-[110px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Source financement
                                </th>
                                <th className="bg-gray-800 text-white min-w-[120px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Réf. marché / contrat
                                </th>
                                <th className="bg-gray-800 text-white min-w-[120px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Nature opération
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Montant TTC
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px] bg-green-900/25">
                                    <span className="inline-flex items-center justify-end gap-1 w-full">
                                        HTVA période
                                        <Zap className="w-3 h-3 text-amber-300 shrink-0" aria-hidden />
                                    </span>
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    HTVA cumulé
                                </th>
                                <th className="bg-[#111] text-white w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {av.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-8 text-gray-400">
                                        Aucune ligne — ajoutez un marché
                                    </td>
                                </tr>
                            ) : (
                                av.map((r, i) => (
                                    (() => {
                                        const errs = tvaAvFieldErrors(r);
                                        const has = (k: string) => Boolean(errs[k]);
                                        return (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                        <td className="text-center text-gray-400">{i + 1}</td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('ifu') ? 'border-red-300 bg-red-50' : ''}`} maxLength={12} inputMode="text" placeholder="0012345678BF" pattern="\d{10}[A-Z]{2}" title={errs.ifu ?? 'Format IFU attendu : 10 chiffres + 2 lettres (ex: 0012345678BF)'} value={r.ifu} onChange={(e) => updAv(r.id, { ifu: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={`${cellIn} ${has('nom') ? 'border-red-300 bg-red-50' : ''}`} value={r.nom} onChange={(e) => updAv(r.id, { nom: e.target.value })} title={errs.nom} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={cellIn} value={r.source} onChange={(e) => updAv(r.id, { source: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={cellIn} value={r.refMarche} onChange={(e) => updAv(r.id, { refMarche: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input className={cellIn} value={r.nature} onChange={(e) => updAv(r.id, { nature: e.target.value })} />
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input type="number" min={0} step={1} className={`${cellNum} ${has('ttc') ? 'border-red-300 bg-red-50' : ''}`} value={r.ttc || ''} onChange={(e) => updAv(r.id, { ttc: +e.target.value || 0 })} title={errs.ttc} />
                                        </td>
                                        <td className="p-1.5 text-right tabular-nums font-semibold bg-green-600/[0.08] text-green-900 border-l border-gray-100">
                                            {formatFc(r.htva)}
                                        </td>
                                        <td className="p-1 border-l border-gray-100">
                                            <input type="number" min={r.htva} step={1} className={`${cellNum} ${has('cumulHTVA') ? 'border-red-300 bg-red-50' : ''}`} value={r.cumulHTVA || ''} onChange={(e) => updAv(r.id, { cumulHTVA: +e.target.value || 0 })} title={errs.cumulHTVA} />
                                        </td>
                                        <td className="text-center">
                                            <button type="button" className="p-1 text-gray-400 hover:text-red-600" onClick={() => remAv(r.id)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                        );
                                    })()
                                ))
                            )}
                        </tbody>
                        {av.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={6} className="text-left text-[11px] font-bold uppercase px-2 py-2 opacity-90">
                                        TOTAL
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">{formatFc(totTTC)}</td>
                                    <td className="text-right tabular-nums text-xs font-bold text-green-200 border-l border-white/10">{formatFc(totHTVA)}</td>
                                    <td className="border-l border-white/10" />
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                    <button
                        type="button"
                        onClick={() => addAv()}
                        className="flex w-full items-center gap-2 px-4 py-2 border-t border-dashed border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 hover:bg-green-50 hover:text-green-700"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un marché
                    </button>
                </div>
            </div>
        </div>
    );
}
