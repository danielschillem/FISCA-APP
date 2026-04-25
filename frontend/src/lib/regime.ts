/**
 * Régimes fiscaux Burkina Faso - CGI 2025
 * Centralise la logique de filtrage par régime d'imposition.
 */
import { useQuery } from '@tanstack/react-query';
import { companyApi } from './api';
import type { Company } from '../types';
import type { EcheanceType } from './fiscalCalendar';

export type RegimeFiscal = 'RNI' | 'RSI' | 'CME' | 'BNC' | '';

export interface RegimeInfo {
    label: string;
    shortLabel: string;
    description: string;
    color: string;
    bgColor: string;
    textColor: string;
    /** Routes de navigation qui s'appliquent à ce régime */
    routes: string[];
    /** Types d'échéances du calendrier fiscal applicables */
    echeances: EcheanceType[];
    /** Obligations principales (pour l'affichage) */
    obligations: string[];
}

export const REGIMES_INFO: Record<RegimeFiscal, RegimeInfo> = {
    RNI: {
        label: 'Réel Normal d\'Imposition',
        shortLabel: 'RNI',
        description: 'Toutes les obligations fiscales : IS, TVA, IUTS, Patente, IRF, IRCM, retenues à la source.',
        color: '#dc2626',
        bgColor: '#fef2f2',
        textColor: 'text-red-700',
        routes: [
            '/saisie', '/declarations', '/versements-iuts', '/tva', '/is', '/irf', '/ircm',
            '/retenues', '/cnss-patronal', '/patente', '/bulletins', '/simulateur', '/workflow',
        ],
        echeances: ['IUTS', 'CNSS', 'TVA', 'IS_acompte', 'IS_solde', 'Patente', 'IRF', 'IRCM', 'RAS', 'TP'],
        obligations: [
            'IUTS mensuel (avant le 15)',
            'TVA mensuelle (avant le 15)',
            'IS annuel + 4 acomptes trimestriels',
            'Patente (31 janvier)',
            'IRF / IRCM (30 avril)',
            'Retenues à la source (mensuel)',
        ],
    },
    RSI: {
        label: 'Réel Simplifié d\'Imposition',
        shortLabel: 'RSI',
        description: 'Obligations allégées : IS simplifié (MFP), TVA, IUTS, Patente.',
        color: '#d97706',
        bgColor: '#fffbeb',
        textColor: 'text-amber-700',
        routes: [
            '/saisie', '/declarations', '/versements-iuts', '/tva', '/is', '/irf', '/ircm',
            '/retenues', '/cnss-patronal', '/patente', '/bulletins', '/simulateur',
        ],
        echeances: ['IUTS', 'CNSS', 'TVA', 'IS_acompte', 'IS_solde', 'Patente', 'IRF', 'IRCM', 'RAS', 'TP'],
        obligations: [
            'IUTS mensuel (avant le 15)',
            'TVA mensuelle (avant le 15)',
            'IS simplifié (MFP) + acomptes',
            'Patente (31 janvier)',
            'IRF / IRCM (30 avril)',
        ],
    },
    CME: {
        label: 'Contribution Micro-Entreprises',
        shortLabel: 'CME',
        description: 'Contribution forfaitaire mensuelle. Pas d\'IS ni de TVA (sauf option).',
        color: '#0d9488',
        bgColor: '#f0fdfa',
        textColor: 'text-teal-700',
        routes: ['/cme', '/saisie', '/declarations', '/versements-iuts', '/cnss-patronal'],
        echeances: ['CME', 'IUTS', 'CNSS'],
        obligations: [
            'CME mensuelle (forfait, avant le 15)',
            'IUTS mensuel si salariés',
            'CNSS si salariés',
        ],
    },
    BNC: {
        label: 'Bénéfices Non Commerciaux',
        shortLabel: 'BNC',
        description: 'Professions libérales : médecins, avocats, comptables, consultants…',
        color: '#7c3aed',
        bgColor: '#f5f3ff',
        textColor: 'text-violet-700',
        routes: [
            '/saisie', '/declarations', '/versements-iuts', '/tva', '/irf', '/ircm',
            '/retenues', '/patente', '/bulletins', '/simulateur',
        ],
        echeances: ['IUTS', 'CNSS', 'TVA', 'Patente', 'IRF', 'IRCM', 'RAS', 'TP'],
        obligations: [
            'IUTS mensuel (avant le 15)',
            'TVA mensuelle si assujetti',
            'Patente (31 janvier)',
            'IRF / IRCM (30 avril)',
            'Retenues à la source',
        ],
    },
    '': {
        label: 'Régime non défini',
        shortLabel: '?',
        description: 'Définissez votre régime fiscal dans les Paramètres pour personnaliser votre calendrier.',
        color: '#94a3b8',
        bgColor: '#f8fafc',
        textColor: 'text-slate-500',
        routes: [],
        echeances: ['IUTS', 'CNSS', 'TVA', 'IS_acompte', 'IS_solde', 'Patente', 'IRF', 'IRCM', 'RAS', 'CME', 'TP'],
        obligations: [],
    },
};

/**
 * Hook React : lit le régime depuis la company et retourne
 * le régime courant + ses règles.
 */
export function useRegime() {
    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
        staleTime: 5 * 60_000,
    });

    const regime = (company?.regime ?? '') as RegimeFiscal;
    const info = REGIMES_INFO[regime] ?? REGIMES_INFO[''];

    /** Vrai si la route donnée (ex: '/tva' ou '/declarations/setup') s'applique au régime courant */
    const routeApplies = (route: string): boolean => {
        if (regime === '') return true; // pas de régime défini = tout visible
        return info.routes.some((reg) => route === reg || route.startsWith(`${reg}/`));
    };

    return { regime, info, company, routeApplies };
}
