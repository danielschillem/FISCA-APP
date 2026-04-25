import type { BilanData, DashboardKPI, Declaration, HistoriqueFiscalAnnee, HistoriqueFiscalMois } from '../types';
import type { ContribuableState } from '../contribuable/contribuableStore';
import { calcCNSSPatronale, calcFSP, calcTPA } from '../contribuable/contribuableCalc';
import { getFiscalRules } from '../contribuable/fiscalRules';
import { MOIS_LABELS } from '../contribuable/contribuableNav';

function monthStatus(values: string[]): 'ok' | 'retard' | 'en_cours' {
    if (values.includes('retard')) return 'retard';
    if (values.includes('en_cours')) return 'en_cours';
    return 'ok';
}

function aggregateMonth(rows: Declaration[], mois: number, annee: number) {
    const monthRows = rows.filter((d) => d.mois === mois && d.annee === annee);
    return {
        mois,
        annee,
        periode: `${String(mois).padStart(2, '0')}/${annee}`,
        brut_total: monthRows.reduce((s, d) => s + (d.brut_total || 0), 0),
        iuts_total: monthRows.reduce((s, d) => s + (d.iuts_total || 0), 0),
        tpa_total: monthRows.reduce((s, d) => s + (d.tpa_total || 0), 0),
        css_total: monthRows.reduce((s, d) => s + (d.css_total || 0), 0),
        total: monthRows.reduce((s, d) => s + (d.total || 0), 0),
        nb_salaries: monthRows.reduce((s, d) => s + (d.nb_salaries || 0), 0),
        statut: monthRows.length ? monthStatus(monthRows.map((d) => d.statut)) : 'en_cours',
    };
}

export function computeDashboardKpiFromDeclarations(
    declarations: Declaration[],
    nbEmployes: number,
    refDate = new Date()
): DashboardKPI {
    const year = refDate.getFullYear();
    const month = refDate.getMonth() + 1;
    const current = aggregateMonth(declarations, month, year);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const previous = aggregateMonth(declarations, prevMonth, prevYear);
    const yearRows = declarations.filter((d) => d.annee === year);
    const totalYear = {
        annee: year,
        brut_total: yearRows.reduce((s, d) => s + (d.brut_total || 0), 0),
        iuts_total: yearRows.reduce((s, d) => s + (d.iuts_total || 0), 0),
        tpa_total: yearRows.reduce((s, d) => s + (d.tpa_total || 0), 0),
        css_total: yearRows.reduce((s, d) => s + (d.css_total || 0), 0),
        total: yearRows.reduce((s, d) => s + (d.total || 0), 0),
    };
    const evoIuts =
        previous.iuts_total > 0 ? ((current.iuts_total - previous.iuts_total) / previous.iuts_total) * 100 : 0;
    const evoBrut =
        previous.brut_total > 0 ? ((current.brut_total - previous.brut_total) / previous.brut_total) * 100 : 0;
    const alertes = declarations
        .filter((d) => d.statut === 'retard')
        .map((d) => ({
            declaration_id: d.id,
            ref: d.ref ?? '',
            periode: d.periode,
            mois: d.mois,
            annee: d.annee,
            statut: d.statut,
        }));
    return {
        nb_employes: nbEmployes,
        nb_declarations: declarations.length,
        mois_courant: current,
        mois_precedent: previous,
        evolution_iuts_pct: Number(evoIuts.toFixed(1)),
        evolution_brut_pct: Number(evoBrut.toFixed(1)),
        total_annee: totalYear,
        alertes_retard: alertes,
        plan: { plan: '', nb_employes: nbEmployes, limite_employes: Infinity },
    };
}

export function computeHistoriqueFromDeclarations(
    declarations: Declaration[],
    annee: number
): HistoriqueFiscalAnnee {
    const months: HistoriqueFiscalMois[] = Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        const agg = aggregateMonth(declarations, m, annee);
        return {
            mois: m,
            periode: agg.periode,
            iuts_total: agg.iuts_total,
            tpa_total: agg.tpa_total,
            css_total: agg.css_total,
            cnss_patronal: 0,
            tva_nette: 0,
            retenue_total: 0,
            total_obligations: agg.total,
        };
    });
    return {
        annee,
        iuts_total: months.reduce((s, m) => s + m.iuts_total, 0),
        tpa_total: months.reduce((s, m) => s + m.tpa_total, 0),
        css_total: months.reduce((s, m) => s + m.css_total, 0),
        cnss_patronal: 0,
        tva_nette: 0,
        retenue_total: 0,
        total_obligations: months.reduce((s, m) => s + m.total_obligations, 0),
        mois: months,
    };
}

