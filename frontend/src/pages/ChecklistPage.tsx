import { useState, useMemo } from 'react';
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getEcheancesAnnee, nomMois, TYPE_COLORS, type Echeance } from '../lib/fiscalCalendar';

const STORAGE_KEY = 'fisca_checklist_v1';

function loadChecked(): Record<string, boolean> {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
    catch { return {}; }
}

export default function ChecklistPage() {
    const today = useMemo(() => new Date(), []);
    const [annee, setAnnee] = useState(today.getFullYear());
    const [mois, setMois] = useState(today.getMonth()); // 0-based = mois de la date limite
    const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);

    const echeances = useMemo(() => {
        // On génère N-1 et N pour couvrir janvier (obligations déc → jan 15)
        const all = [
            ...getEcheancesAnnee(annee - 1, today),
            ...getEcheancesAnnee(annee, today),
        ];
        return all
            .filter(e => e.date.getFullYear() === annee && e.date.getMonth() === mois)
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [annee, mois, today]);

    const toggle = (id: string) => {
        setChecked(prev => {
            const next = { ...prev, [id]: !prev[id] };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const doneCount = echeances.filter(e => checked[e.id]).length;
    const total = echeances.length;
    const pct = total === 0 ? 100 : Math.round((doneCount / total) * 100);

    const prevMois = () => {
        if (mois === 0) { setAnnee(a => a - 1); setMois(11); }
        else setMois(m => m - 1);
    };
    const nextMois = () => {
        if (mois === 11) { setAnnee(a => a + 1); setMois(0); }
        else setMois(m => m + 1);
    };

    const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';
    const circleClass = pct === 100
        ? 'bg-green-100 text-green-700'
        : pct >= 50 ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700';

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Checklist mensuelle</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Cochez les obligations fiscales accomplies pour ce mois</p>
                </div>
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                    <button onClick={prevMois} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold text-gray-800 w-36 text-center">
                        {nomMois(mois)} {annee}
                    </span>
                    <button onClick={nextMois} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Barre de progression */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-lg font-bold text-gray-900">{doneCount} / {total} accomplies</p>
                        <p className="text-sm text-gray-500">Taux de conformité fiscale : {pct} %</p>
                    </div>
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${circleClass}`}>
                        {pct}%
                    </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                {pct === 100 && total > 0 && (
                    <p className="text-xs text-green-600 font-semibold mt-2 text-center">
                        Toutes les obligations sont accomplies pour {nomMois(mois)} {annee}
                    </p>
                )}
            </div>

            {/* Liste des obligations */}
            {echeances.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-10 text-center border border-gray-100">
                    <p className="text-gray-400 text-sm">Aucune obligation fiscale pour {nomMois(mois)} {annee}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {echeances.map((e: Echeance) => {
                        const done = !!checked[e.id];
                        const dot = TYPE_COLORS[e.type] ?? '#94a3b8';
                        const itemBg = done
                            ? 'border-green-200 bg-green-50/60'
                            : e.urgence === 'critique' ? 'border-red-200 bg-red-50'
                                : e.urgence === 'proche' ? 'border-amber-200 bg-amber-50'
                                    : 'border-gray-100 bg-white';
                        const urgLabel = !done && e.urgence === 'critique'
                            ? <span className="text-[10px] font-bold text-red-600 animate-pulse">URGENT</span>
                            : !done && e.urgence === 'proche'
                                ? <span className="text-[10px] font-semibold text-amber-600">Bientôt</span>
                                : null;
                        return (
                            <button
                                key={e.id}
                                onClick={() => toggle(e.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left hover:shadow-sm ${itemBg}`}
                            >
                                {done
                                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                    : <Circle className="w-5 h-5 text-gray-300 shrink-0" />
                                }
                                <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: dot }} />
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold leading-tight ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                        {e.label}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">{e.description}</p>
                                </div>
                                <div className="text-right shrink-0 space-y-0.5">
                                    <p className="text-xs font-semibold text-gray-700">
                                        {e.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                    </p>
                                    {urgLabel}
                                    <p className="text-[10px] text-gray-400">{e.reference}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Légende */}
            {echeances.length > 0 && (
                <p className="text-xs text-gray-400 text-center">
                    Cliquez sur une obligation pour la cocher : état sauvegardé localement
                </p>
            )}
        </div>
    );
}
