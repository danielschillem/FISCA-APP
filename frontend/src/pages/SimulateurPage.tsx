import { useState, useMemo } from 'react';
import { calcEmploye, calcIRF, calcIRCM, calcCME, calcPatente, calcMFP, calcIS, fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Input, Select, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Lock, TrendingUp, BarChart2 } from 'lucide-react';

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
    categorie: 'Cadre' | 'Non-cadre'; cotisation: 'CNSS' | 'CARFO';
};

const defaultInput = (label: string): ScenInput => ({
    label, salaire_base: 250000, anciennete: 12500, logement: 50000,
    transport: 25000, fonction: 0, charges: 2,
    categorie: 'Non-cadre', cotisation: 'CNSS',
});

function SimContent() {
    const [mode, setMode] = useState<'simulateur' | 'projection'>('simulateur');
    const [a, setA] = useState<ScenInput>(defaultInput('Scénario A'));
    const [b, setB] = useState<ScenInput>({ ...defaultInput('Scénario B'), categorie: 'Cadre', salaire_base: 350000 });
    const [showAB, setShowAB] = useState(false);

    const rA = calcEmploye({ ...a, heures_sup: 0 });
    const rB = calcEmploye({ ...b, heures_sup: 0 });

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
            </div>

            {mode === 'simulateur' ? (
                <>
                    <div className="flex justify-end">
                        <Btn variant="outline" onClick={() => setShowAB(!showAB)}>
                            {showAB ? '← Mode simple' : 'Comparer A vs B'}
                        </Btn>
                    </div>

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
            ) : (
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

                    <Card title="Projection mensuelle — 12 mois">
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
        <Input
            label={labelStr}
            type="number"
            value={String(s[key])}
            onChange={(e) => setS({ ...s, [key]: +e.target.value })}
            suffix="FCFA"
        />
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

