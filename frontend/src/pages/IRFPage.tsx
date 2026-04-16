import { useState } from 'react';
import { calculApi } from '../lib/api';
import { calcIRF, fmt } from '../lib/fiscalCalc';
import { Card, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';

export default function IRFPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('irf')) return <Locked />;
    return <IRFContent />;
}

function IRFContent() {
    const [loyerBrut, setLoyerBrut] = useState(500000);
    const [result, setResult] = useState<ReturnType<typeof calcIRF> | null>(null);
    const [saving, setSaving] = useState(false);

    const calc = () => setResult(calcIRF(loyerBrut));

    const save = async () => {
        if (!result) return;
        setSaving(true);
        try { await calculApi.irf({ loyer_brut: loyerBrut }); } catch { } finally { setSaving(false); }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <Card title="IRF - Impot sur les Revenus Fonciers">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 - Art. 121-126 - Abattement 50 % - Taux progressif 18 % / 25 %</p>
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Loyer brut annuel (FCFA)</label>
                    <input type="number" value={loyerBrut} onChange={(e) => setLoyerBrut(+e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                </div>
                <div className="flex gap-2">
                    <Btn onClick={calc}>Calculer</Btn>
                    {result && <Btn variant="outline" onClick={save} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Btn>}
                </div>
            </Card>

            {result && (
                <Card title="Resultat IRF">
                    <div className="space-y-2">
                        {[
                            { l: 'Loyer brut', v: fmt(result.loyerBrut) },
                            { l: 'Abattement 50 %', v: fmt(result.abattement) },
                            { l: 'Base nette imposable', v: fmt(result.baseNette) },
                            { l: 'IRF tranche 18 % (100 000)', v: fmt(result.irf1) },
                            { l: 'IRF tranche 25 % (>100 000)', v: fmt(result.irf2) },
                            { l: 'Loyer net', v: fmt(result.loyerNet) },
                        ].map(({ l, v }) => (
                            <div key={l} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">{l}</span>
                                <span className="font-medium">{v}</span>
                            </div>
                        ))}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">IRF total du ({result.tauxEffectif} % effectif)</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.irfTotal)}</span>
                        </div>
                    </div>
                </Card>
            )}

            <Card title="Base legale">
                <ul className="text-xs text-gray-500 space-y-1">
                    <li>Art. 121 CGI 2025 : revenus provenant de la location d&apos;immeubles</li>
                    <li>Art. 122 : Abattement forfaitaire de 50 % sur le loyer brut</li>
                    <li>Art. 124 : Taux progressif 18 % jusqu&apos;a 100 000 FCFA base nette, 25 % au-dela</li>
                    <li>Declaration annuelle avant le 30 avril</li>
                </ul>
            </Card>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="text-5xl mb-4">lock</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalite <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour acceder au module IRF.</p>
            </div>
        </div>
    );
}