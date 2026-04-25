/**
 * PaymentModal - Barrière de paiement Orange Money avant génération PDF
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

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { api } from '../lib/api';
import { X, Smartphone, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// --- Types --------------------------------------------------------------------

export type DocumentType =
  | 'iuts' | 'tva' | 'retenues' | 'is' | 'ircm'
  | 'cme' | 'irf' | 'bulletin' | 'patente' | 'cnss'
  | 'annexe' | 'duplicata' | 'annexe_bulletin';

const DOC_LABELS: Record<DocumentType, string> = {
  iuts: 'Déclaration IUTS/TPA',
  tva: 'Déclaration TVA',
  retenues: 'Retenues à la source (RAS)',
  is: 'Impôt sur les Sociétés (IS)',
  ircm: 'IRCM - Capitaux Mobiliers',
  cme: 'Contribution Micro-Entreprise',
  irf: 'Impôt sur les Revenus Fonciers',
  bulletin: 'Bulletin de paie',
  patente: 'Patente & Licence',
  cnss: 'CNSS Patronal',
  annexe: 'Pack Annexes',
  duplicata: 'Duplicata Pack Annexes',
  annexe_bulletin: 'Pack Annexes + Bulletins',
};

const DOC_BASE_AMOUNT: Record<DocumentType, number> = {
  iuts: 2000,
  tva: 2000,
  retenues: 2000,
  is: 2000,
  ircm: 2000,
  cme: 2000,
  irf: 2000,
  bulletin: 5000,
  patente: 2000,
  cnss: 2000,
  annexe: 5000,
  duplicata: 3000,
  annexe_bulletin: 8000,
};
const TAUX_FRAIS = 0.015;
const BYPASS_PAYMENT = String(import.meta.env.VITE_BYPASS_PAYMENT ?? '').toLowerCase() === 'true';
const DEMO_PAYMENT_MODE =
  import.meta.env.DEV ||
  String(import.meta.env.VITE_PAYMENT_DEMO ?? '').toLowerCase() === 'true';

type PaymentStep = 'form' | 'waiting' | 'success' | 'error' | 'mock';

interface PaymentModalProps {
  documentType: DocumentType;
  documentId: string;
  onSuccess: () => void;
  onClose: () => void;
}

// --- Modal --------------------------------------------------------------------

export function PaymentModal({ documentType, documentId, onSuccess, onClose }: PaymentModalProps) {
  const montantBase = DOC_BASE_AMOUNT[documentType] ?? 2000;
  const frais = Math.round(montantBase * TAUX_FRAIS);
  const total = montantBase + frais;
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<PaymentStep>('form');
  const [_paymentId, setPaymentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [demoTxId, setDemoTxId] = useState('');
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
    if (!/^[0-9]{6}$/.test(otp)) {
      setErrorMsg('Entrez le code OTP Orange Money (6 chiffres)');
      return;
    }
    setErrorMsg('');
    setStep('waiting');

    if (DEMO_PAYMENT_MODE) {
      const tx = `OM-DEMO-${Date.now()}`;
      setDemoTxId(tx);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
      window.setTimeout(() => {
        stopPolling();
        setStep('success');
        setTimeout(onSuccess, 900);
      }, 2200);
      return;
    }

    try {
      const { data } = await api.post('/payments/initiate', {
        document_type: documentType,
        document_id: documentId,
        telephone: cleaned,
        otp,
        montant_base: montantBase,
      });

      // Mode mock (OM_API_URL non configuré) - paiement auto-approuvé
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur initialisation du paiement. Réessayez.';
      setErrorMsg(msg);
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

  const currentStep = step === 'form' ? 1 : step === 'waiting' ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-3">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_24px_55px_-30px_rgba(2,6,23,0.45)]">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <Smartphone className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Orange Money</p>
              <p className="text-orange-100/95 text-[11px]">Paiement sécurisé • FISCA</p>
            </div>
          </div>
          {step !== 'waiting' && (
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-4.5">
          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {[
              { n: 1, label: 'Saisie' },
              { n: 2, label: 'Validation' },
              { n: 3, label: 'Confirmation' },
            ].map((s) => {
              const done = currentStep > s.n;
              const active = currentStep === s.n;
              return (
                <div
                  key={s.n}
                  className={`rounded-lg border px-1.5 py-1.5 text-center transition ${
                    done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : active
                        ? 'border-orange-200 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <p className="text-[10px] font-bold leading-none">{s.n}</p>
                  <p className="text-[9px] mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>


          {/* Document info */}
          <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl p-3.5 mb-4 border border-slate-200">
            <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em] mb-1">Document à générer</p>
            <p className="font-semibold text-slate-800">{DOC_LABELS[documentType]}</p>
            {DEMO_PAYMENT_MODE && (
              <div className="mt-2 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                MODE DEMO
              </div>
            )}
            <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">Génération PDF</span>
                <span className="font-semibold text-slate-800">{montantBase.toLocaleString('fr')} FCFA</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">Frais Orange Money (1,5%)</span>
                <span className="font-semibold text-slate-800">{frais.toLocaleString('fr')} FCFA</span>
              </div>
              <div className="flex justify-between items-center text-[13px] font-bold border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-700">Total à payer</span>
                <span className="rounded-md bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5">
                  {total.toLocaleString('fr')} FCFA
                </span>
              </div>
            </div>
          </div>

          {/* --- Étape : formulaire --- */}
          {step === 'form' && (
            <>
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Numéro Orange Money
                </label>
                <div className="group flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-100 transition">
                  <span className="bg-orange-50 border-r border-slate-300 px-3 py-2.5 text-sm font-semibold text-orange-700 select-none">
                    +226
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="70 00 00 00"
                    className="flex-1 px-3 py-2 text-sm outline-none bg-white text-slate-800 placeholder:text-slate-400"
                    maxLength={8}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handlePay()}
                  />
                </div>
                {errorMsg && (
                  <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />{errorMsg}
                  </p>
                )}
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Code OTP Orange Money
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm tracking-[0.18em] font-semibold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  maxLength={6}
                  inputMode="numeric"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Saisissez le OTP généré après la confirmation USSD (*144#).
                </p>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                Vous recevrez une demande de confirmation USSD sur votre téléphone.
              </p>
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">
                  Transaction sécurisée • Chiffrement TLS • Reçu avec traçabilité QR
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handlePay}
                  disabled={phone.length < 8 || otp.length < 6}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-orange-300 disabled:to-amber-300 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                >
                  Payer {total.toLocaleString('fr')} FCFA
                </button>
              </div>
            </>
          )}

          {/* --- Étape : attente confirmation --- */}
          {step === 'waiting' && (
            <div className="text-center py-3">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 ring-6 ring-orange-50 animate-pulse">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
              <h3 className="font-bold text-slate-800 mb-2">En attente de confirmation</h3>
              <p className="text-sm text-slate-500 mb-1">
                Vérifiez votre téléphone Orange Money
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Composez le code secret pour confirmer le paiement de{' '}
                <span className="font-semibold text-orange-600">{total.toLocaleString('fr')} FCFA</span>
              </p>
              {DEMO_PAYMENT_MODE && (
                <p className="text-xs text-sky-700 mb-4">
                  Simulation démo en cours{demoTxId ? ` · Tx ${demoTxId}` : ''}.
                </p>
              )}
              <div className="bg-orange-50 rounded-xl border border-orange-100 p-2.5 mb-3">
                <p className="text-xs text-orange-700">
                  Temps écoulé : <span className="font-mono font-bold">{formatElapsed(elapsed)}</span>
                  {' '}/{' '}10:00
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-1000"
                  style={{ width: `${Math.min(100, (elapsed / 600) * 100)}%` }}
                />
              </div>
              <button
                onClick={handleRetry}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto"
              >
                <RefreshCw className="w-3 h-3" /> Annuler et recommencer
              </button>
            </div>
          )}

          {/* --- Étape : succès --- */}
          {step === 'success' && (
            <div className="text-center py-3">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 ring-6 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-emerald-700 mb-2">Paiement confirmé !</h3>
              <p className="text-sm text-slate-500">Génération du document en cours…</p>
              <p className="text-xs text-slate-400 mt-1">Ne fermez pas cette fenêtre pendant l’export.</p>
              {DEMO_PAYMENT_MODE && demoTxId && (
                <p className="text-xs text-slate-400 mt-2">Référence démo : {demoTxId}</p>
              )}
            </div>
          )}

          {/* --- Étape : erreur --- */}
          {step === 'error' && (
            <div className="text-center py-3">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3 ring-6 ring-rose-50">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-bold text-rose-700 mb-2">Paiement échoué</h3>
              <p className="text-sm text-slate-500 mb-4">{errorMsg}</p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Fermer
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-sm font-bold"
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

// --- Hook ---------------------------------------------------------------------

interface PaymentGateState {
  documentType: DocumentType;
  documentId: string;
  onSuccess: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePaymentGate(): {
  requestPayment: (docType: DocumentType, docId: string, onSuccess: () => void) => void;
  PaymentModalComponent: ReactNode;
} {
  const [gate, setGate] = useState<PaymentGateState | null>(null);

  const requestPayment = useCallback(
    (docType: DocumentType, docId: string, onSuccess: () => void) => {
      if (BYPASS_PAYMENT && !DEMO_PAYMENT_MODE) {
        // Explicit bypass mode: skip payment flow and generate immediately.
        onSuccess();
        return;
      }
      setGate({ documentType: docType, documentId: docId, onSuccess });
    },
    []
  );

  const closeModal = useCallback(() => setGate(null), []);

  const PaymentModalComponent: ReactNode = gate ? (
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
