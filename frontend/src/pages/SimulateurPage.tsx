import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calcEmploye, calcIS, calcMFP, calcCME, calcPatente, CME_CA_PLAFOND, fmt, fmtN } from '../lib/fiscalCalc';
import { simulationApi } from '../lib/api';
import { Card, Input, Select, Btn, NumericInput } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Lock, TrendingUp, BarChart2, Save, FolderOpen, Trash2, Layers, Check, X } from 'lucide-react';

const MOIS_PROJ = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function SimulateurPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('simulateur')) {
        return <Locked />;
    }
    return <SimContent />;
}

type ScenInput = {
    label: string;
    salaire_base: number; anciennete: number; logement: number;
    transport: number; fonction: number; charges: number;
    categorie: 'Cadre' | 'Non-cadre';
    /** CARFO conservé pour compat. données sauvegardées ; scénarios ne l’exposent pas dans l’UI. */
    cotisation: 'CNSS' | 'CARFO';
};

const defaultInput = (label: string): ScenInput => ({
    label, salaire_base: 250000, anciennete: 12500, logement: 50000,
    transport: 25000, fonction: 0, charges: 2,
    categorie: 'Non-cadre', cotisation: 'CNSS',
});

function SimContent() {
    const qc = useQueryClient();
    const [mode, setMode] = useState<'simulateur' | 'projection' | 'regimes'>('simulateur');
    const [a, setA] = useState<ScenInput>(defaultInput('Scénario A'));
    const [b, setB] = useState<ScenInput>({ ...defaultInput('Scénario B'), categorie: 'Cadre', salaire_base: 350000 });
    const [showAB, setShowAB] = useState(false);
    const [showSaved, setShowSaved] = useState(false);

    const rA = calcEmploye({ ...a, heures_sup: 0 });
    const rB = calcEmploye({ ...b, heures_sup: 0 });

    const { data: savedSims = [] } = useQuery<{ id: string; label: string; input_data: ScenInput; result_data: object; created_at: string }[]>({
        queryKey: ['simulations'],
        queryFn: () => simulationApi.list().then((r) => r.data),
    });

    const saveMut = useMutation({
        mutationFn: (s: ScenInput) => simulationApi.create({
            label: s.label || 'Simulation',
            input_data: s,
            result_data: calcEmploye({ ...s, heures_sup: 0 }),
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['simulations'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => simulationApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['simulations'] }),
    });

    // Projection annuelle : 12 mois avec le même scénario A
    const projections = useMemo(() => {
        return MOIS_PROJ.map((moisLabel) => {
            const r = calcEmploye({ ...a, heures_sup: 0 });
            return {
                mois: moisLabel,
                iuts: r.iutsNet,
                css: r.cotSoc,
                net: r.netAPayer,
                cout: r.remBrute + r.tpa,
            };
        });
    }, [a]);

    const totaux = useMemo(() => projections.reduce(
        (acc, m) => ({ iuts: acc.iuts + m.iuts, css: acc.css + m.css, net: acc.net + m.net, cout: acc.cout + m.cout }),
        { iuts: 0, css: 0, net: 0, cout: 0 }
    ), [projections]);

    return (
        <div className="space-y-6">
            {/* Onglets */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setMode('simulateur')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'simulateur' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <BarChart2 className="w-4 h-4" /> Simulateur
                </button>
                <button
                    onClick={() => setMode('projection')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'projection' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <TrendingUp className="w-4 h-4" /> Projection 12 mois
                </button>
                <button
                    onClick={() => setMode('regimes')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'regimes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Layers className="w-4 h-4" /> Régimes fiscaux
                </button>
            </div>

            {mode === 'simulateur' ? (
                <> {/* simulateur block */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Btn variant="outline" onClick={() => setShowSaved(!showSaved)}>
                            <FolderOpen className="w-4 h-4" /> {showSaved ? 'Masquer sauvegardes' : `Sauvegardes (${savedSims.length})`}
                        </Btn>
                        <Btn variant="outline" onClick={() => saveMut.mutate(a)} disabled={saveMut.isPending}>
                            <Save className="w-4 h-4" /> Sauvegarder A
                        </Btn>
                        {showAB && (
                            <Btn variant="outline" onClick={() => saveMut.mutate(b)} disabled={saveMut.isPending}>
                                <Save className="w-4 h-4" /> Sauvegarder B
                            </Btn>
                        )}
                        <Btn variant="outline" onClick={() => setShowAB(!showAB)}>
                            {showAB ? '← Mode simple' : 'Comparer A vs B'}
                        </Btn>
                    </div>

                    {/* Saved simulations panel */}
                    {showSaved && savedSims.length > 0 && (
                        <Card title="Simulations sauvegardées">
                            <div className="space-y-2">
                                {savedSims.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                                        <span className="font-medium text-gray-800">{s.label}</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setA({ ...s.input_data, label: s.label })}
                                                className="text-xs text-blue-600 hover:underline font-medium"
                                            >Charger → A</button>
                                            {showAB && (
                                                <button
                                                    onClick={() => setB({ ...s.input_data, label: s.label })}
                                                    className="text-xs text-purple-600 hover:underline font-medium"
                                                >Charger → B</button>
                                            )}
                                            <button
                                                onClick={() => deleteMut.mutate(s.id)}
                                                className="text-gray-400 hover:text-red-500"
                                            ><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    <div className={`grid gap-6 ${showAB ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 max-w-2xl'}`}>
                        <ScenarioPanel label="Scénario A" s={a} setS={setA} r={rA} />
                        {showAB && <ScenarioPanel label="Scénario B" s={b} setS={setB} r={rB} />}
                    </div>

                    {showAB && (
                        <Card title="Comparaison A vs B">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                            <th className="text-left py-2 px-4">Indicateur</th>
                                            <th className="text-right py-2 px-4">Scénario A</th>
                                            <th className="text-right py-2 px-4">Scénario B</th>
                                            <th className="text-right py-2 px-4">Différence</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {[
                                            ['Brut total', rA.remBrute, rB.remBrute],
                                            ['IUTS net', rA.iutsNet, rB.iutsNet],
                                            ['Cotisation sociale', rA.cotSoc, rB.cotSoc],
                                            ['Net à payer', rA.netAPayer, rB.netAPayer],
                                            ['TPA employeur', rA.tpa, rB.tpa],
                                            ['Coût total employeur', rA.remBrute + rA.tpa, rB.remBrute + rB.tpa],
                                        ].map(([l, va, vb]) => {
                                            const delta = (vb as number) - (va as number);
                                            return (
                                                <tr key={String(l)} className="hover:bg-gray-50">
                                                    <td className="py-2 px-4 text-gray-700">{l}</td>
                                                    <td className="py-2 px-4 text-right font-medium">{fmtN(va as number)}</td>
                                                    <td className="py-2 px-4 text-right font-medium">{fmtN(vb as number)}</td>
                                                    <td className={`py-2 px-4 text-right font-bold ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                        {delta > 0 ? '+' : ''}{fmtN(delta)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </>
            ) : mode === 'projection' ? (
                /* Projection annuelle */
                <>
                    <div className="max-w-2xl">
                        <ScenarioPanel label="Paramètres du salarié" s={a} setS={setA} r={rA} />
                    </div>

                    {/* KPI annuels */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                            { l: 'IUTS annuel total', v: totaux.iuts, c: 'bg-green-50 text-green-700' },
                            { l: 'Cotisations annuelles', v: totaux.css, c: 'bg-indigo-50 text-indigo-700' },
                            { l: 'Net annuel versé', v: totaux.net, c: 'bg-blue-50 text-blue-700' },
                            { l: 'Coût employeur total', v: totaux.cout, c: 'bg-orange-50 text-orange-700' },
                        ].map(({ l, v, c }) => (
                            <div key={l} className={`${c} rounded-xl p-4`}>
                                <p className="text-xs text-gray-500">{l}</p>
                                <p className="text-lg font-bold">{fmt(v)}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">≈ {fmt(v / 12)} / mois</p>
                            </div>
                        ))}
                    </div>

                    <Card title="Projection mensuelle : 12 mois">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                        <th className="text-left py-2 px-3">Mois</th>
                                        <th className="text-right py-2 px-3">IUTS</th>
                                        <th className="text-right py-2 px-3">Cotis. soc.</th>
                                        <th className="text-right py-2 px-3">Net à payer</th>
                                        <th className="text-right py-2 px-3">Coût employeur</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {projections.map((p) => (
                                        <tr key={p.mois} className="hover:bg-gray-50">
                                            <td className="py-2.5 px-3 font-medium text-gray-700">{p.mois}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs text-green-700">{fmtN(p.iuts)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(p.css)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs text-blue-700">{fmtN(p.net)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs text-orange-700 font-semibold">{fmtN(p.cout)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold border-t-2 border-gray-200 bg-gray-50">
                                        <td className="py-2.5 px-3 text-gray-900">Total annuel</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-xs text-green-700">{fmtN(totaux.iuts)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(totaux.css)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-xs text-blue-700">{fmtN(totaux.net)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-xs text-orange-700">{fmtN(totaux.cout)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-3">Projection basée sur un salaire fixe sans variation annuelle.</p>
                    </Card>
                </>
            ) : (
                /* Régimes fiscaux */
                <RegimesFiscauxPanel />
            )}
        </div>
    );
}

function ScenarioPanel({ label, s, setS, r }: {
    label: string;
    s: ScenInput;
    setS: (v: ScenInput) => void;
    r: ReturnType<typeof calcEmploye>;
}) {
    const field = (key: keyof ScenInput, labelStr: string) => (
        <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">{labelStr}</label>
            <div className="relative">
                <NumericInput
                    value={Number(s[key])}
                    onChange={(v) => setS({ ...s, [key]: v })}
                    className="pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">FCFA</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <Card title={label}>
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <Select
                            label="Catégorie"
                            options={[{ value: 'Non-cadre', label: 'Non-cadre (abatt. 25 %)' }, { value: 'Cadre', label: 'Cadre (abatt. 20 %)' }]}
                            value={s.categorie}
                            onChange={(e) => setS({ ...s, categorie: e.target.value as ScenInput['categorie'] })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Charges</label>
                        <input type="number" min={0} max={4} value={s.charges}
                            onChange={(e) => setS({ ...s, charges: +e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    {field('salaire_base', 'Salaire de base')}
                    {field('anciennete', 'Ancienneté')}
                    {field('logement', 'Ind. logement')}
                    {field('transport', 'Ind. transport')}
                    {field('fonction', 'Ind. fonction')}
                </div>
            </Card>

            <Card title="Résultat">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { l: 'Brut', v: r.remBrute, c: 'bg-gray-50 text-gray-900' },
                        { l: 'IUTS net', v: r.iutsNet, c: 'bg-green-50 text-green-700' },
                        { l: 'Net à payer', v: r.netAPayer, c: 'bg-blue-50 text-blue-700' },
                        { l: `Taux eff. IUTS`, v: `${r.tauxEffectif.toFixed(1)} %`, c: 'bg-orange-50 text-orange-700', str: true },
                    ].map(({ l, v, c, str }) => (
                        <div key={l} className={`${c} rounded-xl p-3`}>
                            <p className="text-xs text-gray-500">{l}</p>
                            <p className="text-base font-bold">{str ? v : fmt(v as number)}</p>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function RegimesFiscauxPanel() {
    const [ca, setCa] = useState(10_000_000);
    const [benefice, setBenefice] = useState(2_000_000);
    const [valeurLocative, setValeurLocative] = useState(600_000);
    const [zone, setZone] = useState<'A' | 'B' | 'C' | 'D'>('A');
    const [cga, setCga] = useState(false);

    const cmeResult = calcCME(ca, zone, cga);
    const isResult = calcIS(benefice, cga);
    const mfpRNI = calcMFP(ca, 'reel', cga);
    const mfpRSI = calcMFP(ca, 'simplifie', cga);
    const patente = calcPatente(ca, valeurLocative);

    // Totaux par régime
    const totalCME = cmeResult ? cmeResult.cmeNet : null;
    const totalRNI = Math.max(isResult.is, mfpRNI.mfpDu) + patente.totalPatente;
    const totalRSI = mfpRSI.mfpDu + patente.totalPatente;

    const minimum = Math.min(
        ...[totalCME, totalRNI, totalRSI].filter((v): v is number => v !== null)
    );

    const highlight = (val: number | null) =>
        val !== null && val === minimum
            ? 'bg-green-50 text-green-800 font-bold ring-2 ring-green-400 ring-inset rounded-lg'
            : 'text-gray-700';

    return (
        <div className="space-y-6">
            {/* Inputs */}
            <Card title="Paramètres de l'entreprise">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Chiffre d'affaires HT</label>
                        <div className="relative">
                            <NumericInput value={ca} onChange={setCa} className="pr-14" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">FCFA</span>
                        </div>
                        {ca > CME_CA_PLAFOND && (
                            <p className="text-[11px] text-amber-600">CA &gt; 15 M — régime CME inaccessible</p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Bénéfice imposable</label>
                        <div className="relative">
                            <NumericInput value={benefice} onChange={setBenefice} className="pr-14" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">FCFA</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Valeur locative annuelle</label>
                        <div className="relative">
                            <NumericInput value={valeurLocative} onChange={setValeurLocative} className="pr-14" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">FCFA</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Zone CME</label>
                        <div className="flex gap-2">
                            {(['A', 'B', 'C', 'D'] as const).map((z) => (
                                <button
                                    key={z}
                                    onClick={() => setZone(z)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${zone === z ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}
                                >
                                    {z}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                        <input
                            id="cga-toggle"
                            type="checkbox"
                            checked={cga}
                            onChange={(e) => setCga(e.target.checked)}
                            className="w-4 h-4 accent-green-600"
                        />
                        <label htmlFor="cga-toggle" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                            Adhésion CGA (réduction fiscale)
                        </label>
                    </div>
                </div>
            </Card>

            {/* Tableau comparatif */}
            <Card title="Comparaison des régimes fiscaux">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                <th className="text-left py-3 px-4">Composante</th>
                                <th className="text-right py-3 px-4">
                                    <span className={`inline-flex items-center justify-end gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${totalCME === minimum && totalCME !== null ? 'bg-green-600 text-white' : 'bg-purple-100 text-purple-700'}`}>
                                        CME
                                        {ca > CME_CA_PLAFOND && <X className="w-3 h-3 shrink-0" aria-hidden />}
                                    </span>
                                </th>
                                <th className="text-right py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${totalRNI === minimum ? 'bg-green-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                        RNI (IS/MFP)
                                    </span>
                                </th>
                                <th className="text-right py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${totalRSI === minimum ? 'bg-green-600 text-white' : 'bg-orange-100 text-orange-700'}`}>
                                        RSI (simplifié)
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            <tr className="hover:bg-gray-50">
                                <td className="py-2.5 px-4 text-gray-600">Impôt principal</td>
                                <td className="py-2.5 px-4 text-right font-mono text-xs">
                                    {totalCME !== null ? fmtN(cmeResult!.cmeNet) : <span className="text-gray-400">N/A</span>}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono text-xs">{fmtN(Math.max(isResult.is, mfpRNI.mfpDu))}</td>
                                <td className="py-2.5 px-4 text-right font-mono text-xs">{fmtN(mfpRSI.mfpDu)}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                                <td className="py-2.5 px-4 text-gray-600">Patente</td>
                                <td className="py-2.5 px-4 text-right font-mono text-xs text-gray-400">—</td>
                                <td className="py-2.5 px-4 text-right font-mono text-xs">{fmtN(patente.totalPatente)}</td>
                                <td className="py-2.5 px-4 text-right font-mono text-xs">{fmtN(patente.totalPatente)}</td>
                            </tr>
                            <tr className="border-t-2 border-gray-200 font-semibold">
                                <td className="py-3 px-4 text-gray-900">Total fiscal estimé</td>
                                <td className={`py-3 px-4 text-right font-mono text-sm ${highlight(totalCME)}`}>
                                    {totalCME !== null ? fmtN(totalCME) : <span className="text-gray-400 text-xs font-normal">Hors plafond</span>}
                                </td>
                                <td className={`py-3 px-4 text-right font-mono text-sm ${highlight(totalRNI)}`}>{fmtN(totalRNI)}</td>
                                <td className={`py-3 px-4 text-right font-mono text-sm ${highlight(totalRSI)}`}>{fmtN(totalRSI)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                {minimum !== Infinity && (
                    <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <Check className="w-4 h-4 text-green-600 shrink-0" strokeWidth={2.5} />
                        <span className="text-green-600 font-bold text-sm">Régime le plus avantageux :</span>
                        <span className="text-green-800 text-sm font-semibold">
                            {totalCME === minimum && totalCME !== null ? 'CME (Contribution des Micro-Entreprises)' :
                                totalRNI === minimum ? 'RNI — Réel Normal d\'Imposition (IS/MFP + Patente)' :
                                    'RSI — Réel Simplifié d\'Imposition (MFP + Patente)'}
                        </span>
                        <span className="ml-auto text-green-700 font-mono text-sm">{fmtN(minimum)} FCFA</span>
                    </div>
                )}
                <p className="text-[11px] text-gray-400 mt-3">
                    Estimation indicative CGI 2025. Consultez un expert-comptable pour votre choix de régime.
                    {cga && ' Réductions CGA appliquées.'}
                </p>
            </Card>

            {/* Détail patente */}
            <Card title="Détail Patente">
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Droit fixe</p>
                        <p className="font-bold text-gray-800 text-sm">{fmtN(patente.droitFixe)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Droit proportionnel (1 %)</p>
                        <p className="font-bold text-gray-800 text-sm">{fmtN(patente.droitProp)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Total Patente</p>
                        <p className="font-bold text-blue-700 text-sm">{fmtN(patente.totalPatente)}</p>
                    </div>
                </div>
            </Card>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour accéder au simulateur.</p>
            </div>
        </div>
    );
}

