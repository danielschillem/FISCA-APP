import { useState } from 'react';
import { calculApi } from '../lib/api';
import { calcIS, calcMFP, fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Lock } from 'lucide-react';

type Regime = 'reel' | 'simplifie';

export default function ISPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('is')) return <Locked />;
    return <ISContent />;
}

function ISContent() {
    const [ca, setCa] = useState(500_000_000);
    const [benefice, setBenefice] = useState(50_000_000);
    const [regime, setRegime] = useState<Regime>('reel');
    const [cga, setCga] = useState(false);
    const [result, setResult] = useState<{
        isTheorique: number; mfpDu: number; mfpMinimum: number; dû: number; mode: string;
    } | null>(null);
    const [saving, setSaving] = useState(false);

    const calc = () => {
        const isRes = calcIS(benefice, cga);
        const mfpRes = calcMFP(ca, regime, cga);
        const dû = Math.max(isRes.is, mfpRes.mfpDu);
        setResult({
            isTheorique: isRes.is,
            mfpDu: mfpRes.mfpDu,
            mfpMinimum: mfpRes.mfpMinimum,
            dû,
            mode: isRes.is >= mfpRes.mfpDu ? 'IS théorique' : 'MFP (minimum)',
        });
    };

    const save = async () => {
        if (!result) return;
        setSaving(true);
        try {
            await calculApi.is({ ca, benefice, regime, cga });
            await calculApi.mfp({ ca, regime });
        } catch { /* ignore */ } finally { setSaving(false); }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <Card title="IS / MFP — Impôt sur les Sociétés / Minimum Forfaitaire Patronal">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 — Art. 42 (IS 27,5 %) · Art. 40 (MFP 0,5 % du CA)</p>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-2">Régime fiscal</label>
                        <div className="flex gap-3">
                            {[
                                { v: 'reel', l: 'Régime du réel' },
                                { v: 'simplifie', l: 'Régime simplifié' },
                            ].map(({ v, l }) => (
                                <label key={v} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="regime" value={v} checked={regime === v}
                                        onChange={() => setRegime(v as Regime)} className="accent-green-600" />
                                    <span className="text-sm text-gray-700">{l}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Chiffre d'affaires HT (FCFA)</label>
                        <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Bénéfice imposable (FCFA)</label>
                        <input type="number" value={benefice} onChange={(e) => setBenefice(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={cga} onChange={(e) => setCga(e.target.checked)} className="accent-green-600" />
                        <span className="text-sm text-gray-700">Adhérent CGA (réduction IS)</span>
                    </label>
                </div>

                <div className="flex gap-2 mt-4">
                    <Btn onClick={calc}>Calculer</Btn>
                    {result && <Btn variant="outline" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Enregistrer</>}</Btn>}
                </div>
            </Card>

            {result && (
                <Card title="Résultat IS / MFP">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-blue-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500">IS théorique (27,5 %)</p>
                            <p className="text-lg font-bold text-blue-700">{fmt(result.isTheorique)}</p>
                            {cga && <p className="text-xs text-green-600 mt-1">Après réduction CGA (−30 %)</p>}
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500">MFP minimum (0,5 % CA)</p>
                            <p className="text-lg font-bold text-orange-700">{fmt(result.mfpDu)}</p>
                            <p className="text-xs text-gray-400">Plancher : {fmt(result.mfpMinimum)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-900 text-white rounded-xl p-4">
                        <p className="text-xs text-gray-400">Impôt dû ({result.mode})</p>
                        <p className="text-2xl font-bold">{fmt(result.dû)}</p>
                        <p className="text-xs text-gray-400 mt-1">= max(IS théorique, MFP minimum)</p>
                    </div>
                </Card>
            )}

            <Card title="Base légale">
                <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Art. 42 CGI 2025 : IS au taux de 27,5 % du bénéfice net imposable</li>
                    <li>• Art. 40 : MFP = 0,5 % du chiffre d'affaires (minimum garanti)</li>
                    <li>• L'impôt dû est le maximum entre IS théorique et MFP</li>
                    <li>• Déclaration et paiement : avant le 30 avril de l'année suivante</li>
                    <li>• Acomptes trimestriels de 25 % du dernier IS payé</li>
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
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour accéder au module IS / MFP.</p>
            </div>
        </div>
    );
}
