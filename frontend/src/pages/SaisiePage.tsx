import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, declarationApi, bulletinApi, cnssApi } from '../lib/api';
import { calcEmploye, fmtN } from '../lib/fiscalCalc';
import { downloadCsvTemplate } from '../lib/importCsv';
import type { Employee, Bulletin } from '../types';
import { Card, Btn, Badge, Spinner, useAppStore, PLAN_FEATURES, NumericInput } from '../components/ui';
import { usePermissions } from '../lib/permissions';
import { MOIS_FR } from '../types';
import { FileText, CheckCircle2, AlertCircle, X, Download, Upload, Copy, List, PenLine } from 'lucide-react';

const MOIS_OPTIONS = MOIS_FR.map((m, i) => ({ value: String(i + 1), label: m }));

export default function SaisiePage() {
    const now = new Date();
    const [mois, setMois] = useState(now.getMonth() + 1);
    const [annee, setAnnee] = useState(now.getFullYear());
    const [cotisation, setCotisation] = useState<'CNSS' | 'CARFO'>('CNSS');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [importMsg, setImportMsg] = useState('');
    const [copyingN1, setCopyingN1] = useState(false);
    const [page, setPage] = useState(1);
    const [vue, setVue] = useState<'saisie' | 'liste'>('saisie');
    const LIMIT = 50;
    const importRef = useRef<HTMLInputElement>(null);

    const { plan } = useAppStore();
    const canCopyN1 = PLAN_FEATURES[plan]?.has('n1-copy');
    const { canManageEmployees, canManageDeclarations, isAuditeur } = usePermissions();

    const qc = useQueryClient();

    const { data: empResponse, isLoading } = useQuery({
        queryKey: ['employees', page],
        queryFn: () => employeeApi.list(page, LIMIT),
    });
    const employees: Employee[] = empResponse?.data ?? [];
    const totalEmployees = parseInt(empResponse?.headers?.['x-total-count'] ?? '0', 10);
    const totalPages = Math.max(1, Math.ceil(totalEmployees / LIMIT));

    const addEmployee = useMutation({
        mutationFn: (data: object) => employeeApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
    });

    const deleteEmployee = useMutation({
        mutationFn: (id: string) => employeeApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
    });

    const totaux = employees.reduce(
        (acc, e) => {
            const r = calcEmploye({
                salaire_base: e.salaire_base,
                anciennete: e.anciennete,
                heures_sup: e.heures_sup,
                logement: e.logement,
                transport: e.transport,
                fonction: e.fonction,
                charges: e.charges,
                categorie: e.categorie,
                cotisation: cotisation,
            });
            return {
                brut: acc.brut + r.remBrute,
                iuts: acc.iuts + r.iutsNet,
                tpa: acc.tpa + r.tpa,
                css: acc.css + r.cotSoc,
                net: acc.net + r.netAPayer,
            };
        },
        { brut: 0, iuts: 0, tpa: 0, css: 0, net: 0 }
    );

    const handleGenerate = async () => {
        setSaving(true);
        setSuccess('');
        setImportMsg('');
        try {
            // Génère toutes les déclarations mensuelles liées à la paie
            // à partir des données employé déjà saisies.
            await Promise.all([
                declarationApi.create({ mois, annee }),
                bulletinApi.generate({ mois, annee, cotisation }),
                cnssApi.generate({ mois, annee }),
            ]);
            qc.invalidateQueries({ queryKey: ['declarations'] });
            qc.invalidateQueries({ queryKey: ['bulletins'] });
            qc.invalidateQueries({ queryKey: ['cnss-patronal'] });
            qc.invalidateQueries({ queryKey: ['cnss'] });
            setSuccess(`Déclarations du mois (${MOIS_FR[mois - 1]} ${annee}) générées : IUTS/TPA, bulletins et CNSS.`);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Erreur lors de la génération.';
            setImportMsg('err:' + msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ['nom', 'categorie', 'salaire_base', 'anciennete', 'heures_sup', 'logement', 'transport', 'fonction', 'charges'];
        const examples = [
            ['Dupont Jean', 'Non-cadre', '150000', '3', '0', '0', '10000', '0', '0'],
            ['Martin Sophie', 'Cadre', '300000', '5', '8', '50000', '15000', '25000', '0'],
        ];
        downloadCsvTemplate('modele-employes.csv', headers, examples);
    };

    const handleExport = async () => {
        const res = await employeeApi.export();
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `employes-${annee}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportMsg('');
        try {
            const res = await employeeApi.import(file);
            const n = res.data?.imported ?? res.data?.count ?? '?';
            setImportMsg('ok:' + n);
            qc.invalidateQueries({ queryKey: ['employees'] });
        } catch {
            setImportMsg('err:Erreur import. Vérifiez le format CSV.');
        } finally {
            if (importRef.current) importRef.current.value = '';
        }
    };

    // Copie N-1 : récupère les bulletins du mois précédent et met à jour les employés existants
    const handleCopyN1 = async () => {
        const prevMois = mois === 1 ? 12 : mois - 1;
        const prevAnnee = mois === 1 ? annee - 1 : annee;
        setCopyingN1(true);
        setSuccess('');
        try {
            const res = await bulletinApi.list(prevMois, prevAnnee);
            const bulletins: Bulletin[] = res.data ?? [];
            if (bulletins.length === 0) {
                setImportMsg('err:Aucun bulletin trouvé pour ' + MOIS_FR[prevMois - 1] + ' ' + prevAnnee + '.');
                return;
            }
            // Mettre à jour heures_sup = 0 pour chaque employé correspondant
            const updates = employees
                .filter((e) => bulletins.some((b) => b.employee_id === e.id))
                .map((e) => employeeApi.update(e.id, { ...e, heures_sup: 0 }));
            await Promise.all(updates);
            await qc.invalidateQueries({ queryKey: ['employees'] });
            setSuccess(`Données copiées depuis ${MOIS_FR[prevMois - 1]} ${prevAnnee} (${updates.length} employé(s)).`);
        } catch {
            setImportMsg('err:Impossible de copier les données du mois précédent.');
        } finally {
            setCopyingN1(false);
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card>
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Mois</label>
                        <select
                            value={mois}
                            onChange={(e) => setMois(+e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                        >
                            {MOIS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Année</label>
                        <input
                            type="number"
                            min={2000}
                            max={2100}
                            value={annee}
                            onChange={(e) => setAnnee(+e.target.value)}
                            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Régime</label>
                        <select
                            value={cotisation}
                            onChange={(e) => setCotisation(e.target.value as 'CNSS' | 'CARFO')}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                        >
                            <option value="CNSS">CNSS (5,5 %)</option>
                            {/* CARFO désactivé en saisie — réactiver l’option si le régime est réintroduit */}
                            {/* <option value="CARFO">CARFO (6 %)</option> */}
                        </select>
                    </div>
                    <div className="ml-auto flex gap-2">
                        <Btn
                            variant="outline"
                            onClick={handleDownloadTemplate}
                            title="Télécharger le modèle CSV à remplir"
                        >
                            <Download className="w-4 h-4" /> Modèle CSV
                        </Btn>
                        <Btn
                            variant="outline"
                            onClick={handleExport}
                            title="Exporter la liste des employés en CSV"
                        >
                            <Download className="w-4 h-4" /> Export CSV
                        </Btn>
                        {canManageEmployees && (
                            <Btn
                                variant="outline"
                                onClick={() => importRef.current?.click()}
                                title="Importer des employés depuis un fichier CSV"
                            >
                                <Upload className="w-4 h-4" /> Import CSV
                            </Btn>
                        )}
                        <input
                            ref={importRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleImport}
                        />
                        {canCopyN1 && canManageEmployees && (
                            <Btn
                                variant="outline"
                                onClick={handleCopyN1}
                                disabled={copyingN1}
                                title="Copier les employés du mois précédent (heures sup remises à 0)"
                            >
                                <Copy className="w-4 h-4" /> {copyingN1 ? 'Copie…' : 'Copier N-1'}
                            </Btn>
                        )}
                        {canManageEmployees && (
                            <Btn
                                variant="outline"
                                onClick={() => addEmployee.mutate({
                                    nom: 'Nouvel employé',
                                    categorie: 'Non-cadre',
                                    cotisation: 'CNSS',
                                    charges: 0,
                                    salaire_base: 0,
                                    anciennete: 0,
                                    heures_sup: 0,
                                    logement: 0,
                                    transport: 0,
                                    fonction: 0,
                                })}
                            >
                                + Ajouter employé
                            </Btn>
                        )}
                        {canManageDeclarations ? (
                            <Btn onClick={handleGenerate} disabled={saving || employees.length === 0}>
                                {saving ? 'Génération…' : <><FileText className="w-4 h-4" /> Générer les déclarations du mois</>}
                            </Btn>
                        ) : (
                            <Btn disabled title={isAuditeur ? 'Accès lecture seule' : 'Droits insuffisants'}>
                                <FileText className="w-4 h-4" /> Générer les déclarations du mois
                            </Btn>
                        )}
                    </div>
                </div>
                {success && (
                    <div className="mt-3 flex items-center gap-2 text-sm px-4 py-2 rounded-lg border bg-green-50 text-green-700 border-green-100">
                        <CheckCircle2 className="w-4 h-4" />{success}
                    </div>
                )}
                {importMsg && (
                    <div className={`mt-3 flex items-center gap-2 text-sm px-4 py-2 rounded-lg border ${importMsg.startsWith('ok:') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {importMsg.startsWith('ok:') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {importMsg.startsWith('ok:') ? importMsg.slice(3) + ' employé(s) importé(s).' : importMsg.slice(4)}
                    </div>
                )}
            </Card>

            {/* Totaux */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                {[
                    { label: 'Brut total', value: fmtN(totaux.brut), color: 'bg-gray-50' },
                    { label: 'IUTS net (DGI)', value: fmtN(totaux.iuts), color: 'bg-green-50' },
                    { label: 'TPA (3 %)', value: fmtN(totaux.tpa), color: 'bg-blue-50' },
                    { label: 'CNSS salariale (5,5 %)', value: fmtN(totaux.css), color: 'bg-orange-50' },
                    { label: 'Net à payer', value: fmtN(totaux.net), color: 'bg-gray-50' },
                ].map((s) => (
                    <div key={s.label} className={`${s.color} rounded-xl p-4`}>
                        <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                        <p className="text-base font-bold text-gray-900">{s.value} FCFA</p>
                    </div>
                ))}
            </div>

            {/* Toggle vue */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={() => setVue('saisie')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vue === 'saisie' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <PenLine className="w-3.5 h-3.5" /> Saisie
                    </button>
                    <button
                        onClick={() => setVue('liste')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vue === 'liste' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <List className="w-3.5 h-3.5" /> Liste
                    </button>
                </div>
                <span className="text-xs text-gray-400">{employees.length} employé(s)</span>
            </div>

            {/* Vue Liste : tableau récapitulatif */}
            {vue === 'liste' && (
                <Card>
                    {employees.length === 0 ? (
                        <p className="text-center text-gray-400 py-8">Aucun employé enregistré.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                                        <th className="text-left py-2 px-3 font-medium">N°</th>
                                        <th className="text-left py-2 px-3 font-medium">Nom et Prénom</th>
                                        <th className="text-left py-2 px-3 font-medium">Catégorie</th>
                                        <th className="text-right py-2 px-3 font-medium">Salaire brut</th>
                                        <th className="text-right py-2 px-3 font-medium">IUTS net</th>
                                        <th className="text-right py-2 px-3 font-medium">CSS</th>
                                        <th className="text-right py-2 px-3 font-medium">TPA</th>
                                        <th className="text-right py-2 px-3 font-medium">Net à payer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map((emp, idx) => {
                                        const r = calcEmploye({
                                            salaire_base: emp.salaire_base,
                                            anciennete: emp.anciennete,
                                            heures_sup: emp.heures_sup,
                                            logement: emp.logement,
                                            transport: emp.transport,
                                            fonction: emp.fonction,
                                            charges: emp.charges,
                                            categorie: emp.categorie,
                                            cotisation,
                                        });
                                        return (
                                            <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                <td className="py-2.5 px-3 text-gray-400 text-xs">{(page - 1) * LIMIT + idx + 1}</td>
                                                <td className="py-2.5 px-3 font-medium text-gray-900">{emp.nom}</td>
                                                <td className="py-2.5 px-3">
                                                    <Badge color={emp.categorie === 'Cadre' ? 'green' : 'orange'}>{emp.categorie}</Badge>
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-gray-700">{fmtN(r.remBrute)} F</td>
                                                <td className="py-2.5 px-3 text-right text-green-700 font-medium">{fmtN(r.iutsNet)} F</td>
                                                <td className="py-2.5 px-3 text-right text-orange-700">{fmtN(r.cotSoc)} F</td>
                                                <td className="py-2.5 px-3 text-right text-blue-700">{fmtN(r.tpa)} F</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-gray-900">{fmtN(r.netAPayer)} F</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 font-bold text-sm border-t-2 border-gray-200">
                                        <td className="py-3 px-3 text-xs text-gray-500" colSpan={3}>TOTAL</td>
                                        <td className="py-3 px-3 text-right text-gray-900">{fmtN(totaux.brut)} F</td>
                                        <td className="py-3 px-3 text-right text-green-700">{fmtN(totaux.iuts)} F</td>
                                        <td className="py-3 px-3 text-right text-orange-700">{fmtN(totaux.css)} F</td>
                                        <td className="py-3 px-3 text-right text-blue-700">{fmtN(totaux.tpa)} F</td>
                                        <td className="py-3 px-3 text-right text-gray-900">{fmtN(totaux.net)} F</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* Vue Saisie : cartes éditables */}
            {vue === 'saisie' && (
                <div className="space-y-4">
                    {employees.length === 0 ? (
                        <Card>
                            <p className="text-center text-gray-400 py-8">
                                Aucun employé. Cliquez sur « Ajouter employé » pour commencer.
                            </p>
                        </Card>
                    ) : (
                        employees.map((emp, idx) => (
                            <EmployeeCard
                                key={emp.id}
                                employee={emp}
                                index={(page - 1) * LIMIT + idx}
                                cotisation={cotisation}
                                onDelete={() => deleteEmployee.mutate(emp.id)}
                            />
                        ))
                    )}

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between py-2 px-1">
                            <p className="text-xs text-gray-500">{totalEmployees} employé(s) - Page {page} / {totalPages}</p>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                                >← Préc.</button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                                >Suiv. →</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface EmployeeCardProps {
    employee: Employee;
    index: number;
    cotisation: 'CNSS' | 'CARFO';
    onDelete: () => void;
}

function EmployeeCard({ employee: emp, index, cotisation, onDelete }: EmployeeCardProps) {
    const qc = useQueryClient();
    const [e, setE] = useState(emp);

    const update = useMutation({
        mutationFn: (data: Partial<Employee>) => employeeApi.update(emp.id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
    });

    const r = calcEmploye({
        salaire_base: e.salaire_base,
        anciennete: e.anciennete,
        heures_sup: e.heures_sup,
        logement: e.logement,
        transport: e.transport,
        fonction: e.fonction,
        charges: e.charges,
        categorie: e.categorie,
        cotisation,
    });

    // Sauvegarde l'objet employé COMPLET (pas juste un champ)
    // pour éviter que le backend Go zero-init les champs absents du JSON.
    const saveAll = (patch: Partial<Employee>) => {
        const merged = { ...e, ...patch };
        setE(merged);
        update.mutate(merged);
    };

    const field = (
        label: string,
        key: keyof Employee,
        type: 'text' | 'number' = 'number',
        hint?: string
    ) => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
                {label} {hint && <span className="text-gray-400 font-normal">{hint}</span>}
            </label>
            {type === 'number' ? (
                <NumericInput
                    value={Number(e[key] ?? 0)}
                    onChange={(v) => setE((prev) => ({ ...prev, [key]: v }))}
                    onBlur={() => update.mutate({ ...e })}
                />
            ) : (
                <input
                    type="text"
                    value={String(e[key] ?? '')}
                    onChange={(ev) => setE((prev) => ({ ...prev, [key]: ev.target.value }))}
                    onBlur={() => update.mutate({ ...e })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            )}
        </div>
    );

    return (
        <Card>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                    </div>
                    <span className="font-semibold text-gray-900 text-sm">{e.nom || 'Employé'}</span>
                    <Badge color={e.categorie === 'Cadre' ? 'green' : 'orange'}>{e.categorie}</Badge>
                </div>
                <button onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                {field('Nom et Prénom', 'nom', 'text')}
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
                    <select
                        value={e.categorie}
                        onChange={(ev) => {
                            const val = ev.target.value as 'Cadre' | 'Non-cadre';
                            saveAll({ categorie: val });
                        }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                        <option>Cadre</option>
                        <option>Non-cadre</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Charges (dép.)</label>
                    <input
                        type="number" min={0} max={4}
                        value={e.charges}
                        onChange={(ev) => setE((p) => ({ ...p, charges: +ev.target.value }))}
                        onBlur={() => update.mutate({ ...e })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    />
                </div>
                {field('Salaire de base', 'salaire_base')}
                {field('Prime d\'ancienneté', 'anciennete')}
                {field('H. sup. & sursalaire', 'heures_sup')}
                {field('Ind. logement', 'logement', 'number', '(≤ 75 000 exo.)')}
                {field('Ind. transport', 'transport', 'number', '(≤ 30 000 exo.)')}
                {field('Ind. de fonction', 'fonction', 'number', '(≤ 50 000 exo.)')}
            </div>

            {/* Live results */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-gray-100 pt-4">
                <div className="text-center">
                    <p className="text-xs text-gray-500">IUTS net</p>
                    <p className="text-base font-bold text-green-700">{fmtN(r.iutsNet)} F</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">{cotisation} {cotisation === 'CNSS' ? '5,5%' : '6%'}</p>
                    <p className="text-base font-bold text-blue-700">{fmtN(r.cotSoc)} F</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">TPA 3 %</p>
                    <p className="text-base font-bold text-orange-700">{fmtN(r.tpa)} F</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Net à payer</p>
                    <p className="text-base font-bold text-gray-900">{fmtN(r.netAPayer)} F</p>
                </div>
            </div>
        </Card>
    );
}

