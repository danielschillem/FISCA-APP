import { useState } from 'react';
import { calculApi } from '../lib/api';
import { calcPatente, fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Save, Lock } from 'lucide-react';

export default function PatentePage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('patente')) return <Locked />;
    return <PatenteContent />;
}

function PatenteContent() {
    const [ca, setCa] = useState(100_000_000);
    const [valeurLocative, setValeurLocative] = useState(2_400_000);
    const [result, setResult] = useState<ReturnType<typeof calcPatente> | null>(null);
    const [saving, setSaving] = useState(false);

    const calc = () => setResult(calcPatente(ca, valeurLocative));

    const save = async () => {
        if (!result) return;
        setSaving(true);
        try {
            await calculApi.patente({ ca, valeur_locative: valeurLocative });
        } catch { /* ignore */ } finally { setSaving(false); }
    };

    // Tableau des droits fixes (Art. 238 CGI 2025)
    const DROITS_FIXES = [
        { tranche: 'CA < 30 M', droit: 30_000 },
        { tranche: '30 M – 60 M', droit: 75_000 },
        { tranche: '60 M – 100 M', droit: 150_000 },
        { tranche: '100 M – 200 M', droit: 250_000 },
        { tranche: '200 M – 500 M', droit: 500_000 },
        { tranche: '500 M – 1 Md', droit: 1_000_000 },
        { tranche: '> 1 Md', droit: 2_000_000 },
    ];

    return (
        <div className="max-w-2xl space-y-6">
            <Card title="Patente Professionnelle">
                <p className="text-xs text-gray-500 mb-4">CGI 2025 — Art. 237-240 · Droit fixe + 1 % valeur locative professionnelle</p>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Chiffre d'affaires annuel HT (FCFA)</label>
                        <input type="number" value={ca} onChange={(e) => setCa(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Valeur locative annuelle des locaux (FCFA)</label>
                        <input type="number" value={valeurLocative} onChange={(e) => setValeurLocative(+e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                        <p className="text-[11px] text-gray-400 mt-1">= Loyer mensuel × 12 si locataire</p>
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <Btn onClick={calc}>Calculer</Btn>
                    {result && <Btn variant="outline" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Enregistrer</>}</Btn>}
                </div>
            </Card>

            {result && (
                <Card title="Résultat Patente">
                    <div className="space-y-2">
                        {[
                            { l: 'Droit fixe (tableau A)', v: result.droitFixe },
                            { l: 'Droit proportionnel (1 % VL)', v: result.droitProp },
                        ].map(({ l, v }) => (
                            <div key={l} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                <span className="text-gray-600">{l}</span>
                                <span className="font-medium">{fmt(v)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between py-3 mt-1">
                            <span className="font-bold text-gray-900">Patente totale</span>
                            <span className="font-bold text-xl text-red-700">{fmt(result.totalPatente)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">CA : {fmtN(result.ca)} FCFA</p>
                </Card>
            )}

            <Card title="Tableau des droits fixes (Art. 238 CGI 2025)">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-gray-500 border-b border-gray-100">
                                <th className="text-left py-2">Tranche de CA</th>
                                <th className="text-right py-2">Droit fixe (FCFA)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {DROITS_FIXES.map((d) => (
                                <tr key={d.tranche} className={`hover:bg-gray-50 ${ca >= 0 && calcPatente(ca, 0).droitFixe === d.droit ? 'bg-green-50 font-semibold' : ''}`}>
                                    <td className="py-2 text-gray-700">{d.tranche}</td>
                                    <td className="py-2 text-right font-mono">{fmtN(d.droit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="Base légale">
                <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Art. 237 CGI 2025 : Toute personne physique ou morale exerçant une activité commerciale</li>
                    <li>• Art. 238 : Droit fixe selon le tableau A (fonction du CA)</li>
                    <li>• Art. 239 : Droit proportionnel = 1 % de la valeur locative des locaux professionnels</li>
                    <li>• Art. 240 : Paiement avant le 31 mars de l'année d'imposition</li>
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
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour accéder au module Patentes.</p>
            </div>
        </div>
    );
}
