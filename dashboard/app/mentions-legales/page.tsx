import Link from 'next/link'

export const metadata = {
    title: 'Mentions légales — FISCA',
    description: 'Mentions légales de la plateforme de gestion fiscale FISCA',
}

export default function MentionsLegalesPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--g900)',
            padding: '40px 16px',
        }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: 32 }}>
                    <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gr5)', textDecoration: 'none', marginBottom: 20 }}>
                        ← Retour
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                        <div className="logo-icon" style={{ width: 40, height: 40, fontSize: 18 }}>F</div>
                        <strong style={{ fontSize: 17, fontWeight: 800, color: 'var(--gr9)' }}>FISCA</strong>
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gr9)', marginBottom: 4 }}>
                        Mentions légales
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--gr5)' }}>Dernière mise à jour : janvier 2025</p>
                </div>

                <div className="card" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

                    <Section title="1. Éditeur de la plateforme">
                        <p>La plateforme FISCA est éditée par :</p>
                        <ul>
                            <li><strong>Dénomination sociale :</strong> FISCA SAS</li>
                            <li><strong>Siège social :</strong> Ouagadougou, Burkina Faso</li>
                            <li><strong>RCCM :</strong> BF-OUA-2024-B-XXXXX</li>
                            <li><strong>IFU :</strong> en cours d'obtention</li>
                            <li><strong>Email :</strong> <a href="mailto:contact@fisca.app" style={{ color: 'var(--g500)' }}>contact@fisca.app</a></li>
                        </ul>
                    </Section>

                    <Section title="2. Directeur de la publication">
                        <p>Le directeur de la publication est le représentant légal de FISCA SAS.</p>
                    </Section>

                    <Section title="3. Hébergement">
                        <p>La plateforme FISCA est hébergée par :</p>
                        <ul>
                            <li><strong>Société :</strong> Render Services, Inc.</li>
                            <li><strong>Adresse :</strong> 525 Brannan Street, Suite 300, San Francisco, CA 94107, USA</li>
                            <li><strong>Site :</strong> <a href="https://render.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--g500)' }}>render.com</a></li>
                        </ul>
                        <p>Les données sont stockées sur des serveurs situés dans la région EU (Frankfurt, Allemagne).</p>
                    </Section>

                    <Section title="4. Propriété intellectuelle">
                        <p>
                            L'ensemble des éléments constituant la plateforme FISCA (textes, graphismes, logiciels, calculs fiscaux,
                            algorithmes) est protégé par le droit de la propriété intellectuelle applicable au Burkina Faso.
                        </p>
                        <p>
                            Toute reproduction, représentation, modification ou exploitation non autorisée, à titre commercial ou non,
                            est strictement interdite sans l'accord préalable et écrit de FISCA SAS.
                        </p>
                    </Section>

                    <Section title="5. Données personnelles">
                        <p>
                            Conformément à la loi n° 010-2004/AN du 20 avril 2004 portant protection des données à caractère personnel
                            au Burkina Faso et au Règlement Général sur la Protection des Données (RGPD — UE 2016/679), vous disposez
                            des droits suivants sur vos données :
                        </p>
                        <ul>
                            <li>Droit d'accès et de rectification</li>
                            <li>Droit d'effacement (droit à l'oubli)</li>
                            <li>Droit à la portabilité des données</li>
                            <li>Droit d'opposition au traitement</li>
                        </ul>
                        <p>
                            Pour exercer ces droits, contactez-nous à{' '}
                            <a href="mailto:privacy@fisca.app" style={{ color: 'var(--g500)' }}>privacy@fisca.app</a>.
                        </p>
                        <p>
                            Les données collectées (email, informations d'entreprise, salaires) sont utilisées exclusivement dans
                            le cadre du service FISCA et ne sont jamais vendues à des tiers.
                        </p>
                    </Section>

                    <Section title="6. Cookies">
                        <p>
                            FISCA utilise uniquement des cookies fonctionnels nécessaires au fonctionnement du service
                            (authentification, session). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.
                        </p>
                    </Section>

                    <Section title="7. Droit applicable et juridiction">
                        <p>
                            Les présentes mentions légales sont régies par le droit burkinabè.
                            Tout litige relatif à l'utilisation de la plateforme FISCA sera soumis à la compétence exclusive
                            des tribunaux compétents d'Ouagadougou, Burkina Faso.
                        </p>
                    </Section>

                    <div style={{ borderTop: '1px solid var(--gr2)', paddingTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <Link href="/cgu" style={{ fontSize: 13, color: 'var(--g500)' }}>Conditions Générales d'Utilisation</Link>
                        <Link href="/login" style={{ fontSize: 13, color: 'var(--gr5)' }}>Retour à la connexion</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gr9)', marginBottom: 10 }}>
                {title}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--gr6)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {children}
            </div>
        </section>
    )
}
