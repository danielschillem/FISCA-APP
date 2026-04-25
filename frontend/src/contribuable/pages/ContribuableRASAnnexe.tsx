import { Plus, Trash2, Download, Zap } from 'lucide-react';
import FormIdentityBar from '../components/FormIdentityBar';
import {
    formatFc,
    getRSETRTaux,
    getRSLIBTaux,
    getRSPRETaux,
    getRSTVATaux,
    useContribuableStore,
    type RSLibRow,
    type RSETRRow,
    type RSPRERow,
    type RSTVARow,
} from '../contribuableStore';
import { invalidRasRows, rasFieldErrors } from '../contribuableValidation';

const cellIn =
    'w-full min-w-[70px] px-1.5 py-1 text-xs border border-transparent rounded hover:border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600/15 outline-none';
const cellNum = `${cellIn} text-right tabular-nums`;

export type RASVariant = 'rslib' | 'rsetr' | 'rspre' | 'rstva';

const CFG: Record<
    RASVariant,
    {
        titre: string;
        desc: string;
        montantLabel: string;
        hint: string;
        taux: readonly { v: number; l: string }[];
    }
> = {
    rslib: {
        titre: 'ANNEXE RSLIB',
        desc: 'Retenues Libératoires — Non-Déterminés · CGI 2025 Art. 220–221',
        montantLabel: 'Montant TTC',
        hint: 'Taux : 2 % (vacations, prestations manuelles) · 10 % (salariés, intellectuels) · 5 % (entités publiques)',
        taux: [],
    },
    rsetr: {
        titre: 'ANNEXE RSETR',
        desc: 'Retenues sur Prestataires Non-Résidents · CGI 2025 Art. 210–212',
        montantLabel: 'Montant HT versé',
        hint: 'Taux : 20 % (non-résidents général) · 10 % (transport routier CEDEAO)',
        taux: [],
    },
    rspre: {
        titre: 'ANNEXE RSPRE',
        desc: 'Retenues sur Prestataires Résidents · CGI 2025 Art. 206–207',
        montantLabel: 'Montant HT',
        hint: 'Taux : 1 % (immobilier/TP) · 2 % (travail temp.) · 5 % (avec IFU) · 25 % (sans IFU)',
        taux: [],
    },
    rstva: {
        titre: 'ANNEXE RSTVA',
        desc: 'Retenues à la Source TVA — Marchés publics',
        montantLabel: 'Montant TVA supportée',
        hint: 'Taux : 20 % ou 30 % selon le marché.',
        taux: [],
    },
};

