import { useState, useMemo } from 'react';
import {
    getEcheancesAnnee, grouperParMois, TYPE_COLORS, nomMois,
    type Echeance, type EcheanceType,
} from '../lib/fiscalCalendar';
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle2, Info } from 'lucide-react';

// ─── Types filter ─────────────────────────────────────────────────────────────
const ALL_TYPES: EcheanceType[] = ['IUTS', 'CNSS', 'TVA', 'IS_acompte', 'IS_solde', 'Patente', 'IRF', 'IRCM', 'RAS', 'CME', 'TP'];
const TYPE_LABELS: Record<EcheanceType, string> = {
    IUTS: 'IUTS', CNSS: 'CNSS', TVA: 'TVA',
    IS_acompte: 'IS Acompte', IS_solde: 'IS Solde',
    Patente: 'Patente', IRF: 'IRF', IRCM: 'IRCM',
    RAS: 'Retenue', CME: 'CME', TP: 'Taxe Prof.',
};

// ─── Urgence badge ────────────────────────────────────────────────────────────
function UrgenceBadge({ e }: { e: Echeance }) {
    if (e.urgence === 'passe') return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">Passée</span>
    );
    if (e.urgence === 'critique') return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold animate-pulse">
            J-{e.joursRestants === 0 ? "0 Aujourd'hui" : e.joursRestants}
        </span>
    );
    if (e.urgence === 'proche') return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-semibold">J-{e.joursRestants}</span>
    );
    return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
            {e.joursRestants}j
        </span>
    );
}

