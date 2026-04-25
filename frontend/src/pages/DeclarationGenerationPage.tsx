import { FileDown, Smartphone, RefreshCw, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContribuableStore } from '../contribuable/contribuableStore';
import { MOIS_LABELS } from '../contribuable/contribuableNav';
import { contribuableApi } from '../lib/api';
import { exportContribuableAnnexesPDF } from '../lib/exportContribuableAnnexes';
import { calcBaseImposable, calcIUTSBrut, calcTPA } from '../contribuable/contribuableCalc';
import { exportAllBulletinsPDF } from '../lib/pdfBulletin';
import type { Bulletin, Company } from '../types';
import { computeOmTotal } from '../lib/paymentReceipt';
import { usePaymentGate } from '../components/PaymentModal';
import {
    invalidIutsRows,
    invalidPrelRows,
    invalidRasRows,
    invalidRsfonRows,
    invalidTvaAvRows,
    invalidTvaDedRows,
} from '../contribuable/contribuableValidation';

const OM = 'Orange Money';
const OM_FEE_RATE = 0.015;
const ANNEXES_FIRST_BASE = 5000;
const ANNEXES_DUP_BASE = 3000;
const BULLETINS_BASE = 5000;
const ANNEXES_BULLETINS_PACK_BASE = 8000;
type ValidationApiError = { annexe: string; row: number; field: string; message: string };

