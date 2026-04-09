import Link from 'next/link'

export const metadata = {
    title: 'Conditions Générales d\'Utilisation — FISCA',
    description: 'Conditions générales d\'utilisation de la plateforme FISCA',
}

export default function CGUPage() {
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
                        Conditions Générales d'Utilisation
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--gr5)' }}>Dernière mise à jour : janvier 2025</p>
                </div>

                <div className="card" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

                    <Section title="1. Objet">
                        <p>
                            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation
                            de la plateforme FISCA, outil de gestion fiscale dédié aux entreprises opérant au Burkina Faso.
                        </p>
                        <p>
                            En créant un compte, l'utilisateur accepte sans réserve les présentes CGU.
                        </p>
                    </Section>

                    <Section title="2. Description du service">
                        <p>FISCA est une plateforme SaaS permettant de :</p>
                        <ul>
                            <li>Calculer l'Impôt Unique sur les Traitements et Salaires (IUTS) et la Taxe Patronale d'Apprentissage (TPA) conformément à la Loi de Finances 2020 du Burkina Faso</li>
                            <li>Gérer les fiches de paie et cotisations sociales (CNSS / CARFO)</li>
                            <li>Produire et archiver les déclarations fiscales mensuelles</li>
                            <li>Générer les fichiers d'export pour téléchargement auprès de la Direction Générale des Impôts (DGI)</li>
                        </ul>
                    </Section>

                    <Section title="3. Création de compte">
                        <p>L'accès au service nécessite la création d'un compte avec :</p>
                        <ul>
                            <li>Une adresse email valide</li>
                            <li>Un mot de passe d'au moins 8 caractères</li>
                            <li>La raison sociale de l'entreprise</li>
                        </ul>
                        <p>
                            L'utilisateur est responsable de la confidentialité de ses identifiants.
                            Tout accès avec ses identifiants est réputé effectué par l'utilisateur.
                        </p>
                    </Section>

                    <Section title="4. Obligations de l'utilisateur">
                        <p>L'utilisateur s'engage à :</p>
                        <ul>
                            <li>Fournir des informations exactes et à jour sur son entreprise et ses salariés</li>
                            <li>Utiliser FISCA conformément à la législation fiscale burkinabè en vigueur</li>
                            <li>Ne pas tenter de contourner les mécanismes de sécurité de la plateforme</li>
                            <li>Ne pas utiliser FISCA à des fins frauduleuses ou illicites</li>
                        </ul>
                    </Section>

                    <Section title="5. Responsabilité">
                        <p>
                            FISCA SAS s'efforce de maintenir les calculs fiscaux conformes à la législation en vigueur.
                            Cependant, la plateforme ne se substitue pas aux obligations légales de l'entreprise.
                        </p>
                        <p>
                            L'utilisateur reste seul responsable du dépôt de ses déclarations fiscales dans les délais
                            légaux auprès des autorités compétentes (DGI, CNSS, CARFO).
                        </p>
                        <p>
                            FISCA SAS ne saurait être tenu responsable des pénalités de retard ou amendes fiscales
                            résultant d'un dépôt tardif ou incomplet.
                        </p>
                    </Section>

                    <Section title="6. Confidentialité des données">
                        <p>
                            Les données saisies sur FISCA (informations d'entreprise, données salariales) sont
                            strictement confidentielles. FISCA SAS s'engage à ne jamais les communiquer à des tiers
                            sans le consentement explicite de l'utilisateur, sauf obligation légale.
                        </p>
                        <p>
                            Pour plus d'informations, consultez nos <Link href="/mentions-legales" style={{ color: 'var(--g500)' }}>Mentions légales</Link>.
                        </p>
                    </Section>

                    <Section title="7. Plans tarifaires">
                        <p>
                            FISCA est disponible selon plusieurs plans :
                        </p>
                        <ul>
                            <li><strong>Starter :</strong> Jusqu'à 10 employés — gratuit pendant la phase bêta</li>
                            <li><strong>Pro :</strong> Employés illimités, exports illimités, support prioritaire</li>
                            <li><strong>Enterprise :</strong> Multi-entreprises, intégrations API, SLA garanti</li>
                        </ul>
                        <p>Les tarifs définitifs seront communiqués à la sortie de la version V1.</p>
                    </Section>

                    <Section title="8. Disponibilité du service">
                        <p>
                            FISCA SAS s'engage à maintenir une disponibilité du service de 99 % hors maintenances
                            programmées. Les maintenances sont annoncées avec un préavis de 24 heures par email.
                        </p>
                    </Section>

                    <Section title="9. Résiliation">
                        <p>
                            L'utilisateur peut supprimer son compte à tout moment depuis l'espace Paramètres.
                            Les données sont supprimées dans un délai de 30 jours suivant la résiliation.
                        </p>
                        <p>
                            FISCA SAS se réserve le droit de suspendre un compte en cas de manquement aux présentes CGU.
                        </p>
                    </Section>

                    <Section title="10. Modification des CGU">
                        <p>
                            FISCA SAS se réserve le droit de modifier les présentes CGU à tout moment.
                            Les utilisateurs seront notifiés par email au moins 15 jours avant l'entrée en vigueur
                            des nouvelles conditions. L'utilisation continue du service vaut acceptation des nouvelles CGU.
                        </p>
                    </Section>

                    <Section title="11. Droit applicable">
                        <p>
                            Les présentes CGU sont soumises au droit burkinabè.
                            Tout litige sera porté devant les juridictions compétentes d'Ouagadougou.
                        </p>
                        <p>
                            Contact : <a href="mailto:legal@fisca.app" style={{ color: 'var(--g500)' }}>legal@fisca.app</a>
                        </p>
                    </Section>

                    <div style={{ borderTop: '1px solid var(--gr2)', paddingTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <Link href="/mentions-legales" style={{ fontSize: 13, color: 'var(--g500)' }}>Mentions légales</Link>
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