export default function ContribuableRASAnnexe({ variant }: { variant: RASVariant }) {
    const year = useContribuableStore((s) => s.period.year);
    const cfg = {
        ...CFG[variant],
        taux:
            variant === 'rslib'
                ? getRSLIBTaux(year)
                : variant === 'rsetr'
                  ? getRSETRTaux(year)
                  : variant === 'rspre'
                    ? getRSPRETaux(year)
                    : getRSTVATaux(year),
    };
    const rows = useContribuableStore((s) => s.annexes[variant].rows);
    const add = useContribuableStore((s) =>
        variant === 'rslib'
            ? s.addRSLibRow
            : variant === 'rsetr'
              ? s.addRSETRRow
              : variant === 'rspre'
                ? s.addRSPRERow
                : s.addRSTVARow
    );
    const update = useContribuableStore((s) =>
        variant === 'rslib'
            ? s.updateRSLibRow
            : variant === 'rsetr'
              ? s.updateRSETRRow
              : variant === 'rspre'
                ? s.updateRSPRERow
                : s.updateRSTVARow
    );
    const remove = useContribuableStore((s) =>
        variant === 'rslib'
            ? s.removeRSLibRow
            : variant === 'rsetr'
              ? s.removeRSETRRow
              : variant === 'rspre'
                ? s.removeRSPRERow
                : s.removeRSTVARow
    );

    const totM = rows.reduce((s, r) => {
        const v =
            variant === 'rstva'
                ? +(r as { montantTVA: number }).montantTVA || 0
                : +(r as { montant: number }).montant || 0;
        return s + v;
    }, 0);
    const totR = rows.reduce((s, r) => s + (+r.retenue || 0), 0);
    const invalidRows = invalidRasRows(rows, variant);

    return (
        <div className="max-w-[1200px]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900">{cfg.titre}</h2>
                    <p className="text-xs text-gray-500 mt-1">{cfg.desc}</p>
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
            {rows.length > 0 && invalidRows > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 mb-3">
                    {invalidRows} ligne(s) non conforme(s) ({variant === 'rsetr' ? 'champs requis, date, montant' : 'IFU/champs requis/date/montant'}).
                </div>
            )}
            <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 mb-3.5">
                {cfg.hint}
            </div>
            <div className="overflow-x-auto mb-4">
                <div className="bg-white rounded-lg shadow overflow-hidden min-w-[640px]">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="bg-[#111] text-white w-8 py-2">N°</th>
                                {variant === 'rsetr' ? (
                                    <>
                                        <th className="bg-gray-800 text-white text-left min-w-[120px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            Nom / Raison sociale
                                        </th>
                                        <th className="bg-gray-800 text-white text-left min-w-[110px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            Activité / Profession
                                        </th>
                                        <th className="bg-gray-800 text-white text-left min-w-[110px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            Adresse
                                        </th>
                                        <th className="bg-gray-800 text-white text-left min-w-[110px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            Nature des prestations
                                        </th>
                                    </>
                                ) : (
                                    <>
                                        <th className="bg-gray-800 text-white text-left min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            IFU
                                        </th>
                                        <th className="bg-gray-800 text-white text-left min-w-[110px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            Identification
                                        </th>
                                        <th className="bg-gray-800 text-white text-left min-w-[100px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            Adresse
                                        </th>
                                        <th className="bg-gray-800 text-white text-left min-w-[100px] px-2 py-2 border-l border-white/10 text-[11px]">
                                            Nature des prestations
                                        </th>
                                    </>
                                )}
                                <th className="bg-gray-800 text-white min-w-[100px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Date (jj/mm/aaaa)
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[90px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    {cfg.montantLabel}
                                </th>
                                <th className="bg-gray-800 text-white min-w-[150px] px-2 py-2 border-l border-white/10 text-[11px]">
                                    Taux de retenue
                                </th>
                                <th className="bg-gray-800 text-white text-right min-w-[80px] px-2 py-2 border-l border-white/10 text-[11px] bg-green-900/25">
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
                                    <td colSpan={10} className="text-center py-8 text-gray-400 border-b border-gray-100">
                                        Aucune ligne — ajoutez une ligne
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, i) => {
                                    const id = row.id;
                                    if (variant === 'rsetr') {
                                        const r = row as RSETRRow;
                                        const errs = rasFieldErrors(r, variant);
                                        const has = (k: string) => Boolean(errs[k]);
                                        return (
                                            <tr key={id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                                <td className="text-center text-gray-400">{i + 1}</td>
                                                <td className="p-1 border-l border-gray-100">
                                                    <input className={`${cellIn} ${has('nom') ? 'border-red-300 bg-red-50' : ''}`} value={r.nom} onChange={(e) => update(id, { nom: e.target.value })} title={errs.nom} />
                                                </td>
                                                <td className="p-1 border-l border-gray-100">
                                                    <input className={`${cellIn} ${has('activite') ? 'border-red-300 bg-red-50' : ''}`} value={r.activite} onChange={(e) => update(id, { activite: e.target.value })} title={errs.activite} />
                                                </td>
                                                <td className="p-1 border-l border-gray-100">
                                                    <input className={`${cellIn} ${has('adresse') ? 'border-red-300 bg-red-50' : ''}`} value={r.adresse} onChange={(e) => update(id, { adresse: e.target.value })} title={errs.adresse} />
                                                </td>
                                                <td className="p-1 border-l border-gray-100">
                                                    <input className={`${cellIn} ${has('nature') ? 'border-red-300 bg-red-50' : ''}`} value={r.nature} onChange={(e) => update(id, { nature: e.target.value })} title={errs.nature} />
                                                </td>
                                                <td className="p-1 border-l border-gray-100">
                                                    <input className={`${cellIn} ${has('date') ? 'border-red-300 bg-red-50' : ''}`} placeholder="15/01/2025" inputMode="numeric" pattern="(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/[0-9]{4}" title={errs.date ?? 'Format jj/mm/aaaa'} value={r.date} onChange={(e) => update(id, { date: e.target.value })} />
                                                </td>
                                                <td className="p-1 border-l border-gray-100">
                                                    <input type="number" min={0} step={1} className={`${cellNum} ${has('montant') ? 'border-red-300 bg-red-50' : ''}`} value={r.montant || ''} onChange={(e) => update(id, { montant: +e.target.value || 0 })} title={errs.montant} />
                                                </td>
                                                <td className="p-1 border-l border-gray-100">
                                                    <select
                                                        className={`${cellIn} cursor-pointer`}
                                                        value={String(r.taux)}
                                                        onChange={(e) => update(id, { taux: +e.target.value })}
                                                    >
                                                        {cfg.taux.map((o) => (
                                                            <option key={o.v} value={String(o.v)}>
                                                                {o.l}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-1.5 text-right font-semibold text-green-800 bg-green-600/[0.08] border-l border-gray-100 tabular-nums">
                                                    {formatFc(r.retenue)}
                                                </td>
                                                <td className="text-center">
                                                    <button type="button" className="p-1 text-gray-400 hover:text-red-600" onClick={() => remove(id)}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }
                                    const r = row as {
                                        ifu: string;
                                        identification: string;
                                        adresse: string;
                                        nature: string;
                                        date: string;
                                        montant: number;
                                        montantTVA?: number;
                                        taux: number;
                                        retenue: number;
                                    };
                                    const errs = rasFieldErrors(row as RSLibRow | RSPRERow | RSTVARow, variant);
                                    const has = (k: string) => Boolean(errs[k]);
                                    const montVal = variant === 'rstva' ? r.montantTVA ?? 0 : r.montant;
                                    return (
                                        <tr key={id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                            <td className="text-center text-gray-400">{i + 1}</td>
                                            <td className="p-1 border-l border-gray-100">
                                                <input className={`${cellIn} ${has('ifu') ? 'border-red-300 bg-red-50' : ''}`} maxLength={12} inputMode="text" placeholder="0012345678BF" pattern="\d{10}[A-Z]{2}" title={errs.ifu ?? 'Format IFU attendu : 10 chiffres + 2 lettres (ex: 0012345678BF)'} value={r.ifu} onChange={(e) => update(id, { ifu: e.target.value })} />
                                            </td>
                                            <td className="p-1 border-l border-gray-100">
                                                <input className={`${cellIn} ${has('identification') ? 'border-red-300 bg-red-50' : ''}`} value={r.identification} onChange={(e) => update(id, { identification: e.target.value })} title={errs.identification} />
                                            </td>
                                            <td className="p-1 border-l border-gray-100">
                                                <input className={`${cellIn} ${has('adresse') ? 'border-red-300 bg-red-50' : ''}`} value={r.adresse} onChange={(e) => update(id, { adresse: e.target.value })} title={errs.adresse} />
                                            </td>
                                            <td className="p-1 border-l border-gray-100">
                                                <input className={`${cellIn} ${has('nature') ? 'border-red-300 bg-red-50' : ''}`} value={r.nature} onChange={(e) => update(id, { nature: e.target.value })} title={errs.nature} />
                                            </td>
                                            <td className="p-1 border-l border-gray-100">
                                                <input className={`${cellIn} ${has('date') ? 'border-red-300 bg-red-50' : ''}`} placeholder="15/01/2025" inputMode="numeric" pattern="(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/[0-9]{4}" title={errs.date ?? 'Format jj/mm/aaaa'} value={r.date} onChange={(e) => update(id, { date: e.target.value })} />
                                            </td>
                                            <td className="p-1 border-l border-gray-100">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={1}
                                                    className={`${cellNum} ${has(variant === 'rstva' ? 'montantTVA' : 'montant') ? 'border-red-300 bg-red-50' : ''}`}
                                                    value={montVal || ''}
                                                    onChange={(e) =>
                                                        variant === 'rstva'
                                                            ? update(id, { montantTVA: +e.target.value || 0 })
                                                            : update(id, { montant: +e.target.value || 0 })
                                                    }
                                                    title={variant === 'rstva' ? errs.montantTVA : errs.montant}
                                                />
                                            </td>
                                            <td className="p-1 border-l border-gray-100">
                                                <select
                                                    className={`${cellIn} cursor-pointer`}
                                                    value={String(r.taux)}
                                                    onChange={(e) => update(id, { taux: +e.target.value })}
                                                >
                                                    {cfg.taux.map((o) => (
                                                        <option key={o.v} value={String(o.v)}>
                                                            {o.l}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-1.5 text-right font-semibold text-green-800 bg-green-600/[0.08] border-l border-gray-100 tabular-nums">
                                                {formatFc(r.retenue)}
                                            </td>
                                            <td className="text-center">
                                                <button type="button" className="p-1 text-gray-400 hover:text-red-600" onClick={() => remove(id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={6} className="text-left text-[11px] font-bold uppercase px-2 py-2 opacity-90">
                                        TOTAL
                                    </td>
                                    <td className="text-right tabular-nums text-xs font-bold border-l border-white/10">
                                        <strong>{formatFc(totM)}</strong>
                                    </td>
                                    <td className="border-l border-white/10" />
                                    <td className="text-right tabular-nums text-xs font-bold text-green-200 border-l border-white/10">
                                        <strong>{formatFc(totR)}</strong>
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                    <button
                        type="button"
                        onClick={() => add()}
                        className="flex w-full items-center gap-2 px-4 py-2 border-t border-dashed border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 hover:bg-green-50 hover:text-green-700"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une ligne
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap gap-8 bg-white rounded-lg shadow px-5 py-3 text-[13px]">
                <div>
                    <span className="text-gray-600">Total {cfg.montantLabel.toLowerCase()} :</span>{' '}
                    <strong className="text-green-700 tabular-nums">{formatFc(totM)} FCFA</strong>
                </div>
                <div>
                    <span className="text-gray-600">Total retenue à reverser :</span>{' '}
                    <strong className="text-green-700 tabular-nums">{formatFc(totR)} FCFA</strong>
                </div>
            </div>
        </div>
    );
}