export function computeBilanFromDeclarations(declarations: Declaration[], annee: number): BilanData {
    const yearRows = declarations.filter((d) => d.annee === annee);
    const iuts = yearRows.reduce((s, d) => s + (d.iuts_total || 0), 0);
    const tpa = yearRows.reduce((s, d) => s + (d.tpa_total || 0), 0);
    const css = yearRows.reduce((s, d) => s + (d.css_total || 0), 0);
    return {
        annee,
        iuts,
        tpa,
        css,
        ras: 0,
        tva: 0,
        cnss_patronal: 0,
        irf: 0,
        ircm: 0,
        is: 0,
        cme: 0,
        patente: 0,
        total: iuts + tpa + css,
    };
}

type AnnexesState = ContribuableState['annexes'];
type PeriodState = ContribuableState['period'];

function buildAnnexSnapshot(annexes: AnnexesState, period: PeriodState) {
    const rules = getFiscalRules(period.year);
    const iutsRows = annexes.iuts.rows;
    const iuts = iutsRows.reduce((s, r) => s + (r.iutsDu || 0), 0);
    const tpa = iutsRows.reduce((s, r) => s + calcTPA(r.salaireB || 0, period.year), 0);
    const css = iutsRows.reduce((s, r) => s + (r.cnss || 0), 0);
    const brut = iutsRows.reduce((s, r) => s + (r.salaireB || 0), 0);
    const cnssPatronal = iutsRows.reduce((s, r) => s + calcCNSSPatronale(r.salaireB || 0, period.year), 0);
    const fsp = iutsRows.reduce((s, r) => s + calcFSP(r.salaireB || 0, r.cnss || 0, r.iutsDu || 0), 0);

    const ras =
        annexes.rsfon.rows.reduce((s, r) => s + (r.retenue || 0), 0) +
        annexes.rslib.rows.reduce((s, r) => s + (r.retenue || 0), 0) +
        annexes.rsetr.rows.reduce((s, r) => s + (r.retenue || 0), 0) +
        annexes.rspre.rows.reduce((s, r) => s + (r.retenue || 0), 0) +
        annexes.rstva.rows.reduce((s, r) => s + (r.retenue || 0), 0);

    const tvaDeductible = annexes.tva.deductible.reduce((s, r) => s + (r.tvaDed || 0), 0);
    const tvaCollectee = annexes.tva.avances.reduce((s, r) => s + ((r.htva || 0) * rules.tva.standardRate), 0);
    const tvaNette = Math.max(0, Math.round(tvaCollectee - tvaDeductible));
    const prel = annexes.prel.rows.reduce((s, r) => s + (r.prelevement || 0), 0);

    const total = iuts + tpa + css + fsp + cnssPatronal + ras + tvaNette + prel;
    return {
        brut,
        iuts,
        tpa,
        css,
        fsp,
        cnssPatronal,
        ras,
        tvaNette,
        prel,
        total,
        nbSalaries: iutsRows.length,
    };
}

export function buildDeclarationFromAnnexes(annexes: AnnexesState, period: PeriodState): Declaration {
    const snapshot = buildAnnexSnapshot(annexes, period);
    const hasData =
        snapshot.nbSalaries > 0 ||
        annexes.rsfon.rows.length > 0 ||
        annexes.rslib.rows.length > 0 ||
        annexes.rsetr.rows.length > 0 ||
        annexes.rspre.rows.length > 0 ||
        annexes.rstva.rows.length > 0 ||
        annexes.tva.deductible.length > 0 ||
        annexes.tva.avances.length > 0 ||
        annexes.prel.rows.length > 0;
    const monthLabel = MOIS_LABELS[period.month] ?? String(period.month);
    return {
        id: `local-annexes-${period.year}-${period.month}`,
        company_id: 'local-contribuable',
        periode: `${monthLabel} ${period.year}`,
        mois: period.month,
        annee: period.year,
        nb_salaries: snapshot.nbSalaries,
        brut_total: snapshot.brut,
        iuts_total: snapshot.iuts,
        tpa_total: snapshot.tpa,
        css_total: snapshot.css,
        total: snapshot.total,
        statut: hasData ? 'ok' : 'en_cours',
        ref: 'LOCAL-ANNEXES',
        date_depot: null,
        created_at: new Date().toISOString(),
    };
}

