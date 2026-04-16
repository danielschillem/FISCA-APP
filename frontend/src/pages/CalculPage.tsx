import { useState } from 'react';
import { calcEmploye, calcIRF, calcIRCM, calcCME, calcPatente, calcMFP, calcIS, fmt, fmtN, pct } from '../lib/fiscalCalc';
import { Card, Input, Select, Btn } from '../components/ui';
import { Briefcase, Home, TrendingUp, Store, Scroll, BookOpen, type LucideIcon } from 'lucide-react';

type Module = 'iuts' | 'irf' | 'ircm' | 'cme' | 'patente' | 'is';

const MODULES: { id: Module; label: string; Icon: LucideIcon }[] = [
    { id: 'iuts', label: 'IUTS / TPA / CNSS', Icon: Briefcase },
    { id: 'irf', label: 'IRF : Revenus Fonciers', Icon: Home },
    { id: 'ircm', label: 'IRCM : Capitaux Mob.', Icon: TrendingUp },
    { id: 'cme', label: 'CME : Micro-Entreprises', Icon: Store },
    { id: 'patente', label: 'Patentes', Icon: Scroll },
    { id: 'is', label: 'IS / MFP', Icon: BookOpen },
];

export default function CalculPage() {
    const [module, setModule] = useState<Module>('iuts');

    return (
        <div className="space-y-6">
            {/* Module tabs */}
            <div className="flex flex-wrap gap-2">
                {MODULES.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setModule(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${module === id
                            ? 'bg-green-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {module === 'iuts' && <IUTSCalc />}
            {module === 'irf' && <IRFCalc />}
            {module === 'ircm' && <IRCMCalc />}
            {module === 'cme' && <CMECalc />}
            {module === 'patente' && <PatenteCalc />}
            {module === 'is' && <ISCalc />}
        </div>
    );
}

// ─── IUTS Calculator ─────────────────────────────────────────
function IUTSCalc() {
    const [formStr, setFormStr] = useState<Record<string, string>>({
        salaire_base: '200000', anciennete: '10000', heures_sup: '0',
        logement: '50000', transport: '25000', fonction: '0',
    });
    const [form, setForm] = useState({
        charges: 2, categorie: 'Non-cadre', cotisation: 'CNSS',
    });

    const numForm = {
        ...form,
        salaire_base: parseFloat(formStr.salaire_base) || 0,
        anciennete: parseFloat(formStr.anciennete) || 0,
        heures_sup: parseFloat(formStr.heures_sup) || 0,
        logement: parseFloat(formStr.logement) || 0,
        transport: parseFloat(formStr.transport) || 0,
        fonction: parseFloat(formStr.fonction) || 0,
    };

    const r = calcEmploye(numForm as Parameters<typeof calcEmploye>[0]);

    const f = (key: string, label: string) => (
        <Input
            label={label}
            type="text"
            inputMode="numeric"
            value={formStr[key] ?? '0'}
            onChange={(e) => setFormStr((p) => ({ ...p, [key]: e.target.value }))}
            suffix="FCFA"
        />
    );

    const ResultRow = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
        <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
                <p className="text-sm text-gray-700">{label}</p>
                {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
            </div>
            <p className="text-sm font-semibold text-gray-900">{value}</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Paramètres salarié : CGI 2025">
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
                        <div className="flex gap-2">
                            {['Cadre', 'Non-cadre'].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setForm((p) => ({ ...p, categorie: c }))}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${numForm.categorie === c
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-white text-gray-700 border-gray-300'
                                        }`}
                                >
                                    {c} : abatt. {c === 'Cadre' ? '20' : '25'} %
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Régime cotisation</label>
                        <div className="flex gap-2">
                            {[['CNSS', '5,5 %'], ['CARFO', '6 %']].map(([v, l]) => (
                                <button
                                    key={v}
                                    onClick={() => setForm((p) => ({ ...p, cotisation: v }))}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${numForm.cotisation === v
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300'
                                        }`}
                                >
                                    {v} : {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Charges familiales</label>
                        <input
                            type="number" min={0} max={4}
                            value={form.charges}
                            onChange={(e) => setForm((p) => ({ ...p, charges: Math.min(4, Math.max(0, +e.target.value)) }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                    </div>
                    {f('salaire_base', 'Salaire de base')}
                    {f('anciennete', 'Prime d\'ancienneté')}
                    {f('heures_sup', 'Heures supp.')}
                    {f('logement', 'Ind. logement')}
                    {f('transport', 'Ind. transport')}
                    {f('fonction', 'Ind. de fonction')}
                </div>
            </Card>

            <Card title="Résultat : Détail fiscal CGI 2025">
                <ResultRow label="Rémunération brute totale" value={fmt(r.remBrute)} />
                <ResultRow label={`Cotisation ${numForm.cotisation}`} value={`- ${fmt(r.cotSoc)}`} sub={`${(r.cotSoc / r.remBrute * 100).toFixed(1)} %`} />
                <ResultRow label="Exo. logement" value={`- ${fmt(r.exoLog)}`} sub="Plaf. 75 000" />
                <ResultRow label="Exo. transport" value={`- ${fmt(r.exoTrans)}`} sub="Plaf. 30 000" />
                <ResultRow label="Exo. fonction" value={`- ${fmt(r.exoFonct)}`} sub="Plaf. 50 000" />
                <ResultRow label={`Abatt. forfait. ${(r.tauxForf * 100).toFixed(0)} % (Art.111)`} value={`- ${fmt(r.abattForf)}`} />
                <ResultRow label="Base imposable (Art.112)" value={fmt(r.baseImp)} />
                <ResultRow label="IUTS brut (barème progressif)" value={`- ${fmt(r.iutsBrut)}`} />
                <ResultRow label="Abatt. familial (Art.113)" value={`+ ${fmt(r.abattFam)}`} sub={`${numForm.charges} charge(s) : ${(r.abattFam / (r.iutsBrut || 1) * 100).toFixed(0)} %`} />
                <ResultRow label="FSP : Fonds de Soutien Patriotique (1 %)" value={`- ${fmt(r.fsp)}`} sub="Décret présidentiel BF 2023" />

                <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500">IUTS net retenu</p>
                        <p className="text-xl font-bold text-green-700">{fmt(r.iutsNet)}</p>
                        <p className="text-[11px] text-gray-400">Taux eff. {r.tauxEffectif.toFixed(1)} %</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500">TPA patronale (3 %)</p>
                        <p className="text-xl font-bold text-blue-700">{fmt(r.tpa)}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500">FSP (1 % net)</p>
                        <p className="text-xl font-bold text-red-700">{fmt(r.fsp)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500">Net à payer salarié</p>
                        <p className="text-xl font-bold text-orange-700">{fmt(r.netAPayer)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500">Coût total employeur</p>
                        <p className="text-xl font-bold text-gray-700">{fmt(r.remBrute + r.tpa)}</p>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ─── IRF ────────────────────────────────────────────────────
function IRFCalc() {
    const [loyerStr, setLoyerStr] = useState('300000');
    const loyer = parseFloat(loyerStr) || 0;
    const r = calcIRF(loyer);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="IRF : Revenus Fonciers (CGI 2025 Art. 121–126)">
                <Input
                    label="Loyer brut mensuel (FCFA)"
                    type="text"
                    inputMode="numeric"
                    value={loyerStr}
                    onChange={(e) => setLoyerStr(e.target.value)}
                    suffix="FCFA"
                />
                <div className="mt-4 text-xs text-gray-500 space-y-1">
                    <p>• Abattement 50 % sur loyer brut (Art. 124)</p>
                    <p>• 18 % sur base nette ≤ 100 000 FCFA</p>
                    <p>• 25 % sur base nette &gt; 100 000 FCFA</p>
                </div>
            </Card>
            <Card title="Résultat IRF">
                {[
                    ['Loyer brut', fmt(r.loyerBrut)],
                    ['Abattement 50 %', `- ${fmt(r.abattement)}`],
                    ['Base nette imposable', fmt(r.baseNette)],
                    ['IRF tranche 18 % (≤ 100 000)', `- ${fmt(r.irf1)}`],
                    ['IRF tranche 25 % (> 100 000)', `- ${fmt(r.irf2)}`],
                ].map(([l, v]) => (
                    <div key={l} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                        <span className="text-gray-700">{l}</span>
                        <span className="font-semibold">{v}</span>
                    </div>
                ))}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-red-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500">IRF à verser</p>
                        <p className="text-xl font-bold text-red-700">{fmt(r.irfTotal)}</p>
                        <p className="text-[11px] text-gray-400">Taux eff. {r.tauxEffectif} %</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500">Loyer net</p>
                        <p className="text-xl font-bold text-green-700">{fmt(r.loyerNet)}</p>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ─── IRCM ───────────────────────────────────────────────────
function IRCMCalc() {
    const [montantStr, setMontantStr] = useState('1000000');
    const [type, setType] = useState('DIVIDENDES');
    const montant = parseFloat(montantStr) || 0;
    const r = calcIRCM(montant, type);

    const TYPES = [
        { value: 'CREANCES', label: 'Créances, dépôts (25 %)' },
        { value: 'OBLIGATIONS', label: 'Obligations BF (6 %)' },
        { value: 'DIVIDENDES', label: 'Dividendes, actions (12,5 %)' },
    ];

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="IRCM : Impôt sur Revenus Capitaux Mob. (CGI 2025 Art. 140)">
                <Select
                    label="Type de revenu"
                    options={TYPES}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                />
                <div className="mt-3">
                    <Input
                        label="Montant brut (FCFA)"
                        type="text"
                        inputMode="numeric"
                        value={montantStr}
                        onChange={(e) => setMontantStr(e.target.value)}
                        suffix="FCFA"
                    />
                </div>
            </Card>
            <Card title="Résultat IRCM">
                <div className="grid grid-cols-2 gap-4 mt-2">
                    {[
                        { label: 'Montant brut', value: fmt(r.brut), color: 'bg-gray-50' },
                        { label: `IRCM (${(r.taux * 100).toFixed(1)} %)`, value: fmt(r.ircm), color: 'bg-red-50' },
                        { label: 'Montant net', value: fmt(r.net), color: 'bg-green-50' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={`${color} rounded-xl p-4`}>
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-lg font-bold text-gray-900">{value}</p>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

// ─── CME ────────────────────────────────────────────────────
function CMECalc() {
    const [caStr, setCAStr] = useState('5000000');
    const [zone, setZone] = useState('A');
    const [cga, setCGA] = useState(false);
    const ca = parseFloat(caStr) || 0;
    const r = calcCME(ca, zone, cga);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="CME : Micro-Entreprises (CGI 2025 Art. 533)">
                <div className="space-y-3">
                    <Input label="Chiffre d'affaires annuel (FCFA)" type="text" inputMode="numeric" value={caStr} onChange={(e) => setCAStr(e.target.value)} suffix="FCFA" />
                    <Select label="Zone géographique" options={[
                        { value: 'A', label: 'Zone A : Ouagadougou / Bobo' }, { value: 'B', label: 'Zone B : Chef-lieu région' },
                        { value: 'C', label: 'Zone C : Chef-lieu province' }, { value: 'D', label: 'Zone D : Reste territoire' },
                    ]} value={zone} onChange={(e) => setZone(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={cga} onChange={(e) => setCGA(e.target.checked)} className="rounded" />
                        Adhérent CGA (réduction 25 % : Art. 197)
                    </label>
                </div>
            </Card>
            <Card title="Résultat CME">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs text-gray-500">Zone</p><p className="text-2xl font-bold text-gray-900">{r.zone}</p></div>
                    <div className="bg-blue-50 rounded-xl p-4"><p className="text-xs text-gray-500">Classe</p><p className="text-2xl font-bold text-blue-700">{r.classe}</p></div>
                    <div className="bg-orange-50 rounded-xl p-4"><p className="text-xs text-gray-500">CME brute</p><p className="text-xl font-bold text-orange-700">{fmt(r.cme)}</p></div>
                    <div className="bg-green-50 rounded-xl p-4"><p className="text-xs text-gray-500">CME nette {cga ? '(-25%)' : ''}</p><p className="text-xl font-bold text-green-700">{fmt(r.cmeNet)}</p></div>
                </div>
            </Card>
        </div>
    );
}

// ─── Patente ────────────────────────────────────────────────
function PatenteCalc() {
    const [caStr, setCAStr] = useState('20000000');
    const [locatifStr, setLocatifStr] = useState('500000');
    const ca = parseFloat(caStr) || 0;
    const locatif = parseFloat(locatifStr) || 0;
    const r = calcPatente(ca, locatif);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Patentes (CGI 2025 Art. 237–240)">
                <div className="space-y-3">
                    <Input label="CA HT exercice précédent (FCFA)" type="text" inputMode="numeric" value={caStr} onChange={(e) => setCAStr(e.target.value)} suffix="FCFA" />
                    <Input label="Valeur locative locaux prof. (FCFA)" type="text" inputMode="numeric" value={locatifStr} onChange={(e) => setLocatifStr(e.target.value)} suffix="FCFA" />
                </div>
            </Card>
            <Card title="Résultat Patente">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50 rounded-xl p-4"><p className="text-xs text-gray-500">Droit fixe (Tableau A)</p><p className="text-xl font-bold text-orange-700">{fmt(r.droitFixe)}</p></div>
                    <div className="bg-blue-50 rounded-xl p-4"><p className="text-xs text-gray-500">Droit prop. (1 % val. loc.)</p><p className="text-xl font-bold text-blue-700">{fmt(r.droitProp)}</p></div>
                    <div className="col-span-2 bg-green-50 rounded-xl p-4"><p className="text-xs text-gray-500">Total patente due</p><p className="text-2xl font-bold text-green-700">{fmt(r.totalPatente)}</p></div>
                </div>
            </Card>
        </div>
    );
}

// ─── IS / MFP ───────────────────────────────────────────────
function ISCalc() {
    const [caStr, setCAStr] = useState('100000000');
    const [beneficeStr, setBeneficeStr] = useState('10000000');
    const [regime, setRegime] = useState('RNI');
    const [cga, setCGA] = useState(false);
    const ca = parseFloat(caStr) || 0;
    const benefice = parseFloat(beneficeStr) || 0;

    const rIS = calcIS(benefice, cga);
    const rMFP = calcMFP(ca, regime, cga);
    const isoDu = Math.max(rIS.is, rMFP.mfpDu);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="IS / MFP : Impôt sur les Sociétés (CGI 2025 Art. 42 : 27,5 %)">
                <div className="space-y-3">
                    <Input label="CA HT (FCFA)" type="text" inputMode="numeric" value={caStr} onChange={(e) => setCAStr(e.target.value)} suffix="FCFA" />
                    <Input label="Bénéfice imposable (FCFA)" type="text" inputMode="numeric" value={beneficeStr} onChange={(e) => setBeneficeStr(e.target.value)} suffix="FCFA" />
                    <Select label="Régime" options={[{ value: 'RNI', label: 'RNI : Régime Normal' }, { value: 'RSI', label: 'RSI : Régime Simplifié' }]} value={regime} onChange={(e) => setRegime(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={cga} onChange={(e) => setCGA(e.target.checked)} className="rounded" />
                        Adhérent CGA (IS -30 %, MFP -50 % : Art. 196)
                    </label>
                </div>
            </Card>
            <Card title="Résultat IS / MFP">
                <div className="space-y-2 mb-4">
                    {[
                        ['IS théorique (27,5 %)', fmt(rIS.is)],
                        [`MFP calculé (0,5 % CA)`, fmt(rMFP.mfpCalcule)],
                        [`MFP minimum ${regime}`, fmt(rMFP.mfpMinimum)],
                        ['MFP dû (max calculé/min)', fmt(rMFP.mfpDu)],
                    ].map(([l, v]) => (
                        <div key={l} className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                            <span className="text-gray-700">{l}</span>
                            <span className="font-semibold">{v}</span>
                        </div>
                    ))}
                </div>
                <div className="bg-green-50 rounded-xl p-5">
                    <p className="text-xs text-gray-500">IS / MFP à verser (max IS, MFP)</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">{fmt(isoDu)}</p>
                </div>
            </Card>
        </div>
    );
}

