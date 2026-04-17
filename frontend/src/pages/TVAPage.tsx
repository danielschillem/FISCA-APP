import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tvaApi, companyApi } from '../lib/api';
import { calcTVA, fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import type { TVADeclaration, Company } from '../types';
import { generateTVAForm } from '../lib/pdfDGI';
import { usePaymentGate } from '../components/PaymentModal';
import { Save, X, Lock, FileText } from 'lucide-react';

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
        { label: 'Ventes produits', ht: 2500000, taux: 0.18, type_op: 'vente' },
        { label: 'Prestations services', ht: 800000, taux: 0.18, type_op: 'vente' },
    ]);
    const [deductible, setDeductible] = useState<LigneLocal[]>([
        { label: 'Achats matières premières', ht: 1200000, taux: 0.18, type_op: 'achat' },
        { label: 'Charges locatives', ht: 300000, taux: 0.18, type_op: 'achat' },
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
                        montant_ht: l.ht, taux_tva: l.taux,
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
                                                        onClick={() => requestPayment('tva', d.id, () => generateTVAForm(d, company))}
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
                <p className="text-xs text-gray-500 mb-3">Référence légale : CGI 2025 : Art. 317 · Taux standard 18 % · Hôtellerie/restauration 10 %</p>
                <div className="text-xs text-gray-400 space-y-1">
                    <p>• Seuil d'assujettissement : CA ≥ 50 000 000 FCFA/an</p>
                    <p>• Déclaration mensuelle, paiement avant le 15 du mois suivant</p>
                    <p>• Crédit TVA : reportable sur les mois suivants ou remboursable</p>
                </div>
            </Card>
        </div>
    );
}

function LignesPanel({
    title, lignes, onChange, typeOp,
}: { title: string; lignes: LigneLocal[]; onChange: (l: LigneLocal[]) => void; typeOp: 'vente' | 'achat' }) {
    return (
        <Card title={title}>
            <div className="space-y-2 mb-4">
                {lignes.map((l, i) => {
                    const { tva } = calcTVA(l.ht, l.taux);
                    return (
                        <div key={i} className="grid grid-cols-5 gap-2 items-center text-sm">
                            <input
                                className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                                value={l.label}
                                onChange={(e) => {
                                    const arr = [...lignes]; arr[i] = { ...l, label: e.target.value }; onChange(arr);
                                }}
                            />
                            <input
                                type="number"
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                                value={l.ht}
                                onChange={(e) => {
                                    const arr = [...lignes]; arr[i] = { ...l, ht: +e.target.value }; onChange(arr);
                                }}
                            />
                            <span className="text-xs text-gray-500 text-right">{fmtN(tva)}</span>
                            <button
                                onClick={() => onChange(lignes.filter((_, j) => j !== i))}
                                className="text-gray-400 hover:text-red-500 text-xs text-right"
                            ><X className="w-3.5 h-3.5" /></button>
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-2">
                <Btn size="sm" variant="outline"
                    onClick={() => onChange([...lignes, { label: 'Nouvelle ligne', ht: 0, taux: 0.18, type_op: typeOp }])}>
                    + Ajouter
                </Btn>
                <Btn size="sm" variant="outline"
                    onClick={() => onChange([...lignes, { label: 'Hôtellerie/transport', ht: 0, taux: 0.10, type_op: typeOp }])}>
                    + 10 %
                </Btn>
            </div>
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

