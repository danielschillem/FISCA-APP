import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bulletinApi, employeeApi } from '../lib/api';
import { Card, Btn, Spinner, Badge } from '../components/ui';
import { fmt, calcEmploye } from '../lib/fiscalCalc';
import type { Bulletin, Employee } from '../types';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { MOIS_FR } from '../types';
import { Zap, Download, Lock, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function BulletinsPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('bulletin')) {
        return <LockedView plan="Pro" color="#24a05a" />;
    }
    return <BulletinsContent />;
}

function BulletinsContent() {
    const qc = useQueryClient();
    const now = new Date();
    const [mois, setMois] = useState(now.getMonth() + 1);
    const [annee, setAnnee] = useState(now.getFullYear());
    const [cotisation, setCotisation] = useState<'CNSS' | 'CARFO'>('CNSS');

    const { data: employees = [] } = useQuery<Employee[]>({
        queryKey: ['employees'],
        queryFn: () => employeeApi.list().then((r) => r.data),
    });

    const { data: bulletins = [], isLoading } = useQuery<Bulletin[]>({
        queryKey: ['bulletins', mois, annee],
        queryFn: () => bulletinApi.list(mois, annee).then((r) => r.data),
    });

    const generate = useMutation({
        mutationFn: () => bulletinApi.generate({ mois, annee, cotisation }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['bulletins', mois, annee] }),
    });

    if (isLoading) return <Spinner />;

    return (
        <div className="space-y-6">
            {/* Period + cotisation controls */}
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mois</label>
                    <select
                        value={mois}
                        onChange={(e) => setMois(+e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                        {MOIS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Année</label>
                    <input
                        type="number" min={2020} max={2030} value={annee}
                        onChange={(e) => setAnnee(+e.target.value)}
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Régime défaut</label>
                    <select
                        value={cotisation}
                        onChange={(e) => setCotisation(e.target.value as 'CNSS' | 'CARFO')}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                        <option value="CNSS">CNSS (5,5 %)</option>
                        <option value="CARFO">CARFO (6 %)</option>
                    </select>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                    <p className="text-sm text-gray-500">{bulletins.length} bulletin(s)</p>
                    {bulletins.length > 0 && (
                        <Btn
                            variant="outline"
                            onClick={() => {
                                const rows = bulletins.map((b) => ({
                                    Employé: b.nom_employe,
                                    Période: b.periode,
                                    Catégorie: b.categorie,
                                    Régime: b.cotisation,
                                    'Brut (FCFA)': b.brut_total,
                                    'IUTS net (FCFA)': b.iuts_net,
                                    'Cotisation sociale (FCFA)': b.cotisation_sociale,
                                    'TPA (FCFA)': b.tpa,
                                    'Net à payer (FCFA)': b.salaire_net,
                                }));
                                const ws = XLSX.utils.json_to_sheet(rows);
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, 'Bulletins');
                                XLSX.writeFile(wb, `bulletins-${MOIS_FR[mois - 1]}-${annee}.xlsx`);
                            }}
                            title="Exporter tous les bulletins en XLSX"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Export XLSX
                        </Btn>
                    )}
                    <Btn onClick={() => generate.mutate()} disabled={generate.isPending}>
                        {generate.isPending ? 'Génération…' : <><Zap className="w-4 h-4" /> Générer bulletins</>}
                    </Btn>
                </div>
            </div>

            {bulletins.length === 0 && employees.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employees.map((e, i) => (
                        <PreviewBulletin key={e.id} employee={e} index={i} />
                    ))}
                </div>
            )}

            {bulletins.map((b) => (
                <BulletinCard key={b.id} bulletin={b} />
            ))}
        </div>
    );
}

function PreviewBulletin({ employee: e, index }: { employee: Employee; index: number }) {
    const r = calcEmploye({
        salaire_base: e.salaire_base, anciennete: e.anciennete, heures_sup: e.heures_sup,
        logement: e.logement, transport: e.transport, fonction: e.fonction,
        charges: e.charges, categorie: e.categorie, cotisation: e.cotisation,
    });
    return (
        <Card>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="font-semibold text-gray-900 text-sm">{e.nom}</p>
                    <Badge color={e.categorie === 'Cadre' ? 'green' : 'orange'}>{e.categorie}</Badge>
                </div>
                <span className="text-sm text-gray-400">Employé {index + 1}</span>
            </div>
            <div className="space-y-1.5 text-sm">
                <Row label="Brut total" value={fmt(r.remBrute)} />
                <Row label="IUTS net" value={`- ${fmt(r.iutsNet)}`} />
                <Row label={`${e.cotisation}`} value={`- ${fmt(r.cotSoc)}`} />
                <Row label="Net à payer" value={fmt(r.netAPayer)} bold />
            </div>
        </Card>
    );
}

function BulletinCard({ bulletin: b }: { bulletin: Bulletin }) {
    const exportPDF = () => bulletinApi.export(b.id).then((r) => {
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bulletin-${b.nom_employe}-${b.periode}.pdf`;
        a.click();
    });

    return (
        <Card>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="font-semibold text-gray-900">{b.nom_employe}</p>
                    <p className="text-xs text-gray-500">{b.periode} · {b.categorie}</p>
                </div>
                <div className="flex gap-2">
                    <Btn size="sm" variant="outline" onClick={exportPDF}><Download className="w-3.5 h-3.5" /> PDF</Btn>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Brut" value={fmt(b.brut_total)} />
                <Metric label="IUTS net" value={fmt(b.iuts_net)} color="text-green-700" />
                <Metric label={b.cotisation} value={fmt(b.cotisation_sociale)} color="text-blue-700" />
                <Metric label="Net à payer" value={fmt(b.salaire_net)} color="text-gray-900" />
            </div>
        </Card>
    );
}

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className="flex justify-between py-1 border-b border-gray-50 last:border-0">
        <span className="text-gray-600">{label}</span>
        <span className={bold ? 'font-bold' : 'font-medium'}>{value}</span>
    </div>
);

const Metric = ({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) => (
    <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
);

function LockedView({ plan, color }: { plan: string; color: string }) {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Fonctionnalité <span style={{ color }}>{plan}</span>
                </h2>
                <p className="text-gray-500 text-sm">Passez au plan {plan} pour accéder à cette fonctionnalité.</p>
            </div>
        </div>
    );
}