export function computeDashboardKpiFromAnnexes(
    annexes: AnnexesState,
    period: PeriodState,
    refDate = new Date()
): DashboardKPI {
    const current = buildAnnexSnapshot(annexes, period);
    const targetYear = refDate.getFullYear();
    const targetMonth = refDate.getMonth() + 1;
    const isCurrentTarget = period.year === targetYear && period.month === targetMonth;
    const monthCurrent = {
        mois: targetMonth,
        annee: targetYear,
        periode: `${String(targetMonth).padStart(2, '0')}/${targetYear}`,
        brut_total: isCurrentTarget ? current.brut : 0,
        iuts_total: isCurrentTarget ? current.iuts : 0,
        tpa_total: isCurrentTarget ? current.tpa : 0,
        css_total: isCurrentTarget ? current.css : 0,
        total: isCurrentTarget ? current.total : 0,
        nb_salaries: isCurrentTarget ? current.nbSalaries : 0,
        statut: isCurrentTarget ? 'ok' : 'en_cours',
    };
    return {
        nb_employes: current.nbSalaries,
        nb_declarations: current.total > 0 ? 1 : 0,
        mois_courant: monthCurrent,
        mois_precedent: {
            mois: targetMonth === 1 ? 12 : targetMonth - 1,
            annee: targetMonth === 1 ? targetYear - 1 : targetYear,
            periode: `${String(targetMonth === 1 ? 12 : targetMonth - 1).padStart(2, '0')}/${targetMonth === 1 ? targetYear - 1 : targetYear}`,
            brut_total: 0,
            iuts_total: 0,
            tpa_total: 0,
            css_total: 0,
            total: 0,
            nb_salaries: 0,
            statut: 'en_cours',
        },
        evolution_iuts_pct: 0,
        evolution_brut_pct: 0,
        total_annee: {
            annee: targetYear,
            brut_total: period.year === targetYear ? current.brut : 0,
            iuts_total: period.year === targetYear ? current.iuts : 0,
            tpa_total: period.year === targetYear ? current.tpa : 0,
            css_total: period.year === targetYear ? current.css : 0,
            total: period.year === targetYear ? current.total : 0,
        },
        alertes_retard: [],
        plan: { plan: '', nb_employes: current.nbSalaries, limite_employes: Infinity },
    };
}

export function computeHistoriqueFromAnnexes(
    annexes: AnnexesState,
    period: PeriodState,
    annee: number
): HistoriqueFiscalAnnee {
    const snapshot = buildAnnexSnapshot(annexes, period);
    const months: HistoriqueFiscalMois[] = Array.from({ length: 12 }, (_, idx) => {
        const mois = idx + 1;
        const active = period.year === annee && period.month === mois;
        return {
            mois,
            periode: `${String(mois).padStart(2, '0')}/${annee}`,
            iuts_total: active ? snapshot.iuts : 0,
            tpa_total: active ? snapshot.tpa : 0,
            css_total: active ? snapshot.css : 0,
            cnss_patronal: active ? snapshot.cnssPatronal : 0,
            tva_nette: active ? snapshot.tvaNette : 0,
            retenue_total: active ? snapshot.ras + snapshot.prel + snapshot.fsp : 0,
            total_obligations: active ? snapshot.total : 0,
        };
    });
    return {
        annee,
        iuts_total: months.reduce((s, m) => s + m.iuts_total, 0),
        tpa_total: months.reduce((s, m) => s + m.tpa_total, 0),
        css_total: months.reduce((s, m) => s + m.css_total, 0),
        cnss_patronal: months.reduce((s, m) => s + m.cnss_patronal, 0),
        tva_nette: months.reduce((s, m) => s + m.tva_nette, 0),
        retenue_total: months.reduce((s, m) => s + m.retenue_total, 0),
        total_obligations: months.reduce((s, m) => s + m.total_obligations, 0),
        mois: months,
    };
}

export function computeBilanFromAnnexes(annexes: AnnexesState, period: PeriodState, annee: number): BilanData {
    const snapshot = buildAnnexSnapshot(annexes, period);
    const active = period.year === annee;
    const iuts = active ? snapshot.iuts : 0;
    const tpa = active ? snapshot.tpa : 0;
    const css = active ? snapshot.css : 0;
    const ras = active ? snapshot.ras + snapshot.prel : 0;
    const tva = active ? snapshot.tvaNette : 0;
    const cnss_patronal = active ? snapshot.cnssPatronal : 0;
    return {
        annee,
        iuts,
        tpa,
        css,
        ras,
        tva,
        cnss_patronal,
        irf: 0,
        ircm: 0,
        is: 0,
        cme: 0,
        patente: 0,
        total: iuts + tpa + css + ras + tva + cnss_patronal,
    };
}