export default function DeclarationGenerationPage() {
    const { requestPayment, PaymentModalComponent } = usePaymentGate();
    const period = useContribuableStore((s) => s.period);
    const company = useContribuableStore((s) => s.company);
    const annexes = useContribuableStore((s) => s.annexes);
    const [serverValidation, setServerValidation] = useState<{
        loading: boolean;
        ok: boolean;
        errors: ValidationApiError[];
        failed: boolean;
    }>({ loading: false, ok: true, errors: [], failed: false });
    const [exporting, setExporting] = useState(false);
    const [bulletinGen, setBulletinGen] = useState<'idle' | 'loading' | 'error'>('idle');
    const companyForBulletins = useMemo<Company>(
        () => ({
            id: 'local-contribuable',
            user_id: 'local',
            nom: company.raisonSociale || '-',
            ifu: company.ifu || '-',
            rc: company.rc || '-',
            secteur: '',
            adresse: company.adresse || '-',
            tel: company.telephone || '-',
            forme_juridique: '',
            regime: '',
            centre_impots: '',
            code_activite: '',
            date_debut_activite: '',
            email_entreprise: '',
            ville: '',
            quartier: '',
            bp: '',
            fax: '',
        }),
        [company]
    );
    const bulletinsFromContribuable = useMemo<Bulletin[]>(
        () =>
            annexes.iuts.rows.map((r, idx) => {
                const brut = Math.round(r.salaireB || 0);
                const baseImp = calcBaseImposable(brut, r.categorie, period.year);
                const iutsBrut = calcIUTSBrut(baseImp, period.year);
                const iutsNet = Math.round(r.iutsDu || 0);
                const cotSoc = Math.round(r.cnss || 0);
                const netAvantFsp = Math.max(0, brut - iutsNet - cotSoc);
                const fsp = Math.round(netAvantFsp * 0.01);
                const tpa = calcTPA(brut, period.year);
                const salaireNet = Math.max(0, netAvantFsp - fsp);
                return {
                    id: `contrib-${period.year}-${period.month}-${idx + 1}`,
                    company_id: 'contribuable',
                    employee_id: `contrib-${idx + 1}`,
                    mois: period.month,
                    annee: period.year,
                    periode: `${MOIS_LABELS[period.month]} ${period.year}`,
                    nom_employe: r.nom || `Salarié ${idx + 1}`,
                    categorie: r.categorie === 'CADRE' ? 'Cadre' : 'Non-cadre',
                    salaire_base: brut,
                    anciennete: 0,
                    heures_sup: 0,
                    logement: 0,
                    transport: 0,
                    fonction: 0,
                    charges: r.charges,
                    cotisation: 'CNSS',
                    brut_total: brut,
                    base_imposable: baseImp,
                    iuts_brut: iutsBrut,
                    iuts_net: iutsNet,
                    cotisation_sociale: cotSoc,
                    fsp,
                    tpa,
                    salaire_net: salaireNet,
                    created_at: new Date().toISOString(),
                };
            }),
        [annexes.iuts.rows, period.month, period.year]
    );

    const moisLabel = MOIS_LABELS[period.month] ?? '';
    const invalidByAnnex = [
        { code: 'IUTS', n: invalidIutsRows(annexes.iuts.rows), to: '/declarations/iuts' },
        { code: 'RSFON', n: invalidRsfonRows(annexes.rsfon.rows), to: '/declarations/rsfon' },
        { code: 'RSLIB', n: invalidRasRows(annexes.rslib.rows, 'rslib'), to: '/declarations/rslib' },
        { code: 'RSETR', n: invalidRasRows(annexes.rsetr.rows, 'rsetr'), to: '/declarations/rsetr' },
        { code: 'RSPRE', n: invalidRasRows(annexes.rspre.rows, 'rspre'), to: '/declarations/rspre' },
        { code: 'RSTVA', n: invalidRasRows(annexes.rstva.rows, 'rstva'), to: '/declarations/rstva' },
        {
            code: 'TVA',
            n: invalidTvaDedRows(annexes.tva.deductible) + invalidTvaAvRows(annexes.tva.avances),
            to: '/declarations/tva',
        },
        { code: 'PREL', n: invalidPrelRows(annexes.prel.rows), to: '/declarations/prel' },
    ];
    const totalInvalid = invalidByAnnex.reduce((s, x) => s + x.n, 0);
    const invalidLabels = invalidByAnnex.filter((x) => x.n > 0);
    const serverErrorCount = serverValidation.errors.length;
    const totalInvalidAll = totalInvalid + serverErrorCount;

    const validationPayload = useMemo(
        () => ({
            annexes,
        }),
        [annexes]
    );

    const canGenerate = totalInvalidAll === 0 && !serverValidation.loading && !exporting;
    const canGenerateBulletins = canGenerate && bulletinGen !== 'loading';
    const canGeneratePack = canGenerate && bulletinGen !== 'loading';
    const firstGenPay = computeOmTotal(ANNEXES_FIRST_BASE, OM_FEE_RATE);
    const duplicatePay = computeOmTotal(ANNEXES_DUP_BASE, OM_FEE_RATE);
    const bulletinsPay = computeOmTotal(BULLETINS_BASE, OM_FEE_RATE);
    const packPay = computeOmTotal(ANNEXES_BULLETINS_PACK_BASE, OM_FEE_RATE);

    useEffect(() => {
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setServerValidation((s) => ({ ...s, loading: true, failed: false }));
            try {
                await contribuableApi.validate(validationPayload);
                if (cancelled) return;
                setServerValidation({ loading: false, ok: true, errors: [], failed: false });
            } catch (e: any) {
                if (cancelled) return;
                const status = e?.response?.status;
                if (status === 422 && e?.response?.data) {
                    const data = e.response.data as { ok?: boolean; errors?: ValidationApiError[] };
                    setServerValidation({
                        loading: false,
                        ok: Boolean(data.ok),
                        errors: Array.isArray(data.errors) ? data.errors : [],
                        failed: false,
                    });
                    return;
                }
                setServerValidation({ loading: false, ok: false, errors: [], failed: true });
            }
        }, 350);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [validationPayload]);

    return (
        <div className="max-w-[820px] space-y-6">
            {PaymentModalComponent}
            <div>
                <h2 className="text-lg font-extrabold text-gray-900">Génération des documents</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Période sélectionnée : <strong>{moisLabel}</strong> {period.year}. Les PDF sont générés à partir des
                    données saisies dans les annexes (et des bulletins côté paie pour l’option salaires).
                </p>
                <p className="mt-1 text-xs text-gray-500">
                    Les totaux affichés et exportés correspondent aux obligations fiscales CGI calculées depuis les annexes saisies.
                </p>
                <p className="mt-1 text-xs text-gray-500">Référentiel appliqué : CGI {period.year}</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <strong>Paiement {OM}</strong> : l’intégration du flux de paiement (API marchand / callback) sera
                branchée côté serveur. Ici, les montants et règles métier sont figés comme demandé.
            </div>
            {totalInvalidAll > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    <strong>Pré-contrôle conformité CGI :</strong> {totalInvalidAll} anomalie(s) détectée(s) sur les
                    annexes.
                    Corrigez d’abord :
                    <div className="mt-2 flex flex-wrap gap-2">
                        {invalidLabels.map((x) => (
                            <Link
                                key={x.code}
                                to={x.to}
                                className="inline-flex items-center rounded-full border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                                {x.code} ({x.n})
                            </Link>
                        ))}
                    </div>
                    {serverErrorCount > 0 && (
                        <div className="mt-2">
                            <p className="text-xs">
                                Validation serveur : {serverErrorCount} erreur(s) détectée(s) supplémentaires.
                            </p>
                            <ul className="mt-1 list-disc pl-5 text-xs">
                                {serverValidation.errors.slice(0, 3).map((err, idx) => (
                                    <li key={`${err.annexe}-${err.row}-${err.field}-${idx}`}>
                                        {err.annexe} · ligne {err.row + 1} · {err.field} : {err.message}
                                    </li>
                                ))}
                            </ul>
                            {serverErrorCount > 3 && (
                                <p className="mt-1 text-xs opacity-80">
                                    + {serverErrorCount - 3} autre(s) erreur(s) serveur.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <strong>Pré-contrôle conformité CGI :</strong> aucune anomalie détectée sur les annexes saisies.
                </div>
            )}
            {serverValidation.loading && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-900">
                    Validation serveur en cours...
                </div>
            )}
            {serverValidation.failed && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                    Validation serveur indisponible pour le moment. Le contrôle local reste actif.
                </div>
            )}
            {bulletinGen === 'error' && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900">
                    Impossible de générer les bulletins pour le moment. Vérifiez que les lignes IUTS du formulaire
                    Contribuable sont correctement saisies.
                </div>
            )}

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-green-600 p-2 text-white">
                        <FileDown className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-gray-900">Pack annexes de déclaration (PDF)</h3>
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                            Une fois par mois, vous pouvez lancer la <strong>génération de toutes les annexes</strong>{' '}
                            (IUTS, ROS/CNSS, TPA, RSFON, RSLIB, RSETR, RSPRE, RSTVA, TVA, prélèvements…) en un seul
                            clic, en <strong>documents PDF imprimables</strong>.
                        </p>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
                            <li>
                                <strong>Première génération du mois</strong> : <strong>5 000 F CFA</strong> via{' '}
                                {OM} + frais 1,5% (<strong>{firstGenPay.fee.toLocaleString('fr-FR')} F CFA</strong>)
                                soit <strong>{firstGenPay.total.toLocaleString('fr-FR')} F CFA</strong>.
                            </li>
                            <li>
                                <strong>Régénération / duplicata</strong> (même mois) : <strong>3 000 F CFA</strong> via{' '}
                                {OM} + frais 1,5% (<strong>{duplicatePay.fee.toLocaleString('fr-FR')} F CFA</strong>)
                                soit <strong>{duplicatePay.total.toLocaleString('fr-FR')} F CFA</strong>.
                            </li>
                            <li>
                                <strong>Forfait Annexe + Bulletins</strong> : <strong>8 000 F CFA</strong> via {OM} +
                                frais 1,5% (<strong>{packPay.fee.toLocaleString('fr-FR')} F CFA</strong>) soit{' '}
                                <strong>{packPay.total.toLocaleString('fr-FR')} F CFA</strong>.
                            </li>
                        </ul>
                        <p className="mt-3 text-xs text-gray-500">
                            Cliquer sur « Générer » vaut acceptation du paiement et lancement de la production de{' '}
                            <strong>tous</strong> les PDF d’annexes disponibles pour la période.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                disabled={!canGenerate}
                                onClick={() => {
                                    requestPayment('annexe', `annexes-${period.year}-${period.month}`, async () => {
                                        setExporting(true);
                                        try {
                                            await exportContribuableAnnexesPDF(
                                                { company, period, annexes },
                                                { paymentBaseAmount: ANNEXES_FIRST_BASE }
                                            );
                                        } finally {
                                            setExporting(false);
                                        }
                                    });
                                }}
                                className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white ${canGenerate ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 opacity-60 cursor-not-allowed'}`}
                                title={
                                    totalInvalidAll > 0
                                        ? 'Génération bloquée : corriger les anomalies de conformité'
                                        : serverValidation.loading
                                          ? 'Validation en cours...'
                                          : exporting
                                            ? 'Génération en cours...'
                                          : 'Générer le pack PDF'
                                }
                            >
                                <FileDown className="h-4 w-4" />
                                {exporting ? 'Génération...' : 'Générer les annexes PDF'}
                            </button>
                            <button
                                type="button"
                                disabled={!canGenerate}
                                onClick={() => {
                                    requestPayment('duplicata', `annexes-dup-${period.year}-${period.month}`, async () => {
                                        setExporting(true);
                                        try {
                                            await exportContribuableAnnexesPDF(
                                                { company, period, annexes },
                                                { duplicate: true, paymentBaseAmount: ANNEXES_DUP_BASE }
                                            );
                                        } finally {
                                            setExporting(false);
                                        }
                                    });
                                }}
                                className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold ${canGenerate ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-300 bg-white text-gray-500 opacity-60 cursor-not-allowed'}`}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Régénérer (duplicata)
                            </button>
                            <button
                                type="button"
                                disabled={!canGeneratePack}
                                onClick={() => {
                                    requestPayment('annexe_bulletin', `pack-${period.year}-${period.month}`, async () => {
                                        setExporting(true);
                                        setBulletinGen('loading');
                                        try {
                                            await exportContribuableAnnexesPDF(
                                                { company, period, annexes },
                                                { paymentBaseAmount: ANNEXES_BULLETINS_PACK_BASE }
                                            );
                                            if (bulletinsFromContribuable.length === 0) {
                                                throw new Error('no-iuts');
                                            }
                                            await exportAllBulletinsPDF(
                                                bulletinsFromContribuable,
                                                companyForBulletins,
                                                { paymentBaseAmount: ANNEXES_BULLETINS_PACK_BASE }
                                            );
                                            setBulletinGen('idle');
                                        } catch {
                                            setBulletinGen('error');
                                        } finally {
                                            setExporting(false);
                                        }
                                    });
                                }}
                                className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold ${canGeneratePack ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-gray-300 bg-white text-gray-500 opacity-60 cursor-not-allowed'}`}
                            >
                                <FileDown className="h-4 w-4" />
                                Générer Annexe + Bulletins
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <p className="text-xs text-gray-500">
                Complétez d’abord les tableaux dans les onglets d’annexes, puis revenez ici pour générer les
                documents conformes.
            </p>

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-slate-700 p-2 text-white">
                        <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-gray-900">Bulletins de salaire (tous les employés)</h3>
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                            Option distincte du pack PDF : générer <strong>tous les bulletins de paie</strong>{' '}
                            directement à partir des lignes IUTS du formulaire Contribuable.
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                            Facturation : {BULLETINS_BASE.toLocaleString('fr-FR')} F CFA + frais {OM} 1,5% (
                            {bulletinsPay.fee.toLocaleString('fr-FR')} F CFA), total{' '}
                            {bulletinsPay.total.toLocaleString('fr-FR')} F CFA.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                disabled={!canGenerateBulletins}
                                onClick={() => {
                                    requestPayment('bulletin', `bulletins-${period.year}-${period.month}`, async () => {
                                        setBulletinGen('loading');
                                        try {
                                            if (bulletinsFromContribuable.length === 0) {
                                                throw new Error('no-iuts');
                                            }
                                            await exportAllBulletinsPDF(
                                                bulletinsFromContribuable,
                                                companyForBulletins,
                                                { paymentBaseAmount: BULLETINS_BASE }
                                            );
                                            setBulletinGen('idle');
                                        } catch {
                                            setBulletinGen('error');
                                        }
                                    });
                                }}
                                className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white ${
                                    !canGenerateBulletins
                                        ? 'bg-slate-800 opacity-70 cursor-not-allowed'
                                        : 'bg-slate-800 hover:bg-slate-900'
                                }`}
                                title={
                                    totalInvalidAll > 0
                                        ? 'Génération bloquée : corriger les anomalies de conformité'
                                        : serverValidation.loading
                                          ? 'Validation en cours...'
                                          : bulletinGen === 'loading'
                                            ? 'Génération des bulletins en cours...'
                                            : 'Générer tous les bulletins'
                                }
                            >
                                <Smartphone className="h-4 w-4" />
                                {bulletinGen === 'loading'
                                    ? 'Génération des bulletins...'
                                    : 'Générer tous les bulletins'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
