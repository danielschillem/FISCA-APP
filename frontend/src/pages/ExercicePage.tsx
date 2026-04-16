import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exerciceApi } from '../lib/api';
import { Card, Btn, Input, Badge, Spinner } from '../components/ui';
import type { ExerciceFiscal } from '../types';
import { CheckCircle2, AlertCircle, Lock, FolderOpen, Plus } from 'lucide-react';

export default function ExercicePage() {
    const qc = useQueryClient();
    const [creating, setCreating] = useState(false);
    const [newForm, setNewForm] = useState({ annee: new Date().getFullYear(), date_debut: '', date_fin: '', note: '' });
    const [error, setError] = useState('');
    const [cloturerId, setCloturerId] = useState<string | null>(null);

    const { data: exercices = [], isLoading } = useQuery<ExerciceFiscal[]>({
        queryKey: ['exercices'],
        queryFn: () => exerciceApi.list().then((r) => r.data),
    });

    const { data: actif } = useQuery<ExerciceFiscal>({
        queryKey: ['exercice-actif'],
        queryFn: () => exerciceApi.actif().then((r) => r.data),
        retry: false,
    });

    const create = useMutation({
        mutationFn: (data: object) => exerciceApi.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['exercices'] });
            qc.invalidateQueries({ queryKey: ['exercice-actif'] });
            setCreating(false);
            setNewForm({ annee: new Date().getFullYear(), date_debut: '', date_fin: '', note: '' });
            setError('');
        },
        onError: (err: { response?: { data?: { error?: string } } }) => {
            setError(err?.response?.data?.error ?? 'Erreur lors de la création.');
        },
    });

    const cloturer = useMutation({
        mutationFn: (id: string) => exerciceApi.cloturer(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['exercices'] });
            qc.invalidateQueries({ queryKey: ['exercice-actif'] });
            setCloturerId(null);
        },
    });

    const handleCreate = () => {
        setError('');
        if (!newForm.date_debut || !newForm.date_fin) {
            setError('Les dates de début et fin sont requises.');
            return;
        }
        create.mutate(newForm);
    };

    if (isLoading) return <Spinner />;

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Exercice actif */}
            {actif ? (
                <Card>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                <FolderOpen className="w-5 h-5 text-green-700" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Exercice en cours</p>
                                <p className="text-lg font-bold text-gray-900">{actif.annee}</p>
                                <p className="text-xs text-gray-500">{actif.date_debut} → {actif.date_fin}</p>
                                {actif.note && <p className="text-xs text-gray-400 mt-1 italic">{actif.note}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge color="green">En cours</Badge>
                            {cloturerId === actif.id ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-red-600">Confirmer la clôture ?</span>
                                    <Btn size="sm" onClick={() => cloturer.mutate(actif.id)} disabled={cloturer.isPending}>
                                        {cloturer.isPending ? 'Clôture…' : 'Confirmer'}
                                    </Btn>
                                    <Btn size="sm" variant="outline" onClick={() => setCloturerId(null)}>Annuler</Btn>
                                </div>
                            ) : (
                                <Btn size="sm" variant="outline" onClick={() => setCloturerId(actif.id)}>
                                    <Lock className="w-3.5 h-3.5" /> Clôturer
                                </Btn>
                            )}
                        </div>
                    </div>
                </Card>
            ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Aucun exercice fiscal en cours. Créez un nouvel exercice pour commencer.
                </div>
            )}

            {/* Create exercice */}
            <Card title="Créer un exercice fiscal">
                {!creating ? (
                    <Btn variant="outline" onClick={() => setCreating(true)}>
                        <Plus className="w-4 h-4" /> Nouvel exercice
                    </Btn>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Année"
                                type="number"
                                value={String(newForm.annee)}
                                onChange={(e) => setNewForm((f) => ({ ...f, annee: +e.target.value }))}
                            />
                            <Input
                                label="Note (optionnel)"
                                value={newForm.note}
                                onChange={(e) => setNewForm((f) => ({ ...f, note: e.target.value }))}
                                placeholder="Ex: Exercice principal 2025"
                            />
                            <Input
                                label="Date de début"
                                type="date"
                                value={newForm.date_debut}
                                onChange={(e) => setNewForm((f) => ({ ...f, date_debut: e.target.value }))}
                            />
                            <Input
                                label="Date de fin"
                                type="date"
                                value={newForm.date_fin}
                                onChange={(e) => setNewForm((f) => ({ ...f, date_fin: e.target.value }))}
                            />
                        </div>
                        {error && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />{error}
                            </p>
                        )}
                        <div className="flex gap-2 justify-end">
                            <Btn variant="outline" onClick={() => { setCreating(false); setError(''); }}>Annuler</Btn>
                            <Btn onClick={handleCreate} disabled={create.isPending}>
                                {create.isPending ? 'Création…' : <><CheckCircle2 className="w-4 h-4" /> Créer</>}
                            </Btn>
                        </div>
                    </div>
                )}
            </Card>

            {/* Exercice list */}
            {exercices.length > 0 && (
                <Card title="Historique des exercices">
                    <div className="divide-y divide-gray-50">
                        {exercices.map((ex) => (
                            <div key={ex.id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{ex.annee}</p>
                                    <p className="text-xs text-gray-400">{ex.date_debut} → {ex.date_fin}</p>
                                    {ex.note && <p className="text-xs text-gray-400 italic">{ex.note}</p>}
                                </div>
                                <div className="flex items-center gap-3">
                                    {ex.date_cloture && (
                                        <span className="text-xs text-gray-400">Clôturé le {ex.date_cloture}</span>
                                    )}
                                    <Badge color={ex.statut === 'en_cours' ? 'green' : 'gray'}>
                                        {ex.statut === 'en_cours' ? 'En cours' : 'Clôturé'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
