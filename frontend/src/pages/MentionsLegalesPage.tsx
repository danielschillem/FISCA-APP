import { useState } from 'react';
import { Shield, FileText, Lock, Scale, Info, ChevronDown, ChevronRight, Mail } from 'lucide-react';
import {
    APP_NAME, APP_VERSION, APP_FULL_NAME, APP_DESCRIPTION,
    DEVELOPER_NAME, DEVELOPER_CONTACT, DEVELOPER_WEBSITE,
    COPYRIGHT_NOTICE, COPYRIGHT_YEAR_START, COPYRIGHT_YEAR_END,
    HOSTING_PROVIDER, DB_PROVIDER,
    LEGAL_REFERENCE, SOCIAL_REFERENCE, GOVERNING_LAW,
    CGU_DATE, POLITIQUE_CONFIDENTIALITE_DATE, EULA_DATE,
} from '../lib/version';

// --- Composants internes ----------------------------------------------------

function Section({ id, icon: Icon, title, badge, children }: {
    id: string; icon: React.ElementType; title: string; badge?: string; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(true);
    return (
        <section id={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-900">{title}</h2>
                    {badge && <p className="text-[11px] text-gray-400 mt-0.5">{badge}</p>}
                </div>
                {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {open && (
                <div className="px-6 pb-6 border-t border-gray-50">
                    {children}
                </div>
            )}
        </section>
    );
}

function Art({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
    return (
        <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1.5">
                <span className="text-green-700 font-bold mr-1">{n}.</span>{title}
            </h3>
            <div className="text-sm text-gray-600 space-y-1.5 leading-relaxed text-justify">{children}</div>
        </div>
    );
}

function Dl({ items }: { items: [string, string][] }) {
    return (
        <dl className="mt-4 space-y-2">
            {items.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 text-sm">
                    <dt className="text-gray-500 font-medium col-span-1">{k}</dt>
                    <dd className="text-gray-800 col-span-2">{v}</dd>
                </div>
            ))}
        </dl>
    );
}

// --- Navigation latérale ----------------------------------------------------
const SECTIONS = [
    { id: 'identification', label: 'Identification' },
    { id: 'mentions', label: 'Mentions légales' },
    { id: 'licence', label: 'Licence (EULA)' },
    { id: 'cgu', label: 'CGU' },
    { id: 'confidentialite', label: 'Confidentialité' },
    { id: 'responsabilite', label: 'Responsabilité' },
    { id: 'droit', label: 'Droit applicable' },
];

// --- Page principale --------------------------------------------------------
export default function MentionsLegalesPage() {
    return (
        <div className="max-w-4xl space-y-6">
            {/* En-tête */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Scale className="w-7 h-7 text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">
                            Mentions légales, CGU &amp; Licence
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">{APP_FULL_NAME}</p>
                        <div className="flex flex-wrap gap-3 mt-4">
                            <span className="text-[11px] bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-semibold border border-green-500/30">
                                v{APP_VERSION}
                            </span>
                            <span className="text-[11px] bg-white/10 text-slate-300 px-2.5 py-1 rounded-full font-medium">
                                {COPYRIGHT_NOTICE}
                            </span>
                            <span className="text-[11px] bg-white/10 text-slate-300 px-2.5 py-1 rounded-full font-medium">
                                {LEGAL_REFERENCE}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation rapide */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Navigation rapide</p>
                <div className="flex flex-wrap gap-2">
                    {SECTIONS.map(({ id, label }) => (
                        <a
                            key={id}
                            href={`#${id}`}
                            className="text-xs font-medium text-green-700 border border-green-200 bg-green-50 px-3 py-1 rounded-full hover:bg-green-100 transition-colors"
                        >
                            {label}
                        </a>
                    ))}
                </div>
            </div>

            {/* -- 1. Identification -- */}
            <Section id="identification" icon={Info} title="Identification du logiciel et de l'éditeur">
                <Dl items={[
                    ['Nom du logiciel', `${APP_NAME} - v${APP_VERSION}`],
                    ['Description', APP_DESCRIPTION],
                    ['Éditeur & développeur', DEVELOPER_NAME],
                    ['Contact', DEVELOPER_CONTACT],
                    ['Site web', DEVELOPER_WEBSITE],
                    ['Droit applicable', GOVERNING_LAW],
                    ['Hébergement applicatif', HOSTING_PROVIDER],
                    ['Base de données', DB_PROVIDER],
                    ['Référence fiscale', LEGAL_REFERENCE],
                    ['Référence sociale', SOCIAL_REFERENCE],
                    ['© Copyright', `${COPYRIGHT_YEAR_START}-${COPYRIGHT_YEAR_END} ${DEVELOPER_NAME}`],
                ]} />
            </Section>

            {/* -- 2. Mentions légales -- */}
            <Section id="mentions" icon={FileText} title="Mentions légales" badge="Conformément aux lois en vigueur au Burkina Faso">
                <Art n="1" title="Éditeur du logiciel">
                    <p>
                        Le logiciel <strong>{APP_NAME}</strong> (ci-après « le Logiciel ») est édité et développé par
                        <strong> {DEVELOPER_NAME}</strong>, développeur indépendant de logiciels, dont les coordonnées
                        sont les suivantes :
                    </p>
                    <ul className="list-disc ml-5 space-y-0.5 mt-2">
                        <li>Email : <a href={`mailto:${DEVELOPER_CONTACT}`} className="text-green-700 underline">{DEVELOPER_CONTACT}</a></li>
                        <li>Site web : <a href={DEVELOPER_WEBSITE} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">{DEVELOPER_WEBSITE}</a></li>
                    </ul>
                </Art>

                <Art n="2" title="Hébergement">
                    <p>Le Logiciel est hébergé sur les infrastructures suivantes :</p>
                    <ul className="list-disc ml-5 space-y-0.5 mt-2">
                        <li><strong>Application web</strong> : {HOSTING_PROVIDER}</li>
                        <li><strong>Base de données</strong> : {DB_PROVIDER}</li>
                    </ul>
                    <p className="mt-2 text-xs text-gray-500">
                        L'hébergeur traite les données conformément aux réglementations applicables (RGPD pour les
                        données hébergées en UE). L'éditeur ne saurait être tenu responsable des interruptions de
                        service imputables à ces prestataires tiers.
                    </p>
                </Art>

                <Art n="3" title="Propriété intellectuelle">
                    <p>
                        L'intégralité du Logiciel - code source, interfaces graphiques, algorithmes de calcul fiscal,
                        bases de données tarifaires, documentation et marques - est la propriété exclusive de
                        <strong> {DEVELOPER_NAME}</strong>, protégée par les lois burkinabè et internationales relatives
                        à la propriété intellectuelle, au droit d'auteur et aux droits voisins.
                    </p>
                    <p className="mt-2">
                        Toute reproduction, représentation, modification, adaptation, traduction, ou exploitation
                        commerciale, totale ou partielle, sans autorisation écrite préalable de l'éditeur, est
                        strictement interdite et constitue une contrefaçon passible de poursuites judiciaires.
                    </p>
                </Art>

                <Art n="4" title="Avertissement fiscal">
                    <p>
                        Le Logiciel est un outil d'aide à la gestion fiscale. Il ne constitue pas un conseil fiscal
                        ou juridique. Les calculs produits sont basés sur le {LEGAL_REFERENCE} et le {SOCIAL_REFERENCE},
                        tels qu'interprétés à la date de mise à jour du Logiciel.
                    </p>
                    <p className="mt-2">
                        <strong>L'utilisateur demeure seul responsable</strong> de la conformité de ses déclarations
                        fiscales et sociales vis-à-vis de la Direction Générale des Impôts (DGI) et de la Caisse
                        Nationale de Sécurité Sociale (CNSS) du Burkina Faso. En cas de doute, l'utilisateur est
                        invité à consulter un expert-comptable ou un conseiller fiscal agréé.
                    </p>
                </Art>
            </Section>

            {/* -- 3. Licence EULA -- */}
            <Section id="licence" icon={Lock} title="Contrat de licence utilisateur final (EULA)" badge={`En vigueur depuis le ${EULA_DATE}`}>
                <p className="text-sm text-gray-500 mt-4 italic text-justify">
                    En installant, téléchargeant, accédant ou utilisant le Logiciel {APP_NAME}, vous acceptez d'être
                    lié par les termes du présent Contrat de licence. Si vous n'acceptez pas ces termes, vous ne
                    devez pas utiliser le Logiciel.
                </p>

                <Art n="1" title="Concession de licence">
                    <p>
                        Sous réserve du respect des présentes conditions et des modalités commerciales en vigueur
                        (tarification, accès aux modules), <strong>{DEVELOPER_NAME}</strong> vous concède un droit
                        d'accès et d'utilisation du Logiciel, non exclusif, personnel, non transférable et révocable,
                        uniquement pour vos besoins professionnels internes liés à la gestion fiscale et sociale au
                        Burkina Faso.
                    </p>
                </Art>

                <Art n="2" title="Étendue des droits">
                    <p>
                        Les fonctionnalités disponibles peuvent varier selon le profil du compte (personne physique
                        ou morale), les options activées et les évolutions du service. La description à jour des
                        offres est communiquée sur le site ou sur demande auprès de <strong>{DEVELOPER_NAME}</strong>.
                    </p>
                </Art>

                <Art n="3" title="Restrictions">
                    <p>Il est expressément interdit à l'utilisateur de :</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li>Copier, décompiler, désassembler, rétroconcevoir ou tenter d'extraire le code source du Logiciel ;</li>
                        <li>Vendre, louer, sous-licencier, prêter ou transférer tout ou partie du Logiciel ou des droits y afférents à un tiers ;</li>
                        <li>Modifier, adapter, traduire ou créer des œuvres dérivées à partir du Logiciel ;</li>
                        <li>Supprimer ou altérer tout avis de propriété intellectuelle, marque déposée ou mention de copyright ;</li>
                        <li>Utiliser le Logiciel à des fins illégales ou pour contester des obligations fiscales auprès des autorités burkinabè ;</li>
                        <li>Partager ses identifiants de connexion avec des tiers non autorisés.</li>
                    </ul>
                </Art>

                <Art n="4" title="Mises à jour et évolutions">
                    <p>
                        L'éditeur se réserve le droit de mettre à jour, modifier ou améliorer le Logiciel à tout moment,
                        notamment pour assurer la conformité avec les évolutions législatives du CGI. Les mises à jour
                        sont déployées automatiquement. Les mises à jour majeures susceptibles de modifier les calculs
                        feront l'objet d'une notification dans l'interface.
                    </p>
                </Art>

                <Art n="5" title="Durée et résiliation">
                    <p>
                        La licence est consentie pour la durée d'utilisation du service conformément aux conditions
                        contractuelles applicables. Elle prend fin en cas de résiliation du compte, de cessation du
                        service ou de violation des présentes conditions. En cas de résiliation, l'utilisateur devra
                        cesser immédiatement toute utilisation du Logiciel. L'éditeur se réserve le droit de résilier
                        l'accès sans préavis en cas de violation grave des présentes conditions.
                    </p>
                </Art>

                <Art n="6" title="Propriété des données utilisateur">
                    <p>
                        Les données fiscales et sociales saisies par l'utilisateur dans le Logiciel demeurent sa
                        propriété exclusive. L'éditeur n'utilise ces données qu'à des fins de fourniture du service
                        et de sauvegarde technique. L'utilisateur peut demander l'export ou la suppression de ses
                        données à tout moment via l'adresse <a href={`mailto:${DEVELOPER_CONTACT}`} className="text-green-700 underline">{DEVELOPER_CONTACT}</a>.
                    </p>
                </Art>
            </Section>

            {/* -- 4. CGU -- */}
            <Section id="cgu" icon={FileText} title="Conditions Générales d'Utilisation (CGU)" badge={`Version du ${CGU_DATE}`}>
                <p className="text-sm text-gray-500 mt-4 italic text-justify">
                    Les présentes Conditions Générales d'Utilisation régissent l'accès et l'utilisation du service
                    {APP_NAME} accessible à l'adresse {DEVELOPER_WEBSITE} et ses sous-domaines associés.
                </p>

                <Art n="1" title="Objet">
                    <p>
                        Le service {APP_NAME} est une plateforme SaaS (Software as a Service) de gestion fiscale et
                        sociale destinée aux contribuables, entreprises, cabinets d'expertise comptable et
                        professionnels exerçant au Burkina Faso. Il offre des outils de calcul, de déclaration et
                        d'archivage conformes au {LEGAL_REFERENCE}.
                    </p>
                </Art>

                <Art n="2" title="Accès au service - Inscription">
                    <p>L'accès au service est subordonné à :</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li>La création d'un compte avec une adresse email valide ;</li>
                        <li>L'acceptation des présentes CGU et de la politique de confidentialité ;</li>
                        <li>Le cas échéant, l'acceptation des conditions tarifaires applicables à votre utilisation du service.</li>
                    </ul>
                    <p className="mt-2">
                        L'utilisateur garantit que les informations fournies lors de l'inscription sont exactes,
                        complètes et actualisées. Tout compte créé avec de fausses informations peut être supprimé
                        sans préavis.
                    </p>
                </Art>

                <Art n="3" title="Obligations de l'utilisateur">
                    <p>L'utilisateur s'engage à :</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li>Utiliser le service de manière loyale, conformément aux lois burkinabè en vigueur ;</li>
                        <li>Ne pas tenter de porter atteinte au bon fonctionnement du service ;</li>
                        <li>Saisir des données fiscales sincères et conformes à sa situation réelle ;</li>
                        <li>Protéger ses identifiants de connexion et signaler toute compromission ;</li>
                        <li>Ne pas utiliser le service pour des activités frauduleuses, notamment la falsification de données fiscales.</li>
                    </ul>
                </Art>

                <Art n="4" title="Responsabilité fiscale">
                    <p>
                        <strong>L'utilisateur est seul responsable</strong> de l'exactitude des données qu'il saisit
                        et de l'utilisation qu'il fait des résultats produits par le Logiciel. Le service {APP_NAME}
                        est un outil d'aide à la déclaration et ne se substitue pas à un conseil fiscal professionnel.
                    </p>
                    <p className="mt-2">
                        Les calculs sont effectués sur la base du CGI 2025. L'éditeur ne peut garantir l'exactitude
                        des résultats en cas de modification législative non encore intégrée dans le Logiciel. Il
                        appartient à l'utilisateur de vérifier la conformité de ses déclarations auprès de la DGI.
                    </p>
                </Art>

                <Art n="5" title="Disponibilité du service">
                    <p>
                        L'éditeur s'engage à mettre en œuvre les moyens raisonnables pour assurer la disponibilité
                        du service 24h/24 et 7j/7. Cependant, des interruptions pour maintenance, mise à jour ou
                        cas de force majeure peuvent survenir. L'éditeur ne saurait être tenu responsable des
                        conséquences d'une indisponibilité temporaire du service.
                    </p>
                </Art>

                <Art n="6" title="Tarification et prestations payantes">
                    <p>
                        Les prix et modalités de facturation (notamment en Francs CFA, XOF) sont communiqués dans
                        l'application, sur le site ou par tout canal d'information tenu par l'éditeur. Les paiements
                        peuvent s'effectuer via les moyens proposés (par exemple Mobile Money ou virement), selon les
                        options disponibles au moment de la commande. Les conditions de remboursement ou d'annulation,
                        le cas échéant, sont précisées au moment de la souscription de la prestation concernée.
                    </p>
                </Art>

                <Art n="7" title="Résiliation">
                    <p>
                        L'utilisateur peut demander la clôture de son compte ou cesser d'utiliser le service selon les
                        modalités indiquées par l'éditeur. L'accès aux fonctionnalités soumises à rémunération cesse
                        conformément aux conditions contractuelles applicables. L'éditeur peut résilier un compte en
                        cas de violation des présentes CGU, dans les limites prévues par la loi.
                    </p>
                </Art>

                <Art n="8" title="Modification des CGU">
                    <p>
                        L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
                        seront informés de toute modification substantielle par notification dans l'interface ou par
                        email. La poursuite de l'utilisation du service après notification vaut acceptation des
                        nouvelles conditions.
                    </p>
                </Art>
            </Section>

            {/* -- 5. Politique de confidentialité -- */}
            <Section id="confidentialite" icon={Shield} title="Politique de confidentialité" badge={`Version du ${POLITIQUE_CONFIDENTIALITE_DATE}`}>
                <Art n="1" title="Données collectées">
                    <p>Dans le cadre de l'utilisation du service, les données suivantes sont collectées :</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li><strong>Données d'identification</strong> : adresse email, nom de l'entreprise, NIF/IFU, régime fiscal ;</li>
                        <li><strong>Données fiscales et sociales</strong> : salaires, cotisations, chiffres d'affaires, déclarations IUTS/TVA/IS/CME ;</li>
                        <li><strong>Données de connexion</strong> : adresse IP, navigateur, horodatage des connexions ;</li>
                        <li><strong>Données de paiement</strong> : référence de transaction Mobile Money (aucun numéro de carte bancaire n'est stocké).</li>
                    </ul>
                </Art>

                <Art n="2" title="Finalités du traitement">
                    <p>Les données sont collectées pour les finalités suivantes :</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li>Fourniture du service de gestion fiscale et sociale ;</li>
                        <li>Authentification et sécurité des comptes ;</li>
                        <li>Facturation et suivi des prestations ;</li>
                        <li>Amélioration du service (anonymisée, agrégée) ;</li>
                        <li>Respect des obligations légales applicables.</li>
                    </ul>
                </Art>

                <Art n="3" title="Conservation des données">
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li><strong>Données fiscales</strong> : conservées pendant 10 ans conformément aux obligations légales burkinabè (Code des Impôts) ;</li>
                        <li><strong>Données de compte</strong> : conservées jusqu'à suppression du compte + 30 jours ;</li>
                        <li><strong>Données de connexion</strong> : conservées 12 mois à des fins de sécurité ;</li>
                        <li><strong>Données de paiement</strong> : conservées 5 ans à des fins comptables.</li>
                    </ul>
                </Art>

                <Art n="4" title="Partage et sous-traitants">
                    <p>
                        Les données ne sont jamais vendues ni cédées à des tiers à des fins commerciales. Elles
                        peuvent être transmises à des sous-traitants techniques strictement nécessaires à la
                        fourniture du service :
                    </p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li><strong>Render.com</strong> - hébergement de l'application (USA, soumis au DPF EU-US) ;</li>
                        <li><strong>Neon Technology</strong> - base de données PostgreSQL (EU, conforme RGPD) ;</li>
                        <li><strong>Orange Money BF</strong> - traitement des paiements Mobile Money.</li>
                    </ul>
                </Art>

                <Art n="5" title="Droits des utilisateurs">
                    <p>Conformément aux lois applicables, vous disposez des droits suivants :</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                        <li><strong>Accès</strong> : obtenir une copie de vos données personnelles ;</li>
                        <li><strong>Rectification</strong> : corriger des données inexactes ;</li>
                        <li><strong>Suppression</strong> : demander l'effacement de vos données (sous réserve des obligations légales de conservation) ;</li>
                        <li><strong>Portabilité</strong> : recevoir vos données dans un format structuré ;</li>
                        <li><strong>Opposition</strong> : vous opposer à certains traitements.</li>
                    </ul>
                    <p className="mt-2">
                        Pour exercer vos droits, contactez-nous à <a href={`mailto:${DEVELOPER_CONTACT}`} className="text-green-700 underline">{DEVELOPER_CONTACT}</a>.
                    </p>
                </Art>

                <Art n="6" title="Sécurité">
                    <p>
                        Les données sont protégées par des mesures techniques et organisationnelles adaptées :
                        chiffrement TLS en transit, hachage bcrypt des mots de passe, accès à la base de données
                        restreint par liste blanche, tokens JWT à durée limitée, journaux d'audit des actions
                        sensibles.
                    </p>
                </Art>
            </Section>

            {/* -- 6. Limitation de responsabilité -- */}
            <Section id="responsabilite" icon={Shield} title="Limitation de responsabilité">
                <Art n="1" title="Exclusion de garantie">
                    <p>
                        Le Logiciel est fourni « tel quel », sans garantie d'aucune sorte, expresse ou implicite.
                        L'éditeur ne garantit pas que le Logiciel sera exempt d'erreurs, ininterrompu ou adapté
                        à des besoins particuliers.
                    </p>
                </Art>

                <Art n="2" title="Limitation de responsabilité">
                    <p>
                        Dans les limites autorisées par la loi applicable, la responsabilité totale de l'éditeur
                        au titre du présent contrat est limitée au montant des sommes effectivement versées par
                        l'utilisateur au titre du service au cours des 12 derniers mois précédant le sinistre.
                        L'éditeur ne saurait
                        en aucun cas être tenu responsable de dommages indirects, y compris les redressements
                        fiscaux, pénalités ou intérêts de retard résultant d'une erreur de calcul ou d'une
                        utilisation incorrecte du Logiciel.
                    </p>
                </Art>

                <Art n="3" title="Force majeure">
                    <p>
                        L'éditeur ne saurait être tenu responsable de tout manquement à ses obligations résultant
                        d'un cas de force majeure tel que défini par le droit burkinabè, incluant notamment les
                        catastrophes naturelles, conflits armés, cyberattaques externes, pannes des opérateurs
                        Internet ou des prestataires d'hébergement.
                    </p>
                </Art>
            </Section>

            {/* -- 7. Droit applicable -- */}
            <Section id="droit" icon={Scale} title="Droit applicable et résolution des litiges">
                <Art n="1" title="Loi applicable">
                    <p>
                        Les présentes conditions sont régies et interprétées conformément au droit burkinabè,
                        notamment le Code Civil, le Code de Commerce, le Code Général des Impôts 2025 et la
                        législation applicable aux logiciels et services numériques au Burkina Faso.
                    </p>
                </Art>

                <Art n="2" title="Résolution des litiges">
                    <p>
                        En cas de litige relatif à l'interprétation ou à l'exécution des présentes conditions,
                        les parties s'engagent à rechercher une solution amiable dans un délai de 30 jours à
                        compter de la notification du désaccord. À défaut de résolution amiable, le litige sera
                        soumis à la compétence exclusive des tribunaux de <strong>Ouagadougou, Burkina Faso</strong>.
                    </p>
                </Art>

                <Art n="3" title="Contact légal">
                    <p>Pour toute question juridique ou demande relative aux présentes conditions :</p>
                    <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <Mail className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <a href={`mailto:${DEVELOPER_CONTACT}`} className="text-green-700 font-semibold hover:underline">
                            {DEVELOPER_CONTACT}
                        </a>
                    </div>
                </Art>
            </Section>

            {/* Pied de page */}
            <div className="text-center py-6 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-500">{COPYRIGHT_NOTICE}</p>
                <p>{APP_FULL_NAME} &nbsp;-&nbsp; v{APP_VERSION}</p>
                <p>Développé par <strong className="text-gray-600">{DEVELOPER_NAME}</strong> &nbsp;-&nbsp; {GOVERNING_LAW}</p>
            </div>
        </div>
    );
}
