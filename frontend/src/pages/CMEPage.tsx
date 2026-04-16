import { useState } from 'react';
import { calculApi } from '../lib/api';
import { calcCME, fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Lock } from 'lucide-react';

type Zone = 'A' | 'B' | 'C' | 'D';
const ZONES: { value: Zone; label: string; desc: string }[] = [
    { value: 'A', label: 'Zone A', desc: 'Ouagadougou, Bobo-Dioulasso' },
    { value: 'B', label: 'Zone B', desc: 'Villes secondaires (Koudougou, Ouahigouya…)' },
    { value: 'C', label: 'Zone C', desc: 'Autres centres urbains' },
    { value: 'D', label: 'Zone D', desc: 'Zones rurales et périurbaines' },
];

const CLASSES = [
    { max: 15_000_000, label: 'Classe 1 (< 15 M)' },
    { max: 25_000_000, label: 'Classe 2 (15–25 M)' },
    { max: 40_000_000, label: 'Classe 3 (25–40 M)' },
    { max: 60_000_000, label: 'Classe 4 (40–60 M)' },
    { max: 80_000_000, label: 'Classe 5 (60–80 M)' },
    { max: 100_000_000, label: 'Classe 6 (80–100 M)' },
    { max: 150_000_000, label: 'Classe 7 (100–150 M)' },
    { max: Infinity, label: 'Classe 8 (> 150 M)' },
];

export default function CMEPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('cme')) return <Locked />;
    return <CMEContent />;
}

function CMEContent() {
    const [ca, setCa] = useState(30_000_000);
    const [zone, setZone] = useState<Zone>('A');
    const [cga, setCga] = useState(false);
    const [result, setResult] = useState<ReturnType<typeof calcCME> | null>(null);
    const [saving, setSaving] = useState(false);

    const calc = () => setResult(calcCME(ca, zone, cga));

    const save = async () => {
        if (!result) return;
        setSaving(true);
        try {
            await calculApi.cme({ ca, zone, cga });
        } catch { /* ignore */ } finally { setSaving(false); }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <Card title="CME — Contribution des Micro-Entreprises">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 — Art. 533-542 · Régime simplifié pour CA ≤ 150 M FCFA</p>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Chiffre d'affaires annuel HT (FCFA)</label>
                        <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-2">Zone d'activité</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ZONES.map((z) => (
                                <label key={z.value} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${zone === z.value ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                    <input type="radio" value={z.value} checked={zone === z.value}
                                        onChange={() => setZone(z.value)} className="mt-0.5 accent-green-600" />
                                    <div>
                                        <p className="text-xs font-semibold text-gray-900">{z.label}</p>
                                        <p className="text-[11px] text-gray-500">{z.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={cga} onChange={(e) => setCga(e.target.checked)} className="accent-green-600" />
                        <span className="text-sm text-gray-700">Adhérent CGA (réduction 25 %)</span>
                    </label>
                </div>

                <div className="flex gap-2 mt-4">
                    <Btn onClick={calc}>Calculer</Btn>
                    {result && <Btn variant="outline" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Enregistrer</>}</Btn>}
                </div>
            </Card>

            {result && (
                <Card title="Résultat CME">
                    <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                            <span className="text-gray-600">Classe tarifaire</span>
                            <span className="font-medium">{CLASSES[result.classe - 1]?.label ?? `Classe ${result.classe}`}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                            <span className="text-gray-600">CME brute</span>
                            <span className="font-medium">{fmt(result.cme)}</span>
                        </div>
                        {cga && (
                            <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">Réduction CGA (−25 %)</span>
                                <span className="font-medium text-green-700">− {fmt(result.cme - result.cmeNet)}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">CME finale</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.cmeNet)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Zone {result.zone} · CA : {fmtN(result.ca)} FCFA</p>
                </Card>
            )}

            <Card title="Base légale">
                <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Art. 533 CGI 2025 : CME applicable aux micro-entreprises (CA ≤ 150 M)</li>
                    <li>• 8 classes tarifaires selon CA et zone géographique (A, B, C, D)</li>
                    <li>• Art. 537 : Réduction de 25 % pour les adhérents d'un CGA agréé</li>
                    <li>• Paiement annuel avant le 30 avril</li>
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
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-orange-600">Entreprise</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour accéder au module CME.</p>
            </div>
        </div>
    );
}
