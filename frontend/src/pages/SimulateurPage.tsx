import { useState } from 'react';
import { calcEmploye, calcIRF, calcIRCM, calcCME, calcPatente, calcMFP, calcIS, fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Input, Select, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Lock } from 'lucide-react';

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
    const [a, setA] = useState<ScenInput>(defaultInput('Scénario A'));
    const [b, setB] = useState<ScenInput>({ ...defaultInput('Scénario B'), categorie: 'Cadre', salaire_base: 350000 });
    const [showAB, setShowAB] = useState(false);

    const rA = calcEmploye({ ...a, heures_sup: 0 });
    const rB = calcEmploye({ ...b, heures_sup: 0 });

    return (
        <div className="space-y-6">
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

