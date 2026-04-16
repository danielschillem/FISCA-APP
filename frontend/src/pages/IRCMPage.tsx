import { useState } from 'react';
import { calculApi } from '../lib/api';
import { calcIRCM, fmt } from '../lib/fiscalCalc';
import { Card, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Lock } from 'lucide-react';

type IRCMType = 'CREANCES' | 'OBLIGATIONS' | 'DIVIDENDES';

const TYPES: { value: IRCMType; label: string; taux: number; desc: string }[] = [
    { value: 'CREANCES', label: 'Créances & dépôts', taux: 25, desc: 'Intérêts de prêts, comptes courants, dépôts' },
    { value: 'OBLIGATIONS', label: 'Obligations & bons', taux: 6, desc: 'Intérêts d\'obligations, bons du trésor' },
    { value: 'DIVIDENDES', label: 'Dividendes & parts', taux: 12.5, desc: 'Distributions de bénéfices, parts sociales' },
];

export default function IRCMPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('ircm')) return <Locked />;
    return <IRCMContent />;
}

function IRCMContent() {
    const [type, setType] = useState<IRCMType>('CREANCES');
    const [montant, setMontant] = useState(1000000);
    const [result, setResult] = useState<ReturnType<typeof calcIRCM> | null>(null);
    const [saving, setSaving] = useState(false);

    const selected = TYPES.find((t) => t.value === type)!;

    const calc = () => setResult(calcIRCM(montant, type));

    const save = async () => {
        if (!result) return;
        setSaving(true);
        try {
            await calculApi.ircm({ montant_brut: montant, type_revenu: type });
        } catch { /* ignore */ } finally { setSaving(false); }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <Card title="IRCM — Impôt sur les Revenus des Capitaux Mobiliers">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 — Art. 140-156 · Retenue libératoire à la source</p>

                <div className="grid grid-cols-1 gap-3 mb-4">
                    {TYPES.map((t) => (
                        <label key={t.value}
                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${type === t.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" name="ircm-type" value={t.value}
                                checked={type === t.value} onChange={() => setType(t.value)}
                                className="mt-0.5 accent-green-600" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">{t.label} — <span className="text-green-700">{t.taux} %</span></p>
                                <p className="text-xs text-gray-500">{t.desc}</p>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Montant brut des revenus (FCFA)</label>
                    <input
                        type="number"
                        value={montant}
                        onChange={(e) => setMontant(+e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    />
                </div>

                <div className="flex gap-2">
                    <Btn onClick={calc}>Calculer</Btn>
                    {result && <Btn variant="outline" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Enregistrer</>}</Btn>}
                </div>
            </Card>

            {result && (
                <Card title="Résultat IRCM">
                    <div className="space-y-2">
                        {[
                            { l: 'Revenu brut', v: result.brut },
                            { l: `IRCM (${(result.taux * 100).toFixed(1)} %)`, v: -result.ircm },
                            { l: 'Net versé', v: result.net },
                        ].map(({ l, v }) => (
                            <div key={l} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">{l}</span>
                                <span className={`font-medium ${v < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {v < 0 ? `- ${fmt(-v)}` : fmt(v)}
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">IRCM dû</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.ircm)}</span>
                        </div>
                    </div>
                </Card>
            )}

            <Card title="Base légale">
                <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Art. 140 CGI 2025 : Sont imposables les revenus des capitaux mobiliers</li>
                    <li>• Art. 143 : Créances & dépôts — Taux 25 %</li>
                    <li>• Art. 144 : Obligations & bons — Taux 6 %</li>
                    <li>• Art. 145 : Dividendes — Taux 12,5 %</li>
                    <li>• Retenue à la source opérée par le débiteur lors du paiement</li>
                </ul>
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
                <p className="text-gray-500 text-sm">Passez au plan Pro pour accéder au module IRCM.</p>
            </div>
        </div>
    );
}
