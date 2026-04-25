import { useContribuableStore } from '../contribuableStore';
import { MOIS_LABELS } from '../contribuableNav';

export default function FormIdentityBar() {
    const company = useContribuableStore((s) => s.company);
    const period = useContribuableStore((s) => s.period);
    return (
        <div className="mb-3.5 rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50/80">
                <div className="px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Raison sociale</div>
                    <div className="text-[13px] font-medium text-gray-800 truncate">
                        {company.raisonSociale || (
                            <span className="text-gray-300 italic">Non renseigné</span>
                        )}
                    </div>
                </div>
                <div className="px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">IFU</div>
                    <div className="text-[13px] font-medium text-gray-800">{company.ifu || '—'}</div>
                </div>
                <div className="px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Exercice</div>
                    <div className="text-[13px] font-medium text-gray-800">{period.year}</div>
                </div>
                <div className="px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Mois</div>
                    <div className="text-[13px] font-medium text-gray-800">
                        {MOIS_LABELS[period.month] ?? '—'}
                    </div>
                </div>
            </div>
            <div className="px-3 py-2 text-[11px] text-gray-500 bg-white">
                Règles fiscales appliquées : CGI {period.year}
            </div>
        </div>
    );
}