// ─── Single échéance card ─────────────────────────────────────────────────────
function EcheanceCard({ e, today }: { e: Echeance; today: Date }) {
    const [open, setOpen] = useState(false);
    const dot = TYPE_COLORS[e.type];
    const isPast = e.urgence === 'passe';
    const borderClass =
        e.urgence === 'critique' ? 'border-red-200 bg-red-50/40' :
            e.urgence === 'proche' ? 'border-amber-200 bg-amber-50/30' :
                isPast ? 'border-gray-100 bg-gray-50/30 opacity-60' :
                    'border-gray-100 bg-white';

    return (
        <div className={`rounded-xl border ${borderClass} transition-all`}>
            <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setOpen(o => !o)}
            >
                <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ background: dot }} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{e.label}</span>
                        {!isPast && <UrgenceBadge e={e} />}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{e.description}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-bold text-gray-700 whitespace-nowrap">
                        {e.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                </div>
                <Info className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180 text-green-600' : 'text-gray-300'}`} />
            </button>
            {open && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 mt-0">
                    <div className="bg-white rounded-lg p-3 mt-3 space-y-2 border border-gray-100">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Référence légale</span>
                            <span className="font-medium text-gray-700">{e.reference}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Date limite</span>
                            <span className="font-medium text-gray-700">
                                {e.jourLimite} {nomMois(e.moisCible)} {e.annee}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Accès plan</span>
                            <span className={`font-semibold capitalize ${e.plan === 'all' ? 'text-green-600' :
                                    e.plan === 'pro' ? 'text-blue-600' : 'text-orange-600'
                                }`}>
                                {e.plan === 'all' ? 'Tous plans' : e.plan}
                            </span>
                        </div>
                        {!isPast && (
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Jours restants</span>
                                <span className={`font-bold ${e.urgence === 'critique' ? 'text-red-600' :
                                        e.urgence === 'proche' ? 'text-amber-600' : 'text-gray-700'
                                    }`}>
                                    {e.joursRestants === 0 ? "Aujourd'hui !" :
                                        e.joursRestants === 1 ? 'Demain' :
                                            `${e.joursRestants} jours`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({ echeances, today }: { echeances: Echeance[]; today: Date }) {
    const critiques = echeances.filter(e => e.urgence === 'critique').length;
    const proches = echeances.filter(e => e.urgence === 'proche').length;
    const aVenir = echeances.filter(e => e.urgence === 'normal').length;
    const passees = echeances.filter(e => e.urgence === 'passe').length;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
                { label: 'Critiques (< 3j)', val: critiques, bg: 'bg-red-50 border-red-200', text: 'text-red-600', icon: <AlertTriangle className="w-4 h-4" /> },
                { label: 'Proches (< 7j)', val: proches, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600', icon: <Clock className="w-4 h-4" /> },
                { label: 'A venir', val: aVenir, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600', icon: <CalendarDays className="w-4 h-4" /> },
                { label: 'Passees', val: passees, bg: 'bg-gray-50 border-gray-200', text: 'text-gray-400', icon: <CheckCircle2 className="w-4 h-4" /> },
            ].map(s => (
                <div key={s.label} className={`${s.bg} border rounded-xl p-3 flex items-center gap-3`}>
                    <div className={s.text}>{s.icon}</div>
                    <div>
                        <p className={`text-xl font-bold ${s.text}`}>{s.val}</p>
                        <p className="text-[11px] text-gray-500">{s.label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CalendrierFiscalPage() {
    const today = useMemo(() => new Date(), []);
    const [annee, setAnnee] = useState(today.getFullYear());
    const [filtreTypes, setFiltreTypes] = useState<Set<EcheanceType>>(new Set());
    const [filtreMois, setFiltreMois] = useState<number | null>(null);

    const toutes = useMemo(() => getEcheancesAnnee(annee, today), [annee, today]);

    const filtrees = useMemo(() => toutes.filter(e => {
        if (filtreTypes.size > 0 && !filtreTypes.has(e.type)) return false;
        if (filtreMois !== null && e.moisCible !== filtreMois) return false;
        return true;
    }), [toutes, filtreTypes, filtreMois]);

    const groupes = useMemo(() => grouperParMois(filtrees), [filtrees]);

    const toggleType = (t: EcheanceType) => {
        setFiltreTypes(prev => {
            const next = new Set(prev);
            next.has(t) ? next.delete(t) : next.add(t);
            return next;
        });
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Calendrier fiscal</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Toutes vos obligations fiscales — CGI 2025, Burkina Faso
                    </p>
                </div>
                {/* Year selector */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
                    <button onClick={() => setAnnee(a => a - 1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold text-gray-800 w-10 text-center">{annee}</span>
                    <button onClick={() => setAnnee(a => a + 1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <StatsBar echeances={filtrees} today={today} />

            {/* Filters */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                {/* Type filter */}
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Type d'impôt</p>
                    <div className="flex flex-wrap gap-1.5">
                        {ALL_TYPES.map(t => {
                            const active = filtreTypes.has(t);
                            const color = TYPE_COLORS[t];
                            return (
                                <button
                                    key={t}
                                    onClick={() => toggleType(t)}
                                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${active
                                            ? 'text-white border-transparent shadow-sm'
                                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                        }`}
                                    style={active ? { background: color, borderColor: color } : {}}
                                >
                                    {TYPE_LABELS[t]}
                                </button>
                            );
                        })}
                        {filtreTypes.size > 0 && (
                            <button onClick={() => setFiltreTypes(new Set())}
                                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                                Tout afficher
                            </button>
                        )}
                    </div>
                </div>
                {/* Month filter */}
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mois</p>
                    <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 12 }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => setFiltreMois(filtreMois === i ? null : i)}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${filtreMois === i
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                {nomMois(i).slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Critique (&lt; 3j)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Proche (&lt; 7j)</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />A venir</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300" />Passee</div>
            </div>

            {/* Timeline par mois */}
            {groupes.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm shadow-sm">
                    Aucune echeance pour les filtres selectionnes
                </div>
            ) : (
                groupes.map(groupe => {
                    const isCurrentMonth = groupe.mois === today.getMonth() && groupe.annee === today.getFullYear();
                    return (
                        <div key={`${groupe.annee}-${groupe.mois}`}>
                            {/* Month header */}
                            <div className={`flex items-center gap-3 mb-3`}>
                                <div className={`px-3 py-1 rounded-lg text-sm font-bold ${isCurrentMonth
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {nomMois(groupe.mois)} {groupe.annee}
                                </div>
                                {isCurrentMonth && (
                                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        Mois actuel
                                    </span>
                                )}
                                <span className="text-xs text-gray-400">{groupe.echeances.length} echeance(s)</span>
                            </div>

                            {/* Echeances du mois */}
                            <div className="space-y-2 ml-1">
                                {groupe.echeances.map(e => (
                                    <EcheanceCard key={e.id} e={e} today={today} />
                                ))}
                            </div>

                            <div className="mt-4 mb-6 border-b border-gray-100" />
                        </div>
                    );
                })
            )}
        </div>
    );
}
