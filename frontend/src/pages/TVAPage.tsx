import { useState, useRef } from 'react';
import type React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tvaApi, companyApi } from '../lib/api';
import { calcTVA, fmt, fmtN } from '../lib/fiscalCalc';
import { parseFile, downloadCsvTemplate, parseAmount, parseTaux } from '../lib/importCsv';
import { Card, Btn, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import type { TVADeclaration, Company } from '../types';
import { generateTVAForm } from '../lib/pdfDGI';
import { usePaymentGate } from '../components/PaymentModal';
import { Save, X, Lock, FileText, Upload, Download } from 'lucide-react';

type LigneLocal = { label: string; ht: number; taux: number; type_op: 'vente' | 'achat' };

const now = new Date();

export default function TVAPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('tva')) return <Locked />;
    return <TVAContent />;
}

function TVAContent() {
    const qc = useQueryClient();
    const { requestPayment, PaymentModalComponent } = usePaymentGate();
    const [mois, setMois] = useState(now.getMonth() + 1);
    const [annee, setAnnee] = useState(now.getFullYear());
    const [saving, setSaving] = useState(false);
    const [collectee, setCollectee] = useState<LigneLocal[]>([
        { label: 'Ventes produits', ht: 0, taux: 0.18, type_op: 'vente' },
        { label: 'Prestations services', ht: 0, taux: 0.18, type_op: 'vente' },
    ]);
    const [deductible, setDeductible] = useState<LigneLocal[]>([
        { label: 'Achats matières premières', ht: 0, taux: 0.18, type_op: 'achat' },
        { label: 'Charges locatives', ht: 0, taux: 0.18, type_op: 'achat' },
    ]);

    const { data: declarations = [], isLoading } = useQuery<TVADeclaration[]>({
        queryKey: ['tva'],
        queryFn: () => tvaApi.list().then((r) => r.data ?? []),
        staleTime: 30_000,
    });

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    const totC = collectee.reduce((s, l) => {
        const { tva } = calcTVA(l.ht, l.taux);
        return { ht: s.ht + l.ht, tva: s.tva + tva };
    }, { ht: 0, tva: 0 });

    const totD = deductible.reduce((s, l) => {
        const { tva } = calcTVA(l.ht, l.taux);
        return { ht: s.ht + l.ht, tva: s.tva + tva };
    }, { ht: 0, tva: 0 });

    const solde = totC.tva - totD.tva;
    const credit = solde < 0;

    const save = async () => {
        setSaving(true);
        try {
            const decl = await tvaApi.create({
                mois, annee,
                ca_ttc: totC.ht + totC.tva,
                ca_ht: totC.ht,
                tva_collectee: totC.tva,
                tva_deductible: totD.tva,
                tva_nette: solde,
            });
            const declId = decl.data?.id;
            if (declId) {
                const all: LigneLocal[] = [
                    ...collectee.map((l) => ({ ...l, type_op: 'vente' as const })),
                    ...deductible.map((l) => ({ ...l, type_op: 'achat' as const })),
                ];
                for (const l of all) {
                    const { tva, ttc } = calcTVA(l.ht, l.taux);
                    await tvaApi.addLigne(declId, {
                        type_op: l.type_op, description: l.label,
                        montant_ht: l.ht, taux_tva: l.taux * 100,
                        montant_tva: tva, montant_ttc: ttc,
                    });
                }
            }
            qc.invalidateQueries({ queryKey: ['tva'] });
        } catch { /* ignore */ } finally { setSaving(false); }
    };

    const deleteMut = useMutation({
        mutationFn: (id: string) => tvaApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tva'] }),
    });

    const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    return (
        <div className="space-y-6">
            {PaymentModalComponent}
            {/* Période + actions */}
            <div className="flex items-center gap-3 flex-wrap">
                <select value={mois} onChange={(e) => setMois(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                    {MOIS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={annee} onChange={(e) => setAnnee(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                    {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <Btn onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Enregistrer la déclaration</>}</Btn>
            </div>

            {/* Solde */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">TVA collectée</p>
                    <p className="text-xl font-bold text-green-700">{fmt(totC.tva)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">TVA déductible</p>
                    <p className="text-xl font-bold text-orange-700">{fmt(totD.tva)}</p>
                </div>
                <div className={`${credit ? 'bg-blue-50' : 'bg-red-50'} rounded-xl p-4`}>
                    <p className="text-xs text-gray-500">{credit ? 'Crédit TVA' : 'TVA à reverser'}</p>
                    <p className={`text-xl font-bold ${credit ? 'text-blue-700' : 'text-red-700'}`}>{fmt(Math.abs(solde))}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <LignesPanel
                    title="TVA collectée (ventes)"
                    lignes={collectee}
                    onChange={setCollectee}
                    typeOp="vente"
                />
                <LignesPanel
                    title="TVA déductible (achats)"
                    lignes={deductible}
                    onChange={setDeductible}
                    typeOp="achat"
                />
            </div>

            {/* Historique des déclarations TVA */}
            {declarations.length > 0 && (
                <Card title="Déclarations TVA enregistrées">
                    {isLoading ? <Spinner /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                        {['Période', 'TVA collectée', 'TVA déductible', 'TVA nette', 'Statut', ''].map((c) => (
                                            <th key={c} className="py-2 px-3 text-right first:text-left">{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {declarations.map((d) => (
                                        <tr key={d.id} className="hover:bg-gray-50">
                                            <td className="py-2 px-3 font-medium">{d.periode}</td>
                                            <td className="py-2 px-3 text-right font-mono text-xs">{fmt(d.tva_collectee)}</td>
                                            <td className="py-2 px-3 text-right font-mono text-xs">{fmt(d.tva_deductible)}</td>
                                            <td className={`py-2 px-3 text-right font-bold font-mono text-xs ${d.tva_nette < 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                                {fmt(Math.abs(d.tva_nette))} {d.tva_nette < 0 ? '(crédit)' : '(à payer)'}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.statut === 'depose' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {d.statut}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => requestPayment('tva', d.id, async () => {
                                                            const full = await tvaApi.get(d.id);
                                                            generateTVAForm(full.data as TVADeclaration, company);
                                                        })}
                                                        title="Formulaire DGI"
                                                        className="p-1 text-orange-500 hover:bg-orange-50 rounded">
                                                        <FileText className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => deleteMut.mutate(d.id)}
                                                        className="text-xs text-red-400 hover:text-red-600 p-1"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            <Card>
                <p className="text-xs text-gray-500 mb-3">Référence légale : CGI 2025 : Art. 317 - Taux standard 18 % - Hôtellerie/restauration 10 %</p>
                <div className="text-xs text-gray-400 space-y-1">
                    <p>- Seuil d'assujettissement : CA ≥ 50 000 000 FCFA/an</p>
                    <p>- Déclaration mensuelle, paiement avant le 15 du mois suivant</p>
                    <p>- Crédit TVA : reportable sur les mois suivants ou remboursable</p>
                </div>
            </Card>
        </div>
    );
}

// Champ montant HT : saisie libre, formatage automatique avec séparateurs de milliers
function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [focused, setFocused] = useState(false);
    const [raw, setRaw] = useState('');

    const handleFocus = () => {
        setRaw(value === 0 ? '' : String(value));
        setFocused(true);
    };
    const handleBlur = () => {
        setFocused(false);
        const n = parseInt(raw.replace(/\s/g, ''), 10);
        onChange(isNaN(n) || n < 0 ? 0 : n);
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cleaned = e.target.value.replace(/[^\d]/g, '');
        setRaw(cleaned);
        const n = parseInt(cleaned, 10);
        onChange(isNaN(n) ? 0 : n);
    };

    // Formatage avec espaces comme séparateurs de milliers pendant l'affichage
    const displayValue = focused
        ? raw
        : (value === 0 ? '' : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'));

    return (
        <input
            type="text"
            inputMode="numeric"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-right focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            value={displayValue}
            placeholder="0"
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
        />
    );
}

function LignesPanel({
    title, lignes, onChange, typeOp,
}: { title: string; lignes: LigneLocal[]; onChange: (l: LigneLocal[]) => void; typeOp: 'vente' | 'achat' }) {
    const importRef = useRef<HTMLInputElement>(null);
    const [importErr, setImportErr] = useState('');

    const handleDownloadTemplate = () => {
        const filename = typeOp === 'vente' ? 'modele-tva-ventes.csv' : 'modele-tva-achats.csv';
        downloadCsvTemplate(
            filename,
            ['Description', 'Montant HT', 'Taux TVA (%)'],
            typeOp === 'vente'
                ? [
                    ['Ventes produits finis', '2500000', '18'],
                    ['Prestations de services', '800000', '18'],
                    ['Hebergement/restauration', '500000', '10'],
                ]
                : [
                    ['Achats matieres premieres', '1200000', '18'],
                    ['Charges locatives', '300000', '18'],
                    ['Hotellerie/transport', '200000', '10'],
                ]
        );
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportErr('');
        try {
            const rows = await parseFile(file);
            const newLignes: LigneLocal[] = rows
                .filter((r) => {
                    const ht = parseAmount(r['Montant HT'] ?? r['montant_ht'] ?? r['HT'] ?? '');
                    return ht > 0;
                })
                .map((r) => ({
                    label: (r['Description'] ?? r['description'] ?? r['Libellé'] ?? '').trim() || 'Ligne importée',
                    ht: parseAmount(r['Montant HT'] ?? r['montant_ht'] ?? r['HT'] ?? '0'),
                    taux: parseTaux(r['Taux TVA (%)'] ?? r['Taux TVA'] ?? r['taux'] ?? r['Taux'] ?? '18'),
                    type_op: typeOp,
                }));
            if (newLignes.length === 0) {
                setImportErr('Aucune ligne valide trouvée. Vérifiez le modèle.');
                return;
            }
            onChange([...lignes, ...newLignes]);
        } catch (err: unknown) {
            setImportErr((err as Error).message ?? 'Erreur import');
        } finally {
            if (importRef.current) importRef.current.value = '';
        }
    };

    return (
        <Card title={title}>
            {/* En-têtes colonnes */}
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-medium mb-1 px-0.5">
                <span className="col-span-4">Description</span>
                <span className="col-span-4 text-right">Base HT (FCFA)</span>
                <span className="col-span-2 text-center">Taux</span>
                <span className="col-span-1 text-right">TVA</span>
                <span className="col-span-1"></span>
            </div>
            <div className="space-y-2 mb-4">
                {lignes.map((l, i) => {
                    const { tva } = calcTVA(l.ht, l.taux);
                    return (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center text-sm">
                            <input
                                className="col-span-4 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                                value={l.label}
                                placeholder="Description"
                                onChange={(e) => {
                                    const arr = [...lignes]; arr[i] = { ...l, label: e.target.value }; onChange(arr);
                                }}
                            />
                            <div className="col-span-4">
                                <AmountInput
                                    value={l.ht}
                                    onChange={(v) => {
                                        const arr = [...lignes]; arr[i] = { ...l, ht: v }; onChange(arr);
                                    }}
                                />
                            </div>
                            <span className="col-span-2 text-xs text-center bg-gray-100 text-gray-600 rounded px-1 py-1 font-medium">
                                {(l.taux * 100).toFixed(0)} %
                            </span>
                            <span className="col-span-1 text-xs text-gray-700 font-mono text-right whitespace-nowrap">
                                {tva > 0 ? fmtN(tva) : ' - '}
                            </span>
                            <button
                                onClick={() => onChange(lignes.filter((_, j) => j !== i))}
                                className="col-span-1 flex justify-end text-gray-400 hover:text-red-500"
                            ><X className="w-3.5 h-3.5" /></button>
                        </div>
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <Btn size="sm" variant="outline"
                    onClick={() => onChange([...lignes, { label: '', ht: 0, taux: 0.18, type_op: typeOp }])}>
                    + Ajouter
                </Btn>
                <Btn size="sm" variant="outline"
                    onClick={() => onChange([...lignes, { label: 'Hôtellerie/transport', ht: 0, taux: 0.10, type_op: typeOp }])}>
                    + 10 %
                </Btn>
                <div className="flex-1" />
                {/* Import CSV/Excel */}
                <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2 py-1.5 hover:bg-blue-50 transition-colors"
                    title="Télécharger le modèle CSV"
                >
                    <Download className="w-3.5 h-3.5" /> Modèle CSV
                </button>
                <label
                    className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 border border-green-200 rounded-lg px-2 py-1.5 hover:bg-green-50 cursor-pointer transition-colors"
                    title="Importer un fichier CSV ou Excel"
                >
                    <Upload className="w-3.5 h-3.5" /> Importer
                    <input
                        ref={importRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.ods,.txt"
                        className="hidden"
                        onChange={handleImport}
                    />
                </label>
            </div>
            {importErr && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{importErr}</p>
            )}
        </Card>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour accéder au module TVA.</p>
            </div>
        </div>
    );
}

