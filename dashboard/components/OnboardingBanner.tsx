'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { companyApi } from '@/lib/api'
import type { Company } from '@/types'
import { useRouter, usePathname } from 'next/navigation'
import { AlertTriangle, ArrowRight } from 'lucide-react'

/**
 * OnboardingBanner détecte si le profil société est incomplet (IFU manquant)
 * et affiche une bannière d'incitation à compléter le profil.
 * Ne s'affiche pas sur la page Paramètres elle-même.
 */
export default function OnboardingBanner() {
    const router = useRouter()
    const pathname = usePathname()
    const [dismissed, setDismissed] = useState(false)

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    })

    // Ne pas afficher sur la page paramètres ni si déjà fermé
    if (dismissed || pathname === '/dashboard/parametres') return null
    // IFU requis pour télédéclaration DGI
    if (!company || company.ifu) return null

    return (
        <div style={{
            background: 'var(--ora-l)',
            border: '1.5px solid var(--ora)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
        }}>
            <AlertTriangle size={18} style={{ color: 'var(--ora)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 13, color: 'var(--gr9)' }}>Complétez votre profil entreprise</strong>
                <p style={{ fontSize: 12, color: 'var(--gr6)', margin: '2px 0 0' }}>
                    Votre numéro IFU est requis pour générer des fichiers de télédéclaration DGI valides.
                </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => router.push('/dashboard/parametres')}
                >
                    Compléter <ArrowRight size={12} />
                </button>
                <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setDismissed(true)}
                >
                    Plus tard
                </button>
            </div>
        </div>
    )
}
