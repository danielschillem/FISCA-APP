import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'FISCA — Plateforme Fiscale Intelligente',
    description: 'Gestion fiscale IUTS/TPA/CNSS — Burkina Faso',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
            <body className={inter.className}>
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
