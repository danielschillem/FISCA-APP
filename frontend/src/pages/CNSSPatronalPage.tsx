import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cnssApi, employeeApi } from '../lib/api';
import { fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn, Spinner, Table, Badge } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import type { Employee, CNSSPatronal } from '../types';
import { MOIS_FR } from '../types';
import { Zap, Lock, Download } from 'lucide-react';

export default function CNSSPatronalPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('cnss-patronal')) return <Locked />;
    return <CNSSContent />;
}

const TAUX = { famille: 0.072, accident: 0.034, retraite: 0.055 };
const TAUX_CARFO_PATRONAL = 0.07; // CARFO patronal 7 %
const PLAFOND = 600_000;

// Base CNSS = rémunération brute complète (tous composants), plafonnée à 600 000 FCFA.
// Conformément au Code du Travail BF et CGI 2025 Art. 229.
function calcCnssEmp(e: Employee) {
    const remBrute = e.salaire_base + e.anciennete + e.heures_sup + e.logement + e.transport + e.fonction;
    const base = Math.min(remBrute, PLAFOND);
    if (e.cotisation === 'CARFO') {
        // CARFO : taux patronal unique 7 % (Art. 3 Décret CARFO BF)
        const total = Math.round(base * TAUX_CARFO_PATRONAL);
        return { base, famille: 0, accident: 0, retraite: total, total };
    }
    return {
        base,
        famille: Math.round(base * TAUX.famille),
        accident: Math.round(base * TAUX.accident),
        retraite: Math.round(base * TAUX.retraite),
        total: Math.round(base * (TAUX.famille + TAUX.accident + TAUX.retraite)),
    };
}

function CNSSContent() {
    const qc = useQueryClient();
    const now = new Date();
    const [mois, setMois] = useState(now.getMonth() + 1);
    const [annee, setAnnee] = useState(now.getFullYear());

    const { data: employees = [], isLoading: loadEmp } = useQuery<Employee[]>({
        queryKey: ['employees'],
        queryFn: () => employeeApi.list().then((r) => r.data),
    });

    const { data: declarations = [], isLoading: loadDecl } = useQuery<CNSSPatronal[]>({
        queryKey: ['cnss-patronal', mois, annee],
        queryFn: () => cnssApi.list(mois, annee).then((r) => r.data),
    });

    const generate = useMutation({
        mutationFn: () => cnssApi.generate({ mois, annee }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['cnss-patronal', mois, annee] }),
    });

    if (loadEmp || loadDecl) return <Spinner />;

    const totaux = employees.reduce((acc, e) => {
        const c = calcCnssEmp(e);
        const remBrute = e.salaire_base + e.anciennete + e.heures_sup + e.logement + e.transport + e.fonction;
        return {
            masseSalariale: acc.masseSalariale + remBrute,
            base: acc.base + c.base,
            famille: acc.famille + c.famille,
            accident: acc.accident + c.accident,
            retraite: acc.retraite + c.retraite,
            total: acc.total + c.total,
        };
    }, { masseSalariale: 0, base: 0, famille: 0, accident: 0, retraite: 0, total: 0 });

    return (
        <div className="space-y-6">
            {/* Period selector */}
            <div className="flex items-center gap-3">
                <select
                    value={mois}
                    onChange={(e) => setMois(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                    {MOIS_FR.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                    ))}
                </select>
                <input
                    type="number"
                    min={2020}
                    max={2030}
                    value={annee}
                    onChange={(e) => setAnnee(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <Btn onClick={() => generate.mutate()} disabled={generate.isPending}>
                    {generate.isPending ? 'Génération…' : <><Zap className="w-4 h-4" /> Générer déclaration</>}
                </Btn>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Effectif déclaré</p>
                    <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Masse salariale brute</p>
                    <p className="text-xl font-bold text-blue-700">{fmt(totaux.masseSalariale)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Cotisations patronales</p>
                    <p className="text-xl font-bold text-green-700">{fmt(totaux.total)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Taux global</p>
                    <p className="text-xl font-bold text-orange-700">16,1 %</p>
                </div>
            </div>

            {/* Per-employee table */}
            <Card title="Détail par employé">
                <div className="overflow-x-auto">
                    <Table columns={['Employé', 'Brut total', 'Base CNSS', 'Famille (7,2%)', 'Accident (3,4%)', 'Retraite/CARFO (5,5%/7%)', 'Total patronal']}>
                        {employees.map((e) => {
                            const c = calcCnssEmp(e);
                            return (
                                <tr key={e.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                        {e.nom}
                                        {e.cotisation === 'CARFO' && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">CARFO</span>}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(e.salaire_base + e.anciennete + e.heures_sup + e.logement + e.transport + e.fonction)}</td>
                                    <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(c.base)}</td>
                                    <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(c.famille)}</td>
                                    <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(c.accident)}</td>
                                    <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(c.retraite)}</td>
                                    <td className="py-3 px-4 text-sm text-right font-bold font-mono text-green-700">{fmtN(c.total)}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                            <td className="py-3 px-4 text-sm">Total</td>
                            <td colSpan={2} />
                            <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(totaux.famille)}</td>
                            <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(totaux.accident)}</td>
                            <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(totaux.retraite)}</td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-green-700">{fmtN(totaux.total)}</td>
                        </tr>
                    </Table>
                </div>
            </Card>
            {/* Declarations list with export */}
            {declarations.length > 0 && (
                <Card title="Déclarations CNSS générées">
                    <div className="overflow-x-auto">
                        <Table columns={['Période', 'Salariés CNSS', 'Salariés CARFO', 'Total patronal CNSS', 'Total CARFO', 'Total général', 'Statut', 'Export']}>
                            {declarations.map((d) => (
                                <tr key={d.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{d.periode}</td>
                                    <td className="py-3 px-4 text-sm text-right">{d.nb_salaries_cnss}</td>
                                    <td className="py-3 px-4 text-sm text-right">{d.nb_salaries_carfo}</td>
                                    <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(d.cotisation_pat_cnss)}</td>
                                    <td className="py-3 px-4 text-sm text-right font-mono">{fmtN(d.total_carfo)}</td>
                                    <td className="py-3 px-4 text-sm text-right font-bold font-mono text-green-700">{fmtN(d.total_general)}</td>
                                    <td className="py-3 px-4 text-sm">
                                        <Badge color={d.statut === 'valide' ? 'green' : 'gray'}>{d.statut}</Badge>
                                    </td>
                                    <td className="py-3 px-4 text-sm">
                                        <button
                                            onClick={async () => {
                                                const res = await cnssApi.export(d.id);
                                                const url = URL.createObjectURL(new Blob([res.data]));
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `CNSS_${d.periode.replace(' ', '_')}.pdf`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex items-center gap-1 text-xs text-green-700 hover:underline font-medium"
                                        >
                                            <Download className="w-3.5 h-3.5" /> PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                </Card>
            )}
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité <span className="text-orange-600">Entreprise</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Entreprise pour la déclaration CNSS patronale complète.</p>
            </div>
        </div>
    );
}

