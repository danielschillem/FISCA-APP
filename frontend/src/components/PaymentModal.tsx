/**
 * PaymentModal — Barrière de paiement Orange Money avant génération PDF
 *
 * Usage :
 *   const { requestPayment, PaymentModalComponent } = usePaymentGate();
 *
 *   // Dans le composant :
 *   {PaymentModalComponent}
 *   <button onClick={() => requestPayment('iuts', declaration.id, onSuccess)}>
 *     Générer PDF
 *   </button>
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { X, Smartphone, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'iuts' | 'tva' | 'retenues' | 'is' | 'ircm'
  | 'cme' | 'irf' | 'bulletin' | 'patente' | 'cnss';

const DOC_LABELS: Record<DocumentType, string> = {
  iuts: 'Déclaration IUTS/TPA',
  tva: 'Déclaration TVA',
  retenues: 'Retenues à la source (RAS)',
  is: 'Impôt sur les Sociétés (IS)',
  ircm: 'IRCM — Capitaux Mobiliers',
  cme: 'Contribution Micro-Entreprise',
  irf: 'Impôt sur les Revenus Fonciers',
  bulletin: 'Bulletin de paie',
  patente: 'Patente & Licence',
  cnss: 'CNSS Patronal',
};

const MONTANT_BASE = 2000;
const TAUX_FRAIS = 0.015;
const frais = Math.round(MONTANT_BASE * TAUX_FRAIS);
const total = MONTANT_BASE + frais;

type PaymentStep = 'form' | 'waiting' | 'success' | 'error' | 'mock';

interface PaymentModalProps {
  documentType: DocumentType;
  documentId: string;
  onSuccess: () => void;
  onClose: () => void;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function PaymentModal({ documentType, documentId, onSuccess, onClose }: PaymentModalProps) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<PaymentStep>('form');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Nettoyage à la fermeture
  useEffect(() => () => stopPolling(), [stopPolling]);

  // Polling du statut
  const startPolling = useCallback((id: string) => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/${id}/status`);
        if (data.statut === 'completed') {
          stopPolling();
          setStep('success');
          setTimeout(onSuccess, 1500);
        } else if (data.statut === 'failed' || data.statut === 'expired') {
          stopPolling();
          setErrorMsg(
            data.statut === 'expired'
              ? 'Délai de paiement expiré (10 min). Veuillez réessayer.'
              : 'Paiement refusé. Vérifiez votre solde Orange Money.'
          );
          setStep('error');
        }
      } catch {
        // Ignorer les erreurs réseau transitoires
      }
    }, 3000);
  }, [stopPolling, onSuccess]);

  const handlePay = async () => {
    // Valider téléphone
    const cleaned = phone.replace(/\s/g, '').replace(/^\+226/, '').replace(/^00226/, '');
    if (!/^[0-9]{8}$/.test(cleaned)) {
      setErrorMsg('Entrez un numéro Orange Money valide (8 chiffres)');
      return;
    }
    setErrorMsg('');
    setStep('waiting');

    try {
      const { data } = await api.post('/payments/initiate', {
        document_type: documentType,
        document_id: documentId,
        telephone: cleaned,
      });

      // Mode mock (OM_API_URL non configuré) — paiement auto-approuvé
      if (data.mock || data.statut === 'completed') {
        setStep('success');
        setTimeout(onSuccess, 1200);
        return;
      }

      // Paiement déjà existant (cache)
      if (data.cached && data.statut === 'completed') {
        setStep('success');
        setTimeout(onSuccess, 800);
        return;
      }

      setPaymentId(data.id);
      startPolling(data.id);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error || 'Erreur initialisation du paiement. Réessayez.'
      );
      setStep('form');
    }
  };

  const handleRetry = () => {
    stopPolling();
    setStep('form');
    setErrorMsg('');
    setElapsed(0);
    setPaymentId(null);
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Orange Money</p>
              <p className="text-orange-100 text-xs">Paiement sécurisé</p>
            </div>
          </div>
          {step !== 'waiting' && (
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">

          {/* Document info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Document à générer</p>
            <p className="font-semibold text-gray-800">{DOC_LABELS[documentType]}</p>
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Génération PDF</span>
                <span className="font-medium">{MONTANT_BASE.toLocaleString('fr')} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Frais Orange Money (1,5%)</span>
                <span className="font-medium">{frais.toLocaleString('fr')} FCFA</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                <span className="text-gray-700">Total</span>
                <span className="text-orange-600">{total.toLocaleString('fr')} FCFA</span>
              </div>
            </div>
          </div>

          {/* ─── Étape : formulaire ─── */}
          {step === 'form' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Numéro Orange Money
                </label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
                  <span className="bg-orange-50 border-r border-gray-300 px-3 py-2.5 text-sm font-medium text-orange-700 select-none">
                    +226
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="70 00 00 00"
                    className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                    maxLength={8}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handlePay()}
                  />
                </div>
                {errorMsg && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />{errorMsg}
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-4">
                Vous recevrez une demande de confirmation USSD sur votre téléphone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handlePay}
                  disabled={phone.length < 8}
                  className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  Payer {total.toLocaleString('fr')} FCFA
                </button>
              </div>
            </>
          )}

          {/* ─── Étape : attente confirmation ─── */}
          {step === 'waiting' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">En attente de confirmation</h3>
              <p className="text-sm text-gray-500 mb-1">
                Vérifiez votre téléphone Orange Money
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Composez le code secret pour confirmer le paiement de{' '}
                <span className="font-semibold text-orange-600">{total.toLocaleString('fr')} FCFA</span>
              </p>
              <div className="bg-orange-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-orange-700">
                  Temps écoulé : <span className="font-mono font-bold">{formatElapsed(elapsed)}</span>
                  {' '}/{' '}10:00
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
              >
                <RefreshCw className="w-3 h-3" /> Annuler et recommencer
              </button>
            </div>
          )}

          {/* ─── Étape : succès ─── */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-green-700 mb-2">Paiement confirmé !</h3>
              <p className="text-sm text-gray-500">Génération du document en cours…</p>
            </div>
          )}

          {/* ─── Étape : erreur ─── */}
          {step === 'error' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-bold text-red-700 mb-2">Paiement échoué</h3>
              <p className="text-sm text-gray-500 mb-4">{errorMsg}</p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Fermer
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold"
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Hook usePaymentGate ──────────────────────────────────────────────────────

interface PaymentGateState {
  documentType: DocumentType;
  documentId: string;
  onSuccess: () => void;
}

/**
 * Hook pour déclencher le modal de paiement depuis n'importe quelle page.
 *
 * @example
 * const { requestPayment, PaymentModalComponent } = usePaymentGate();
 *
 * // Intercepter le clic "Générer PDF"
 * <button onClick={() => requestPayment('iuts', decl.id, () => generateOfficialDGIPDF(decl, company, bulletins))}>
 *   Formulaire DGI
 * </button>
 *
 * {PaymentModalComponent}
 */
export function usePaymentGate() {
  const [gate, setGate] = useState<PaymentGateState | null>(null);

  const requestPayment = useCallback(
    (docType: DocumentType, docId: string, onSuccess: () => void) => {
      setGate({ documentType: docType, documentId: docId, onSuccess });
    },
    []
  );

  const closeModal = useCallback(() => setGate(null), []);

  const PaymentModalComponent = gate ? (
    <PaymentModal
      documentType={gate.documentType}
      documentId={gate.documentId}
      onSuccess={() => {
        gate.onSuccess();
        closeModal();
      }}
      onClose={closeModal}
    />
  ) : null;

  return { requestPayment, PaymentModalComponent };
}
