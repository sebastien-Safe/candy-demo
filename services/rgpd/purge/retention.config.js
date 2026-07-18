/**
 * [ candy-e ] — DÉLAIS LÉGAUX DE CONSERVATION
 * Fichier : services/rgpd/purge/retention.config.js
 *
 * Limité aux règles réellement applicables au schéma de ce dépôt — un
 * référentiel RGPD générique en couvre davantage (RH, paie, formation,
 * contrats, historique d'habilitations, sessions...), volontairement
 * absentes ici :
 *   - DOSSIER_MEDICAL_MINEUR : un EHPAD n'accueille que des résidents
 *     majeurs par définition de l'établissement — non applicable.
 *   - PAIE_RH / FORMATION / CONTRATS_EHPAD : aucun module RH, paie,
 *     formation ou gestion de contrats n'existe dans ce dépôt.
 *   - HABILITATIONS : aucune table d'historique des habilitations révoquées
 *     n'existe (seul l'état courant profiles.role/actif est stocké, pas son
 *     historique) — les changements de rôle sont toutefois tracés dans
 *     audit_logs (USER_ROLE_CHANGED), couverts par la règle AUDIT_LOGS.
 *   - SESSIONS_EXPIREES : authentification JWT stateless, aucune table
 *     sessions n'existe.
 */

'use strict';

const RETENTION_RULES = Object.freeze({
  DOSSIER_MEDICAL_ADULTE: {
    label: 'Dossier médical résident',
    base: 'discharge_date',
    years: 20,
    legalRef: 'Art. R. 1112-7 CSP',
    category: 'sante',
  },
  USER_ACCOUNT: {
    label: 'Compte utilisateur professionnel fermé',
    base: 'account_closed_at',
    years: 5,
    legalRef: 'CNIL — recommandation comptes professionnels',
    category: 'rh',
  },
  AUDIT_LOGS: {
    label: "Journaux d'accès et traces d'audit",
    base: 'created_at',
    months: 12,
    legalRef: 'PGSSI-S référentiel imputabilité v1.0 + CNIL',
    category: 'technique',
    exception: {
      condition: 'linked_to_breach = true',
      months: 36,
      legalRef: 'Art. 33 RGPD — obligation de documentation des violations',
    },
  },
  RESET_TOKENS: {
    label: 'Tokens de réinitialisation de mot de passe expirés',
    base: 'reset_token_expires_at',
    legalRef: 'Bonne pratique sécurité',
    category: 'technique',
  },
});

module.exports = { RETENTION_RULES };
