import { useAuthStore } from './store';

/**
 * Hook centralisé de gestion des permissions par rôle organisationnel.
 *
 * Rôles:
 *  - physique (solo) ou org_admin : accès complet en écriture
 *  - comptable    : écriture sur les déclarations fiscales, lecture seule sur RH
 *  - gestionnaire_rh : écriture sur les employés/bulletins, lecture seule sur fiscal
 *  - auditeur     : lecture seule totale
 */
export function usePermissions() {
    const { user } = useAuthStore();

    const orgRole = user?.org_role;
    const isPhysique = !user?.org_id; // pas d'org = solo physique

    const isOrgAdmin = orgRole === 'org_admin';
    const isComptable = orgRole === 'comptable';
    const isGestionnaireRH = orgRole === 'gestionnaire_rh';
    const isAuditeur = orgRole === 'auditeur';

    // Écriture globale : tout sauf auditeur
    const canWrite = !isAuditeur;

    // Gestion des employés : physique, org_admin, gestionnaire_rh
    const canManageEmployees = !isAuditeur && (isPhysique || isOrgAdmin || isGestionnaireRH);

    // Génération / validation déclarations fiscales : physique, org_admin, comptable
    const canManageDeclarations = !isAuditeur && (isPhysique || isOrgAdmin || isComptable);

    // Génération bulletins de paie : physique, org_admin, gestionnaire_rh
    const canManageBulletins = !isAuditeur && (isPhysique || isOrgAdmin || isGestionnaireRH);

    // Accès aux modules fiscaux avancés (TVA, IRF, IS...) : physique, org_admin, comptable
    const canManageFiscal = !isAuditeur && (isPhysique || isOrgAdmin || isComptable);

    // Label du rôle pour l'affichage
    const roleLabel: Record<string, string> = {
        org_admin: 'Administrateur',
        comptable: 'Comptable',
        gestionnaire_rh: 'Gestionnaire RH',
        auditeur: 'Auditeur (Lecture seule)',
    };

    const roleBadgeColor: Record<string, string> = {
        org_admin: 'bg-green-100 text-green-700 border-green-200',
        comptable: 'bg-blue-100 text-blue-700 border-blue-200',
        gestionnaire_rh: 'bg-purple-100 text-purple-700 border-purple-200',
        auditeur: 'bg-amber-100 text-amber-700 border-amber-200',
    };

    return {
        orgRole,
        isPhysique,
        isOrgAdmin,
        isComptable,
        isGestionnaireRH,
        isAuditeur,
        canWrite,
        canManageEmployees,
        canManageDeclarations,
        canManageBulletins,
        canManageFiscal,
        roleLabel: orgRole ? (roleLabel[orgRole] ?? orgRole) : null,
        roleBadgeColor: orgRole ? (roleBadgeColor[orgRole] ?? '') : '',
    };
}
