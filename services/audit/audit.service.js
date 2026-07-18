/**
 * [ candy-e ] — SERVICE DE JOURNALISATION RGPD
 * Fichier : services/audit/audit.service.js
 *
 * Écrit dans la table audit_logs existante (001_init_schema.sql, étendue
 * par 006_extend_audit_logs.sql) — ne la remplace pas, complète les
 * colonnes déjà utilisées par log_action()/journaliserAudit() (routes/auth.js,
 * routes/insi.js). logAudit() est le point d'entrée pour les futures routes
 * RGPD (droits des personnes, purge) qui ont besoin des colonnes étendues
 * (old_values/new_values masqués, success, legal_basis...) — les routes
 * existantes peuvent continuer à utiliser log_action() sans migration.
 *
 * ⚠️ req.user (middleware/auth.js) ne contient que { id, role } — le JWT
 * n'embarque pas l'email. actorEmail n'est donc PAS renseigné
 * automatiquement par auditMiddleware ; les appelants qui l'ont déjà sous
 * la main (ex. après une requête SELECT sur profiles) doivent le passer
 * explicitement dans l'entrée.
 */

'use strict';

const { pool } = require('../../db/client');
const { maskSensitiveFields } = require('./audit.mask');

/**
 * @param {object} entry
 * @param {string} [entry.actorId]
 * @param {string} [entry.actorEmail]
 * @param {string} entry.actorRole
 * @param {string} [entry.actorIp]
 * @param {string} [entry.actorUserAgent]
 * @param {string} entry.action - une valeur de AUDIT_ACTIONS (audit.actions.js)
 * @param {string} entry.resourceType - 'resident', 'consultation', 'profile', 'system', ...
 * @param {string} [entry.resourceId]
 * @param {string} [entry.resourceLabel]
 * @param {object} [entry.oldValues] - masqué automatiquement avant insertion
 * @param {object} [entry.newValues] - masqué automatiquement avant insertion
 * @param {object} [entry.metadata]
 * @param {boolean} [entry.success]
 * @param {string} [entry.errorMessage]
 * @param {string} [entry.requestId]
 * @param {string} [entry.legalBasis]
 */
async function logAudit(entry) {
  try {
    await pool.query(
      `INSERT INTO public.audit_logs (
        user_id, user_role, actor_email, ip_address, actor_user_agent,
        action, table_name, record_id, resource_label,
        old_values, new_values, details,
        success, error_message, request_id, legal_basis
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16
      )`,
      [
        entry.actorId ?? null,
        entry.actorRole,
        entry.actorEmail ?? null,
        entry.actorIp ?? null,
        entry.actorUserAgent ?? null,
        entry.action,
        entry.resourceType,
        entry.resourceId ?? null,
        entry.resourceLabel ?? null,
        entry.oldValues ? JSON.stringify(maskSensitiveFields(entry.oldValues)) : null,
        entry.newValues ? JSON.stringify(maskSensitiveFields(entry.newValues)) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.success ?? true,
        entry.errorMessage ?? null,
        entry.requestId ?? null,
        entry.legalBasis ?? null,
      ]
    );
  } catch (err) {
    // Ne jamais faire échouer l'action principale à cause du log.
    console.error('[candy-e] [audit] échec d\'écriture — action non tracée', {
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      error: err.message,
    });
  }
}

/**
 * Attache req.audit(partial) — les routes appellent req.audit({ action,
 * resourceType, resourceId, ... }) sans répéter actorRole/actorIp/etc.
 * À monter après authMiddleware pour que req.user soit disponible.
 */
function auditMiddleware(req, res, next) {
  req.audit = (partial) => logAudit({
    ...partial,
    actorId: req.user?.id,
    actorRole: req.user?.role ?? 'unknown',
    actorIp: req.ip,
    actorUserAgent: req.headers['user-agent'],
    requestId: req.id,
  });
  next();
}

module.exports = { logAudit, auditMiddleware };
